import React, { useState, useEffect, useMemo, useRef } from 'react';
import { printThermalTicket } from '../../utils/escposTicket';

// Sonidos Web Audio API sintetizados (sin depender de archivos de audio externos)
const playBeep = (type = 'delivery') => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    if (type === 'delivery') {
      // Tono de dos notas alegre y enérgico (delivery)
      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, now); // D5
      osc1.frequency.setValueAtTime(880, now + 0.12); // A5
      gain1.gain.setValueAtTime(0.25, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.35);
    } else if (type === 'table') {
      // Tono suave estilo campana de mesa
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.setValueAtTime(659.25, now + 0.15); // E5
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.4);
    } else if (type === 'urgent') {
      // Triple pitido de advertencia por demora
      const now = ctx.currentTime;
      [0, 0.15, 0.3].forEach((delay) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(440, now + delay);
        gain.gain.setValueAtTime(0.15, now + delay);
        gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.1);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + delay);
        osc.stop(now + delay + 0.1);
      });
    }
  } catch (e) {
    console.warn('Audio no disponible o bloqueado por el navegador:', e);
  }
};

export default function KitchenDisplaySystem({
  orders = [],
  onUpdateOrderStatus,
  shopConfig = {},
  storeName = 'Friozo',
  ticketCustomMessage = '',
  addLog,
  currentUser,
  showAlert
}) {
  const [filterType, setFilterType] = useState('all'); // 'all' | 'delivery' | 'mesa' | 'llevar'
  const [currentViewTab, setCurrentViewTab] = useState('active'); // 'active' | 'ready'
  const [nowTimestamp, setNowTimestamp] = useState(Date.now());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const knownOrderIdsRef = useRef(new Set(orders.map(o => o.id)));

  const warningMinutes = Number(shopConfig?.kdsWarningMinutes) || 5;
  const alertMinutes = Number(shopConfig?.kdsAlertMinutes) || 10;
  const soundEnabled = shopConfig?.kdsSoundEnabled !== false;

  // Actualizar el cronómetro cada 5 segundos
  useEffect(() => {
    const timer = setInterval(() => {
      setNowTimestamp(Date.now());
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  // Detectar nuevas órdenes que ingresan para emitir sonido diferenciado
  useEffect(() => {
    if (!soundEnabled) return;
    orders.forEach(o => {
      if (!knownOrderIdsRef.current.has(o.id) && (o.status === 'Pendiente' || o.status === 'Por Corroborar')) {
        knownOrderIdsRef.current.add(o.id);
        const isDelivery = o.customer?.orderType === 'Delivery' || (o.deliveryFee > 0);
        if (isDelivery) {
          playBeep('delivery');
        } else {
          playBeep('table');
        }
      }
    });
  }, [orders, soundEnabled]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
      }
    }
  };

  // Clasificar pedidos activos para cocina
  const kitchenOrders = useMemo(() => {
    return orders.filter(o => {
      if (currentViewTab === 'active') {
        return o.status === 'Pendiente' || o.status === 'Por Corroborar' || o.status === 'Preparando';
      } else {
        return o.status === 'En camino' || o.status === 'Entregado';
      }
    }).filter(o => {
      if (filterType === 'delivery') {
        return o.customer?.orderType === 'Delivery' || (o.deliveryFee > 0);
      }
      if (filterType === 'mesa') {
        return o.customer?.orderType === 'Mesa' || Boolean(o.customer?.tableNumber);
      }
      if (filterType === 'llevar') {
        return o.customer?.orderType === 'Llevar' || (!o.deliveryFee && !o.customer?.tableNumber);
      }
      return true;
    }).sort((a, b) => new Date(a.date) - new Date(b.date)); // Las órdenes más antiguas primero
  }, [orders, currentViewTab, filterType]);

  const getElapsedTimeInfo = (dateIso) => {
    const elapsedMs = nowTimestamp - new Date(dateIso).getTime();
    const elapsedMinutes = Math.floor(elapsedMs / 60000);
    const elapsedSeconds = Math.floor((elapsedMs % 60000) / 1000);
    const timeFormatted = `${String(elapsedMinutes).padStart(2, '0')}:${String(elapsedSeconds).padStart(2, '0')}`;

    let level = 'normal'; // green
    if (elapsedMinutes >= alertMinutes) {
      level = 'urgent'; // red
    } else if (elapsedMinutes >= warningMinutes) {
      level = 'warning'; // yellow
    }

    return { elapsedMinutes, timeFormatted, level };
  };

  const handleStartPreparing = (order) => {
    onUpdateOrderStatus(order.id, 'Preparando');
    addLog?.(`Cocina inició preparación del pedido ${order.id} (${currentUser?.name || 'KDS'}).`);
  };

  const handleReadyToDeliver = (order) => {
    const isDelivery = order.customer?.orderType === 'Delivery' || (order.deliveryFee > 0);
    const nextStatus = isDelivery ? 'En camino' : 'Entregado';
    onUpdateOrderStatus(order.id, nextStatus);
    addLog?.(`Pedido ${order.id} marcado como listo (${nextStatus}) por ${currentUser?.name || 'Cocina'}.`);
    if (showAlert) {
      showAlert('Pedido Despachado', `El pedido ${order.id} pasó a ${nextStatus}.`, 'success');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Barra de Herramientas Superior del KDS */}
      <div className="glass" style={{ padding: '14px 18px', borderRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '1.6rem' }}>👨‍🍳</span>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.15rem' }}>KDS - Pantalla Táctil de Cocina y Barra</h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>
              Comandas en tiempo real con semáforo de preparación y alertas sonoras.
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', background: 'rgba(0,0,0,0.06)', borderRadius: '10px', padding: '3px' }}>
            <button
              className={`btn ${currentViewTab === 'active' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '6px 14px', fontSize: '0.78rem', borderRadius: '8px' }}
              onClick={() => setCurrentViewTab('active')}
            >
              🔥 Por Preparar ({orders.filter(o => o.status === 'Pendiente' || o.status === 'Preparando').length})
            </button>
            <button
              className={`btn ${currentViewTab === 'ready' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '6px 14px', fontSize: '0.78rem', borderRadius: '8px' }}
              onClick={() => setCurrentViewTab('ready')}
            >
              ✅ Despachados
            </button>
          </div>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={toggleFullscreen}
            style={{ padding: '6px 12px', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            title="Alternar Pantalla Completa para tablets de cocina"
          >
            {isFullscreen ? '🗗 Salir Pantalla Completa' : '⛶ Pantalla Completa'}
          </button>
        </div>
      </div>

      {/* Filtros por canal de comanda */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.78rem', fontWeight: 'bold', color: 'var(--text-light)' }}>Canal:</span>
        <button
          className={`btn ${filterType === 'all' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '5px 12px', fontSize: '0.75rem', borderRadius: '20px' }}
          onClick={() => setFilterType('all')}
        >
          Todos
        </button>
        <button
          className="badge-delivery"
          style={{ cursor: 'pointer', opacity: filterType === 'delivery' ? 1 : 0.65, border: filterType === 'delivery' ? '2px solid var(--delivery-color)' : '1px solid var(--delivery-border)', padding: '5px 12px' }}
          onClick={() => setFilterType('delivery')}
        >
          🛵 Solo Delivery
        </button>
        <button
          className="btn btn-secondary"
          style={{ padding: '5px 12px', fontSize: '0.75rem', borderRadius: '20px', borderColor: filterType === 'mesa' ? '#3498db' : 'inherit', color: filterType === 'mesa' ? '#2980b9' : 'inherit', fontWeight: filterType === 'mesa' ? 'bold' : 'normal' }}
          onClick={() => setFilterType('mesa')}
        >
          🍽️ Solo Mesas
        </button>
        <button
          className="btn btn-secondary"
          style={{ padding: '5px 12px', fontSize: '0.75rem', borderRadius: '20px', borderColor: filterType === 'llevar' ? '#9b59b6' : 'inherit', color: filterType === 'llevar' ? '#8e44ad' : 'inherit', fontWeight: filterType === 'llevar' ? 'bold' : 'normal' }}
          onClick={() => setFilterType('llevar')}
        >
          🥡 Para Llevar
        </button>

        {/* Indicadores de Semáforo de Tiempos */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', fontSize: '0.7rem', alignItems: 'center' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#27ae60' }} /> &lt;{warningMinutes}m
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f39c12' }} /> {warningMinutes}-{alertMinutes}m
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#e74c3c' }} /> &gt;{alertMinutes}m Demorado
          </span>
        </div>
      </div>

      {/* Cuadrícula de Comandas KDS */}
      {kitchenOrders.length === 0 ? (
        <div className="glass" style={{ padding: '50px 20px', textAlign: 'center', borderRadius: '16px' }}>
          <span style={{ fontSize: '3rem' }}>🎉</span>
          <h3 style={{ marginTop: '10px' }}>¡Cocina al día!</h3>
          <p style={{ color: 'var(--text-light)', fontSize: '0.85rem' }}>
            No hay comandas pendientes en este momento. Las nuevas órdenes sonarán automáticamente al ingresar.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: '16px' }}>
          {kitchenOrders.map(order => {
            const timeInfo = getElapsedTimeInfo(order.date);
            const isDelivery = order.customer?.orderType === 'Delivery' || (order.deliveryFee > 0);
            const isTable = order.customer?.orderType === 'Mesa' || Boolean(order.customer?.tableNumber);

            return (
              <div
                key={order.id}
                className={`kds-card ${timeInfo.level === 'urgent' ? 'urgent' : ''} ${isDelivery ? 'delivery-card-accent' : ''}`}
                style={{
                  borderLeft: isDelivery
                    ? '5px solid var(--delivery-color)'
                    : isTable
                    ? '5px solid #3498db'
                    : '5px solid #9b59b6'
                }}
              >
                {/* Cabecera de la Comanda */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <strong style={{ fontSize: '1.1rem' }}>{order.id}</strong>
                        {isDelivery && (
                          <span className="badge-delivery">🛵 DELIVERY</span>
                        )}
                        {isTable && (
                          <span style={{ background: 'rgba(52, 152, 219, 0.15)', color: '#2980b9', padding: '2px 7px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 'bold' }}>
                            🍽️ Mesa {order.customer?.tableNumber}
                          </span>
                        )}
                        {!isDelivery && !isTable && (
                          <span style={{ background: 'rgba(155, 89, 182, 0.15)', color: '#8e44ad', padding: '2px 7px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 'bold' }}>
                            🥡 Llevar
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-dark)', marginTop: '2px' }}>
                        {order.customer?.name || 'Cliente'}
                      </div>
                    </div>

                    {/* Badge Semáforo de Tiempo Transcurrido */}
                    <div className={`kds-timer-badge kds-timer-${timeInfo.level}`} title={`Tiempo en preparación: ${timeInfo.elapsedMinutes} minutos`}>
                      ⏱️ {timeInfo.timeFormatted}
                    </div>
                  </div>

                  {order.assignedDriver?.name && (
                    <div style={{ fontSize: '0.74rem', background: 'rgba(255, 68, 31, 0.08)', color: 'var(--delivery-color)', padding: '3px 8px', borderRadius: '6px', marginBottom: '8px', fontWeight: 600 }}>
                      🛵 Repartidor asignado: {order.assignedDriver.name}
                    </div>
                  )}

                  {/* Lista de Productos para Cocina */}
                  <div style={{ background: 'var(--bg-primary)', borderRadius: '10px', padding: '10px', marginTop: '6px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {(order.items || []).map((item, idx) => {
                      return (
                        <div key={idx} style={{ borderBottom: idx < order.items.length - 1 ? '1px dashed var(--border-color)' : 'none', paddingBottom: idx < order.items.length - 1 ? '6px' : '0' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <strong style={{ fontSize: '0.85rem' }}>
                              <span style={{ color: 'var(--primary-color)', marginRight: '4px' }}>{item.quantity || 1}x</span>
                              {item.name || 'Helado'}
                            </strong>
                          </div>

                          {/* Sabores y toppings desglosados */}
                          {item.type === 'custom' && (
                            <div style={{ fontSize: '0.76rem', color: 'var(--text-light)', marginTop: '2px', paddingLeft: '14px' }}>
                              <div>🍧 <b>Base:</b> {item.base?.name || 'Cono'}</div>
                              <div>🍨 <b>Sabores:</b> {(item.scoops || []).map(s => s.name).join(', ')}</div>
                              {item.toppings?.length > 0 && (
                                <div>✨ <b>Toppings:</b> {item.toppings.map(t => t.name).join(', ')}</div>
                              )}
                              {item.syrup?.name && (
                                <div>🍯 <b>Salsa:</b> {item.syrup.name}</div>
                              )}
                            </div>
                          )}
                          {item.type === 'pack' && (
                            <div style={{ fontSize: '0.76rem', color: 'var(--text-light)', marginTop: '2px', paddingLeft: '14px' }}>
                              🎁 <b>Contenido:</b> {item.items || ''}
                            </div>
                          )}
                          {item.type === 'liter' && (
                            <div style={{ fontSize: '0.76rem', color: 'var(--text-light)', marginTop: '2px', paddingLeft: '14px' }}>
                              🍦 <b>Sabores 1 Litro:</b> {(item.flavors || []).map(f => f.name).join(', ')}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {order.notes && (
                    <div style={{ marginTop: '8px', fontSize: '0.75rem', background: '#fff3cd', color: '#856404', padding: '6px 10px', borderRadius: '6px', border: '1px solid #ffeeba' }}>
                      ⚠️ <b>Nota:</b> {order.notes}
                    </div>
                  )}
                </div>

                {/* Acciones de Cocina de 1 Toque */}
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '10px', display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => printThermalTicket({ type: 'comanda', order, storeName, ticketCustomMessage })}
                    style={{ padding: '8px 10px', fontSize: '0.8rem' }}
                    title="Imprimir comanda térmica para cocina"
                  >
                    🖨️
                  </button>

                  {order.status !== 'Preparando' ? (
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => handleStartPreparing(order)}
                      style={{ flex: 1, padding: '8px 12px', fontSize: '0.82rem', fontWeight: 'bold' }}
                    >
                      🍳 Empezar a Preparar
                    </button>
                  ) : (
                    <button
                      type="button"
                      className={isDelivery ? 'delivery-btn-primary' : 'btn btn-primary'}
                      onClick={() => handleReadyToDeliver(order)}
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        fontSize: '0.82rem',
                        background: isDelivery ? undefined : '#27ae60',
                        borderColor: isDelivery ? undefined : '#27ae60'
                      }}
                    >
                      {isDelivery ? '🛵 Listo para Entrega' : '✅ Servir a Mesa'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
