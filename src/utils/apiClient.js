import { Capacitor } from '@capacitor/core';

export function apiUrl(path) {
  const base = Capacitor.isNativePlatform() ? (import.meta.env.VITE_API_BASE_URL || 'https://www.pideanda.com') : '';
  return `${base.replace(/\/$/, '')}${path}`;
}

export function trackingUrl(id) {
  const base = Capacitor.isNativePlatform() ? (import.meta.env.VITE_API_BASE_URL || 'https://www.pideanda.com') : window.location.origin;
  return `${base}/?track=${encodeURIComponent(id)}`;
}

export async function requestOrder(path, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(apiUrl(path), { ...options, signal: controller.signal, cache: 'no-store' });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.ok || !payload.order?.id) {
      const error = new Error(payload?.error || 'No se pudo confirmar el pedido con la tienda. Comprueba tu conexión e inténtalo de nuevo.');
      error.status = response.status;
      throw error;
    }
    return payload.order;
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('La tienda tardó en responder. Conservamos tu pedido para reintentar sin duplicarlo.', { cause: error });
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function createOrder(order) {
  const saved = await requestOrder('/api/order', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: order.id, order }) });
  if (saved.id !== order.id || (order.submissionKey && saved.submissionKey !== order.submissionKey)) {
    throw new Error('La respuesta no corresponde a tu pedido. Conservamos tu carrito para reintentar.');
  }
  return saved;
}
// Cancels an unconfirmed order with its private receipt so it can be fixed and resent.
export const correctOrder = (id, submissionKey) => requestOrder('/api/order', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'customer_correct', id, submissionKey }) });
export const readOrder = (id, token = '') => requestOrder(`/api/order?id=${encodeURIComponent(id)}${token ? `&token=${encodeURIComponent(token)}` : ''}`);

// A stuck auth client must surface as an error, never as a button that does nothing.
export async function currentSession(client, timeoutMs = 8000) {
  const result = await Promise.race([
    client.auth.getSession(),
    new Promise((_, reject) => setTimeout(() => reject(new Error('La sesión no respondió. Recarga la página e inténtalo de nuevo.')), timeoutMs)),
  ]);
  return result?.data?.session || null;
}

export async function updateOrder(client, previous, order) {
  const session = await currentSession(client);
  if (!session?.access_token) throw new Error('Tu sesión venció. Inicia sesión nuevamente.');
  return requestOrder('/api/order', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ action: 'update', previous, order }) });
}

export async function createOperatorOrder(client, order) {
  const session = await currentSession(client);
  if (!session?.access_token) throw new Error('Tu sesión venció. Inicia sesión nuevamente.');
  return requestOrder('/api/order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ action: 'create_operator', order }),
  });
}

export async function fetchOperatorOrders(session) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(apiUrl('/api/order?scope=operations'), { headers: { Authorization: `Bearer ${session.access_token}` }, signal: controller.signal, cache: 'no-store' });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.ok || !Array.isArray(payload.orders)) throw new Error(payload?.error || `El servidor de pedidos no respondió correctamente (código ${response.status}).`);
    return payload.orders;
  } finally { clearTimeout(timer); }
}
