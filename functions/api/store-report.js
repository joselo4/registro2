import { fail, getAuthenticatedUser, isTrustedAdmin, json, sameOriginRequest, createAdminClient } from './_security.js';
import { FUNNEL_EVENTS, limaDay } from './_funnel.js';

const DAY_MS = 24 * 60 * 60 * 1000;

// Builds the conversion report from the store's own data: anonymous funnel
// counters plus real orders (purchases and revenue come from orders, not from
// browser events).
export function buildStoreReport({ funnelRows = [], orders = [], days = 30, now = new Date() }) {
  const dates = Array.from({ length: days }, (_, index) => limaDay(new Date(now.getTime() - (days - 1 - index) * DAY_MS)));
  const byDay = new Map(dates.map(date => [date, { date, ...Object.fromEntries(FUNNEL_EVENTS.map(name => [name, 0])), purchase: 0, revenue: 0 }]));
  for (const row of funnelRows) {
    const day = byDay.get(String(row.key || '').replace(/^funnel_/, ''));
    if (!day || !row.value || typeof row.value !== 'object') continue;
    for (const name of FUNNEL_EVENTS) day[name] += Math.max(0, Number(row.value[name]) || 0);
  }
  const channels = {};
  const products = new Map();
  for (const order of orders) {
    if (!order || order.status === 'Cancelado' || order.isOperator) continue;
    const date = new Date(order.date || order.createdAt || '');
    if (Number.isNaN(date.getTime())) continue;
    const day = byDay.get(limaDay(date));
    if (!day) continue;
    day.purchase += 1;
    day.revenue += Number(order.grandTotal) || 0;
    const channel = order.customer?.orderType || 'Delivery';
    channels[channel] = (channels[channel] || 0) + 1;
    for (const item of Array.isArray(order.items) ? order.items : []) {
      const name = String(item?.name || 'Producto').slice(0, 80);
      const entry = products.get(name) || { name, units: 0, revenue: 0 };
      entry.units += Number(item.quantity) || 0;
      entry.revenue += (Number(item.price) || 0) * (Number(item.quantity) || 0);
      products.set(name, entry);
    }
  }
  const series = [...byDay.values()].map(day => ({ ...day, revenue: Math.round(day.revenue * 100) / 100 }));
  const totals = series.reduce((sum, day) => {
    for (const key of [...FUNNEL_EVENTS, 'purchase', 'revenue']) sum[key] = (sum[key] || 0) + day[key];
    return sum;
  }, {});
  totals.revenue = Math.round((totals.revenue || 0) * 100) / 100;
  return {
    source: 'store',
    days,
    totals,
    averageTicket: totals.purchase ? Math.round(totals.revenue / totals.purchase * 100) / 100 : 0,
    channels,
    topProducts: [...products.values()].sort((a, b) => b.units - a.units).slice(0, 5).map(product => ({ ...product, revenue: Math.round(product.revenue * 100) / 100 })),
    series,
  };
}

export async function onRequestGet({ request, env }, dependencies = {}) {
  try {
    if (!sameOriginRequest(request)) return fail(403, 'origin', 'Origen no permitido.');
    const auth = await (dependencies.authenticate || getAuthenticatedUser)(request, env);
    if (!auth.user) return fail(401, 'auth', 'Inicia sesión para ver el informe.');
    if (!isTrustedAdmin(auth.user)) return fail(403, 'authz', 'Solo un administrador puede ver el informe de ventas.');
    const requested = Number(new URL(request.url).searchParams.get('days'));
    const days = [7, 30, 90].includes(requested) ? requested : 30;
    const client = auth.adminClient || await (dependencies.makeClient || createAdminClient)(env);
    const since = new Date(Date.now() - days * DAY_MS).toISOString();
    const [funnel, orders] = await Promise.all([
      client.from('helados_sync').select('key,value').like('key', 'funnel_%').gte('key', `funnel_${limaDay(new Date(Date.now() - days * DAY_MS))}`),
      client.from('helados_sync').select('value').like('key', 'order_PED-%').gte('value->>date', since),
    ]);
    if (funnel.error || orders.error) return fail(502, 'read', 'No se pudo leer el informe. Intenta nuevamente.');
    return json({ ok: true, ...buildStoreReport({ funnelRows: funnel.data || [], orders: (orders.data || []).map(row => row.value), days }) });
  } catch {
    return fail(500, 'server', 'No se pudo preparar el informe.');
  }
}
