import { useEffect, useState } from 'react';
import { supabase } from '../../utils/supabaseClient';
import './AnalyticsPanel.css';

const STEPS = [
  { key: 'view_item', label: 'Vistas de producto', icon: '👀' },
  { key: 'add_to_cart', label: 'Agregados al carrito', icon: '🛒' },
  { key: 'begin_checkout', label: 'Inicios de checkout', icon: '💳' },
  { key: 'purchase', label: 'Compras confirmadas', icon: '✨' },
];

export default function AnalyticsPanel({ googleAnalyticsId }) {
  const [days, setDays] = useState(30);
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError('');
      try {
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !data?.session?.access_token) throw new Error('Inicia sesión para consultar GA4.');
        const response = await fetch(`/api/ga4-report?days=${days}`, { headers: { Authorization: `Bearer ${data.session.access_token}` }, signal: controller.signal });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || 'No se pudo cargar el informe.');
        setReport(payload);
      } catch (cause) {
        if (cause.name !== 'AbortError') setError(cause.message || 'No se pudo cargar el informe.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    load();
    return () => controller.abort();
  }, [days, refresh]);

  const totals = report?.totals || {};
  const maxDay = Math.max(1, ...(report?.days || []).map(day => day.view_item));
  const conversion = totals.view_item ? (totals.purchase / totals.view_item * 100).toFixed(1) : '0.0';

  return <section className="ga4-panel">
    <header className="ga4-header">
      <div><span className="ga4-eyebrow">INTELIGENCIA COMERCIAL</span><h2>Embudo de ventas</h2><p>Eventos confirmados por Google Analytics 4 para mejorar cada paso de la compra.</p></div>
      <div className="ga4-controls"><label>Periodo <select value={days} onChange={e => setDays(Number(e.target.value))}><option value={7}>7 días</option><option value={30}>30 días</option><option value={90}>90 días</option></select></label><button className="btn" type="button" onClick={() => setRefresh(value => value + 1)} disabled={loading}>↻ Actualizar</button></div>
    </header>
    {!googleAnalyticsId && <p className="ga4-note">Configura el ID de medición G-… en Ajustes para enviar eventos desde la tienda.</p>}
    {error && <div className="ga4-error" role="alert"><strong>El informe no está disponible</strong><p>{error}</p><small>Para consultar cifras reales, activa la Data API y configura el ID de propiedad y la cuenta de servicio en el servidor.</small></div>}
    {loading && <p className="ga4-loading">Consultando GA4…</p>}
    {!loading && report && !error && <>
      <div className="ga4-summary"><span>Propiedad {report.propertyId} · Últimos {report.days} días</span><strong>{conversion}%</strong><span>compras / vistas de producto</span></div>
      <div className="ga4-cards">{STEPS.map((step, index) => {
        const previous = index ? totals[STEPS[index - 1].key] : null;
        const ratio = previous ? Math.min(100, totals[step.key] / previous * 100) : 100;
        return <article className="ga4-card" key={step.key}><div className="ga4-card-top"><span>{step.icon}</span><small>0{index + 1}</small></div><h3>{step.label}</h3><strong>{Number(totals[step.key] || 0).toLocaleString('es-PE')}</strong><div className="ga4-progress"><span style={{ width: `${ratio}%` }} /></div>{index > 0 && <small>{previous ? `${ratio.toFixed(1)}% del paso anterior` : 'Sin datos en el paso anterior'}</small>}</article>;
      })}</div>
      <div className="ga4-trend"><div><h3>Actividad diaria</h3><p>Vistas de productos y compras confirmadas por día</p></div>{report.days.length ? <div className="ga4-bars">{report.days.map(day => <div className="ga4-day" key={day.date} title={`${day.date.slice(0, 4)}-${day.date.slice(4, 6)}-${day.date.slice(6)} · ${day.view_item} vistas · ${day.purchase} compras`}><div className="ga4-view-bar" style={{ height: `${Math.max(3, day.view_item / maxDay * 100)}%` }} /><div className="ga4-purchase-bar" style={{ height: `${Math.max(3, day.purchase / maxDay * 100)}%` }} /></div>)}</div> : <p>Aún no hay eventos en este periodo.</p>}<div className="ga4-legend"><span>● Vistas</span><span>● Compras</span></div></div>
      <p className="ga4-footnote">Las cifras son recuentos de eventos de GA4. Una persona puede generar varios eventos; el porcentaje es una relación entre eventos, no una tasa por usuarios únicos. GA4 puede tardar en procesar datos recientes.</p>
    </>}
  </section>;
}
