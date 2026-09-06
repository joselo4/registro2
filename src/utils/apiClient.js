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

export const createOrder = order => requestOrder('/api/order', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: order.id, order }) });
export const readOrder = id => requestOrder(`/api/order?id=${encodeURIComponent(id)}`);

export async function updateOrder(client, previous, order) {
  const { data } = await client.auth.getSession();
  if (!data?.session?.access_token) throw new Error('Tu sesión venció. Inicia sesión nuevamente.');
  return requestOrder('/api/order', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session.access_token}` }, body: JSON.stringify({ action: 'update', previous, order }) });
}

export async function fetchOperatorOrders(session) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(apiUrl('/api/order?scope=operations'), { headers: { Authorization: `Bearer ${session.access_token}` }, signal: controller.signal, cache: 'no-store' });
    const payload = await response.json();
    if (!response.ok || !payload.ok || !Array.isArray(payload.orders)) throw new Error(payload.error || 'No se pudieron cargar los pedidos.');
    return payload.orders;
  } finally { clearTimeout(timer); }
}
