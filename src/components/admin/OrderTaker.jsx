import React, { useState } from 'react';
import { generateOrderId } from '../../utils/orderId';

export default function OrderTaker({ catalog, onPlaceOrder, showAlert }) {
  const { bases = [], flavors = [], toppings = [], packs = [], popsicles = [], literConfig = {} } = catalog || {};
  const [cart, setCart] = useState([]);
  const [customerName, setCustomerName] = useState('');
  const [orderType, setOrderType] = useState('Barra');

  const handleAddQuickItem = (item) => {
    setCart(prev => [...prev, { ...item, quantity: 1 }]);
    if (showAlert) showAlert('Añadido', item.name + ' añadido a la cuenta.', 'success');
  };

  const calculateTotal = () => {
    return cart.reduce((sum, item) => sum + (Number(item.price) * item.quantity), 0).toFixed(2);
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
      total: calculateTotal(),
      status: 'Aceptado',
      date: new Date().toISOString(),
      paymentMethod: 'Efectivo',
      orderType: orderType,
      isOperator: true
    };

    onPlaceOrder(newOrder);
    if (showAlert) showAlert('Éxito', 'Pedido registrado correctamente. Código: ' + orderId, 'success');
    setCart([]);
    setCustomerName('');
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1000px', margin: '0 auto', display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
      <div style={{ flex: '1 1 300px', background: 'var(--bg-secondary)', borderRadius: '12px', padding: '20px', border: '1px solid var(--border-color)' }}>
        <h2 style={{ fontSize: '1.2rem', marginBottom: '15px' }}>🛒 Punto de Venta</h2>
        <div className="form-group">
          <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Tipo de Atención</label>
          <select className="form-control" value={orderType} onChange={(e) => setOrderType(e.target.value)}>
            <option value="Barra">Atención en Barra / Tienda</option>
            <option value="Mesa">Atención en Mesa</option>
          </select>
        </div>
        <div className="form-group">
          <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Nombre del Cliente o N° Mesa (Opcional)</label>
          <input type="text" className="form-control" placeholder="Ej: Carlos o Mesa 4" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
        </div>
        <div style={{ marginTop: '20px' }}>
          <h3 style={{ fontSize: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>Cuenta Actual</h3>
          {cart.length === 0 ? (
            <p style={{ fontSize: '0.85rem', color: 'var(--text-light)', marginTop: '10px' }}>No hay productos.</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: '10px 0', fontSize: '0.85rem' }}>
              {cart.map((item, idx) => (
                <li key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px dashed var(--border-color)' }}>
                  <span>{item.quantity}x {item.name}</span>
                  <strong>S/. {(Number(item.price) * item.quantity).toFixed(2)}</strong>
                </li>
              ))}
            </ul>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '15px', fontSize: '1.2rem', fontWeight: 'bold' }}>
            <span>Total:</span>
            <span>S/. {calculateTotal()}</span>
          </div>
          <button className="btn btn-primary" style={{ width: '100%', marginTop: '20px', padding: '12px', fontSize: '1rem' }} onClick={handleCreateOrder} disabled={cart.length === 0}>
            ✅ Registrar Pedido Rápido
          </button>
        </div>
      </div>
      <div style={{ flex: '2 1 400px' }}>
        <h2 style={{ fontSize: '1.2rem', marginBottom: '15px' }}>Catálogo Rápido</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '10px' }}>
          {literConfig?.active !== false && (
             <button style={{ padding: '10px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '8px', cursor: 'pointer', textAlign: 'center' }} onClick={() => handleAddQuickItem({ id: 'liter', type: 'liter', name: 'Helado 1 Litro', price: literConfig?.price || 15.0 })}>
               <span style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '5px' }}>🍨 Litro Familiar</span>
               <span style={{ color: 'var(--primary-color)', fontSize: '0.8rem' }}>S/. {Number(literConfig?.price || 15.0).toFixed(2)}</span>
             </button>
          )}
          {packs.filter(p => p.active !== false).map(p => (
            <button key={p.id} style={{ padding: '10px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '8px', cursor: 'pointer', textAlign: 'center' }} onClick={() => handleAddQuickItem({ id: p.id, type: 'pack', name: 'Pack: ' + p.name, price: p.price })}>
              <span style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '5px' }}>🎁 {p.name}</span>
              <span style={{ color: 'var(--primary-color)', fontSize: '0.8rem' }}>S/. {Number(p.price).toFixed(2)}</span>
            </button>
          ))}
          {popsicles.filter(p => p.active !== false).map(p => (
            <button key={p.id} style={{ padding: '10px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '8px', cursor: 'pointer', textAlign: 'center' }} onClick={() => handleAddQuickItem({ id: p.id, type: 'popsicle', name: 'Paleta: ' + p.name, price: p.price })}>
              <span style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '5px' }}>🍦 {p.name}</span>
              <span style={{ color: 'var(--primary-color)', fontSize: '0.8rem' }}>S/. {Number(p.price).toFixed(2)}</span>
            </button>
          ))}
          {flavors.filter(f => f.active !== false).map(f => (
            <button key={f.id} style={{ padding: '10px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '8px', cursor: 'pointer', textAlign: 'center' }} onClick={() => handleAddQuickItem({ id: f.id, type: 'standard', name: 'Porción: ' + f.name, price: f.price })}>
              <span style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '5px' }}>{f.name}</span>
              <span style={{ color: 'var(--primary-color)', fontSize: '0.8rem' }}>S/. {Number(f.price).toFixed(2)}</span>
            </button>
          ))}
          {bases.filter(b => b.active !== false).map(b => (
            <button key={b.id} style={{ padding: '10px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '8px', cursor: 'pointer', textAlign: 'center' }} onClick={() => handleAddQuickItem({ id: b.id, type: 'standard', name: 'Envase: ' + b.name, price: b.price || 0 })}>
              <span style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '5px' }}>{b.name}</span>
              <span style={{ color: 'var(--primary-color)', fontSize: '0.8rem' }}>S/. {Number(b.price || 0).toFixed(2)}</span>
            </button>
          ))}
          {toppings.filter(t => t.active !== false).map(t => (
            <button key={t.id} style={{ padding: '10px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '8px', cursor: 'pointer', textAlign: 'center' }} onClick={() => handleAddQuickItem({ id: t.id, type: 'standard', name: 'Topping: ' + t.name, price: t.price })}>
              <span style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '5px' }}>{t.name}</span>
              <span style={{ color: 'var(--primary-color)', fontSize: '0.8rem' }}>S/. {Number(t.price).toFixed(2)}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
