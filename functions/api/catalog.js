import { createAdminClient, fail, sameOriginRequest } from './_security.js';
import { PUBLIC_STORE_KEYS } from '../../src/utils/publicCatalogCache.js';

// Public storefront data served from Cloudflare's cache: with a thousand visitors
// at once the database sees about one read per edge location every few seconds,
// instead of one per visitor.
const EDGE_SECONDS = 20;
const MEMORY_MS = 10000;
const memory = { body: null, at: 0, pending: null };

const respond = (body) => new Response(body, {
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': `public, max-age=10, s-maxage=${EDGE_SECONDS}`,
  },
});

async function loadCatalog(env, makeClient) {
  const client = await makeClient(env);
  const { data, error } = await client.from('helados_sync').select('key,value').in('key', PUBLIC_STORE_KEYS);
  if (error) throw new Error('catalog read failed');
  const values = Object.fromEntries((data || []).map(row => [row.key, row.value]));
  return JSON.stringify({ ok: true, at: new Date().toISOString(), data: values });
}

export async function onRequestGet(context, makeClient = createAdminClient, now = Date.now) {
  const { request, env } = context;
  try {
    if (!sameOriginRequest(request)) return fail(403, 'origin', 'Origen no permitido.');
    if (memory.body && now() - memory.at < MEMORY_MS) return respond(memory.body);

    const cache = globalThis.caches?.default;
    const cacheKey = new Request(new URL('/api/catalog', request.url).toString(), { method: 'GET' });
    if (cache) {
      const hit = await cache.match(cacheKey);
      if (hit) return hit;
    }

    // Requests that miss at the same moment share one database read.
    if (!memory.pending) {
      memory.pending = loadCatalog(env, makeClient)
        .then(body => { memory.body = body; memory.at = now(); return body; })
        .finally(() => { memory.pending = null; });
    }
    const body = await memory.pending;
    const response = respond(body);
    if (cache) {
      const store = cache.put(cacheKey, response.clone()).catch(() => {});
      if (typeof context.waitUntil === 'function') context.waitUntil(store);
    }
    return response;
  } catch (err) {
    console.error('catalog failed:', err);
    return fail(503, 'catalog', 'El catálogo no está disponible en este momento.');
  }
}

// For tests: forget the in-memory copy.
export const resetCatalogMemory = () => { memory.body = null; memory.at = 0; memory.pending = null; };
