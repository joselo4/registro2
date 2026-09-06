import { useState, useEffect, useRef, useMemo } from 'react';
import { Geolocation } from '@capacitor/geolocation';
import { buildWhatsAppHref } from '../../utils/orderMessaging';

export default function DriverDeliveryPanel({
  orders = [],
  onUpdateOrderStatus,
  currentUser = {},
  storeName = 'Friozo',
  cartLocations,
  onUpdateCartLocations,
  showAlert
}) {
  const [isGpsActive, setIsGpsActive] = useState(false);
  const [gpsError, setGpsError] = useState('');
  const [lastCoords, setLastCoords] = useState(null);
  const [activeSubTab, setActiveSubTab] = useState('active'); // 'active' | 'history'
  const gpsWatchIdRef = useRef(null);

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
    return myAssignedOrders.filter(o => o.status === 'Preparando' || o.status === 'En camino' || o.status === 'Pendiente');
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

  // Publicar ubicación GPS actual a cartLocations
  const broadcastLocation = (lat, lng) => {
    setLastCoords({ lat, lng, time: new Date() });
    if (!onUpdateCartLocations) return;

    const rawList = Array.isArray(cartLocations) ? cartLocations : (cartLocations?.carts || []);
    const identifier = driverEmail || driverId || 'repartidor';

    // Actualizar o insertar este repartidor en cartLocations
    const otherLocations = rawList.filter(c => {
      const cEmail = String(c.driverEmail || c.operatorEmail || c.id || '').toLowerCase().trim();
      return cEmail !== identifier;
    });

    const myEntry = {
      id: identifier,
      driverId: driverId || identifier,
      driverEmail: driverEmail || '',
      label: currentUser?.name ? `🛵 ${currentUser.name}` : '🛵 Repartidor en Ruta',
      name: currentUser?.name || 'Repartidor',
      lat,
      lng,
      status: 'en_ruta',
      lastUpdated: new Date().toISOString()
    };

    onUpdateCartLocations({
      carts: [...otherLocations, myEntry],
      updatedAt: new Date().toISOString()
    });
  };

  // Iniciar / detener rastreo GPS
  const handleToggleGps = async () => {
    if (isGpsActive) {
      if (gpsWatchIdRef.current !== null) {
        try {
          if (typeof Geolocation !== 'undefined' && Geolocation.clearWatch) {
            await Geolocation.clearWatch({ id: gpsWatchIdRef.current });
          } else if (navigator.geolocation) {
            navigator.geolocation.clearWatch(gpsWatchIdRef.current);
          }
        } catch {
          // ignore cleanup errors
        }
        gpsWatchIdRef.current = null;
      }
      setIsGpsActive(false);
      return;
    }

    setGpsError('');
    try {
      if (typeof Geolocation !== 'undefined') {
        try {
          const perm = await Geolocation.checkPermissions();
          if (perm.location !== 'granted') {
            await Geolocation.requestPermissions();
          }
        } catch {
          // continuar con fallback
        }

        const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 10000 });
        broadcastLocation(pos.coords.latitude, pos.coords.longitude);

        const watchId = await Geolocation.watchPosition(
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 },
          (position) => {
            if (position?.coords) {
              broadcastLocation(position.coords.latitude, position.coords.longitude);
            }
          }
        );
        gpsWatchIdRef.current = watchId;
        setIsGpsActive(true);
      } else if (navigator?.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            broadcastLocation(pos.coords.latitude, pos.coords.longitude);
            const watchId = navigator.geolocation.watchPosition(
              (p) => broadcastLocation(p.coords.latitude, p.coords.longitude),
              (err) => setGpsError('Error en señal GPS: ' + err.message),
              { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
            );
            gpsWatchIdRef.current = watchId;
            setIsGpsActive(true);
          },
          (err) => setGpsError('No se pudo obtener ubicación: ' + err.message),
          { enableHighAccuracy: true, timeout: 10000 }
        );
      } else {
        setGpsError('Geolocalización no soportada en este dispositivo.');
      }
    } catch (err) {
      setGpsError('Permiso de GPS denegado o error de hardware: ' + err.message);
    }
  };

  useEffect(() => {
    return () => {
      if (gpsWatchIdRef.current !== null) {
        try {
          if (typeof Geolocation !== 'undefined' && Geolocation.clearWatch) {
            Geolocation.clearWatch({ id: gpsWatchIdRef.current });
          } else if (navigator.geolocation) {
            navigator.geolocation.clearWatch(gpsWatchIdRef.current);
          }
        } catch {
          // cleanup
        }
      }
    };
  }, []);

  const handleStartDelivery = (order) => {
    if (onUpdateOrderStatus) {
      onUpdateOrderStatus(order.id, 'En camino');
    }
    if (!isGpsActive) {
      handleToggleGps();
    }
    showAlert?.('¡En camino!', `Pedido #${order.id} despachado. Tu GPS se ha activado para el cliente.`, 'success');
  };

  const handleCompleteDelivery = (order) => {
    const isCash = String(order.customer?.paymentMethod || '').toLowerCase().includes('efectivo');
    const confirmMsg = isCash
      ? `¿Confirmas que entregaste el pedido #${order.id} y cobraste S/. ${Number(order.grandTotal || 0).toFixed(2)} en efectivo?`
      : `¿Confirmas que entregaste el pedido #${order.id} al cliente?`;

    if (window.confirm(confirmMsg)) {
      if (onUpdateOrderStatus) {
        onUpdateOrderStatus(order.id, 'Entregado');
      }
      showAlert?.('¡Entrega completada!', `Pedido #${order.id} marcado como Entregado.`, 'success');
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

          {/* BOTÓN GPS COMPARTIDO */}
          <button
            type="button"
            onClick={handleToggleGps}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 16px',
              borderRadius: '9999px',
              fontSize: '0.85rem',
              fontWeight: 700,
              cursor: 'pointer',
              border: 'none',
              background: isGpsActive ? '#10b981' : 'rgba(255,255,255,0.15)',
              color: '#fff',
              boxShadow: isGpsActive ? '0 0 15px rgba(16, 185, 129, 0.5)' : 'none',
              transition: 'all 0.2s ease'
            }}
          >
            <span style={{ fontSize: '1.1rem' }}>{isGpsActive ? '🟢' : '📡'}</span>
            <span>{isGpsActive ? 'GPS Activo (Transmitiendo)' : 'Activar GPS de Ruta'}</span>
          </button>
        </div>

        {gpsError && (
          <div style={{ marginTop: '10px', fontSize: '0.8rem', color: '#fca5a5', background: 'rgba(239, 68, 68, 0.2)', padding: '6px 12px', borderRadius: '6px' }}>
            ⚠️ {gpsError}
          </div>
        )}

        {isGpsActive && lastCoords && (
          <div style={{ marginTop: '10px', fontSize: '0.78rem', color: '#6ee7b7', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>📍 Últimas coordenadas: {lastCoords.lat.toFixed(5)}, {lastCoords.lng.toFixed(5)} ({lastCoords.time.toLocaleTimeString()})</span>
          </div>
        )}
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
              const isCash = String(customer.paymentMethod || '').toLowerCase().includes('efectivo');
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

                  {/* Indicador de Pago */}
                  <div style={{
                    padding: '8px 12px',
                    borderRadius: '6px',
                    marginBottom: '12px',
                    background: isCash ? '#fef3c7' : '#dbeafe',
                    color: isCash ? '#b45309' : '#1e40af',
                    fontWeight: 700,
                    fontSize: '0.88rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <span>{isCash ? '💵 Cobrar en Efectivo:' : '✅ Pagado digitalmente:'}</span>
                    <span style={{ fontSize: '1.05rem', fontWeight: 800 }}>S/. {Number(order.grandTotal || 0).toFixed(2)}</span>
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
                        ✅ Confirmar Entrega al Cliente
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
                      {isCash ? '💵 Efectivo Cobrado' : '📱 Pago Digital'}
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
