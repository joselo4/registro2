import { createAdminClient, fail, json, sameOriginRequest } from './_security.js';
import { addCounts, cleanFunnelEvents, funnelKey, limaDay } from './_funnel.js';

// Receives batched, anonymous funnel counts from the storefront.
export async function onRequestPost({ request, env }, makeClient = createAdminClient) {
  try {
    if (!sameOriginRequest(request)) return fail(403, 'origin', 'Origen no permitido.');
    const text = await request.text();
    if (text.length > 1000) return fail(413, 'input', 'Solicitud demasiado grande.');
    let body;
    try { body = JSON.parse(text || '{}'); } catch { return fail(400, 'input', 'Solicitud inválida.'); }
    const events = cleanFunnelEvents(body?.events);
    if (!Object.keys(events).length) return json({ ok: true, recorded: 0 });

    const client = await makeClient(env);
    const key = funnelKey(limaDay());
    // Compare-and-swap on updated_at; a few retries absorb concurrent visitors.
    for (let attempt = 0; attempt < 5; attempt++) {
      const { data: row, error: readError } = await client.from('helados_sync').select('value,updated_at').eq('key', key).maybeSingle();
      if (readError) return fail(502, 'read', 'No se pudo registrar la visita.');
      const now = new Date().toISOString();
      const value = addCounts(row?.value, events);
      let query;
      if (row) {
        query = client.from('helados_sync').update({ value, updated_at: now }).eq('key', key);
        query = row.updated_at == null ? query.is('updated_at', null) : query.eq('updated_at', row.updated_at);
      } else {
        query = client.from('helados_sync').insert({ key, value, updated_at: now });
      }
      const { data: saved, error } = await query.select('key').maybeSingle();
      if (!error && saved) return json({ ok: true, recorded: Object.values(events).reduce((sum, count) => sum + count, 0) });
      if (error && error.code !== '23505') return fail(502, 'write', 'No se pudo registrar la visita.');
    }
    return fail(409, 'busy', 'Demasiadas visitas simultáneas; se descartó este lote.');
  } catch {
    return fail(500, 'server', 'No se pudo registrar la visita.');
  }
}
