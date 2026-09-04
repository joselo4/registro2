import {useState} from 'react';
import {catalogHealth,peruDay} from '../../utils/operations';
import {catalogCSV,priceForMargin,replenishmentRows} from '../../utils/adminTools';
import {money} from '../../utils/dessert';

export default function CatalogTools({groups=[]}) {
  const [search,setSearch]=useState('');
  const [category,setCategory]=useState('all');
  const [status,setStatus]=useState('all');
  const [selected,setSelected]=useState('');
  const [margin,setMargin]=useState('65');
  const [feedback,setFeedback]=useState('');
  const {rows}=catalogHealth(groups);
  const restock=replenishmentRows(rows);
  const filtered=rows.filter(p=>(category==='all'||p.group===category)&&(status==='all'||(status==='paused'?p.active===false:p.active!==false))&&p.name.toLocaleLowerCase('es').includes(search.toLocaleLowerCase('es')));
  const product=rows.find(p=>`${p.group}:${p.id}`===selected);
  const suggested=priceForMargin(product?.cost,margin);
  function toggle(item) {
    groups.find(g=>g.key===item.group)?.update(previous=>previous.map(p=>p.id===item.id?{...p,active:p.active===false}:p));
    setFeedback(`${item.name}: ${item.active===false?'reactivado':'pausado'} en la carta.`);
  }
  function download(restockOnly=false) {
    const url=URL.createObjectURL(new Blob([catalogCSV(restockOnly?rows:filtered,restockOnly)],{type:'text/csv;charset=utf-8;'}));
    const a=document.createElement('a'); a.href=url;a.download=`FRIOSO-${restockOnly?'reposicion':'catalogo'}-${peruDay(Date.now())}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    setFeedback(restockOnly?'Lista de reposición descargada.':'Catálogo filtrado descargado.');
  }
  return <section className="ops-panel catalog-tools">
    <div className="ops-panel-heading"><div><span className="ops-kicker">HERRAMIENTAS DEL TURNO</span><h2>Tu carta, bajo control</h2></div><button className="ops-outline" disabled={!filtered.length} onClick={()=>download()}>↓ Exportar catálogo</button></div>
    <div className="catalog-tools-filters"><label>Buscar producto<input type="search" placeholder="Nombre del sabor, envase o pack…" value={search} onChange={e=>setSearch(e.target.value)}/></label><label>Categoría<select value={category} onChange={e=>setCategory(e.target.value)}><option value="all">Todas las categorías</option>{groups.map(g=><option value={g.key} key={g.key}>{g.name}</option>)}</select></label><label>Disponibilidad<select value={status} onChange={e=>setStatus(e.target.value)}><option value="all">Todos</option><option value="active">Activos</option><option value="paused">Pausados</option></select></label></div>
    <div className="catalog-tools-table"><table><thead><tr><th scope="col">Producto</th><th scope="col">Precio</th><th scope="col">Conteo manual</th><th scope="col">En la carta</th></tr></thead><tbody>{filtered.map(p=><tr key={`${p.group}:${p.id}`}><td><strong>{p.name}</strong><small>{p.category}</small></td><td>{money(p.price)}</td><td>{p.stock==null||p.stock===''?'Sin registrar':p.stock}</td><td><button className={`catalog-availability ${p.active===false?'paused':''}`} onClick={()=>toggle(p)} aria-label={`${p.active===false?'Reactivar':'Pausar'} ${p.name}`} aria-pressed={p.active!==false}>{p.active===false?'Pausado · reactivar':'Activo · pausar'}</button></td></tr>)}</tbody></table>{!filtered.length&&<p className="ops-empty">No hay productos que coincidan con estos filtros.</p>}</div>
    <div className="catalog-tools-bottom"><section><h3>Lista de reposición</h3><p className="ops-subtitle">{restock.length} productos llegaron a su mínimo. La sugerencia repone hasta el doble de ese mínimo, según el último conteo manual.</p><button className="ops-outline" disabled={!restock.length} onClick={()=>download(true)}>↓ Descargar lista de reposición</button><p className="ops-footnote">Incluye productos pausados para planificar su reactivación. No genera compras ni modifica las existencias.</p></section>
      <section><h3>Simular precio por margen</h3><label>Producto<select value={selected} onChange={e=>setSelected(e.target.value)}><option value="">Seleccionar un producto</option>{groups.map(g=><optgroup key={g.key} label={g.name}>{g.items.map(p=><option key={p.id} value={`${g.key}:${p.id}`}>{p.name}</option>)}</optgroup>)}</select></label><label>Margen bruto deseado (%)<input type="number" min="0" max="99" step="1" value={margin} onChange={e=>setMargin(e.target.value)}/></label><output className="catalog-price-result">{suggested===null?'Selecciona un producto con costo registrado y un margen entre 0 y 99%.':`Precio calculado: ${money(suggested)} · costo ${money(product.cost)}`}</output><p className="ops-footnote">Cálculo: costo ÷ (1 − margen). No cambia precios; excluye gastos fijos, delivery y descuentos. Usa «Carta Helada» para aplicar tu decisión.</p></section></div>
    <p className="catalog-tools-feedback" role="status" aria-live="polite">{feedback}</p>
  </section>;
}
