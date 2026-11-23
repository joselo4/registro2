import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { checkoutStorage } from '../utils/checkout';
import DessertPreview from './DessertPreview';
import PromotionBanner from './PromotionBanner';
import WelcomePromotion from './WelcomePromotion';
import PackPhoto, { LiterPhoto } from './PackPhoto';
import Icon from './Icon';
import { preferWebp } from '../utils/imageUrl';
import { normalizePromotion, DEFAULT_POPUP_PROMOTION, DEFAULT_WEB_PROMOTION } from '../utils/promotion';
import { updateSyncedData } from '../utils/supabaseSync';
import { sanitizeHTML } from '../utils/security';
import { categoryForPath, productPath } from '../utils/catalogRoutes';
import { quickScoopItem } from '../utils/dessert';

// Price text typed in the panel follows the house format "S/ 1.00".
const houseMoney = value => String(value ?? '').replace(/S\/\.\s?/g, 'S/ ');
import './ProductQuickView.css';

const isAvailableProduct = item => item && item.active !== false && Number.isFinite(Number(item.price)) && Number(item.price) >= 0;
const normalizeSearchValue = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es-PE');
const matchesCatalogSearch = (item, term) => !term || normalizeSearchValue([
  item?.name,
  item?.description,
  ...(Array.isArray(item?.items) ? item.items.map(part => typeof part === 'string' ? part : part?.name) : [item?.items])
].join(' ')).includes(term);


export default function CustomerShop({ 
  flavors = [],
  toppings = [],
  bases = [],
  packs = [],
  popsicles = [],
  onAddToCart, 
  setView, 
  storeName,
  deliveryFee = 0,
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
  lastOrder = null,
  isActive = true,
  onRemoveOneFromCart,
  onRepeatLastOrder,
  shopConfig = {},
  promotionReady = true,
  testimonials = [],
  storeHeroImage = '',
  trackEvent,
  catalogReady = true
}) {
  const tableCategories = useMemo(() => {
    return shopConfig.tableCatalogCategories || ['popsicles', 'classic', 'liter', 'packs'];
  }, [shopConfig.tableCatalogCategories]);

  const handleAddToCartWrapped = useCallback((item) => {
    const added = onAddToCart(item);
    return added !== false;
  }, [onAddToCart]);

  const [filter, setFilter] = useState(() => {
    if (tableNumber) {
      return tableCategories.length > 1 ? 'all' : (tableCategories[0] || 'classic');
    }
    return categoryForPath(typeof window === 'undefined' ? '/' : window.location.pathname);
  });
  const [catalogSearch, setCatalogSearch] = useState('');
  const [quickView, setQuickView] = useState(null);
  const openQuickView = useCallback((kind, item) => {
    const product = kind === 'liter' ? { ...item, id: 'liter', name: 'Helado familiar de 1 litro', type: 'liter' } : { ...item, type: kind };
    setQuickView({ kind, product });
    trackEvent?.('ViewProduct', { value: Number(product.price) || 0, items: [product] });
  }, [trackEvent]);
  useEffect(() => {
    if (!quickView) return;
    const closeOnEscape = event => { if (event.key === 'Escape') setQuickView(null); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [quickView]);

  const popupPromotion = normalizePromotion(
    shopConfig.popupPromotion || (shopConfig.promotion ? {
      ...shopConfig.promotion,
      enabled: shopConfig.promotion.showWelcome ?? shopConfig.promotion.enabled ?? false
    } : {}),
    DEFAULT_POPUP_PROMOTION
  );

  const webPromotion = normalizePromotion(
    shopConfig.webPromotion ? shopConfig.webPromotion : {
      ...(shopConfig.promotion || {}),
      enabled: false
    },
    DEFAULT_WEB_PROMOTION
  );

  const handlePromotionAction = (action) => {
    if (action === 'customizer') { setView('customizer'); return; }
    const category = ['popsicles', 'classic', 'liter', 'packs'].includes(action) ? action : 'all';
    setFilter(tableNumber && category !== 'all' && !tableCategories.includes(category) ? 'all' : category);
    document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' });
  };

  const activeFlavors = useMemo(() => flavors.filter(isAvailableProduct), [flavors]);
  const activePacks = useMemo(() => packs.filter(isAvailableProduct), [packs]);
  const activePopsicles = useMemo(() => popsicles.filter(isAvailableProduct), [popsicles]);
  const openedProductPath = useRef('');
  useEffect(() => {
    if (!catalogReady || tableNumber) return;
    const path = window.location.pathname.replace(/\/$/, '');
    if (!path.startsWith('/producto/') || openedProductPath.current === path) return;
    const match = [
      ...activeFlavors.map(item => ({ kind: 'classic', item })),
      ...activePopsicles.map(item => ({ kind: 'popsicle', item })),
      ...activePacks.map(item => ({ kind: 'pack', item })),
    ].find(({ kind, item }) => productPath(kind, item) === path);
    if (match) {
      openedProductPath.current = path;
      openQuickView(match.kind, match.item);
    }
  }, [catalogReady, tableNumber, activeFlavors, activePopsicles, activePacks, openQuickView]);
  const visibleCategories = useMemo(() => [...new Set((tableNumber ? tableCategories : catalogOrder).filter(category => ['popsicles', 'classic', 'liter', 'packs'].includes(category)))], [tableNumber, tableCategories, catalogOrder]);
  const searchTerm = normalizeSearchValue(catalogSearch.trim());
  const catalogFlavors = useMemo(() => activeFlavors.filter(item => matchesCatalogSearch(item, searchTerm)), [activeFlavors, searchTerm]);
  const catalogPacks = useMemo(() => activePacks.filter(item => matchesCatalogSearch(item, searchTerm)), [activePacks, searchTerm]);
  const catalogPopsicles = useMemo(() => activePopsicles.filter(item => matchesCatalogSearch(item, searchTerm)), [activePopsicles, searchTerm]);
  const literMatches = !searchTerm || normalizeSearchValue('helado familiar de 1 litro pote para compartir').includes(searchTerm);
  const categoryCounts = { classic: catalogFlavors.length, packs: catalogPacks.length, popsicles: catalogPopsicles.length, liter: literConfig?.active !== false && literMatches ? 1 : 0 };
  const visibleCount = visibleCategories.reduce((count, category) => count + (filter === 'all' || filter === category ? categoryCounts[category] : 0), 0);
  const deliveryPrice = Math.max(0, Number(deliveryFee) || 0);
  const deliveryMessage = deliveryPrice === 0
    ? 'Delivery gratis'
    : freeDeliveryEnabled && Number(freeDeliveryThreshold) > 0
      ? `Delivery S/ ${deliveryPrice.toFixed(2)} · Gratis desde S/ ${Number(freeDeliveryThreshold).toFixed(2)}`
      : `Delivery S/ ${deliveryPrice.toFixed(2)}`;
  const catalogRef = useRef(null);
  const catalogViewedRef = useRef(false);
  const catalogItems = useMemo(() => !trackEvent ? [] : visibleCategories
    .filter(category => filter === 'all' || filter === category)
    .flatMap(category => {
      if (category === 'classic') return catalogFlavors.map(item => ({ ...item, type: 'classic' }));
      if (category === 'packs') return catalogPacks.map(item => ({ ...item, type: 'pack' }));
      if (category === 'popsicles') return catalogPopsicles.map(item => ({ ...item, type: 'popsicle' }));
      if (category === 'liter' && literConfig?.active !== false && literMatches) return [{ ...literConfig, id: 'liter', name: 'Helado familiar de 1 litro', type: 'liter' }];
      return [];
    }), [trackEvent, visibleCategories, filter, catalogFlavors, catalogPacks, catalogPopsicles, literConfig, literMatches]);

  useEffect(() => {
    if (!trackEvent || !catalogItems.length || catalogViewedRef.current || !catalogRef.current) return;
    const recordView = () => {
      if (catalogViewedRef.current) return;
      catalogViewedRef.current = true;
      trackEvent('ViewCatalog', { item_list_id: `catalog_${filter}`, item_list_name: 'Carta de helados', items: catalogItems });
    };
    if (typeof IntersectionObserver === 'undefined') {
      recordView();
      return;
    }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        recordView();
        observer.disconnect();
      }
    }, { threshold: 0 });
    observer.observe(catalogRef.current);
    return () => observer.disconnect();
  }, [trackEvent, catalogItems, filter]);
  const activePrices = activeFlavors
    .map(flavor => quickScoopItem(flavor, bases).price)
    .filter(price => price > 0);
  const startingPrice = activePrices.length > 0
    ? Math.min(...activePrices).toFixed(2)
    : '1.00';
  const featuredProducts = useMemo(() => [
    visibleCategories.includes('packs') && activePacks[0] && { kind: 'pack', item: activePacks[0], label: 'Para compartir', icon: 'gift' },
    visibleCategories.includes('classic') && activeFlavors.length > 0 && { kind: 'classic', item: activeFlavors.find(item => item.isPopular) || activeFlavors[0], label: 'El favorito', icon: 'icecream' },
    visibleCategories.includes('popsicles') && activePopsicles[0] && { kind: 'popsicle', item: activePopsicles[0], label: 'Algo fresco', icon: 'popsicle' },
    visibleCategories.includes('liter') && literConfig?.active !== false && { kind: 'liter', item: literConfig || {}, label: 'Para llevar a casa', icon: 'pot' }
  ].filter(Boolean).slice(0, 3), [visibleCategories, activePacks, activeFlavors, activePopsicles, literConfig]);
  const featuredRef = useRef(null);
  const featuredViewedRef = useRef(false);
  useEffect(() => {
    if (!trackEvent || !featuredProducts.length || featuredViewedRef.current || !featuredRef.current) return;
    const recordView = () => {
      if (featuredViewedRef.current) return;
      featuredViewedRef.current = true;
      trackEvent('ViewCatalog', {
        item_list_id: 'featured',
        item_list_name: 'Selección destacada',
        items: featuredProducts.map(({ kind, item }) => ({
          ...item,
          id: kind === 'liter' ? 'liter' : item.id,
          name: kind === 'liter' ? 'Helado familiar de 1 litro' : item.name,
          type: kind
        }))
      });
    };
    if (typeof IntersectionObserver === 'undefined') {
      recordView();
      return;
    }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        recordView();
        observer.disconnect();
      }
    }, { threshold: 0 });
    observer.observe(featuredRef.current);
    return () => observer.disconnect();
  }, [featuredProducts, trackEvent]);

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
          ? ` (Toppings: ${item.toppings.map(t => typeof t === 'string' ? t : t.name).join(', ')})` 
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
  useEffect(() => {
    if (!showWizard) return;
    const closeOnEscape = event => { if (event.key === 'Escape') setShowWizard(false); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [showWizard]);

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
    const cleanType = sanitizeHTML(type);
    const cartSummary = getCartSummary();
    const cleanCartSummary = sanitizeHTML(cartSummary);
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
                            `*Solicitud:* ${cleanType}\n` +
                            `*Detalles del Pedido en Carrito:*\n${cleanCartSummary}`;
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
        showAlert('Solicitud enviada', `Se ha avisado al personal: "${type}". En breve te atenderemos.`, 'success');
      }
    } else {
      if (showAlert) {
        showAlert('Error', 'No se pudo enviar la solicitud de atención. Intenta de nuevo.', 'error');
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
      const availableBases = bases.filter(b => b.active !== false);
      const selectedBase = availableBases.length > 0 
        ? availableBases[Math.floor(Math.random() * availableBases.length)]
        : { id: 'cono', name: 'Cono de Galleta Crujiente', price: 0.0 };

      // 2. Sabores
      const availableFlavors = flavors.filter(f => f.active !== false && Number.isFinite(Number(f.price)));
      
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

      if (selectedScoops.length === 0) {
        setWizardResult(null);
        setIsWizardLoading(false);
        return;
      }

      // 3. Toppings
      const availableToppings = toppings.filter(t => t.active !== false);
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
      const basePrice = Number(selectedBase.price) || 0;
      const scoopsPrice = selectedScoops.reduce((sum, s) => sum + (Number(s.price) || 0), 0);
      const toppingsPrice = selectedToppings.reduce((sum, t) => sum + (Number(t.price) || 0), 0);
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
        
        let desc = `Prueba: Helado de ${flavor1.name}`;
        let itemToTry = quickScoopItem(flavor1, bases);

        if (hasDouble && flavor1.id !== flavor2.id) {
          desc = `Prueba: Helado Doble de ${flavor1.name} y ${flavor2.name}`;
          itemToTry = quickScoopItem([flavor1, flavor2], bases);
        }

        return {
          id: Date.now(),
          icon: 'icecream',
          title: 'Una idea para tu próximo antojo',
          desc,
          item: itemToTry
        };
      } else if (randomType === 'pack' && activePacks.length > 0) {
        const pack = activePacks[Math.floor(Math.random() * activePacks.length)];
        return {
          id: Date.now(),
          icon: 'gift',
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
          icon: 'pot',
          title: 'Familiar 1 Litro',
          desc: `Para llevar: 1 Litro de Helado sabor ${flavor.name}`,
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
  }, [dismissedTrend, trendsInterval, trendsDisplayTime, tableNumber, bases]);

  const handleTryTrend = (item) => {
    if (handleAddToCartWrapped(item)) handleDismissToast();
  };

  const handleDismissToast = () => {
    setIsToastDismissing(true);
    setTimeout(() => {
      setCurrentTrend(null);
      setIsToastDismissing(false);
      setDismissedTrend(true);
    }, 350);
  };

  // Units already in the order per catalog product, so each card can confirm what was added.
  const cartQuantities = useMemo(() => {
    const counts = {};
    for (const item of cart) {
      let key = null;
      if (item.type === 'popsicle' || item.type === 'pack') key = `${item.type}:${item.id}`;
      else if (item.type === 'custom' && item.scoops?.length === 1 && !item.toppings?.length) key = `classic:${item.scoops[0].id}`;
      if (key) counts[key] = (counts[key] || 0) + (Number(item.quantity) || 0);
    }
    return counts;
  }, [cart]);

  const addButtonLabel = useCallback((kind, id, idle = 'Agregar') => {
    const qty = cartQuantities[`${kind}:${id}`] || 0;
    return qty > 0 ? <><Icon name="check" size={16} /> {qty} en tu pedido <span className="add-btn-more">+1</span></> : idle;
  }, [cartQuantities]);
  // Once a product is in the order its card shows − quantity +, so customers adjust
  // it right there instead of opening the cart.
  const renderAddControl = useCallback(({ kind, id, name, onAdd, idle = 'Agregar', extraClass = '' }) => {
    const qty = cartQuantities[`${kind}:${id}`] || 0;
    if (qty > 0 && typeof onRemoveOneFromCart === 'function') {
      return (
        <div className="qty-stepper" role="group" aria-label={`${name} en tu pedido`}>
          <button type="button" aria-label={`Quitar uno de ${name}`} onClick={() => onRemoveOneFromCart(kind, id)}>−</button>
          <output aria-live="polite">{qty}</output>
          <button type="button" aria-label={`Agregar otro: ${name}`} onClick={onAdd}>+</button>
        </div>
      );
    }
    return (
      <button type="button" className={`add-btn${extraClass}`} aria-label={`Agregar ${name} al carrito`} onClick={onAdd}>
        {idle}
      </button>
    );
  }, [cartQuantities, onRemoveOneFromCart]);

  // Helper for dynamic premium toppings per flavor in the shop catalog
  // Un helado clásico rápido es un helado simple de 1 bola en Cono
  const handleAddClassicToCart = useCallback((flavor) => {
    handleAddToCartWrapped(quickScoopItem(flavor, bases));
  }, [handleAddToCartWrapped, bases]);

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
    const activeOrder = [...new Set(configuredOrder)];
    // With "Todo" selected, a short title separates each category.
    const groupCounts = { popsicles: catalogPopsicles.length, classic: catalogFlavors.length, liter: literConfig?.active !== false && literMatches ? 1 : 0, packs: catalogPacks.length };
    const groupTitles = { popsicles: 'Paletas artesanales', classic: 'Helados de una bola', liter: 'Para llevar a casa', packs: 'Packs para compartir' };
    const groupIcons = { popsicles: 'popsicle', classic: 'icecream', liter: 'pot', packs: 'gift' };
    const grouped = filter === 'all' && activeOrder.filter(key => groupCounts[key] > 0).length > 1;
    const parts = activeOrder.map(section => ({ section, content: (() => {
          if (section === 'popsicles') {
            return (
              <React.Fragment key="popsicles">
                {(filter === 'all' || filter === 'popsicles') && catalogPopsicles.map(popsicle => (
                  <article key={popsicle.id} className="glass-card product-card popsicle-card">
                    <span className="product-badge popsicle-badge">
                      {popsicle.badge || '100% natural'}
                    </span>
                    <div className="product-illustration popsicle-illustration">
                      {popsicle.image ? (
                        <img
                          src={preferWebp(popsicle.image)}
                          alt={`Paleta artesanal ${popsicle.name}`}
                          width="160"
                          height="220"
                          loading="lazy"
                          decoding="async"
                        />
                      ) : <span className="popsicle-placeholder" aria-hidden="true"><Icon name="popsicle" size={56} /></span>}
                    </div>
                    <div className="product-info">
                      <div>
                        <h3>{popsicle.name}</h3>
                        <p className="product-desc">{houseMoney(popsicle.description)}</p>
                        <button type="button" className="product-quick-link" onClick={() => openQuickView('popsicle', popsicle)}>Ver detalles →</button>
                      </div>
                      <div className="product-price-action">
                        <div className="price-tag">S/ {Number(popsicle.price || 0).toFixed(2)}<span> / unidad</span></div>
                        {renderAddControl({ kind: 'popsicle', id: popsicle.id, name: `paleta ${popsicle.name}`, onAdd: () => handleAddPopsicleToCart(popsicle) })}
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
                {(filter === 'all' || filter === 'liter') && literConfig?.active !== false && literMatches && (
                  <div className="glass-card product-card">
                    <span className="product-badge badge-familiar">Familiar 1 L</span>
                    <div className="product-illustration" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '120px' }}>
                      {literConfig?.image ? (
                        <img 
                          src={preferWebp(literConfig.image)} 
                          alt="Pote de helado de 1 litro" 
                          width="200"
                          height="160"
                          decoding="async"
                          loading="lazy"
                        />
                      ) : <LiterPhoto />}
                    </div>
                    <div className="product-info">
                      <div>
                        <h3>Helado Familiar de 1 Litro</h3>
                        <p className="product-desc">Lleva a casa el mejor helado artesanal. Combina tus sabores favoritos (hasta {literConfig?.maxFlavors || 3} sabores) en un pote de un litro para compartir.</p>
                        <button type="button" className="product-quick-link" onClick={() => openQuickView('liter', literConfig || {})}>Ver detalles →</button>
                      </div>
                      <div className="product-price-action">
                        <div className="price-tag">
                          S/ {Number(literConfig?.price ?? 15).toFixed(2)}
                          <span> / pote</span>
                        </div>
                        <button type="button" className="add-btn" onClick={() => setView('liter-customizer')}>
                          Personalizar
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
                {(filter === 'all' || filter === 'classic') && catalogFlavors.map(flavor => {
                  const isPopular = flavor.isPopular === true;
                  return (
                    <div key={flavor.id} className="glass-card product-card">
                      {isPopular ? (
                        <span className="product-badge badge-popular">Más pedido</span>
                      ) : flavor.isPremium ? (
                        <span className="product-badge badge-premium">Premium</span>
                      ) : null}
                      
                      <div className="product-illustration" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '120px', ...(/^#[0-9a-f]{3,8}$/i.test(String(flavor.color || '')) ? { '--tone': flavor.color } : {}) }}>
                        {flavor.image ? (
                          <img 
                            src={preferWebp(flavor.image)} 
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
                          <p className="product-desc">{houseMoney(flavor.description)}</p>
                          <button type="button" className="product-quick-link" onClick={() => openQuickView('classic', flavor)}>Ver detalles →</button>
                        </div>
                        <div className="product-price-action">
                          <div className="price-tag">
                            S/ {quickScoopItem(flavor, bases).price.toFixed(2)}
                            <span> / bola</span>
                          </div>
                          {renderAddControl({ kind: 'classic', id: flavor.id, name: `helado de ${flavor.name}`, onAdd: () => handleAddClassicToCart(flavor) })}
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
                {(filter === 'all' || filter === 'packs') && catalogPacks.map(pack => {
                  const badgeClass = `badge-${String(pack.badge || '').toLowerCase().replace(/\s+/g, '-')}`;
                  return (
                    <div key={pack.id} className="glass-card product-card">
                      <span className={`product-badge ${pack.badge ? badgeClass : 'badge-popular'}`}>
                        {pack.badge || 'Pack ahorro'}
                      </span>
                      
                      <div className="product-illustration pack-illustration" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '120px' }}>
                        {pack.image ? (
                          <img 
                            src={preferWebp(pack.image)} 
                            alt={pack.name} 
                            width="200"
                            height="100"
                            decoding="async"
                            style={{ width: '100%', height: '100px', objectFit: 'contain', borderRadius: '8px' }} 
                            loading="lazy"
                          />
                        ) : (
                          <PackPhoto pack={pack} />
                        )}
                      </div>
                      <div className="product-info">
                        <div>
                          <h3>{pack.name}</h3>
                          <p className="product-desc">{houseMoney(pack.description)}</p>
                          <button type="button" className="product-quick-link" onClick={() => openQuickView('pack', pack)}>Ver detalles →</button>
                          {pack.items && <p className="pack-includes"><strong>Incluye:</strong> {houseMoney(pack.items)}</p>}
                        </div>
                        <div className="product-price-action">
                          <div className="price-tag">
                            S/ {Number(pack.price).toFixed(2)}
                            {pack.discountText && <div className="price-saving">{houseMoney(pack.discountText)}</div>}
                          </div>
                          {renderAddControl({ kind: 'pack', id: pack.id, name: pack.name, onAdd: () => handleAddPackToCart(pack), idle: 'Agregar', extraClass: ' add-btn-pack' })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </React.Fragment>
            );
          }
          return null;
        })() }));
    if (!grouped) return <div className="catalog-grid">{parts.map(part => part.content)}</div>;
    return (
      <div className="catalog-groups">
        {parts.filter(part => groupCounts[part.section] > 0).map(part => (
          <section className="catalog-group" key={part.section} aria-labelledby={`catalog-group-${part.section}`}>
            <div className="catalog-group-head">
              <h3 className="catalog-group-title" id={`catalog-group-${part.section}`}><Icon name={groupIcons[part.section]} size={22} />{groupTitles[part.section]} <span>{groupCounts[part.section]}</span></h3>
              {groupCounts[part.section] > 1 && <button type="button" className="catalog-group-more" onClick={() => setFilter(part.section)}>Ver {groupCounts[part.section]} <Icon name="arrow" size={16} /></button>}
            </div>
            <div className="catalog-grid">{part.content}</div>
          </section>
        ))}
      </div>
    );
  }, [tableNumber, catalogOrder, filter, literConfig, literMatches, catalogFlavors, catalogPacks, catalogPopsicles, setView, handleAddClassicToCart, handleAddPackToCart, handleAddPopsicleToCart, openQuickView, shopConfig, bases, renderAddControl]);

  const resolvedHeroImage = storeHeroImage || '/hero-friozo-v2.webp';
  // The four guarantees: right under the hero on wide screens, after the favourites on phones.
  const renderValueStrip = (variant) => (
    <ul className={`value-strip ${variant}`} aria-label={`Por qué ${storeName || 'Friozo'}`}>
      <li><Icon name="clock" size={24} /><div><strong>Hecho al momento</strong><span>Lo preparamos cuando lo pides</span></div></li>
      <li><Icon name="sparkle" size={24} /><div><strong>Arma tu helado</strong><span>Base, bolas, toppings y salsas</span></div></li>
      <li><Icon name="mountain" size={24} /><div><strong>Sabores peruanos</strong><span>Lúcuma, maracuyá y fruta de la zona</span></div></li>
      <li><Icon name="scooter" size={24} /><div><strong>{shopConfig?.locationTrackingEnabled !== false ? 'Delivery o carrito' : 'Delivery'}</strong><span>{shopConfig?.locationTrackingEnabled !== false ? 'Te lo llevamos o búscanos cerca' : 'Te lo llevamos a tu puerta'}</span></div></li>
    </ul>
  );

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
            <span className="view-hero-icon" aria-hidden="true"><Icon name="table" size={32} /></span>
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
                  const activeId = checkoutStorage.getItem('helados_active_order_id');
                  if (activeId && setView) {
                    setView('tracker');
                  } else {
                    window.alert("No tienes un pedido registrado en este dispositivo para esta mesa.");
                  }
                }}
              >
                <Icon name="search" size={18} /> Rastrear mi pedido activo
              </button>
              
              <button
                type="button"
                className="btn btn-secondary" 
                style={{ width: '100%', padding: '12px', fontSize: '0.85rem' }}
                onClick={() => {
                  if (setTableNumber) setTableNumber(null);
                  checkoutStorage.removeItem('helados_table_number');
                }}
              >
                <Icon name="bag" size={18} /> Ver carta para llevar / Recojo en barra
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Pop-up Banner Emergente de Bienvenida al ingresar */}
          <WelcomePromotion promotion={popupPromotion} tableNumber={tableNumber} onAction={handlePromotionAction} ready={isActive && promotionReady && cart.length === 0 && (typeof window === 'undefined' || window.location.pathname === '/')} />
          {/* Banner Fijo en la Tienda Web (Solo si está activado) */}
          {webPromotion.enabled && webPromotion.position === 'above-hero' && (
            <PromotionBanner promotion={webPromotion} tableNumber={tableNumber} onAction={handlePromotionAction} />
          )}
          <section className="hero">
        <div className="hero-text">
          {tableOrdersEnabled && tableNumber && occupiedTables.includes(String(tableNumber)) && checkoutStorage.getItem('helados_active_order_table') === String(tableNumber) && (
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
                const activeId = checkoutStorage.getItem('helados_active_order_id');
                if (activeId && setView) setView('tracker');
              }}
            >
              Tienes un pedido activo para esta mesa. ¡Toca aquí para ver el seguimiento en tiempo real!
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
              <Icon name="table" size={16} /> Pedido vinculado a la Mesa {tableNumber}
              <button 
                type="button" 
                onClick={() => {
                  if (setTableNumber) setTableNumber(null);
                  checkoutStorage.removeItem('helados_table_number');
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
          <h1>
            Qué rico <span>caer en <br />la tentación.</span>
          </h1>
          <p className="hero-description">
            En <strong>{storeName || 'Friozo'}</strong> eliges el sabor y nosotros lo hacemos al momento. Pide tu favorito o crea una mezcla solo tuya.
          </p>
          <div className="hero-cta">
            <a
              href="#catalog"
              className="btn btn-primary hero-primary-cta"
              onClick={(e) => {
                e.preventDefault();
                document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              Pedir ahora <Icon name="arrow" size={18} />
            </a>
            <button type="button" className="btn btn-secondary" onClick={() => setView('customizer')}>
              <Icon name="sparkle" size={18} /> Arma tu helado
            </button>
          </div>
          <div className="hero-quick-links" aria-label="Acciones rápidas">
            <button 
              type="button"
              className="hero-text-link whatsapp-link" 
              onClick={() => {
                const waUrl = `https://wa.me/${String(storePhone || '51987654321').replace(/\D/g, '')}?text=${encodeURIComponent('¡Hola! Me gustaría hacer una consulta sobre los helados 🍦')}`;
                const waWindow = window.open(waUrl, '_blank', 'noopener,noreferrer');
                if (waWindow) waWindow.opener = null;
              }}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.59-4.846c1.66.986 3.284 1.447 4.74 1.448 5.4 0 9.792-4.393 9.795-9.79.002-2.615-1.012-5.074-2.855-6.918C16.483 2.05 14.032.99 11.417.99c-5.402 0-9.794 4.393-9.797 9.79-.001 1.733.456 3.238 1.411 4.887L2.03 20.485l4.616-1.331zM16.518 14.1c-.266-.134-1.577-.777-1.821-.866-.245-.09-.423-.134-.6.134-.178.266-.689.866-.844 1.04-.155.178-.312.2-.578.066-.266-.134-1.124-.414-2.141-1.32-.79-.705-1.326-1.577-1.482-1.844-.155-.266-.017-.41.117-.543.12-.12.266-.312.4-.467.135-.156.18-.266.27-.444.09-.178.045-.334-.022-.467-.067-.134-.6-1.446-.823-1.979-.217-.523-.454-.452-.6-.452h-.51c-.178 0-.467.067-.71.334-.244.267-.933.912-.933 2.224 0 1.312.955 2.58 1.088 2.757.135.178 1.88 2.87 4.554 4.024.637.275 1.13.438 1.517.56.64.204 1.22.175 1.68.107.513-.075 1.577-.644 1.8-.1.223-.545.223-1.013.156-1.1zm-.058-.058v.058-.058z"/>
              </svg>
              <span>Preguntar por WhatsApp</span>
            </button>
            {shopConfig?.locationTrackingEnabled !== false && (
              <button type="button" className="hero-text-link" onClick={() => setView('locations')}>
                <Icon name="pin" size={16} /> Ver carritos cercanos
              </button>
            )}
          </div>
        </div>
        <div className="hero-image-container">
          <div className="hero-circle-bg" aria-hidden="true"></div>
          <div className="hero-graphic-premium">
            <img 
              src={resolvedHeroImage}
              alt="Cono Friozo con tres bolas de helado artesanal, frutas y chocolate"
              width="600"
              height="600"
              fetchPriority="high"
              decoding="async"
            />
          </div>
          <div className="hero-price-seal">
            {String(shopConfig.heroPriceText || '').trim()
              ? <strong>{String(shopConfig.heroPriceText).trim()}</strong>
              : <><span>Desde</span><strong>S/ {startingPrice}</strong></>}
          </div>
        </div>
      </section>

      {renderValueStrip('value-strip--wide')}

      {quickView && <div className="product-quick-backdrop" onClick={() => setQuickView(null)}>
        <div className="product-quick-dialog" role="dialog" aria-modal="true" aria-label={`Detalles de ${quickView.product.name}`} onClick={event => event.stopPropagation()}>
          <button type="button" className="product-quick-close" aria-label="Cerrar detalles" onClick={() => setQuickView(null)}>×</button>
          <div className="product-quick-art">{quickView.product.image ? <img src={preferWebp(quickView.product.image)} alt={quickView.product.name} /> : quickView.kind === 'classic' ? <DessertPreview compact base={{ id: 'cono', name: 'Cono' }} scoops={[quickView.product]} /> : quickView.kind === 'pack' ? <PackPhoto pack={quickView.product} /> : quickView.kind === 'liter' ? <LiterPhoto /> : <Icon name="popsicle" size={72} />}</div>
          <div className="product-quick-copy"><h2>{quickView.product.name}</h2><p>{houseMoney(quickView.product.description) || (quickView.kind === 'liter' ? 'Combina tus sabores favoritos en un pote para compartir.' : 'Preparado con el sabor de nuestra carta artesanal.')}</p>{quickView.kind === 'pack' && quickView.product.items && <p><strong>Incluye:</strong> {houseMoney(quickView.product.items)}</p>}<strong className="product-quick-price">S/ {(quickView.kind === 'classic' ? quickScoopItem(quickView.product, bases).price : Number(quickView.product.price || 0)).toFixed(2)}</strong><button type="button" className="btn btn-primary" onClick={() => {
            if (quickView.kind === 'liter') setView('liter-customizer');
            else if (quickView.kind === 'pack') handleAddPackToCart(quickView.product);
            else if (quickView.kind === 'popsicle') handleAddPopsicleToCart(quickView.product);
            else handleAddClassicToCart(quickView.product);
            setQuickView(null);
          }}>{quickView.kind === 'liter' ? 'Personalizar mi litro' : 'Agregar al carrito'} →</button></div>
        </div>
      </div>}

      {lastOrder && !tableNumber && typeof onRepeatLastOrder === 'function' && (
        <section className="repeat-order" aria-labelledby="repeat-order-title">
          <div className="repeat-order-copy">
            <h2 id="repeat-order-title">¿Lo de siempre?</h2>
            <p>
              {lastOrder.items.slice(0, 3).map(item => `${Number(item.quantity) || 1}× ${item.name}`).join(' · ')}
              {lastOrder.items.length > 3 ? ` y ${lastOrder.items.length - 3} más` : ''}
            </p>
          </div>
          <button type="button" className="btn btn-primary repeat-order-action" onClick={onRepeatLastOrder}>
            Repetir mi último pedido <span aria-hidden="true">→</span>
          </button>
        </section>
      )}

      {featuredProducts.length > 0 && (
        <section ref={featuredRef} className="featured-section" aria-labelledby="featured-title">
          <div className="featured-heading">
            <div>
              <h2 id="featured-title">¿Empezamos por aquí?</h2>
            </div>
            <a href="#catalog" onClick={(event) => { event.preventDefault(); document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' }); }}>Ver toda la carta <span aria-hidden="true">→</span></a>
          </div>
          <div className="featured-list">
            {featuredProducts.map(({ kind, item }) => {
              const name = kind === 'liter' ? 'Helado familiar de 1 litro' : item.name;
              const price = kind === 'classic' ? quickScoopItem(item, bases).price : Number(item.price ?? (kind === 'liter' ? 15 : 0));
              const image = item.image || '';
              return (
                <article className={`featured-card featured-card-${kind}`} key={`${kind}-${item.id || 'featured'}`}>
                  <div className="featured-card-copy">
                    <h3>{name}</h3>
                    <strong>S/ {price.toFixed(2)}</strong>
                    <button type="button" aria-label={kind === 'liter' ? 'Personalizar helado de 1 litro' : `Agregar ${name} al carrito`} onClick={() => {
                      if (kind === 'pack') handleAddPackToCart(item);
                      else if (kind === 'classic') handleAddClassicToCart(item);
                      else if (kind === 'popsicle') handleAddPopsicleToCart(item);
                      else setView('liter-customizer');
                    }}>{kind === 'liter' ? 'Personalizar' : addButtonLabel(kind, item.id)}</button>
                  </div>
                  <div className="featured-card-art" aria-hidden="true">
                    {image ? <img src={preferWebp(image)} alt="" loading="lazy" decoding="async" /> : kind === 'classic' ? <DessertPreview compact base={{ id: 'cono', name: 'Cono' }} scoops={[item]} /> : kind === 'liter' ? <LiterPhoto /> : <PackPhoto pack={item} />}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {renderValueStrip('value-strip--compact')}

      {/* BANNER DELIVERY GRATIS */}
      {!tableNumber && (
        <div className="delivery-banner">
          <span className="delivery-banner-icon" aria-hidden="true"><Icon name="scooter" size={22} /></span>
          <div className="delivery-banner-copy">
            <strong>{deliveryMessage}</strong>
            {deliveryPrice > 0 && freeDeliveryEnabled && Number(freeDeliveryThreshold) > 0 && deliveryCampaignText && (
              <p>{deliveryCampaignText}</p>
            )}
          </div>
          <a 
            href="#catalog"
            className="delivery-banner-action"
            onClick={(e) => {
              e.preventDefault();
              document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' });
            }}
          >
            <span>Ver carta</span>
            <span className="delivery-banner-arrow" aria-hidden="true">→</span>
          </a>
        </div>
      )}

      {/* Banner Fijo en la Tienda Web (Antes del catálogo, solo si está activado) */}
      {webPromotion.enabled && webPromotion.position === 'above-catalog' && (
        <PromotionBanner promotion={webPromotion} tableNumber={tableNumber} onAction={handlePromotionAction} />
      )}
      <section id="catalog" ref={catalogRef} className="catalog-section">
        <div className="catalog-heading">
          <div>
            <h2 className="section-title">La carta de {storeName || 'Friozo'}</h2>
            <p className="section-subtitle">Elige tus favoritos y arma tu pedido en minutos.</p>
          </div>
        </div>

        <div className="catalog-search-row">
          <label htmlFor="catalog-search">Busca tu sabor</label>
          <div className="catalog-search-field">
            <span aria-hidden="true">⌕</span>
            <input id="catalog-search" type="search" value={catalogSearch} onChange={event => setCatalogSearch(event.target.value)} placeholder="Prueba con chocolate, fresa o un pack…" autoComplete="off" />
            {catalogSearch && <button type="button" aria-label="Limpiar búsqueda" onClick={() => setCatalogSearch('')}>×</button>}
          </div>
          <span role="status">{visibleCount} {visibleCount === 1 ? 'opción' : 'opciones'}</span>
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
                <Icon name="store" size={17} /> Todo
              </button>
            )}
            {visibleCategories.includes('classic') && (
              <button 
                className={`filter-btn ${filter === 'classic' ? 'active' : ''}`}
                onClick={() => setFilter('classic')}
                aria-pressed={filter === 'classic'}
              >
                <Icon name="icecream" size={17} /> Helados
              </button>
            )}
            {visibleCategories.includes('popsicles') && (
              <button 
                className={`filter-btn ${filter === 'popsicles' ? 'active' : ''}`}
                onClick={() => setFilter('popsicles')}
                aria-pressed={filter === 'popsicles'}
              >
                <Icon name="popsicle" size={17} /> Paletas
              </button>
            )}
            {visibleCategories.includes('liter') && (
              <button 
                className={`filter-btn ${filter === 'liter' ? 'active' : ''}`}
                onClick={() => setFilter('liter')}
                aria-pressed={filter === 'liter'}
              >
                <Icon name="pot" size={17} /> Litros
              </button>
            )}
            {visibleCategories.includes('packs') && (
              <button 
                className={`filter-btn ${filter === 'packs' ? 'active' : ''}`}
                onClick={() => setFilter('packs')}
                aria-pressed={filter === 'packs'}
              >
                <Icon name="gift" size={17} /> Packs
              </button>
            )}
          </div>
        )}

        {/* Grid de Productos */}
        {visibleCount > 0 ? renderedCatalog : <div className="catalog-empty" role="status"><h3>{catalogSearch ? 'No encontramos ese antojo' : 'No hay productos disponibles en esta categoría'}</h3><p>{catalogSearch ? 'Prueba otro sabor o explora todas las categorías.' : 'Explora otras categorías para encontrar tu próximo favorito.'}</p><button className="btn btn-secondary" onClick={() => { setFilter('all'); setCatalogSearch(''); }}>Ver toda la carta</button></div>}
      </section>

      <section className="order-paths" aria-label="Formas de elegir tu helado">
        <article className="order-path-card order-path-card-primary">
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
          <span className="order-path-icon" aria-hidden="true"><Icon name="sparkle" size={26} /></span>
          <div className="order-path-guide-copy">
            <h3>Te encontramos la mezcla perfecta</h3>
            <p>Tres preguntas. Una recomendación peligrosamente rica.</p>
          </div>
          <span className="order-path-arrow" aria-hidden="true">→</span>
        </button>
      </section>

      {/* Opiniones configuradas por la tienda */}
      {!tableNumber && testimonials && testimonials.length > 0 && (
        <section className="testimonials-section">
          <h2 className="section-title">La gente vuelve por esto</h2>
          <p className="section-subtitle">Experiencias reales de quienes ya cayeron en la tentación.</p>
          
          <div className="testimonials-grid">
            {testimonials.map((item, idx) => {
              const rating = Math.max(1, Math.min(5, Number(item.rating) || 5));
              const initials = item.initials || (item.name ? item.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'U');
              const bgColor = item.color || 'var(--primary-color)';
              return (
                <div key={item.id || idx} className="glass-card testimonial-card">
                  <div className="testimonial-rating" role="img" aria-label={`${rating} de 5 estrellas`}>{Array.from({ length: rating }, (_, i) => <Icon key={i} name="star" size={16} />)}</div>
                  <p className="testimonial-text">"{item.text}"</p>
                  <div className="testimonial-user">
                    <div className="testimonial-avatar" style={{ backgroundColor: bgColor }}>{initials}</div>
                    <div>
                      <h4 className="testimonial-name">{item.name}</h4>
                      {item.verified === true && <span className="testimonial-badge"><Icon name="check" size={14} /> Compra verificada</span>}
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
          <div className="glass sabor-omatic-modal" role="dialog" aria-modal="true" aria-labelledby="sabor-omatic-title">
            <div className="sabor-omatic-header">
              <h3 id="sabor-omatic-title">Guía de sabores</h3>
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
                      <span className="sabor-omatic-option-emoji" aria-hidden="true"><Icon name="icecream" size={24} /></span>
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
                      <span className="sabor-omatic-option-emoji" aria-hidden="true"><Icon name="popsicle" size={24} /></span>
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
                      <span className="sabor-omatic-option-emoji" aria-hidden="true"><Icon name="star" size={24} /></span>
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
                      <span className="sabor-omatic-option-emoji" aria-hidden="true"><Icon name="icecream" size={24} /></span>
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
                      <span className="sabor-omatic-option-emoji" aria-hidden="true"><Icon name="gift" size={24} /></span>
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
                      <span className="sabor-omatic-option-emoji" aria-hidden="true"><Icon name="sparkle" size={24} /></span>
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
                      <span className="sabor-omatic-option-emoji" aria-hidden="true"><Icon name="check" size={24} /></span>
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
                      <div className="som-spinner" aria-hidden="true"><Icon name="icecream" size={40} /></div>
                      <h4 style={{ fontFamily: 'var(--font-title)' }}>Cocinando tu helado ideal...</h4>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-light)', marginTop: '5px' }}>
                        Combinando bases, sabores y toppings seleccionados
                      </p>
                    </div>
                  ) : wizardResult ? (
                      <div className="sabor-omatic-result">
                        <div className="sabor-omatic-result-card">
                          <div className="sabor-omatic-result-title">¡Combinación perfecta lista!</div>
                          <div className="sabor-omatic-result-details">
                            <p><strong>Base:</strong> {wizardResult.base.name}</p>
                            <p><strong>Sabores:</strong> {wizardResult.scoops.map(s => s.name).join(' y ')}</p>
                            {wizardResult.toppings.length > 0 ? (
                              <p><strong>Topping:</strong> {wizardResult.toppings.map(t => typeof t === 'string' ? t : t.name).join(', ')}</p>
                            ) : (
                              <p>Sin toppings adicionales</p>
                            )}
                          </div>
                          <div className="sabor-omatic-result-price">
                            Total: S/ {parseFloat(wizardResult.price).toFixed(2)}
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
                              if (handleAddToCartWrapped(customItem)) setShowWizard(false);
                            }}
                          >
                            <Icon name="bag" size={18} /> Comprar helado
                          </button>
                          <button 
                            className="btn btn-secondary" 
                            onClick={() => {
                              setWizardStep(1);
                              setWizardAnswers({ antojo: null, premium: null, topping: null });
                              setWizardResult(null);
                            }}
                          >
                            Repetir
                          </button>
                        </div>
                      </div>
                  ) : (
                    <div className="catalog-empty" role="status">
                      <h4>No hay sabores disponibles para recomendar</h4>
                      <p>Explora la carta para ver las opciones que tenemos ahora.</p>
                      <button type="button" className="btn btn-secondary" onClick={() => { setShowWizard(false); document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' }); }}>Ver la carta</button>
                    </div>
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
          <div className="tendencias-icon" aria-hidden="true"><Icon name={currentTrend.icon} size={26} /></div>
          <div className="tendencias-content">
            <div className="tendencias-title">{currentTrend.title}</div>
            <div className="tendencias-desc">{currentTrend.desc}</div>
            <button 
              className="tendencias-action-btn"
              onClick={() => handleTryTrend(currentTrend.item)}
            >
              Probar este
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
            <Icon name="bell" size={26} />
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
            <h3 style={{ margin: '0 0 8px 0', fontSize: '1.25rem', color: 'var(--primary-color)' }}>Atención en mesa {tableNumber}</h3>
            
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
                }} aria-hidden="true"><Icon name="bell" size={28} /></div>
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
                    {isCalling ? 'Cancelando…' : 'Cancelar solicitud'}
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
                    onClick={() => handleCallWaiter('Solicitar asistencia de mozo')}
                    disabled={isCalling}
                    className="btn btn-primary"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px', fontSize: '0.85rem', width: '100%', background: 'linear-gradient(135deg, var(--primary-color), #ff6b8b)', border: 'none' }}
                  >
                    <Icon name="users" size={20} /> Solicitar mozo
                  </button>

                  <button
                    onClick={() => handleCallWaiter('Solicitar vasos / cubiertos / servilletas')}
                    disabled={isCalling}
                    className="btn btn-secondary"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px', fontSize: '0.85rem', width: '100%' }}
                  >
                    <Icon name="box" size={20} /> Vasos y cubiertos
                  </button>

                  <button
                    onClick={() => handleCallWaiter('Solicitar la cuenta')}
                    disabled={isCalling}
                    className="btn btn-secondary"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px', fontSize: '0.85rem', width: '100%' }}
                  >
                    <Icon name="cash" size={20} /> Pedir la cuenta
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
