import { createAdminClient, fail, json, sameOriginRequest } from './_security.js';
import { saveOrderChange, fetchAllSyncRows } from '../../src/utils/orderRepository.js';
import { mergeOrders } from '../../src/utils/orderLifecycle.js';
import { orderStaffRole, driverOwnsOrder, allowedOrderChange } from './_orderAccess.js';
import { getEnabledPaymentMethods } from '../../src/utils/paymentMethods.js';

async function validatePaymentAvailability(client, previous, next) {
  if (previous && previous.customer?.paymentMethod === next.customer?.paymentMethod) return null;
  const { data, error } = await client.from('helados_sync').select('value').eq('key', 'shop_open').maybeSingle();
  if (error) throw new Error('No se pudo consultar los métodos de pago. Intenta nuevamente.');
  return getEnabledPaymentMethods(data?.value).includes(next.customer?.paymentMethod) ? null : 'Este método de pago ya no está disponible. Selecciona otro método activo.';
}

const ORDER_ID_RE = /^PED-[A-Z0-9-]{4,40}$/;

const cleanOrderId = (value) => String(value || '').trim().toUpperCase();

const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const trimText = (value, max = 160) => String(value || '').trim().slice(0, max);

const staffSession = async (request, client) => {
  const token = request.headers.get('Authorization')?.replace(/^Bearer /, '');
  if (!token) return null;
  const { data, error } = await client.auth.getUser(token);
  return !error && orderStaffRole(data?.user) ? data.user : null;
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
  if (!trimText(item.name || item.type || item.id, 160)) return false;
  return true;
};

const validateOrderForCreate = (order) => {
  if (!isPlainObject(order)) return 'Pedido invalido.';
  if (JSON.stringify(order).length > 50000) return 'El pedido es demasiado grande.';
  const id = cleanOrderId(order.id);
  if (!ORDER_ID_RE.test(id)) return 'Codigo de pedido invalido.';
  if (!Array.isArray(order.items) || order.items.length === 0 || order.items.length > 40) {
    return 'El pedido debe incluir productos validos.';
  }
  if (!order.items.every(isValidOrderItem)) return 'El pedido contiene productos invalidos.';
  if (!isPlainObject(order.customer)) return 'Datos del cliente invalidos.';
  if (order.customer.paymentTiming !== undefined && !['Al llegar', 'Anticipado'].includes(order.customer.paymentTiming)) return 'Modalidad de pago inválida.';
  if (!trimText(order.customer.name, 80)) return 'Falta el nombre del cliente.';
  if (!trimText(order.customer.phone, 40)) return 'Falta el telefono del cliente.';
  if (!Number.isFinite(Number(order.grandTotal)) || Number(order.grandTotal) < 0) {
    return 'Total del pedido invalido.';
  }
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

    const adminClient = await makeClient(env);
    const { data, error } = await adminClient
      .from('helados_sync')
      .select('value')
      .eq('key', `order_${id}`)
      .maybeSingle();

    if (error) return fail(502, 'read', error.message || 'No se pudo leer el pedido.');
    if (!data?.value) {
      // Compatibility for confirmed orders saved by older operator versions.
      const { data: legacy, error: legacyError } = await adminClient.from('helados_sync').select('value').eq('key', 'orders').maybeSingle();
      if (legacyError) return fail(502, 'read', 'No se pudo consultar el historial de pedidos.');
      const order = Array.isArray(legacy?.value) && legacy.value.find(item => cleanOrderId(item?.id) === id);
      if (order) return json({ ok: true, order });
      return fail(404, 'not_found', 'Pedido no encontrado.');
    }

    return json({ ok: true, order: data.value });
  } catch (err) {
    return json({ error: err.message || 'Error inesperado.' }, 500);
  }
}

export async function onRequestPost({ request, env }, makeClient = createAdminClient) {
  try {
    if (!sameOriginRequest(request)) return fail(403, 'origin', 'Origen no permitido.');

    const body = await request.json();
    if (body?.action === 'update') {
      const client = await makeClient(env);
      const user = await staffSession(request, client);
      if (!user) return fail(403, 'auth', 'Inicia sesión con una cuenta de operador.');
      if (!isPlainObject(body.order) || !/^(PED|FIS|ORD)-[A-Z0-9-]{3,40}$/.test(body.order.id) || JSON.stringify(body).length > 150000) return fail(400, 'input', 'Pedido inválido.');
      if (!allowedOrderChange(user, body.previous, body.order)) return fail(403, 'auth', 'Tu rol no permite este cambio de pedido.');
      try {
        const paymentError = await validatePaymentAvailability(client, body.previous, body.order);
        if (paymentError) return fail(400, 'payment', paymentError);
        const order = await saveOrderChange(client, body.previous, body.order);
        return json({ ok: true, order });
      } catch (error) { return fail(409, 'update', error.message || 'No se pudo guardar el pedido.'); }
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

    if (readError) return fail(502, 'read', readError.message || 'No se pudo validar el pedido.');

    let nextOrder = null;
    if (existingRow?.value) {
      if (!order?.survey && order?.submissionKey && order.submissionKey === existingRow.value.submissionKey) {
        return json({ ok: true, order: existingRow.value });
      }
      const survey = sanitizeSurvey(order?.survey);
      if (!survey) return fail(409, 'conflict', 'Este código ya pertenece a un pedido registrado.');
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
      if (cleanOrderId(order.id) !== id) return fail(400, 'input', 'Los códigos del pedido no coinciden.');
      const { data: legacy, error: legacyError } = await adminClient.from('helados_sync').select('value').eq('key', 'orders').maybeSingle();
      if (legacyError) return fail(502, 'read', 'No se pudo validar el historial.');
      if (Array.isArray(legacy?.value) && legacy.value.some(item => cleanOrderId(item?.id) === id)) return fail(409, 'conflict', 'Este código ya pertenece a un pedido registrado.');
      nextOrder = {
        id,
        revision: 1,
        customer: order.customer,
        items: order.items,
        total: Number(order.total) || 0,
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
      };
    }

    nextOrder.updatedAt = new Date().toISOString();
    nextOrder.revision = (Number(existingRow?.value?.revision) || 0) + 1;
    const record = { key: `order_${id}`, value: nextOrder, updated_at: nextOrder.updatedAt };
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
