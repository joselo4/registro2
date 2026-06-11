import React, { useState, useEffect, useRef } from 'react';
import { updateSyncedData } from '../utils/supabaseSync';

export default function OrderTracker({ orderId, orders, setView, storePhone, onClearActiveOrder }) {
  const TRACKING_WINDOW_HOURS = 72;
  const showDetailedTracker = true;
  const [inputVal, setInputVal] = useState('');
  const [activeSearchId, setActiveSearchId] = useState(orderId || '');
  const [searchNonce, setSearchNonce] = useState(0);
  const [hasSearched, setHasSearched] = useState(false);
  const [recentOrders, setRecentOrders] = useState([]);
  const [prevStatus, setPrevStatus] = useState(null);
  const [animateStatus, setAnimateStatus] = useState(false);

  // --- NUEVOS ESTADOS PARA BÚSQUEDA EN LA NUBE ---
  const [fetchedOrder, setFetchedOrder] = useState(null);
  const [loadingOrder, setLoadingOrder] = useState(false);

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
      setSurveySubmitted(localStorage.getItem(`helados_survey_submitted_${orderIdUpper}`) === 'true');
      setRating(0);
      setComment('');
    }
  }, [activeSearchId]);

  const handleSendSurvey = async (e) => {
    e.preventDefault();
    if (rating === 0) {
      alert("Por favor, selecciona una calificación.");
      return;
    }

    setSubmittingSurvey(true);
    const orderIdUpper = activeSearchId.trim().toUpperCase();
    const currentOrderObj = fetchedOrder || orders.find(o => o.id.toLowerCase() === orderIdUpper.toLowerCase());
    
    // Guardar encuesta dentro del objeto de pedido en Supabase
    if (currentOrderObj) {
      try {
        const updatedOrder = {
          ...currentOrderObj,
          survey: {
            rating,
            comment: comment.trim(),
            date: new Date().toISOString()
          }
        };
        await updateSyncedData(`order_${orderIdUpper}`, updatedOrder);
        setFetchedOrder(updatedOrder);
      } catch (errSurvey) {
        console.warn("Fallo al guardar encuesta en el pedido:", errSurvey);
      }
    }

    const stars = '🍦'.repeat(rating);
    const textMsg = `🌟 *NUEVA VALORACIÓN DE CLIENTE* 🌟\n\n` +
      `*Pedido:* ${orderIdUpper}\n` +
      `*Calificación:* ${stars} (${rating}/5)\n` +
      `*Comentario:* ${comment.trim() || 'Sin comentarios'}\n\n` +
      `_Enviado desde la encuesta rápida post-entrega._`;

    try {
      const response = await fetch('/api/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: textMsg,
          parse_mode: 'Markdown',
          kind: 'survey'
        })
      });
      if (!response.ok) throw new Error("Error en notificación centralizada");

      localStorage.setItem(`helados_survey_submitted_${orderIdUpper}`, 'true');
      setSurveySubmitted(true);
    } catch (err) {
      console.warn("Fallo al enviar reseña a Telegram:", err.message);
      // Fallback: Aceptar el guardado local de todas formas ya que se subió a Supabase
      localStorage.setItem(`helados_survey_submitted_${orderIdUpper}`, 'true');
      setSurveySubmitted(true);
    } finally {
      setSubmittingSurvey(false);
    }
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
    } catch (e) {
      return '';
    }
  };

  // Cargar pedidos recientes
  useEffect(() => {
    const saved = localStorage.getItem('helados_recent_order_ids');
    if (saved) {
      setRecentOrders(JSON.parse(saved));
    }
  }, []);

  // Helper para guardar en el historial
  const saveToRecentOrders = (id) => {
    if (!id) return;
    const cleanId = id.trim();
    const saved = localStorage.getItem('helados_recent_order_ids');
    let list = saved ? JSON.parse(saved) : [];
    
    list = list.filter(item => item.toLowerCase() !== cleanId.toLowerCase());
    list.unshift(cleanId);
    
    const trimmedList = list.slice(0, 5);
    localStorage.setItem('helados_recent_order_ids', JSON.stringify(trimmedList));
    setRecentOrders(trimmedList);
  };

  const isOrderExpired = (order) => {
    if (!order?.date) return false;
    const orderDate = new Date(order.date);
    if (Number.isNaN(orderDate.getTime())) return false;
    return (Date.now() - orderDate.getTime()) > TRACKING_WINDOW_HOURS * 60 * 60 * 1000;
  };

  const localOrder = orders.find(
    o => o.id.toLowerCase() === activeSearchId.trim().toLowerCase()
  );
  const getOrderFreshness = (order) => {
    if (!order) return 0;
    const history = Array.isArray(order.statusHistory) ? order.statusHistory : [];
    const lastHistory = history[history.length - 1]?.timestamp;
    const sourceDate = order.updatedAt || lastHistory || order.date;
    const time = new Date(sourceDate || 0).getTime();
    return Number.isNaN(time) ? 0 : time;
  };
  const currentOrder = getOrderFreshness(localOrder) > getOrderFreshness(fetchedOrder) ? localOrder : (fetchedOrder || localOrder);

  // Efecto para buscar pedido en Supabase de forma segura e independiente (por privacidad de egress)
  useEffect(() => {
    if (!activeSearchId) return;

    const searchUpper = activeSearchId.trim().toUpperCase();
    const local = orders.find(o => o.id.toUpperCase() === searchUpper);
    setFetchedOrder(local || null);

    let cancelled = false;
    const failSafeTimer = setTimeout(() => {
      if (!cancelled) setLoadingOrder(false);
    }, 12000);

    const fetchFromSupabase = async () => {
      setLoadingOrder(true);
      try {
        const response = await fetch(`/api/order?id=${encodeURIComponent(searchUpper)}`);
        const payload = await response.json().catch(() => ({}));

        if (cancelled) return;

        if (response.ok && payload.order) {
          setFetchedOrder(payload.order);
          saveToRecentOrders(searchUpper);
        }
      } catch (err) {
        if (!cancelled) {
          console.warn("Error fetching order from cloud tracker:", err);
        }
      } finally {
        if (!cancelled) {
          setLoadingOrder(false);
        }
      }
    };

    fetchFromSupabase();

    // Suscribirse únicamente al canal en tiempo real de este pedido específico (cero filtración de datos)
    const refreshTimer = setInterval(fetchFromSupabase, 5000);

    return () => {
      cancelled = true;
      clearTimeout(failSafeTimer);
      clearInterval(refreshTimer);
    };
  }, [activeSearchId, searchNonce, orders]);

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
        } catch (e) {
          console.warn("Autoplay block prevents tracker sound.");
        }

        return () => clearTimeout(timer);
      }
      setPrevStatus(currentOrder.status);
    }
  }, [currentOrder?.status, prevStatus]);


  const getStatusNumber = (status) => {
    switch (status) {
      case 'Por Corroborar': return 0.5;
      case 'Pendiente': return 1;
      case 'Preparando': return 2;
      case 'En camino': return 3;
      case 'Entregado': return 4;
      default: return 0;
    }
  };

  const getProgressWidth = (status) => {
    switch (status) {
      case 'Por Corroborar': return '0%';
      case 'Pendiente': return '0%';
      case 'Preparando': return '33.33%';
      case 'En camino': return '66.66%';
      case 'Entregado': return '100%';
      default: return '0%';
    }
  };

  const renderItemDetails = (item) => {
    if (item.type === 'custom') {
      const scoopsText = item.scoops.map(s => s.name).join(', ');
      const toppingsText = item.toppings.map(t => t.name).join(', ');
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

  const formatStatusText = (status) => {
    if (status === 'Por Corroborar') return '⏳ Por Corroborar';
    if (status === 'En camino') return '🛵 En Camino';
    if (status === 'Preparando') return '👨‍🍳 Preparando';
    if (status === 'Entregado') return '🎉 Entregado';
    if (status === 'Pendiente') return '⏳ Pendiente';
    if (status === 'Cancelado') return '🛑 Cancelado';
    return status;
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const cleanId = inputVal.trim();
    if (!cleanId) return;
    setLoadingOrder(false);
    setActiveSearchId(cleanId);
    setHasSearched(true);
    setSearchNonce((value) => value + 1);
  };

  const cleanPhone = String(storePhone || '').replace(/\D/g, '');

  // Render del buscador si no se ha seleccionado o encontrado un pedido válido
  if (!currentOrder) {
    return (
      <div className="glass" style={{ padding: '30px 20px', maxWidth: '500px', margin: '40px auto', borderRadius: 'var(--radius-lg)' }}>
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <span style={{ fontSize: '3rem' }}>🔍</span>
          <h2 style={{ marginTop: '10px', fontSize: '1.5rem' }}>Rastrear mi Pedido</h2>
          <p style={{ color: 'var(--text-light)', fontSize: '0.85rem', marginTop: '5px' }}>
            Ingresa el código único de tu compra para ver su estado actual de preparación y envío.
          </p>
        </div>

        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div className="form-group">
            <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Código de Pedido</label>
            <input
              type="text"
              className="form-control"
              placeholder="Ej: PED-ABC123"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              style={{ textTransform: 'lowercase', padding: '12px', fontSize: '1rem' }}
              required
            />
          </div>

          {loadingOrder && (
            <div style={{ textAlign: 'center', fontSize: '0.85rem', color: 'var(--primary-color)', fontWeight: 'bold' }}>
              ⏳ Buscando en la nube...
            </div>
          )}

          {hasSearched && !loadingOrder && !currentOrder && (
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
              ⚠️ Código de pedido no encontrado. Verifica e inténtalo de nuevo.
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
                const statusTag = matched ? ` (${formatStatusText(matched.status)})` : '';
                return (
                  <button
                    key={id}
                    onClick={() => {
                      setActiveSearchId(id);
                      setInputVal(id);
                      setHasSearched(false);
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
              const waUrl = `https://wa.me/${String(storePhone || '51987654321').replace(/\D/g, '')}?text=${encodeURIComponent('¡Hola! Tengo una consulta sobre el estado de un pedido 🍦')}`;
              window.open(waUrl, '_blank');
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
  }

  // Render del estado de seguimiento de un pedido ENCONTRADO
  const orderDate = currentOrder.date ? new Date(currentOrder.date) : null;
  const now = new Date();
  const diffHours = (orderDate && !isNaN(orderDate.getTime())) ? (now - orderDate) / (1000 * 60 * 60) : 0;
  const isExpired = diffHours > 72;

  if (isExpired) {
    return (
      <div className="glass tracking-container" style={{ padding: '30px 20px', maxWidth: '500px', margin: '40px auto', borderRadius: 'var(--radius-lg)', textAlign: 'center' }}>
        <span style={{ fontSize: '3rem' }}>🛑</span>
        <h2 style={{ marginTop: '10px', fontSize: '1.5rem', color: 'var(--danger)' }}>Seguimiento Expirado</h2>
        <p style={{ color: 'var(--text-light)', fontSize: '0.9rem', marginTop: '10px', lineHeight: '1.5' }}>
          El código de seguimiento para el pedido <strong>{currentOrder.id}</strong> ha expirado (límite de 72 horas).
        </p>
        <p style={{ color: 'var(--text-light)', fontSize: '0.85rem', marginTop: '5px' }}>
          Si tienes alguna consulta sobre tu pedido, por favor ponte en contacto con nuestro soporte de WhatsApp.
        </p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '20px', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" style={{ flex: '1 1 140px' }} onClick={() => setView('shop')}>
            🍨 Volver a la Tienda
          </button>
          <a 
            href={`https://wa.me/${String(storePhone || '').replace(/\D/g, '')}?text=Hola,%20tengo%20una%20duda%20sobre%20mi%20pedido%20${currentOrder.id}`} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="btn btn-primary"
            style={{ background: '#25D366', borderColor: '#25D366', color: 'white', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', flex: '1 1 140px' }}
          >
            💬 WhatsApp Soporte
          </a>
        </div>
      </div>
    );
  }

  const statusNum = getStatusNumber(currentOrder.status);

  return (
    <div className="glass tracking-container" style={{ padding: '25px 20px', maxWidth: '650px', margin: '30px auto', borderRadius: 'var(--radius-lg)' }}>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes pulse-highlight {
          0% { transform: scale(1); }
          50% { transform: scale(1.04); box-shadow: 0 0 15px rgba(46, 204, 113, 0.4); }
          100% { transform: scale(1); }
        }
        .animate-status-pop {
          animation: pulse-highlight 1.1s ease-in-out 2;
          border: 2px solid var(--success) !important;
        }
      ` }} />
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px', marginBottom: '15px' }}>
        <div>
          <h2 style={{ fontSize: '1.6rem', margin: 0 }}>Seguimiento de Pedido</h2>
          <p style={{ color: 'var(--text-light)', fontSize: '0.85rem', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            Código: <strong style={{ color: 'var(--primary-color)' }}>{currentOrder.id}</strong>
            {currentOrder.customer.tableNumber && (
              <span style={{
                background: 'var(--primary-color)',
                color: 'white',
                fontSize: '0.7rem',
                fontWeight: 'bold',
                padding: '2px 8px',
                borderRadius: '12px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}>
                Mesa {currentOrder.customer.tableNumber}
              </span>
            )}
          </p>
        </div>
        <button 
          className="btn btn-secondary" 
          style={{ padding: '6px 12px', fontSize: '0.75rem' }} 
          onClick={() => {
            setActiveSearchId('');
            setFetchedOrder(null);
            setInputVal('');
            setHasSearched(false);
            if (onClearActiveOrder) {
              onClearActiveOrder();
            }
          }}
        >
          🔍 Buscar Otro
        </button>
      </div>

      {/* Tarjeta de Estado Actual */}
      <div className={`tracking-status-badge status-${currentOrder.status.toLowerCase().replace(' ', '_')} ${animateStatus ? 'animate-status-pop' : ''}`} style={{
        textAlign: 'center',
        padding: '10px 15px',
        fontWeight: 'bold',
        borderRadius: '8px',
        fontSize: '1.1rem',
        marginBottom: '25px',
        transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
      }}>
        {formatStatusText(currentOrder.status)}
      </div>

      {/* Línea de Tiempo del Pedido */}
      {currentOrder.status !== 'Cancelado' ? (
        <div className="tracking-timeline" style={{ marginBottom: '25px' }}>
          <div 
            className="timeline-progress" 
            style={{ width: getProgressWidth(currentOrder.status) }}
          ></div>
          
          <div className={`timeline-step ${statusNum >= 1 ? 'completed' : ''} ${statusNum === 1 ? 'active' : ''}`}>
            <div className="step-node">📝</div>
            <span className="step-label" style={{ fontSize: '0.75rem' }}>Recibido</span>
          </div>

          <div className={`timeline-step ${statusNum >= 2 ? 'completed' : ''} ${statusNum === 2 ? 'active' : ''}`}>
            <div className="step-node">👨‍🍳</div>
            <span className="step-label" style={{ fontSize: '0.75rem' }}>Preparando</span>
          </div>

          <div className={`timeline-step ${statusNum >= 3 ? 'completed' : ''} ${statusNum === 3 ? 'active' : ''}`}>
            <div className="step-node">🛵</div>
            <span className="step-label" style={{ fontSize: '0.75rem' }}>En camino</span>
          </div>

          <div className={`timeline-step ${statusNum >= 4 ? 'completed' : ''} ${statusNum === 4 ? 'active' : ''}`}>
            <div className="step-node">🏠</div>
            <span className="step-label" style={{ fontSize: '0.75rem' }}>Entregado</span>
          </div>
        </div>
      ) : (
        <div className="glass" style={{ padding: '15px', color: 'var(--danger)', margin: '20px 0', border: '1px solid var(--danger)', borderRadius: '8px', textAlign: 'center', background: 'rgba(231,76,60,0.05)' }}>
          <strong>🛑 Este pedido ha sido cancelado por la administración.</strong>
        </div>
      )}

      {/* 🍦 ENCUESTA DE SATISFACCIÓN POST-ENTREGA */}
      {currentOrder && currentOrder.status === 'Entregado' && (
        <div className="glass animate-float-toast" style={{
          padding: '20px',
          margin: '20px 0 25px 0',
          border: '2px dashed var(--success)',
          borderRadius: 'var(--radius-md)',
          background: 'linear-gradient(135deg, rgba(46, 204, 113, 0.05) 0%, var(--bg-secondary) 100%)',
          textAlign: 'center',
          boxShadow: 'var(--shadow-md)'
        }}>
          {surveySubmitted ? (
            <div style={{ animation: 'scalePop 0.4s ease-out' }}>
              <span style={{ fontSize: '3rem', display: 'block', marginBottom: '8px' }}>🍦💖</span>
              <strong style={{ fontSize: '1.1rem', color: 'var(--success)', display: 'block' }}>¡Muchas Gracias!</strong>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-light)', marginTop: '6px', margin: 0, lineHeight: 1.45 }}>
                Tu opinión nos alegra el día y nos ayuda a seguir sirviendo helados deliciosos con la mejor calidad artesana.
              </p>
            </div>
          ) : (
            <div>
              <strong style={{ fontSize: '1.05rem', color: 'var(--text-dark)', display: 'block', marginBottom: '5px' }}>
                ¿Disfrutaste tu Helado? 🍨
              </strong>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-light)', display: 'block', marginBottom: '12px' }}>
                Tu valoración nos ayuda a mejorar. Califícanos pulsando los conos de helado:
              </span>
              
              <form onSubmit={handleSendSurvey} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' }}>
                {/* Conos de Helado Interactivos */}
                <div style={{ display: 'flex', gap: '8px', fontSize: '2.2rem', justifyContent: 'center' }}>
                  {[1, 2, 3, 4, 5].map((index) => {
                    const filled = index <= (hoverRating || rating);
                    return (
                      <span
                        key={index}
                        style={{
                          cursor: 'pointer',
                          filter: filled ? 'none' : 'grayscale(100%) opacity(30%)',
                          transition: 'transform 0.15s cubic-bezier(0.175, 0.885, 0.32, 1.275), filter 0.2s',
                          transform: filled ? 'scale(1.18)' : 'scale(1)',
                          display: 'inline-block'
                        }}
                        onMouseEnter={() => setHoverRating(index)}
                        onMouseLeave={() => setHoverRating(0)}
                        onClick={() => setRating(index)}
                        title={`${index} cono${index > 1 ? 's' : ''}`}
                      >
                        🍦
                      </span>
                    );
                  })}
                </div>

                <div style={{ width: '100%' }}>
                  <textarea
                    className="form-control"
                    rows="2"
                    placeholder="Escribe algún comentario o sugerencia sobre tus helados (Opcional)..."
                    style={{
                      fontSize: '0.8rem',
                      padding: '8px 12px',
                      resize: 'none',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-color)',
                      width: '100%',
                      background: 'var(--bg-secondary)',
                      color: 'var(--text-dark)'
                    }}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                  />
                </div>

                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{
                    width: '100%',
                    padding: '10px',
                    fontSize: '0.85rem',
                    backgroundColor: 'var(--success)',
                    borderColor: 'var(--success)',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                    borderRadius: 'var(--radius-full)',
                    margin: 0
                  }}
                  disabled={submittingSurvey}
                >
                  {submittingSurvey ? 'Enviando...' : '🚀 Enviar Valoración'}
                </button>
              </form>
            </div>
          )}
        </div>
      )}

      {/* Historial de Cambios de Estado (Hora Peruana) */}
      {showDetailedTracker && (() => {
        // Obtener todos los eventos del historial ordenados cronológicamente
        const allHistory = currentOrder.statusHistory
          ? [...currentOrder.statusHistory].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
          : [{ status: 'Pendiente', timestamp: currentOrder.date }];

        // Calcular tiempo transcurrido entre eventos
        const getElapsed = (ts1, ts2) => {
          if (!ts1 || !ts2) return '';
          const diff = (new Date(ts2) - new Date(ts1)) / 60000;
          if (diff < 60) return `${Math.round(diff)} min`;
          const hours = Math.floor(diff / 60);
          const mins = Math.round(diff % 60);
          return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
        };

        const statusMeta = {
          'Por Corroborar': { emoji: '⏳', label: 'Esperando Confirmación de Mozo', color: '#e67e22', bg: 'rgba(230,126,34,0.10)' },
          'Pendiente':  { emoji: '⏳', label: 'Pedido Recibido',         color: '#f39c12', bg: 'rgba(243,156,18,0.10)' },
          'Preparando': { emoji: '👨‍🍳', label: 'En Cocina / Preparando', color: '#3498db', bg: 'rgba(52,152,219,0.10)' },
          'En camino':  { emoji: '🛵', label: 'En Ruta de Entrega',      color: '#9b59b6', bg: 'rgba(155,89,182,0.10)' },
          'Entregado':  { emoji: '🎉', label: 'Entregado al Cliente',    color: '#2ecc71', bg: 'rgba(46,204,113,0.10)' },
          'Cancelado':  { emoji: '🛑', label: 'Pedido Cancelado',        color: '#e74c3c', bg: 'rgba(231,76,60,0.10)' }
        };

        return (
          <div className="glass" style={{ padding: '15px 18px', marginBottom: '25px', background: 'rgba(0,0,0,0.01)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
            <h4 style={{ fontSize: '0.95rem', marginBottom: '15px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-dark)' }}>
              📋 Historial Detallado del Pedido
              <span style={{ fontSize: '0.7rem', color: 'var(--text-light)', fontWeight: 'normal', marginLeft: 'auto' }}>
                🇵🇪 Hora Perú (Lima)
              </span>
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0', position: 'relative', paddingLeft: '18px' }}>
              {/* Línea vertical conectora */}
              <div style={{ position: 'absolute', left: '8px', top: '10px', bottom: '10px', width: '2px', background: 'linear-gradient(180deg, var(--primary-color), var(--border-color))' }}></div>

              {allHistory.map((event, idx) => {
                const meta = statusMeta[event.status] || { emoji: '📌', label: event.status, color: 'var(--text-light)', bg: 'transparent' };
                const isLast = idx === allHistory.length - 1;
                const isCurrent = event.status === currentOrder.status;
                const nextEvent = allHistory[idx + 1];
                const elapsed = nextEvent ? getElapsed(event.timestamp, nextEvent.timestamp) : '';
                const formattedTime = formatPeruTime(event.timestamp);

                return (
                  <div key={idx} style={{ display: 'flex', flexDirection: 'column', position: 'relative', paddingBottom: isLast ? '0' : '14px' }}>
                    {/* Bullet circular */}
                    <div style={{
                      position: 'absolute',
                      left: '-14px',
                      top: '3px',
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      backgroundColor: isCurrent ? meta.color : '#2ecc71',
                      border: `2px solid var(--bg-primary)`,
                      boxShadow: isCurrent ? `0 0 12px ${meta.color}90` : 'none',
                      zIndex: 1,
                      animation: isCurrent ? 'trackerPulse 2s infinite' : 'none',
                      flexShrink: 0
                    }}></div>

                    {/* Tarjeta de evento */}
                    <div style={{
                      background: isCurrent ? meta.bg : 'transparent',
                      border: isCurrent ? `1px solid ${meta.color}40` : 'none',
                      borderRadius: '8px',
                      padding: isCurrent ? '8px 10px' : '2px 8px',
                      transition: 'all 0.3s ease'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                        <span style={{
                          fontSize: '0.82rem',
                          fontWeight: isCurrent ? '700' : '600',
                          color: isCurrent ? meta.color : 'var(--text-dark)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px'
                        }}>
                          <span style={{ fontSize: '1rem' }}>{meta.emoji}</span>
                          {meta.label}
                          {isCurrent && <span style={{ fontSize: '0.6rem', background: meta.color, color: 'white', padding: '1px 5px', borderRadius: '4px', fontWeight: 'bold' }}>ACTUAL</span>}
                        </span>
                        <span style={{
                          fontSize: '0.72rem',
                          color: isCurrent ? meta.color : 'var(--text-light)',
                          fontWeight: isCurrent ? '700' : '500',
                          fontFamily: 'monospace',
                          background: isCurrent ? `${meta.color}15` : 'var(--bg-secondary)',
                          padding: '2px 7px',
                          borderRadius: '5px',
                          letterSpacing: '0.02em'
                        }}>
                          {formattedTime}
                        </span>
                      </div>
                      {elapsed && (
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-light)', marginTop: '3px', paddingLeft: '22px', fontStyle: 'italic' }}>
                          ↳ Tiempo hasta siguiente estado: <strong>{elapsed}</strong>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Mostrar estados pendientes como grises */}
              {currentOrder.status !== 'Cancelado' && currentOrder.status !== 'Entregado' && (() => {
                const completedStatuses = allHistory.map(h => h.status);
                const pendingStatuses = ['Pendiente', 'Preparando', 'En camino', 'Entregado'].filter(s => !completedStatuses.includes(s));
                return pendingStatuses.map((s, idx) => {
                  const meta = statusMeta[s];
                  return (
                    <div key={`pending-${idx}`} style={{ display: 'flex', flexDirection: 'column', position: 'relative', paddingBottom: idx < pendingStatuses.length - 1 ? '14px' : '0' }}>
                      <div style={{
                        position: 'absolute',
                        left: '-14px',
                        top: '3px',
                        width: '12px',
                        height: '12px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--border-color)',
                        border: '2px solid var(--bg-primary)',
                        zIndex: 1
                      }}></div>
                      <div style={{ padding: '2px 8px' }}>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-light)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <span style={{ opacity: 0.4 }}>{meta?.emoji}</span>
                          <span style={{ opacity: 0.5 }}>{meta?.label}</span>
                          <span style={{ fontSize: '0.65rem', fontStyle: 'italic', opacity: 0.4 }}>— Pendiente</span>
                        </span>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
            <style dangerouslySetInnerHTML={{ __html: `
              @keyframes trackerPulse {
                0%, 100% { box-shadow: 0 0 8px rgba(0,0,0,0.2); transform: scale(1); }
                50% { box-shadow: 0 0 16px rgba(0,0,0,0.35); transform: scale(1.15); }
              }
            ` }} />
          </div>
        );
      })()}

      {/* Mensaje Informativo */}
      {showDetailedTracker && (
        <p style={{ fontSize: '0.85rem', color: 'var(--text-light)', textAlign: 'center', marginBottom: '25px', lineHeight: '1.4' }}>
        {currentOrder.status === 'Por Corroborar' && "El mesero está corroborando tu pedido. En breve se enviará a preparación."}
        {currentOrder.status === 'Pendiente' && "Estamos validando tu pedido. En breve coordinaremos la entrega."}
        {currentOrder.status === 'Preparando' && "¡Nuestros maestros heladeros están sirviendo tu combinación favorita!"}
        {currentOrder.status === 'En camino' && "¡El motorizado va en ruta rápida hacia tu dirección!"}
        {currentOrder.status === 'Entregado' && "¡Helados recibidos! Esperamos que disfrutes de tu deliciosa experiencia."}
        </p>
      )}

      {/* Resumen del Pedido */}
      {showDetailedTracker && (
      <div style={{ textAlign: 'left', borderTop: '1px solid var(--border-color)', paddingTop: '20px', marginBottom: '25px' }}>
        <h4 style={{ marginBottom: '12px', fontSize: '1rem', fontWeight: 'bold' }}>Datos de la Entrega</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', fontSize: '0.8rem', color: 'var(--text-light)' }}>
          <div>
            <strong>Cliente:</strong> <span style={{ color: 'var(--text-dark)' }}>{currentOrder.customer.name}</span>
          </div>
          <div>
            {currentOrder.customer.tableNumber ? (
              <>
                <strong>Mesa:</strong> <span style={{ color: 'var(--text-dark)' }}>{currentOrder.customer.tableNumber}</span>
              </>
            ) : (
              <>
                <strong>Dirección:</strong> <span style={{ color: 'var(--text-dark)' }}>{currentOrder.customer.address}</span>
              </>
            )}
          </div>
          <div>
            <strong>WhatsApp:</strong> <span style={{ color: 'var(--text-dark)' }}>{currentOrder.customer.phone}</span>
          </div>
          <div>
            <strong>Método de Pago:</strong> <span style={{ color: 'var(--text-dark)' }}>{currentOrder.customer.paymentMethod}</span>
          </div>
        </div>

        <div style={{ marginTop: '20px', background: 'rgba(0,0,0,0.02)', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
          <h5 style={{ marginBottom: '8px', fontSize: '0.85rem', fontWeight: 'bold' }}>Detalle de Compra</h5>
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px', padding: 0, margin: 0 }}>
            {currentOrder.items.map((item, idx) => (
              <li key={idx} style={{ fontSize: '0.8rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: idx < currentOrder.items.length - 1 ? '1px dashed var(--border-color)' : 'none', paddingBottom: '6px' }}>
                <div>
                  <strong>{item.quantity}x {item.name}</strong>
                  {renderItemDetails(item)}
                </div>
                <span style={{ fontWeight: 600, marginLeft: '10px' }}>S/. {(item.price * item.quantity).toFixed(2)}</span>
              </li>
            ))}
          </ul>
          
          <div style={{ borderTop: '1px dashed var(--border-color)', marginTop: '12px', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.8rem', color: 'var(--text-light)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Subtotal:</span>
              <span style={{ color: 'var(--text-dark)', fontWeight: '500' }}>S/. {(currentOrder.total || 0).toFixed(2)}</span>
            </div>
            {currentOrder.discount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--success)', fontWeight: '600' }}>
                <span>Descuento {currentOrder.couponCode ? `(${currentOrder.couponCode})` : ''}:</span>
                <span>- S/. {(currentOrder.discount || 0).toFixed(2)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Costo de Envío:</span>
              <span style={{ color: 'var(--text-dark)', fontWeight: '500' }}>
                {(currentOrder.deliveryFee || 0) === 0 ? <strong style={{ color: 'var(--success)' }}>GRATIS</strong> : `S/. ${(currentOrder.deliveryFee || 0).toFixed(2)}`}
              </span>
            </div>
          </div>
          
          <div style={{ borderTop: '1px solid var(--border-color)', marginTop: '8px', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 700 }}>
            <span>Total Pagado:</span>
            <span style={{ color: 'var(--primary-color)', fontSize: '1rem' }}>
              S/. {currentOrder.grandTotal.toFixed(2)}
            </span>
          </div>
        </div>
      </div>
      )}

      <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
        <button className="btn btn-secondary" style={{ flex: '1 1 150px' }} onClick={() => setView('shop')}>
          🍨 Volver a la Tienda
        </button>
        <a 
          href={`https://wa.me/${cleanPhone}?text=Hola,%20quisiera%20saber%20el%20estado%20de%20mi%20pedido%20${currentOrder.id}`} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="btn btn-primary"
          style={{ background: '#25D366', borderColor: '#25D366', color: 'white', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', flex: '1 1 150px' }}
        >
          💬 WhatsApp Soporte
        </a>
      </div>
    </div>
  );
}
