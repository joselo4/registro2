import { createAdminClient, fail, json, sameOriginRequest } from './_security.js';
import { addCounts, cleanFunnelEvents, FUNNEL_SHARDS, funnelKey, funnelOverflowKey, limaDay } from './_funnel.js';

const MAX_ATTEMPTS = 6;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

// Receives batched, anonymous funnel counts from the storefront.
export async function onRequestPost({ request, env }, makeClient = createAdminClient, { random = Math.random } = {}) {
  try {
    if (!sameOriginRequest(request)) return fail(403, 'origin', 'Origen no permitido.');
    const text = await request.text();
    if (text.length > 1000) return fail(413, 'input', 'Solicitud demasiado grande.');
    let body;
    try { body = JSON.parse(text || '{}'); } catch { return fail(400, 'input', 'Solicitud inválida.'); }
    const events = cleanFunnelEvents(body?.events);
    if (!Object.keys(events).length) return json({ ok: true, recorded: 0 });

    const client = await makeClient(env);
    const day = limaDay();
    // Compare-and-swap on updated_at. Each attempt picks a random shard, so a
    // conflict with another visitor moves on to a (probably) quiet row.
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const key = funnelKey(day, Math.floor(random() * FUNNEL_SHARDS));
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
      await pause(5 + Math.floor(random() * 20 * (attempt + 1)));
    }
    // Still contended after every retry: keep the batch in a row of its own, which
    // cannot conflict, so a burst of visitors never loses counts.
    const id = Array.from({ length: 12 }, () => Math.floor(random() * 36).toString(36)).join('');
    const { error: overflowError } = await client.from('helados_sync')
      .insert({ key: funnelOverflowKey(day, id), value: events, updated_at: new Date().toISOString() })
      .select('key').maybeSingle();
    if (overflowError) return fail(502, 'write', 'No se pudo registrar la visita.');
    return json({ ok: true, recorded: Object.values(events).reduce((sum, count) => sum + count, 0) });
  } catch {
    return fail(500, 'server', 'No se pudo registrar la visita.');
  }
}
