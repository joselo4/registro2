import { useState, useEffect, useRef } from 'react';
import CartItemPreview from './CartItemPreview';
import './checkout.css';
import DessertPreview from './DessertPreview';
import { generateOrderId } from '../utils/orderId';
import { getEnabledPaymentMethods, selectPaymentMethod } from '../utils/paymentMethods';
import { buildWhatsAppHref } from '../utils/orderMessaging';
import { sanitizeHTML, sanitizeText, safeStorage } from '../utils/security';
import { checkoutStorage, checkoutTotals } from '../utils/checkout';
import { enabledOrderChannels, isOrderTypeEnabled, preferredOrderType } from '../utils/orderChannels';
import { validateOrderInput } from '../utils/orderValidation';
import { quickScoopItem } from '../utils/dessert';
import { suggestFreeDeliveryCloser, suggestPack } from '../utils/cartSuggestions';

const FIELD_IDS = { name: 'checkout-name', phone: 'checkout-phone', address: 'checkout-address', table: 'checkout-table' };


export default function Cart({ 
  cart, 
  onUpdateQuantity, 
  onRemoveFromCart, 
  onEditItem,
  onPlaceOrder, 
  deliveryFee = 0, 
  setView, 
  onAddToCart, 
  flavors, 
  bases = [],
  packs = [],
  popsicles = [],
  freeDeliveryThreshold, 
  freeDeliveryEnabled = true, 
  storePhone, 
  storeName, 
  coupons, 
  whatsappGreeting, 
  whatsappFooter, 
  cartRecommendedPack, 
  literConfig, 
  showAlert, 
  shopOpen = true, 
  tableOrdersEnabled = false, 
  tableNumber = null, 
  occupiedTables = [], 
  shopConfig, 
  trackEvent 
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
  const [name, setName] = useState(() => safeStorage.getItem('last_customer_name', ''));
  const [phone, setPhone] = useState(() => safeStorage.getItem('last_customer_phone', ''));
  const [address, setAddress] = useState(() => safeStorage.getItem('last_customer_address', ''));
  const [selectedPaymentMethod, setPaymentMethod] = useState('Yape'); // Yape, Plin, Efectivo, Transferencia, Tarjeta
  const [paymentTiming, setPaymentTiming] = useState('Al llegar');
  const enabledPaymentMethods = getEnabledPaymentMethods(shopConfig);
  const paymentMethod = selectPaymentMethod(selectedPaymentMethod, enabledPaymentMethods);
  const [operationCode, setOperationCode] = useState('');
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [sendToWhatsApp, setSendToWhatsApp] = useState(shopConfig?.defaultWhatsAppEnabled ?? false);
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const clearFieldError = field => setFieldErrors(current => (current[field] ? { ...current, [field]: undefined } : current));

  // Determinar si el método de pago es digital/previo (requiere código de operación)
  const DIGITAL_PAYMENT_METHODS = ['Yape', 'Plin', 'Transferencia', 'Transferencia Bancaria', 'BCP', 'Interbank', 'BBVA', 'Lukita'];
  const isDigitalPayment = DIGITAL_PAYMENT_METHODS.some(m => paymentMethod.toLowerCase().includes(m.toLowerCase()));
  // ¿Mostrar el campo de operación? Solo si el pago es digital y la config lo permite
  const showOpCodeField = isDigitalPayment && paymentTiming === 'Anticipado' && shopConfig?.showOperationCodeField !== false;
  const requireOpCode = showOpCodeField && shopConfig?.requireOperationCode === true;

  const IMPULSE_ITEMS = [
    { id: 'impulse_fudge', name: 'Salsa Fudge Artesanal', price: 1.5, icon: '🍫' },
    { id: 'impulse_oreo', name: 'Topping Galleta Oreo', price: 1.5, icon: '🍪' },
    { id: 'impulse_chispas', name: 'Lentejitas Chocolate', price: 1.0, icon: '🍬' },
    { id: 'impulse_cono', name: 'Cono Artesanal Extra', price: 1.5, icon: '🧇' }
  ];

  const formatPhoneDisplay = (raw) => {
    const digits = String(raw || '').replace(/\D/g, '');
    const clean = digits.length === 11 && digits.startsWith('51') ? digits.slice(2) : digits;
    if (clean.length === 9) {
      return `${clean.slice(0, 3)} ${clean.slice(3, 6)} ${clean.slice(6)}`;
    }
    return clean || '987 654 321';
  };

  const handleCopyStorePhone = () => {
    const raw = String(storePhone || '987654321').replace(/\D/g, '');
    const numToCopy = raw.length === 11 && raw.startsWith('51') ? raw.slice(2) : raw;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(numToCopy);
      setCopiedPhone(true);
      setTimeout(() => setCopiedPhone(false), 2200);
    } else {
      alert(`Número para ${paymentMethod}: ${numToCopy}`);
    }
  };

  const handleAddImpulseItem = (item) => {
    if (!shopOpen) return;
    onAddToCart({
      type: 'extra',
      id: item.id,
      name: item.name,
      price: item.price,
      quantity: 1,
      icon: item.icon,
      image: ''
    });
  };

  // Módulo de Mesas
  const channels = enabledOrderChannels(shopConfig);
  const [orderType, setOrderType] = useState(() => {
    return preferredOrderType(shopConfig, tableNumber);
  });
  const [localTableNumber, setLocalTableNumber] = useState(tableNumber || '');
  const needsTable = orderType === 'Mesa' || orderType === 'Mesa_Llevar';
  useEffect(() => {
    if (!isOrderTypeEnabled(shopConfig, orderType)) setOrderType(preferredOrderType(shopConfig, tableNumber));
  }, [shopConfig, orderType, tableNumber]);

  // Estados para Cupones de Descuento
  const [couponInput, setCouponInput] = useState('');
  const [couponExpanded, setCouponExpanded] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponError, setCouponError] = useState('');



  const { subtotal: cartSubtotal, freeDelivery: isFreeDelivery, shipping: activeDeliveryFee, discount, total } = checkoutTotals(cart, {
    deliveryFee,
    freeDeliveryEnabled,
    freeDeliveryThreshold,
    orderType,
    coupon: appliedCoupon,
  });

  const missingForFreeDelivery = Math.max(0, Number(freeDeliveryThreshold || 0) - cartSubtotal);

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
    safeStorage.setItem('last_customer_name', name);
    safeStorage.setItem('last_customer_phone', phone);
    safeStorage.setItem('last_customer_address', address);
  }, [name, phone, address]);

  // InitiateCheckout tracking
  const initiatedRef = useRef(false);
  const pendingSubmissionRef = useRef((() => {
    try { return JSON.parse(checkoutStorage.getItem('pending_order_submission')); }
    catch { return null; }
  })());
  useEffect(() => {
    if (!initiatedRef.current && trackEvent && cart && cart.length > 0) {
      initiatedRef.current = true;
      trackEvent('InitiateCheckout', {
        value: cartSubtotal,
        items: cart
      });
    }
  }, [trackEvent, cart, cartSubtotal]);

  // Devuelve los datos listos para enviar, o marca el primer campo con error.
  const prepareCheckout = () => {
    const cleanAddress = sanitizeHTML(address);
    let finalAddress = cleanAddress;
    if (orderType === 'Mesa') {
      finalAddress = `Mesa ${localTableNumber}`;
    } else if (orderType === 'Mesa_Llevar') {
      finalAddress = `Mesa ${localTableNumber} (Para Llevar)`;
    } else if (orderType === 'Barra') {
      finalAddress = `Recojo en Barra`;
    } else if (orderType === 'Llevar') {
      finalAddress = `Recojo en Tienda / Llevar`;
    }

    // Obtener valores finales con fallback si el cliente está en mesa y dejó los campos vacíos
    const rawName = (needsTable && !name.trim()) ? `Cliente Mesa ${localTableNumber || tableNumber}` : name.trim();
    const rawPhone = (needsTable && !phone.trim()) ? `Mesa` : phone.trim();

    const finalName = sanitizeHTML(rawName);
    const finalPhone = rawPhone.replace(/[^0-9A-Za-z+\s-]/g, '').trim();

    // Mismas reglas que valida el servidor, con el mensaje junto al campo.
    const activeMesaNumber = needsTable ? (localTableNumber || tableNumber) : null;
    const validation = validateOrderInput({
      name: finalName,
      phone: finalPhone,
      address: finalAddress,
      orderType,
      needsTable,
      tableNumber: activeMesaNumber,
      cart,
      paymentMethod,
      occupiedTables,
    });
    if (!validation.isValid) {
      setFieldErrors(validation.errors);
      const firstField = Object.keys(FIELD_IDS).find(field => validation.errors[field]);
      const input = firstField && document.getElementById(FIELD_IDS[firstField]);
      if (input) {
        input.focus();
        input.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
      } else {
        alert(Object.values(validation.errors)[0]);
      }
      return null;
    }
    setFieldErrors({});
    return { finalName, finalPhone, finalAddress, activeMesaNumber };
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (isSubmitting || submittingRef.current) return;
    if (!isOrderTypeEnabled(shopConfig, orderType)) {
      alert('Este canal de atención no está disponible. Elige otro antes de confirmar.');
      return;
    }
    
    if (cart.length === 0) {
      alert("El carrito está vacío.");
      return;
    }

    const prepared = prepareCheckout();
    if (!prepared) return;
    const { finalName, finalPhone, finalAddress, activeMesaNumber } = prepared;

    try {
      submittingRef.current = true;
      setIsSubmitting(true);
      const sanitizedOpCode = sanitizeText(operationCode, 50);
      const effectivePaymentTiming = (paymentMethod === 'Efectivo' || paymentMethod === 'Tarjeta') ? 'Al llegar' : paymentTiming;
      const submissionFingerprint = JSON.stringify({
        cart,
        name: finalName,
        phone: finalPhone,
        address: finalAddress,
        orderType,
        tableNumber: activeMesaNumber,
        paymentMethod,
        paymentTiming: effectivePaymentTiming,
        operationCode: sanitizedOpCode,
        total,
      });
      if (!pendingSubmissionRef.current || pendingSubmissionRef.current.fingerprint !== submissionFingerprint || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(pendingSubmissionRef.current.key)) {
        pendingSubmissionRef.current = {
          id: generateOrderId(),
          key: globalThis.crypto.randomUUID(),
          fingerprint: submissionFingerprint,
        };
        checkoutStorage.setItem('pending_order_submission', JSON.stringify(pendingSubmissionRef.current));
      }
      let orderId = pendingSubmissionRef.current.id;
      const newOrder = {
        id: orderId,
        submissionKey: pendingSubmissionRef.current.key,
        customer: { 
          name: finalName, 
          phone: finalPhone, 
          address: finalAddress, 
          paymentMethod,
          paymentTiming: effectivePaymentTiming,
          operationCode: sanitizedOpCode || undefined,
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
          const scoops = item.scoops.map(s => typeof s === 'string' ? s : s.name).join(', ');
          const toppings = item.toppings.map(t => typeof t === 'string' ? t : t.name).join(', ');
          const syrup = item.syrup ? item.syrup.name : '';
          detailsText = ` (${scoops}${toppings ? ` + ${toppings}` : ''}${syrup ? ` + Salsa ${syrup}` : ''})`;
        } else if (item.type === 'liter') {
          const scoops = item.scoops.map(s => typeof s === 'string' ? s : s.name).join(', ');
          detailsText = ` (Sabores: ${scoops})`;
        }
        return `${item.quantity}x ${item.name}${detailsText}`;
      }).join('\n');

      const couponLine = appliedCoupon ? `\n*Cupón:* ${appliedCoupon.code} (-S/. ${discount.toFixed(2)})` : '';
      let destLine = `*Dirección:* ${finalAddress}`;
      if (orderType === 'Mesa') {
        destLine = `*Mesa:* ${activeMesaNumber} (Consumo Local)`;
      } else if (orderType === 'Mesa_Llevar') {
        destLine = `*Mesa:* ${activeMesaNumber} (Para Llevar)`;
      } else if (orderType === 'Barra') {
        destLine = `*Pedido:* Directo en Barra`;
      } else if (orderType === 'Llevar') {
        destLine = `*Pedido:* Recojo en Tienda / Llevar`;
      }
      const opCodeLine = sanitizedOpCode ? `\n*N° Operación (${paymentMethod}):* ${sanitizedOpCode}` : '';
      const trackerLink = `\n\n*Sigue tu pedido en vivo aquí:*\n${window.location.origin}${window.location.pathname}?track=${encodeURIComponent(orderId)}&token=${encodeURIComponent(newOrder.submissionKey)}`;
      let whatsappMessage = `${whatsappGreeting}\n\n*Código:* ${orderId}\n*Cliente:* ${finalName}\n${destLine}\n*WhatsApp:* ${finalPhone}\n*Pago:* ${paymentMethod} · ${effectivePaymentTiming}${opCodeLine}\n\n*Pedido:*\n${itemsText}\n\n*Subtotal:* S/. ${cartSubtotal.toFixed(2)}${couponLine}\n*Delivery:* S/. ${activeDeliveryFee.toFixed(2)}\n*Total:* S/. ${total.toFixed(2)}${trackerLink}\n\n${whatsappFooter}`;
      
      let whatsappUrl = buildWhatsAppHref(storePhone, whatsappMessage);

      // Registrar pedido en la base de datos (y esperar a que finalice la sincronización en Supabase)
      for (let attempt = 0; ; attempt++) {
        try {
          await onPlaceOrder(newOrder);
          break;
        } catch (error) {
          // Short codes can match an existing order: take another one and retry.
          if (error?.status !== 409 || !/código/i.test(error.message || '') || attempt >= 3) throw error;
          const previous = { id: newOrder.id, key: newOrder.submissionKey };
          pendingSubmissionRef.current = { ...pendingSubmissionRef.current, id: generateOrderId(), key: globalThis.crypto.randomUUID() };
          checkoutStorage.setItem('pending_order_submission', JSON.stringify(pendingSubmissionRef.current));
          newOrder.id = pendingSubmissionRef.current.id;
          newOrder.submissionKey = pendingSubmissionRef.current.key;
          orderId = newOrder.id;
          whatsappMessage = whatsappMessage.split(previous.id).join(orderId).split(encodeURIComponent(previous.id)).join(encodeURIComponent(orderId)).split(previous.key).join(newOrder.submissionKey);
          whatsappUrl = buildWhatsAppHref(storePhone, whatsappMessage);
        }
      }
      pendingSubmissionRef.current = null;
      checkoutStorage.removeItem('pending_order_submission');

       // Track purchase event
       if (trackEvent) {
         trackEvent('Purchase', {
           value: Math.max(0, cartSubtotal - discount),
           total,
           shipping: activeDeliveryFee,
           transaction_id: orderId,
           coupon: appliedCoupon?.code,
           items: cart
         });
       }
  
       // Redirigir a WhatsApp del local si el cliente lo prefiere y la config lo permite
       const whatsappGlobalEnabled = shopConfig?.whatsappEnabled !== false;
       if (sendToWhatsApp && whatsappGlobalEnabled && whatsappUrl) {
         const waWindow = window.open(whatsappUrl, '_blank');
         if (waWindow) {
           waWindow.opener = null;
         } else if (showAlert) {
           showAlert(
             'Pedido registrado',
             `Tu código es ${orderId}. Toca el botón para enviarlo también por WhatsApp.`,
             'success',
             () => {
               const retryWindow = window.open(whatsappUrl, '_blank');
               if (retryWindow) retryWindow.opener = null;
               else window.location.assign(whatsappUrl);
             },
             'Enviar por WhatsApp'
           );
         }
       }

       if (setView) {
         setView('tracker');
       }
        
        // Permitimos volver a enviar después de abrir WhatsApp por si acaso
        setTimeout(() => { submittingRef.current = false; setIsSubmitting(false); }, 2000);
    } catch (err) {
      console.error("Fallo al enviar pedido:", err);
      const message = err?.message || 'No se pudo confirmar el pedido. Conservamos tu carrito para que vuelvas a intentarlo.';
      if (showAlert) showAlert('No pudimos confirmar tu pedido', `${message} Tu carrito sigue guardado.`, 'warning');
      else alert(message);
      setIsSubmitting(false);
      submittingRef.current = false;
    }
  };

  const handleProceedToSubmit = (e) => {
    e.preventDefault();
    if (isSubmitting || !shopOpen) return;
    const hasCustomItems = cart.some(item => item.type === 'custom');
    if (hasCustomItems && !showValidationModal) {
      if (!prepareCheckout()) return;
      setShowValidationModal(true);
      return;
    }
    handleSubmit(e);
  };

  const handleAddRandomScoop = () => {
    const activeFlavors = flavors.filter(f => f.active !== false);
    if (activeFlavors.length === 0) return;
    const randomFlavor = activeFlavors[Math.floor(Math.random() * activeFlavors.length)];
    onAddToCart(quickScoopItem(randomFlavor, bases));
  };

  // The suggestion only stores which pack to offer; name and price come from
  // the live catalogue so the order API accepts it.
  const missingForSuggestions = orderType === 'Delivery' && freeDeliveryEnabled && Number(freeDeliveryThreshold) > 0 && !isFreeDelivery ? missingForFreeDelivery : 0;
  const recommendedPack = (() => {
    if (cartRecommendedPack?.active === false) return null;
    const suggestion = suggestPack({ packs, cart, missingForFreeDelivery: missingForSuggestions, preferredId: cartRecommendedPack?.id || cartRecommendedPack?.packId });
    if (!suggestion) return null;
    const { pack, unlocksFreeDelivery } = suggestion;
    return { ...pack, unlocksFreeDelivery, description: pack.items || pack.description || '' };
  })();
  const freeDeliveryCloser = suggestFreeDeliveryCloser({ flavors, bases, popsicles, missingForFreeDelivery: missingForSuggestions });

  const handleAddSuggestedPack = () => {
    if (!recommendedPack) return;
    onAddToCart({
      type: 'pack',
      id: recommendedPack.id,
      name: recommendedPack.name,
      price: Number(recommendedPack.price),
      items: recommendedPack.items || recommendedPack.description,
      image: recommendedPack.image || '',
      quantity: 1
    });
  };

  const renderItemDetails = (item) => {
    if (item.type === 'custom') {
      const scoopsText = (item.scoops || []).map(s => typeof s === 'string' ? s : s?.name).filter(Boolean).join(', ');
      const toppingsText = (item.toppings || []).map(t => typeof t === 'string' ? t : t?.name).filter(Boolean).join(', ');
      const syrupText = item.syrup ? (typeof item.syrup === 'string' ? item.syrup : item.syrup?.name) : '';
      
      return (
        <span style={{ fontSize: '0.8rem', color: 'var(--text-light)', display: 'block', marginTop: '4px' }}>
          {item.base?.name && <>Base: {item.base.name} <br /></>}
          {scoopsText && <>Sabores: {scoopsText}</>}
          {toppingsText && <><br />Toppings: {toppingsText}</>}
          {syrupText && <><br />Salsa: {syrupText}</>}
        </span>
      );
    } else if (item.type === 'liter') {
      const scoopsText = (item.scoops || []).map(s => typeof s === 'string' ? s : s?.name).filter(Boolean).join(', ');
      return (
        <span style={{ fontSize: '0.8rem', color: 'var(--text-light)', display: 'block', marginTop: '4px' }}>
          🏺 Pote de 1 Litro <br />
          Sabores: {scoopsText}
        </span>
      );
    } else if (item.type === 'extra') {
      return (
        <span style={{ fontSize: '0.8rem', color: 'var(--text-light)', display: 'block', marginTop: '4px' }}>
          Topping / Agregado especial 🍨
        </span>
      );
    }
    return null;
  };

  if (!cart || cart.length === 0) {
    return (
      <div className="cart-container">
        <div style={{ marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.85rem' }} onClick={() => setView('shop')}>
            ← Tienda
          </button>
          <h2 style={{ fontSize: '1.5rem' }}>Mi Carrito</h2>
        </div>
        <div className="cart-empty" style={{ textAlign: 'center', padding: '50px 20px', background: 'var(--bg-secondary)', borderRadius: '16px', border: '1px dashed var(--border-color)' }}>
          <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🛒</div>
          <h3 style={{ fontSize: '1.25rem', marginBottom: '8px' }}>Tu carrito está vacío</h3>
          <p style={{ color: 'var(--text-light)', fontSize: '0.9rem', marginBottom: '20px' }}>
            Aún no has agregado ningún helado o producto a tu pedido.
          </p>
          <button
            type="button"
            className="btn btn-primary"
            style={{ padding: '12px 24px', fontSize: '1rem', fontWeight: 700 }}
            onClick={() => setView('shop')}
          >
            Ver la carta
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="cart-container">
      <div className="cart-page-heading">
        <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.85rem' }} onClick={() => setView('shop')}>
          ← Tienda
        </button>
        <div><span className="section-kicker">YA CASI ES TUYO</span><h2>Tu pedido</h2><p>Revisa tus favoritos y elige cómo recibirlos.</p></div>
      </div>

      {/* 💰 BARRA DE PROGRESO DE ENVÍO GRATIS DINÁMICA */}
      {orderType === 'Delivery' && freeDeliveryEnabled && freeDeliveryThreshold > 0 && (
        <div className="glass free-delivery-card" style={{
          padding: '14px',
          marginBottom: '16px',
          borderRadius: '14px',
          border: isFreeDelivery ? '2px solid var(--success)' : '1px solid var(--border-color)',
          background: isFreeDelivery 
            ? 'linear-gradient(135deg, rgba(46, 204, 113, 0.14) 0%, rgba(46, 204, 113, 0.04) 100%)' 
            : 'linear-gradient(135deg, rgba(255, 107, 129, 0.08) 0%, rgba(255, 160, 0, 0.05) 100%)',
          boxShadow: isFreeDelivery ? '0 4px 15px rgba(46, 204, 113, 0.15)' : 'none'
        }}>
          {isFreeDelivery ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '2.2rem' }}>🎉</span>
              <div>
                <strong style={{ fontSize: '1rem', color: 'var(--success)', display: 'block' }}>
                  ¡Genial! Calificas para DELIVERY GRATIS
                </strong>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-light)', marginTop: '2px', margin: 0 }}>
                  Has superado los S/. {freeDeliveryThreshold.toFixed(2)}. ¡Tu envío corre por cuenta de la casa!
                </p>
              </div>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: '0.9rem', lineHeight: 1.4, color: 'var(--text-dark)' }}>
                <span aria-hidden="true">🛵 </span>Te faltan <strong style={{ color: 'var(--primary-color)' }}>S/. {missingForFreeDelivery.toFixed(2)}</strong> para tu <strong>delivery gratis</strong>
                <small style={{ display: 'block', color: 'var(--text-light)', fontSize: '0.75rem' }}>Gratis desde S/. {freeDeliveryThreshold.toFixed(2)}</small>
              </div>

              <div style={{
                width: '100%',
                height: '8px',
                background: 'var(--border-color)',
                borderRadius: '6px',
                marginTop: '8px',
                overflow: 'hidden'
              }}>
                <div style={{
                  width: `${Math.min(100, (cartSubtotal / freeDeliveryThreshold) * 100)}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, var(--primary-color), #ffa502)',
                  borderRadius: '6px',
                  transition: 'width 0.4s ease'
                }}></div>
              </div>
              
              <div style={{ marginTop: '10px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {freeDeliveryCloser ? (
                  <button
                    type="button"
                    onClick={() => shopOpen && onAddToCart(freeDeliveryCloser.item)}
                    disabled={!shopOpen}
                    className="btn btn-primary free-delivery-closer"
                  >
                    + {freeDeliveryCloser.label} · S/. {freeDeliveryCloser.item.price.toFixed(2)} <span>y tu delivery sale gratis</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleAddRandomScoop}
                    className="btn btn-secondary"
                    style={{ padding: '6px 12px', fontSize: '0.75rem', flex: '1 1 120px' }}
                  >
                    🎲 + Bola Sorpresa
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
                <CartItemPreview item={item} literConfig={literConfig} />
                <div className="cart-item-details">
                  <h4 style={{ fontSize: '0.95rem' }}>{item.name}</h4>
                  {renderItemDetails(item)}
                  {onEditItem && (item.type === 'custom' || item.type === 'liter') && (
                    <button type="button" className="cart-edit-btn" disabled={!shopOpen} onClick={() => onEditItem(index)} aria-label={`Editar ${item.name}`}>
                      ✏️ Editar
                    </button>
                  )}
                </div>
              </div>

              <div className="cart-item-actions" style={{ flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <button className="qty-btn" disabled={!shopOpen} onClick={() => shopOpen && onUpdateQuantity(index, item.quantity - 1)} style={{ width: '24px', height: '24px', fontSize: '0.8rem', opacity: !shopOpen ? 0.5 : 1, cursor: !shopOpen ? 'not-allowed' : 'pointer' }} aria-label={`Quitar una unidad de ${item.name}`}>-</button>
                  <span style={{ fontWeight: 700, minWidth: '15px', textAlign: 'center', fontSize: '0.85rem' }}>{item.quantity}</span>
                  <button className="qty-btn" aria-label={`Agregar una unidad de ${item.name}`} disabled={!shopOpen || item.quantity >= 99} onClick={() => shopOpen && onUpdateQuantity(index, item.quantity + 1)} style={{ width: '24px', height: '24px', fontSize: '0.8rem', opacity: (!shopOpen || item.quantity >= 99) ? 0.5 : 1, cursor: (!shopOpen || item.quantity >= 99) ? 'not-allowed' : 'pointer' }}>+</button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>S/. {(item.price * item.quantity).toFixed(2)}</span>
                  <button className="remove-btn" aria-label={`Eliminar ${item.name}`} title={`Eliminar ${item.name}`} disabled={!shopOpen} onClick={() => shopOpen && onRemoveFromCart(index)} style={{ padding: '2px', fontSize: '0.9rem', opacity: !shopOpen ? 0.5 : 1, cursor: !shopOpen ? 'not-allowed' : 'pointer' }}>🗑️</button>
                </div>
              </div>
            </div>
          ))}

          {/* Sugerencia de Venta Cruzada Dinámica */}
          {recommendedPack && (
            <div className="glass-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'linear-gradient(135deg, rgba(229, 142, 38, 0.04) 0%, rgba(255, 107, 129, 0.04) 100%)', border: '1px dashed var(--secondary-color)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ maxWidth: '75%' }}>
                <strong style={{ fontSize: '0.8rem', display: 'block' }}>🎁 {recommendedPack.unlocksFreeDelivery ? 'Súmalo y tu delivery sale GRATIS' : 'Combo recomendado'}</strong>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-light)', display: 'block', marginTop: '2px' }}>
                  {recommendedPack.name} por S/. {Number(recommendedPack.price).toFixed(2)}{recommendedPack.description ? ` (${recommendedPack.description})` : ''}.
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

          {/* Venta Cruzada por Impulso (Toppings y Agregados Rápidos) */}
          <div className="glass-card impulse-cross-sells" style={{
            padding: '12px',
            marginTop: '10px',
            borderRadius: 'var(--radius-md)',
            background: 'linear-gradient(135deg, rgba(255, 107, 129, 0.05) 0%, rgba(255, 160, 0, 0.03) 100%)',
            border: '1px solid rgba(255, 107, 129, 0.2)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-dark)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span>🧁</span> Añade un toque especial a tu helado
              </span>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-light)' }}>1-toque</span>
            </div>
            <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px', scrollbarWidth: 'none' }}>
              {IMPULSE_ITEMS.map(imp => {
                const inCart = cart.find(i => i.id === imp.id);
                return (
                  <button
                    key={imp.id}
                    type="button"
                    disabled={!shopOpen}
                    onClick={() => handleAddImpulseItem(imp)}
                    className="impulse-chip"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '6px 10px',
                      borderRadius: '20px',
                      border: inCart ? '1.5px solid var(--success)' : '1px solid var(--border-color)',
                      background: inCart ? 'rgba(46, 204, 113, 0.1)' : 'var(--bg-secondary)',
                      cursor: shopOpen ? 'pointer' : 'not-allowed',
                      whiteSpace: 'nowrap',
                      fontSize: '0.74rem',
                      color: 'var(--text-dark)',
                      transition: 'all 0.2s ease',
                      flexShrink: 0
                    }}
                    title={`Agregar ${imp.name}`}
                  >
                    <span>{imp.icon}</span>
                    <span>{imp.name}</span>
                    <strong style={{ color: 'var(--primary-color)', marginLeft: '2px' }}>
                      +S/. {imp.price.toFixed(2)}
                    </strong>
                    {inCart && <span style={{ fontSize: '0.68rem', color: 'var(--success)', fontWeight: 700 }}>({inCart.quantity})</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Formulario Exprés */}
        <div className="glass checkout-section" style={{ padding: '15px', borderRadius: 'var(--radius-md)' }}>
          <div className="checkout-heading"><span className="section-kicker">UN PASO MÁS</span><h3>Finaliza tu pedido</h3><p>Completa tus datos para confirmar la compra.</p></div>
          
          <button
            type="button"
            className="checkout-help-link"
            onClick={() => {
              const waUrl = `https://wa.me/${String(storePhone || '51987654321').replace(/\D/g, '')}?text=${encodeURIComponent('¡Hola! Estoy revisando mi carrito de compras y tengo una consulta sobre mi pedido 🍦')}`;
              const waWindow = window.open(waUrl, '_blank', 'noopener,noreferrer');
              if (waWindow) waWindow.opener = null;
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
          
          <form className="checkout-form" onSubmit={handleProceedToSubmit} noValidate style={{ gap: '10px', marginTop: '10px' }}>
            
            {(channels.Mesa || channels.Barra || channels.Delivery) && (
              <div className="form-group">
                <label style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Tipo de Servicio</label>
                {tableNumber && channels.Mesa ? (
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '4px' }}>
                    <button
                      type="button"
                      className={`payment-btn ${orderType === 'Mesa' ? 'selected' : ''}`} aria-pressed={orderType === 'Mesa'}
                      onClick={() => setOrderType('Mesa')}
                      style={{ flex: 1, padding: '8px', fontSize: '0.75rem', opacity: !shopOpen ? 0.5 : 1, cursor: !shopOpen ? 'not-allowed' : 'pointer' }}
                      disabled={!shopOpen}
                    >
                      🍽️ Consumo en Mesa {tableNumber}
                    </button>
                    <button
                      type="button"
                      className={`payment-btn ${orderType === 'Mesa_Llevar' ? 'selected' : ''}`} aria-pressed={orderType === 'Mesa_Llevar'}
                      onClick={() => setOrderType('Mesa_Llevar')}
                      style={{ flex: 1, padding: '8px', fontSize: '0.75rem', opacity: !shopOpen ? 0.5 : 1, cursor: !shopOpen ? 'not-allowed' : 'pointer' }}
                      disabled={!shopOpen}
                    >
                      🛍️ Mesa {tableNumber}: Para Llevar
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {channels.Mesa && tableOrdersEnabled && <button type="button" className={`payment-btn ${needsTable ? 'selected' : ''}`} aria-pressed={needsTable} onClick={() => setOrderType('Mesa')} disabled={!shopOpen}>🍽️ Mesa</button>}
                    {channels.Barra && <button type="button" className={`payment-btn ${orderType === 'Barra' ? 'selected' : ''}`} aria-pressed={orderType === 'Barra'} onClick={() => setOrderType('Barra')} disabled={!shopOpen}>🛍️ Recojo en barra</button>}
                    {channels.Delivery && <button type="button" className={`payment-btn ${orderType === 'Delivery' ? 'selected' : ''}`} aria-pressed={orderType === 'Delivery'} onClick={() => setOrderType('Delivery')} disabled={!shopOpen}>🛵 Delivery</button>}
                  </div>
                )}
              </div>
            )}

            {!needsTable && (
              <>
                <div className="form-group">
                  <label htmlFor={FIELD_IDS.name} style={{ fontSize: '0.8rem' }}>¿Tu Nombre?</label>
                  <input
                    id={FIELD_IDS.name}
                    name="name"
                    type="text"
                    className="form-control"
                    placeholder="Ej. Carlos Mendoza"
                    autoComplete="name"
                    autoCapitalize="words"
                    enterKeyHint="next"
                    maxLength={80}
                    value={name}
                    onChange={(e) => { setName(e.target.value); clearFieldError('name'); }}
                    aria-invalid={fieldErrors.name ? 'true' : undefined}
                    aria-describedby={fieldErrors.name ? `${FIELD_IDS.name}-error` : undefined}
                    style={{ padding: '8px 10px', fontSize: '0.85rem' }}
                    required
                    disabled={!shopOpen}
                  />
                  {fieldErrors.name && <small id={`${FIELD_IDS.name}-error`} className="checkout-field-error" role="alert">{fieldErrors.name}</small>}
                </div>

                <div className="form-group">
                  <label htmlFor={FIELD_IDS.phone} style={{ fontSize: '0.8rem' }}>WhatsApp / Teléfono</label>
                  <input
                    id={FIELD_IDS.phone}
                    name="tel"
                    type="tel"
                    className="form-control"
                    placeholder="Ej. 987654321"
                    autoComplete="tel"
                    inputMode="numeric"
                    enterKeyHint="next"
                    maxLength={15}
                    value={phone}
                    onChange={(e) => { setPhone(e.target.value.replace(/\D/g, '')); clearFieldError('phone'); }}
                    aria-invalid={fieldErrors.phone ? 'true' : undefined}
                    aria-describedby={fieldErrors.phone ? `${FIELD_IDS.phone}-error` : undefined}
                    style={{ padding: '8px 10px', fontSize: '0.85rem' }}
                    required
                    disabled={!shopOpen}
                  />
                  {fieldErrors.phone && <small id={`${FIELD_IDS.phone}-error`} className="checkout-field-error" role="alert">{fieldErrors.phone}</small>}
                </div>
              </>
            )}

            {needsTable && (
              <div className="form-group">
                <label htmlFor={tableNumber ? undefined : FIELD_IDS.table} style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Número de Mesa</label>
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
                    id={FIELD_IDS.table}
                    className="form-control"
                    value={localTableNumber || ''}
                    aria-invalid={fieldErrors.table ? 'true' : undefined}
                    onChange={(e) => {
                      setLocalTableNumber(e.target.value);
                      clearFieldError('table');
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
                <label htmlFor={FIELD_IDS.address} style={{ fontSize: '0.8rem' }}>Dirección de Entrega</label>
                <input
                  id={FIELD_IDS.address}
                  name="street-address"
                  type="text"
                  className="form-control"
                  placeholder="Ej. Jr. Tarapacá 489, Magdalena"
                  autoComplete="street-address"
                  enterKeyHint="done"
                  maxLength={300}
                  value={address}
                  onChange={(e) => { setAddress(e.target.value); clearFieldError('address'); }}
                  aria-invalid={fieldErrors.address ? 'true' : undefined}
                  aria-describedby={fieldErrors.address ? `${FIELD_IDS.address}-error` : undefined}
                  style={{ padding: '8px 10px', fontSize: '0.85rem' }}
                  required
                  disabled={!shopOpen}
                />
                {fieldErrors.address && <small id={`${FIELD_IDS.address}-error`} className="checkout-field-error" role="alert">{fieldErrors.address}</small>}
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
              <div className="payment-options" style={{ gap: '6px', flexWrap: 'wrap' }}>
                {enabledPaymentMethods.map(method => (
                  <button
                    key={method}
                    type="button"
                    className={`payment-btn ${paymentMethod === method ? 'selected' : ''}`}
                    aria-pressed={paymentMethod === method}
                    onClick={() => shopOpen && setPaymentMethod(method)}
                    style={{ fontSize: '0.75rem', padding: '6px', opacity: !shopOpen ? 0.5 : 1, cursor: !shopOpen ? 'not-allowed' : 'pointer' }}
                    disabled={!shopOpen}
                  >
                    {method === 'Yape' ? '📱 Yape' : method === 'Plin' ? '💸 Plin' : method === 'Efectivo' ? '💵 Efectivo' : method === 'Transferencia' ? '🏦 Transferencia' : '💳 Tarjeta'}
                  </button>
                ))}
              </div>
              {!enabledPaymentMethods.length && <p role="alert" style={{ fontSize: '0.875rem', margin: '8px 0', color: 'var(--danger)' }}>No hay métodos de pago disponibles. Intenta más tarde.</p>}
              {paymentMethod === 'Tarjeta' && <p style={{ fontSize: '0.875rem', margin: '8px 0', color: 'var(--text-light)' }}>Pago con tarjeta al recibir el pedido, mediante POS.</p>}
              {isDigitalPayment && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginTop: '10px' }}>
                  <button type="button" className={`payment-btn ${paymentTiming === 'Al llegar' ? 'selected' : ''}`} aria-pressed={paymentTiming === 'Al llegar'} onClick={() => setPaymentTiming('Al llegar')}>
                    🛵 Pagar al llegar
                  </button>
                  <button type="button" className={`payment-btn ${paymentTiming === 'Anticipado' ? 'selected' : ''}`} aria-pressed={paymentTiming === 'Anticipado'} onClick={() => setPaymentTiming('Anticipado')}>
                    ✅ Pagar ahora
                  </button>
                </div>
              )}
            </div>

            {/* Cajón Interactivo para Pago Digital (Yape / Plin) */}
            {(paymentMethod === 'Yape' || paymentMethod === 'Plin') && paymentTiming === 'Anticipado' && (
              <div className="payment-drawer-card" style={{
                marginTop: '10px',
                padding: '12px 14px',
                borderRadius: '12px',
                background: paymentMethod === 'Yape'
                  ? 'linear-gradient(135deg, rgba(116, 34, 132, 0.08) 0%, rgba(116, 34, 132, 0.02) 100%)'
                  : 'linear-gradient(135deg, rgba(0, 168, 150, 0.08) 0%, rgba(0, 168, 150, 0.02) 100%)',
                border: `1.5px solid ${paymentMethod === 'Yape' ? '#742284' : '#00a896'}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '1.2rem' }}>{paymentMethod === 'Yape' ? '📱' : '💸'}</span>
                    <strong style={{ fontSize: '0.85rem', color: paymentMethod === 'Yape' ? '#742284' : '#00a896' }}>
                      Paga con {paymentMethod} a:
                    </strong>
                  </div>
                  <span style={{
                    fontSize: '0.7rem',
                    fontWeight: 'bold',
                    padding: '2px 8px',
                    borderRadius: '10px',
                    background: paymentMethod === 'Yape' ? '#742284' : '#00a896',
                    color: '#fff'
                  }}>
                    {storeName || 'Friozo Helados'}
                  </span>
                </div>

                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'var(--bg-secondary)',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px dashed var(--border-color)',
                  marginBottom: '10px'
                }}>
                  <div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-light)', display: 'block' }}>Número oficial:</span>
                    <strong className="allow-select" style={{ fontSize: '1.05rem', letterSpacing: '0.5px' }}>
                      {formatPhoneDisplay(storePhone || '987654321')}
                    </strong>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleCopyStorePhone}
                    style={{
                      fontSize: '0.75rem',
                      padding: '5px 10px',
                      borderRadius: '6px',
                      borderColor: paymentMethod === 'Yape' ? '#742284' : '#00a896',
                      color: paymentMethod === 'Yape' ? '#742284' : '#00a896',
                      cursor: 'pointer'
                    }}
                  >
                    {copiedPhone ? '✅ ¡Copiado!' : '📋 Copiar'}
                  </button>
                </div>

                {showOpCodeField && (
                  <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                      🔢 N° de Operación {paymentMethod}{requireOpCode ? ' *' : ' (Opcional - Acelera tu pedido)'}:
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Ej. 123456 (Últimos dígitos de tu comprobante)"
                      value={operationCode}
                      onChange={(e) => setOperationCode(e.target.value.replace(/[^0-9A-Za-z]/g, ''))}
                      style={{ padding: '7px 10px', fontSize: '0.82rem', fontFamily: 'monospace' }}
                      maxLength={12}
                      disabled={!shopOpen}
                      required={requireOpCode}
                    />
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-light)', display: 'block', marginTop: '3px' }}>
                      {requireOpCode
                        ? '⚠️ Este campo es obligatorio para procesar tu pedido.'
                        : '💡 Si aún no has pagado, puedes confirmarlo ahora y adjuntar la captura al WhatsApp.'}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Campo de Cupón de Descuento */}
            <div className="form-group coupon-disclosure">
              <button type="button" className="coupon-disclosure-toggle" aria-expanded={couponExpanded} aria-controls="coupon-disclosure-content" onClick={() => setCouponExpanded(value => !value)}>
                🎟️ {appliedCoupon ? `Cupón ${appliedCoupon.code} aplicado` : '¿Tienes un cupón?'} <span aria-hidden="true">{couponExpanded ? '−' : '+'}</span>
              </button>
              <div id="coupon-disclosure-content" className="coupon-disclosure-content" hidden={!couponExpanded}>
              {!appliedCoupon ? (
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input
                    aria-label="Código de cupón"
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
            </div>

            {/* WhatsApp redirect checkbox */}
            {!tableNumber && shopOpen && (
              <div className="whatsapp-toggle-container">
                <input
                  type="checkbox"
                  id="whatsapp-redirect-checkbox"
                  checked={sendToWhatsApp}
                  onChange={(event) => setSendToWhatsApp(event.target.checked)}
                  className="whatsapp-toggle-checkbox"
                />
                <label htmlFor="whatsapp-redirect-checkbox" className="whatsapp-toggle-label">
                  💬 Enviar y chatear por WhatsApp
                </label>
              </div>
            )}

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
                  <span>{isFreeDelivery ? <strong style={{ color: 'var(--success)' }}>GRATIS</strong> : `S/. ${activeDeliveryFee.toFixed(2)}`}</span>
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
              style={{ 
                width: '100%', 
                marginTop: '10px', 
                padding: '12px', 
                fontSize: '0.95rem', 
                fontWeight: 700,
                opacity: (isSubmitting || !shopOpen) ? 0.6 : 1, 
                cursor: (isSubmitting || !shopOpen) ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
              disabled={isSubmitting || !shopOpen || !paymentMethod}
            >
              {!shopOpen ? (
                '🔒 Tienda Cerrada (Fuera de Horario)'
              ) : isSubmitting ? (
                <>
                  <span aria-hidden="true">⏳</span>
                  <span>Asegurando tu pedido...</span>
                </>
              ) : !paymentMethod ? (
                'Confirmar pedido'
              ) : (
                `Confirmar pedido · S/. ${total.toFixed(2)}`
              )}
            </button>
          </form>
        </div>

      </div>

      {showValidationModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.87)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 100000, padding: '20px', backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)'
        }}>
          <div style={{
            background: 'var(--bg-primary, #ffffff)',
            color: 'var(--text-dark, #1e293b)',
            borderRadius: '24px', 
            padding: '28px', 
            width: '100%', 
            maxWidth: '460px',
            maxHeight: '90vh', 
            overflowY: 'auto', 
            textAlign: 'center',
            boxShadow: '0 30px 80px -10px rgba(0, 0, 0, 0.75)',
            border: '1.5px solid var(--border-color)'
          }}>
            <div style={{ fontSize: '2.2rem', marginBottom: '8px' }}>🔍</div>
            <h3 style={{ fontSize: '1.4rem', color: 'var(--primary-color)', margin: '0 0 8px 0', fontFamily: 'var(--font-title)', fontWeight: 800 }}>
              Verifica tu diseño
            </h3>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-dark)', opacity: 0.85, margin: '0 0 16px 0', lineHeight: 1.45 }}>
              Asegúrate de haber elegido todos los sabores y toppings que deseas antes de confirmarlo.
            </p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
              {cart.filter(item => item.type === 'custom').map((item, idx) => (
                <div key={idx} style={{ 
                  background: 'var(--bg-secondary, #f8fafc)',
                  border: '1px solid var(--border-color)', 
                  borderRadius: '16px', 
                  padding: '16px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
                }}>
                  <strong style={{ fontSize: '0.95rem', display: 'block', marginBottom: '10px', color: 'var(--text-dark)' }}>{item.name}</strong>
                  <div style={{ width: '130px', height: '170px', margin: '0 auto' }}>
                    <DessertPreview 
                      base={item.base}
                      scoops={item.scoops}
                      toppings={item.toppings}
                      syrup={item.syrup}
                    />
                  </div>
                  <div style={{ 
                    fontSize: '0.82rem', 
                    color: 'var(--text-dark)', 
                    marginTop: '12px', 
                    textAlign: 'left', 
                    lineHeight: 1.5, 
                    background: 'var(--bg-primary, #ffffff)', 
                    padding: '10px 12px', 
                    borderRadius: '10px', 
                    border: '1px solid var(--border-color)' 
                  }}>
                    <div><strong>🍨 Sabores:</strong> {item.scoops.map(s => typeof s === 'string' ? s : s.name).join(', ')}</div>
                    {item.toppings.length > 0 && <div style={{ marginTop: '3px' }}><strong>✨ Toppings:</strong> {item.toppings.map(t => typeof t === 'string' ? t : t.name).join(', ')}</div>}
                    {item.syrup && <div style={{ marginTop: '3px' }}><strong>🍫 Salsa:</strong> {item.syrup.name}</div>}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '10px', flexDirection: 'column' }}>
              <button 
                type="button"
                className="btn btn-primary"
                onClick={(e) => {
                  setShowValidationModal(false);
                  handleSubmit(e);
                }}
                style={{ 
                  padding: '14px', 
                  fontSize: '1rem', 
                  fontWeight: 700, 
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 12px rgba(255, 71, 87, 0.35)'
                }}
                disabled={isSubmitting}
              >
                <span>✅ Sí, ¡es lo que quiero!</span>
                <span style={{ opacity: 0.9 }}>• S/. {total.toFixed(2)}</span>
              </button>
              <button 
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowValidationModal(false)}
                style={{ 
                  padding: '11px', 
                  fontSize: '0.9rem', 
                  width: '100%', 
                  background: 'var(--bg-secondary, #f1f5f9)', 
                  color: 'var(--text-dark, #334155)',
                  border: '1px solid var(--border-color)' 
                }}
              >
                ✏️ Corregir / Volver al carrito
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
