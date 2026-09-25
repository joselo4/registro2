import { useState, useEffect, useRef } from 'react';
import { readOrder, requestOrder } from '../utils/apiClient';
import { mergeOrders, isDeliveryOrder, orderStatusLabel, paymentDescription, requiresAdvancePayment, trackingExpired } from '../utils/orderLifecycle';
import { sanitizeText, safeStorage } from '../utils/security';
import { buildWhatsAppHref } from '../utils/orderMessaging';
import { checkoutStorage } from '../utils/checkout';
import { normalizeOrderCode } from '../utils/orderId';
import './tracker.css';



export default function OrderTracker({ orderId, orders, setView, storePhone, onClearActiveOrder }) {
  const [inputVal, setInputVal] = useState(orderId || '');
  const [activeSearchId, setActiveSearchId] = useState(orderId || '');
  const [searchNonce, setSearchNonce] = useState(0);
  const [hasSearched, setHasSearched] = useState(false);
  const [recentOrders, setRecentOrders] = useState([]);
  const [prevStatus, setPrevStatus] = useState(null);
  const [animateStatus, setAnimateStatus] = useState(false);

  // --- NUEVOS ESTADOS PARA BÚSQUEDA EN LA NUBE ---
  const [fetchedOrder, setFetchedOrder] = useState(null);
  const [loadingOrder, setLoadingOrder] = useState(false);
  const [trackingError, setTrackingError] = useState('');

  // Sincronizar reactivamente si cambia orderId desde la URL o el estado global
  useEffect(() => {
    if (orderId) {
      const clean = String(orderId).replace(/\s+/g, '').toUpperCase();
      setInputVal(clean);
      setActiveSearchId(clean);
      setHasSearched(true);
    } else {
      const saved = safeStorage.getItem('helados_active_order_id');
      if (saved && !activeSearchId) {
        const cleanSaved = String(saved).replace(/\s+/g, '').toUpperCase();
        setInputVal(cleanSaved);
        setActiveSearchId(cleanSaved);
        setHasSearched(true);
      }
    }
  }, [orderId, activeSearchId]);

  // --- ESTADOS Y LÓGICA PARA LA ENCUESTA DE SATISFACCIÓN ---
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submittingSurvey, setSubmittingSurvey] = useState(false);
  const [surveySubmitted, setSurveySubmitted] = useState(false);

  // Comprobar si la encuesta ya fue enviada para este pedido
  useEffect(() => {
    if (activeSearchId) {
      const orderIdUpper = activeSearchId.trim().toUpperCase();
      setSurveySubmitted(safeStorage.getItem(`helados_survey_submitted_${orderIdUpper}`) === 'true');
      setRating(0);
      setComment('');
    }
  }, [activeSearchId]);

  const handleSendSurvey = async e => {
    e.preventDefault();
    if (!rating || submittingSurvey) return;
    setSubmittingSurvey(true);
    const id = activeSearchId.trim().toUpperCase();
    const token = receiptTokenFor(id);
    if (!token) { setSubmittingSurvey(false); window.alert('Abre el enlace privado de tu pedido para enviar la encuesta.'); return; }
    try {
      const cleanComment = sanitizeText(comment, 500);
      const order = await requestOrder('/api/order', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, order: { submissionKey: token, survey: { rating, comment: cleanComment, date: new Date().toISOString() } } }) });
      setFetchedOrder(order);
      safeStorage.setItem(`helados_survey_submitted_${id}`, 'true');
      setSurveySubmitted(true);
    } catch (error) { window.alert(error.message || 'No se pudo guardar tu valoración. Inténtalo nuevamente.'); }
    finally { setSubmittingSurvey(false); }
  };

  const formatPeruTime = (isoString) => {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      const options = {
        timeZone: 'America/Lima',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      };
      return new Intl.DateTimeFormat('es-PE', options).format(date);
    } catch {
      return '';
    }
  };

  // Cargar pedidos recientes
  useEffect(() => {
    const parsed = safeStorage.getJSON('helados_recent_order_ids', []);
    if (Array.isArray(parsed)) setRecentOrders(parsed);
  }, []);

  // Helper para guardar en el historial
  const saveToRecentOrders = (id) => {
    if (!id) return;
    const cleanId = id.trim();
    const parsed = safeStorage.getJSON('helados_recent_order_ids', []);
    let list = Array.isArray(parsed) ? parsed : [];
    list = list.filter(item => typeof item === 'string' && item.toLowerCase() !== cleanId.toLowerCase());
    list.unshift(cleanId);
    const trimmedList = list.slice(0, 5);
    safeStorage.setJSON('helados_recent_order_ids', trimmedList);
    setRecentOrders(trimmedList);
  };

  const isOrderExpired = order => trackingExpired(order);

  const [copiedTrackingLink, setCopiedTrackingLink] = useState(false);
  const [copiedField, setCopiedField] = useState('');
  // Page text cannot be selected, so important data gets a copy button.
  const copyText = async (value, field) => {
    const text = String(value || '');
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      window.prompt('Copia este dato:', text);
      return;
    }
    setCopiedField(field);
    window.setTimeout(() => setCopiedField(current => (current === field ? '' : current)), 2200);
  };

  const computeEstimatedArrival = (order) => {
    if (!order?.date || ['Entregado', 'Cancelado'].includes(order.status)) return null;
    const orderTime = new Date(order.date).getTime();
    if (Number.isNaN(orderTime)) return null;

    const minEta = new Date(orderTime + 25 * 60 * 1000);
    const maxEta = new Date(orderTime + 40 * 60 * 1000);
    // A late order shows no stale arrival time.
    if (maxEta.getTime() < Date.now()) return null;

    const formatTime = (d) => {
      try {
        return new Intl.DateTimeFormat('es-PE', {
          timeZone: 'America/Lima',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        }).format(d);
      } catch {
        return '';
      }
    };

    return {
      rangeText: `${formatTime(minEta)} - ${formatTime(maxEta)}`,
      minutesEstimate: '25 - 40 min'
    };
  };

  const handleShareTrackingLink = () => {
    if (!currentOrder?.id) return;
    const token = receiptTokenFor(currentOrder.id);
    const url = `${window.location.origin}${window.location.pathname}?track=${encodeURIComponent(currentOrder.id)}${token ? `&token=${encodeURIComponent(token)}` : ''}`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url);
      setCopiedTrackingLink(true);
      setTimeout(() => setCopiedTrackingLink(false), 2500);
    } else {
      window.prompt('Copia este enlace para seguir tu pedido:', url);
    }
  };

  const normalizedSearchId = (activeSearchId || '').replace(/\s+/g, '').toUpperCase();
  const receiptTokenFor = id => {
    const params = new URLSearchParams(window.location.search);
    if (String(params.get('track') || '').toUpperCase() === id && params.get('token')) return params.get('token');
    return checkoutStorage.getItem(`helados_order_token_${id}`) || '';
  };
  const localMatch = orders?.find(o => String(o.id || '').replace(/\s+/g, '').toUpperCase() === normalizedSearchId);
  const currentOrder = (fetchedOrder && String(fetchedOrder.id || '').replace(/\s+/g, '').toUpperCase() === normalizedSearchId ? fetchedOrder : null) || localMatch || null;

  const ordersRef = useRef(orders);
  useEffect(() => {
    ordersRef.current = orders;
  }, [orders]);

  // A failed lookup is not evidence that an order does not exist.
  useEffect(() => {
    const id = (activeSearchId || '').replace(/\s+/g, '').toUpperCase();
    if (!id) { setLoadingOrder(false); return; }
    setFetchedOrder(null);
    setTrackingError('');
    let cancelled = false;
    let busy = false;
    const refresh = async (initial = false) => {
      if (busy) return;
      busy = true;
      if (initial) setLoadingOrder(true);
      try {
        const order = await readOrder(id, receiptTokenFor(id));
        if (cancelled) return;
        setFetchedOrder(prev => mergeOrders(String(prev?.id || '').replace(/\s+/g, '').toUpperCase() === id ? [prev] : [], [order])[0]);
        setTrackingError('');
        saveToRecentOrders(id);
      } catch (error) {
        if (!cancelled) {
          const localOrder = ordersRef.current?.find(o => String(o.id || '').replace(/\s+/g, '').toUpperCase() === id);
          if (localOrder) {
            setTrackingError('');
            // Si el pedido existe en local pero la API retornó 404, podría estar 'Por Corroborar'
          } else {
            if (error.status === 410) {
              setTrackingError(error.message || 'El seguimiento de este pedido ya terminó.');
            } else if (error.status === 404 || error.status === 400) {
              // Verificar si hay alguna orden local con ese código en estado 'Por Corroborar'
              setTrackingError(
                `No encontramos ningún pedido con ese código. Verifica el código en tu ticket o mensaje de confirmación.`
              );
            } else {
              setTrackingError('No pudimos actualizar el seguimiento. Revisa tu conexión; volveremos a intentarlo.');
            }
          }
        }
      } finally {
        busy = false;
        if (!cancelled) setLoadingOrder(false);
      }
    };
    refresh(true);
    const timer = setInterval(() => { if (!document.hidden) refresh(); }, 10000);
    const resume = () => { if (!document.hidden) refresh(); };
    window.addEventListener('online', resume);
    document.addEventListener('visibilitychange', resume);
    return () => { cancelled = true; clearInterval(timer); window.removeEventListener('online', resume); document.removeEventListener('visibilitychange', resume); };
  }, [activeSearchId, searchNonce]);

  // Efecto para animar y reproducir sonido cuando cambia el estado del pedido tracked
  useEffect(() => {
    if (currentOrder) {
      if (prevStatus && prevStatus !== currentOrder.status) {
        setAnimateStatus(true);
        const timer = setTimeout(() => setAnimateStatus(false), 2200);
        
        try {
          const AudioContext = window.AudioContext || window.webkitAudioContext;
          if (AudioContext) {
            const ctx = new AudioContext();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
            osc.frequency.exponentialRampToValueAtTime(880.00, ctx.currentTime + 0.15); // A5
            gain.gain.setValueAtTime(0.1, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.5);
          }
        } catch {
          console.warn("Autoplay block prevents tracker sound.");
        }

        return () => clearTimeout(timer);
      }
      setPrevStatus(currentOrder.status);
    }
  }, [currentOrder, prevStatus]);


  const renderItemDetails = (item) => {
    if (item.type === 'custom') {
      const scoopsText = item.scoops.map(s => typeof s === 'string' ? s : s.name).join(', ');
      const toppingsText = item.toppings.map(t => typeof t === 'string' ? t : t.name).join(', ');
      const syrupText = item.syrup ? item.syrup.name : '';
      
      return (
        <span style={{ fontSize: '0.8rem', color: 'var(--text-light)', display: 'block', marginTop: '2px' }}>
          Base: {item.base.name} | Sabores: {scoopsText}
          {toppingsText && ` | Toppings: ${toppingsText}`}
          {syrupText && ` | Salsa: ${syrupText}`}
        </span>
      );
    } else if (item.type === 'pack') {
      return (
        <span style={{ fontSize: '0.8rem', color: 'var(--text-light)', display: 'block', marginTop: '2px' }}>
          Pack: {item.items}
        </span>
      );
    }
    return null;
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const cleanId = normalizeOrderCode(inputVal);
    if (!cleanId) return;
    setLoadingOrder(false);
    setActiveSearchId(cleanId);
    setInputVal(cleanId);
    setHasSearched(true);
    setSearchNonce((value) => value + 1);
  };

  const renderSearchForm = (expiredOrder = null) => {
    return (
      <div className="glass" style={{ padding: '30px 20px', maxWidth: '500px', margin: '40px auto', borderRadius: 'var(--radius-lg)' }}>
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <span style={{ fontSize: '3rem' }}>{expiredOrder ? '🛑' : '🔍'}</span>
          <h2 style={{ marginTop: '10px', fontSize: '1.5rem', color: expiredOrder ? 'var(--danger)' : 'inherit' }}>
            {expiredOrder ? 'Seguimiento Expirado' : 'Rastrear mi Pedido'}
          </h2>
          <p style={{ color: 'var(--text-light)', fontSize: '0.85rem', marginTop: '5px', lineHeight: '1.4' }}>
            {expiredOrder 
              ? `El código de seguimiento ${expiredOrder.id} ha superado el límite de 72 horas. Puedes ingresar otro código a continuación o contactar a soporte.`
              : 'Ingresa el código único de tu compra para ver su estado actual de preparación y envío.'}
          </p>
        </div>

        {expiredOrder && (
          <div style={{ 
            marginBottom: '15px',
            background: 'rgba(231, 76, 60, 0.08)', 
            color: 'var(--danger)', 
            padding: '12px', 
            borderRadius: '12px', 
            fontSize: '0.82rem', 
            border: '1px solid rgba(231, 76, 60, 0.2)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            <span>¿Tienes alguna duda sobre tu entrega? Nuestro equipo puede ayudarte:</span>
            <a 
              href={buildWhatsAppHref(storePhone || '51987654321', `Hola, tengo una consulta sobre mi pedido ${expiredOrder.id}`)}
              target="_blank" 
              rel="noopener noreferrer" 
              className="btn btn-primary"
              style={{ background: '#25D366', borderColor: '#25D366', color: 'white', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '8px 12px', fontSize: '0.8rem', borderRadius: '8px' }}
            >
              💬 WhatsApp Soporte
            </a>
          </div>
        )}

        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div className="form-group">
            <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Código de Pedido</label>
            <input
              type="text"
              className="form-control"
              placeholder="Ej: KMR-482"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              style={{ textTransform: 'uppercase', padding: '12px', fontSize: '1rem', letterSpacing: '1px' }}
              required
            />
          </div>

          {loadingOrder && activeSearchId && (
            <div style={{ textAlign: 'center', fontSize: '0.85rem', color: 'var(--primary-color)', fontWeight: 'bold' }}>
              ⏳ Buscando en la nube...
            </div>
          )}

          {activeSearchId && !loadingOrder && !currentOrder && trackingError && (
            <div style={{ 
              background: 'rgba(231, 76, 60, 0.1)', 
              color: 'var(--danger)', 
              padding: '10px', 
              borderRadius: '6px', 
              fontSize: '0.8rem', 
              fontWeight: 600,
              textAlign: 'center',
              border: '1px solid rgba(231, 76, 60, 0.2)'
            }}>
              ⚠️ {trackingError}
            </div>
          )}

          <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '12px', fontSize: '0.95rem' }} disabled={loadingOrder}>
            Buscar Pedido
          </button>
        </form>

        {recentOrders && recentOrders.filter((id) => {
          const matched = orders.find(o => o.id.toLowerCase() === id.toLowerCase());
          return matched && !isOrderExpired(matched);
        }).length > 0 && (
          <div style={{ marginTop: '25px', borderTop: '1px solid var(--border-color)', paddingTop: '15px' }}>
            <h4 style={{ fontSize: '0.85rem', marginBottom: '10px', color: 'var(--text-dark)', fontWeight: 'bold' }}>🕰️ Mis Pedidos Recientes:</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {recentOrders.filter((id) => {
                const matched = orders.find(o => o.id.toLowerCase() === id.toLowerCase());
                return matched && !isOrderExpired(matched);
              }).map((id) => {
                const matched = orders.find(o => o.id.toLowerCase() === id.toLowerCase());
                const statusTag = matched ? ` (${orderStatusLabel(matched.status)})` : '';
                return (
                  <button
                    key={id}
                    onClick={() => {
                      setActiveSearchId(id);
                      setInputVal(id);
                      setHasSearched(true);
                      setSearchNonce((value) => value + 1);
                    }}
                    className="btn btn-secondary"
                    style={{
                      padding: '8px 15px',
                      fontSize: '0.8rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      width: '100%',
                      textAlign: 'left',
                      borderRadius: '12px',
                      borderColor: 'var(--border-color)'
                    }}
                  >
                    <span><strong>{id}</strong> <span style={{ color: 'var(--text-light)', marginLeft: '5px' }}>{statusTag}</span></span>
                    <span style={{ fontSize: '0.9rem' }}>👉</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div style={{ marginTop: '20px', borderTop: '1px solid var(--border-color)', paddingTop: '15px', display: 'flex', flexDirection: 'column', gap: '10px', textAlign: 'center' }}>
          <button className="btn btn-secondary" style={{ width: '100%' }} onClick={() => setView('shop')}>
            🍨 Volver a la Tienda
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            style={{
              backgroundColor: '#25D366',
              color: 'white',
              borderColor: '#25D366',
              width: '100%',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              cursor: 'pointer',
              margin: 0
            }}
            onClick={() => {
              const waUrl = buildWhatsAppHref(storePhone || '51987654321', '¡Hola! Tengo una consulta sobre el estado de un pedido 🍦');
              const waWindow = window.open(waUrl, '_blank', 'noopener,noreferrer');
              if (waWindow) waWindow.opener = null;
            }}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" style={{ verticalAlign: 'middle' }}>
              <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.59-4.846c1.66.986 3.284 1.447 4.74 1.448 5.4 0 9.792-4.393 9.795-9.79.002-2.615-1.012-5.074-2.855-6.918C16.483 2.05 14.032.99 11.417.99c-5.402 0-9.794 4.393-9.797 9.79-.001 1.733.456 3.238 1.411 4.887L2.03 20.485l4.616-1.331zM16.518 14.1c-.266-.134-1.577-.777-1.821-.866-.245-.09-.423-.134-.6.134-.178.266-.689.866-.844 1.04-.155.178-.312.2-.578.066-.266-.134-1.124-.414-2.141-1.32-.79-.705-1.326-1.577-1.482-1.844-.155-.266-.017-.41.117-.543.12-.12.266-.312.4-.467.135-.156.18-.266.27-.444.09-.178.045-.334-.022-.467-.067-.134-.6-1.446-.823-1.979-.217-.523-.454-.452-.6-.452h-.51c-.178 0-.467.067-.71.334-.244.267-.933.912-.933 2.224 0 1.312.955 2.58 1.088 2.757.135.178 1.88 2.87 4.554 4.024.637.275 1.13.438 1.517.56.64.204 1.22.175 1.68.107.513-.075 1.577-.644 1.8-.1.223-.545.223-1.013.156-1.1zm-.058-.058v.058-.058z"/>
            </svg>
            <span>Preguntar por WhatsApp</span>
          </button>
        </div>
      </div>
    );
  };

  const isExpired = currentOrder ? isOrderExpired(currentOrder) : false;

  // Render del buscador si no se ha encontrado pedido o si la orden automática expiró sin búsqueda manual
  if (!currentOrder || (isExpired && !hasSearched)) {
    return renderSearchForm(null);
  }

  // Si el usuario ingresó explícitamente un código que expiró
  if (isExpired && hasSearched) {
    return renderSearchForm(currentOrder);
  }


  // One status block, one step bar, one order summary: the same state used to
  // be repeated in four different boxes.
  const status = currentOrder.status || 'Pendiente';
  const orderType = currentOrder.customer?.orderType || 'Delivery';
  const isDelivery = isDeliveryOrder(currentOrder);
  const isPickup = orderType === 'Llevar' || orderType === 'Barra';
  const isTable = orderType === 'Mesa' || orderType === 'Mesa_Llevar';
  const stages = isDelivery ? ['Por Corroborar', 'Pendiente', 'Preparando', 'Listo', 'En camino', 'Entregado'] : ['Por Corroborar', 'Pendiente', 'Preparando', 'Listo', 'Entregado'];
  const stageLabels = { 'Por Corroborar': 'Recibido', Pendiente: 'Confirmado', Preparando: 'Preparando', Listo: 'Listo', 'En camino': 'En camino', Entregado: isDelivery ? 'Entregado' : isTable ? 'Servido' : 'Retirado' };
  const history = (currentOrder.statusHistory?.length ? [...currentOrder.statusHistory] : [{ status, timestamp: currentOrder.date }])
    .filter(event => event?.status)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  const reachedAt = Object.fromEntries(history.map(event => [event.status, event.timestamp]));
  const currentIndex = stages.indexOf(status);
  const shortTime = iso => {
    try { return new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit', hour12: true }).format(new Date(iso)); }
    catch { return ''; }
  };
  const hero = {
    'Por Corroborar': { icon: '⏳', tone: 'waiting', title: 'Recibimos tu pedido', text: isTable ? 'El personal está confirmando tu comanda. En breve pasa a cocina.' : requiresAdvancePayment(currentOrder) ? 'Estamos validando tu pago. En cuanto se confirme, empezamos a prepararlo.' : 'La tienda está confirmando los detalles. En breve empezamos a prepararlo.' },
    Pendiente: { icon: '📋', tone: 'active', title: '¡Pedido confirmado!', text: 'Está en cola de cocina. En unos minutos empezamos a prepararlo.' },
    Preparando: { icon: '👨‍🍳', tone: 'active', title: 'Preparando tus helados', text: 'Estamos sirviendo tu combinación con la textura ideal.' },
    Listo: { icon: '✅', tone: 'active', title: isTable ? '¡Listo! Va a tu mesa' : isPickup ? '¡Listo para recoger!' : '¡Listo y empacado!', text: isTable ? 'El personal lo lleva a tu mesa en instantes.' : isPickup ? 'Acércate a la barra para recogerlo.' : 'Esperando la salida del repartidor.' },
    'En camino': { icon: '🛵', tone: 'active', title: 'Tu pedido va en camino', text: 'El repartidor se dirige a tu dirección. ¡Prepárate para recibirlo!' },
    Entregado: { icon: '🎉', tone: 'done', title: isTable ? '¡Buen provecho!' : isPickup ? '¡Pedido retirado!' : '¡Pedido entregado!', text: 'Gracias por elegirnos. Esperamos que lo disfrutes.' },
    Cancelado: { icon: '🛑', tone: 'cancelled', title: 'Pedido cancelado', text: 'Si tienes dudas, escríbenos por WhatsApp y te ayudamos.' },
  }[status] || { icon: '📦', tone: 'active', title: orderStatusLabel(status), text: '' };
  const eta = isDelivery ? computeEstimatedArrival(currentOrder) : null;
  const money = value => `S/. ${(Number(value) || 0).toFixed(2)}`;
  const resetSearch = () => {
    setActiveSearchId('');
    setFetchedOrder(null);
    setInputVal('');
    setHasSearched(false);
    if (onClearActiveOrder) onClearActiveOrder();
  };
  const driverPhone = String(currentOrder.assignedDriver?.phone || '').replace(/\D/g, '');

  return (
    <div className="tracker">
      <header className="tracker-head">
        <div>
          <span className="tracker-eyebrow">SEGUIMIENTO</span>
          <h1>Pedido <span className="allow-select">{currentOrder.id}</span></h1>
          <button type="button" className="tracker-copy" onClick={() => copyText(currentOrder.id, 'code')}>{copiedField === 'code' ? '✓ Código copiado' : 'Copiar código'}</button>
          {currentOrder.customer?.tableNumber && <span className="tracker-chip">Mesa {currentOrder.customer.tableNumber}</span>}
        </div>
        <button type="button" className="tracker-link" onClick={resetSearch}>Buscar otro</button>
      </header>

      <section className={`tracker-hero tone-${hero.tone} ${animateStatus ? 'is-updated' : ''}`} aria-live="polite">
        <span className="tracker-hero-icon" aria-hidden="true">{hero.icon}</span>
        <div>
          <h2>{hero.title}</h2>
          {hero.text && <p>{hero.text}</p>}
          {eta && <p className="tracker-eta">Llegada estimada <strong>{eta.rangeText}</strong></p>}
        </div>
      </section>

      {currentOrder.limited && <p className="tracker-note" role="status">Para ver la dirección, el pago y los productos, abre el enlace privado que recibiste al hacer tu pedido.</p>}
      {trackingError && <p className="tracker-note is-warning" role="status">{trackingError} Mostramos el último estado confirmado.</p>}

      {status !== 'Cancelado' && (
        <ol className="tracker-steps" aria-label="Etapas del pedido" style={{ '--count': stages.length, '--progress-ratio': Math.max(0, currentIndex) / (stages.length - 1) }}>
          {stages.map((stage, index) => {
            const state = index < currentIndex ? 'done' : index === currentIndex ? 'current' : 'todo';
            return (
              <li key={stage} className={`is-${state}`} aria-current={state === 'current' ? 'step' : undefined}>
                <span className="tracker-dot" aria-hidden="true">{state === 'done' ? '✓' : index + 1}</span>
                <strong>{stageLabels[stage]}</strong>
                {reachedAt[stage] && state !== 'todo' && <small>{shortTime(reachedAt[stage])}</small>}
              </li>
            );
          })}
        </ol>
      )}

      {currentOrder.assignedDriver && (
        <section className="tracker-card tracker-driver">
          <span className="tracker-driver-icon" aria-hidden="true">🛵</span>
          <div>
            <strong>{currentOrder.assignedDriver.name || 'Tu repartidor'}</strong>
            <small>Lleva tu pedido</small>
          </div>
          {driverPhone && <div className="tracker-driver-actions">
            <a href={`tel:${driverPhone}`}>Llamar</a>
            <a href={`https://wa.me/${driverPhone.length === 9 ? `51${driverPhone}` : driverPhone}?text=${encodeURIComponent(`¡Hola! Te escribo sobre mi pedido #${currentOrder.id} 🍦`)}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>
          </div>}
        </section>
      )}

      {!currentOrder.limited && status === 'Entregado' && (
        <section className="tracker-card tracker-survey">
          {surveySubmitted ? (
            <p><strong>¡Muchas gracias!</strong> Tu opinión nos ayuda a servirte mejor.</p>
          ) : (
            <form onSubmit={handleSendSurvey}>
              <strong>¿Qué tal estuvo tu helado?</strong>
              <div className="tracker-rating" role="radiogroup" aria-label="Calificación">
                {[1, 2, 3, 4, 5].map(index => (
                  <button key={index} type="button" role="radio" aria-checked={rating === index} aria-label={`${index} de 5`}
                    className={index <= (hoverRating || rating) ? 'is-on' : ''}
                    onMouseEnter={() => setHoverRating(index)} onMouseLeave={() => setHoverRating(0)} onClick={() => setRating(index)}>🍦</button>
                ))}
              </div>
              <textarea className="form-control" rows="2" placeholder="Cuéntanos algo más (opcional)" value={comment} onChange={e => setComment(e.target.value)} />
              <button type="submit" className="btn btn-primary" disabled={submittingSurvey}>{submittingSurvey ? 'Enviando…' : 'Enviar calificación'}</button>
            </form>
          )}
        </section>
      )}

      {!currentOrder.limited && (
        <section className="tracker-card tracker-summary">
          <h3>Tu pedido</h3>
          <ul>
            {currentOrder.items.map((item, idx) => (
              <li key={idx}>
                <div><strong>{item.quantity}× {item.name}</strong>{renderItemDetails(item)}</div>
                <span>{money(item.price * item.quantity)}</span>
              </li>
            ))}
          </ul>
          <dl className="tracker-totals">
            <div><dt>Subtotal</dt><dd>{money(currentOrder.total)}</dd></div>
            {currentOrder.discount > 0 && <div className="is-discount"><dt>Descuento {currentOrder.couponCode ? `(${currentOrder.couponCode})` : ''}</dt><dd>- {money(currentOrder.discount)}</dd></div>}
            {isDelivery && <div><dt>Envío</dt><dd>{(currentOrder.deliveryFee || 0) === 0 ? <strong className="is-free">GRATIS</strong> : money(currentOrder.deliveryFee)}</dd></div>}
            <div className="is-total"><dt>Total</dt><dd>{money(currentOrder.grandTotal)}</dd></div>
          </dl>
          <dl className="tracker-details">
            <div><dt>{currentOrder.customer?.tableNumber ? 'Mesa' : isDelivery ? 'Entrega en' : 'Recojo'}</dt><dd>{currentOrder.customer?.tableNumber || currentOrder.customer?.address}</dd></div>
            <div><dt>Pago</dt><dd>{paymentDescription(currentOrder)} · {currentOrder.paymentVerified ? 'confirmado' : 'pendiente'}</dd></div>
            {currentOrder.customer?.operationCode && <div><dt>N° operación</dt><dd>{currentOrder.customer.operationCode}</dd></div>}
            <div><dt>A nombre de</dt><dd>{currentOrder.customer?.name} · {currentOrder.customer?.phone}</dd></div>
          </dl>
        </section>
      )}

      {history.length > 1 && (
        <details className="tracker-history">
          <summary>Ver historial con horas</summary>
          <ol>
            {history.map((event, idx) => (
              <li key={idx}><span>{stageLabels[event.status] || orderStatusLabel(event.status)}</span><time>{formatPeruTime(event.timestamp)}</time></li>
            ))}
          </ol>
        </details>
      )}

      <div className="tracker-actions">
        <a
          href={buildWhatsAppHref(storePhone || '51987654321', `¡Hola! Quisiera consultar mi pedido #${currentOrder.id} a nombre de ${currentOrder.customer?.name || 'Cliente'} 🍦`)}
          target="_blank"
          rel="noopener noreferrer"
          className="btn tracker-whatsapp"
        >
          💬 Consultar por WhatsApp
        </a>
        <button type="button" className="btn btn-secondary" onClick={handleShareTrackingLink}>
          {copiedTrackingLink ? '✅ Enlace copiado' : '🔗 Compartir seguimiento'}
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => setView('shop')}>
          🍨 Seguir comprando
        </button>
      </div>
    </div>
  );
}
