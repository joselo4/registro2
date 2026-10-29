import { orderStatusTimestamp, orderStatusLabel } from './orderLifecycle.js';

// Minutes an order may stay in each open status before the panel calls it late.
export const STATUS_LIMIT_MINUTES = {
  'Por Corroborar': 5,
  Pendiente: 10,
  Preparando: 20,
  Listo: 15,
  'En camino': 45,
};

const minutesSince = (timestamp, now) => {
  const time = Date.parse(timestamp || '');
  return Number.isFinite(time) ? Math.max(0, Math.floor((now - time) / 60000)) : 0;
};

/**
 * Orders that need someone's attention now: those waiting for validation and
 * those that have spent longer than their limit in the current status.
 */
// Shop-configured limits override the defaults; anything missing or out of range falls back.
export function attentionLimits(custom) {
  const limits = { ...STATUS_LIMIT_MINUTES };
  for (const status of Object.keys(limits)) {
    const value = Math.round(Number(custom?.[status]));
    if (Number.isFinite(value) && value >= 1 && value <= 240) limits[status] = value;
  }
  return limits;
}

export function orderAttention(orders, now = Date.now(), customLimits = null) {
  const limits = attentionLimits(customLimits);
  const open = (Array.isArray(orders) ? orders : []).filter(order => order && limits[order.status] !== undefined);
  const timed = open.map(order => {
    const minutes = minutesSince(orderStatusTimestamp(order, order.status) || order.date, now);
    const limit = limits[order.status];
    return { order, status: order.status, label: orderStatusLabel(order.status), minutes, limit, late: minutes >= limit };
  });
  const toValidate = timed.filter(entry => entry.status === 'Por Corroborar').sort((a, b) => b.minutes - a.minutes);
  // Orders waiting for validation already have their own line with their wait time.
  const overdue = timed.filter(entry => entry.late && entry.status !== 'Por Corroborar').sort((a, b) => (b.minutes - b.limit) - (a.minutes - a.limit));
  return {
    toValidate,
    overdue,
    oldestToValidateMinutes: toValidate[0]?.minutes ?? 0,
    count: new Set([...toValidate, ...overdue].map(entry => entry.order.id)).size,
  };
}

// "hace 1 min", "hace 12 min", "hace 1 h 5 min"
export const formatWait = (minutes) => {
  const value = Math.max(0, Math.floor(Number(minutes) || 0));
  if (value < 1) return 'hace un momento';
  if (value < 60) return `hace ${value} min`;
  const hours = Math.floor(value / 60);
  const rest = value % 60;
  return `hace ${hours} h${rest ? ` ${rest} min` : ''}`;
};
