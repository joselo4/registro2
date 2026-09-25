import { useEffect, useState } from 'react';
import { supabase } from '../../utils/supabaseClient';
import { currentSession } from '../../utils/apiClient';
import './AnalyticsPanel.css';

const STORE_STEPS = [
  { key: 'visit', label: 'Visitas a la tienda', icon: '🏠' },
  { key: 'view_item', label: 'Vieron un producto', icon: '👀' },
  { key: 'add_to_cart', label: 'Agregaron al carrito', icon: '🛒' },
  { key: 'begin_checkout', label: 'Abrieron el checkout', icon: '💳' },
  { key: 'purchase', label: 'Pedidos recibidos', icon: '✨' },
];
const GA4_STEPS = [
  { key: 'view_item', label: 'Vistas de producto', icon: '👀' },
  { key: 'add_to_cart', label: 'Agregados al carrito', icon: '🛒' },
  { key: 'begin_checkout', label: 'Inicios de checkout', icon: '💳' },
  { key: 'purchase', label: 'Compras confirmadas', icon: '✨' },
];
const money = value => `S/ ${(Number(value) || 0).toFixed(2)}`;
const shortDate = value => {
  const clean = String(value || '').replace(/-/g, '');
  return clean.length === 8 ? `${clean.slice(6, 8)}/${clean.slice(4, 6)}` : value;
};

async function authorizedJson(path, signal) {
  const session = supabase ? await currentSession(supabase) : null;
  if (!session?.access_token) throw Object.assign(new Error('Inicia sesión para ver el informe.'), { status: 401 });
  const response = await fetch(path, { headers: { Authorization: `Bearer ${session.access_token}` }, signal });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(payload.error || 'No se pudo cargar el informe.'), { status: response.status });
  return payload;
}

function Funnel({ steps, totals }) {
  return <div className="ga4-cards funnel-cards">{steps.map((step, index) => {
    const previous = index ? Number(totals[steps[index - 1].key]) || 0 : null;
    const value = Number(totals[step.key]) || 0;
    const ratio = previous ? Math.min(100, value / previous * 100) : 100;
    return <article className="ga4-card" key={step.key}>
      <div className="ga4-card-top"><span>{step.icon}</span><small>0{index + 1}</small></div>
      <h3>{step.label}</h3>
      <strong>{value.toLocaleString('es-PE')}</strong>
      <div className="ga4-progress"><span style={{ width: `${ratio}%` }} /></div>
      {index > 0 && <small>{previous ? `${ratio.toFixed(1)}% del paso anterior` : 'Sin datos en el paso anterior'}</small>}
    </article>;
  })}</div>;
}

function Trend({ series, primary, secondary, labels }) {
  const max = Math.max(1, ...series.map(day => Number(day[primary]) || 0), ...series.map(day => Number(day[secondary]) || 0));
  return <div className="ga4-trend">
    <div><h3>Actividad diaria</h3><p>{labels[0]} y {labels[1].toLowerCase()} por día</p></div>
    {series.length ? <div className="ga4-bars">{series.map(day => (
      <div className="ga4-day" key={day.date} title={`${shortDate(day.date)} · ${day[primary] || 0} ${labels[0].toLowerCase()} · ${day[secondary] || 0} ${labels[1].toLowerCase()}`}>
        <div className="ga4-view-bar" style={{ height: `${Math.max(3, (day[primary] || 0) / max * 100)}%` }} />
        <div className="ga4-purchase-bar" style={{ height: `${Math.max(3, (day[secondary] || 0) / max * 100)}%` }} />
      </div>
    ))}</div> : <p>Aún no hay actividad en este periodo.</p>}
    <div className="ga4-legend"><span>● {labels[0]}</span><span>● {labels[1]}</span></div>
  </div>;
}

export default function AnalyticsPanel({ googleAnalyticsId }) {
  const [days, setDays] = useState(30);
  const [refresh, setRefresh] = useState(0);
  const [source, setSource] = useState('store');
  const [store, setStore] = useState({ loading: true, data: null, error: '' });
  const [ga4, setGa4] = useState({ loading: true, data: null, error: '', notConfigured: false });

  useEffect(() => {
    const controller = new AbortController();
    setStore(current => ({ ...current, loading: true, error: '' }));
    setGa4(current => ({ ...current, loading: true, error: '' }));
    authorizedJson(`/api/store-report?days=${days}`, controller.signal)
      .then(data => setStore({ loading: false, data, error: '' }))
      .catch(error => { if (error.name !== 'AbortError') setStore({ loading: false, data: null, error: error.message }); });
    authorizedJson(`/api/ga4-report?days=${days}`, controller.signal)
      .then(data => setGa4({ loading: false, data, error: '', notConfigured: false }))
      .catch(error => { if (error.name !== 'AbortError') setGa4({ loading: false, data: null, error: error.message, notConfigured: error.status === 503 }); });
    return () => controller.abort();
  }, [days, refresh]);

  const report = store.data;
  const totals = report?.totals || {};
  const conversion = totals.visit ? (totals.purchase / totals.visit * 100).toFixed(1) : '0.0';
  const loading = store.loading || ga4.loading;

  return <section className="ga4-panel">
    <header className="ga4-header">
      <div><span className="ga4-eyebrow">INTELIGENCIA COMERCIAL</span><h2>Embudo de ventas</h2><p>Cuántas personas llegan, miran, agregan y compran, para saber en qué paso se pierden ventas.</p></div>
      <div className="ga4-controls">
        <label>Periodo <select value={days} onChange={e => setDays(Number(e.target.value))}><option value={7}>7 días</option><option value={30}>30 días</option><option value={90}>90 días</option></select></label>
        <button className="btn" type="button" onClick={() => setRefresh(value => value + 1)} disabled={loading}>↻ Actualizar</button>
      </div>
    </header>

    <div className="analytics-sources" role="tablist" aria-label="Origen de los datos">
      <button type="button" role="tab" aria-selected={source === 'store'} className={source === 'store' ? 'selected' : ''} onClick={() => setSource('store')}>🍦 Datos de la tienda</button>
      <button type="button" role="tab" aria-selected={source === 'ga4'} className={source === 'ga4' ? 'selected' : ''} onClick={() => setSource('ga4')}>📈 Google Analytics 4{ga4.data ? '' : ' (opcional)'}</button>
    </div>

    {source === 'store' && <>
      {store.loading && <p className="ga4-loading">Preparando el informe…</p>}
      {store.error && <div className="ga4-error" role="alert"><strong>No se pudo cargar el informe</strong><p>{store.error}</p></div>}
      {!store.loading && report && <>
        <div className="analytics-kpis">
          <article><small>Ventas del periodo</small><strong>{money(totals.revenue)}</strong><span>{totals.purchase || 0} pedidos</span></article>
          <article><small>Ticket promedio</small><strong>{money(report.averageTicket)}</strong><span>por pedido</span></article>
          <article><small>Conversión</small><strong>{conversion}%</strong><span>de visitas a pedidos</span></article>
        </div>
        <Funnel steps={STORE_STEPS} totals={totals} />
        <Trend series={report.series} primary="visit" secondary="purchase" labels={['Visitas', 'Pedidos']} />
        <div className="analytics-lists">
          <div className="ga4-trend"><h3>Lo más pedido</h3>{report.topProducts.length ? <ol className="analytics-top">{report.topProducts.map(product => <li key={product.name}><span>{product.name}</span><strong>{product.units} u.</strong><small>{money(product.revenue)}</small></li>)}</ol> : <p>Aún no hay pedidos en este periodo.</p>}</div>
          <div className="ga4-trend"><h3>Pedidos por canal</h3>{Object.keys(report.channels).length ? <ul className="analytics-top">{Object.entries(report.channels).sort((a, b) => b[1] - a[1]).map(([channel, count]) => <li key={channel}><span>{channel === 'Mesa_Llevar' ? 'Mesa para llevar' : channel}</span><strong>{count}</strong></li>)}</ul> : <p>Aún no hay pedidos en este periodo.</p>}</div>
        </div>
        <p className="ga4-footnote">Las visitas y pasos se cuentan de forma anónima en la tienda (una visita por pestaña abierta); los pedidos y ventas salen de tus pedidos reales, sin contar los cancelados ni los registrados por el personal. Los datos empiezan a reunirse desde que se activó este informe.</p>
      </>}
    </>}

    {source === 'ga4' && <>
      {ga4.loading && <p className="ga4-loading">Consultando GA4…</p>}
      {!ga4.loading && ga4.data && <>
        <div className="ga4-summary"><span>Propiedad {ga4.data.propertyId} · Últimos {ga4.data.days} días</span><strong>{ga4.data.totals.view_item ? (ga4.data.totals.purchase / ga4.data.totals.view_item * 100).toFixed(1) : '0.0'}%</strong><span>compras / vistas de producto</span></div>
        <Funnel steps={GA4_STEPS} totals={ga4.data.totals} />
        <Trend series={ga4.data.days} primary="view_item" secondary="purchase" labels={['Vistas', 'Compras']} />
        <p className="ga4-footnote">Recuentos de eventos de GA4; una persona puede generar varios eventos. GA4 puede tardar en procesar datos recientes.</p>
      </>}
      {!ga4.loading && !ga4.data && (ga4.notConfigured ? <div className="ga4-setup">
        <strong>GA4 es opcional: el informe de la tienda ya funciona.</strong>
        <p>Para ver también las cifras de Google Analytics aquí, alguien con acceso a tus cuentas de Google Cloud y Cloudflare debe hacer esto una vez:</p>
        <ol>
          {!googleAnalyticsId && <li>En <b>Ajustes Tienda</b>, pega el ID de medición <code>G-…</code> de tu propiedad GA4.</li>}
          <li>En Google Cloud, habilita la <b>Google Analytics Data API</b> en un proyecto.</li>
          <li>Crea una <b>cuenta de servicio</b> y descarga su clave JSON.</li>
          <li>En GA4 → Administrar → Gestión de acceso a la propiedad, agrega el correo de esa cuenta de servicio con rol <b>Lector</b>.</li>
          <li>En Cloudflare Pages → tu proyecto → Configuración → Variables y secretos, crea <code>GA4_PROPERTY_ID</code> (el número de la propiedad, no el G-…) y <code>GA4_SERVICE_ACCOUNT_JSON</code> (el contenido completo del JSON, como secreto).</li>
          <li>Vuelve a desplegar el sitio y toca <b>Actualizar</b>.</li>
        </ol>
      </div> : <div className="ga4-error" role="alert"><strong>GA4 no respondió</strong><p>{ga4.error}</p></div>)}
    </>}
  </section>;
}
