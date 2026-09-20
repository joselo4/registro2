import { PAYMENT_METHODS } from './paymentMethods.js';

export const ORDER_STATUSES = ['Por Corroborar', 'Pendiente', 'Preparando', 'Listo', 'En camino', 'Entregado', 'Cancelado'];
export const isDeliveryOrder = order => String(order?.customer?.orderType || '').toLowerCase() === 'delivery' || Number(order?.deliveryFee) > 0;
export const isTableOrder = order => ['mesa', 'mesa_llevar'].includes(String(order?.customer?.orderType || '').toLowerCase()) || Boolean(order?.customer?.tableNumber);
export const DELIVERY_PAYMENT_METHODS = PAYMENT_METHODS;
export const isDigitalPayment = order => /yape|plin|transferencia/i.test(order?.customer?.paymentMethod || '');
export const orderPaymentTiming = order => {
  const explicitTiming = order?.customer?.paymentTiming;
  if (explicitTiming === 'Al llegar' || explicitTiming === 'Anticipado') return explicitTiming;
  if (/efectivo|tarjeta/i.test(order?.customer?.paymentMethod || '')) return 'Al llegar';
  // Older orders could lose this field. An unpaid order without an operation code
  // must remain collectible at delivery instead of becoming impossible to complete.
  if (order?.customer?.operationCode || order?.paymentVerified === true) return 'Anticipado';
  return 'Al llegar';
};
export const isPaymentOnArrival = order => orderPaymentTiming(order) === 'Al llegar';
export const requiresAdvancePayment = order => isDigitalPayment(order) && !isPaymentOnArrival(order);
export const paymentDescription = order => `${order?.customer?.paymentMethod || 'Por definir'} · ${isPaymentOnArrival(order) ? 'Pago al llegar' : 'Pago anticipado'}`;
export const orderFreshness = order => Date.parse(order?.updatedAt || order?.statusHistory?.at(-1)?.timestamp || order?.date) || 0;
export const orderPaymentMethod = order => order?.customer?.paymentMethod || order?.paymentMethod || 'Por definir';

export function orderStatusTimestamp(order, status) {
  const history = Array.isArray(order?.statusHistory) ? order.statusHistory : [];
  const match = [...history].reverse().find(entry => entry?.status === status && Number.isFinite(Date.parse(entry?.timestamp)));
  if (match) return match.timestamp;
  if (order?.status === status) return order?.updatedAt || order?.date || null;
  return null;
}

export function orderPaidAt(order) {
  // Legacy delivered orders did not persist this flag; only an explicit false is unpaid.
  if (order?.paymentVerified === false) return null;
  return order.paymentVerifiedAt || orderStatusTimestamp(order, 'Entregado') || order.updatedAt || order.date || null;
}

export function orderRecognizedAt(order) {
  const paidAt = Date.parse(orderPaidAt(order));
  const deliveredAt = Date.parse(orderStatusTimestamp(order, 'Entregado'));
  if (!Number.isFinite(paidAt) || !Number.isFinite(deliveredAt)) return null;
  return new Date(Math.max(paidAt, deliveredAt)).toISOString();
}

export const isRecognizedSale = order => order?.status === 'Entregado' && order?.paymentVerified !== false && Boolean(orderRecognizedAt(order));

// Merge snapshots by ID and revision; a partial refresh must never erase an order.
export function mergeOrders(...lists) {
  const result = new Map();
  for (const list of lists) for (const order of Array.isArray(list) ? list : []) {
    if (!order?.id) continue;
    const id = String(order.id).trim().toUpperCase();
    const previous = result.get(id);
    const revision = Number(order.revision) || 0;
    const previousRevision = Number(previous?.revision) || 0;
    if (!previous || (revision !== previousRevision ? revision > previousRevision : orderFreshness(order) >= orderFreshness(previous))) result.set(id, { ...order, id });
  }
  return [...result.values()].sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0));
}

export function nextOrderStatus(order) {
  return { 'Por Corroborar': 'Pendiente', Pendiente: 'Preparando', Preparando: 'Listo', Listo: isDeliveryOrder(order) ? 'En camino' : 'Entregado', 'En camino': 'Entregado' }[order?.status] || null;
}

export function prepareOrderUpdate(previous, proposed, timestamp = new Date().toISOString()) {
  if (!ORDER_STATUSES.includes(proposed.status)) throw new Error('Estado de pedido inválido.');
  if (previous?.paymentVerified && !proposed.paymentVerified) throw new Error('Un cobro confirmado no se puede volver a marcar como pendiente. Registra cualquier devolución por separado.');
  if (previous?.tablePaid && !proposed.tablePaid) throw new Error('Una mesa cobrada no se puede volver a marcar como pendiente.');
  if (proposed.tablePaid && !proposed.paymentVerified) throw new Error('Confirma el cobro antes de cerrar y liberar la mesa.');
  if (isTableOrder(proposed) && proposed.tablePaid && !previous?.tablePaid && proposed.status !== 'Entregado') throw new Error('Primero entrega el pedido y luego cobra y libera la mesa.');
  if (previous && previous.status !== proposed.status) {
    const cancelling = proposed.status === 'Cancelado' && !['Entregado', 'Cancelado'].includes(previous.status);
    if (!cancelling && proposed.status !== nextOrderStatus(previous)) throw new Error('El pedido cambió o falta completar el paso anterior. Actualiza la lista y revisa su estado.');
    if (proposed.status === 'Pendiente' && requiresAdvancePayment(proposed) && !proposed.paymentVerified) throw new Error('Verifica el abono de Yape, Plin o transferencia antes de aceptar el pedido.');
    if (proposed.status === 'En camino' && !proposed.assignedDriver) throw new Error('Asigna un repartidor antes de iniciar el reparto.');
    if (proposed.status === 'Entregado' && !isTableOrder(proposed) && !proposed.paymentVerified) throw new Error('Confirma el cobro antes de completar la entrega.');
  }
  if (isDeliveryOrder(proposed) && ['En camino', 'Entregado'].includes(proposed.status) && !proposed.assignedDriver) throw new Error('El reparto debe conservar un repartidor asignado hasta completar la entrega.');
  const history = previous?.statusHistory?.length ? previous.statusHistory : previous ? [{ status: previous.status, timestamp: previous.date || timestamp }] : [];
  const statusChanged = !previous || previous.status !== proposed.status;
  return {
    ...proposed,
    revision: (Number(previous?.revision) || 0) + 1,
    updatedAt: timestamp,
    statusHistory: history.at(-1)?.status === proposed.status ? history : [...history, { status: proposed.status, timestamp }],
    ...(statusChanged && proposed.status === 'Entregado' ? { deliveredAt: timestamp } : {}),
  };
}

export const orderStatusLabel = status => ({ 'Por Corroborar': 'Por validar', Pendiente: 'En cola', Preparando: 'En preparación', Listo: 'Listo para entregar', 'En camino': 'En camino', Entregado: 'Entregado', Cancelado: 'Cancelado' }[status] || status);
