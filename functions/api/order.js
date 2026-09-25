import { createAdminClient, fail, hasActiveStaffRecord, json, sameOriginRequest } from './_security.js';
import { saveOrderChange, fetchAllSyncRows } from '../../src/utils/orderRepository.js';
import { mergeOrders, orderPaymentTiming, trackingExpired } from '../../src/utils/orderLifecycle.js';
import { orderStaffRole, driverOwnsOrder, allowedOrderChange } from './_orderAccess.js';
import { getEnabledPaymentMethods } from '../../src/utils/paymentMethods.js';
import { money } from '../../src/utils/checkout.js';
import { isShopOpenCurrently } from '../../src/utils/storeHours.js';
import { validateOrderInput } from '../../src/utils/orderValidation.js';
import { validateCustomerPricing } from '../../src/utils/orderPricing.js';
import { isOrderTypeEnabled } from '../../src/utils/orderChannels.js';
import { clientKey, contactKey, orderLimitError } from './_orderLimits.js';
import { sendTelegramMessage } from './telegram.js';

async function checkCustomerPricing(client, order) {
  const keys = ['bases', 'flavors', 'toppings', 'packs', 'popsicles', 'liter_config', 'coupons', 'delivery_fee', 'free_delivery_threshold', 'shop_open'];
  const entries = await Promise.all(keys.map(async key => {
    const { data, error } = await client.from('helados_sync').select('value').eq('key', key).maybeSingle();
    if (error) throw new Error('No se pudo verificar el catálogo. Intenta nuevamente.');
    return [key, data?.value];
  }));
  return validateCustomerPricing(order, Object.fromEntries(entries));
}

async function validatePaymentAvailability(client, previous, next, { enforceStoreHours = true, skipPayment = false } = {}) {
  if (previous && previous.customer?.paymentMethod === next.customer?.paymentMethod) return null;
  const { data, error } = await client.from('helados_sync').select('value').eq('key', 'shop_open').maybeSingle();
  if (error) throw new Error('No se pudo consultar los métodos de pago. Intenta nuevamente.');
  if (!previous && !isOrderTypeEnabled(data?.value, next.customer?.orderType || 'Barra')) return 'Este canal de atención está desactivado. Elige otro antes de confirmar.';
  if (!previous && enforceStoreHours && !isShopOpenCurrently(data?.value ?? { open: true })) return 'La tienda está cerrada en este momento. Conserva tu carrito e intenta en el horario de atención.';
  if (skipPayment) return null;
  return getEnabledPaymentMethods(data?.value).includes(next.customer?.paymentMethod) ? null : 'Este método de pago ya no está disponible. Selecciona otro método activo.';
}

const TRACKING_EXPIRED = 'El seguimiento de este pedido terminó: está disponible hasta 72 horas después de la entrega. Si necesitas ayuda, escríbenos por WhatsApp.';
const ORDER_ID_RE = /^PED-[A-Z0-9-]{4,40}$/;
const RECEIPT_TOKEN_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ownsReceipt = (order, token) => Boolean(RECEIPT_TOKEN_RE.test(String(token || '')) && order?.submissionKey === token);
const publicTrackingView = (order) => ({
  id: order.id,
  status: order.status,
  date: order.date,
  updatedAt: order.updatedAt,
  statusHistory: order.statusHistory,
  customer: { orderType: order.customer?.orderType },
  limited: true,
});

const cleanOrderId = (value) => String(value || '').replace(/\s+/g, '').toUpperCase();

const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const trimText = (value, max = 160) => String(value || '').trim().slice(0, max);

const staffSession = async (request, client) => {
  const token = request.headers.get('Authorization')?.replace(/^Bearer /, '');
  if (!token) return null;
  const { data, error } = await client.auth.getUser(token);
  const user = data?.user;
  const role = !error && orderStaffRole(user);
  if (!role) return null;
  return await hasActiveStaffRecord(client, user) ? user : null;
};

const safeDate = (value) => {
  const date = new Date(value || '');
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
};

const isValidOrderItem = (item) => {
  if (!isPlainObject(item)) return false;
  const quantity = Number(item.quantity);
  const price = Number(item.price);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) return false;
  if (!Number.isFinite(price) || price < 0 || price > 10000) return false;
  if (String(item.name || '').length > 160) return false;
  if (!trimText(item.name || item.type || item.id, 160)) return false;
  return true;
};

const validateOrderForCreate = (order) => {
  if (!isPlainObject(order)) return 'Pedido invalido.';
  if (JSON.stringify(order).length > 50000) return 'El pedido es demasiado grande.';
  const id = cleanOrderId(order.id);
  if (!ORDER_ID_RE.test(id)) return 'Codigo de pedido invalido.';
  if (!RECEIPT_TOKEN_RE.test(String(order.submissionKey || ''))) return 'Identificador seguro de pedido inválido.';
  if (!Array.isArray(order.items) || order.items.length === 0 || order.items.length > 40) {
    return 'El pedido debe incluir productos validos.';
  }
  if (!order.items.every(isValidOrderItem)) return 'El pedido contiene productos invalidos.';
  if (!isPlainObject(order.customer)) return 'Datos del cliente invalidos.';
  const input = validateOrderInput({ ...order.customer, cart: order.items, needsTable: ['Mesa', 'Mesa_Llevar'].includes(order.customer.orderType) });
  if (!input.isValid) return Object.values(input.errors)[0];
  if (order.customer.paymentTiming !== undefined && !['Al llegar', 'Anticipado'].includes(order.customer.paymentTiming)) return 'Modalidad de pago inválida.';
  if (!trimText(order.customer.name, 80)) return 'Falta el nombre del cliente.';
  if (!trimText(order.customer.phone, 40)) return 'Falta el telefono del cliente.';
  if (String(order.customer.name).length > 80 || String(order.customer.phone).length > 40 || String(order.customer.address || '').length > 300 || String(order.customer.operationCode || '').length > 50) return 'Los datos del cliente son demasiado largos.';
  if (!Number.isFinite(Number(order.grandTotal)) || Number(order.grandTotal) < 0) {
    return 'Total del pedido invalido.';
  }
  const subtotal = money(order.items.reduce((sum, item) => sum + money(item.price) * Number(item.quantity), 0));
  const deliveryFee = Number(order.deliveryFee ?? 0);
  const discount = Number(order.discount ?? 0);
  if (!Number.isFinite(deliveryFee) || deliveryFee < 0 || !Number.isFinite(discount) || discount < 0 || discount > subtotal) return 'Los importes de envío o descuento no son válidos.';
  if (order.total !== undefined && (!Number.isFinite(Number(order.total)) || Math.abs(Number(order.total) - subtotal) > 0.011)) return 'El subtotal no coincide con los productos. Revisa tu carrito.';
  if (Math.abs(Number(order.grandTotal) - money(subtotal + deliveryFee - discount)) > 0.011) return 'El total no coincide con los productos, envío y descuento. Revisa tu carrito.';
  return null;
};

const validateOperatorOrderForCreate = (order) => {
  if (!isPlainObject(order) || JSON.stringify(order).length > 50000) return 'Pedido inválido.';
  if (!/^(PED|FIS|ORD)-[A-Z0-9-]{3,40}$/.test(cleanOrderId(order.id))) return 'Código de pedido inválido.';
  if (!Array.isArray(order.items) || order.items.length === 0 || order.items.length > 40 || !order.items.every(isValidOrderItem)) return 'El pedido contiene productos inválidos.';
  if (!isPlainObject(order.customer) || !trimText(order.customer.name, 80)) return 'Faltan los datos del cliente.';
  const orderType = order.customer.orderType || 'Barra';
  if (!['Delivery', 'Mesa', 'Mesa_Llevar', 'Barra', 'Llevar'].includes(orderType)) return 'Tipo de atención inválido.';
  if (['Mesa', 'Mesa_Llevar'].includes(orderType) && !/^[1-9]\d{0,2}$/.test(String(order.customer.tableNumber || ''))) return 'Número de mesa inválido.';
  if (orderType === 'Delivery' && trimText(order.customer.address, 200).length < 5) return 'Falta la dirección de entrega.';
  if (!trimText(order.customer.paymentMethod, 60)) return 'Selecciona un método de pago.';
  if (!['Pendiente', 'Entregado'].includes(order.status)) return 'El pedido del operador debe iniciar en cola o como venta terminada.';
  if (order.status === 'Entregado' && order.paymentVerified !== true) return 'Una venta terminada requiere cobro confirmado.';
  const subtotal = money(order.items.reduce((sum, item) => sum + money(item.price) * Number(item.quantity), 0));
  const deliveryFee = Number(order.deliveryFee ?? 0);
  const discount = Number(order.discount ?? 0);
  if (!Number.isFinite(deliveryFee) || deliveryFee < 0 || !Number.isFinite(discount) || discount < 0 || discount > subtotal) return 'Los importes de envío o descuento no son válidos.';
  if (!Number.isFinite(Number(order.grandTotal)) || Math.abs(Number(order.grandTotal) - money(subtotal + deliveryFee - discount)) > 0.011) return 'El total no coincide con los productos.';
  return null;
};

const sanitizeSurvey = (survey) => {
  if (!isPlainObject(survey)) return null;
  const rating = Number(survey.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return null;
  return {
    rating,
    comment: trimText(survey.comment, 500),
    date: safeDate(survey.date),
  };
};

export async function onRequestGet({ request, env }, makeClient = createAdminClient) {
  try {
    if (!sameOriginRequest(request)) return fail(403, 'origin', 'Origen no permitido.');

    const url = new URL(request.url);
    if (url.searchParams.get('scope') === 'operations') {
      const client = await makeClient(env);
      const user = await staffSession(request, client);
      if (!user) return fail(403, 'auth', 'Inicia sesión con una cuenta de operador.');
      const rows = await fetchAllSyncRows(client);
      const legacy = rows.find(row => row.key === 'orders')?.value;
      let orders = mergeOrders(legacy, rows.filter(row => row.key.startsWith('order_') && !row.key.startsWith('order_call_')).map(row => row.value));
      if (orderStaffRole(user) === 'repartidor') orders = orders.filter(order => driverOwnsOrder(user, order));
      return json({ ok: true, orders });
    }
    const id = cleanOrderId(url.searchParams.get('id'));
    if (!ORDER_ID_RE.test(id)) return fail(400, 'input', 'Codigo de pedido invalido.');
    const receiptToken = url.searchParams.get('token');

    const adminClient = await makeClient(env);
    const { data, error } = await adminClient
      .from('helados_sync')
      .select('value')
      .eq('key', `order_${id}`)
      .maybeSingle();

    if (error) return fail(502, 'read', 'No se pudo leer el pedido. Intenta nuevamente.');
    if (!data?.value) {
      // Compatibility for confirmed orders saved by older operator versions.
      const { data: legacy, error: legacyError } = await adminClient.from('helados_sync').select('value').eq('key', 'orders').maybeSingle();
      if (legacyError) return fail(502, 'read', 'No se pudo consultar el historial de pedidos.');
      const order = Array.isArray(legacy?.value) && legacy.value.find(item => cleanOrderId(item?.id) === id);
      if (order && trackingExpired(order)) return fail(410, 'expired', TRACKING_EXPIRED);
      if (order) return json({ ok: true, order: ownsReceipt(order, receiptToken) ? order : publicTrackingView(order) });
      return fail(404, 'not_found', 'Pedido no encontrado.');
    }

    if (trackingExpired(data.value)) return fail(410, 'expired', TRACKING_EXPIRED);
    return json({ ok: true, order: ownsReceipt(data.value, receiptToken) ? data.value : publicTrackingView(data.value) });
  } catch (err) {
    return json({ error: err.message || 'Error inesperado.' }, 500);
  }
}

export async function onRequestPost({ request, env }, makeClient = createAdminClient) {
  try {
    if (!sameOriginRequest(request)) return fail(403, 'origin', 'Origen no permitido.');

    let body;
    try {
      body = await request.json();
    } catch {
      return fail(400, 'input', 'Solicitud inválida.');
    }
    if (body?.action === 'update') {
      const client = await makeClient(env);
      const user = await staffSession(request, client);
      if (!user) return fail(403, 'auth', 'Inicia sesión con una cuenta de operador.');
      if (!isPlainObject(body.order) || !isPlainObject(body.previous) || !/^(PED|FIS|ORD)-[A-Z0-9-]{3,40}$/.test(body.order.id) || JSON.stringify(body).length > 150000) return fail(400, 'input', 'Pedido inválido.');
      if (!allowedOrderChange(user, body.previous, body.order)) return fail(403, 'auth', 'Tu rol no permite este cambio de pedido.');
      try {
        let proposedOrder = body.order;
        if (!body.previous.paymentVerified && proposedOrder.paymentVerified) {
          proposedOrder = {
            ...proposedOrder,
            paymentVerifiedAt: new Date().toISOString(),
            paymentVerifiedBy: {
              id: user.id || null,
              email: user.email || null,
              role: orderStaffRole(user),
            },
          };
        }
        const paymentError = await validatePaymentAvailability(client, body.previous, proposedOrder);
        if (paymentError) return fail(400, 'payment', paymentError);
        const order = await saveOrderChange(client, body.previous, proposedOrder);
        return json({ ok: true, order });
      } catch (error) { return fail(409, 'update', error.message || 'No se pudo guardar el pedido.'); }
    }
    if (body?.action === 'customer_correct') {
      // The customer spotted a mistake before the shop confirmed the order:
      // cancel it (with their private receipt) so they can fix the cart and resend.
      const correctId = cleanOrderId(body.id);
      if (!ORDER_ID_RE.test(correctId)) return fail(400, 'input', 'Código de pedido inválido.');
      const client = await makeClient(env);
      const key = `order_${correctId}`;
      const { data: row, error: readError } = await client.from('helados_sync').select('value,updated_at').eq('key', key).maybeSingle();
      if (readError) return fail(502, 'read', 'No se pudo leer el pedido. Intenta nuevamente.');
      if (!row?.value) return fail(404, 'not_found', 'Pedido no encontrado.');
      if (!ownsReceipt(row.value, body.submissionKey)) return fail(403, 'auth', 'Abre el enlace privado de tu pedido para corregirlo.');
      if (row.value.status !== 'Por Corroborar' || row.value.paymentVerified) {
        return fail(409, 'locked', 'La tienda ya confirmó tu pedido y no se puede corregir desde aquí. Escríbenos por WhatsApp y te ayudamos.');
      }
      const now = new Date().toISOString();
      const next = {
        ...row.value,
        status: 'Cancelado',
        cancelledBy: 'cliente',
        cancelReason: 'El cliente lo anuló para corregirlo.',
        statusHistory: [...(Array.isArray(row.value.statusHistory) ? row.value.statusHistory : []), { status: 'Cancelado', timestamp: now, by: 'cliente' }],
        updatedAt: now,
        revision: (Number(row.value.revision) || 0) + 1,
      };
      const { data: saved, error: writeError } = await client.from('helados_sync')
        .update({ key, value: next, updated_at: now })
        .eq('key', key)
        .eq('value', JSON.stringify(row.value))
        .select('value')
        .maybeSingle();
      if (writeError) return fail(502, 'write', 'No se pudo corregir el pedido. Intenta nuevamente.');
      if (!saved?.value) return fail(409, 'conflict', 'La tienda acaba de actualizar tu pedido. Revisa su estado antes de corregirlo.');
      if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) {
        try {
          await sendTelegramMessage({ token: env.TELEGRAM_BOT_TOKEN, chatId: env.TELEGRAM_CHAT_ID, text: `✏️ Pedido ${correctId} anulado por el cliente para corregirlo. No lo prepares: llegará un pedido nuevo con los cambios.` });
        } catch {
          // The order is already cancelled; the admin panel shows it either way.
        }
      }
      return json({ ok: true, order: saved.value });
    }
    if (body?.action === 'create_operator') {
      const client = await makeClient(env);
      const user = await staffSession(request, client);
      const role = orderStaffRole(user);
      if (!['admin', 'vendedor', 'cajero', 'mozo'].includes(role)) return fail(403, 'auth', 'Tu rol no permite registrar pedidos o ventas.');
      const order = body.order;
      const validationError = validateOperatorOrderForCreate(order);
      if (validationError) return fail(400, 'input', validationError);

      const id = cleanOrderId(order.id);
      const isCourtesy = Number(order.grandTotal) === 0 && order.customer.paymentMethod === 'Cortesía/Gratis';
      const paymentError = await validatePaymentAvailability(client, null, order, { enforceStoreHours: false, skipPayment: isCourtesy });
      if (paymentError) return fail(400, 'payment', paymentError);

      const now = new Date().toISOString();
      const paymentVerified = order.paymentVerified === true;
      const nextOrder = {
        id,
        revision: 1,
        customer: {
          ...order.customer,
          orderType: order.customer.orderType || 'Barra',
          paymentTiming: orderPaymentTiming({ ...order, paymentVerified }),
        },
        items: order.items,
        total: money(order.items.reduce((sum, item) => sum + money(item.price) * Number(item.quantity), 0)),
        deliveryFee: Number(order.deliveryFee) || 0,
        discount: Number(order.discount) || 0,
        couponCode: trimText(order.couponCode, 80) || null,
        grandTotal: Number(order.grandTotal),
        paymentVerified,
        tablePaid: order.status === 'Entregado' && order.tablePaid === true && paymentVerified,
        assignedDriver: null,
        status: order.status,
        statusHistory: [{ status: order.status, timestamp: now }],
        date: safeDate(order.date),
        updatedAt: now,
        isOperator: true,
        ...(paymentVerified ? {
          paymentVerifiedAt: now,
          paymentVerifiedBy: { id: user.id || null, email: user.email || null, role },
        } : {}),
        ...(order.status === 'Entregado' ? { deliveredAt: now } : {}),
      };
      const { data: saved, error } = await client
        .from('helados_sync')
        .insert({ key: `order_${id}`, value: nextOrder, updated_at: now })
        .select('value')
        .maybeSingle();
      if (error?.code === '23505') return fail(409, 'conflict', 'Este código ya pertenece a otro pedido.');
      if (error || !saved?.value) return fail(502, 'write', 'No se pudo guardar el pedido del operador.');
      return json({ ok: true, order: saved.value });
    }
    const order = body?.order || body?.value;
    const id = cleanOrderId(body?.id || order?.id);
    if (!ORDER_ID_RE.test(id)) return fail(400, 'input', 'Codigo de pedido invalido.');

    const adminClient = await makeClient(env);
    const { data: existingRow, error: readError } = await adminClient
      .from('helados_sync')
      .select('value,updated_at')
      .eq('key', `order_${id}`)
      .maybeSingle();

    if (readError) return fail(502, 'read', 'No se pudo validar el pedido. Intenta nuevamente.');

    let nextOrder = null;
    if (existingRow?.value) {
      if (!order?.survey && ownsReceipt(existingRow.value, order?.submissionKey)) {
        return json({ ok: true, order: existingRow.value });
      }
      const survey = sanitizeSurvey(order?.survey);
      if (!survey) return fail(409, 'conflict', 'Este código ya pertenece a un pedido registrado.');
      if (!ownsReceipt(existingRow.value, order?.submissionKey)) return fail(403, 'auth', 'El enlace de este pedido es necesario para enviar la encuesta.');
      if (existingRow.value.survey) return fail(409, 'conflict', 'La encuesta de este pedido ya fue registrada.');
      if (existingRow.value.status !== 'Entregado') return fail(400, 'input', 'La encuesta está disponible después de la entrega.');
      nextOrder = {
        ...existingRow.value,
        survey,
      };
    } else {
      const validationError = validateOrderForCreate(order);
      if (validationError) return fail(400, 'input', validationError);
      const paymentError = await validatePaymentAvailability(adminClient, null, order);
      if (paymentError) return fail(400, 'payment', paymentError);
      const pricingError = await checkCustomerPricing(adminClient, order);
      if (pricingError) return fail(pricingError.startsWith('La configuración de envío') ? 503 : 400, 'pricing', pricingError);
      if (cleanOrderId(order.id) !== id) return fail(400, 'input', 'Los códigos del pedido no coinciden.');
      const contact = contactKey(order.customer.phone);
      const clientId = await clientKey(request, env.ORDER_LIMIT_SECRET || env.SUPABASE_SERVICE_ROLE_KEY);
      const limitError = await orderLimitError(adminClient, { contact, clientId, isTableOrder: ['Mesa', 'Mesa_Llevar'].includes(order.customer.orderType) });
      if (limitError) return fail(429, 'limit', limitError);
      const limitFields = { createdAt: new Date().toISOString(), contactKey: contact, clientKey: clientId };
      const { data: legacy, error: legacyError } = await adminClient.from('helados_sync').select('value').eq('key', 'orders').maybeSingle();
      if (legacyError) return fail(502, 'read', 'No se pudo validar el historial.');
      if (Array.isArray(legacy?.value) && legacy.value.some(item => cleanOrderId(item?.id) === id)) return fail(409, 'conflict', 'Este código ya pertenece a un pedido registrado.');
      nextOrder = {
        id,
        revision: 1,
        customer: { ...order.customer, paymentTiming: orderPaymentTiming({ ...order, paymentVerified: false }) },
        items: order.items,
        total: money(order.items.reduce((sum, item) => sum + money(item.price) * Number(item.quantity), 0)),
        deliveryFee: Number(order.deliveryFee) || 0,
        discount: Number(order.discount) || 0,
        couponCode: trimText(order.couponCode, 80) || null,
        grandTotal: Number(order.grandTotal),
        submissionKey: trimText(order.submissionKey, 100) || null,
        paymentVerified: false,
        tablePaid: false,
        assignedDriver: null,
        status: 'Por Corroborar',
        statusHistory: [
          { status: 'Por Corroborar', timestamp: new Date().toISOString() },
        ],
        date: safeDate(order.date),
        ...limitFields,
      };
    }

    nextOrder.updatedAt = new Date().toISOString();
    nextOrder.revision = (Number(existingRow?.value?.revision) || 0) + 1;
    const record = { key: `order_${id}`, value: nextOrder, updated_at: nextOrder.updatedAt };
    if (!existingRow && nextOrder.couponCode) {
      const { data: savedCouponOrder, error: couponError } = await adminClient.rpc('insert_customer_order', {
        p_order: nextOrder,
        p_coupon_code: nextOrder.couponCode,
      });
      if (couponError?.code === '23505') {
        const { data: concurrent } = await adminClient.from('helados_sync').select('value').eq('key', record.key).maybeSingle();
        if (order?.submissionKey && concurrent?.value?.submissionKey === order.submissionKey) return json({ ok: true, order: concurrent.value });
        return fail(409, 'conflict', 'Este código ya pertenece a otro pedido.');
      }
      if (couponError?.code === '22023') return fail(409, 'coupon', 'El cupón ya no está disponible. Actualiza el carrito.');
      if (couponError || !savedCouponOrder?.id) return fail(502, 'write', 'No se pudo guardar el pedido con cupón. Inténtalo nuevamente.');
      return json({ ok: true, order: savedCouponOrder });
    }
    let write;
    if (existingRow) {
      write = adminClient.from('helados_sync').update(record).eq('key', record.key).eq('value', JSON.stringify(existingRow.value));
    } else {
      write = adminClient.from('helados_sync').insert(record);
    }
    const { data: saved, error: writeError } = await write.select('value').maybeSingle();

    if (writeError?.code === '23505') {
      const { data: concurrent } = await adminClient.from('helados_sync').select('value').eq('key', record.key).maybeSingle();
      if (order?.submissionKey && concurrent?.value?.submissionKey === order.submissionKey) return json({ ok: true, order: concurrent.value });
      return fail(409, 'conflict', 'Este código ya pertenece a otro pedido.');
    }
    if (writeError) return fail(502, 'write', 'No se pudo guardar el pedido. Inténtalo nuevamente.');
    if (!saved?.value) return fail(409, 'conflict', 'El pedido cambió mientras guardabas. Inténtalo nuevamente.');
    return json({ ok: true, order: saved.value });
  } catch (err) {
    return json({ error: err.message || 'Error inesperado.' }, 500);
  }
}
