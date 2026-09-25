// Limits for public (customer) orders, counted on the server so they cannot
// be bypassed from the browser.
export const MAX_ORDERS_PER_CONTACT = 10;
export const CONTACT_WINDOW_MS = 24 * 60 * 60 * 1000;
// Anti-abuse cap per connection. Table orders are exempt: everyone in the
// shop shares the same Wi-Fi.
export const MAX_ORDERS_PER_CLIENT = 30;
export const CLIENT_WINDOW_MS = 60 * 60 * 1000;

// Last 9 digits identify a Peruvian mobile regardless of +51 or spaces.
export const contactKey = (phone) => {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits.length >= 9 ? digits.slice(-9) : null;
};

// The raw IP is never stored: only a keyed hash that cannot be reversed.
export async function clientKey(request, secret) {
  const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Real-IP') || '';
  if (!ip || !secret || !globalThis.crypto?.subtle) return null;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(String(secret)), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(`order-client:${ip}`)));
  return [...signature.slice(0, 12)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

async function countSince(client, field, value, since) {
  const { count, error } = await client
    .from('helados_sync')
    .select('key', { count: 'exact', head: true })
    .like('key', 'order_PED-%')
    .eq(`value->>${field}`, value)
    .gte('value->>createdAt', since);
  if (error) throw new Error('No se pudo verificar tus pedidos recientes. Intenta nuevamente.');
  return Number(count) || 0;
}

export async function orderLimitError(client, { contact, clientId, isTableOrder }, now = Date.now()) {
  if (contact && await countSince(client, 'contactKey', contact, new Date(now - CONTACT_WINDOW_MS).toISOString()) >= MAX_ORDERS_PER_CONTACT) {
    return `Alcanzaste el máximo de ${MAX_ORDERS_PER_CONTACT} pedidos en 24 horas con este número. Si necesitas algo más, escríbenos por WhatsApp.`;
  }
  if (clientId && !isTableOrder && await countSince(client, 'clientKey', clientId, new Date(now - CLIENT_WINDOW_MS).toISOString()) >= MAX_ORDERS_PER_CLIENT) {
    return 'Recibimos demasiados pedidos desde esta conexión. Espera unos minutos o escríbenos por WhatsApp.';
  }
  return null;
}
