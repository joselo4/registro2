import React, { useState, useEffect } from 'react';
import { generateOrderId } from '../utils/orderId';

export default function Cart({ 
  cart, 
  onUpdateQuantity, 
  onRemoveFromCart, 
  onPlaceOrder, 
  deliveryFee, 
  setView,
  onAddToCart,
  flavors,
  freeDeliveryThreshold,
  freeDeliveryEnabled = true,
  storePhone,
  coupons,
  whatsappGreeting,
  whatsappFooter,
  cartRecommendedPack,
  literConfig,
  showAlert,
  shopOpen = true,
  tableOrdersEnabled = false,
  tableNumber = null,
  setTableNumber,
  occupiedTables = [],
  shopConfig
}) {
  const alert = (msg) => {
    if (showAlert) {
      const isError = msg.toLowerCase().includes('error') || msg.toLowerCase().includes('falló') || msg.toLowerCase().includes('vacío') || msg.toLowerCase().includes('incompletos') || msg.toLowerCase().includes('campos') || msg.toLowerCase().includes('inválido');
      const isSuccess = msg.toLowerCase().includes('éxito') || msg.toLowerCase().includes('aplicado');
      const type = isError ? 'warning' : isSuccess ? 'success' : 'info';
      const title = isError ? 'Atención' : isSuccess ? '¡Listo!' : 'Información';
      showAlert(title, msg, type);
    } else {
      window.alert(msg);
    }
  };

  // Cargar datos autocompletados desde LocalStorage si existen
  const [name, setName] = useState(() => localStorage.getItem('last_customer_name') || '');
  const [phone, setPhone] = useState(() => localStorage.getItem('last_customer_phone') || '');
  const [address, setAddress] = useState(() => localStorage.getItem('last_customer_address') || '');
  const [paymentMethod, setPaymentMethod] = useState('Yape'); // Yape, Plin, Efectivo
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Módulo de Mesas
  const [orderType, setOrderType] = useState(() => {
    return tableNumber ? 'Mesa' : 'Delivery';
  });
  const [localTableNumber, setLocalTableNumber] = useState(tableNumber || '');
  const needsTable = orderType === 'Mesa' || orderType === 'Mesa_Llevar';

  // Estados para Cupones de Descuento
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponError, setCouponError] = useState('');

  const cartSubtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  
  // Utilizar el umbral de Delivery Gratis dinámico y verificar si hay cupón de envío gratis o consumo en mesa/barra
  const isFreeDelivery = 
    orderType === 'Mesa' || 
    orderType === 'Mesa_Llevar' || 
    orderType === 'Barra' || 
    orderType === 'Llevar' || 
    (freeDeliveryEnabled && freeDeliveryThreshold > 0 && cartSubtotal >= freeDeliveryThreshold) || 
    (appliedCoupon && appliedCoupon.type === 'free_delivery');
  const activeDeliveryFee = isFreeDelivery ? 0 : deliveryFee;
  
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
      if (found.active === false) {
        setCouponError('Este cupón se encuentra inactivo.');
        setAppliedCoupon(null);
      } else if (found.limit > 0 && (found.usedCount || 0) >= found.limit) {
        setCouponError('Este cupón ha alcanzado el límite de usos.');
        setAppliedCoupon(null);
      } else {
        setAppliedCoupon(found);
        setCouponInput('');
      }
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
        } else if (item.type === 'liter') {
          const scoops = item.scoops.map(s => s.name).join(', ');
          details = `\n   Sabores: ${scoops}`;
        }
        return `• ${item.quantity}x *${item.name}*${details}`;
      }).join('\n') +
      `\n---------------------------\n` +
      `*Subtotal:* S/. ${order.total.toFixed(2)}\n` +
      (order.couponCode ? `*Cupón:* ${order.couponCode} (-S/. ${order.discount.toFixed(2)})\n` : '') +
      `*Delivery:* S/. ${order.deliveryFee.toFixed(2)}\n` +
      `*TOTAL:* S/. ${order.grandTotal.toFixed(2)}`;

    try {
      const response = await fetch('/api/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: message,
          parse_mode: 'Markdown',
          kind: 'order'
        })
      });
      if (!response.ok) {
        throw new Error('No se pudo entregar la notificación centralizada.');
      }
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
    let finalAddress = address;
    if (orderType === 'Mesa') {
      finalAddress = `Mesa ${localTableNumber}`;
    } else if (orderType === 'Mesa_Llevar') {
      finalAddress = `Mesa ${localTableNumber} (Para Llevar)`;
    } else if (orderType === 'Barra') {
      finalAddress = `Recojo en Barra`;
    } else if (orderType === 'Llevar') {
      finalAddress = `Recojo en Tienda / Llevar`;
    }

    const needsTable = orderType === 'Mesa' || orderType === 'Mesa_Llevar';
    
    // Obtener valores finales con fallback si el cliente está en mesa y dejó los campos vacíos
    const finalName = (needsTable && !name.trim()) ? `Cliente Mesa ${localTableNumber || tableNumber}` : name.trim();
    const finalPhone = (needsTable && !phone.trim()) ? `Mesa` : phone.trim();

    // Validar según tipo de pedido
    if (orderType === 'Delivery') {
      if (!finalName || !finalPhone || !finalAddress.trim()) {
        alert("Por favor, completa todos los campos requeridos.");
        return;
      }
    } else if (needsTable) {
      if (!localTableNumber && !tableNumber) {
        alert("Por favor, selecciona o vincula un número de mesa.");
        return;
      }
    } else {
      // Retiro en Barra o Llevar
      if (!finalName || !finalPhone) {
        alert("Por favor, completa todos los campos requeridos.");
        return;
      }
    }

    const activeMesaNumber = needsTable ? (localTableNumber || tableNumber) : null;
    if (needsTable && activeMesaNumber && occupiedTables.includes(String(activeMesaNumber))) {
      alert(`La Mesa ${activeMesaNumber} ya cuenta con un pedido activo. Debe ser liberada por el personal antes de realizar un nuevo pedido.`);
      return;
    }

    try {
      setIsSubmitting(true);
      const orderId = generateOrderId();
      const newOrder = {
        id: orderId,
        customer: { 
          name: finalName, 
          phone: finalPhone, 
          address: finalAddress, 
          paymentMethod,
          orderType,
          tableNumber: activeMesaNumber
        },
        items: [...cart],
        total: cartSubtotal,
        deliveryFee: activeDeliveryFee,
        discount: discount,
        couponCode: appliedCoupon ? appliedCoupon.code : null,
        grandTotal: total,
        status: 'Por Corroborar',
        statusHistory: [
          { status: 'Por Corroborar', timestamp: new Date().toISOString() }
        ],
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
        } else if (item.type === 'liter') {
          const scoops = item.scoops.map(s => s.name).join(', ');
          detailsText = ` (Sabores: ${scoops})`;
        }
        return `${item.quantity}x ${item.name}${detailsText}`;
      }).join('\n');

      const couponLine = appliedCoupon ? `\n*Cupón:* ${appliedCoupon.code} (-S/. ${discount.toFixed(2)})` : '';
      let destLine = `*Dirección:* ${address}`;
      if (orderType === 'Mesa') {
        destLine = `*Mesa:* ${activeMesaNumber} (Consumo Local)`;
      } else if (orderType === 'Mesa_Llevar') {
        destLine = `*Mesa:* ${activeMesaNumber} (Para Llevar)`;
      } else if (orderType === 'Barra') {
        destLine = `*Pedido:* Directo en Barra`;
      } else if (orderType === 'Llevar') {
        destLine = `*Pedido:* Recojo en Tienda / Llevar`;
      }
      const trackerLink = `\n\n*Sigue tu pedido en vivo aquí:*\n${window.location.origin}${window.location.pathname}?track=${orderId}`;
      const whatsappMessage = `${whatsappGreeting}\n\n*Código:* ${orderId}\n*Cliente:* ${finalName}\n${destLine}\n*WhatsApp:* ${finalPhone}\n*Pago:* ${paymentMethod}\n\n*Pedido:*\n${itemsText}\n\n*Subtotal:* S/. ${cartSubtotal.toFixed(2)}${couponLine}\n*Delivery:* S/. ${activeDeliveryFee.toFixed(2)}\n*Total:* S/. ${total.toFixed(2)}${trackerLink}\n\n${whatsappFooter}`;
      
      const encodedText = encodeURIComponent(whatsappMessage);
      const cleanPhone = String(storePhone || '').replace(/\D/g, ''); // Limpiar caracteres no numéricos
      const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodedText}`;

      // Enviar notificación en segundo plano a través de la función segura
      await sendTelegramNotification(newOrder);

       // Registrar pedido en la base de datos
      onPlaceOrder(newOrder);
 
       // Redirigir a WhatsApp del dueño (desactivado a petición del usuario)
       // window.open(whatsappUrl, '_blank');
       
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
      image: pack.image || '',
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
    } else if (item.type === 'liter') {
      const scoopsText = item.scoops.map(s => s.name).join(', ');
      return (
        <span style={{ fontSize: '0.8rem', color: 'var(--text-light)', display: 'block', marginTop: '4px' }}>
          🏺 Pote de 1 Litro <br />
          Sabores: {scoopsText}
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
      {freeDeliveryEnabled && freeDeliveryThreshold > 0 && !tableNumber && (
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
                  style={{ padding: '6px 10px', fontSize: '0.75rem', flex: 1 }}
                >
                  🎲 Sorpréndeme
                </button>
                {cartRecommendedPack && !cart.some(i => i.id === (cartRecommendedPack.id || 'pack_pareja')) && (
                  <button 
                    onClick={handleAddSuggestedPack}
                    className="btn btn-primary animate-pulse" 
                    style={{ padding: '6px 10px', fontSize: '0.75rem', flex: 1 }}
                  >
                    🎁 Añadir Combo Sugerido
                  </button>
                )}
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
                <div style={{ fontSize: '1.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px' }}>
                  {item.type === 'liter' && literConfig?.image ? (
                    <img src={literConfig.image} alt="1 Litro" width="32" height="32" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  ) : item.type === 'pack' && item.image ? (
                    <img src={item.image} alt={item.name} width="32" height="32" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '4px' }} />
                  ) : item.type === 'custom' && item.base?.image ? (
                    <img src={item.base.image} alt={item.name} width="32" height="32" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  ) : (
                    item.type === 'custom' ? (item.base.icon || (item.base.id === 'cono' ? '🍦' : '🍧')) : (item.type === 'liter' ? '🏺' : '🎁')
                  )}
                </div>
                <div className="cart-item-details">
                  <h4 style={{ fontSize: '0.95rem' }}>{item.name}</h4>
                  {renderItemDetails(item)}
                </div>
              </div>

              <div className="cart-item-actions" style={{ flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <button className="qty-btn" disabled={!shopOpen} onClick={() => shopOpen && onUpdateQuantity(index, item.quantity - 1)} style={{ width: '24px', height: '24px', fontSize: '0.8rem', opacity: !shopOpen ? 0.5 : 1, cursor: !shopOpen ? 'not-allowed' : 'pointer' }}>-</button>
                  <span style={{ fontWeight: 700, minWidth: '15px', textAlign: 'center', fontSize: '0.85rem' }}>{item.quantity}</span>
                  <button className="qty-btn" disabled={!shopOpen} onClick={() => shopOpen && onUpdateQuantity(index, item.quantity + 1)} style={{ width: '24px', height: '24px', fontSize: '0.8rem', opacity: !shopOpen ? 0.5 : 1, cursor: !shopOpen ? 'not-allowed' : 'pointer' }}>+</button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>S/. {(item.price * item.quantity).toFixed(2)}</span>
                  <button className="remove-btn" disabled={!shopOpen} onClick={() => shopOpen && onRemoveFromCart(index)} style={{ padding: '2px', fontSize: '0.9rem', opacity: !shopOpen ? 0.5 : 1, cursor: !shopOpen ? 'not-allowed' : 'pointer' }}>🗑️</button>
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
          
          <button
            type="button"
            className="btn btn-secondary"
            style={{
              backgroundColor: '#25D366',
              color: 'white',
              borderColor: '#25D366',
              width: '100%',
              fontSize: '0.8rem',
              padding: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              cursor: 'pointer',
              marginBottom: '10px',
              marginTop: '5px'
            }}
            onClick={() => {
              const waUrl = `https://wa.me/${String(storePhone || '51987654321').replace(/\D/g, '')}?text=${encodeURIComponent('¡Hola! Estoy revisando mi carrito de compras y tengo una consulta sobre mi pedido 🍦')}`;
              window.open(waUrl, '_blank');
            }}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" style={{ verticalAlign: 'middle' }}>
              <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.59-4.846c1.66.986 3.284 1.447 4.74 1.448 5.4 0 9.792-4.393 9.795-9.79.002-2.615-1.012-5.074-2.855-6.918C16.483 2.05 14.032.99 11.417.99c-5.402 0-9.794 4.393-9.797 9.79-.001 1.733.456 3.238 1.411 4.887L2.03 20.485l4.616-1.331zM16.518 14.1c-.266-.134-1.577-.777-1.821-.866-.245-.09-.423-.134-.6.134-.178.266-.689.866-.844 1.04-.155.178-.312.2-.578.066-.266-.134-1.124-.414-2.141-1.32-.79-.705-1.326-1.577-1.482-1.844-.155-.266-.017-.41.117-.543.12-.12.266-.312.4-.467.135-.156.18-.266.27-.444.09-.178.045-.334-.022-.467-.067-.134-.6-1.446-.823-1.979-.217-.523-.454-.452-.6-.452h-.51c-.178 0-.467.067-.71.334-.244.267-.933.912-.933 2.224 0 1.312.955 2.58 1.088 2.757.135.178 1.88 2.87 4.554 4.024.637.275 1.13.438 1.517.56.64.204 1.22.175 1.68.107.513-.075 1.577-.644 1.8-.1.223-.545.223-1.013.156-1.1zm-.058-.058v.058-.058z"/>
            </svg>
            <span>¿Dudas con tu pedido? Escríbenos por WhatsApp</span>
          </button>
          
          {!shopOpen && (
            <div style={{
              background: 'rgba(231, 76, 60, 0.15)',
              border: '1px solid rgba(231, 76, 60, 0.3)',
              color: 'var(--danger)',
              padding: '10px',
              borderRadius: '6px',
              fontSize: '0.75rem',
              fontWeight: 'bold',
              textAlign: 'center',
              marginBottom: '10px'
            }}>
              🔒 Lo sentimos, estamos fuera del horario de atención. El carrito se encuentra bloqueado y no se pueden enviar pedidos en este momento.
            </div>
          )}
          
          <form className="checkout-form" onSubmit={handleSubmit} style={{ gap: '10px', marginTop: '10px' }}>
            {tableOrdersEnabled && (
              <div className="form-group">
                <label style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Tipo de Servicio</label>
                {tableNumber ? (
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '4px' }}>
                    <button
                      type="button"
                      className={`payment-btn ${orderType === 'Mesa' ? 'selected' : ''}`}
                      onClick={() => setOrderType('Mesa')}
                      style={{ flex: 1, padding: '8px', fontSize: '0.75rem', opacity: !shopOpen ? 0.5 : 1, cursor: !shopOpen ? 'not-allowed' : 'pointer' }}
                      disabled={!shopOpen}
                    >
                      🍽️ Consumo en Mesa {tableNumber}
                    </button>
                    <button
                      type="button"
                      className={`payment-btn ${orderType === 'Mesa_Llevar' ? 'selected' : ''}`}
                      onClick={() => setOrderType('Mesa_Llevar')}
                      style={{ flex: 1, padding: '8px', fontSize: '0.75rem', opacity: !shopOpen ? 0.5 : 1, cursor: !shopOpen ? 'not-allowed' : 'pointer' }}
                      disabled={!shopOpen}
                    >
                      🛍️ Mesa {tableNumber}: Para Llevar
                    </button>
                  </div>
                ) : (
                  <div style={{ 
                    background: 'rgba(255, 64, 129, 0.08)', 
                    border: '1px solid rgba(255, 64, 129, 0.2)', 
                    color: 'var(--primary-color)', 
                    padding: '10px 14px', 
                    borderRadius: '10px', 
                    fontSize: '0.85rem', 
                    fontWeight: 'bold',
                    textAlign: 'center',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}>
                    🛵 Envío a Domicilio (Delivery)
                  </div>
                )}
              </div>
            )}

            {!needsTable && (
              <>
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
                    disabled={!shopOpen}
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
                    disabled={!shopOpen}
                  />
                </div>
              </>
            )}

            {needsTable && (
              <div className="form-group">
                <label style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Número de Mesa</label>
                {tableNumber ? (
                  <div style={{
                    padding: '10px 14px',
                    background: 'rgba(255, 64, 129, 0.08)',
                    border: '1px solid rgba(255, 64, 129, 0.2)',
                    borderRadius: '8px',
                    fontWeight: 'bold',
                    color: 'var(--primary-color)',
                    fontSize: '0.9rem',
                    textAlign: 'center',
                    marginTop: '4px'
                  }}>
                    🍽️ Mesa {localTableNumber || tableNumber}
                  </div>
                ) : (
                  <select
                    className="form-control"
                    value={localTableNumber || ''}
                    onChange={(e) => {
                      setLocalTableNumber(e.target.value);
                      if (setTableNumber) setTableNumber(e.target.value);
                    }}
                    style={{ 
                      padding: '8px 10px', 
                      fontSize: '0.85rem', 
                      borderColor: occupiedTables.includes(String(localTableNumber)) ? 'var(--danger)' : 'var(--border-color)' 
                    }}
                    required
                    disabled={!shopOpen}
                  >
                    <option value="">-- Seleccionar Mesa --</option>
                    {Array.from({ length: shopConfig?.totalTables || 12 }, (_, i) => i + 1).map(num => {
                      const isOccupied = occupiedTables.includes(String(num));
                      return (
                        <option key={num} value={num} disabled={isOccupied}>
                          Mesa {num} {isOccupied ? '(Ocupada)' : ''}
                        </option>
                      );
                    })}
                  </select>
                )}
                {occupiedTables.includes(String(localTableNumber || tableNumber)) && (
                  <span style={{ color: 'var(--danger)', fontSize: '0.72rem', fontWeight: 'bold', display: 'block', marginTop: '4px' }}>
                    ⚠️ Esta mesa tiene un pedido activo. Debe ser liberada por el mesero antes de volver a pedir.
                  </span>
                )}
              </div>
            )}

            {orderType === 'Delivery' && (
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
                  disabled={!shopOpen}
                />
              </div>
            )}

            {(orderType === 'Barra' || orderType === 'Llevar') && (
              <div style={{
                background: 'rgba(52, 152, 219, 0.1)',
                border: '1px solid rgba(52, 152, 219, 0.25)',
                color: 'var(--primary-color)',
                padding: '10px',
                borderRadius: '8px',
                fontSize: '0.8rem',
                margin: '10px 0',
                textAlign: 'left'
              }}>
                📍 Recogerás tu pedido directamente en barra/caja una vez que esté listo.
              </div>
            )}

            <div className="form-group">
              <label style={{ fontSize: '0.8rem' }}>Forma de Pago</label>
              <div className="payment-options" style={{ gap: '6px' }}>
                <button
                  type="button"
                  className={`payment-btn ${paymentMethod === 'Yape' ? 'selected' : ''}`}
                  onClick={() => shopOpen && setPaymentMethod('Yape')}
                  style={{ fontSize: '0.75rem', padding: '6px', opacity: !shopOpen ? 0.5 : 1, cursor: !shopOpen ? 'not-allowed' : 'pointer' }}
                  disabled={!shopOpen}
                >
                  📱 Yape
                </button>
                <button
                  type="button"
                  className={`payment-btn ${paymentMethod === 'Plin' ? 'selected' : ''}`}
                  onClick={() => shopOpen && setPaymentMethod('Plin')}
                  style={{ fontSize: '0.75rem', padding: '6px', opacity: !shopOpen ? 0.5 : 1, cursor: !shopOpen ? 'not-allowed' : 'pointer' }}
                  disabled={!shopOpen}
                >
                  💸 Plin
                </button>
                <button
                  type="button"
                  className={`payment-btn ${paymentMethod === 'Efectivo' ? 'selected' : ''}`}
                  onClick={() => shopOpen && setPaymentMethod('Efectivo')}
                  style={{ fontSize: '0.75rem', padding: '6px', opacity: !shopOpen ? 0.5 : 1, cursor: !shopOpen ? 'not-allowed' : 'pointer' }}
                  disabled={!shopOpen}
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
                    disabled={!shopOpen}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleApplyCoupon}
                    style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                    disabled={!shopOpen}
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
                    style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: shopOpen ? 'pointer' : 'not-allowed', fontSize: '0.75rem', fontWeight: 'bold' }}
                    disabled={!shopOpen}
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
              {!tableNumber && (
                <div className="cart-summary-row" style={{ marginTop: '4px' }}>
                  <span>Envío:</span>
                  <span>{isFreeDelivery ? <strong style={{ color: 'var(--success)' }}>GRATIS</strong> : `S/. ${deliveryFee.toFixed(2)}`}</span>
                </div>
              )}
              <div className="cart-summary-total" style={{ fontSize: '1.05rem', marginTop: '6px', paddingTop: '6px' }}>
                <span>Total:</span>
                <span style={{ color: 'var(--primary-color)' }}>S/. {total.toFixed(2)}</span>
              </div>
            </div>

            <button 
              type="submit" 
              className="btn btn-primary" 
              style={{ width: '100%', marginTop: '10px', padding: '10px', fontSize: '0.9rem', opacity: (isSubmitting || !shopOpen) ? 0.6 : 1, cursor: (isSubmitting || !shopOpen) ? 'not-allowed' : 'pointer' }}
              disabled={isSubmitting || !shopOpen}
            >
              {!shopOpen ? '🔒 Tienda Cerrada (Fuera de Horario)' : isSubmitting ? '⏳ Procesando Pedido...' : '🚀 Confirmar y Enviar Pedido'}
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
