export const OPEN_STATUSES = ['Pendiente','Preparando','En camino'];
export const NEXT_STATUS = {Pendiente:'Preparando', Preparando:'En camino', 'En camino':'Entregado'};
export function peruDay(date) {
  const value = new Date(date);
  if (!Number.isFinite(value.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', {timeZone:'America/Lima',year:'numeric',month:'2-digit',day:'2-digit'}).format(value);
}
export function operationsSummary(orders, now) {
  const today = peruDay(now);
  const previous = peruDay(now - 86400000);
  const delivered = orders.filter(o => o.status === 'Entregado' && peruDay(o.date) === today);
  const sum = rows => rows.reduce((n,o) => n + Math.max(0, Number(o.grandTotal)||0), 0);
  const revenue = sum(delivered);
  const yesterday = sum(orders.filter(o => o.status === 'Entregado' && peruDay(o.date) === previous));
  const queue = orders.filter(o => OPEN_STATUSES.includes(o.status)).sort((a,b) => (Date.parse(a.date)||0)-(Date.parse(b.date)||0));
  const overdue = queue.filter(o => Number.isFinite(Date.parse(o.date)) && now-Date.parse(o.date) > 20*60000);
  const production = new Map();
  queue.filter(o => ['Pendiente','Preparando'].includes(o.status)).forEach(o => (o.items || []).forEach(item => {
    if (item.type !== 'custom') return;
    (item.scoops || []).forEach(s => {
      const name = typeof s === 'string' ? s : s.name;
      if (name) production.set(name, (production.get(name)||0) + Math.max(0, Number(item.quantity)||1));
    });
  }));
  return {delivered, revenue, yesterday, change: yesterday > 0 ? (revenue-yesterday)/yesterday*100 : null, queue, overdue, average: delivered.length ? revenue/delivered.length : 0, production:[...production].sort((a,b)=>b[1]-a[1])};
}
export function catalogHealth(groups) {
  const rows = groups.flatMap(group => group.items.map(item => ({...item, group:group.key, category:group.name})));
  const measured = rows.filter(p => p.stock !== '' && p.stock != null && Number.isFinite(Number(p.stock)));
  const lowStock = measured.filter(p => Number(p.stock) <= (Number(p.lowStockThreshold)||5));
  const missingCost = rows.filter(p => p.active !== false && (p.cost == null || p.cost === '' || !Number.isFinite(Number(p.cost))));
  const lowMargin = rows.filter(p => p.active !== false && Number(p.price)>0 && p.cost !== '' && p.cost != null && Number.isFinite(Number(p.cost))).map(p => ({...p, margin:(Number(p.price)-Number(p.cost))/Number(p.price)*100})).filter(p => p.margin<50).sort((a,b)=>a.margin-b.margin);
  return {rows, measured, lowStock, missingCost, lowMargin};
}
export function csvCell(value) {
  let text = String(value ?? '');
  if (/^[\s]*[=+@-]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g,'""')}"`;
}
export function ordersCSV(orders) {
  const rows = [['Pedido','Fecha de creación (Lima)','Estado','Cliente','Método de pago','Total (PEN)'], ...orders.map(o => [o.id, Number.isFinite(Date.parse(o.date)) ? new Date(o.date).toLocaleString('es-PE',{timeZone:'America/Lima'}) : '', o.status, o.customer?.name || '', o.customer?.paymentMethod || '', Number(o.grandTotal)||0])];
  return '\uFEFF'+rows.map(row=>row.map(csvCell).join(';')).join('\r\n');
}
