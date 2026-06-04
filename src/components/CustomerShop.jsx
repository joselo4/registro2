import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { updateSyncedData } from '../utils/supabaseSync';

export default function CustomerShop({ 
  flavors, 
  toppings = [],
  bases = [],
  packs, 
  onAddToCart, 
  setView, 
  storeName,
  freeDeliveryThreshold = 15.0,
  deliveryCampaignText = '¡Arma tu helado con toppings o elige un pack promocional para no pagar envío!',
  literConfig,
  catalogOrder = ['liter', 'classic', 'packs'],
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
  shopConfig = {}
}) {
  const tableCategories = useMemo(() => {
    return shopConfig?.tableCatalogCategories || ['classic', 'liter', 'packs'];
  }, [shopConfig?.tableCatalogCategories]);

  const [filter, setFilter] = useState(() => {
    if (tableNumber) {
      return tableCategories.length > 1 ? 'all' : (tableCategories[0] || 'classic');
    }
    return 'all';
  });

  const activeFlavors = flavors.filter(f => f.active);
  const activePacks = packs.filter(p => p.active);

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

  // --- Estados y Lógica para Sabor-O-Matic ---
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
    setIsCalling(true);
    const cartSummary = getCartSummary();
    const fullRequest = `${type} | Carrito: ${cartSummary}`;

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
  const [dismissedTrend, setDismissedTrend] = useState(false);
  const [isToastDismissing, setIsToastDismissing] = useState(false);

  const generateSaborOMaticCombination = (answers) => {
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

  // Simular tendencias en vivo sin locación geográfica (Seguridad y Privacidad)
  useEffect(() => {
    if (dismissedTrend || tableNumber) return;

    const generateRandomTrend = () => {
      const { activeFlavors, activePacks, literConfig } = trendDataRef.current;
      const eventTypes = ['custom', 'pack', 'liter'];
      const randomType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
      const names = ['Sofía', 'Mateo', 'Valentina', 'Santiago', 'Camila', 'Sebastián', 'Isabella', 'Alejandro', 'Valeria', 'Diego', 'Mariana', 'Lucas', 'Gabriela', 'Nicolás', 'Lucía', 'Samuel', 'Daniela', 'Joaquín', 'Andrea', 'Matías'];
      const clientName = names[Math.floor(Math.random() * names.length)];

      if (randomType === 'custom' && activeFlavors.length > 0) {
        const flavor1 = activeFlavors[Math.floor(Math.random() * activeFlavors.length)];
        const flavor2 = activeFlavors[Math.floor(Math.random() * activeFlavors.length)];
        const hasDouble = Math.random() > 0.4;
        
        let desc = `${clientName} armó: Helado Simple de ${flavor1.name} 🍦`;
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
          desc = `${clientName} armó: Helado Doble de ${flavor1.name} y ${flavor2.name} 🍦`;
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
          title: 'Pedido Reciente',
          desc,
          item: itemToTry
        };
      } else if (randomType === 'pack' && activePacks.length > 0) {
        const pack = activePacks[Math.floor(Math.random() * activePacks.length)];
        return {
          id: Date.now(),
          icon: '🎁',
          title: 'Combo Vendido',
          desc: `¡${clientName} compró un ${pack.name}! 🚀`,
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
          desc: `${clientName} ordenó: 1 Litro de Helado sabor ${flavor.name} 🏺`,
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
    onAddToCart(item);
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
  const renderDynamicToppings = (flavorId) => {
    switch (flavorId) {
      case 'fresa':
        return (
          <g>
            {/* Semillas de fresa natural */}
            <ellipse cx="40" cy="38" rx="0.8" ry="1.5" fill="#80001a" opacity="0.6" transform="rotate(15 40 38)" />
            <ellipse cx="48" cy="32" rx="0.8" ry="1.5" fill="#80001a" opacity="0.6" transform="rotate(-10 48 32)" />
            <ellipse cx="58" cy="36" rx="0.8" ry="1.5" fill="#80001a" opacity="0.6" transform="rotate(25 58 36)" />
            <ellipse cx="62" cy="46" rx="0.8" ry="1.5" fill="#80001a" opacity="0.6" transform="rotate(-15 62 46)" />
            <ellipse cx="38" cy="48" rx="0.8" ry="1.5" fill="#80001a" opacity="0.6" transform="rotate(5 38 48)" />
            <ellipse cx="50" cy="50" rx="0.8" ry="1.5" fill="#80001a" opacity="0.6" transform="rotate(-5 50 50)" />
            {/* Hojita de menta decorativa */}
            <path d="M 50 22 C 45 15, 50 10, 50 10 C 50 10, 55 15, 50 22 Z" fill="#2ed573" />
            <path d="M 49 22 C 45 16, 48 12, 48 12 C 48 12, 52 16, 49 22 Z" fill="#26af5f" />
          </g>
        );
      case 'vainilla':
        return (
          <g>
            {/* Puntos de vaina de vainilla */}
            <circle cx="42" cy="34" r="0.6" fill="#3d3d3d" opacity="0.6" />
            <circle cx="56" cy="38" r="0.6" fill="#3d3d3d" opacity="0.5" />
            <circle cx="48" cy="46" r="0.6" fill="#3d3d3d" opacity="0.6" />
            <circle cx="36" cy="44" r="0.6" fill="#3d3d3d" opacity="0.5" />
            <circle cx="62" cy="42" r="0.6" fill="#3d3d3d" opacity="0.6" />
            {/* Salsa de caramelo suave */}
            <path d="M 33 34 Q 45 42 50 34 T 67 38" fill="none" stroke="#d5822b" strokeWidth="1.5" strokeLinecap="round" opacity="0.85" />
          </g>
        );
      case 'mango':
        return (
          <g>
            {/* Veteado de salsa de mango */}
            <path d="M 30 38 Q 42 26 50 38 T 68 40" fill="none" stroke="#ffa502" strokeWidth="2" strokeLinecap="round" opacity="0.95" />
            <path d="M 34 46 Q 48 38 64 48" fill="none" stroke="#ffa502" strokeWidth="2.5" strokeLinecap="round" opacity="0.95" />
            {/* Cubito de mango */}
            <rect x="46" y="16" width="8" height="8" rx="2" fill="#ffa502" transform="rotate(20 50 20)" stroke="#ff7f50" strokeWidth="0.6" />
            <rect x="47" y="17" width="6" height="6" rx="1.5" fill="#ffbe76" transform="rotate(20 50 20)" />
          </g>
        );
      case 'maracuya':
        return (
          <g>
            {/* Pulpa dorada y pepitas negras de maracuyá */}
            <path d="M 32 35 Q 46 22 66 32" fill="none" stroke="#ffa502" strokeWidth="2.5" strokeLinecap="round" opacity="0.9" />
            <path d="M 38 48 Q 50 38 62 48" fill="none" stroke="#ffa502" strokeWidth="2" strokeLinecap="round" opacity="0.9" />
            <path d="M 42 32 C 40 32, 40 35, 43 35 C 44 35, 44 32, 42 32" fill="#2d3436" />
            <path d="M 52 38 C 50 38, 50 41, 53 41 C 54 41, 54 38, 52 38" fill="#2d3436" />
            <path d="M 58 46 C 56 46, 56 49, 59 49 C 60 49, 60 46, 58 46" fill="#2d3436" />
          </g>
        );
      case 'menta':
        return (
          <g>
            {/* Chispitas de chocolate crocante */}
            <rect x="36" y="32" width="3" height="3" fill="#2d1d0f" rx="0.5" transform="rotate(15 36 32)" />
            <rect x="48" y="38" width="2.5" height="2.5" fill="#2d1d0f" rx="0.5" transform="rotate(45 48 38)" />
            <rect x="58" y="30" width="3" height="3" fill="#2d1d0f" rx="0.5" transform="rotate(10 58 30)" />
            <rect x="62" y="44" width="2.5" height="2.5" fill="#2d1d0f" rx="0.5" transform="rotate(30 62 44)" />
            <rect x="42" y="46" width="3" height="3" fill="#2d1d0f" rx="0.5" transform="rotate(80 42 46)" />
            <rect x="52" y="48" width="2.8" height="2.8" fill="#2d1d0f" rx="0.5" transform="rotate(-15 52 48)" />
          </g>
        );
      case 'lucuma':
        return (
          <g>
            {/* Hilos de chocolate fudge oscuro sobre lúcuma */}
            <path d="M 30 36 Q 44 48 50 32 T 68 38" fill="none" stroke="#2d1d0f" strokeWidth="2" strokeLinecap="round" opacity="0.9" />
            <path d="M 33 46 Q 50 38 65 48" fill="none" stroke="#2d1d0f" strokeWidth="2" strokeLinecap="round" opacity="0.9" />
          </g>
        );
      case 'chocolate':
        return (
          <g>
            {/* Drip brilloso de chocolate belga */}
            <path d="M 32 35 Q 46 22 66 32" fill="none" stroke="#1e172e" strokeWidth="2.5" strokeLinecap="round" opacity="0.8" />
            <path d="M 46 24 Q 50 38 52 46 Q 53 50 50 50 Q 47 50 48 46 Z" fill="#1e172e" />
            <path d="M 36 28 Q 38 36 39 42 Q 40 45 38 45 Q 36 45 37 42 Z" fill="#1e172e" />
            <path d="M 49 40 Q 50 45 49 47" stroke="white" strokeWidth="0.5" opacity="0.4" strokeLinecap="round" />
          </g>
        );
      case 'coco':
        return (
          <g>
            {/* Coco rallado espolvoreado */}
            <line x1="38" y1="32" x2="43" y2="34" stroke="#ffffff" strokeWidth="1.2" strokeLinecap="round" />
            <line x1="48" y1="36" x2="52" y2="35" stroke="#ffffff" strokeWidth="1.2" strokeLinecap="round" />
            <line x1="58" y1="32" x2="61" y2="36" stroke="#ffffff" strokeWidth="1.2" strokeLinecap="round" />
            <line x1="35" y1="44" x2="40" y2="46" stroke="#ffffff" strokeWidth="1.2" strokeLinecap="round" />
            <line x1="52" y1="48" x2="56" y2="46" stroke="#ffffff" strokeWidth="1.2" strokeLinecap="round" />
            <line x1="60" y1="44" x2="64" y2="42" stroke="#ffffff" strokeWidth="1.2" strokeLinecap="round" />
            <line x1="44" y1="42" x2="48" y2="44" stroke="#ffffff" strokeWidth="1.2" strokeLinecap="round" />
          </g>
        );
      default:
        return null;
    }
  };

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
    onAddToCart(customItem);
  }, [onAddToCart]);

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
    onAddToCart(packItem);
  }, [onAddToCart]);

  const renderedCatalog = useMemo(() => {
    const activeOrder = tableNumber 
      ? (shopConfig?.tableCatalogCategories || ['classic', 'liter', 'packs']) 
      : (catalogOrder || ['liter', 'classic', 'packs']);
    return (
      <div className="catalog-grid">
        {activeOrder.map(section => {
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
                          <svg viewBox="0 0 100 120" width="90" height="108" style={{ display: 'block' }}>
                            <defs>
                              <filter id={`sh-${flavor.id}`} x="-10%" y="-10%" width="120%" height="120%">
                                <feDropShadow dx="0" dy="3" stdDeviation="3" floodOpacity="0.15" />
                              </filter>
                              <radialGradient id={`specular-${flavor.id}`} cx="30%" cy="30%" r="60%" fx="30%" fy="30%">
                                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.8"/>
                                <stop offset="50%" stopColor="#ffffff" stopOpacity="0.2"/>
                                <stop offset="100%" stopColor="#ffffff" stopOpacity="0"/>
                              </radialGradient>
                              <radialGradient id={`shadow-${flavor.id}`} cx="70%" cy="70%" r="70%">
                                <stop offset="0%" stopColor="#000000" stopOpacity="0.35"/>
                                <stop offset="100%" stopColor="#000000" stopOpacity="0"/>
                              </radialGradient>
                              
                              <linearGradient id={`coneGrad-${flavor.id}`} x1="0" y1="0" x2="1" y2="1">
                                <stop offset="0%" stopColor="#f3a683"/>
                                <stop offset="50%" stopColor="#cf8a4f"/>
                                <stop offset="100%" stopColor="#8d5624"/>
                              </linearGradient>
                              
                              <linearGradient id={`coneShadow-${flavor.id}`} x1="0" y1="0" x2="1" y2="0">
                                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.3" />
                                <stop offset="50%" stopColor="#ffffff" stopOpacity="0" />
                                <stop offset="100%" stopColor="#000000" stopOpacity="0.45" />
                              </linearGradient>
                              
                              <clipPath id={`cone-clip-${flavor.id}`}>
                                <path d="M32 63 L50 110 L68 63 Z" />
                              </clipPath>
                            </defs>
                            
                            {/* Sombra base */}
                            <ellipse cx="50" cy="114" rx="20" ry="3.5" fill="rgba(0,0,0,0.08)" />
                            
                            {/* Cono Waffle */}
                            <g filter={`url(#sh-${flavor.id})`}>
                              {/* Base Cone styled with clipPath */}
                              <g clipPath={`url(#cone-clip-${flavor.id})`}>
                                <path d="M32 63 L50 110 L68 63 Z" fill={`url(#coneGrad-${flavor.id})`} />
                                {/* Waffle Grid */}
                                <path d="M 10 30 L 80 100 M 10 40 L 80 110 M 10 20 L 80 90 M 10 10 L 80 80 M 10 50 L 80 120 M 10 0 L 80 70" stroke="#7a4b1c" strokeWidth="0.8" opacity="0.3" />
                                <path d="M 90 30 L 20 100 M 90 40 L 20 110 M 90 20 L 20 90 M 90 10 L 20 80 M 90 50 L 20 120 M 90 0 L 20 70" stroke="#7a4b1c" strokeWidth="0.8" opacity="0.3" />
                                {/* Cone 3D shadow overlay */}
                                <path d="M32 63 L50 110 L68 63 Z" fill={`url(#coneShadow-${flavor.id})`} />
                              </g>
                              {/* Outline borders */}
                              <path d="M32 63 L50 110 L68 63 Z" fill="none" stroke="#7a4b1c" strokeWidth="1" opacity="0.6" />
                            </g>
                            
                            {/* Bola de Helado con brillo 3D y faldón realista */}
                            <g filter={`url(#sh-${flavor.id})`}>
                              <circle cx="50" cy="46" r="24" fill={flavor.color} />
                              <circle cx="50" cy="46" r="24" fill={`url(#shadow-${flavor.id})`} />
                              <circle cx="50" cy="46" r="24" fill={`url(#specular-${flavor.id})`} />
                              <ellipse cx="42" cy="38" rx="8" ry="4" fill="white" opacity="0.25" transform="rotate(-15, 42, 38)" />
                              
                              {/* Dynamic Toppings */}
                              {renderDynamicToppings(flavor.id)}
                              
                              {/* Wavy Gelato faldón at the bottom of the scoop */}
                              <path d="M 25 58 Q 31 66 37 60 Q 43 67 50 61 Q 57 67 63 60 Q 69 66 75 58 Q 50 72 25 58 Z" fill={flavor.color} />
                              <path d="M 25 58 Q 31 66 37 60 Q 43 67 50 61 Q 57 67 63 60 Q 69 66 75 58 Q 50 72 25 58 Z" fill={`url(#shadow-${flavor.id})`} opacity="0.3" />
                            </g>
                          </svg>
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
                            +
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
                            +
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
  }, [tableNumber, catalogOrder, filter, literConfig, activeFlavors, activePacks, setView, handleAddClassicToCart, handleAddPackToCart, shopConfig]);

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
          <h1>¡Helados Deliciosos desde S/. 1.00!</h1>
          <p>
            Bienvenido a <strong>{storeName}</strong>, la mejor heladería artesanal online. Diseña tu helado favorito bola por bola con tus sabores preferidos, toppings y salsas, o elige nuestros combos de descuento.
          </p>
          <div className="hero-cta">
            <button className="btn btn-primary" onClick={() => setView('customizer')}>
              🎨 Personalizar mi Helado
            </button>
            <button className="btn btn-secondary" onClick={() => {
              const el = document.getElementById('catalog');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }}>
              🍨 Ver Catálogo
            </button>
            <button 
              className="btn btn-secondary" 
              style={{ 
                backgroundColor: '#25D366', 
                color: 'white', 
                borderColor: '#25D366', 
                display: 'inline-flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                gap: '6px',
                cursor: 'pointer',
                margin: 0
              }}
              onClick={() => {
                const waUrl = `https://wa.me/${String(storePhone || '51987654321').replace(/\D/g, '')}?text=${encodeURIComponent('¡Hola! Me gustaría hacer una consulta sobre los helados 🍦')}`;
                window.open(waUrl, '_blank');
              }}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" style={{ verticalAlign: 'middle' }}>
                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.59-4.846c1.66.986 3.284 1.447 4.74 1.448 5.4 0 9.792-4.393 9.795-9.79.002-2.615-1.012-5.074-2.855-6.918C16.483 2.05 14.032.99 11.417.99c-5.402 0-9.794 4.393-9.797 9.79-.001 1.733.456 3.238 1.411 4.887L2.03 20.485l4.616-1.331zM16.518 14.1c-.266-.134-1.577-.777-1.821-.866-.245-.09-.423-.134-.6.134-.178.266-.689.866-.844 1.04-.155.178-.312.2-.578.066-.266-.134-1.124-.414-2.141-1.32-.79-.705-1.326-1.577-1.482-1.844-.155-.266-.017-.41.117-.543.12-.12.266-.312.4-.467.135-.156.18-.266.27-.444.09-.178.045-.334-.022-.467-.067-.134-.6-1.446-.823-1.979-.217-.523-.454-.452-.6-.452h-.51c-.178 0-.467.067-.71.334-.244.267-.933.912-.933 2.224 0 1.312.955 2.58 1.088 2.757.135.178 1.88 2.87 4.554 4.024.637.275 1.13.438 1.517.56.64.204 1.22.175 1.68.107.513-.075 1.577-.644 1.8-.1.223-.545.223-1.013.156-1.1zm-.058-.058v.058-.058z"/>
              </svg>
              <span>Preguntas WhatsApp</span>
            </button>
          </div>
        </div>
        <div className="hero-image-container">
          <div className="hero-circle-bg"></div>
          <div className="hero-graphic">🍦</div>
        </div>
      </section>

      {/* BANNER DELIVERY GRATIS */}
      {!tableNumber && (
        <div 
          className="glass" 
          style={{ 
            padding: '15px 25px', 
            marginBottom: '30px', 
            textAlign: 'center', 
            background: 'linear-gradient(135deg, rgba(46, 204, 113, 0.15) 0%, rgba(52, 152, 219, 0.1) 100%)',
            borderLeft: '5px solid var(--success)',
            borderRadius: 'var(--radius-md)'
          }}
        >
          <span style={{ fontSize: '1.1rem' }}>🚚 <strong>Delivery GRATIS</strong> por compras desde <strong>S/. {parseFloat(freeDeliveryThreshold).toFixed(2)}</strong></span>
          {deliveryCampaignText && (
            <p style={{ fontSize: '0.8rem', color: 'var(--text-light)', marginTop: '4px' }}>{deliveryCampaignText}</p>
          )}
        </div>
      )}

      {/* Banner de Personalización */}
      <section className="glass" style={{ padding: '25px', marginBottom: '40px', textAlign: 'center', background: 'linear-gradient(135deg, rgba(255, 107, 129, 0.08) 0%, rgba(229, 142, 38, 0.08) 100%)' }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '8px' }}>🎨 Arme su helado</h2>
        <p style={{ color: 'var(--text-light)', marginBottom: '15px', maxWidth: '600px', margin: '0 auto 15px', fontSize: '0.9rem' }}>
          Elige cono o copa, añade todas las bolas de tus sabores favoritos y decóralo con toppings y jarabes en cada capa. ¡El helado de tus sueños listo en segundos!
        </p>
        <button className="btn btn-primary" onClick={() => setView('customizer')}>
          👉 Diseñar Helado Personalizado
        </button>
      </section>

      {/* Banner Sabor-O-Matic */}
      <div className="sabor-omatic-banner" onClick={() => {
        setWizardStep(1);
        setWizardAnswers({ antojo: null, premium: null, topping: null });
        setWizardResult(null);
        setShowWizard(true);
      }}>
        <div className="sabor-omatic-banner-content">
          <div className="sabor-omatic-banner-title">
            <span>🧠 Descubre tu helado</span>
          </div>
          <div className="sabor-omatic-banner-desc">
            Prueba nuestro asistente inteligente <strong>Sabor-O-Matic</strong>. Él diseñará el helado perfecto para tu antojo en 3 preguntas rápidas.
          </div>
        </div>
        <button className="btn btn-secondary" style={{ whiteSpace: 'nowrap', margin: 0, padding: '10px 16px' }}>
          ✨ Iniciar
        </button>
      </div>

      {/* Catálogo */}
      <section id="catalog" style={{ scrollMarginTop: '100px' }}>
        <h2 className="section-title">Nuestra Carta Helada</h2>
        <p className="section-subtitle">Frescura garantizada y entrega súper rápida hasta tu casa</p>

        {/* Filtros */}
        {(!tableNumber || tableCategories.length > 1) && (
          <div className="catalog-filters">
            {(!tableNumber || tableCategories.length > 1) && (
              <button 
                className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
                onClick={() => setFilter('all')}
              >
                🍨 Todo
              </button>
            )}
            {(!tableNumber || tableCategories.includes('classic')) && (
              <button 
                className={`filter-btn ${filter === 'classic' ? 'active' : ''}`}
                onClick={() => setFilter('classic')}
              >
                🍦 Helados Simples
              </button>
            )}
            {(!tableNumber || tableCategories.includes('liter')) && (
              <button 
                className={`filter-btn ${filter === 'liter' ? 'active' : ''}`}
                onClick={() => setFilter('liter')}
              >
                🏺 Potes de Litro
              </button>
            )}
            {(!tableNumber || tableCategories.includes('packs')) && (
              <button 
                className={`filter-btn ${filter === 'packs' ? 'active' : ''}`}
                onClick={() => setFilter('packs')}
              >
                🎁 Packs Combos
              </button>
            )}
          </div>
        )}

        {/* Grid de Productos */}
        {renderedCatalog}
      </section>

      {/* MODAL WIZARD SABOR-O-MATIC */}
      {showWizard && (
        <div className="sabor-omatic-overlay">
          <div className="glass sabor-omatic-modal">
            <div className="sabor-omatic-header">
              <h3>🧠 Asistente Sabor-O-Matic</h3>
              <button className="sabor-omatic-close" onClick={() => setShowWizard(false)}>&times;</button>
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
                        generateSaborOMaticCombination(answers);
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
                        generateSaborOMaticCombination(answers);
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
                        generateSaborOMaticCombination(answers);
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
                                name: `Sabor-O-Matic: ${wizardResult.scoops.map(s => s.name).join(' + ')}`
                              };
                              onAddToCart(customItem);
                              setShowWizard(false);
                              if (showAlert) {
                                showAlert('¡Carrito Actualizado!', 'Tu helado personalizado sugerido por Sabor-O-Matic ha sido añadido al carrito.', 'success');
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
