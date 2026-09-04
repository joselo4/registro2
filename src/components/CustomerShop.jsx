import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import DessertPreview from './DessertPreview';
import { updateSyncedData } from '../utils/supabaseSync';

export default function CustomerShop({ 
  flavors, 
  toppings = [],
  bases = [],
  packs, 
  popsicles = [],
  onAddToCart, 
  setView, 
  storeName,
  freeDeliveryThreshold = 15.0,
  freeDeliveryEnabled = true,
  deliveryCampaignText = '¡Arma tu helado con toppings o elige un pack promocional para no pagar envío!',
  literConfig,
  catalogOrder = ['popsicles', 'classic', 'liter', 'packs'],
  storePhone,
  showAlert,
  trendsInterval,
  trendsDisplayTime,
  tableOrdersEnabled = false,
  tableNumber = null,
  setTableNumber,
  tableCalls = [],
  occupiedTables = [],
  cart = [],
  shopConfig = {},
  testimonials = [],
  storeHeroImage = '',
  trackEvent
}) {
  const tableCategories = useMemo(() => {
    return shopConfig?.tableCatalogCategories || ['popsicles', 'classic', 'liter', 'packs'];
  }, [shopConfig?.tableCatalogCategories]);

  const handleAddToCartWrapped = useCallback((item) => {
    onAddToCart(item);
    if (trackEvent) {
      trackEvent('AddToCart', {
        content_name: item.name || 'Helado',
        value: item.price || 1.0,
        currency: 'PEN',
        quantity: item.quantity || 1
      });
    }
  }, [onAddToCart, trackEvent]);

  const [filter, setFilter] = useState(() => {
    if (tableNumber) {
      return tableCategories.length > 1 ? 'all' : (tableCategories[0] || 'classic');
    }
    return 'all';
  });

  const activeFlavors = flavors.filter(f => f.active);
  const activePacks = packs.filter(p => p.active);
  const activePopsicles = popsicles.filter(p => p.active !== false);
  const activePrices = activeFlavors
    .map(flavor => Number(flavor.price) || 0)
    .filter(price => price > 0);
  const startingPrice = activePrices.length > 0
    ? Math.min(...activePrices).toFixed(2)
    : '1.00';

  const isTableOccupiedByOther = tableOrdersEnabled && tableNumber && 
    occupiedTables.includes(String(tableNumber));

  useEffect(() => {
    if (tableNumber) {
      setFilter(tableCategories.length > 1 ? 'all' : (tableCategories[0] || 'classic'));
    }
  }, [tableNumber, tableCategories]);

  const getCartSummary = () => {
    if (!cart || cart.length === 0) return 'Carrito vacío';
    return cart.map(item => {
      if (item.type === 'custom') {
        const scoopsText = item.scoops ? item.scoops.map(s => s.name).join(' + ') : 'Personalizado';
        const toppingsText = item.toppings && item.toppings.length > 0 
          ? ` (Toppings: ${item.toppings.map(t => t.name).join(', ')})` 
          : '';
        return `${item.quantity}x Personalizado [${scoopsText}]${toppingsText}`;
      } else if (item.type === 'liter') {
        const scoopsText = item.scoops ? item.scoops.join(' + ') : '1 Litro';
        return `${item.quantity}x Pote 1L [${scoopsText}]`;
      } else {
        return `${item.quantity}x ${item.name || 'Producto'}`;
      }
    }).join(', ');
  };

  // --- Estados y lógica para la guía de sabores ---
  const [showWizard, setShowWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState(1); // 1: antojo, 2: premium, 3: topping, 4: result
  const [wizardAnswers, setWizardAnswers] = useState({ antojo: null, premium: null, topping: null });
  const [wizardResult, setWizardResult] = useState(null);
  const [isWizardLoading, setIsWizardLoading] = useState(false);

  // --- Estados y Lógica para Atención en Mesa (Llamar al Mozo) ---
  const [showCallModal, setShowCallModal] = useState(false);
  const [isCalling, setIsCalling] = useState(false);

  const myActiveCall = useMemo(() => {
    return tableCalls.find(c => String(c.table) === String(tableNumber) && !c.resolved);
  }, [tableCalls, tableNumber]);

  const handleCallWaiter = async (type) => {
    if (!tableNumber) return;
    if (isCalling) return;
    setIsCalling(true);
    const cleanType = String(type || '').replace(/<[^>]*>/g, '').trim();
    const cartSummary = getCartSummary();
    const cleanCartSummary = cartSummary.replace(/<[^>]*>/g, '').trim();
    const fullRequest = `${cleanType} | Carrito: ${cleanCartSummary}`;

    const callData = {
      table: tableNumber,
      request: fullRequest,
      timestamp: new Date().toISOString(),
      resolved: false
    };
    const success = await updateSyncedData(`order_call_Mesa_${tableNumber}`, callData);
    setIsCalling(false);
    if (success) {
      setShowCallModal(false);

      try {
        const messageText = `🛎️ *Llamado de Mesa ${tableNumber}*\n\n` +
                            `*Solicitud:* ${type}\n` +
                            `*Detalles del Pedido en Carrito:*\n${cartSummary}`;
        await fetch('/api/telegram', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: messageText,
            table: tableNumber,
            parse_mode: 'Markdown',
            kind: 'table_call'
          })
        });
      } catch (err) {
        console.error("Error al enviar llamado de mesa a Telegram:", err);
      }

      if (showAlert) {
        showAlert('🛎️ Solicitud Enviada', `Se ha avisado al personal: "${type}". En breve te atenderemos.`, 'success');
      }
    } else {
      if (showAlert) {
        showAlert('⚠️ Error', 'No se pudo enviar la solicitud de atención. Intenta de nuevo.', 'error');
      }
    }
  };

  const handleCancelCall = async () => {
    if (!tableNumber) return;
    setIsCalling(true);
    const callData = {
      table: tableNumber,
      request: myActiveCall ? myActiveCall.request : '',
      timestamp: myActiveCall ? myActiveCall.timestamp : new Date().toISOString(),
      resolved: true
    };
    const success = await updateSyncedData(`order_call_Mesa_${tableNumber}`, callData);
    setIsCalling(false);
    if (success) {
      setShowCallModal(false);
      if (showAlert) {
        showAlert('Cancelado', 'Se ha cancelado tu solicitud de atención.', 'success');
      }
    }
  };

  // --- Estados y Lógica para Tendencias en Vivo (FOMO) ---
  const [currentTrend, setCurrentTrend] = useState(null);
  const [dismissedTrend, setDismissedTrend] = useState(true);
  const [isToastDismissing, setIsToastDismissing] = useState(false);

  const generateFlavorGuideCombination = (answers) => {
    setIsWizardLoading(true);
    setWizardStep(4);

    setTimeout(() => {
      // 1. Base
      const availableBases = bases.length > 0 ? bases.filter(b => b.active) : [];
      const selectedBase = availableBases.length > 0 
        ? availableBases[Math.floor(Math.random() * availableBases.length)]
        : { id: 'cono', name: 'Cono de Galleta Crujiente', price: 0.0 };

      // 2. Sabores
      const availableFlavors = flavors.filter(f => f.active);
      
      // Filtrar por Antojo
      const fruityKeys = ['fresa', 'mango', 'maracuya', 'coco'];
      let matchingFlavors = availableFlavors;
      if (answers.antojo === 'fruity') {
        matchingFlavors = availableFlavors.filter(f => fruityKeys.includes(f.id) || f.name.toLowerCase().includes('fresa') || f.name.toLowerCase().includes('mango') || f.name.toLowerCase().includes('maracuy') || f.name.toLowerCase().includes('limon') || f.name.toLowerCase().includes('coco'));
      } else if (answers.antojo === 'creamy') {
        matchingFlavors = availableFlavors.filter(f => !fruityKeys.includes(f.id) && !f.name.toLowerCase().includes('limon'));
      }

      // Si nos quedamos sin sabores tras el filtro, volvemos a la lista completa
      if (matchingFlavors.length === 0) matchingFlavors = availableFlavors;

      // Filtrar por Premium
      if (answers.premium === 'no') {
        matchingFlavors = matchingFlavors.filter(f => !f.isPremium);
      } else if (answers.premium === 'yes') {
        const premiumOnly = matchingFlavors.filter(f => f.isPremium);
        if (premiumOnly.length > 0) matchingFlavors = premiumOnly;
      }
      
      if (matchingFlavors.length === 0) matchingFlavors = availableFlavors;

      // Seleccionar 2 sabores para copa/cono doble
      const selectedScoops = [];
      const numScoops = 2;
      const tempFlavors = [...matchingFlavors];
      
      for (let i = 0; i < numScoops; i++) {
        if (tempFlavors.length > 0) {
          const idx = Math.floor(Math.random() * tempFlavors.length);
          const f = tempFlavors.splice(idx, 1)[0];
          selectedScoops.push({ id: f.id, name: f.name, price: f.price, color: f.color });
        } else if (availableFlavors.length > 0) {
          const f = availableFlavors[Math.floor(Math.random() * availableFlavors.length)];
          selectedScoops.push({ id: f.id, name: f.name, price: f.price, color: f.color });
        }
      }

      // 3. Toppings
      const availableToppings = toppings.length > 0 ? toppings.filter(t => t.active) : [];
      let matchingToppings = availableToppings;
      
      if (answers.topping === 'sweet') {
        matchingToppings = availableToppings.filter(t => {
          const name = t.name.toLowerCase();
          return name.includes('oreo') || name.includes('chispa') || name.includes('galleta') || name.includes('chocolate') || name.includes('crocante') || name.includes('lenteja') || name.includes('sublime');
        });
      } else if (answers.topping === 'fruit_sauce') {
        matchingToppings = availableToppings.filter(t => {
          const name = t.name.toLowerCase();
          return name.includes('fresa') || name.includes('mango') || name.includes('maracuya') || name.includes('salsa') || name.includes('fudge') || name.includes('jalea') || name.includes('leche');
        });
      }

      if (matchingToppings.length === 0) matchingToppings = availableToppings;

      const selectedToppings = [];
      if (matchingToppings.length > 0) {
        const t = matchingToppings[Math.floor(Math.random() * matchingToppings.length)];
        selectedToppings.push({ id: t.id, name: t.name, price: t.price });
      }

      // Calcular precio total
      const basePrice = selectedBase.price || 0.0;
      const scoopsPrice = selectedScoops.reduce((sum, s) => sum + (s.price || 0.0), 0);
      const toppingsPrice = selectedToppings.reduce((sum, t) => sum + (t.price || 0.0), 0);
      const totalPrice = basePrice + scoopsPrice + toppingsPrice;

      setWizardResult({
        base: selectedBase,
        scoops: selectedScoops,
        toppings: selectedToppings,
        price: totalPrice
      });
      setIsWizardLoading(false);
    }, 1200);
  };

  // Ref para estabilizar las dependencias del catálogo en el simulador de tendencias y evitar reinicios constantes
  const trendDataRef = useRef({ activeFlavors, activePacks, literConfig });
  useEffect(() => {
    trendDataRef.current = { activeFlavors, activePacks, literConfig };
  }, [activeFlavors, activePacks, literConfig]);

  // Rotación de sugerencias de carta; no representa ventas reales
  useEffect(() => {
    if (dismissedTrend || tableNumber) return;

    const generateRandomTrend = () => {
      const { activeFlavors, activePacks, literConfig } = trendDataRef.current;
      const eventTypes = ['custom', 'pack', 'liter'];
      const randomType = eventTypes[Math.floor(Math.random() * eventTypes.length)];


      if (randomType === 'custom' && activeFlavors.length > 0) {
        const flavor1 = activeFlavors[Math.floor(Math.random() * activeFlavors.length)];
        const flavor2 = activeFlavors[Math.floor(Math.random() * activeFlavors.length)];
        const hasDouble = Math.random() > 0.4;
        
        let desc = `Prueba: Helado Simple de ${flavor1.name} 🍦`;
        let itemToTry = {
          type: 'custom',
          base: { id: 'cono', name: 'Cono de Galleta Crujiente', price: 0.0 },
          scoops: [{ id: flavor1.id, name: flavor1.name, price: flavor1.price, color: flavor1.color }],
          toppings: [],
          price: flavor1.price,
          quantity: 1,
          name: `Helado Simple de ${flavor1.name}`
        };

        if (hasDouble && flavor1.id !== flavor2.id) {
          desc = `Prueba: Helado Doble de ${flavor1.name} y ${flavor2.name} 🍦`;
          itemToTry = {
            type: 'custom',
            base: { id: 'cono', name: 'Cono de Galleta Crujiente', price: 0.0 },
            scoops: [
              { id: flavor1.id, name: flavor1.name, price: flavor1.price, color: flavor1.color },
              { id: flavor2.id, name: flavor2.name, price: flavor2.price, color: flavor2.color }
            ],
            toppings: [],
            price: flavor1.price + flavor2.price,
            quantity: 1,
            name: `Helado Doble de ${flavor1.name} y ${flavor2.name}`
          };
        }

        return {
          id: Date.now(),
          icon: '🍦',
          title: 'Una idea para tu próximo antojo',
          desc,
          item: itemToTry
        };
      } else if (randomType === 'pack' && activePacks.length > 0) {
        const pack = activePacks[Math.floor(Math.random() * activePacks.length)];
        return {
          id: Date.now(),
          icon: '🎁',
          title: 'Para disfrutar en compañía',
          desc: `${pack.name}: para compartir.`,
          item: {
            type: 'pack',
            id: pack.id,
            name: pack.name,
            price: pack.price,
            items: pack.items,
            image: pack.image || '',
            quantity: 1
          }
        };
      } else if (randomType === 'liter' && literConfig?.active !== false && activeFlavors.length > 0) {
        const flavor = activeFlavors[Math.floor(Math.random() * activeFlavors.length)];
        return {
          id: Date.now(),
          icon: '🏺',
          title: 'Familiar 1 Litro',
          desc: `Para llevar: 1 Litro de Helado sabor ${flavor.name} 🏺`,
          item: {
            type: 'liter',
            price: literConfig?.price || 15.0,
            flavors: [flavor.name],
            toppings: [],
            quantity: 1,
            name: `Helado de 1 Litro (${flavor.name})`,
            image: literConfig?.image || ''
          }
        };
      }
      return null;
    };

    let dismissTimer = null;
    let transitionTimer = null;

    const showNewTrend = () => {
      if (dismissTimer) clearTimeout(dismissTimer);
      if (transitionTimer) clearTimeout(transitionTimer);
      const trend = generateRandomTrend();
      if (trend) {
        setCurrentTrend(trend);
        setIsToastDismissing(false);

        dismissTimer = setTimeout(() => {
          setIsToastDismissing(true);
          transitionTimer = setTimeout(() => {
            setCurrentTrend(null);
            setIsToastDismissing(false);
          }, 350);
        }, (trendsDisplayTime || 6) * 1000);
      }
    };

    const initialTimer = setTimeout(() => {
      showNewTrend();
    }, 4000);

    const interval = setInterval(() => {
      showNewTrend();
    }, (trendsInterval || 25) * 1000);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
      if (dismissTimer) clearTimeout(dismissTimer);
      if (transitionTimer) clearTimeout(transitionTimer);
    };
  }, [dismissedTrend, trendsInterval, trendsDisplayTime, tableNumber]);

  const handleTryTrend = (item) => {
    handleAddToCartWrapped(item);
    if (showAlert) {
      showAlert('¡Añadido al Carrito!', `Se agregó a tu carrito: ${item.name}`, 'success');
    } else {
      alert(`🛒 ¡Se añadió al carrito: ${item.name}!`);
    }
    handleDismissToast();
  };

  const handleDismissToast = () => {
    setIsToastDismissing(true);
    setTimeout(() => {
      setCurrentTrend(null);
      setIsToastDismissing(false);
      setDismissedTrend(true);
    }, 350);
  };

  // Helper for dynamic premium toppings per flavor in the shop catalog
  // Un helado clásico rápido es un helado simple de 1 bola en Cono
  const handleAddClassicToCart = useCallback((flavor) => {
    const customItem = {
      type: 'custom',
      base: { id: 'cono', name: 'Cono de Galleta Crujiente', price: 0.0 },
      scoops: [{ id: flavor.id, name: flavor.name, price: flavor.price, color: flavor.color }],
      toppings: [],
      price: flavor.price,
      quantity: 1,
      name: `Helado Simple de ${flavor.name}`
    };
    handleAddToCartWrapped(customItem);
  }, [handleAddToCartWrapped]);

  const handleAddPackToCart = useCallback((pack) => {
    const packItem = {
      type: 'pack',
      id: pack.id,
      name: pack.name,
      price: pack.price,
      items: pack.items,
      image: pack.image || '',
      quantity: 1
    };
    handleAddToCartWrapped(packItem);
  }, [handleAddToCartWrapped]);

  const handleAddPopsicleToCart = useCallback((popsicle) => {
    handleAddToCartWrapped({
      type: 'popsicle',
      id: popsicle.id,
      name: popsicle.name,
      price: Number(popsicle.price) || 0,
      image: popsicle.image || '',
      quantity: 1
    });
  }, [handleAddToCartWrapped]);

  const renderedCatalog = useMemo(() => {
    const configuredOrder = tableNumber
      ? (shopConfig?.tableCatalogCategories || ['popsicles', 'classic', 'liter', 'packs'])
      : (catalogOrder || ['popsicles', 'classic', 'liter', 'packs']);
    const activeOrder = configuredOrder.includes('popsicles')
      ? configuredOrder
      : ['popsicles', ...configuredOrder];
    return (
      <div className="catalog-grid">
        {activeOrder.map(section => {
          if (section === 'popsicles') {
            return (
              <React.Fragment key="popsicles">
                {(filter === 'all' || filter === 'popsicles') && activePopsicles.map(popsicle => (
                  <article key={popsicle.id} className="glass-card product-card popsicle-card">
                    {popsicle.badge && <span className="product-badge popsicle-badge">{popsicle.badge}</span>}
                    <div className="product-illustration popsicle-illustration">
                      {popsicle.image ? (
                        <img
                          src={popsicle.image}
                          alt={`Paleta artesanal ${popsicle.name}`}
                          width="160"
                          height="220"
                          loading="lazy"
                          decoding="async"
                        />
                      ) : <span className="popsicle-placeholder" aria-hidden="true">🍭</span>}
                    </div>
                    <div className="product-info">
                      <div>
                        <span className="product-kind">PALETA ARTESANAL</span>
                        <h3>{popsicle.name}</h3>
                        <p className="product-desc">{popsicle.description}</p>
                      </div>
                      <div className="product-price-action">
                        <div className="price-tag">S/. {Number(popsicle.price || 0).toFixed(2)}<span> / unidad</span></div>
                        <button
                          type="button"
                          className="add-btn"
                          aria-label={`Agregar paleta ${popsicle.name} al carrito`}
                          onClick={() => handleAddPopsicleToCart(popsicle)}
                        >
                          Agregar
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </React.Fragment>
            );
          }
          if (section === 'liter') {
            return (
              <React.Fragment key="liter">
                {/* 🏺 Mostrar Helado de Litro */}
                {(filter === 'all' || filter === 'liter') && literConfig?.active !== false && (
                  <div className="glass-card product-card" style={{ borderColor: 'var(--primary-color)' }}>
                    <span className="product-badge badge-premium">🏺 Familiar 1L</span>
                    <div className="product-illustration" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '120px' }}>
                      {literConfig?.image ? (
                        <img 
                          src={literConfig.image} 
                          alt="Helado de 1 Litro" 
                          width="200"
                          height="110"
                          decoding="async"
                          style={{ width: '100%', height: '110px', objectFit: 'contain', borderRadius: '8px' }} 
                          loading="lazy"
                        />
                      ) : (
                        <svg viewBox="0 0 100 100" width="90" height="90" style={{ display: 'block', margin: '0 auto' }}>
                          <ellipse cx="50" cy="85" rx="35" ry="6" fill="rgba(0,0,0,0.06)" />
                          <path d="M 22 28 L 30 78 C 30 78, 50 82, 70 78 L 78 28 Z" fill="#f5f6fa" stroke="var(--primary-color)" strokeWidth="2.5" />
                          <ellipse cx="50" cy="28" rx="28" ry="6" fill="none" stroke="var(--primary-color)" strokeWidth="2" />
                          {/* Helado saliendo */}
                          <path d="M 24 28 C 24 15, 50 15, 50 15 C 50 15, 76 15, 76 28 Z" fill="#ff6b81" opacity="0.9" />
                          <rect x="35" y="44" width="30" height="18" rx="2" fill="white" stroke="var(--primary-color)" strokeWidth="0.8" />
                          <text x="50" y="52" fill="var(--primary-color)" fontSize="6" fontWeight="bold" textAnchor="middle">1 LITRO</text>
                        </svg>
                      )}
                    </div>
                    <div className="product-info">
                      <div>
                        <h3>Helado Familiar de 1 Litro</h3>
                        <p className="product-desc">Lleva a casa el mejor helado artesanal. Combina tus sabores favoritos (hasta {literConfig?.maxFlavors || 3} sabores) en un pote de un litro para compartir.</p>
                      </div>
                      <div className="product-price-action">
                        <div className="price-tag">
                          S/. {(literConfig?.price || 15.0).toFixed(2)}
                          <span> / pote</span>
                        </div>
                        <button 
                          className="add-btn" 
                          style={{ backgroundColor: 'var(--primary-color)', fontSize: '0.75rem', width: 'auto', padding: '6px 12px', borderRadius: '12px' }}
                          onClick={() => setView('liter-customizer')}
                        >
                          🎨 Armar
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </React.Fragment>
            );
          }
          if (section === 'classic') {
            return (
              <React.Fragment key="classic">
                {/* Mostrar Helados Clásicos */}
                {(filter === 'all' || filter === 'classic') && activeFlavors.map(flavor => {
                  const isPopular = flavor.isPopular === true;
                  return (
                    <div key={flavor.id} className="glass-card product-card">
                      {isPopular && <span className="product-badge badge-popular">🔥 El Más Pedido</span>}
                      {flavor.isPremium && !isPopular && <span className="product-badge badge-premium">✨ Premium</span>}
                      
                      <div className="product-illustration" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '120px' }}>
                        {flavor.image ? (
                          <img 
                            src={flavor.image} 
                            alt={flavor.name} 
                            width="200"
                            height="110"
                            decoding="async"
                            style={{ width: '100%', height: '110px', objectFit: 'contain', borderRadius: '8px' }} 
                            loading="lazy"
                          />
                        ) : (
                          <DessertPreview compact base={{id: "cono", name: "Cono"}} scoops={[flavor]} />
                        )}
                      </div>

                      <div className="product-info">
                        <div>
                          <h3>{flavor.name}</h3>
                          <p className="product-desc">{flavor.description}</p>
                        </div>
                        <div className="product-price-action">
                          <div className="price-tag">
                            S/. {flavor.price.toFixed(2)}
                            <span> / bola</span>
                          </div>
                          <button 
                            className="add-btn" 
                            title="Añadir helado simple de 1 bola al carrito"
                            onClick={() => handleAddClassicToCart(flavor)}
                          >
                            Agregar
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </React.Fragment>
            );
          }
          if (section === 'packs') {
            return (
              <React.Fragment key="packs">
                {/* Mostrar Packs */}
                {(filter === 'all' || filter === 'packs') && activePacks.map(pack => {
                  const badgeClass = `badge-${pack.badge.toLowerCase().replace(/\s+/g, '-')}`;
                  return (
                    <div key={pack.id} className="glass-card product-card" style={{ borderColor: 'rgba(229, 142, 38, 0.2)' }}>
                      {pack.badge && (
                        <span className={`product-badge ${badgeClass}`}>
                          {pack.badge}
                        </span>
                      )}
                      
                      <div className="product-illustration" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100px' }}>
                        {pack.image ? (
                          <img 
                            src={pack.image} 
                            alt={pack.name} 
                            width="200"
                            height="100"
                            decoding="async"
                            style={{ width: '100%', height: '100px', objectFit: 'contain', borderRadius: '8px' }} 
                            loading="lazy"
                          />
                        ) : (
                          <svg viewBox="0 0 100 100" width="90" height="90" style={{ display: 'block', margin: '0 auto' }}>
                            <defs>
                              <linearGradient id={`boxGrad-${pack.id}`} x1="0" y1="0" x2="1" y2="1">
                                <stop offset="0%" stopColor="#ff4757" />
                                <stop offset="100%" stopColor="#ff1f3b" />
                              </linearGradient>
                              <linearGradient id={`lidGrad-${pack.id}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#ff6b81" />
                                <stop offset="100%" stopColor="#ff3855" />
                              </linearGradient>
                              <linearGradient id={`ribbonGrad-${pack.id}`} x1="0" y1="0" x2="1" y2="1">
                                <stop offset="0%" stopColor="#eccc68" />
                                <stop offset="100%" stopColor="#ff7f50" />
                              </linearGradient>
                              <linearGradient id={`goldGrad-${pack.id}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#ffa502" />
                                <stop offset="100%" stopColor="#ff7f50" />
                              </linearGradient>
                              <filter id={`giftShadow-${pack.id}`} x="-10%" y="-10%" width="120%" height="120%">
                                <feDropShadow dx="0" dy="3" stdDeviation="3" floodOpacity="0.15" />
                              </filter>
                            </defs>
        
                            <ellipse cx="50" cy="88" rx="28" ry="5" fill="rgba(0,0,0,0.1)" />
        
                            <g filter={`url(#giftShadow-${pack.id})`}>
                              <rect x="18" y="42" width="64" height="6" rx="1" fill="rgba(0,0,0,0.15)" />
                              <rect x="22" y="44" width="56" height="40" rx="3" fill={`url(#boxGrad-${pack.id})`} />
                              <rect x="44" y="44" width="12" height="40" fill={`url(#ribbonGrad-${pack.id})`} />
                              <rect x="18" y="34" width="64" height="10" rx="2" fill={`url(#lidGrad-${pack.id})`} />
                              <rect x="44" y="34" width="12" height="10" fill={`url(#ribbonGrad-${pack.id})`} />
                              <path d="M 45 34 C 30 24, 30 12, 45 22 Z" fill={`url(#goldGrad-${pack.id})`} stroke={`url(#goldGrad-${pack.id})`} strokeWidth="0.8" />
                              <path d="M 55 34 C 70 24, 70 12, 55 22 Z" fill={`url(#goldGrad-${pack.id})`} stroke={`url(#goldGrad-${pack.id})`} strokeWidth="0.8" />
                              <path d="M 45 34 C 40 40, 32 45, 34 52" fill="none" stroke={`url(#goldGrad-${pack.id})`} strokeWidth="3" strokeLinecap="round" />
                              <path d="M 55 34 C 60 40, 68 45, 66 52" fill="none" stroke={`url(#goldGrad-${pack.id})`} strokeWidth="3" strokeLinecap="round" />
                              <rect x="43" y="24" width="14" height="10" rx="3" fill={`url(#goldGrad-${pack.id})`} stroke="#d5822b" strokeWidth="0.8" />
                            </g>
                          </svg>
                        )}
                      </div>
                      <div className="product-info">
                        <div>
                          <h3>{pack.name}</h3>
                          <p className="product-desc">{pack.description}</p>
                          <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--primary-color)', marginBottom: '15px' }}>
                            📦 Incluye: {pack.items}
                          </p>
                        </div>
                        <div className="product-price-action">
                          <div className="price-tag">
                            S/. {pack.price.toFixed(2)}
                            <div style={{ fontSize: '0.75rem', color: 'var(--success)', fontWeight: 600 }}>
                              {pack.discountText}
                            </div>
                          </div>
                          <button 
                            className="add-btn" 
                            style={{ backgroundColor: 'var(--secondary-color)' }}
                            title="Añadir pack al carrito"
                            onClick={() => handleAddPackToCart(pack)}
                          >
                            Agregar
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </React.Fragment>
            );
          }
          return null;
        })}
      </div>
    );
  }, [tableNumber, catalogOrder, filter, literConfig, activeFlavors, activePacks, activePopsicles, setView, handleAddClassicToCart, handleAddPackToCart, handleAddPopsicleToCart, shopConfig]);

  const resolvedHeroImage = storeHeroImage || '/hero-friozo-v2.png';

  return (
    <div className="customer-shop">
      {isTableOccupiedByOther ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh', padding: '20px' }}>
          <div className="glass" style={{
            maxWidth: '450px',
            width: '100%',
            padding: '40px 25px',
            borderRadius: '20px',
            textAlign: 'center',
            border: '1px solid rgba(255, 64, 129, 0.25)',
            boxShadow: '0 15px 35px rgba(0,0,0,0.1)'
          }}>
            <span style={{ fontSize: '3.5rem', display: 'block', marginBottom: '15px' }}>🍽️</span>
            <h2 style={{ fontSize: '1.5rem', color: 'var(--primary-color)', marginBottom: '10px' }}>Mesa Ocupada</h2>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-light)', lineHeight: '1.5', marginBottom: '20px' }}>
              La <strong>Mesa {tableNumber}</strong> ya cuenta con un pedido activo en preparación o consumo.
            </p>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-light)', lineHeight: '1.5', marginBottom: '20px' }}>
              Para realizar un nuevo pedido de autogestión, la mesa debe ser liberada (cobrada o cancelada) por el mesero o caja.
            </p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-primary" 
                style={{ width: '100%', padding: '12px', fontSize: '0.85rem' }}
                onClick={() => {
                  const activeId = localStorage.getItem('helados_active_order_id');
                  if (activeId && setView) {
                    setView('tracker');
                  } else {
                    window.alert("No tienes un pedido registrado en este dispositivo para esta mesa.");
                  }
                }}
              >
                🔍 Rastrear mi pedido activo
              </button>
              
              <button
                type="button"
                className="btn btn-secondary" 
                style={{ width: '100%', padding: '12px', fontSize: '0.85rem' }}
                onClick={() => {
                  if (setTableNumber) setTableNumber(null);
                  localStorage.removeItem('helados_table_number');
                }}
              >
                🛍️ Ver carta para llevar / Recojo en barra
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Hero Section */}
          <section className="hero">
        <div className="hero-text">
          {tableOrdersEnabled && tableNumber && occupiedTables.includes(String(tableNumber)) && localStorage.getItem('helados_active_order_table') === String(tableNumber) && (
            <div 
              style={{
                background: 'linear-gradient(135deg, rgba(46, 204, 113, 0.15), rgba(46, 204, 113, 0.05))',
                border: '1px solid rgba(46, 204, 113, 0.3)',
                color: '#27ae60',
                padding: '10px 15px',
                borderRadius: '8px',
                fontSize: '0.82rem',
                fontWeight: 'bold',
                marginBottom: '15px',
                textAlign: 'center',
                cursor: 'pointer',
                display: 'block'
              }}
              onClick={() => {
                const activeId = localStorage.getItem('helados_active_order_id');
                if (activeId && setView) setView('tracker');
              }}
            >
              🍦 Tienes un pedido activo para esta mesa. ¡Toca aquí para ver el seguimiento en tiempo real!
            </div>
          )}

          {tableOrdersEnabled && tableNumber && (
            <div style={{
              background: 'rgba(255, 64, 129, 0.12)',
              border: '1px solid rgba(255, 64, 129, 0.3)',
              color: 'var(--primary-color)',
              padding: '8px 12px',
              borderRadius: '8px',
              fontSize: '0.8rem',
              fontWeight: 'bold',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              marginBottom: '15px'
            }}>
              🍽️ Pedido vinculado a la Mesa {tableNumber}
              <button 
                type="button" 
                onClick={() => {
                  if (setTableNumber) setTableNumber(null);
                  localStorage.removeItem('helados_table_number');
                }} 
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  color: 'var(--danger)', 
                  fontWeight: 'bold', 
                  cursor: 'pointer',
                  marginLeft: '10px',
                  padding: 0
                }}
              >
                (Cambiar a Llevar)
              </button>
            </div>
          )}
          <div className="hero-eyebrow">
            <span className="hero-live-dot" aria-hidden="true"></span>
            PEQUEÑOS MOMENTOS · GRANDES ANTOJOS
          </div>
          <h1>
            La vida pide <span>otro helado.</span>
          </h1>
          <p className="hero-description">
            Una bola de tu favorito. Otra de ese que querías probar. En <strong>{storeName}</strong>, los mejores momentos se sirven a tu gusto.
          </p>
          <div className="hero-cta">
            <button className="btn btn-primary hero-primary-cta" onClick={() => setView('customizer')}>
              Crear mi helado <span aria-hidden="true">→</span>
            </button>
            <button className="btn btn-secondary" onClick={() => {
              const el = document.getElementById('catalog');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }}>
              Ver antojos
            </button>
          </div>
          <div className="hero-quick-links" aria-label="Acciones rápidas">
            <button 
              className="hero-text-link whatsapp-link" 
              onClick={() => {
                const waUrl = `https://wa.me/${String(storePhone || '51987654321').replace(/\D/g, '')}?text=${encodeURIComponent('¡Hola! Me gustaría hacer una consulta sobre los helados 🍦')}`;
                const waWindow = window.open(waUrl, '_blank', 'noopener,noreferrer');
                if (waWindow) waWindow.opener = null;
              }}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" style={{ verticalAlign: 'middle' }}>
                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.59-4.846c1.66.986 3.284 1.447 4.74 1.448 5.4 0 9.792-4.393 9.795-9.79.002-2.615-1.012-5.074-2.855-6.918C16.483 2.05 14.032.99 11.417.99c-5.402 0-9.794 4.393-9.797 9.79-.001 1.733.456 3.238 1.411 4.887L2.03 20.485l4.616-1.331zM16.518 14.1c-.266-.134-1.577-.777-1.821-.866-.245-.09-.423-.134-.6.134-.178.266-.689.866-.844 1.04-.155.178-.312.2-.578.066-.266-.134-1.124-.414-2.141-1.32-.79-.705-1.326-1.577-1.482-1.844-.155-.266-.017-.41.117-.543.12-.12.266-.312.4-.467.135-.156.18-.266.27-.444.09-.178.045-.334-.022-.467-.067-.134-.6-1.446-.823-1.979-.217-.523-.454-.452-.6-.452h-.51c-.178 0-.467.067-.71.334-.244.267-.933.912-.933 2.224 0 1.312.955 2.58 1.088 2.757.135.178 1.88 2.87 4.554 4.024.637.275 1.13.438 1.517.56.64.204 1.22.175 1.68.107.513-.075 1.577-.644 1.8-.1.223-.545.223-1.013.156-1.1zm-.058-.058v.058-.058z"/>
              </svg>
              <span>Preguntar por WhatsApp</span>
            </button>
            {shopConfig?.locationTrackingEnabled !== false && (
              <button className="hero-text-link" onClick={() => setView('locations')}>
                <span aria-hidden="true">📍</span> Ver carritos cercanos
              </button>
            )}
          </div>
          <div className="hero-proof" aria-label="Beneficios de la tienda">
            <div className="hero-proof-item">
              <strong>Desde S/. {startingPrice}</strong>
              <span>placer sin vueltas</span>
            </div>
            <div className="hero-proof-item">
              <strong>Hecho para ti</strong>
              <span>mezcla sin reglas</span>
            </div>
            <div className="hero-proof-item">
              <strong>Listo en minutos</strong>
              <span>pide, recibe, disfruta</span>
            </div>
          </div>
        </div>
        <div className="hero-image-container">
          <div className="hero-circle-bg"></div>
          <div className="hero-sticker hero-sticker-top" aria-hidden="true">
            <strong>Artesanal</strong>
            <span>A TU GUSTO</span>
          </div>
          <div className="hero-graphic-premium">
            {resolvedHeroImage ? (
              <img 
                src={resolvedHeroImage}
                alt="Cono Friozo con tres bolas de helado artesanal, frutas y chocolate"
                style={{ 
                  width: '100%', 
                  height: 'auto', 
                  maxHeight: '380px', 
                  objectFit: 'contain',
                  filter: 'drop-shadow(0 20px 35px rgba(255,107,129,0.25))' 
                }} 
              />
            ) : (
              <svg viewBox="0 0 200 240" width="100%" height="100%" style={{ display: 'block', maxHeight: '380px', filter: 'drop-shadow(0 20px 35px rgba(255,107,129,0.25))' }}>
                <defs>
                  <linearGradient id="coneGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#f3a683" />
                    <stop offset="50%" stopColor="#e19e75" />
                    <stop offset="100%" stopColor="#cf8a4f" />
                  </linearGradient>
                  <linearGradient id="chocolateGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#74451c" />
                    <stop offset="100%" stopColor="#4e2c0e" />
                  </linearGradient>
                  <linearGradient id="strawberryGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ff8a9a" />
                    <stop offset="100%" stopColor="#ff4757" />
                  </linearGradient>
                  <linearGradient id="mangoGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ffca28" />
                    <stop offset="100%" stopColor="#ffa000" />
                  </linearGradient>
                  <linearGradient id="creamGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ffffff" />
                    <stop offset="100%" stopColor="#f1f2f6" />
                  </linearGradient>
                </defs>

                <g opacity="0.6">
                  <circle cx="20" cy="50" r="3" fill="#ff4757" />
                  <circle cx="180" cy="90" r="4" fill="#ffa000" />
                  <rect x="30" y="150" width="8" height="3" rx="1.5" fill="#2ecc71" transform="rotate(30 30 150)" />
                  <rect x="170" y="40" width="10" height="4" rx="2" fill="#3498db" transform="rotate(-15 170 40)" />
                </g>

                {/* CONE */}
                <path d="M 55 130 L 100 230 L 145 130 Z" fill="url(#coneGrad)" />
                <path d="M 62 130 L 100 215 M 72 130 L 100 195 M 82 130 L 100 175 M 92 130 L 100 155" stroke="#7a4b1c" strokeWidth="1.2" opacity="0.25" strokeLinecap="round" />
                <path d="M 138 130 L 100 215 M 128 130 L 100 195 M 118 130 L 100 175 M 108 130 L 100 155" stroke="#7a4b1c" strokeWidth="1.2" opacity="0.25" strokeLinecap="round" />
                
                {/* Chocolate Scoop */}
                <circle cx="100" cy="125" r="38" fill="url(#chocolateGrad)" />
                <path d="M 64 135 C 70 145, 80 145, 84 135 C 88 145, 96 148, 102 136 C 108 148, 116 148, 120 136 C 124 144, 134 142, 137 132" fill="url(#chocolateGrad)" />
                
                {/* Strawberry Scoop */}
                <circle cx="85" cy="95" r="32" fill="url(#strawberryGrad)" />
                <ellipse cx="78" cy="82" rx="8" ry="4" fill="#fff" opacity="0.35" transform="rotate(-20 78 82)" />
                
                {/* Mango Scoop */}
                <circle cx="118" cy="92" r="30" fill="url(#mangoGrad)" />
                <ellipse cx="112" cy="80" rx="7" ry="3" fill="#fff" opacity="0.35" transform="rotate(-15 112 80)" />

                {/* Whipped Cream */}
                <path d="M 75 75 Q 85 55 100 55 Q 115 55 125 75 Q 100 80 75 75 Z" fill="url(#creamGrad)" />
                <path d="M 88 65 Q 100 40 100 40 Q 112 40 112 65 Z" fill="url(#creamGrad)" />
                
                {/* Syrup */}
                <path d="M 85 55 Q 100 68 115 55" fill="none" stroke="#4e2c0e" strokeWidth="4" strokeLinecap="round" />
                <path d="M 92 48 Q 100 58 108 48" fill="none" stroke="#4e2c0e" strokeWidth="4" strokeLinecap="round" />

                {/* Cherry */}
                <circle cx="100" cy="30" r="12" fill="#d63031" />
                <circle cx="96" cy="26" r="3" fill="#fff" opacity="0.6" />
                <path d="M 100 30 Q 112 15 125 10" fill="none" stroke="#2d3436" strokeWidth="2" strokeLinecap="round" />

                {/* Sprinkles */}
                <rect x="70" y="90" width="5" height="2" rx="1" fill="#fff" transform="rotate(45 70 90)" />
                <rect x="85" y="105" width="5" height="2" rx="1" fill="#ffa000" transform="rotate(-30 85 105)" />
                <rect x="75" y="102" width="5" height="2" rx="1" fill="#2ecc71" transform="rotate(15 75 102)" />
                <rect x="120" y="92" width="5" height="2" rx="1" fill="#fff" transform="rotate(-15 120 92)" />
                <rect x="110" y="100" width="5" height="2" rx="1" fill="#ff4757" transform="rotate(60 110 100)" />
              </svg>
            )}
          </div>
          <div className="hero-sticker hero-sticker-bottom">
            <span className="hero-sticker-icon" aria-hidden="true">✦</span>
            <div>
              <strong>Un poquito de felicidad.</strong>
              <span>El toque final lo eliges tú</span>
            </div>
          </div>
        </div>
      </section>

      <div className="crave-marquee" aria-label="Beneficios de Friozo">
        <div className="crave-marquee-track">
          <span>HECHO AL MOMENTO</span><b>✦</b>
          <span>MEZCLAS A TU GUSTO</span><b>✦</b>
          <span>DELIVERY RÁPIDO</span><b>✦</b>
          <span>UNA CUCHARADA MÁS</span><b>✦</b>
        </div>
      </div>

      {/* BANNER DELIVERY GRATIS */}
      {!tableNumber && freeDeliveryEnabled && parseFloat(freeDeliveryThreshold || 0) > 0 && (
        <div className="delivery-banner">
          <span className="delivery-banner-icon" aria-hidden="true">🚚</span>
          <div className="delivery-banner-copy">
            <strong>Delivery gratis desde S/. {parseFloat(freeDeliveryThreshold).toFixed(2)}</strong>
          {deliveryCampaignText && (
              <p>{deliveryCampaignText}</p>
          )}
          </div>
          <button type="button" onClick={() => document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' })}>
            Ver carta <span aria-hidden="true">→</span>
          </button>
        </div>
      )}

      {/* Catálogo */}
      <section id="catalog" className="catalog-section">
        <div className="catalog-heading">
          <div>
            <span className="section-kicker">TU PRÓXIMO ANTOJO</span>
            <h2 className="section-title">¿Cuál te provoca?</h2>
            <p className="section-subtitle">Paletas frutales, helados cremosos y mezclas sin miedo. Elige uno o inventa el tuyo.</p>
          </div>
          <span className="catalog-count">
            {activeFlavors.length + activePacks.length + activePopsicles.length + (literConfig?.active !== false ? 1 : 0)} opciones
          </span>
        </div>

        {/* Filtros */}
        {(!tableNumber || tableCategories.length > 1) && (
          <div className="catalog-filters">
            {(!tableNumber || tableCategories.length > 1) && (
              <button 
                className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
                onClick={() => setFilter('all')}
                aria-pressed={filter === 'all'}
              >
                🍨 Todo
              </button>
            )}
            {(!tableNumber || tableCategories.includes('classic')) && (
              <button 
                className={`filter-btn ${filter === 'classic' ? 'active' : ''}`}
                onClick={() => setFilter('classic')}
                aria-pressed={filter === 'classic'}
              >
                🍦 Helados Simples
              </button>
            )}
            {(!tableNumber || tableCategories.includes('popsicles')) && (
              <button 
                className={`filter-btn ${filter === 'popsicles' ? 'active' : ''}`}
                onClick={() => setFilter('popsicles')}
                aria-pressed={filter === 'popsicles'}
              >
                🍭 Paletas
              </button>
            )}
            {(!tableNumber || tableCategories.includes('liter')) && (
              <button 
                className={`filter-btn ${filter === 'liter' ? 'active' : ''}`}
                onClick={() => setFilter('liter')}
                aria-pressed={filter === 'liter'}
              >
                🏺 Potes de Litro
              </button>
            )}
            {(!tableNumber || tableCategories.includes('packs')) && (
              <button 
                className={`filter-btn ${filter === 'packs' ? 'active' : ''}`}
                onClick={() => setFilter('packs')}
                aria-pressed={filter === 'packs'}
              >
                🎁 Packs Combos
              </button>
            )}
          </div>
        )}

        {/* Grid de Productos */}
        {renderedCatalog}
      </section>

      <section className="order-paths" aria-label="Formas de elegir tu helado">
        <article className="order-path-card order-path-card-primary">
          <span className="order-path-kicker">CERO HELADOS ABURRIDOS</span>
          <h2>Tu antojo no viene de fábrica.</h2>
          <p>Elige base, bolas, toppings y salsas. Tú rompes las reglas; nosotros lo hacemos irresistible.</p>
          <button className="btn btn-primary" onClick={() => setView('customizer')}>
            Crear mi mezcla <span aria-hidden="true">→</span>
          </button>
        </article>

        <button type="button" className="order-path-card order-path-card-guide" onClick={() => {
          setWizardStep(1);
          setWizardAnswers({ antojo: null, premium: null, topping: null });
          setWizardResult(null);
          setShowWizard(true);
        }}>
          <span className="order-path-icon" aria-hidden="true">✨</span>
          <div className="order-path-guide-copy">
            <span className="order-path-kicker">DÉJATE TENTAR</span>
            <h3>Te encontramos la mezcla perfecta</h3>
            <p>Tres preguntas. Una recomendación peligrosamente rica.</p>
          </div>
          <span className="order-path-arrow" aria-hidden="true">→</span>
        </button>
      </section>

      {/* Testimonios y Reseñas Verificadas */}
      {!tableNumber && testimonials && testimonials.length > 0 && (
        <section className="testimonials-section">
          <span className="section-kicker">AMOR A PRIMERA CUCHARADA</span>
          <h2 className="section-title">La gente vuelve por esto</h2>
          <p className="section-subtitle">Experiencias reales de quienes ya cayeron en la tentación.</p>
          
          <div className="testimonials-grid">
            {testimonials.map((item, idx) => {
              const stars = '⭐'.repeat(item.rating || 5);
              const initials = item.initials || (item.name ? item.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'U');
              const bgColor = item.color || 'var(--primary-color)';
              return (
                <div key={item.id || idx} className="glass-card testimonial-card">
                  <div className="testimonial-rating">{stars}</div>
                  <p className="testimonial-text">"{item.text}"</p>
                  <div className="testimonial-user">
                    <div className="testimonial-avatar" style={{ backgroundColor: bgColor }}>{initials}</div>
                    <div>
                      <h4 className="testimonial-name">{item.name}</h4>
                      <span className="testimonial-badge">✓ Compra Verificada</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Modal de guía de sabores */}
      {showWizard && (
        <div className="sabor-omatic-overlay">
          <div className="glass sabor-omatic-modal">
            <div className="sabor-omatic-header">
              <h3>🧠 Guía de sabores</h3>
              <button className="sabor-omatic-close" onClick={() => setShowWizard(false)} aria-label="Cerrar guía">&times;</button>
            </div>
            <div className="sabor-omatic-body">
              {/* Progress bar */}
              <div className="sabor-omatic-progress">
                <div 
                  className="sabor-omatic-progress-fill" 
                  style={{ width: `${(wizardStep - 1) * 33.33}%` }}
                ></div>
              </div>

              {/* Paso 1: Antojo */}
              {wizardStep === 1 && (
                <>
                  <div className="sabor-omatic-question-title">¿Qué tipo de sabor te provoca hoy?</div>
                  <div className="sabor-omatic-options">
                    <button 
                      className="sabor-omatic-option-btn"
                      onClick={() => {
                        setWizardAnswers(prev => ({ ...prev, antojo: 'creamy' }));
                        setWizardStep(2);
                      }}
                    >
                      <span className="sabor-omatic-option-emoji">🍫</span>
                      <div className="sabor-omatic-option-text">
                        <div>Dulce y Cremoso</div>
                        <div style={{ fontSize: '0.75rem', fontWeight: 400, opacity: 0.8 }}>Chocolate, Vainilla, Lúcuma y más</div>
                      </div>
                    </button>
                    <button 
                      className="sabor-omatic-option-btn"
                      onClick={() => {
                        setWizardAnswers(prev => ({ ...prev, antojo: 'fruity' }));
                        setWizardStep(2);
                      }}
                    >
                      <span className="sabor-omatic-option-emoji">🍓</span>
                      <div className="sabor-omatic-option-text">
                        <div>Fresco y Frutal</div>
                        <div style={{ fontSize: '0.75rem', fontWeight: 400, opacity: 0.8 }}>Fresa, Mango, Maracuyá, Limón...</div>
                      </div>
                    </button>
                  </div>
                </>
              )}

              {/* Paso 2: Premium */}
              {wizardStep === 2 && (
                <>
                  <div className="sabor-omatic-question-title">¿Te gustaría incluir sabores Premium en la mezcla?</div>
                  <div className="sabor-omatic-options">
                    <button 
                      className="sabor-omatic-option-btn"
                      onClick={() => {
                        setWizardAnswers(prev => ({ ...prev, premium: 'yes' }));
                        setWizardStep(3);
                      }}
                    >
                      <span className="sabor-omatic-option-emoji">🌟</span>
                      <div className="sabor-omatic-option-text">
                        <div>¡Sí! Sorpréndeme con algo especial</div>
                        <div style={{ fontSize: '0.75rem', fontWeight: 400, opacity: 0.8 }}>Incluye nuestros sabores exclusivos</div>
                      </div>
                    </button>
                    <button 
                      className="sabor-omatic-option-btn"
                      onClick={() => {
                        setWizardAnswers(prev => ({ ...prev, premium: 'no' }));
                        setWizardStep(3);
                      }}
                    >
                      <span className="sabor-omatic-option-emoji">🍦</span>
                      <div className="sabor-omatic-option-text">
                        <div>Solo clásicos de siempre</div>
                        <div style={{ fontSize: '0.75rem', fontWeight: 400, opacity: 0.8 }}>Los favoritos tradicionales</div>
                      </div>
                    </button>
                  </div>
                </>
              )}

              {/* Paso 3: Topping */}
              {wizardStep === 3 && (
                <>
                  <div className="sabor-omatic-question-title">¿Cómo te gustaría decorar tu helado?</div>
                  <div className="sabor-omatic-options">
                    <button 
                      className="sabor-omatic-option-btn"
                      onClick={() => {
                        const answers = { ...wizardAnswers, topping: 'sweet' };
                        setWizardAnswers(answers);
                        generateFlavorGuideCombination(answers);
                      }}
                    >
                      <span className="sabor-omatic-option-emoji">🍪</span>
                      <div className="sabor-omatic-option-text">
                        <div>Galletas & Chocolates</div>
                        <div style={{ fontSize: '0.75rem', fontWeight: 400, opacity: 0.8 }}>Chispas, Oreos y trozos crocantes</div>
                      </div>
                    </button>
                    <button 
                      className="sabor-omatic-option-btn"
                      onClick={() => {
                        const answers = { ...wizardAnswers, topping: 'fruit_sauce' };
                        setWizardAnswers(answers);
                        generateFlavorGuideCombination(answers);
                      }}
                    >
                      <span className="sabor-omatic-option-emoji">🍒</span>
                      <div className="sabor-omatic-option-text">
                        <div>Salsas & Frutos</div>
                        <div style={{ fontSize: '0.75rem', fontWeight: 400, opacity: 0.8 }}>Jarabes dulces y mermeladas</div>
                      </div>
                    </button>
                    <button 
                      className="sabor-omatic-option-btn"
                      onClick={() => {
                        const answers = { ...wizardAnswers, topping: 'surprise' };
                        setWizardAnswers(answers);
                        generateFlavorGuideCombination(answers);
                      }}
                    >
                      <span className="sabor-omatic-option-emoji">🎉</span>
                      <div className="sabor-omatic-option-text">
                        <div>¡Sorpréndeme con lo que sea!</div>
                        <div style={{ fontSize: '0.75rem', fontWeight: 400, opacity: 0.8 }}>Una combinación completamente aleatoria</div>
                      </div>
                    </button>
                  </div>
                </>
              )}

              {/* Paso 4: Cargando y Resultado */}
              {wizardStep === 4 && (
                <>
                  {isWizardLoading ? (
                    <div className="sabor-omatic-loading">
                      <div className="som-spinner">🍦</div>
                      <h4 style={{ fontFamily: 'var(--font-title)' }}>Cocinando tu helado ideal...</h4>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-light)', marginTop: '5px' }}>
                        Combinando bases, sabores y toppings seleccionados
                      </p>
                    </div>
                  ) : (
                    wizardResult && (
                      <div className="sabor-omatic-result">
                        <div className="sabor-omatic-result-card">
                          <div className="sabor-omatic-result-title">✨ ¡Combinación Perfecta Lista! ✨</div>
                          <div className="sabor-omatic-result-details">
                            <p><strong>Base:</strong> {wizardResult.base.name}</p>
                            <p><strong>Sabores:</strong> {wizardResult.scoops.map(s => s.name).join(' y ')}</p>
                            {wizardResult.toppings.length > 0 ? (
                              <p><strong>Topping:</strong> {wizardResult.toppings.map(t => t.name).join(', ')}</p>
                            ) : (
                              <p>Sin toppings adicionales</p>
                            )}
                          </div>
                          <div className="sabor-omatic-result-price">
                            Total: S/. {parseFloat(wizardResult.price).toFixed(2)}
                          </div>
                        </div>
                        <div className="sabor-omatic-actions">
                          <button 
                            className="btn btn-primary" 
                            style={{ flex: 1 }}
                            onClick={() => {
                              const customItem = {
                                type: 'custom',
                                base: wizardResult.base,
                                scoops: wizardResult.scoops,
                                toppings: wizardResult.toppings,
                                price: wizardResult.price,
                                quantity: 1,
                                name: `Guía de sabores: ${wizardResult.scoops.map(s => s.name).join(' + ')}`
                              };
                              handleAddToCartWrapped(customItem);
                              setShowWizard(false);
                              if (showAlert) {
                                showAlert('¡Carrito Actualizado!', 'Tu helado personalizado sugerido por la guía de sabores ha sido añadido al carrito.', 'success');
                              } else {
                                alert('¡Añadido al carrito con éxito!');
                              }
                            }}
                          >
                            🛒 Comprar Helado
                          </button>
                          <button 
                            className="btn btn-secondary" 
                            onClick={() => {
                              setWizardStep(1);
                              setWizardAnswers({ antojo: null, premium: null, topping: null });
                              setWizardResult(null);
                            }}
                          >
                            🔁 Repetir
                          </button>
                        </div>
                      </div>
                    )
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TENDENCIAS EN VIVO TOAST (Prueba Social y FOMO sin geolocalización) */}
      {currentTrend && (
        <div className={`glass tendencias-toast ${isToastDismissing ? 'dismissing' : ''}`}>
          <div className="tendencias-icon">{currentTrend.icon}</div>
          <div className="tendencias-content">
            <div className="tendencias-title">{currentTrend.title}</div>
            <div className="tendencias-desc">{currentTrend.desc}</div>
            <button 
              className="tendencias-action-btn"
              onClick={() => handleTryTrend(currentTrend.item)}
            >
              Probar este 🍦
            </button>
          </div>
          <button className="tendencias-close" onClick={handleDismissToast}>&times;</button>
        </div>
      )}

      {/* ATENCIÓN EN MESA - BOTÓN FLOTANTE Y DIÁLOGO */}
      {tableOrdersEnabled && tableNumber && (
        <>
          <button
            onClick={() => setShowCallModal(true)}
            className={`waiter-call-btn ${myActiveCall ? 'active' : ''}`}
            title="Llamar al Mozo"
          >
            {myActiveCall ? '🔔' : '🛎️'}
          </button>
        </>
      )}

      {showCallModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
          animation: 'fadeIn 0.25s ease'
        }}>
          <div className="glass" style={{
            width: '90%',
            maxWidth: '360px',
            padding: '24px',
            borderRadius: '16px',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            background: 'var(--bg-secondary)',
            textAlign: 'center',
            boxShadow: '0 16px 36px rgba(0,0,0,0.25)',
            transform: 'scale(1)',
            transition: 'all 0.3s'
          }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '1.25rem', color: 'var(--primary-color)' }}>🛎️ Atención en Mesa {tableNumber}</h3>
            
            {myActiveCall ? (
              <div style={{ margin: '15px 0 0 0' }}>
                <div style={{
                  width: '56px',
                  height: '56px',
                  lineHeight: '56px',
                  borderRadius: '50%',
                  background: 'rgba(255, 71, 87, 0.1)',
                  color: '#ff4757',
                  fontSize: '1.8rem',
                  margin: '0 auto 12px auto',
                  animation: 'pulse-glowing 1.5s infinite'
                }}>🛎️</div>
                <p style={{ fontSize: '0.8rem', fontWeight: 'bold', margin: '0 0 4px 0', color: 'var(--text-light)' }}>Solicitud Activa:</p>
                <p style={{ fontSize: '0.95rem', fontWeight: '600', margin: '0 0 12px 0', background: 'rgba(0,0,0,0.03)', padding: '8px', borderRadius: '8px' }}>
                  {myActiveCall.request}
                </p>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-light)', marginBottom: '15px' }}>
                  El personal ya recibió tu solicitud y se dirige a atenderte.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <button
                    onClick={handleCancelCall}
                    disabled={isCalling}
                    className="btn btn-secondary"
                    style={{ background: 'rgba(231, 76, 60, 0.08)', color: 'var(--danger)', border: '1px solid rgba(231, 76, 60, 0.15)', width: '100%', padding: '8px', fontSize: '0.8rem' }}
                  >
                    {isCalling ? 'Cancelando...' : '❌ Cancelar Solicitud'}
                  </button>
                  <button
                    onClick={() => setShowCallModal(false)}
                    className="btn btn-secondary"
                    style={{ width: '100%', padding: '8px', fontSize: '0.8rem' }}
                  >
                    Cerrar Ventana
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ margin: '15px 0 0 0' }}>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-light)', marginBottom: '15px' }}>
                  ¿Qué necesitas solicitar al personal de atención?
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <button
                    onClick={() => handleCallWaiter('🙋 Solicitar asistencia de mozo')}
                    disabled={isCalling}
                    className="btn btn-primary"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px', fontSize: '0.85rem', width: '100%', background: 'linear-gradient(135deg, var(--primary-color), #ff6b8b)', border: 'none' }}
                  >
                    <span>🙋</span> Solicitar Mozo
                  </button>

                  <button
                    onClick={() => handleCallWaiter('🥄 Solicitar vasos / cubiertos / servilletas')}
                    disabled={isCalling}
                    className="btn btn-secondary"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px', fontSize: '0.85rem', width: '100%' }}
                  >
                    <span>🥄</span> Vasos y Cubiertos
                  </button>

                  <button
                    onClick={() => handleCallWaiter('💵 Solicitar la cuenta')}
                    disabled={isCalling}
                    className="btn btn-secondary"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px', fontSize: '0.85rem', width: '100%' }}
                  >
                    <span>💵</span> Pedir la Cuenta
                  </button>

                  <button
                    onClick={() => setShowCallModal(false)}
                    className="btn btn-secondary"
                    style={{ width: '100%', padding: '8px', marginTop: '6px', border: 'none', background: 'transparent', color: 'var(--text-light)', fontSize: '0.8rem' }}
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
}
