import { useState } from 'react';
import { generateOrderId } from '../../utils/orderId';
import { INITIAL_POPSICLES } from '../../utils/mockData';

export default function OrderTaker({ catalog, onPlaceOrder, showAlert }) {
  const { bases = [], flavors = [], toppings = [], packs = [], popsicles = [], literConfig = {} } = catalog || {};
  const [cart, setCart] = useState([]);
  const [customerName, setCustomerName] = useState('');
  const [orderType, setOrderType] = useState('Barra');
  const [activeIceCream, setActiveIceCream] = useState(null);
  const [activeQuantity, setActiveQuantity] = useState(1);
  const [isSavingOrder, setIsSavingOrder] = useState(false);

  // Paletas disponibles (catálogo o mock inicial si viene vacío)
  const allPopsicles = (popsicles && popsicles.length > 0)
    ? popsicles.filter(p => p.active !== false)
    : INITIAL_POPSICLES;

  // Toppings disponibles
  const allToppings = (toppings && toppings.length > 0)
    ? toppings.filter(t => t.active !== false)
    : [
        { id: 'topping_fudge', name: 'Fudge de Chocolate', price: 1.5 },
        { id: 'topping_oreo', name: 'Galleta Oreo', price: 1.5 },
        { id: 'topping_mani', name: 'Maní Tostado', price: 1.0 },
        { id: 'topping_chispas', name: 'Chispas de Colores', price: 1.0 }
      ];

  const handleSelectBase = (base) => {
    setActiveIceCream({
      type: 'custom',
      base: base,
      scoops: [],
      toppings: [],
      overridePrice: ''
    });
    setActiveQuantity(1);
  };

  const handleSelectFlavor = (flavor) => {
    if (!activeIceCream) {
      if (showAlert) showAlert('Atención', 'Primero selecciona un envase (Cono, Vaso, etc.) para empezar a armar el helado.', 'warning');
      return;
    }
    setActiveIceCream(prev => ({
      ...prev,
      scoops: [...prev.scoops, flavor]
    }));
  };

  const handleSelectTopping = (topping) => {
    if (!activeIceCream) {
      if (showAlert) showAlert('Atención', 'Primero selecciona un envase (Cono, Vaso, etc.) para empezar a armar el helado.', 'warning');
      return;
    }
    setActiveIceCream(prev => ({
      ...prev,
      toppings: [...prev.toppings, topping]
    }));
  };

  const calculateActivePrice = () => {
    if (!activeIceCream) return 0;
    if (activeIceCream.overridePrice !== '' && !isNaN(activeIceCream.overridePrice)) {
      return Number(activeIceCream.overridePrice);
    }
    const basePrice = Number(activeIceCream.base?.price || 0);
    const scoopsPrice = activeIceCream.scoops.reduce((sum, f) => sum + Number(f.price || 0), 0);
    const toppingsPrice = activeIceCream.toppings.reduce((sum, t) => sum + Number(t.price || 0), 0);
    return basePrice + scoopsPrice + toppingsPrice;
  };

  const handleAddActiveToCart = () => {
    if (!activeIceCream || activeIceCream.scoops.length === 0) {
      if (showAlert) showAlert('Atención', 'Agrega al menos un sabor al envase antes de añadirlo a la cuenta.', 'warning');
      return;
    }
    
    const price = calculateActivePrice();
    const name = `Helado en ${activeIceCream.base.name} - ${activeIceCream.scoops.length} bola(s)`;
    const qty = Math.max(1, activeQuantity || 1);
    
    setCart(prev => [...prev, { ...activeIceCream, price, name, quantity: qty }]);
    setActiveIceCream(null);
    setActiveQuantity(1);
    if (showAlert) showAlert('Añadido', `${qty > 1 ? `${qty}x ` : ''}Helado añadido a la cuenta.`, 'success');
  };

  const handleAddDirectItem = (item, qty = 1) => {
    setCart(prev => {
      const existingIdx = prev.findIndex(i => i.id === item.id && i.type === item.type && i.name === item.name);
      if (existingIdx >= 0) {
        return prev.map((it, idx) => idx === existingIdx ? { ...it, quantity: (it.quantity || 1) + qty } : it);
      }
      return [...prev, { ...item, quantity: qty }];
    });
    if (showAlert) showAlert('Añadido', `${qty > 1 ? `${qty}x ` : ''}${item.name} añadido a la cuenta.`, 'success');
  };

  const handleUpdateItemQuantity = (index, delta) => {
    setCart(prev => prev.map((item, i) => {
      if (i === index) {
        const newQty = (item.quantity || 1) + delta;
        return newQty > 0 ? { ...item, quantity: newQty } : null;
      }
      return item;
    }).filter(Boolean));
  };

  const handleEditItemPrice = (index, newPrice) => {
    setCart(prev => prev.map((item, i) => i === index ? { ...item, price: newPrice } : item));
  };

  const calculateTotal = () => {
    return cart.reduce((sum, item) => sum + (Number(item.price || 0) * (item.quantity || 1)), 0).toFixed(2);
  };

  const handleRemoveItem = (index) => {
    setCart(prev => prev.filter((_, i) => i !== index));
  };

  const handleCreateOrder = async () => {
    if (isSavingOrder) return;
    if (cart.length === 0) {
      if (showAlert) showAlert('Error', 'El pedido está vacío.', 'error');
      return;
    }
    
    const computedTotal = Number(calculateTotal());
    if (computedTotal === 0) {
      if (!window.confirm('⚠️ El monto total de este pedido es S/. 0.00. ¿Estás seguro de registrarlo como un pedido gratuito o de cortesía?')) {
        return;
      }
    }

    const orderId = generateOrderId();
    const now = new Date().toISOString();
    const isMesa = orderType === 'Mesa';
    const parsedTable = isMesa ? (customerName.match(/\d{1,3}/)?.[0] || '1') : undefined;
    const isCourtesy = computedTotal === 0;
    const newOrder = {
      id: orderId,
      customer: {
        name: customerName.trim() || (isMesa ? `Mesa ${parsedTable}` : 'Cliente en Barra'),
        phone: 'Operador',
        address: isMesa ? `Mesa ${parsedTable}` : 'Atención en Barra',
        orderType: orderType,
        tableNumber: parsedTable,
        paymentMethod: isCourtesy ? 'Cortesía/Gratis' : 'Efectivo',
        paymentTiming: isCourtesy ? 'Anticipado' : 'Al llegar'
      },
      items: cart,
      total: computedTotal,
      deliveryFee: 0,
      grandTotal: computedTotal,
      status: 'Pendiente',
      paymentVerified: isCourtesy,
      tablePaid: false,
      revision: 1,
      date: now,
      updatedAt: now,
      statusHistory: [
        { status: 'Pendiente', timestamp: now }
      ],
      paymentMethod: isCourtesy ? 'Cortesía/Gratis' : 'Efectivo',
      orderType: orderType,
      isOperator: true
    };

    setIsSavingOrder(true);
    try {
      await onPlaceOrder(newOrder);
      if (showAlert) showAlert('Éxito', 'Pedido registrado correctamente. Código: ' + orderId, 'success');
      setCart([]);
      setActiveIceCream(null);
      setActiveQuantity(1);
      setCustomerName('');
    } catch (error) {
      if (showAlert) showAlert('No se confirmó el pedido', error.message || 'Revisa la conexión e intenta nuevamente.', 'warning');
    } finally {
      setIsSavingOrder(false);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto', display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
      {/* Columna Izquierda: Punto de Venta */}
      <div style={{ flex: '1 1 350px', background: 'var(--bg-secondary)', borderRadius: '12px', padding: '20px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
        <h2 style={{ fontSize: '1.2rem', marginBottom: '15px' }}>🛒 Punto de Venta</h2>
        <div className="form-group">
          <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Tipo de Atención</label>
          <select className="form-control" value={orderType} onChange={(e) => setOrderType(e.target.value)}>
            <option value="Barra">Atención en Barra / Tienda</option>
            <option value="Mesa">Atención en Mesa</option>
          </select>
        </div>
        <div className="form-group">
          <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Nombre del Cliente o N° Mesa</label>
          <input type="text" className="form-control" placeholder="Ej: Carlos o Mesa 4" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
        </div>

        {/* Builder Activo */}
        <div style={{ 
          marginTop: '12px', 
          padding: '14px', 
          background: 'var(--bg-primary, #ffffff)', 
          borderRadius: '10px', 
          border: activeIceCream ? '2px solid var(--primary-color)' : '1px dashed var(--border-color)' 
        }}>
          <h3 style={{ fontSize: '0.95rem', marginBottom: '8px', color: 'var(--primary-color)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            🛠️ Armando Helado Actual
          </h3>
          {!activeIceCream ? (
            <p style={{ fontSize: '0.83rem', color: 'var(--text-light)', margin: 0, lineHeight: 1.4 }}>
              Selecciona un envase (Cono, Copa, Vaso) a la derecha para empezar a armar.
            </p>
          ) : (
            <div>
              <p style={{ margin: '0 0 5px 0', fontSize: '0.88rem', fontWeight: 700 }}>
                Envase: {activeIceCream.base.name}
              </p>
              <ul style={{ paddingLeft: '18px', margin: '0 0 10px 0', fontSize: '0.82rem', color: 'var(--text-dark)' }}>
                {activeIceCream.scoops.map((f, i) => (
                  <li key={i}>Sabor: <strong>{f.name}</strong> (+S/. {Number(f.price || 0).toFixed(2)})</li>
                ))}
                {activeIceCream.toppings.map((t, i) => (
                  <li key={i}>Topping: <strong>{t.name}</strong> (+S/. {Number(t.price || 0).toFixed(2)})</li>
                ))}
              </ul>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.82rem' }}>S/.</span>
                  <input 
                    type="number" 
                    step="0.10" 
                    min="0"
                    style={{ width: '65px', padding: '4px 6px', fontSize: '0.85rem' }} 
                    className="form-control"
                    placeholder={calculateActivePrice().toFixed(2)}
                    value={activeIceCream.overridePrice !== undefined ? activeIceCream.overridePrice : ''}
                    onChange={(e) => setActiveIceCream(prev => ({ ...prev, overridePrice: e.target.value }))}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', border: '1px solid var(--border-color)', borderRadius: '6px', background: 'var(--bg-secondary)' }}>
                    <button
                      type="button"
                      onClick={() => setActiveQuantity(q => Math.max(1, q - 1))}
                      style={{ border: 'none', background: 'transparent', padding: '3px 8px', cursor: 'pointer', fontWeight: 800, color: 'var(--text-dark)' }}
                      title="Menos conos"
                    >
                      -
                    </button>
                    <span style={{ padding: '0 6px', fontWeight: 800, fontSize: '0.85rem' }}>{activeQuantity}</span>
                    <button
                      type="button"
                      onClick={() => setActiveQuantity(q => q + 1)}
                      style={{ border: 'none', background: 'transparent', padding: '3px 8px', cursor: 'pointer', fontWeight: 800, color: 'var(--primary-color)' }}
                      title="Más conos iguales"
                    >
                      +
                    </button>
                  </div>
                  <button 
                    className="btn btn-primary" 
                    style={{ padding: '6px 12px', fontSize: '0.82rem', fontWeight: 700 }} 
                    onClick={handleAddActiveToCart}
                  >
                    Añadir {activeQuantity > 1 ? `(${activeQuantity})` : ''}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Cuenta Final */}
        <div style={{ marginTop: '16px', flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
            <h3 style={{ fontSize: '0.98rem', margin: 0, fontWeight: 700 }}>Ticket de Cuenta</h3>
            {cart.length > 0 && (
              <button 
                type="button" 
                onClick={() => setCart([])} 
                style={{ background: 'none', border: 'none', color: 'var(--danger)', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600 }}
              >
                Limpiar todo
              </button>
            )}
          </div>

          {cart.length === 0 ? (
            <p style={{ fontSize: '0.83rem', color: 'var(--text-light)', marginTop: '12px' }}>
              No hay productos agregados a la comanda.
            </p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: '10px 0', fontSize: '0.85rem', maxHeight: '280px', overflowY: 'auto' }}>
              {cart.map((item, idx) => (
                <li key={idx} style={{ display: 'flex', flexDirection: 'column', padding: '8px 0', borderBottom: '1px dashed var(--border-color)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1 }}>
                      {/* Multiplicador rápido de cantidades */}
                      <div style={{ display: 'inline-flex', alignItems: 'center', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
                        <button
                          type="button"
                          onClick={() => handleUpdateItemQuantity(idx, -1)}
                          style={{ border: 'none', background: 'transparent', padding: '2px 6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}
                          title="Restar 1"
                        >
                          -
                        </button>
                        <span style={{ padding: '0 4px', fontWeight: 800, fontSize: '0.82rem' }}>{item.quantity || 1}</span>
                        <button
                          type="button"
                          onClick={() => handleUpdateItemQuantity(idx, 1)}
                          style={{ border: 'none', background: 'transparent', padding: '2px 6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem', color: 'var(--primary-color)' }}
                          title="Sumar 1 (Multiplicar)"
                        >
                          +
                        </button>
                      </div>
                      <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{item.name}</span>
                    </div>

                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>S/.</span>
                      <input 
                        type="number"
                        step="0.10"
                        min="0"
                        className="form-control"
                        style={{ width: '60px', padding: '2px 4px', fontSize: '0.82rem', height: 'auto' }}
                        value={item.price}
                        onChange={(e) => handleEditItemPrice(idx, e.target.value)}
                      />
                      <button 
                        onClick={() => handleRemoveItem(idx)} 
                        style={{ background: 'none', border: 'none', color: '#e74c3c', cursor: 'pointer', padding: '0 4px', fontSize: '1.1rem', fontWeight: 'bold' }}
                        title="Eliminar producto"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                  {item.type === 'custom' && (
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-light)', marginTop: '3px', paddingLeft: '8px' }}>
                      {item.scoops?.map(s => s.name).join(', ')} 
                      {item.toppings?.length > 0 ? ` + ${item.toppings.map(t => t.name).join(', ')}` : ''}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
          
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'auto', fontSize: '1.2rem', fontWeight: 800, paddingTop: '12px', borderTop: '2px solid var(--border-color)' }}>
            <span>TOTAL:</span>
            <span style={{ color: 'var(--primary-color)' }}>S/. {calculateTotal()}</span>
          </div>
          <button 
            className="btn btn-primary" 
            style={{ width: '100%', marginTop: '12px', padding: '12px', fontSize: '0.95rem', fontWeight: 700 }} 
            onClick={handleCreateOrder} 
            disabled={cart.length === 0 || isSavingOrder}
          >
            {isSavingOrder ? 'Guardando pedido…' : '✅ Confirmar y Registrar Pedido'}
          </button>
        </div>
      </div>

      {/* Columna Derecha: Catálogo Organizado */}
      <div style={{ flex: '2 1 500px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
        
        {/* BASES */}
        <div>
          <h2 style={{ fontSize: '1.05rem', marginBottom: '8px', color: 'var(--primary-color)', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px', fontWeight: 700 }}>
            1. Selecciona Envase (Inicia un Helado)
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '8px' }}>
            {bases.filter(b => b.active !== false).map(b => (
              <button 
                key={b.id} 
                style={{ 
                  padding: '9px 6px', 
                  background: activeIceCream?.base?.id === b.id ? 'var(--primary-color)' : 'var(--bg-primary, #ffffff)', 
                  color: activeIceCream?.base?.id === b.id ? '#fff' : 'inherit', 
                  border: '1px solid var(--border-color)', 
                  borderRadius: '8px', 
                  cursor: 'pointer', 
                  textAlign: 'center', 
                  transition: 'all 0.15s' 
                }} 
                onClick={() => handleSelectBase(b)}
              >
                <span style={{ fontSize: '1.4rem', display: 'block', marginBottom: '3px' }}>
                  {b.name.toLowerCase().includes('cono') ? '🍦' : '🍧'}
                </span>
                <span style={{ display: 'block', fontWeight: 600, fontSize: '0.78rem', marginBottom: '3px' }}>{b.name}</span>
                <span style={{ fontSize: '0.74rem', opacity: 0.9 }}>S/. {Number(b.price || 0).toFixed(2)}</span>
              </button>
            ))}
          </div>
        </div>

        {/* SABORES */}
        <div style={{ opacity: activeIceCream ? 1 : 0.5, transition: 'opacity 0.2s' }}>
          <h2 style={{ fontSize: '1.05rem', marginBottom: '8px', color: 'var(--primary-color)', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px', fontWeight: 700 }}>
            2. Agrega Sabores
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '8px' }}>
            {flavors.filter(f => f.active !== false).map(f => (
              <button 
                key={f.id} 
                style={{ 
                  padding: '8px 6px', 
                  background: 'var(--bg-primary, #ffffff)', 
                  border: '1px solid var(--border-color)', 
                  borderRadius: '8px', 
                  cursor: activeIceCream ? 'pointer' : 'not-allowed', 
                  textAlign: 'center' 
                }} 
                onClick={() => handleSelectFlavor(f)} 
                disabled={!activeIceCream}
              >
                <span style={{ display: 'block', fontWeight: 600, fontSize: '0.78rem', marginBottom: '2px' }}>{f.name}</span>
                <span style={{ color: 'var(--primary-color)', fontSize: '0.74rem', fontWeight: 600 }}>+ S/. {Number(f.price || 0).toFixed(2)}</span>
              </button>
            ))}
          </div>
        </div>

        {/* TOPPINGS PARA EL CONO */}
        <div style={{ opacity: activeIceCream ? 1 : 0.5, transition: 'opacity 0.2s' }}>
          <h2 style={{ fontSize: '1.05rem', marginBottom: '8px', color: 'var(--primary-color)', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px', fontWeight: 700 }}>
            3. Agrega Toppings al Helado
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '8px' }}>
            {allToppings.map(t => (
              <button 
                key={t.id} 
                style={{ 
                  padding: '8px 6px', 
                  background: 'var(--bg-primary, #ffffff)', 
                  border: '1px solid var(--border-color)', 
                  borderRadius: '8px', 
                  cursor: activeIceCream ? 'pointer' : 'not-allowed', 
                  textAlign: 'center' 
                }} 
                onClick={() => handleSelectTopping(t)} 
                disabled={!activeIceCream}
              >
                <span style={{ display: 'block', fontWeight: 600, fontSize: '0.78rem', marginBottom: '2px' }}>{t.name}</span>
                <span style={{ color: 'var(--primary-color)', fontSize: '0.74rem', fontWeight: 600 }}>+ S/. {Number(t.price || 0).toFixed(2)}</span>
              </button>
            ))}
          </div>
        </div>

        {/* EXTRAS DIRECTOS Y VENTA RÁPIDA */}
        <div style={{ background: 'rgba(0,0,0,0.02)', padding: '14px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
          <h2 style={{ fontSize: '1.1rem', marginBottom: '12px', color: 'var(--primary-color)', borderBottom: '2px solid var(--border-color)', paddingBottom: '6px', fontWeight: 800 }}>
            ⚡ Extras Directos (Se añaden directo a la cuenta con 1 toque)
          </h2>

          {/* Venta Rápida de Conos y Copas */}
          <div style={{ marginBottom: '14px' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-dark)', display: 'block', marginBottom: '6px' }}>
              🍦 Venta Rápida de Conos Express
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '8px' }}>
              <button
                type="button"
                style={{ padding: '9px 8px', background: '#fff7ed', border: '1px solid #fdba74', borderRadius: '8px', cursor: 'pointer', textAlign: 'center' }}
                onClick={() => handleAddDirectItem({ id: 'quick_cono_1', type: 'quick_ice', name: 'Cono Simple (1 Bola)', price: 5.0 })}
              >
                <span style={{ display: 'block', fontWeight: 700, fontSize: '0.84rem' }}>🍦 Cono 1 Bola</span>
                <span style={{ color: '#ea580c', fontSize: '0.8rem', fontWeight: 'bold' }}>S/. 5.00</span>
              </button>
              <button
                type="button"
                style={{ padding: '9px 8px', background: '#fff7ed', border: '1px solid #fdba74', borderRadius: '8px', cursor: 'pointer', textAlign: 'center' }}
                onClick={() => handleAddDirectItem({ id: 'quick_cono_2', type: 'quick_ice', name: 'Cono Doble (2 Bolas)', price: 8.0 })}
              >
                <span style={{ display: 'block', fontWeight: 700, fontSize: '0.84rem' }}>🍦🍦 Cono 2 Bolas</span>
                <span style={{ color: '#ea580c', fontSize: '0.8rem', fontWeight: 'bold' }}>S/. 8.00</span>
              </button>
              <button
                type="button"
                style={{ padding: '9px 8px', background: '#fdf4ff', border: '1px solid #f0abfc', borderRadius: '8px', cursor: 'pointer', textAlign: 'center' }}
                onClick={() => handleAddDirectItem({ id: 'quick_copa_3', type: 'quick_ice', name: 'Copa Artesanal (3 Bolas)', price: 12.0 })}
              >
                <span style={{ display: 'block', fontWeight: 700, fontSize: '0.84rem' }}>🍨 Copa 3 Bolas</span>
                <span style={{ color: '#c026d3', fontSize: '0.8rem', fontWeight: 'bold' }}>S/. 12.00</span>
              </button>
            </div>
          </div>

          {/* Paletas Artesanales */}
          <div style={{ marginBottom: '14px' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-dark)', display: 'block', marginBottom: '6px' }}>
              🍭 Paletas Artesanales (Directas a la cuenta)
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '8px' }}>
              {allPopsicles.map(p => (
                <button
                  key={p.id}
                  type="button"
                  style={{ padding: '9px 8px', background: '#eff6ff', border: '1px solid #93c5fd', borderRadius: '8px', cursor: 'pointer', textAlign: 'center' }}
                  onClick={() => handleAddDirectItem({ id: p.id, type: 'popsicle', name: 'Paleta: ' + p.name, price: Number(p.price || 3.0) })}
                >
                  <span style={{ display: 'block', fontWeight: 700, fontSize: '0.84rem', marginBottom: '3px' }}>🍭 {p.name}</span>
                  <span style={{ color: '#2563eb', fontSize: '0.8rem', fontWeight: 'bold' }}>S/. {Number(p.price || 3.0).toFixed(2)}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Helado 1 Litro y Packs */}
          <div style={{ marginBottom: '14px' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-dark)', display: 'block', marginBottom: '6px' }}>
              🍨 Helados de Litro y Packs Familiares
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '8px' }}>
              {literConfig?.active !== false && (
                <button
                  type="button"
                  style={{ padding: '9px 8px', background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '8px', cursor: 'pointer', textAlign: 'center' }}
                  onClick={() => handleAddDirectItem({ id: 'liter', type: 'liter', name: 'Helado 1 Litro Familiar', price: Number(literConfig?.price || 15.0) })}
                >
                  <span style={{ display: 'block', fontWeight: 700, fontSize: '0.84rem', marginBottom: '3px' }}>🍨 Litro Familiar</span>
                  <span style={{ color: '#d97706', fontSize: '0.8rem', fontWeight: 'bold' }}>S/. {Number(literConfig?.price || 15.0).toFixed(2)}</span>
                </button>
              )}
              {packs.filter(p => p.active !== false).map(p => (
                <button
                  key={p.id}
                  type="button"
                  style={{ padding: '9px 8px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '8px', cursor: 'pointer', textAlign: 'center' }}
                  onClick={() => handleAddDirectItem({ id: p.id, type: 'pack', name: 'Pack: ' + p.name, price: Number(p.price) })}
                >
                  <span style={{ display: 'block', fontWeight: 700, fontSize: '0.84rem', marginBottom: '3px' }}>🎁 {p.name}</span>
                  <span style={{ color: '#16a34a', fontSize: '0.8rem', fontWeight: 'bold' }}>S/. {Number(p.price).toFixed(2)}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Toppings y Salsas Sueltos */}
          <div>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-dark)', display: 'block', marginBottom: '6px' }}>
              ✨ Toppings y Salsas Directas
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '8px' }}>
              {allToppings.map(t => (
                <button
                  key={t.id}
                  type="button"
                  style={{ padding: '7px 8px', background: 'var(--bg-primary, #ffffff)', border: '1px solid var(--border-color)', borderRadius: '8px', cursor: 'pointer', textAlign: 'center' }}
                  onClick={() => handleAddDirectItem({ id: t.id, type: 'topping_direct', name: 'Extra: ' + t.name, price: Number(t.price || 1.0) })}
                >
                  <span style={{ display: 'block', fontWeight: 600, fontSize: '0.78rem' }}>{t.name}</span>
                  <span style={{ color: 'var(--primary-color)', fontSize: '0.74rem', fontWeight: 'bold' }}>+ S/. {Number(t.price || 1.0).toFixed(2)}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
