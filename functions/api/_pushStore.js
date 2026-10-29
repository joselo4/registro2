import { sendWebPush } from './_webpush.js';

// Staff phones that accepted alerts. Stored server-side only; customers never read it.
export const PUSH_KEY = 'push_subscriptions';
export const MAX_SUBSCRIPTIONS = 60;

const B64URL_RE = /^[A-Za-z0-9_-]+$/;

export const cleanSubscription = (value) => {
  const endpoint = String(value?.endpoint || '');
  const p256dh = String(value?.keys?.p256dh || '');
  const auth = String(value?.keys?.auth || '');
  if (!/^https:\/\/[^\s]+$/.test(endpoint) || endpoint.length > 1000) return null;
  if (!B64URL_RE.test(p256dh) || p256dh.length < 80 || p256dh.length > 100) return null;
  if (!B64URL_RE.test(auth) || auth.length < 16 || auth.length > 32) return null;
  return { endpoint, keys: { p256dh, auth } };
};

export async function readSubscriptions(client) {
  const { data, error } = await client.from('helados_sync').select('value,updated_at').eq('key', PUSH_KEY).maybeSingle();
  if (error) throw new Error('No se pudieron leer los dispositivos con avisos.');
  return { list: Array.isArray(data?.value) ? data.value : [], row: data };
}

// Read-modify-write with a compare-and-swap on updated_at, retried on conflict.
export async function updateSubscriptions(client, change) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const { list, row } = await readSubscriptions(client);
    const next = change(list).slice(-MAX_SUBSCRIPTIONS);
    const now = new Date().toISOString();
    let query;
    if (row) {
      query = client.from('helados_sync').update({ value: next, updated_at: now }).eq('key', PUSH_KEY);
      query = row.updated_at == null ? query.is('updated_at', null) : query.eq('updated_at', row.updated_at);
    } else {
      query = client.from('helados_sync').insert({ key: PUSH_KEY, value: next, updated_at: now });
    }
    const { data: saved, error } = await query.select('key').maybeSingle();
    if (!error && saved) return next;
    if (error && error.code !== '23505') throw new Error('No se pudo guardar el dispositivo.');
  }
  throw new Error('Demasiados cambios simultáneos; intenta otra vez.');
}

/**
 * Sends a notification to every subscribed staff phone (optionally filtered) and
 * drops subscriptions the push service reports as gone. Never throws.
 */
export async function notifyStaff(client, env, payload, { filter = () => true, fetchImpl } = {}) {
  try {
    if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return { sent: 0 };
    const { list } = await readSubscriptions(client);
    const targets = list.filter(filter);
    const results = await Promise.all(targets.map(subscription =>
      sendWebPush({ subscription, payload, env, fetchImpl }).catch(() => ({ ok: false, gone: false }))
    ));
    const gone = new Set(targets.filter((_, index) => results[index].gone).map(sub => sub.endpoint));
    if (gone.size) await updateSubscriptions(client, current => current.filter(sub => !gone.has(sub.endpoint))).catch(() => {});
    return { sent: results.filter(result => result.ok).length, removed: gone.size };
  } catch (error) {
    console.error('staff push failed:', error);
    return { sent: 0 };
  }
}
