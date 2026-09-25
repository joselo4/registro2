import { createAdminClient, fail, json, sameOriginRequest } from './_security.js';
import { isOrderTypeEnabled } from '../../src/utils/orderChannels.js';

// Same table format the order API accepts (1-999).
const cleanTable = (value) => {
  const table = String(value ?? '').trim();
  return /^[1-9]\d{0,2}$/.test(table) ? table : '';
};
const trimText = (value, max = 500) => String(value || '').trim().slice(0, max);
const safeDate = (value) => {
  const date = new Date(value || '');
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
};

export async function onRequestPost({ request, env }, makeClient = createAdminClient) {
  try {
    if (!sameOriginRequest(request)) return fail(403, 'origin', 'Origen no permitido.');

    let body;
    try {
      body = await request.json();
    } catch {
      return fail(400, 'input', 'Solicitud inválida.');
    }
    if (JSON.stringify(body || {}).length > 5000) return fail(400, 'input', 'Solicitud demasiado grande.');

    const table = cleanTable(body?.table);
    const requestText = trimText(body?.request);
    const resolved = body?.resolved === true;

    if (!table) return fail(400, 'input', 'Número de mesa inválido.');
    if (!resolved && !requestText) return fail(400, 'input', 'Falta la solicitud.');

    const adminClient = await makeClient(env);
    if (!resolved) {
      const { data: config, error: configError } = await adminClient.from('helados_sync').select('value').eq('key', 'shop_open').maybeSingle();
      if (configError) return fail(502, 'read', 'No se pudo enviar el llamado. Intenta nuevamente.');
      if (!isOrderTypeEnabled(config?.value, 'Mesa')) return fail(400, 'channel', 'La atención en mesa no está disponible en este momento.');
    }

    const callData = {
      table,
      request: requestText,
      // New calls use the server clock; the Telegram notice only accepts fresh calls.
      timestamp: resolved ? safeDate(body?.timestamp) : new Date().toISOString(),
      resolved,
    };

    const { error } = await adminClient
      .from('helados_sync')
      .upsert(
        {
          key: `order_call_Mesa_${table}`,
          value: callData,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'key' }
      );

    if (error) return fail(502, 'write', 'No se pudo guardar el llamado. Intenta nuevamente.');
    return json({ ok: true, call: callData });
  } catch (err) {
    console.error('table-call failed:', err);
    return fail(500, 'server', 'No se pudo enviar el llamado. Intenta nuevamente.');
  }
}
