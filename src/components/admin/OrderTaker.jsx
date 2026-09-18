import React, { useState } from 'react';
import { generateOrderId } from '../../utils/orderId';

export default function OrderTaker({ catalog, onPlaceOrder, showAlert }) {
  const { bases = [], flavors = [], toppings = [], packs = [], popsicles = [], literConfig = {} } = catalog || {};
  const [cart, setCart] = useState([]);
  const [customerName, setCustomerName] = useState('');
  const [orderType, setOrderType] = useState('Barra');
  const [activeIceCream, setActiveIceCream] = useState(null);

  const handleSelectBase = (base) => {
    setActiveIceCream({
      type: 'custom',
      base: base,
      scoops: [],
      toppings: []
    });
  };

  const handleSelectFlavor = (flavor) => {
    if (!activeIceCream) {
      if (showAlert) showAlert('Atención', 'Primero selecciona un envase (Cono, Vaso, etc) para empezar a armar el helado.', 'warning');
      return;
    }
    setActiveIceCream(prev => ({
      ...prev,
      scoops: [...prev.scoops, flavor]
    }));
  };

  const handleSelectTopping = (topping) => {
    if (!activeIceCream) {
      if (showAlert) showAlert('Atención', 'Primero selecciona un envase (Cono, Vaso, etc) para empezar a armar el helado.', 'warning');
      return;
    }
    setActiveIceCream(prev => ({
      ...prev,
      toppings: [...prev.toppings, topping]
    }));
  };

  const calculateActivePrice = () => {
    if (!activeIceCream) return 0;
    const basePrice = Number(activeIceCream.base.price || 0);
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
    
    setCart(prev => [...prev, { ...activeIceCream, price, name, quantity: 1 }]);
    setActiveIceCream(null);
    if (showAlert) showAlert('Añadido', 'Helado añadido a la cuenta.', 'success');
  };

  const handleAddDirectItem = (item) => {
    setCart(prev => [...prev, { ...item, quantity: 1 }]);
    if (showAlert) showAlert('Añadido', item.name + ' añadido a la cuenta.', 'success');
  };

  const calculateTotal = () => {
    return cart.reduce((sum, item) => sum + (Number(item.price) * item.quantity), 0).toFixed(2);
  };

  const handleRemoveItem = (index) => {
    setCart(prev => prev.filter((_, i) => i !== index));
  };

  const handleCreateOrder = () => {
    if (cart.length === 0) {
      if (showAlert) showAlert('Error', 'El pedido está vacío.', 'error');
      return;
    }
    
    const orderId = generateOrderId();
    const newOrder = {
      id: orderId,
      customer: {
        name: customerName || (orderType === 'Barra' ? 'Cliente en Barra' : 'Mesa'),
        phone: 'Operador',
        address: orderType === 'Barra' ? 'Atención en Barra' : 'Atención en Mesa',
      },
      items: cart,
      total: Number(calculateTotal()),
      deliveryFee: 0,
      grandTotal: Number(calculateTotal()),
      status: 'Aceptado',
      date: new Date().toISOString(),
      paymentMethod: 'Efectivo',
      orderType: orderType,
      isOperator: true
    };

    onPlaceOrder(newOrder);
    if (showAlert) showAlert('Éxito', 'Pedido registrado correctamente. Código: ' + orderId, 'success');
    setCart([]);
    setActiveIceCream(null);
    setCustomerName('');
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
        <div style={{ marginTop: '15px', padding: '15px', background: 'var(--bg-primary)', borderRadius: '8px', border: activeIceCream ? '2px solid var(--primary-color)' : '1px dashed var(--border-color)' }}>
          <h3 style={{ fontSize: '0.95rem', marginBottom: '10px', color: 'var(--primary-color)' }}>🛠️ Armando Helado Actual</h3>
          {!activeIceCream ? (
            <p style={{ fontSize: '0.85rem', color: 'var(--text-light)', margin: 0 }}>Selecciona un envase a la derecha para empezar.</p>
          ) : (
            <div>
              <p style={{ margin: '0 0 5px 0', fontSize: '0.9rem', fontWeight: 'bold' }}>Envase: {activeIceCream.base.name}</p>
              <ul style={{ paddingLeft: '20px', margin: '0 0 10px 0', fontSize: '0.85rem' }}>
                {activeIceCream.scoops.map((f, i) => <li key={i}>Sabor: {f.name} (S/. {Number(f.price).toFixed(2)})</li>)}
                {activeIceCream.toppings.map((t, i) => <li key={i}>Topping: {t.name} (S/. {Number(t.price).toFixed(2)})</li>)}
              </ul>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 'bold' }}>Subtotal: S/. {calculateActivePrice().toFixed(2)}</span>
                <button className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={handleAddActiveToCart}>Añadir a la Cuenta</button>
              </div>
            </div>
          )}
        </div>

        {/* Cuenta Final */}
        <div style={{ marginTop: '20px', flex: 1 }}>
          <h3 style={{ fontSize: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>Cuenta Final</h3>
          {cart.length === 0 ? (
            <p style={{ fontSize: '0.85rem', color: 'var(--text-light)', marginTop: '10px' }}>No hay productos facturados.</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: '10px 0', fontSize: '0.85rem', maxHeight: '250px', overflowY: 'auto' }}>
              {cart.map((item, idx) => (
                <li key={idx} style={{ display: 'flex', flexDirection: 'column', padding: '8px 0', borderBottom: '1px dashed var(--border-color)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 'bold' }}>{item.quantity}x {item.name}</span>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <strong>S/. {(Number(item.price) * item.quantity).toFixed(2)}</strong>
                      <button onClick={() => handleRemoveItem(idx)} style={{ background: 'none', border: 'none', color: 'red', cursor: 'pointer', padding: 0, fontSize: '1rem' }}>×</button>
                    </div>
                  </div>
                  {item.type === 'custom' && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-light)', marginTop: '4px', paddingLeft: '10px' }}>
                      {item.scoops.map(s => s.name).join(', ')} 
                      {item.toppings.length > 0 ? ` + ${item.toppings.map(t => t.name).join(', ')}` : ''}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
          
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '15px', fontSize: '1.2rem', fontWeight: 'bold', paddingTop: '10px', borderTop: '2px solid var(--border-color)' }}>
            <span>TOTAL:</span>
            <span>S/. {calculateTotal()}</span>
          </div>
          <button className="btn btn-primary" style={{ width: '100%', marginTop: '15px', padding: '12px', fontSize: '1rem' }} onClick={handleCreateOrder} disabled={cart.length === 0}>
            ✅ Confirmar y Registrar Pedido
          </button>
        </div>
      </div>

      {/* Columna Derecha: Catálogo Organizado */}
      <div style={{ flex: '2 1 500px' }}>
        
        {/* BASES */}
        <div style={{ marginBottom: '20px' }}>
          <h2 style={{ fontSize: '1.1rem', marginBottom: '10px', color: 'var(--primary-color)', borderBottom: '1px solid var(--border-color)', paddingBottom: '5px' }}>1. Selecciona Envase (Inicia un Helado)</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '8px' }}>
            {bases.filter(b => b.active !== false).map(b => (
              <button key={b.id} style={{ padding: '10px', background: activeIceCream?.base?.id === b.id ? 'var(--primary-color)' : 'var(--bg-primary)', color: activeIceCream?.base?.id === b.id ? '#fff' : 'inherit', border: '1px solid var(--border-color)', borderRadius: '8px', cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s' }} onClick={() => handleSelectBase(b)}>
                <span style={{ fontSize: '1.5rem', display: 'block', marginBottom: '5px' }}>{b.name.toLowerCase().includes('cono') ? '🍦' : '🍧'}</span>
                <span style={{ display: 'block', fontWeight: 600, fontSize: '0.8rem', marginBottom: '5px' }}>{b.name}</span>
                <span style={{ fontSize: '0.75rem', opacity: 0.9 }}>S/. {Number(b.price || 0).toFixed(2)}</span>
              </button>
            ))}
          </div>
        </div>

        {/* SABORES */}
        <div style={{ marginBottom: '20px', opacity: activeIceCream ? 1 : 0.5, transition: 'opacity 0.2s' }}>
          <h2 style={{ fontSize: '1.1rem', marginBottom: '10px', color: 'var(--primary-color)', borderBottom: '1px solid var(--border-color)', paddingBottom: '5px' }}>2. Agrega Sabores</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '8px' }}>
            {flavors.filter(f => f.active !== false).map(f => (
              <button key={f.id} style={{ padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '8px', cursor: activeIceCream ? 'pointer' : 'not-allowed', textAlign: 'center' }} onClick={() => handleSelectFlavor(f)} disabled={!activeIceCream}>
                <span style={{ display: 'block', fontWeight: 600, fontSize: '0.8rem', marginBottom: '2px' }}>{f.name}</span>
                <span style={{ color: 'var(--primary-color)', fontSize: '0.75rem' }}>+ S/. {Number(f.price).toFixed(2)}</span>
              </button>
            ))}
          </div>
        </div>

        {/* TOPPINGS */}
        <div style={{ marginBottom: '25px', opacity: activeIceCream ? 1 : 0.5, transition: 'opacity 0.2s' }}>
          <h2 style={{ fontSize: '1.1rem', marginBottom: '10px', color: 'var(--primary-color)', borderBottom: '1px solid var(--border-color)', paddingBottom: '5px' }}>3. Agrega Toppings</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '8px' }}>
            {toppings.filter(t => t.active !== false).map(t => (
              <button key={t.id} style={{ padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '8px', cursor: activeIceCream ? 'pointer' : 'not-allowed', textAlign: 'center' }} onClick={() => handleSelectTopping(t)} disabled={!activeIceCream}>
                <span style={{ display: 'block', fontWeight: 600, fontSize: '0.8rem', marginBottom: '2px' }}>{t.name}</span>
                <span style={{ color: 'var(--primary-color)', fontSize: '0.75rem' }}>+ S/. {Number(t.price).toFixed(2)}</span>
              </button>
            ))}
          </div>
        </div>

        {/* EXTRAS DIRECTOS */}
        <div>
          <h2 style={{ fontSize: '1.1rem', marginBottom: '10px', color: 'var(--primary-color)', borderBottom: '1px solid var(--border-color)', paddingBottom: '5px' }}>Extras Directos (Se añaden directo a la cuenta)</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '8px' }}>
            {literConfig?.active !== false && (
               <button style={{ padding: '10px', background: '#fff3e0', border: '1px solid #ffb74d', borderRadius: '8px', cursor: 'pointer', textAlign: 'center' }} onClick={() => handleAddDirectItem({ id: 'liter', type: 'liter', name: 'Helado 1 Litro', price: literConfig?.price || 15.0 })}>
                 <span style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '5px' }}>🍨 Litro Familiar</span>
                 <span style={{ color: '#e65100', fontSize: '0.8rem', fontWeight: 'bold' }}>S/. {Number(literConfig?.price || 15.0).toFixed(2)}</span>
               </button>
            )}
            {packs.filter(p => p.active !== false).map(p => (
              <button key={p.id} style={{ padding: '10px', background: '#e8f5e9', border: '1px solid #81c784', borderRadius: '8px', cursor: 'pointer', textAlign: 'center' }} onClick={() => handleAddDirectItem({ id: p.id, type: 'pack', name: 'Pack: ' + p.name, price: p.price })}>
                <span style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '5px' }}>🎁 {p.name}</span>
                <span style={{ color: '#2e7d32', fontSize: '0.8rem', fontWeight: 'bold' }}>S/. {Number(p.price).toFixed(2)}</span>
              </button>
            ))}
            {popsicles.filter(p => p.active !== false).map(p => (
              <button key={p.id} style={{ padding: '10px', background: '#e3f2fd', border: '1px solid #64b5f6', borderRadius: '8px', cursor: 'pointer', textAlign: 'center' }} onClick={() => handleAddDirectItem({ id: p.id, type: 'popsicle', name: 'Paleta: ' + p.name, price: p.price })}>
                <span style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '5px' }}>🍦 {p.name}</span>
                <span style={{ color: '#1565c0', fontSize: '0.8rem', fontWeight: 'bold' }}>S/. {Number(p.price).toFixed(2)}</span>
              </button>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
