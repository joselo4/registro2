import {csvCell} from './operations.js';

export function replenishmentRows(rows) {
  return rows.filter(p => p.stock !== '' && p.stock != null && Number.isFinite(Number(p.stock)) && Number(p.stock) <= (Number(p.lowStockThreshold) || 5)).map(p => {
    const minimum = Math.max(1,Number(p.lowStockThreshold)||5);
    return {...p, minimum, target:minimum*2, replenish:Math.max(0,Math.ceil(minimum*2-Number(p.stock)))};
  });
}
export function priceForMargin(cost, margin) {
  if (cost === '' || cost == null || margin === '' || margin == null) return null;
  const c=Number(cost), m=Number(margin);
  if (!Number.isFinite(c)||c<0||!Number.isFinite(m)||m<0||m>=100) return null;
  return Math.max(0, Math.ceil(c/(1-m/100)*100 - 1e-9)/100);
}
export function catalogCSV(rows, restock=false) {
  const data=restock
    ? [['Producto','Categoría','Estado','Conteo','Mínimo','Objetivo','Reponer','Último conteo'],...replenishmentRows(rows).map(p=>[p.name,p.category,p.active===false?'Pausado':'Activo',p.stock,p.minimum,p.target,p.replenish,p.stockCountedAt||''])]
    : [['Producto','Categoría','Estado','Precio PEN','Costo PEN','Conteo','Mínimo','Último conteo'],...rows.map(p=>[p.name,p.category,p.active===false?'Pausado':'Activo',p.price,p.cost??'',p.stock??'',p.lowStockThreshold??'',p.stockCountedAt||''])];
  return '\uFEFF'+data.map(row=>row.map(csvCell).join(';')).join('\r\n');
}
