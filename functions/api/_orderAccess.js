import { normalizeEmail, isTrustedAdmin } from './_security.js';

export function orderStaffRole(user) {
  if (isTrustedAdmin(user)) return 'admin';
  const role = String(user?.app_metadata?.role || '').toLowerCase();
  return ['vendedor', 'cocina', 'repartidor', 'cajero', 'mozo'].find(r => role.includes(r)) || '';
}

export function driverOwnsOrder(user, order) {
  return Boolean(order?.assignedDriver && (
    (user.id && String(order.assignedDriver.id) === String(user.id)) ||
    (user.email && normalizeEmail(order.assignedDriver.email) === normalizeEmail(user.email))
  ));
}

export function allowedOrderChange(user, previous, next) {
  const role = orderStaffRole(user);
  if (['admin', 'vendedor', 'cajero', 'mozo'].includes(role)) return true;
  if (!previous) return false;
  if (role === 'repartidor' && !driverOwnsOrder(user, previous)) return false;
  if (role === 'cocina' && !['Preparando', 'Listo'].includes(next.status)) return false;
  if (role === 'repartidor' && !['En camino', 'Entregado'].includes(next.status)) return false;
  if (role === 'repartidor' && !/efectivo/i.test(previous.customer?.paymentMethod || '') && previous.paymentVerified !== next.paymentVerified) return false;
  if (!['cocina', 'repartidor'].includes(role)) return false;
  const allowed = new Set(['status', 'statusHistory', 'updatedAt', ...(role === 'repartidor' ? ['paymentVerified'] : [])]);
  return [...new Set([...Object.keys(previous), ...Object.keys(next)])].every(key => allowed.has(key) || JSON.stringify(previous[key]) === JSON.stringify(next[key]));
}
