import { createAdminClient, fail, json, sameOriginRequest } from './_security.js';

const cleanTable = (value) => String(value || '').trim().replace(/[^\dA-Za-z_-]/g, '').slice(0, 20);
const trimText = (value, max = 500) => String(value || '').trim().slice(0, max);

export async function onRequestPost({ request, env }) {
  try {
    if (!sameOriginRequest(request)) return fail(403, 'origin', 'Origen no permitido.');

    const body = await request.json();
    const table = cleanTable(body?.table);
    const requestText = trimText(body?.request);
    const resolved = body?.resolved === true;

    if (!table) return fail(400, 'input', 'Falta el numero de mesa.');
    if (!resolved && !requestText) return fail(400, 'input', 'Falta la solicitud.');

    const callData = {
      table,
      request: requestText,
      timestamp: body?.timestamp || new Date().toISOString(),
      resolved,
    };

    const adminClient = await createAdminClient(env);
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

    if (error) return fail(502, 'write', error.message || 'No se pudo guardar el llamado.');
    return json({ ok: true, call: callData });
  } catch (err) {
    return json({ error: err.message || 'Error inesperado.' }, 500);
  }
}
