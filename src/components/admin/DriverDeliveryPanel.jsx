import { useState, useMemo, useEffect, useRef } from 'react';
import { getCollectionPaymentMethods, selectPaymentMethod } from '../../utils/paymentMethods';
import { isPaymentOnArrival } from '../../utils/orderLifecycle';
import { buildWhatsAppHref } from '../../utils/orderMessaging';
import { notifyOperationalEvent, playCashReminderSound, triggerDeviceVibration } from '../../utils/appAudioNotifications';

export default function DriverDeliveryPanel({
  orders = [],
  onUpdateOrderStatus,
  currentUser = {},
  storeName = 'Friozo',
  shopConfig,
  showAlert
}) {
  const [collectionMethods, setCollectionMethods] = useState({});
  const [savingOrderId, setSavingOrderId] = useState(null);
  const [activeSubTab, setActiveSubTab] = useState('active'); // 'active' | 'history'

  const driverId = String(currentUser?.id || '').trim();
  const driverEmail = String(currentUser?.email || '').toLowerCase().trim();

  // Filtrar pedidos asignados a este repartidor
  const myAssignedOrders = useMemo(() => {
    return orders.filter(o => {
      if (!o || o.status === 'Cancelado') return false;
      const assigned = o.assignedDriver;
      if (!assigned) return false;
      const assignedEmail = String(assigned.email || '').toLowerCase().trim();
      const assignedId = String(assigned.id || '').trim();
      return (driverEmail && assignedEmail === driverEmail) || (driverId && assignedId === driverId);
    });
  }, [orders, driverEmail, driverId]);

  const activeDeliveries = useMemo(() => {
    return myAssignedOrders.filter(o => o.status === 'Listo' || o.status === 'En camino');
  }, [myAssignedOrders]);

  const todayIso = new Date().toDateString();
  const completedToday = useMemo(() => {
    return myAssignedOrders.filter(o => o.status === 'Entregado' && new Date(o.date).toDateString() === todayIso);
  }, [myAssignedOrders, todayIso]);

  const cashCollectedToday = useMemo(() => {
    return completedToday
      .filter(o => String(o.customer?.paymentMethod || '').toLowerCase().includes('efectivo'))
      .reduce((sum, o) => sum + Number(o.grandTotal || 0), 0);
  }, [completedToday]);

  const digitalCollectedToday = useMemo(() => {
    return completedToday
      .filter(o => !String(o.customer?.paymentMethod || '').toLowerCase().includes('efectivo'))
      .reduce((sum, o) => sum + Number(o.grandTotal || 0), 0);
  }, [completedToday]);

  // Detector de Nuevos Pedidos Asignados al Repartidor (Sonido y Notificación Móvil)
  const knownAssignedRef = useRef(null);

  useEffect(() => {
    if (knownAssignedRef.current === null) {
      knownAssignedRef.current = new Set(activeDeliveries.map(o => o.id));
      return;
    }

    activeDeliveries.forEach(o => {
      if (!knownAssignedRef.current.has(o.id)) {
        notifyOperationalEvent('driver_assigned', {
          order: o,
          storeName,
          title: `🛵 ¡Nuevo Reparto Asignado! #${o.id}`,
          body: `${o.customer?.name || 'Cliente'} - ${o.customer?.address || 'Dirección por coordinar'}`
        });
      }
    });

    knownAssignedRef.current = new Set(activeDeliveries.map(o => o.id));
  }, [activeDeliveries, storeName]);

  const handleStartDelivery = async (order) => {
    if (onUpdateOrderStatus) {
      if (!await onUpdateOrderStatus(order.id, 'En camino')) return;
    }
    showAlert?.('¡En camino!', `Pedido #${order.id} marcado como en camino.`, 'success');
  };

  const handleCompleteDelivery = async (order) => {
    if (savingOrderId || !onUpdateOrderStatus) return;
    const needsCollection = !order.paymentVerified;
    const methods = getCollectionPaymentMethods(shopConfig, order);
    const method = selectPaymentMethod(collectionMethods[order.id] || order.customer?.paymentMethod, methods);
    const totalStr = Number(order.grandTotal || 0).toFixed(2);
    const clientName = order.customer?.name || 'el cliente';
    if (needsCollection && !isPaymentOnArrival(order)) {
      showAlert?.('Pago pendiente de validar', 'Solicita a caja que verifique el pago anticipado antes de completar la entrega.', 'warning');
      return;
    }
    if (needsCollection && !methods.includes(method)) {
      showAlert?.('Selecciona el medio de pago', 'Indica si recibiste Yape, Plin, efectivo, transferencia o tarjeta.', 'warning');
      return;
    }
    if (needsCollection) {
      playCashReminderSound();
      triggerDeviceVibration([200, 100, 200, 100, 300]);
      const message = `SOLICITAR PAGO AL LLEGAR\n\nPedido: #${order.id}\nCliente: ${clientName}\nMonto: S/. ${totalStr}\nMedio de cobro: ${method}\n\n${method === 'Efectivo' ? 'Recibe y cuenta el dinero.' : method === 'Tarjeta' ? 'Verifica que el POS confirme la operación aprobada por el total.' : 'Verifica que el abono haya ingresado a la cuenta de la tienda.'}\n\n¿Confirmas que ya recibiste el pago completo y entregaste el pedido?`;
      if (!window.confirm(message)) return;
    } else if (!window.confirm(`¿Confirmas que entregaste el pedido #${order.id} a ${clientName}? El pago ya está confirmado; no vuelvas a cobrar.`)) return;

    setSavingOrderId(order.id);
    try {
      const patch = needsCollection ? { paymentVerified: true, customer: { ...order.customer, paymentMethod: method } } : {};
      if (!await onUpdateOrderStatus(order.id, 'Entregado', patch)) return;
      showAlert?.('¡Entrega completada!', `Pedido #${order.id} entregado.${needsCollection ? ` Cobro registrado: S/. ${totalStr} por ${method}.` : ''}`, 'success');
    } catch {
      showAlert?.('No se pudo guardar', 'Revisa tu conexión y vuelve a intentar confirmar la entrega.', 'warning');
    } finally {
      setSavingOrderId(null);
    }
  };

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '16px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* CABECERA PRINCIPAL MODO REPARTIDOR */}
      <div style={{
        background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
        color: '#fff',
        padding: '18px 20px',
        borderRadius: '12px',
        marginBottom: '16px',
        boxShadow: '0 4px 15px rgba(0,0,0,0.15)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '1px', color: '#ff6b81', fontWeight: 700 }}>
              Panel de Despacho Móvil · {storeName}
            </div>
            <h1 style={{ margin: '4px 0 0 0', fontSize: '1.4rem', fontWeight: 800, color: '#fff' }}>
              🛵 Hola, {currentUser?.name || 'Repartidor'}
            </h1>
          </div>
        </div>
      </div>

      {/* TARJETAS RESUMEN DE COBRANZA Y ENTREGAS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '16px' }}>
        <div style={{ background: '#fff', padding: '12px 16px', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Entregas Activas</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#FF441F' }}>{activeDeliveries.length}</div>
        </div>
        <div style={{ background: '#fff', padding: '12px 16px', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Entregadas Hoy</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#10b981' }}>{completedToday.length}</div>
        </div>
        <div style={{ background: '#fff', padding: '12px 16px', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Efectivo a Rendir</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#d97706' }}>S/. {cashCollectedToday.toFixed(2)}</div>
        </div>
        <div style={{ background: '#fff', padding: '12px 16px', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Pagos Digitales</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#3b82f6' }}>S/. {digitalCollectedToday.toFixed(2)}</div>
        </div>
      </div>

      {/* PESTAÑAS DE NAVEGACIÓN SUBTAB */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <button
          type="button"
          onClick={() => setActiveSubTab('active')}
          style={{
            flex: 1,
            padding: '10px',
            borderRadius: '8px',
            fontWeight: 700,
            fontSize: '0.9rem',
            border: 'none',
            cursor: 'pointer',
            background: activeSubTab === 'active' ? '#FF441F' : '#e2e8f0',
            color: activeSubTab === 'active' ? '#fff' : '#475569'
          }}
        >
          🛵 Repartos Pendientes ({activeDeliveries.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab('history')}
          style={{
            flex: 1,
            padding: '10px',
            borderRadius: '8px',
            fontWeight: 700,
            fontSize: '0.9rem',
            border: 'none',
            cursor: 'pointer',
            background: activeSubTab === 'history' ? '#1e293b' : '#e2e8f0',
            color: activeSubTab === 'history' ? '#fff' : '#475569'
          }}
        >
          ✅ Entregados Hoy ({completedToday.length})
        </button>
      </div>

      {/* LISTA DE PEDIDOS */}
      {activeSubTab === 'active' ? (
        activeDeliveries.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', background: '#fff', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>🎉</div>
            <h3 style={{ margin: '0 0 4px 0', color: '#1e293b' }}>No tienes repartos pendientes</h3>
            <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>
              Cuando cocina te asigne un pedido para delivery, aparecerá aquí con los datos del cliente y botones de navegación.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {activeDeliveries.map((order) => {
              const customer = order.customer || {};
              const address = customer.address || 'Sin dirección';
              const reference = customer.reference;
              const needsCollection = !order.paymentVerified;
              const methods = getCollectionPaymentMethods(shopConfig, order);
              const cleanPhone = String(customer.phone || '').replace(/\D/g, '');
              const destinationQuery = encodeURIComponent(`${address}, Andahuaylas, Peru`);
              const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${destinationQuery}`;
              const wazeUrl = `https://waze.com/ul?q=${destinationQuery}&navigate=yes`;
              const waClientHref = buildWhatsAppHref(cleanPhone, `¡Hola ${customer.name || ''}! Te saluda ${currentUser?.name || 'tu repartidor'} de ${storeName}. Voy en camino con tus helados 🍦`);

              return (
                <div
                  key={order.id}
                  style={{
                    background: '#fff',
                    borderRadius: '12px',
                    border: order.status === 'En camino' ? '2px solid #FF441F' : '1px solid #e2e8f0',
                    padding: '16px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
                  }}
                >
                  {/* Encabezado Pedido */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        background: order.status === 'En camino' ? '#ff441f' : '#f59e0b',
                        color: '#fff',
                        fontSize: '0.75rem',
                        fontWeight: 800,
                        padding: '3px 8px',
                        borderRadius: '6px',
                        textTransform: 'uppercase'
                      }}>
                        {order.status === 'En camino' ? '🛵 EN RUTA' : '👨‍🍳 ' + order.status}
                      </span>
                      <strong style={{ fontSize: '1rem', color: '#1e293b' }}>#{order.id}</strong>
                    </div>
                    <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                      {new Date(order.date).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  {/* Datos del Cliente */}
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>
                      {customer.name || 'Cliente'}
                    </div>
                    <div style={{
                      margin: '6px 0',
                      padding: '8px 12px',
                      background: '#fffbeb',
                      borderLeft: '4px solid #f59e0b',
                      borderRadius: '4px',
                      fontSize: '0.9rem',
                      color: '#92400e'
                    }}>
                      📍 <strong>{address}</strong>
                      {reference && <div style={{ fontSize: '0.82rem', marginTop: '2px', color: '#78350f' }}>Ref: {reference}</div>}
                    </div>
                  </div>

                  <div role="status" style={{ padding: '14px', borderRadius: '8px', marginBottom: '12px', background: needsCollection ? '#fff7ed' : '#f0fdf4', border: needsCollection ? '2px solid #f97316' : '2px solid #22c55e', color: needsCollection ? '#9a3412' : '#166534' }}>
                    <strong style={{ display: 'block', fontSize: '1rem' }}>
                      {needsCollection ? '💰 SOLICITAR PAGO ANTES DE ENTREGAR' : '✅ PAGO CONFIRMADO'}
                    </strong>
                    <strong style={{ display: 'block', marginTop: '6px', fontSize: '1.25rem' }}>S/. {Number(order.grandTotal || 0).toFixed(2)}</strong>
                    <p style={{ fontSize: '0.875rem', margin: '8px 0' }}>
                      {needsCollection ? (isPaymentOnArrival(order) ? 'Pago al llegar. Solicita el pago por uno de los medios disponibles y confirma que recibiste el total para dar como entregado.' : 'Pago anticipado pendiente de validación. Solicita a caja que lo verifique antes de completar la entrega.') : `Pagado por ${customer.paymentMethod}. No volver a cobrar al cliente.`}
                    </p>
                    {needsCollection && isPaymentOnArrival(order) && (
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 700 }}>
                        Medio de cobro recibido
                        <select aria-label={`Medio de cobro del pedido ${order.id}`} value={selectPaymentMethod(collectionMethods[order.id] || customer.paymentMethod, methods)}
                          disabled={Boolean(savingOrderId)} onChange={event => setCollectionMethods(previous => ({ ...previous, [order.id]: event.target.value }))}
                          style={{ display: 'block', width: '100%', padding: '10px', marginTop: '6px', fontSize: '1rem', background: '#fff', color: '#1e293b', border: '1px solid #cbd5e1', borderRadius: '6px' }}>
                          <option value="" disabled>Seleccionar medio de pago</option>
                          {methods.map(method => <option key={method} value={method}>{method}</option>)}
                        </select>
                      </label>
                    )}
                  </div>

                  {/* Botones de Navegación y Contacto Directo */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px', marginBottom: '12px' }}>
                    <a
                      href={mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        background: '#4285F4',
                        color: '#fff',
                        textDecoration: 'none',
                        padding: '8px',
                        borderRadius: '6px',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        textAlign: 'center',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                      }}
                    >
                      🗺️ Google Maps
                    </a>
                    <a
                      href={wazeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        background: '#33ccff',
                        color: '#003366',
                        textDecoration: 'none',
                        padding: '8px',
                        borderRadius: '6px',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        textAlign: 'center',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                      }}
                    >
                      🚗 Waze
                    </a>
                    {cleanPhone && (
                      <>
                        <a
                          href={`tel:${cleanPhone}`}
                          style={{
                            background: '#0ea5e9',
                            color: '#fff',
                            textDecoration: 'none',
                            padding: '8px',
                            borderRadius: '6px',
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            textAlign: 'center',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px'
                          }}
                        >
                          📞 Llamar
                        </a>
                        <a
                          href={waClientHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            background: '#25D366',
                            color: '#fff',
                            textDecoration: 'none',
                            padding: '8px',
                            borderRadius: '6px',
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            textAlign: 'center',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px'
                          }}
                        >
                          💬 WhatsApp
                        </a>
                      </>
                    )}
                  </div>

                  {/* Acciones de Flujo */}
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {order.status !== 'En camino' ? (
                      <button
                        type="button"
                        onClick={() => handleStartDelivery(order)}
                        style={{
                          flex: 1,
                          background: '#FF441F',
                          color: '#fff',
                          border: 'none',
                          padding: '12px',
                          borderRadius: '8px',
                          fontWeight: 800,
                          fontSize: '0.95rem',
                          cursor: 'pointer',
                          boxShadow: '0 2px 8px rgba(255, 68, 31, 0.3)'
                        }}
                      >
                        🛵 Iniciar Reparto (Marcar En Camino)
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleCompleteDelivery(order)}
                        disabled={Boolean(savingOrderId)}
                        style={{
                          flex: 1,
                          background: '#10b981',
                          color: '#fff',
                          border: 'none',
                          padding: '12px',
                          borderRadius: '8px',
                          fontWeight: 800,
                          fontSize: '0.95rem',
                          cursor: 'pointer',
                          boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)'
                        }}
                      >
                        {savingOrderId === order.id ? 'Guardando entrega…' : needsCollection ? '💰 Confirmar cobro y entrega' : '✅ Confirmar Entrega al Cliente'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        /* HISTORIAL DE HOY */
        completedToday.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', background: '#fff', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
            <p style={{ margin: 0, color: '#64748b' }}>Aún no has completado entregas el día de hoy.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {completedToday.map((order) => {
              const isCash = String(order.customer?.paymentMethod || '').toLowerCase().includes('efectivo');
              return (
                <div
                  key={order.id}
                  style={{
                    background: '#fff',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    padding: '12px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '8px'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, color: '#1e293b' }}>
                      #{order.id} · {order.customer?.name}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                      📍 {order.customer?.address}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <strong style={{ color: '#10b981', display: 'block' }}>
                      S/. {Number(order.grandTotal || 0).toFixed(2)}
                    </strong>
                    <span style={{ fontSize: '0.72rem', color: isCash ? '#b45309' : '#3b82f6', fontWeight: 600 }}>
                      {isCash ? '💵 Efectivo Cobrado' : `📱 ${order.customer?.paymentMethod || 'Pago digital'} confirmado`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}
