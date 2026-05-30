import React, { useState, useEffect } from 'react';

export default function OrderTracker({ orderId, orders, setView, storePhone }) {
  const [inputVal, setInputVal] = useState('');
  const [activeSearchId, setActiveSearchId] = useState(orderId || '');
  const [hasSearched, setHasSearched] = useState(false);

  // Sincronizar si cambia el orderId del padre (ej. al terminar una compra)
  useEffect(() => {
    if (orderId) {
      setActiveSearchId(orderId);
      setInputVal(orderId);
    }
  }, [orderId]);

  // Buscar el pedido actual (insensible a mayúsculas)
  const currentOrder = orders.find(
    o => o.id.toLowerCase() === activeSearchId.trim().toLowerCase()
  );

  const getStatusNumber = (status) => {
    switch (status) {
      case 'Pendiente': return 1;
      case 'Preparando': return 2;
      case 'En camino': return 3;
      case 'Entregado': return 4;
      default: return 0;
    }
  };

  const getProgressWidth = (status) => {
    switch (status) {
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
    if (status === 'En camino') return '🛵 En Camino';
    if (status === 'Preparando') return '👨‍🍳 Preparando';
    if (status === 'Entregado') return '🎉 Entregado';
    if (status === 'Pendiente') return '⏳ Pendiente';
    if (status === 'Cancelado') return '🛑 Cancelado';
    return status;
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setActiveSearchId(inputVal);
    setHasSearched(true);
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
              placeholder="Ej: helado-17800"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              style={{ textTransform: 'lowercase', padding: '12px', fontSize: '1rem' }}
              required
            />
          </div>

          {hasSearched && (
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

          <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '12px', fontSize: '0.95rem' }}>
            Buscar Pedido
          </button>
        </form>

        <div style={{ marginTop: '25px', borderTop: '1px solid var(--border-color)', paddingTop: '15px', textAlign: 'center' }}>
          <button className="btn btn-secondary" style={{ width: '100%' }} onClick={() => setView('shop')}>
            🍨 Volver a la Tienda
          </button>
        </div>
      </div>
    );
  }

  // Render del estado de seguimiento de un pedido ENCONTRADO
  const statusNum = getStatusNumber(currentOrder.status);

  return (
    <div className="glass tracking-container" style={{ padding: '25px 20px', maxWidth: '650px', margin: '30px auto', borderRadius: 'var(--radius-lg)' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px', marginBottom: '15px' }}>
        <div>
          <h2 style={{ fontSize: '1.6rem', margin: 0 }}>Seguimiento de Pedido</h2>
          <p style={{ color: 'var(--text-light)', fontSize: '0.85rem', marginTop: '4px' }}>
            Código: <strong style={{ color: 'var(--primary-color)' }}>{currentOrder.id}</strong>
          </p>
        </div>
        <button 
          className="btn btn-secondary" 
          style={{ padding: '6px 12px', fontSize: '0.75rem' }} 
          onClick={() => {
            setActiveSearchId('');
            setInputVal('');
            setHasSearched(false);
          }}
        >
          🔍 Buscar Otro
        </button>
      </div>

      {/* Tarjeta de Estado Actual */}
      <div className={`tracking-status-badge status-${currentOrder.status.toLowerCase().replace(' ', '_')}`} style={{
        textAlign: 'center',
        padding: '10px 15px',
        fontWeight: 'bold',
        borderRadius: '8px',
        fontSize: '1.1rem',
        marginBottom: '25px'
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

      {/* Mensaje Informativo */}
      <p style={{ fontSize: '0.85rem', color: 'var(--text-light)', textAlign: 'center', marginBottom: '25px', lineHeight: '1.4' }}>
        {currentOrder.status === 'Pendiente' && "Estamos validando tu pedido. En breve coordinaremos la entrega."}
        {currentOrder.status === 'Preparando' && "¡Nuestros maestros heladeros están sirviendo tu combinación favorita!"}
        {currentOrder.status === 'En camino' && "¡El motorizado va en ruta rápida hacia tu dirección!"}
        {currentOrder.status === 'Entregado' && "¡Helados recibidos! Esperamos que disfrutes de tu deliciosa experiencia."}
      </p>

      {/* Resumen del Pedido */}
      <div style={{ textAlign: 'left', borderTop: '1px solid var(--border-color)', paddingTop: '20px', marginBottom: '25px' }}>
        <h4 style={{ marginBottom: '12px', fontSize: '1rem', fontWeight: 'bold' }}>Datos de la Entrega</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', fontSize: '0.8rem', color: 'var(--text-light)' }}>
          <div>
            <strong>Cliente:</strong> <span style={{ color: 'var(--text-dark)' }}>{currentOrder.customer.name}</span>
          </div>
          <div>
            <strong>Dirección:</strong> <span style={{ color: 'var(--text-dark)' }}>{currentOrder.customer.address}</span>
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
          
          <div style={{ borderTop: '1px solid var(--border-color)', marginTop: '12px', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 700 }}>
            <span>Total Pagado:</span>
            <span style={{ color: 'var(--primary-color)', fontSize: '1rem' }}>
              S/. {currentOrder.grandTotal.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

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
