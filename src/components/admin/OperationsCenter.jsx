import {useState,useEffect} from 'react';
import {money} from '../../utils/dessert';
import {operationsSummary,catalogHealth,ordersCSV,peruDay} from '../../utils/operations';
import './operations.css';
import CatalogTools from './CatalogTools';

export default function OperationsCenter({orders=[],groups=[],salesGoal=0,onNavigate,onUpdateOrderStatus,shopOpen}) {
  const [now,setNow] = useState(Date.now);
  const [filter,setFilter] = useState('Todos');
  const [search,setSearch] = useState('');
  const [stockItem,setStockItem] = useState('');
  const [stock,setStock] = useState('');
  const [threshold,setThreshold] = useState('5');
  const [feedback,setFeedback] = useState('');
  const [pending,setPending] = useState(null);
  useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),60000); return ()=>clearInterval(timer);},[]);
  const stats = operationsSummary(orders,now);
  const health = catalogHealth(groups);
  const goal = Math.max(0,Number(salesGoal)||0);
  const progress = goal ? Math.min(100,stats.revenue/goal*100) : 0;
  const queue = stats.queue.filter(o => (filter === 'Todos' || o.status === filter || (filter === 'Demorados' && stats.overdue.includes(o))) && `${o.id} ${o.customer?.name || ''}`.toLowerCase().includes(search.toLowerCase()));
  const todayOrders = orders.filter(o=>peruDay(o.date) === peruDay(now));
  function exportOrders() {
    const url=URL.createObjectURL(new Blob([ordersCSV(todayOrders)],{type:'text/csv;charset=utf-8;'}));
    const a=document.createElement('a'); a.href=url; a.download=`FRIOSO-pedidos-${peruDay(now)}.csv`; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
    setFeedback('Reporte de hoy descargado. Incluye pedidos de todos los estados.');
  }
  function chooseStock(value) {
    setStockItem(value); const item=health.rows.find(p=>`${p.group}:${p.id}`===value); setStock(item?.stock ?? ''); setThreshold(item?.lowStockThreshold ?? 5);
  }
  function saveStock(e) {
    e.preventDefault(); const item=health.rows.find(p=>`${p.group}:${p.id}`===stockItem);
    if (!item || stock === '' || !Number.isInteger(Number(stock)) || Number(stock)<0 || !Number.isInteger(Number(threshold)) || Number(threshold)<1) {setFeedback('Elige un producto e ingresa cantidades enteras válidas.'); return;}
    const group=groups.find(g=>g.key===item.group);
    group.update(previous=>previous.map(p=>p.id===item.id ? {...p, stock:Number(stock),lowStockThreshold:Number(threshold),stockCountedAt:new Date().toISOString()} : p));
    setFeedback(`Conteo de ${item.name} actualizado: ${stock} porciones o unidades.`);
  }
  function toggleAvailability(item) {
    const group=groups.find(g=>g.key===item.group);
    group.update(previous=>previous.map(p=>p.id===item.id ? {...p,active:p.active === false} : p));
    setFeedback(`${item.name}: ${item.active === false ? 'disponible en la carta' : 'pausado en la carta'}.`);
  }
  async function startOrder(order) {
    if (pending) return;
    setPending(order.id);
    try { const synced = await onUpdateOrderStatus(order.id,'Preparando'); setFeedback(synced === false ? `Pedido ${order.id} actualizado en este dispositivo. La sincronización sigue pendiente; revisa la conexión.` : `Pedido ${order.id}: preparación iniciada.`); }
    catch {setFeedback('No se pudo actualizar el pedido. Intenta nuevamente.');}
    finally {setPending(null);}
  }
  return <section className="ops">
    <header className="ops-heading"><div><span className="ops-kicker">TU HELADERÍA, AL DÍA</span><h1>Que todo marche <em>rico.</em></h1><p>{new Date(now).toLocaleDateString('es-PE',{weekday:'long',day:'numeric',month:'long',timeZone:'America/Lima'})} · Hora de Perú</p></div><button className="ops-outline" onClick={exportOrders} disabled={!todayOrders.length}>↓ Exportar pedidos de hoy</button></header>
    <div className="ops-status"><span className={shopOpen ? 'ops-dot open' : 'ops-dot'} />Tienda {shopOpen ? 'abierta' : 'cerrada'}<span>·</span><span>{stats.queue.length} pedidos en curso</span><button onClick={()=>onNavigate('settings')}>Gestionar tienda →</button></div>
    <div className="ops-kpis"><article><span>Ventas entregadas · hoy</span><strong>{money(stats.revenue)}</strong><small>{stats.change === null ? 'Sin base de comparación ayer' : `${stats.change >= 0 ? '+' : ''}${stats.change.toFixed(0)}% frente a ayer`}</small></article><article><span>Pedidos entregados</span><strong>{stats.delivered.length.toString().padStart(2,'0')}</strong><small>Pedidos creados hoy</small></article><article><span>Ticket promedio</span><strong>{money(stats.average)}</strong><small>Solo pedidos entregados</small></article><article className={stats.overdue.length ? 'ops-attention' : ''}><span>Requieren atención</span><strong>{stats.overdue.length.toString().padStart(2,'0')}</strong><button onClick={()=>setFilter('Demorados')}>Más de 20 minutos →</button></article></div>
    <div className="ops-goal"><div><strong>La meta de hoy</strong><span>{goal ? `${money(stats.revenue)} de ${money(goal)}` : 'Configura una meta de ventas'}</span></div><progress value={progress} max="100" aria-label="Avance de la meta de ventas" /><b>{Math.round(progress)}%</b><button onClick={()=>onNavigate('stats')}>Ver detalle →</button></div>
    <div className="ops-grid">
      <section className="ops-panel ops-queue"><div className="ops-panel-heading"><h2>El pulso de tus pedidos</h2><button onClick={()=>onNavigate('orders')}>Ver todos →</button></div><div className="ops-filters">{['Todos','Pendiente','Preparando','En camino','Demorados'].map(s=><button key={s} className={filter===s?'selected':''} aria-pressed={filter===s} onClick={()=>setFilter(s)}>{s}</button>)}</div><input className="ops-search" type="search" aria-label="Buscar pedidos por código o cliente" placeholder="Buscar código o cliente…" value={search} onChange={e=>setSearch(e.target.value)} />
        <div className="ops-queue-list">{!queue.length && <div className="ops-empty"><strong>{stats.queue.length ? 'No hay coincidencias' : 'Todo está al día'}</strong><p>{stats.queue.length ? 'Prueba otro filtro o nombre.' : 'Los nuevos pedidos aparecerán aquí.'}</p></div>}{queue.map(o=>{const minutes=Math.max(0,Math.floor((now-Date.parse(o.date))/60000));return <article key={o.id}><div><strong>{o.id}</strong><span>{o.customer?.name || 'Cliente'}</span><small>{(o.items||[]).map(i=>`${i.quantity||1} × ${i.name || 'Helado personalizado'}`).join(' · ')}</small></div><div><span className={`ops-order-status ${minutes>20?'late':''}`}>{o.status} · {Number.isFinite(minutes) ? `${minutes} min` : 'sin hora'}</span><b>{money(o.grandTotal)}</b>{o.status==='Pendiente'?<button disabled={Boolean(pending)} onClick={()=>startOrder(o)}>{pending===o.id?'Actualizando…':'Preparar →'}</button>:<button onClick={()=>onNavigate('orders')}>Gestionar →</button>}</div></article>;})}</div>
      </section>
      <section className="ops-panel"><div className="ops-panel-heading"><h2>En la mesa de preparación</h2></div><p className="ops-subtitle">Bolas por servir de pedidos pendientes y en preparación.</p>{stats.production.length ? stats.production.map(([name,quantity])=><div className="ops-demand" key={name}><span>{name}</span><b>{quantity}<small> bolas</small></b></div>):<div className="ops-empty"><strong>Sin bolas pendientes</strong><p>El desglose se actualiza con cada pedido personalizado.</p></div>}<p className="ops-footnote">Los potes por litro y los packs se revisan en el detalle de cada pedido.</p></section>
    </div>
    <div className="ops-grid">
      <section className="ops-panel"><div className="ops-panel-heading"><h2>Existencias a la vista</h2><button onClick={()=>onNavigate('inventory')}>Abrir carta →</button></div><p className="ops-subtitle">Conteo manual en porciones o unidades. Actualízalo al cierre de turno; las ventas no lo descuentan automáticamente.</p><form className="ops-stock-form" onSubmit={saveStock}><label>Producto<select required value={stockItem} onChange={e=>chooseStock(e.target.value)}><option value="">Seleccionar producto</option>{groups.map(g=><optgroup key={g.key} label={g.name}>{g.items.map(p=><option value={`${g.key}:${p.id}`} key={p.id}>{p.name}</option>)}</optgroup>)}</select></label><div><label>Existencias<input required type="number" min="0" max="100000" step="1" value={stock} onChange={e=>setStock(e.target.value)} /></label><label>Avisar con menos de<input required type="number" min="1" max="100000" step="1" value={threshold} onChange={e=>setThreshold(e.target.value)} /></label><button type="submit">Guardar conteo</button></div></form><div className="ops-stock-alerts">{health.lowStock.length ? health.lowStock.map(p=><div key={`${p.group}:${p.id}`}><span><strong>{p.name}</strong><small>{p.stock} disponibles · mínimo {p.lowStockThreshold||5}{p.stockCountedAt ? ` · contado ${new Date(p.stockCountedAt).toLocaleDateString('es-PE',{timeZone:'America/Lima'})}`:''}</small></span><button onClick={()=>toggleAvailability(p)}>{p.active === false ? 'Reactivar' : 'Pausar venta'}</button></div>):<p className="ops-footnote">{health.measured.length ? 'Los productos con conteo están por encima de su mínimo.' : 'Registra el primer conteo para ver avisos de reposición.'}</p>}</div></section>
      <section className="ops-panel"><div className="ops-panel-heading"><h2>Cuida cada margen</h2><button onClick={()=>onNavigate('inventory')}>Editar costos →</button></div><p className="ops-subtitle">Productos activos con margen bruto menor al 50%, según precio y costo de tu carta.</p>{health.lowMargin.map(p=><div className="ops-demand" key={`${p.group}:${p.id}`}><span>{p.name}<small>Costo {money(p.cost)} · venta {money(p.price)}</small></span><b className="ops-negative">{p.margin.toFixed(0)}%</b></div>)}{!health.lowMargin.length && <div className="ops-empty"><strong>{health.missingCost.length ? 'Completa tus costos' : 'Márgenes en buen camino'}</strong><p>{health.missingCost.length ? 'Así podrás detectar productos que necesitan un ajuste.' : 'No hay productos calculables con margen bajo.'}</p></div>}<p className="ops-footnote">{health.missingCost.length} productos activos sin costo registrado. No incluye gastos fijos, delivery ni descuentos.</p><button className="ops-outline" onClick={()=>onNavigate('finance')}>Ir a caja y finanzas →</button></section>
    </div>
    <CatalogTools groups={groups}/>
    <p className="ops-feedback" role="status" aria-live="polite">{feedback}</p>
  </section>;
}
