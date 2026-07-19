import { createAdminClient, fail, json, sameOriginRequest } from './_security.js';

const ORDER_ID_RE = /^PED-[A-Z0-9-]{6,40}$/;

const cleanOrderId = (value) => String(value || '').trim().toUpperCase();

const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const trimText = (value, max = 160) => String(value || '').trim().slice(0, max);

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

export async function onRequestGet({ request, env }) {
  try {
    if (!sameOriginRequest(request)) return fail(403, 'origin', 'Origen no permitido.');

    const url = new URL(request.url);
    const id = cleanOrderId(url.searchParams.get('id'));
    if (!ORDER_ID_RE.test(id)) return fail(400, 'input', 'Codigo de pedido invalido.');

    const adminClient = await createAdminClient(env);
    const { data, error } = await adminClient
      .from('helados_sync')
      .select('value')
      .eq('key', `order_${id}`)
      .maybeSingle();

    if (error) return fail(502, 'read', error.message || 'No se pudo leer el pedido.');
    if (!data?.value) return fail(404, 'not_found', 'Pedido no encontrado.');

    return json({ ok: true, order: data.value });
  } catch (err) {
    return json({ error: err.message || 'Error inesperado.' }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    if (!sameOriginRequest(request)) return fail(403, 'origin', 'Origen no permitido.');

    const body = await request.json();
    const order = body?.order || body?.value;
    const id = cleanOrderId(body?.id || order?.id);
    if (!ORDER_ID_RE.test(id)) return fail(400, 'input', 'Codigo de pedido invalido.');

    const adminClient = await createAdminClient(env);
    const { data: existingRow, error: readError } = await adminClient
      .from('helados_sync')
      .select('value')
      .eq('key', `order_${id}`)
      .maybeSingle();

    if (readError) return fail(502, 'read', readError.message || 'No se pudo validar el pedido.');

    let nextOrder = null;
    if (existingRow?.value) {
      const survey = sanitizeSurvey(order?.survey);
      if (!survey) return fail(400, 'input', 'Solo se permite registrar una encuesta valida sobre pedidos existentes.');
      nextOrder = {
        ...existingRow.value,
        survey,
      };
    } else {
      const validationError = validateOrderForCreate(order);
      if (validationError) return fail(400, 'input', validationError);
      nextOrder = {
        ...order,
        id,
        status: 'Por Corroborar',
        statusHistory: [
          { status: 'Por Corroborar', timestamp: new Date().toISOString() },
        ],
        date: safeDate(order.date),
      };
    }

    const { error: writeError } = await adminClient
      .from('helados_sync')
      .upsert(
        {
          key: `order_${id}`,
          value: nextOrder,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'key' }
      );

    if (writeError) return fail(502, 'write', writeError.message || 'No se pudo guardar el pedido.');
    return json({ ok: true, order: nextOrder });
  } catch (err) {
    return json({ error: err.message || 'Error inesperado.' }, 500);
  }
}
