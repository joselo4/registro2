export const ORDER_STATUSES = ['Por Corroborar', 'Pendiente', 'Preparando', 'Listo', 'En camino', 'Entregado', 'Cancelado'];
export const isDeliveryOrder = order => order?.customer?.orderType === 'Delivery' || Number(order?.deliveryFee) > 0;
export const isTableOrder = order => ['Mesa', 'Mesa_Llevar'].includes(order?.customer?.orderType);
export const isDigitalPayment = order => /yape|plin/i.test(order?.customer?.paymentMethod || '');
export const orderFreshness = order => Date.parse(order?.updatedAt || order?.statusHistory?.at(-1)?.timestamp || order?.date) || 0;

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
  if (isTableOrder(proposed) && proposed.tablePaid && !previous?.tablePaid && proposed.status !== 'Entregado') throw new Error('Primero entrega el pedido y luego cobra y libera la mesa.');
  if (previous && previous.status !== proposed.status) {
    const cancelling = proposed.status === 'Cancelado' && !['Entregado', 'Cancelado'].includes(previous.status);
    if (!cancelling && proposed.status !== nextOrderStatus(previous)) throw new Error('El pedido cambió o falta completar el paso anterior. Actualiza la lista y revisa su estado.');
    if (proposed.status === 'Pendiente' && isDigitalPayment(proposed) && !proposed.paymentVerified) throw new Error('Verifica el abono de Yape o Plin antes de aceptar el pedido.');
    if (proposed.status === 'En camino' && !proposed.assignedDriver) throw new Error('Asigna un repartidor antes de iniciar el reparto.');
    if (proposed.status === 'Entregado' && !isTableOrder(proposed) && !proposed.paymentVerified) throw new Error('Confirma el cobro antes de completar la entrega.');
  }
  const history = previous?.statusHistory?.length ? previous.statusHistory : previous ? [{ status: previous.status, timestamp: previous.date || timestamp }] : [];
  return {
    ...proposed,
    revision: (Number(previous?.revision) || 0) + 1,
    updatedAt: timestamp,
    statusHistory: history.at(-1)?.status === proposed.status ? history : [...history, { status: proposed.status, timestamp }],
  };
}

export const orderStatusLabel = status => ({ 'Por Corroborar': 'Por validar', Pendiente: 'En cola', Preparando: 'En preparación', Listo: 'Listo para entregar', 'En camino': 'En camino', Entregado: 'Entregado', Cancelado: 'Cancelado' }[status] || status);
