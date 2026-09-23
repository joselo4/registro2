import './SettingsDashboard.css';

const CHANNELS = [
  { key: 'tableOrdersEnabled', icon: '🍽️', title: 'Mesas', detail: 'Pedidos en salón y por QR.' },
  { key: 'barOrdersEnabled', icon: '🛍️', title: 'Barra', detail: 'Recojo y atención en tienda.' },
  { key: 'deliveryOrdersEnabled', icon: '🛵', title: 'Delivery', detail: 'Pedidos a domicilio.' },
];

const SECTIONS = [
  ['settings-payments', '💳 Pagos'],
  ['settings-promotions', '🎁 Promociones'],
  ['settings-operations', '🕒 Horarios y mesas'],
  ['settings-tracking', '📊 Medición'],
];

export default function SettingsOverview({ config = {}, onChangeChannel, onSave, onOpenAnalytics }) {
  const activeCount = CHANNELS.filter(channel => config[channel.key] !== false).length;
  return <>
    <header className="settings-dashboard-hero">
      <div>
        <span className="settings-dashboard-eyebrow">CENTRO DE CONFIGURACIÓN</span>
        <h2>Tu tienda, a tu manera.</h2>
        <p>Elige dónde recibes pedidos y ajusta los detalles que ayudan a convertir visitas en ventas.</p>
      </div>
      <div className="settings-dashboard-status"><span className="settings-status-dot" />{config.open ? 'Tienda habilitada' : 'Tienda cerrada'}</div>
    </header>

    <section className="settings-channels" id="settings-channels" aria-labelledby="settings-channels-title">
      <div className="settings-section-heading">
        <div><span>01 / OPERACIÓN</span><h3 id="settings-channels-title">Canales de venta</h3><p>Activa solo los canales que quieres atender. Puedes combinar los tres o trabajar con uno.</p></div>
        <strong>{activeCount} {activeCount === 1 ? 'activo' : 'activos'}</strong>
      </div>
      <div className="settings-channel-grid">
        {CHANNELS.map(channel => <label className={`settings-channel-card ${config[channel.key] !== false ? 'is-active' : ''}`} key={channel.key}>
          <input type="checkbox" checked={config[channel.key] !== false} onChange={event => onChangeChannel(channel.key, event.target.checked)} aria-label={`Activar ${channel.title}`} />
          <span className="settings-channel-icon" aria-hidden="true">{channel.icon}</span>
          <span className="settings-channel-title">{channel.title}</span>
          <span className="settings-channel-detail">{channel.detail}</span>
          <span className="settings-channel-switch" aria-hidden="true"><span /></span>
        </label>)}
      </div>
      <div className="settings-channel-actions"><span>Los cambios de canales se aplican al guardar.</span><button type="button" className="btn btn-primary" onClick={onSave}>Guardar canales</button></div>
    </section>

    <nav className="settings-shortcuts" aria-label="Secciones de configuración">
      {SECTIONS.map(([target, label]) => <button key={target} type="button" onClick={() => document.getElementById(target)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>{label}<span aria-hidden="true">↗</span></button>)}
      <button type="button" onClick={onOpenAnalytics}>Ver embudo GA4 <span aria-hidden="true">→</span></button>
    </nav>
  </>;
}
