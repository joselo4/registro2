import React, { useState, useEffect } from 'react';

export default function Cart({ 
  cart, 
  onUpdateQuantity, 
  onRemoveFromCart, 
  onPlaceOrder, 
  deliveryFee, 
  setView,
  onAddToCart,
  flavors,
  telegramToken,
  telegramChatId,
  freeDeliveryThreshold,
  storePhone,
  coupons,
  whatsappGreeting,
  whatsappFooter,
  cartRecommendedPack
}) {
  // Cargar datos autocompletados desde LocalStorage si existen
  const [name, setName] = useState(() => localStorage.getItem('last_customer_name') || '');
  const [phone, setPhone] = useState(() => localStorage.getItem('last_customer_phone') || '');
  const [address, setAddress] = useState(() => localStorage.getItem('last_customer_address') || '');
  const [paymentMethod, setPaymentMethod] = useState('Yape'); // Yape, Plin, Efectivo
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Estados para Cupones de Descuento
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponError, setCouponError] = useState('');

  const cartSubtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  
  // Utilizar el umbral de Delivery Gratis dinámico y verificar si hay cupón de envío gratis
  const isFreeDelivery = cartSubtotal >= freeDeliveryThreshold || (appliedCoupon && appliedCoupon.type === 'free_delivery');
  const activeDeliveryFee = isFreeDelivery ? 0.0 : deliveryFee;
  
  const discount = appliedCoupon 
    ? (appliedCoupon.type === 'percentage' 
        ? cartSubtotal * (appliedCoupon.value / 100) 
        : (appliedCoupon.type === 'flat' ? appliedCoupon.value : 0)) 
    : 0;

  const total = Math.max(0, cartSubtotal + activeDeliveryFee - discount);

  const missingForFreeDelivery = freeDeliveryThreshold - cartSubtotal;

  const handleApplyCoupon = (e) => {
    e.preventDefault();
    setCouponError('');
    if (!couponInput.trim()) return;

    const code = couponInput.trim().toUpperCase();
    const found = coupons ? coupons.find(c => c.code === code) : null;

    if (found) {
      setAppliedCoupon(found);
      setCouponInput('');
    } else {
      setCouponError('Cupón inválido o expirado.');
      setAppliedCoupon(null);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponError('');
  };

  // Guardar datos del cliente para futura compra
  useEffect(() => {
    localStorage.setItem('last_customer_name', name);
    localStorage.setItem('last_customer_phone', phone);
    localStorage.setItem('last_customer_address', address);
  }, [name, phone, address]);

  // Enviar notificación a Telegram (Canal Directo)
  const sendTelegramNotification = async (order) => {
    if (!telegramToken || !telegramChatId) return;

    const message = `🚨 *¡NUEVO PEDIDO EN DON HELADO!* 🚨\n\n` +
      `*Código:* ${order.id}\n` +
      `*Cliente:* ${order.customer.name}\n` +
      `*WhatsApp:* ${order.customer.phone}\n` +
      `*Dirección:* ${order.customer.address}\n` +
      `*Pago:* ${order.customer.paymentMethod}\n` +
      `---------------------------\n` +
      order.items.map(item => {
        let details = '';
        if (item.type === 'custom') {
          const scoops = item.scoops.map(s => s.name).join(', ');
          const toppings = item.toppings.map(t => t.name).join(', ');
          const syrup = item.syrup ? item.syrup.name : '';
          details = `\n   Sabores: ${scoops}` + 
                    (toppings ? `\n   Toppings: ${toppings}` : '') +
                    (syrup ? `\n   Salsa: ${syrup}` : '');
        }
        return `• ${item.quantity}x *${item.name}*${details}`;
      }).join('\n') +
      `\n---------------------------\n` +
      `*Subtotal:* S/. ${order.total.toFixed(2)}\n` +
      (order.couponCode ? `*Cupón:* ${order.couponCode} (-S/. ${order.discount.toFixed(2)})\n` : '') +
      `*Delivery:* S/. ${order.deliveryFee.toFixed(2)}\n` +
      `*TOTAL:* S/. ${order.grandTotal.toFixed(2)}`;

    try {
      await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: telegramChatId,
          text: message,
          parse_mode: 'Markdown'
        })
      });
      console.log("Notificación por Telegram enviada con éxito.");
    } catch (err) {
      console.error("Error al enviar notificación de Telegram:", err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    
    if (cart.length === 0) {
      alert("El carrito está vacío.");
      return;
    }
    if (!name.trim() || !phone.trim() || !address.trim()) {
      alert("Por favor, completa todos los campos.");
      return;
    }

    try {
      setIsSubmitting(true);
      const orderId = `PED-${Math.floor(1000 + Math.random() * 9000)}`;
      const newOrder = {
        id: orderId,
        customer: { name, phone, address, paymentMethod },
        items: [...cart],
        total: cartSubtotal,
        deliveryFee: activeDeliveryFee,
        discount: discount,
        couponCode: appliedCoupon ? appliedCoupon.code : null,
        grandTotal: total,
        status: 'Pendiente',
        date: new Date().toISOString()
      };

      // Formatear Mensaje de WhatsApp
      const itemsText = cart.map(item => {
        let detailsText = '';
        if (item.type === 'custom') {
          const scoops = item.scoops.map(s => s.name).join(', ');
          const toppings = item.toppings.map(t => t.name).join(', ');
          const syrup = item.syrup ? item.syrup.name : '';
          detailsText = ` (${scoops}${toppings ? ` + ${toppings}` : ''}${syrup ? ` + Salsa ${syrup}` : ''})`;
        }
        return `${item.quantity}x ${item.name}${detailsText}`;
      }).join('\n');

      const couponLine = appliedCoupon ? `\n*Cupón:* ${appliedCoupon.code} (-S/. ${discount.toFixed(2)})` : '';
      const whatsappMessage = `${whatsappGreeting}\n\n*Código:* ${orderId}\n*Cliente:* ${name}\n*Dirección:* ${address}\n*WhatsApp:* ${phone}\n*Pago:* ${paymentMethod}\n\n*Pedido:*\n${itemsText}\n\n*Subtotal:* S/. ${cartSubtotal.toFixed(2)}${couponLine}\n*Delivery:* S/. ${activeDeliveryFee.toFixed(2)}\n*Total:* S/. ${total.toFixed(2)}\n\n${whatsappFooter}`;
      
      const encodedText = encodeURIComponent(whatsappMessage);
      const cleanPhone = String(storePhone || '').replace(/\D/g, ''); // Limpiar caracteres no numéricos
      const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodedText}`;

      // Enviar notificación en segundo plano a Telegram si está configurado
      if (telegramToken && telegramChatId) {
        await sendTelegramNotification(newOrder);
      }

      // Registrar pedido en la base de datos
      onPlaceOrder(newOrder);

      // Redirigir a WhatsApp del dueño
      window.open(whatsappUrl, '_blank');
      
      // Permitimos volver a enviar después de abrir WhatsApp por si acaso
      setTimeout(() => setIsSubmitting(false), 2000);
    } catch (err) {
      console.error("Fallo al enviar pedido:", err);
      alert("⚠️ Lo sentimos, ocurrió un error al estructurar el pedido. Vuelve a intentarlo.");
      setIsSubmitting(false);
    }
  };

  const handleAddRandomScoop = () => {
    const activeFlavors = flavors.filter(f => f.active);
    if (activeFlavors.length === 0) return;
    const randomFlavor = activeFlavors[Math.floor(Math.random() * activeFlavors.length)];
    
    const customItem = {
      type: 'custom',
      base: { id: 'cono', name: 'Cono de Galleta Crujiente', price: 0.0 },
      scoops: [{ id: randomFlavor.id, name: randomFlavor.name, price: randomFlavor.price, color: randomFlavor.color }],
      toppings: [],
      price: randomFlavor.price,
      quantity: 1,
      name: `Helado Simple de ${randomFlavor.name}`
    };
    onAddToCart(customItem);
  };

  const handleAddSuggestedPack = () => {
    const pack = cartRecommendedPack || {
      active: true,
      name: 'Pack Dúo Romántico',
      price: 10.0,
      description: '2 Copas Waffle de 3 bolas + Fudge de chocolate gratis',
      id: 'pack_pareja'
    };
    const packItem = {
      type: 'pack',
      id: pack.id || 'pack_pareja',
      name: pack.name || 'Pack Dúo Romántico',
      price: parseFloat(pack.price) || 10.0,
      items: pack.description || '2 Copas Waffle de 3 bolas + Fudge de chocolate gratis',
      quantity: 1
    };
    onAddToCart(packItem);
  };

  const renderItemDetails = (item) => {
    if (item.type === 'custom') {
      const scoopsText = item.scoops.map(s => s.name).join(', ');
      const toppingsText = item.toppings.map(t => t.name).join(', ');
      const syrupText = item.syrup ? item.syrup.name : '';
      
      return (
        <span style={{ fontSize: '0.8rem', color: 'var(--text-light)', display: 'block', marginTop: '4px' }}>
          Base: {item.base.name} <br />
          Sabores: {scoopsText}
          {toppingsText && <><br />Toppings: {toppingsText}</>}
          {syrupText && <><br />Salsa: {syrupText}</>}
        </span>
      );
    }
    return null;
  };

  return (
    <div className="cart-container">
      <div style={{ marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.85rem' }} onClick={() => setView('shop')}>
          ← Tienda
        </button>
        <h2 style={{ fontSize: '1.5rem' }}>Mi Carrito</h2>
      </div>

      {/* 💰 BARRA DE PROGRESO DE ENVÍO GRATIS DINÁMICA */}
      {freeDeliveryThreshold > 0 && (
        <div className="glass" style={{ padding: '12px', marginBottom: '15px', borderLeft: `5px solid ${isFreeDelivery ? 'var(--success)' : 'var(--warning)'}` }}>
          {isFreeDelivery ? (
            <div>
              <span style={{ fontSize: '1rem' }}>🎉 <strong>¡Tienes Delivery Gratis!</strong></span>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-light)', marginTop: '2px' }}>Has superado el monto mínimo de S/. {freeDeliveryThreshold.toFixed(2)}.</p>
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 'bold' }}>
                <span>🚚 Envío Gratis desde S/. {freeDeliveryThreshold.toFixed(2)}</span>
                <span style={{ color: 'var(--primary-color)' }}>Falta S/. {missingForFreeDelivery.toFixed(2)}</span>
              </div>
              <div style={{ width: '100%', height: '6px', background: 'var(--border-color)', borderRadius: '3px', marginTop: '6px', overflow: 'hidden' }}>
                <div style={{ width: `${Math.min(100, (cartSubtotal / freeDeliveryThreshold) * 100)}%`, height: '100%', background: 'var(--primary-color)', transition: 'width 0.4s ease' }}></div>
              </div>
              
              <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
                <button 
                  onClick={handleAddRandomScoop}
                  className="btn btn-secondary" 
                  style={{ padding: '4px 8px', fontSize: '0.75rem', flex: 1 }}
                >
                  🍦 ¡Agregar Bola Clásica (+S/. 1.00)!
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="cart-layout">
        
        {/* Lista de Items */}
        <div className="cart-items-section">
          {cart.map((item, index) => (
            <div key={index} className="glass-card cart-item" style={{ padding: '10px 14px' }}>
              <div className="cart-item-info">
                <div style={{ fontSize: '1.8rem' }}>
                  {item.type === 'custom' ? (item.base.id === 'cono' ? '🍦' : '🍧') : '🎁'}
                </div>
                <div className="cart-item-details">
                  <h4 style={{ fontSize: '0.95rem' }}>{item.name}</h4>
                  {renderItemDetails(item)}
                </div>
              </div>

              <div className="cart-item-actions" style={{ flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <button className="qty-btn" onClick={() => onUpdateQuantity(index, item.quantity - 1)} style={{ width: '24px', height: '24px', fontSize: '0.8rem' }}>-</button>
                  <span style={{ fontWeight: 700, minWidth: '15px', textAlign: 'center', fontSize: '0.85rem' }}>{item.quantity}</span>
                  <button className="qty-btn" onClick={() => onUpdateQuantity(index, item.quantity + 1)} style={{ width: '24px', height: '24px', fontSize: '0.8rem' }}>+</button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>S/. {(item.price * item.quantity).toFixed(2)}</span>
                  <button className="remove-btn" onClick={() => onRemoveFromCart(index)} style={{ padding: '2px', fontSize: '0.9rem' }}>🗑️</button>
                </div>
              </div>
            </div>
          ))}

          {/* Sugerencia de Venta Cruzada Dinámica */}
          {cartRecommendedPack && cartRecommendedPack.active !== false && !cart.some(item => item.id === (cartRecommendedPack.id || 'pack_pareja')) && (
            <div className="glass-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'linear-gradient(135deg, rgba(229, 142, 38, 0.04) 0%, rgba(255, 107, 129, 0.04) 100%)', border: '1px dashed var(--secondary-color)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ maxWidth: '75%' }}>
                <strong style={{ fontSize: '0.8rem', display: 'block' }}>🎁 Combo Recomendado</strong>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-light)', display: 'block', marginTop: '2px' }}>
                  {cartRecommendedPack.name} por S/. {(parseFloat(cartRecommendedPack.price) || 0).toFixed(2)} ({cartRecommendedPack.description}).
                </span>
              </div>
              <button 
                onClick={handleAddSuggestedPack}
                className="btn btn-secondary" 
                style={{ padding: '4px 10px', fontSize: '0.7rem', color: 'var(--secondary-color)', borderColor: 'var(--secondary-color)' }}
              >
                Sumar
              </button>
            </div>
          )}
        </div>

        {/* Formulario Exprés */}
        <div className="glass checkout-section" style={{ padding: '15px', borderRadius: 'var(--radius-md)' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '8px' }}>Checkout Exprés (Rápido)</h3>
          
          <form className="checkout-form" onSubmit={handleSubmit} style={{ gap: '10px', marginTop: '10px' }}>
            <div className="form-group">
              <label style={{ fontSize: '0.8rem' }}>¿Tu Nombre?</label>
              <input
                type="text"
                className="form-control"
                placeholder="Ej. Carlos Mendoza"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{ padding: '8px 10px', fontSize: '0.85rem' }}
                required
              />
            </div>

            <div className="form-group">
              <label style={{ fontSize: '0.8rem' }}>WhatsApp / Teléfono</label>
              <input
                type="tel"
                className="form-control"
                placeholder="Ej. 987654321"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                style={{ padding: '8px 10px', fontSize: '0.85rem' }}
                required
              />
            </div>

            <div className="form-group">
              <label style={{ fontSize: '0.8rem' }}>Dirección de Entrega</label>
              <input
                type="text"
                className="form-control"
                placeholder="Ej. Jr. Tarapacá 489, Magdalena"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                style={{ padding: '8px 10px', fontSize: '0.85rem' }}
                required
              />
            </div>

            <div className="form-group">
              <label style={{ fontSize: '0.8rem' }}>Forma de Pago</label>
              <div className="payment-options" style={{ gap: '6px' }}>
                <button
                  type="button"
                  className={`payment-btn ${paymentMethod === 'Yape' ? 'selected' : ''}`}
                  onClick={() => setPaymentMethod('Yape')}
                  style={{ fontSize: '0.75rem', padding: '6px' }}
                >
                  📱 Yape
                </button>
                <button
                  type="button"
                  className={`payment-btn ${paymentMethod === 'Plin' ? 'selected' : ''}`}
                  onClick={() => setPaymentMethod('Plin')}
                  style={{ fontSize: '0.75rem', padding: '6px' }}
                >
                  💸 Plin
                </button>
                <button
                  type="button"
                  className={`payment-btn ${paymentMethod === 'Efectivo' ? 'selected' : ''}`}
                  onClick={() => setPaymentMethod('Efectivo')}
                  style={{ fontSize: '0.75rem', padding: '6px' }}
                >
                  💵 Efectivo
                </button>
              </div>
            </div>

            {/* Campo de Cupón de Descuento */}
            <div className="form-group" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '10px', marginTop: '10px' }}>
              <label style={{ fontSize: '0.8rem', display: 'block', marginBottom: '4px', fontWeight: 600 }}>🎟️ ¿Tienes un Cupón de Descuento?</label>
              {!appliedCoupon ? (
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Ej. VERANO10"
                    value={couponInput}
                    onChange={(e) => { setCouponInput(e.target.value); setCouponError(''); }}
                    style={{ textTransform: 'uppercase', padding: '6px 10px', fontSize: '0.8rem', flex: 1 }}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleApplyCoupon}
                    style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                  >
                    Aplicar
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(46, 204, 113, 0.1)', border: '1px solid rgba(46, 204, 113, 0.2)', padding: '6px 10px', borderRadius: '6px' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--success)' }}>
                    🎟️ {appliedCoupon.code} ({appliedCoupon.description}) aplicado
                  </span>
                  <button
                    type="button"
                    onClick={handleRemoveCoupon}
                    style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold' }}
                  >
                    Remover
                  </button>
                </div>
              )}
              {couponError && (
                <span style={{ color: 'var(--danger)', fontSize: '0.7rem', display: 'block', marginTop: '4px', fontWeight: 600 }}>
                  ⚠️ {couponError}
                </span>
              )}
            </div>

            {/* Resumen */}
            <div style={{ marginTop: '10px', fontSize: '0.8rem', borderTop: '1px solid var(--border-color)', paddingTop: '8px' }}>
              <div className="cart-summary-row" style={{ marginTop: '4px' }}>
                <span>Subtotal:</span>
                <span>S/. {cartSubtotal.toFixed(2)}</span>
              </div>
              {discount > 0 && (
                <div className="cart-summary-row" style={{ marginTop: '4px', color: 'var(--success)', fontWeight: 'bold' }}>
                  <span>Descuento ({appliedCoupon?.code}):</span>
                  <span>- S/. {discount.toFixed(2)}</span>
                </div>
              )}
              <div className="cart-summary-row" style={{ marginTop: '4px' }}>
                <span>Envío:</span>
                <span>{isFreeDelivery ? <strong style={{ color: 'var(--success)' }}>GRATIS</strong> : `S/. ${deliveryFee.toFixed(2)}`}</span>
              </div>
              <div className="cart-summary-total" style={{ fontSize: '1.05rem', marginTop: '6px', paddingTop: '6px' }}>
                <span>Total:</span>
                <span style={{ color: 'var(--primary-color)' }}>S/. {total.toFixed(2)}</span>
              </div>
            </div>

            <button 
              type="submit" 
              className="btn btn-primary" 
              style={{ width: '100%', marginTop: '10px', padding: '10px', fontSize: '0.9rem', opacity: isSubmitting ? 0.6 : 1, cursor: isSubmitting ? 'not-allowed' : 'pointer' }}
              disabled={isSubmitting}
            >
              {isSubmitting ? '⏳ Procesando Pedido...' : '🚀 Confirmar y Enviar Pedido'}
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
