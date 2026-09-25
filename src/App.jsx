 
import React, { useState, useEffect, useRef } from 'react';
import { 
  INITIAL_FLAVORS, 
  INITIAL_BASES, 
  INITIAL_TOPPINGS, 
  INITIAL_PACKS, 
  INITIAL_POPSICLES,
  INITIAL_ORDERS 
} from './utils/mockData';
import { fetchSyncedData, updateSyncedData, subscribeToSync, invalidateSyncCache } from './utils/supabaseSync';
import { supabase } from './utils/supabaseClient';
import { Capacitor } from '@capacitor/core';
import { DEFAULT_SMS_TEMPLATES } from './utils/orderMessaging';
import { createOrder, createOperatorOrder, updateOrder } from './utils/apiClient';
import { addCartItem, checkoutStorage, readCartDraft, subtractOrderedItems } from './utils/checkout';
import { isGoogleMeasurementId, toGa4Event, toMetaPayload } from './utils/commerceAnalytics';
import { configureWebVitalsMonitoring } from './utils/performanceMonitoring';
import { readRememberedOperator } from './utils/rememberedOperator';
import { readEmbeddedCatalog } from './utils/publicCatalogCache';
import { safeStorage } from './utils/security';
import { isShopOpenCurrently } from './utils/storeHours';
import { cleanTableParam, isKnownView, urlForView, viewFromHash } from './utils/viewHistory';

import CustomerShop from './components/CustomerShop';
const IceCreamCustomizer = React.lazy(() => import('./components/IceCreamCustomizer'));
const LiterCustomizer = React.lazy(() => import('./components/LiterCustomizer'));
const Cart = React.lazy(() => import('./components/Cart'));
const LiveChatTelegramBridge = React.lazy(() => import('./components/LiveChatTelegramBridge'));
const OrderTracker = React.lazy(() => import('./components/OrderTracker'));
const AdminPanel = React.lazy(() => import('./components/AdminPanel'));
const CartLocationsView = React.lazy(() => import('./components/CartLocationsView'));

// Combinaciones recomendadas por defecto para el menú
const DEFAULT_RECOMMENDATIONS = [
  {
    id: 'pasion_chocolate',
    name: '🍫 Waffle Chocolate Belga (Premium)',
    baseId: 'waffle',
    flavorIds: ['chocolate', 'chocolate'],
    toppingIds: ['oreo'],
    syrupId: 'fudge'
  },
  {
    id: 'festival_frutal',
    name: '🍓 Dúo Mango Fresa con Gomitas',
    baseId: 'vaso',
    flavorIds: ['mango', 'fresa'],
    toppingIds: ['gomitas'],
    syrupId: 'fresa'
  },
  {
    id: 'clasico_lucuma',
    name: '🍦 Clásico de Lúcuma',
    baseId: 'cono',
    flavorIds: ['lucuma'],
    toppingIds: ['chispas'],
    syrupId: null
  }
];

const initialPublicCatalog = readEmbeddedCatalog();

// Helper to render emoji or URL/image logo
const renderLogo = (logo, size = '38px') => {
  if (!logo) return null;
  if (logo === '🍦') {
    return (
      <svg viewBox="0 0 100 100" width={size} height={size} style={{ width: size, height: size, display: 'inline-block', verticalAlign: 'middle' }}>
        <defs>
          <linearGradient id="logoConeGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#f3a683" />
            <stop offset="100%" stopColor="#cf8a4f" />
          </linearGradient>
          <linearGradient id="logoScoopGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ff8a9a" />
            <stop offset="100%" stopColor="#ff4757" />
          </linearGradient>
          <filter id="logoShadow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="3" stdDeviation="2" floodOpacity="0.15" />
          </filter>
        </defs>
        <g filter="url(#logoShadow)">
          {/* Cone */}
          <path d="M 32 50 L 50 88 L 68 50 Z" fill="url(#logoConeGrad)" />
          {/* Waffle grid detail */}
          <path d="M 36 50 L 50 80 M 42 50 L 50 72 M 48 50 L 50 64 M 52 50 L 50 64 M 58 50 L 50 72 M 64 50 L 50 80" stroke="#7a4b1c" strokeWidth="0.8" opacity="0.3" />
          {/* Scoop */}
          <circle cx="50" cy="38" r="20" fill="url(#logoScoopGrad)" />
          {/* Cream drip overlay */}
          <path d="M 29 42 Q 35 48 40 43 Q 45 48 50 43 Q 55 48 60 43 Q 65 48 71 42 Q 50 54 29 42 Z" fill="#ff4757" />
          {/* Specular highlights */}
          <ellipse cx="44" cy="30" rx="5" ry="2.5" fill="white" opacity="0.45" transform="rotate(-15 44 30)" />
          <circle cx="56" cy="34" r="1.5" fill="white" opacity="0.4" />
          {/* Cherry on top */}
          <circle cx="50" cy="18" r="6" fill="#d63031" />
          <path d="M 50 18 Q 54 10 61 8" fill="none" stroke="#2d3436" strokeWidth="1.2" strokeLinecap="round" />
        </g>
      </svg>
    );
  }
  const isUrl = logo.startsWith('http://') || logo.startsWith('https://') || logo.startsWith('/') || logo.startsWith('./') || logo.includes('.') || logo.startsWith('data:image/');
  if (isUrl) {
    const numericSize = parseInt(size, 10) || 32;
    return <img src={logo} alt="Logo" width={numericSize} height={numericSize} style={{ width: size, height: size, objectFit: 'contain', borderRadius: '50%' }} />;
  }
  return <span className="logo-icon">{logo}</span>;
};

// Usuarios de personal por defecto para la administración
const DEFAULT_STAFF_USERS = [
  { email: 'vendedor@donhelado.com', name: 'Vendedor de Turno', role: 'Vendedor', status: 'Activo' },
  { email: 'cocina@donhelado.com', name: 'Preparador de Cocina', role: 'Cocina', status: 'Activo' },
  { email: 'delivery@donhelado.com', name: 'Repartidor de Turno', role: 'Repartidor', status: 'Activo', phone: '987654321' }
];

const normalizeRoleLabel = (role, email = '') => {
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  const normalizedRole = typeof role === 'string' ? role.trim() : '';
  const lowerRole = normalizedRole.toLowerCase();

  if (normalizedEmail === 'admin@donhelado.com') return 'Administrador';
  if (lowerRole.includes('admin')) return 'Administrador';
  if (lowerRole.includes('vendedor')) return 'Vendedor';
  if (lowerRole.includes('cocina')) return 'Cocina';
  return normalizedRole || 'Vendedor';
};

const migrateLegacyBrandText = (value, fallback = '') => {
  if (typeof value !== 'string' || value.trim() === '') return fallback;
  return value
    .replace(/don helado/gi, 'Friozo')
    .replace(/\s+Andahuaylas\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
};

export default function App() {
  useEffect(() => {
    try { readRememberedOperator(window.localStorage); } catch { /* Storage can be blocked in private browsing. */ }
  }, []);
  const isRemoteUpdate = useRef({});
  const allowCloudWrite = useRef(false);
  const logoutInProgressRef = useRef(false);
  const [isCloudSynced, setIsCloudSynced] = useState(false);
  const [isSyncLoaded, setIsSyncLoaded] = useState(false);
  const [realtimeStatus, setRealtimeStatus] = useState('connecting'); // 'connecting' | 'connected' | 'error'
  const isVendorApp = typeof window !== 'undefined' && (
    Capacitor.isNativePlatform?.() ||
    new URLSearchParams(window.location.search).get('mode') === 'vendor'
  );

  const [customAlert, setCustomAlert] = useState(null); // { title: string, message: string, type: 'info' | 'warning' | 'error' | 'success', onClose?: () => void }
  const [successToast, setSuccessToast] = useState(null);

  const showAlert = (title, message, type = 'info', onClose = null, actionLabel = '') => {
    if (type === 'success' && !onClose) {
      setSuccessToast({ title, message });
      return;
    }
    setCustomAlert({ title, message, type, onClose, actionLabel });
  };

  const closeCustomAlert = () => {
    const callback = customAlert?.onClose;
    setCustomAlert(null);
    if (callback) callback();
  };

  useEffect(() => {
    if (!successToast) return undefined;
    const timer = window.setTimeout(() => setSuccessToast(null), 3600);
    return () => window.clearTimeout(timer);
  }, [successToast]);

  // Local alert override for App.jsx
  const alert = (msg) => {
    const isError = msg.toLowerCase().includes('error') || msg.toLowerCase().includes('falló') || msg.toLowerCase().includes('cerrado');
    const isSuccess = msg.toLowerCase().includes('éxito') || msg.toLowerCase().includes('añadido') || msg.toLowerCase().includes('incrementó');
    const type = isError ? 'error' : isSuccess ? 'success' : 'warning';
    const title = isError ? 'Error' : isSuccess ? 'Excelente' : 'Aviso';
    showAlert(title, msg, type);
  };

  const [qrCustomUrl, setQrCustomUrl] = useState(() => {
    return safeStorage.getItem('helados_qr_custom_url') || '';
  });

  const [r2Config, setR2Config] = useState({});

  const [literConfig, setLiterConfig] = useState(() => {
    if (initialPublicCatalog?.liter_config && typeof initialPublicCatalog.liter_config === 'object') return initialPublicCatalog.liter_config;
    return safeStorage.getJSON('helados_liter_config', {
      active: true,
      price: 15.0,
      maxFlavors: 3,
      image: ''
    });
  });

  const [recommendations, setRecommendations] = useState(() => {
    return safeStorage.getJSON('helados_recommendations', DEFAULT_RECOMMENDATIONS);
  });

  // --- NUEVO: Estado de Meta de Ventas centralizado en App.jsx ---
  const [salesGoal, setSalesGoal] = useState(() => {
    const saved = safeStorage.getItem('helados_sales_goal');
    return saved ? parseFloat(saved) : 100.0;
  });

  const [whatsappGreeting, setWhatsappGreeting] = useState(() => {
    return migrateLegacyBrandText(safeStorage.getItem('helados_whatsapp_greeting'), '¡Hola Friozo! 🍦\nAcabo de realizar un pedido:');
  });

  const [whatsappFooter, setWhatsappFooter] = useState(() => {
    return safeStorage.getItem('helados_whatsapp_footer') || 'Hecho desde la heladería interactiva.';
  });

  // --- NUEVO: Estado del mensaje personalizado de comanda ---
  const [ticketCustomMessage, setTicketCustomMessage] = useState(() => {
    return safeStorage.getItem('helados_ticket_custom_message') || '¡Gracias por preferirnos! Conserva tu helado en el congelador para mantener su textura perfecta. 🍦';
  });

  const [testimonials, setTestimonials] = useState(() => {
    const saved = safeStorage.getItem('helados_testimonials');
    try { return saved ? JSON.parse(saved) : []; }
    catch { return []; }
  });

  // --- NUEVO: Estado de Ordenamiento del Catálogo de la Carta (Sincronizado) ---
  const [catalogOrder, setCatalogOrder] = useState(() => {
    return safeStorage.getJSON('helados_catalog_order', ['popsicles', 'classic', 'liter', 'packs']);
  });

  // --- Estados de Marca de la Heladería (Sincronizado con LocalStorage) ---
  const [storeName, setStoreName] = useState(() => {
    return migrateLegacyBrandText(safeStorage.getItem('helados_store_name'), 'Friozo');
  });

  const [storeLogo, setStoreLogo] = useState(() => {
    const savedLogo = safeStorage.getItem('helados_store_logo');
    return !savedLogo || savedLogo === '🍦' ? '/favicon.svg' : savedLogo;
  });

  const [storeTitle, setStoreTitle] = useState(() => {
    return migrateLegacyBrandText(safeStorage.getItem('helados_store_title'), 'Friozo - Helados artesanales, paletas y delivery');
  });

  const [storeFavicon, setStoreFavicon] = useState(() => {
    const savedFavicon = safeStorage.getItem('helados_store_favicon');
    return !savedFavicon || savedFavicon === '🍦' ? '/favicon.svg' : savedFavicon;
  });

  const [storeHeroImage, setStoreHeroImage] = useState(() => {
    return safeStorage.getItem('helados_store_hero_image') || '';
  });

  const [metaPixelId, setMetaPixelId] = useState(() => {
    return safeStorage.getItem('helados_meta_pixel_id') || '';
  });

  const [googleAnalyticsId, setGoogleAnalyticsId] = useState(() => {
    return safeStorage.getItem('helados_google_analytics_id') || '';
  });

  const googleMeasurementId = isGoogleMeasurementId(googleAnalyticsId) ? googleAnalyticsId.trim().toUpperCase() : '';
  const analyticsEnabled = Boolean(googleMeasurementId || String(metaPixelId || '').trim());

  const trackEvent = (eventName, eventData = {}) => {
    if (window.fbq && metaPixelId) {
      try {
        window.fbq(eventName === 'ViewCatalog' ? 'trackCustom' : 'track', eventName === 'ViewProduct' ? 'ViewContent' : eventName, toMetaPayload(eventName, eventData));
      } catch (err) {
        console.warn('Meta Pixel track failed:', err);
      }
    }
    const ga4Event = toGa4Event(eventName, eventData);
    if (window.gtag && googleMeasurementId && ga4Event) {
      try {
        window.gtag('event', ga4Event.name, { ...ga4Event.params, send_to: googleMeasurementId });
      } catch (err) {
        console.warn('Google Analytics track failed:', err);
      }
    }
  };

  // Dynamic script injection for Meta Pixel
  useEffect(() => {
    if (metaPixelId && metaPixelId.trim()) {
      const pixelId = metaPixelId.trim();
      if (!window.fbq) {
         
        !(function (f, b, e, v, n, t, s) {
          if (f.fbq) return;
          n = f.fbq = function () {
            n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
          };
          if (!f._fbq) f._fbq = n;
          n.push = n;
          n.loaded = !0;
          n.version = "2.0";
          n.queue = [];
          t = b.createElement(e);
          t.async = !0;
          t.src = v;
          s = b.getElementsByTagName(e)[0];
          s.parentNode.insertBefore(t, s);
        })(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
         
        window.fbq('init', pixelId);
      }
    }
  }, [metaPixelId]);

  // Dynamic script injection for Google Analytics
  useEffect(() => {
    if (googleMeasurementId) {
      const gaId = googleMeasurementId;
      if (!document.querySelector(`script[data-friozo-ga4="${gaId}"]`)) {
        const script = document.createElement('script');
        script.async = true;
        script.dataset.friozoGa4 = gaId;
        script.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`;
        document.head.appendChild(script);
      }

      window.dataLayer = window.dataLayer || [];
      window.gtag = window.gtag || function(){window.dataLayer.push(arguments);};
      window.gtag('js', new Date());
      window.gtag('config', gaId, {
        page_location: `${window.location.origin}${window.location.pathname}`,
        send_page_view: false
      });
    }
  }, [googleMeasurementId]);

  const [storeInstagram, setStoreInstagram] = useState(() => {
    return safeStorage.getItem('helados_store_instagram') || 'https://www.instagram.com/';
  });

  const [storeFacebook, setStoreFacebook] = useState(() => {
    return safeStorage.getItem('helados_store_facebook') || 'https://www.facebook.com/';
  });

  const [whatsappContactMessage, setWhatsappContactMessage] = useState(() => {
    return safeStorage.getItem('helados_whatsapp_contact_message') || '¡Hola! Me gustaría hacer una consulta. 🍦';
  });

  // --- Estados de Datos de Tienda ---
  const [flavors, setFlavors] = useState(() => {
    if (Array.isArray(initialPublicCatalog?.flavors)) return initialPublicCatalog.flavors;
    return safeStorage.getJSON('helados_flavors', INITIAL_FLAVORS);
  });

  const [toppings, setToppings] = useState(() => {
    if (Array.isArray(initialPublicCatalog?.toppings)) return initialPublicCatalog.toppings;
    return safeStorage.getJSON('helados_toppings', INITIAL_TOPPINGS);
  });

  const [bases, setBases] = useState(() => {
    if (Array.isArray(initialPublicCatalog?.bases)) return initialPublicCatalog.bases;
    return safeStorage.getJSON('helados_bases', INITIAL_BASES);
  });

  const [packs, setPacks] = useState(() => {
    if (Array.isArray(initialPublicCatalog?.packs)) return initialPublicCatalog.packs;
    return safeStorage.getJSON('helados_packs', INITIAL_PACKS);
  });

  const [popsicles, setPopsicles] = useState(() => {
    if (Array.isArray(initialPublicCatalog?.popsicles)) return initialPublicCatalog.popsicles;
    return safeStorage.getJSON('helados_popsicles', INITIAL_POPSICLES);
  });

  const [orders, setOrders] = useState(() => {
    return safeStorage.getJSON('helados_orders', INITIAL_ORDERS);
  });

  const [tableCalls, setTableCalls] = useState(() => {
    return safeStorage.getJSON('helados_table_calls', []);
  });

  useEffect(() => {
    safeStorage.setItem('helados_table_calls', JSON.stringify(tableCalls));
  }, [tableCalls]);

  const [deliveryFee, setDeliveryFee] = useState(() => {
    if (Number.isFinite(Number(initialPublicCatalog?.delivery_fee))) return Number(initialPublicCatalog.delivery_fee);
    const saved = safeStorage.getItem('helados_delivery_fee');
    return saved ? parseFloat(saved) : 2.0;
  });

  const DEFAULT_SHOP_CONFIG = {
    open: true,
    useHours: false,
    freeDeliveryEnabled: true,
    smsNotificationsEnabled: false,
    smsTemplates: DEFAULT_SMS_TEMPLATES,
    locationTrackingEnabled: true,
    locationUnavailableMessage: 'Nuestros carritos saldran pronto a la calle. Mientras tanto, puedes pedir por delivery y recibir tus helados en casa.',
    locationUnavailableButtonText: 'Ver carta y pedir delivery',
    hours: {
      monday: { enabled: true, open: '09:00', close: '22:00' },
      tuesday: { enabled: true, open: '09:00', close: '22:00' },
      wednesday: { enabled: true, open: '09:00', close: '22:00' },
      thursday: { enabled: true, open: '09:00', close: '22:00' },
      friday: { enabled: true, open: '09:00', close: '22:00' },
      saturday: { enabled: true, open: '09:00', close: '22:00' },
      sunday: { enabled: true, open: '09:00', close: '22:00' }
    },
    tableOrdersEnabled: true,
    barOrdersEnabled: true,
    deliveryOrdersEnabled: true,
    waiterTakerEnabled: true,
    defaultWhatsAppEnabled: false
  };

  const [shopConfig, setShopConfig] = useState(() => {
    const saved = safeStorage.getItem('helados_shop_open');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          return { ...DEFAULT_SHOP_CONFIG, ...parsed };
        } else if (typeof parsed === 'boolean') {
          return { ...DEFAULT_SHOP_CONFIG, open: parsed };
        }
      } catch (e) {
        console.warn("Error parsing local shop config:", e);
      }
    }
    return DEFAULT_SHOP_CONFIG;
  });

  // Same clock as the order API (Lima time, overnight shifts), re-checked every
  // minute so an open page reflects opening and closing without a reload.
  const [clockMinute, setClockMinute] = useState(() => Math.floor(Date.now() / 60000));
  useEffect(() => {
    if (!shopConfig.useHours) return undefined;
    const timer = window.setInterval(() => setClockMinute(Math.floor(Date.now() / 60000)), 30000);
    return () => window.clearInterval(timer);
  }, [shopConfig.useHours]);
  const effectiveShopOpen = isShopOpenCurrently(shopConfig, new Date(clockMinute * 60000));
  const locationFeatureVisible = shopConfig.locationTrackingEnabled !== false;

  // --- Configuración Dinámica y Gestión de Usuarios ---
  const [freeDeliveryThreshold, setFreeDeliveryThreshold] = useState(() => {
    if (Number.isFinite(Number(initialPublicCatalog?.free_delivery_threshold))) return Number(initialPublicCatalog.free_delivery_threshold);
    const saved = safeStorage.getItem('helados_free_delivery_threshold');
    return saved ? parseFloat(saved) : 15.0; 
  });

  const [deliveryCampaignText, setDeliveryCampaignText] = useState(() => {
    return safeStorage.getItem('helados_delivery_campaign_text') || '¡Arma tu helado con toppings o elige un pack promocional para no pagar envío!';
  });

  const [storePhone, setStorePhone] = useState(() => {
    if (typeof initialPublicCatalog?.store_phone === 'string') return initialPublicCatalog.store_phone;
    const saved = safeStorage.getItem('helados_store_phone');
    return saved || '51989466466';
  });

  const [trendsInterval, setTrendsInterval] = useState(() => {
    const saved = safeStorage.getItem('helados_trends_interval');
    return saved ? parseInt(saved, 10) : 25;
  });

  const [trendsDisplayTime, setTrendsDisplayTime] = useState(() => {
    const saved = safeStorage.getItem('helados_trends_display_time');
    return saved ? parseInt(saved, 10) : 6;
  });

  const [staffUsers, setStaffUsers] = useState(() => {
    let list = safeStorage.getJSON('helados_staff_users', DEFAULT_STAFF_USERS);
    if (Array.isArray(list) && !list.some(u => String(u.role || '').toLowerCase().includes('repartidor'))) {
      list = [...list, { email: 'delivery@donhelado.com', name: 'Repartidor de Turno', role: 'Repartidor', status: 'Activo', phone: '987654321' }];
    }
    return list;
  });

  const [staffPermissions, setStaffPermissions] = useState(() => {
    return safeStorage.getJSON('helados_staff_permissions', {});
  });

  const [soundEnabled, setSoundEnabled] = useState(() => {
    return safeStorage.getJSON('helados_sound_enabled', true);
  });

  // --- NUEVO: Estado de Seguridad Centralizado en App.jsx ---
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const [currentUser, setCurrentUser] = useState(null);

  // --- Estados de Integración de Notificaciones (Telegram) ---
  const [telegramToken, setTelegramToken] = useState('');

  const [telegramChatId, setTelegramChatId] = useState('');

  // --- Estados de Cupones de Descuento (Manejado por Admin) ---
  const [coupons, setCoupons] = useState(() => {
    return safeStorage.getJSON('helados_coupons', [
      { code: 'HELADO10', type: 'percentage', value: 10, limit: 100, usedCount: 0, active: true, description: '10% de descuento' },
      { code: 'ENVIOFREE', type: 'free_delivery', value: 0, limit: 100, usedCount: 0, active: true, description: 'Envío gratis' },
      { code: 'AHORRO5', type: 'flat', value: 5, limit: 100, usedCount: 0, active: true, description: 'S/. 5.00 de descuento' }
    ]);
  });

  const [tableNumber, setTableNumber] = useState(() => safeStorage.getItem('helados_table_number') || null);

  // --- NUEVO: Estado del Combo Recomendado del Carrito (Sincronizado) ---
  const [cartRecommendedPack, setCartRecommendedPack] = useState(() => {
    return safeStorage.getJSON('helados_cart_recommended_pack', {
      packId: null,
      message: '¡Te recomendamos llevar nuestro Pack Familiar!'
    });
  });

  // --- NUEVO: Estado de Gastos y Egresos (Sincronizado) ---
  const [expenses, setExpenses] = useState(() => {
    return safeStorage.getJSON('helados_expenses', []);
  });

  const [cashShifts, setCashShifts] = useState(() => {
    return safeStorage.getJSON('helados_cash_shifts', []);
  });

  // --- Estados de Flujo de Cliente ---
  const [cartLocations, setCartLocations] = useState(() => {
    const saved = safeStorage.getItem('helados_cart_locations');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') return parsed;
      } catch {
        return { updatedAt: null, carts: [] };
      }
    }
    return { updatedAt: null, carts: [] };
  });

  const [view, setView] = useState(() => {
    if (isVendorApp || (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('admin') === '1')) return 'admin';
    return (typeof window !== 'undefined' && viewFromHash(window.location.hash)) || 'shop';
  });
  const trackedPageViewRef = useRef('');
  const trackedMetaPageViewRef = useRef('');
  const isCustomerView = !isVendorApp && !isLoggedIn && ['shop', 'customizer', 'liter-customizer', 'cart', 'tracker', 'locations'].includes(view);

  useEffect(() => {
    configureWebVitalsMonitoring(isCustomerView ? googleMeasurementId : '');
    if (isCustomerView && metaPixelId && window.fbq && trackedMetaPageViewRef.current !== metaPixelId) {
      trackedMetaPageViewRef.current = metaPixelId;
      window.fbq('track', 'PageView');
    }
    if (isCustomerView && googleMeasurementId && window.gtag && trackedPageViewRef.current !== googleMeasurementId) {
      trackedPageViewRef.current = googleMeasurementId;
      window.gtag('event', 'page_view', {
        page_location: `${window.location.origin}${window.location.pathname}`,
        send_to: googleMeasurementId
      });
    }
    return () => configureWebVitalsMonitoring('');
  }, [isCustomerView, googleMeasurementId, metaPixelId]);
  
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [view]);

  // Keep screens in the browser history so "back" works like a normal site.
  const historyViewRef = useRef(null);
  useEffect(() => {
    if (isVendorApp) return undefined;
    const handlePopState = event => {
      const saved = event.state?.friozoView;
      const next = isKnownView(saved) ? saved : (viewFromHash(window.location.hash) || 'shop');
      historyViewRef.current = next;
      setView(next);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isVendorApp]);

  useEffect(() => {
    if (isVendorApp || historyViewRef.current === view) return;
    const isFirstEntry = historyViewRef.current === null;
    historyViewRef.current = view;
    try {
      const state = { ...(window.history.state || {}), friozoView: view };
      const url = urlForView(view, window.location);
      if (isFirstEntry) window.history.replaceState(state, '', url);
      else window.history.pushState(state, '', url);
    } catch {
      /* Some embedded browsers block history updates; navigation still works. */
    }
  }, [view, isVendorApp]);

  useEffect(() => {
    if (!locationFeatureVisible && view === 'locations' && !isVendorApp) {
      setView('shop');
    }
  }, [locationFeatureVisible, view, isVendorApp]);

  const [cart, setCart] = useState(readCartDraft);
  useEffect(() => {
    checkoutStorage.setItem('helados_cart_draft', JSON.stringify(cart));
  }, [cart]);
  const [activeOrderId, setActiveOrderId] = useState(() => {
    const saved = safeStorage.getItem('helados_active_order_id');
    const savedTime = safeStorage.getItem('helados_active_order_time');
    if (savedTime && (Date.now() - Number(savedTime)) > 72 * 60 * 60 * 1000) {
      safeStorage.removeItem('helados_active_order_id');
      safeStorage.removeItem('helados_active_order_time');
      return null;
    }
    return saved || null;
  });
  
  const [theme, setTheme] = useState(() => {
    const saved = safeStorage.getItem('helados_theme');
    return saved || 'light';
  });

  // --- NUEVO: Rastrear automáticamente desde la URL (?track=PED-XXXX o ?track) ---
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const trackId = params.get('track') || params.get('orderId');
    if (trackId && trackId.trim()) {
      const cleanTrackId = trackId.replace(/\s+/g, '').toUpperCase();
      setActiveOrderId(cleanTrackId);
      safeStorage.setItem('helados_active_order_id', cleanTrackId);
      setView('tracker');
    } else if (params.has('track') || params.has('rastreo')) {
      const saved = safeStorage.getItem('helados_active_order_id');
      if (saved) {
        setActiveOrderId(saved.replace(/\s+/g, '').toUpperCase());
      }
      setView('tracker');
    }

    const viewParam = params.get('view');
    if (isKnownView(viewParam)) {
      setView(viewParam);
    }

    const mesaParam = cleanTableParam(params.get('mesa') || params.get('table'));
    if (mesaParam) {
      setTableNumber(mesaParam);
      safeStorage.setItem('helados_table_number', mesaParam);
    } else {
      setTableNumber(null);
      safeStorage.removeItem('helados_table_number');
    }
  }, []);

  // --- Función auxiliar para aplicar los datos sincronizados y combinar las órdenes ---
  const applyLoadedData = (serverData) => {
    setIsCloudSynced(true);
    if (serverData.store_name !== undefined) setStoreName(migrateLegacyBrandText(serverData.store_name, 'Friozo'));
    if (serverData.store_logo !== undefined) setStoreLogo(!serverData.store_logo || serverData.store_logo === '🍦' ? '/favicon.svg' : serverData.store_logo);
    if (serverData.store_title !== undefined) setStoreTitle(migrateLegacyBrandText(serverData.store_title, 'Friozo - Helados artesanales, paletas y delivery'));
    if (serverData.store_favicon !== undefined) setStoreFavicon(!serverData.store_favicon || serverData.store_favicon === '🍦' ? '/favicon.svg' : serverData.store_favicon);
    if (serverData.flavors !== undefined) setFlavors(serverData.flavors);
    if (serverData.toppings !== undefined) setToppings(serverData.toppings);
    if (serverData.bases !== undefined) setBases(serverData.bases);
    if (serverData.packs !== undefined) setPacks(serverData.packs);
    if (serverData.popsicles !== undefined) setPopsicles(serverData.popsicles);

    // Combinar órdenes generales e individuales order_PED-XXXX de forma única por ID y ordenar desc
    let initialOrders = serverData.orders || [];
    const individualOrders = [];
    const loadedTableCalls = [];
    Object.keys(serverData).forEach(k => {
      if (k.startsWith('order_call_') && serverData[k]) {
        if (!serverData[k].resolved) {
          loadedTableCalls.push(serverData[k]);
        }
      } else if (k.startsWith('order_') && serverData[k]) {
        individualOrders.push(serverData[k]);
      }
    });
    setTableCalls(loadedTableCalls);

    if (individualOrders.length > 0 || serverData.orders !== undefined) {
      const combinedMap = {};
      // 1. Agregar las de orders globales
      initialOrders.forEach(o => {
        if (o && o.id) combinedMap[o.id] = o;
      });
      // 2. Sobreescribir o agregar con las individuales (las más frescas)
      individualOrders.forEach(o => {
        if (o && o.id) combinedMap[o.id] = o;
      });
      const finalOrders = Object.values(combinedMap).sort((a, b) => new Date(b.date) - new Date(a.date));
      setOrders(finalOrders);
    }

    if (serverData.delivery_fee !== undefined) setDeliveryFee(parseFloat(serverData.delivery_fee) || 0);
    if (serverData.shop_open !== undefined) {
      let parsed = serverData.shop_open;
      if (typeof parsed === 'string') {
        try {
          parsed = JSON.parse(parsed);
        } catch (e) {
          console.warn("Error parsing server shop config:", e);
        }
      }
      if (parsed && typeof parsed === 'object') {
        setShopConfig(prev => ({ ...prev, ...parsed }));
      } else {
        setShopConfig(prev => ({ ...prev, open: !!parsed }));
      }
    }
    if (serverData.free_delivery_threshold !== undefined) setFreeDeliveryThreshold(parseFloat(serverData.free_delivery_threshold) || 0);
    if (serverData.delivery_campaign_text !== undefined) setDeliveryCampaignText(serverData.delivery_campaign_text);
    if (serverData.store_phone !== undefined) setStorePhone(serverData.store_phone);
    if (serverData.sound_enabled !== undefined) setSoundEnabled(!!serverData.sound_enabled);
    if (serverData.coupons !== undefined) setCoupons(serverData.coupons);
    if (serverData.sales_goal !== undefined) setSalesGoal(parseFloat(serverData.sales_goal) || 100.0);
    if (serverData.whatsapp_greeting !== undefined) setWhatsappGreeting(serverData.whatsapp_greeting);
    if (serverData.whatsapp_footer !== undefined) setWhatsappFooter(serverData.whatsapp_footer);
    if (serverData.qr_custom_url !== undefined) setQrCustomUrl(serverData.qr_custom_url);
    if (serverData.recommendations !== undefined) setRecommendations(serverData.recommendations);
    if (serverData.cart_recommended_pack !== undefined) setCartRecommendedPack(serverData.cart_recommended_pack);
    if (serverData.expenses !== undefined) setExpenses(serverData.expenses);
    if (serverData.cash_shifts !== undefined) setCashShifts(serverData.cash_shifts);
    if (serverData.staff_users !== undefined) setStaffUsers(serverData.staff_users);
    if (serverData.staff_permissions !== undefined) setStaffPermissions(serverData.staff_permissions);
    if (serverData.liter_config !== undefined) setLiterConfig(serverData.liter_config);
    if (serverData.ticket_custom_message !== undefined) setTicketCustomMessage(serverData.ticket_custom_message);
    if (serverData.catalog_order !== undefined) setCatalogOrder(serverData.catalog_order);
    if (serverData.store_instagram !== undefined) setStoreInstagram(serverData.store_instagram);
    if (serverData.store_facebook !== undefined) setStoreFacebook(serverData.store_facebook);
    if (serverData.whatsapp_contact_message !== undefined) setWhatsappContactMessage(serverData.whatsapp_contact_message);
    if (serverData.cart_locations !== undefined) {
      setCartLocations(prev => {
        const serverVal = serverData.cart_locations || { updatedAt: null, carts: [] };
        if (isLoggedIn && prev && prev.updatedAt && serverVal.updatedAt) {
          if (new Date(serverVal.updatedAt) <= new Date(prev.updatedAt)) {
            console.log("⏳ Ignorando carga inicial de cart_locations más antigua o igual que la local.");
            return prev;
          }
        }
        return serverVal;
      });
    }
    if (serverData.trends_interval !== undefined) setTrendsInterval(parseInt(serverData.trends_interval, 10) || 25);
    if (serverData.trends_display_time !== undefined) setTrendsDisplayTime(parseInt(serverData.trends_display_time, 10) || 6);
    if (serverData.testimonials !== undefined) setTestimonials(serverData.testimonials);
    if (serverData.store_hero_image !== undefined) setStoreHeroImage(serverData.store_hero_image);
    if (serverData.meta_pixel_id !== undefined) setMetaPixelId(serverData.meta_pixel_id);
    if (serverData.google_analytics_id !== undefined) setGoogleAnalyticsId(serverData.google_analytics_id);
  };

  const applyLoadedDataRef = useRef(applyLoadedData);
  useEffect(() => {
    applyLoadedDataRef.current = applyLoadedData;
  });

  // --- NUEVO: Efecto de Sincronización e Inicialización Supabase ---
  useEffect(() => {
    let authSubscription = null;

    const initSync = async () => {
      allowCloudWrite.current = false; // Bloquear escrituras inmediatamente al iniciar sincronización
      setIsSyncLoaded(false);

      if (!supabase) {
        console.log("💾 Supabase no configurado. Utilizando base de datos local (LocalStorage) en modo fuera de línea.");
        setIsSyncLoaded(true);
        return;
      }

      // 1. Verificar la sesión activa de Supabase al montar el componente
      let hasActiveSession = false;
      let activeSession = null;
      try {
        if (!logoutInProgressRef.current) {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            console.log("🔑 Sesión activa de Supabase recuperada:", session.user.email);
            hasActiveSession = true;
            activeSession = session;
            const userRole = normalizeRoleLabel(session.user.app_metadata?.role, session.user.email);
            const userName = session.user.user_metadata?.name || 'Administrador Supabase';
            setIsLoggedIn(true);
            setCurrentUser({
              email: session.user.email,
              role: userRole,
              name: userName,
              isSupabaseUser: true
            });
          } else {
            setIsLoggedIn(false);
            setCurrentUser(null);
          }
        } else {
          setIsLoggedIn(false);
          setCurrentUser(null);
        }
      } catch (err) {
        console.error("Error al obtener la sesión de Supabase:", err);
      }
      
      const serverData = await fetchSyncedData(hasActiveSession, activeSession);
      if (serverData) {
        console.log("🔌 Datos recuperados de Supabase:", Object.keys(serverData));
        setIsCloudSynced(serverData.__fromCache !== true);
        
        // Desactivamos temporalmente escrituras mientras cargamos
        Object.keys(serverData).forEach(k => {
          isRemoteUpdate.current[k] = true;
        });

        applyLoadedDataRef.current(serverData);

        // Habilitar escrituras después de que las actualizaciones del estado de React se procesen
        setTimeout(() => {
          allowCloudWrite.current = serverData.__fromCache !== true;
          isRemoteUpdate.current = {}; // Limpiar flags residuales de la carga inicial
        }, 400);
      } else {
        console.warn("⚠️ No se pudieron obtener datos de Supabase. Escrituras remotas desactivadas para proteger la base de datos.");
        allowCloudWrite.current = false;
      }

      // 2. Recuperar la lista de personal desde Supabase de forma segura (multidispositivo)
      if (hasActiveSession) {
        try {
          const { data: adminList, error: adminListError } = await supabase.rpc('get_all_admins');
          if (!adminListError && Array.isArray(adminList) && adminList.length > 0) {
            console.log("👥 Personal recuperado de Supabase:", adminList.length);
            setStaffUsers(adminList);
          }
        } catch (err) {
          console.warn("⚠️ No se pudo obtener la lista de personal de Supabase:", err.message);
        }
      }

      // La suscripción en tiempo real ahora se maneja de forma reactiva y separada
      // en un useEffect independiente para evitar condiciones de carrera.

      // 3. Suscribirse a cambios del estado de autenticación de Supabase
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        console.log(`🔔 Supabase Auth Evento: ${event}`);
        // getSession() ya realizó la carga inicial. Evita duplicar todas las
        // lecturas de configuración y pedidos al abrir o recargar la app.
        if (event === 'INITIAL_SESSION') return;
        if (session) {
          const userRole = normalizeRoleLabel(session.user.app_metadata?.role, session.user.email);
          const userName = session.user.user_metadata?.name || 'Administrador Supabase';
          setIsLoggedIn(true);
          setCurrentUser({
            email: session.user.email,
            role: userRole,
            name: userName,
            isSupabaseUser: true
          });
          sessionStorage.setItem('helados_admin_login_timestamp', Date.now().toString());
          
          // Re-sincronizar los datos una vez que tenemos la sesión activa de forma segura
          allowCloudWrite.current = false;
          setIsSyncLoaded(false);
          const updatedServerData = await fetchSyncedData(true, session);
          if (updatedServerData) {
            // Desactivar temporalmente escrituras mientras cargamos datos de admin
            Object.keys(updatedServerData).forEach(k => {
              isRemoteUpdate.current[k] = true;
            });
            applyLoadedDataRef.current(updatedServerData);
            if (updatedServerData.staff_users !== undefined) setStaffUsers(updatedServerData.staff_users);
            
            setTimeout(() => {
              allowCloudWrite.current = true;
              isRemoteUpdate.current = {}; // Limpiar flags residuales de la carga de admin
            }, 400);
          } else {
            allowCloudWrite.current = false;
          }
          setIsSyncLoaded(true);
        }
        // Solo responder a SIGNED_OUT para evitar que INITIAL_SESSION con sesión nula
        // cierre la sesión de usuarios autenticados mediante RPC fallback local
        if (!session && event === 'SIGNED_OUT') {
          setIsLoggedIn(false);
          setCurrentUser(null);
        }
      });
      authSubscription = subscription;
      setIsSyncLoaded(true);
    };

    initSync();

    return () => {
      if (authSubscription) {
        authSubscription.unsubscribe();
      }
    };
  }, []);

  const handleRefreshCarts = async () => {
    if (!supabase) return false;
    try {
      invalidateSyncCache();
      const serverData = await fetchSyncedData(isLoggedIn);
      if (serverData && serverData.cart_locations) {
        setCartLocations(serverData.cart_locations);
        return true;
      }
    } catch (err) {
      console.warn("Error refreshing cart locations:", err);
    }
    return false;
  };

  // --- Hook de Sincronización Consolidado y Seguro ---
  const useSyncEffect = (key, value, isJSON = false, syncCloud = true) => {
    const prevValueRef = useRef(value);

    useEffect(() => {
      // 1. Guardar en localStorage
      const valueStr = isJSON ? JSON.stringify(value) : String(value);
      safeStorage.setItem(`helados_${key}`, valueStr);

      // 2. Si los datos no se han cargado de la nube o no está permitido escribir, salir
      if (!isSyncLoaded || !allowCloudWrite.current) {
        prevValueRef.current = value;
        return;
      }

      // 4. Si es una actualización remota, limpiar bandera y no re-escribir
      if (isRemoteUpdate.current[key]) {
        isRemoteUpdate.current[key] = false;
        prevValueRef.current = value;
        return;
      }

      // 3. Comprobar si el valor realmente cambió localmente
      const hasChanged = isJSON 
        ? JSON.stringify(prevValueRef.current) !== valueStr
        : prevValueRef.current !== value;

      if (!hasChanged) return;

      prevValueRef.current = value;

      // 5. Si está logueado, subir a la nube de forma segura
      if (isLoggedIn && syncCloud) {
        const isConfigKey = ![
          'cart_locations',
          'flavors',
          'toppings',
          'bases',
          'packs',
          'popsicles',
          'catalog_order',
          'liter_config',
          'cart_recommended_pack',
          'recommendations'
        ].includes(key) && !key.startsWith('order_');

        const isUserAdmin = currentUser?.role === 'Administrador' || currentUser?.email === 'admin@donhelado.com';

        // Si es una clave de configuración/general y el usuario no es Admin, no intentar sincronizar para evitar advertencias de RLS
        if (isConfigKey && !isUserAdmin) {
          console.log(`ℹ️ Omitiendo sincronización remota de '${key}' para rol ${currentUser?.role || 'Personal'}.`);
          return;
        }

        updateSyncedData(key, value);
      }
    }, [value, key, isJSON, syncCloud]);
  };

  // --- Invocaciones de Sincronización de Estados ---
  useSyncEffect('store_name', storeName, false);
  useSyncEffect('testimonials', testimonials, true);
  useSyncEffect('store_title', storeTitle, false);
  useSyncEffect('store_favicon', storeFavicon, false);
  useSyncEffect('catalog_order', catalogOrder, true);
  useSyncEffect('store_logo', storeLogo, false);
  useSyncEffect('flavors', flavors, true);
  useSyncEffect('toppings', toppings, true);
  useSyncEffect('bases', bases, true);
  useSyncEffect('packs', packs, true);
  useSyncEffect('popsicles', popsicles, true);
  // Los pedidos se guardan individualmente mediante /api/order. Mantener aquí
  // solo la copia local evita reescribir y transferir todo el historial en cada cambio.
  useSyncEffect('orders', orders, true, false);
  useSyncEffect('delivery_fee', deliveryFee, false);
  useSyncEffect('shop_open', shopConfig, true);
  useSyncEffect('free_delivery_threshold', freeDeliveryThreshold, false);
  useSyncEffect('delivery_campaign_text', deliveryCampaignText, false);
  useSyncEffect('store_phone', storePhone, false);
  useSyncEffect('staff_users', staffUsers, true);
  useSyncEffect('staff_permissions', staffPermissions, true);
  useSyncEffect('sound_enabled', soundEnabled, true);
  useSyncEffect('coupons', coupons, true);
  useSyncEffect('sales_goal', salesGoal, false);
  useSyncEffect('whatsapp_greeting', whatsappGreeting, false);
  useSyncEffect('whatsapp_footer', whatsappFooter, false);
  useSyncEffect('qr_custom_url', qrCustomUrl, false);
  useSyncEffect('recommendations', recommendations, true);
  useSyncEffect('cart_recommended_pack', cartRecommendedPack, true);
  useSyncEffect('expenses', expenses, true);
  useSyncEffect('cash_shifts', cashShifts, true);
  useSyncEffect('liter_config', literConfig, true);
  useSyncEffect('ticket_custom_message', ticketCustomMessage, false);
  useSyncEffect('store_instagram', storeInstagram, false);
  useSyncEffect('store_facebook', storeFacebook, false);
  useSyncEffect('whatsapp_contact_message', whatsappContactMessage, false);
  useSyncEffect('cart_locations', cartLocations, true);
  useSyncEffect('store_hero_image', storeHeroImage, false);
  useSyncEffect('meta_pixel_id', metaPixelId, false);
  useSyncEffect('google_analytics_id', googleAnalyticsId, false);
  useSyncEffect('trends_interval', trendsInterval, false);
  useSyncEffect('trends_display_time', trendsDisplayTime, false);

  // --- Efectos para actualizar el título y favicon dinámicamente ---
  useEffect(() => {
    const activeTitle = storeTitle || `${storeName || 'Friozo'} - Helados artesanales, paletas y delivery`;
    document.title = activeTitle;
  }, [storeTitle, storeName]);

  useEffect(() => {
    let faviconUrl = storeFavicon || '🍦';
    if (faviconUrl.length <= 4 && !faviconUrl.startsWith('http') && !faviconUrl.startsWith('/')) {
      faviconUrl = `data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>${faviconUrl}</text></svg>`;
    } else {
      if (faviconUrl.startsWith('http://')) {
        faviconUrl = faviconUrl.replace('http://', 'https://');
      }
    }
    const link = document.querySelector("link[rel~='icon']") || document.createElement('link');
    link.type = faviconUrl.includes('svg+xml') ? 'image/svg+xml' : 'image/png';
    link.rel = 'icon';
    link.href = faviconUrl;
    if (!document.querySelector("link[rel~='icon']")) {
      document.head.appendChild(link);
    }
  }, [storeFavicon]);

  useEffect(() => {
    safeStorage.setItem('helados_staff_users', JSON.stringify(staffUsers));
  }, [staffUsers]);

  // --- Suscripción Reactiva en Tiempo Real (Supabase Realtime) ---
  useEffect(() => {
    if (!supabase || !isSyncLoaded) return;
    
    if ((!isLoggedIn && !isVendorApp) || view !== 'admin') {
      setRealtimeStatus('disconnected');
      return;
    }
    
    console.log(`🔌 Suscribiendo canal en tiempo real en vista administración...`);

    const updateStateIfChanged = (setter, key, newValue) => {
      setter(prev => {
        if (JSON.stringify(prev) !== JSON.stringify(newValue)) {
          isRemoteUpdate.current[key] = true;
          return newValue;
        }
        return prev;
      });
    };

    const activeChannel = subscribeToSync((key, value) => {
      if (key.startsWith('order_call_')) {
        setTableCalls(prev => {
          if (!value || value.resolved) {
            return prev.filter(c => String(c.table) !== String(key.replace('order_call_Mesa_', '')));
          }
          const exists = prev.some(c => String(c.table) === String(value.table));
          if (exists) {
            return prev.map(c => String(c.table) === String(value.table) ? value : c);
          } else {
            return [...prev, value];
          }
        });
        return;
      }

      if (key.startsWith('order_') && key !== 'orders' && value) {
        setOrders(prev => {
          const exists = prev.some(o => o.id === value.id);
          if (exists) {
            const hasChanged = JSON.stringify(prev.find(o => o.id === value.id)) !== JSON.stringify(value);
            if (hasChanged) {
              isRemoteUpdate.current[key] = true;
              isRemoteUpdate.current['orders'] = true;
              return prev.map(o => o.id === value.id ? value : o);
            }
            return prev;
          } else {
            isRemoteUpdate.current[key] = true;
            isRemoteUpdate.current['orders'] = true;
            return [value, ...prev];
          }
        });
        return;
      }

      switch (key) {
        case 'store_name':
          updateStateIfChanged(setStoreName, 'store_name', value);
          break;
        case 'store_title':
          updateStateIfChanged(setStoreTitle, 'store_title', value);
          break;
        case 'store_favicon':
          updateStateIfChanged(setStoreFavicon, 'store_favicon', value);
          break;
        case 'catalog_order':
          updateStateIfChanged(setCatalogOrder, 'catalog_order', value);
          break;
        case 'store_logo':
          updateStateIfChanged(setStoreLogo, 'store_logo', value);
          break;
        case 'flavors':
          updateStateIfChanged(setFlavors, 'flavors', value);
          break;
        case 'toppings':
          updateStateIfChanged(setToppings, 'toppings', value);
          break;
        case 'bases':
          updateStateIfChanged(setBases, 'bases', value);
          break;
        case 'packs':
          updateStateIfChanged(setPacks, 'packs', value);
          break;
        case 'popsicles':
          updateStateIfChanged(setPopsicles, 'popsicles', value);
          break;
        case 'orders':
          updateStateIfChanged(setOrders, 'orders', value);
          break;
        case 'delivery_fee':
          updateStateIfChanged(setDeliveryFee, 'delivery_fee', value);
          break;
        case 'shop_open':
          updateStateIfChanged((val) => {
            let parsed = val;
            if (typeof parsed === 'string') {
              try {
                parsed = JSON.parse(parsed);
              } catch (e) {
                console.warn("Error parsing synchronized shop config:", e);
              }
            }
            if (parsed && typeof parsed === 'object') {
              setShopConfig(prev => ({ ...prev, ...parsed }));
            } else {
              setShopConfig(prev => ({ ...prev, open: !!parsed }));
            }
          }, 'shop_open', value);
          break;
        case 'free_delivery_threshold':
          updateStateIfChanged(setFreeDeliveryThreshold, 'free_delivery_threshold', value);
          break;
        case 'delivery_campaign_text':
          updateStateIfChanged(setDeliveryCampaignText, 'delivery_campaign_text', value);
          break;
        case 'store_phone':
          updateStateIfChanged(setStorePhone, 'store_phone', value);
          break;
        case 'staff_users':
          updateStateIfChanged(setStaffUsers, 'staff_users', value);
          break;
        case 'sound_enabled':
          updateStateIfChanged(setSoundEnabled, 'sound_enabled', value);
          break;
        case 'coupons':
          updateStateIfChanged(setCoupons, 'coupons', value);
          break;
        case 'sales_goal':
          updateStateIfChanged(setSalesGoal, 'sales_goal', value);
          break;
        case 'whatsapp_greeting':
          updateStateIfChanged(setWhatsappGreeting, 'whatsapp_greeting', value);
          break;
        case 'whatsapp_footer':
          updateStateIfChanged(setWhatsappFooter, 'whatsapp_footer', value);
          break;
        case 'qr_custom_url':
          updateStateIfChanged(setQrCustomUrl, 'qr_custom_url', value);
          break;
        case 'recommendations':
          updateStateIfChanged(setRecommendations, 'recommendations', value);
          break;
        case 'cart_recommended_pack':
          updateStateIfChanged(setCartRecommendedPack, 'cart_recommended_pack', value);
          break;
        case 'expenses':
          updateStateIfChanged(setExpenses, 'expenses', value);
          break;
        case 'cash_shifts':
          updateStateIfChanged(setCashShifts, 'cash_shifts', value);
          break;
        case 'staff_permissions':
          updateStateIfChanged(setStaffPermissions, 'staff_permissions', value);
          break;
        case 'liter_config':
          updateStateIfChanged(setLiterConfig, 'liter_config', value);
          break;
        case 'ticket_custom_message':
          updateStateIfChanged(setTicketCustomMessage, 'ticket_custom_message', value);
          break;
        case 'store_instagram':
          updateStateIfChanged(setStoreInstagram, 'store_instagram', value);
          break;
        case 'store_facebook':
          updateStateIfChanged(setStoreFacebook, 'store_facebook', value);
          break;
        case 'whatsapp_contact_message':
          updateStateIfChanged(setWhatsappContactMessage, 'whatsapp_contact_message', value);
          break;
        case 'cart_locations':
          setCartLocations(prev => {
            const serverVal = value || { updatedAt: null, carts: [] };
            if (isLoggedIn && prev && prev.updatedAt && serverVal.updatedAt) {
              if (new Date(serverVal.updatedAt) <= new Date(prev.updatedAt)) {
                console.log("⏳ Ignorando actualización remota de cart_locations más antigua o igual que la local.");
                return prev;
              }
            }
            if (JSON.stringify(prev) !== JSON.stringify(serverVal)) {
              isRemoteUpdate.current['cart_locations'] = true;
              return serverVal;
            }
            return prev;
          });
          break;
        default:
          break;
      }
    }, isLoggedIn, tableNumber, (status, err) => {
      console.log(`🔌 Estado Realtime (Navbar): ${status}`, err || '');
      if (status === 'SUBSCRIBED') {
        setRealtimeStatus('connected');
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || err) {
        setRealtimeStatus('error');
      } else {
        setRealtimeStatus('connecting');
      }
    });

    return () => {
      if (supabase && activeChannel) {
        supabase.removeChannel(activeChannel);
      }
    };
  }, [isLoggedIn, isSyncLoaded, tableNumber, view, isVendorApp]);

  // Calcular automáticamente la lista de mesas ocupadas a partir de pedidos activos
  useEffect(() => {
    if (!isLoggedIn) return;
    
    const activeTableNumbers = Array.from(new Set(orders
      .filter(o => (o.customer?.orderType === 'Mesa' || o.customer?.orderType === 'Mesa_Llevar') && o.status !== 'Cancelado' && !o.tablePaid)
      .map(o => String(o.customer?.tableNumber))
    )).filter(Boolean);
    
    if (JSON.stringify(shopConfig.occupiedTables || []) !== JSON.stringify(activeTableNumbers)) {
      setShopConfig(prev => ({
        ...prev,
        occupiedTables: activeTableNumbers
      }));
    }
  }, [orders, isLoggedIn, shopConfig.occupiedTables]);

  const handleLogoutRef = useRef(handleLogout);
  useEffect(() => {
    handleLogoutRef.current = handleLogout;
  });

  // Control de Expiración de Sesión de Admin (10 Días)
  useEffect(() => {
    if (isLoggedIn) {
      const tenDaysMs = 10 * 24 * 60 * 60 * 1000;
      const loginAt = sessionStorage.getItem('helados_admin_login_timestamp');
      if (loginAt) {
        const elapsed = Date.now() - parseInt(loginAt, 10);
        if (elapsed > tenDaysMs) {
          console.log("🔒 Sesión caducada tras 10 días. Cerrando sesión automáticamente...");
          window.alert("🔒 Por razones de seguridad, tu sesión administrativa ha expirado tras 10 días de uso continuo. Por favor, inicia sesión de nuevo.");
          handleLogoutRef.current?.();
        }
      }
    }
  }, [isLoggedIn]);

  useEffect(() => {
    safeStorage.removeItem('helados_admin_logged_in');
    safeStorage.removeItem('helados_admin_current_user');
    safeStorage.removeItem('helados_admin_password');
    safeStorage.removeItem('helados_admin_login_timestamp');
  }, []);

  useEffect(() => {
    if (activeOrderId) {
      safeStorage.setItem('helados_active_order_id', activeOrderId);
      if (!safeStorage.getItem('helados_active_order_time')) {
        safeStorage.setItem('helados_active_order_time', String(Date.now()));
      }
    } else {
      safeStorage.removeItem('helados_active_order_id');
      safeStorage.removeItem('helados_active_order_time');
    }
  }, [activeOrderId]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    safeStorage.setItem('helados_theme', theme);
  }, [theme]);

  // --- Funciones del Carrito ---
  const handleAddToCart = (item) => {
    if (!effectiveShopOpen) {
      alert(`Lo sentimos, ${storeName} se encuentra CERRADO temporalmente en este momento.`);
      return false;
    }
    setCart(current => addCartItem(current, item));
    if (analyticsEnabled) trackEvent('AddToCart', { value: Number(item.price) * (Number(item.quantity) || 1), items: [item] });
    showAlert('Producto agregado', `${item.name || 'Tu helado'} ya está en tu pedido.`, 'success');
    return true;
  };

  const handleUpdateCartQuantity = (index, newQty) => {
    setCart(current => newQty <= 0
      ? current.filter((_, idx) => idx !== index)
      : current.map((entry, idx) => idx === index ? { ...entry, quantity: newQty } : entry));
  };

  const handleRemoveFromCart = (index) => {
    setCart(current => current.filter((_, idx) => idx !== index));
  };

  const sendTelegramNotification = async (order) => {
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (order.isOperator && supabase) {
        const { data } = await supabase.auth.getSession();
        if (data?.session?.access_token) headers.Authorization = `Bearer ${data.session.access_token}`;
      }
      const response = await fetch('/api/telegram', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          orderId: order.id,
          submissionKey: order.submissionKey,
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

  const handlePlaceOrder = async (newOrder) => {
    let savedOrder = newOrder;
    if (newOrder.isOperator) {
      if (!supabase) throw new Error('No hay conexión con la tienda. Reconecta antes de registrar el pedido.');
      savedOrder = await createOperatorOrder(supabase, newOrder);
    } else {
      savedOrder = await createOrder(newOrder);
    }
    setOrders(prev => [savedOrder, ...prev.filter(order => order.id !== savedOrder.id)]);
    if (!newOrder.isOperator) {
      if (savedOrder.submissionKey) checkoutStorage.setItem(`helados_order_token_${savedOrder.id}`, savedOrder.submissionKey);
      setCart(current => subtractOrderedItems(current, newOrder.items || []));
      setActiveOrderId(savedOrder.id);
      setView('tracker');
      
      // Guardar pedido activo en localStorage para rastreo y control de mesa ocupada
      safeStorage.setItem('helados_active_order_id', savedOrder.id);
      safeStorage.setItem('helados_active_order_time', String(Date.now()));
      if (newOrder.customer?.orderType === 'Mesa' || newOrder.customer?.orderType === 'Mesa_Llevar') {
        safeStorage.setItem('helados_active_order_table', String(newOrder.customer?.tableNumber));
      } else {
        safeStorage.removeItem('helados_active_order_table');
      }
    }
    
    await sendTelegramNotification(savedOrder);
    return savedOrder;
  };

  const handleUpdateOrderStatus = async (orderId, newStatus, patch = {}) => {
    const cleanOrderId = String(orderId || '').trim().toUpperCase();
    const previous = orders.find(o => String(o.id || '').trim().toUpperCase() === cleanOrderId);
    if (!previous || !supabase) return false;
    try {
      const proposed = { ...previous, ...patch, id: cleanOrderId, status: newStatus };
      const saved = await updateOrder(supabase, previous, proposed);
      setOrders(current => current.map(order => order.id === previous.id ? saved : order));
      return true;
    } catch (error) {
      console.warn('No se pudo actualizar el pedido:', error.message);
      showAlert('No se confirmó el cambio', error.message || 'Actualiza la lista e intenta nuevamente.', 'warning');
      return false;
    }
  };

  // handleUpdateOrders: actualiza el estado local Y sincroniza cada pedido modificado en Supabase
  const handleUpdateOrders = async (newOrders) => {
    // Detectar órdenes que realmente cambiaron respecto al estado actual
    const changedOrders = newOrders.filter(newO => {
      const existing = orders.find(o => o.id === newO.id);
      return !existing || JSON.stringify(existing) !== JSON.stringify(newO);
    });
    // Persistir cada pedido modificado individualmente en Supabase
    if (changedOrders.length > 0) {
      try {
        const savedChanges = await Promise.all(changedOrders.map(async proposed => {
          const previous = orders.find(order => order.id === proposed.id);
          if (previous && supabase) return updateOrder(supabase, previous, proposed);
          if (!supabase) throw new Error('No hay conexión con la tienda. Reconecta antes de registrar el pedido.');
          return createOperatorOrder(supabase, proposed);
        }));
        const savedById = new Map(savedChanges.map(order => [order.id, order]));
        setOrders(newOrders.map(order => savedById.get(order.id) || order));
        return true;
      } catch (err) {
        console.warn('⚠️ No se pudieron sincronizar algunos pedidos en Supabase:', err);
        showAlert('No se confirmó el cambio', err.message || 'Actualiza la lista e intenta nuevamente.', 'warning');
        return false;
      }
    }
    setOrders(newOrders);
    return true;
  };

  const persistAdminCollection = async (key, value, setter) => {
    const saved = await updateSyncedData(key, value);
    if (!saved) {
      showAlert('No se confirmó el guardado', 'Revisa la conexión e inténtalo nuevamente. Los datos visibles no fueron modificados.', 'warning');
      return false;
    }
    isRemoteUpdate.current[key] = true;
    setter(value);
    return true;
  };

  const handleUpdateExpenses = value => persistAdminCollection('expenses', value, setExpenses);
  const handleUpdateCashShifts = value => persistAdminCollection('cash_shifts', value, setCashShifts);

  async function handleLogout() {
    logoutInProgressRef.current = true;
    window.setTimeout(() => {
      logoutInProgressRef.current = false;
    }, 2000); // 2 segundos para dar margen a la desconexión asíncrona

    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.warn("Error al cerrar sesión en Supabase:", err.message);
      }
      
      // Limpieza manual y agresiva de tokens de Supabase en localStorage y sessionStorage
      // para asegurar el cierre de sesión local incluso ante fallos de conexión o almacenamiento móvil
      try {
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (key.startsWith('sb-') || key.includes('auth-token'))) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach(k => safeStorage.removeItem(k));

        const sessionKeysToRemove = [];
        for (let i = 0; i < sessionStorage.length; i++) {
          const key = sessionStorage.key(i);
          if (key && (key.startsWith('sb-') || key.includes('auth-token'))) {
            sessionKeysToRemove.push(key);
          }
        }
        sessionKeysToRemove.forEach(k => sessionStorage.removeItem(k));
      } catch (e) {
        console.warn("Error al limpiar tokens locales de Supabase:", e);
      }
    }
    sessionStorage.removeItem('helados_admin_login_timestamp');
    setIsLoggedIn(false);
    setCurrentUser(null);
    setView(isVendorApp ? 'admin' : 'shop');
  }

  const totalCartItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartSubtotal = cart.reduce((sum, item) => sum + (Number(item.price) || 0) * item.quantity, 0);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      
      {/* Barra de Navegación (Cabecera Principal) */}
      <nav className="navbar glass">
        <div className="container nav-container">
          <a 
            href="#" 
            className="logo" 
            onClick={(e) => { e.preventDefault(); setView(isVendorApp ? 'admin' : 'shop'); }}
            onDoubleClick={(e) => { e.preventDefault(); setView('admin'); }}
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            {renderLogo(storeLogo)}
            <span>{storeName}</span>
            {tableNumber && (
              <span style={{
                background: 'var(--primary-color)',
                color: 'white',
                fontSize: '0.7rem',
                fontWeight: 'bold',
                padding: '2px 8px',
                borderRadius: '12px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}>
                Mesa {tableNumber}
              </span>
            )}
          </a>

          {/* Menú de Navegación para Escritorio */}
          {!isVendorApp && (
            <div className="nav-links desktop-only">
              <a 
                href="#tienda"
                className={`nav-btn ${view === 'shop' ? 'active' : ''}`}
                onClick={(e) => { e.preventDefault(); setView('shop'); }}
                style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
              >
                <span aria-hidden="true">🍦</span>
                <span>Tienda</span>
              </a>
              <a 
                href="#personalizar"
                className={`nav-btn ${view === 'customizer' ? 'active' : ''}`}
                onClick={(e) => { e.preventDefault(); setView('customizer'); }}
                style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
              >
                <span aria-hidden="true">✦</span>
                <span>Crear el mío</span>
              </a>
              <a 
                href="#carrito"
                className={`nav-btn ${view === 'cart' ? 'active' : ''}`}
                onClick={(e) => { e.preventDefault(); setView('cart'); }}
                style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
              >
                <span aria-hidden="true">🛒</span>
                <span>Mi pedido</span>
                {totalCartItems > 0 && <span className="cart-badge">{totalCartItems}</span>}
              </a>
              {locationFeatureVisible && (
              <a 
                href="#ubicacion"
                className={`nav-btn ${view === 'locations' ? 'active' : ''}`}
                onClick={(e) => { e.preventDefault(); setView('locations'); }}
                style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
              >
                <span aria-hidden="true">📍</span>
                <span>Ubicacion</span>
              </a>
              )}
              <a 
                href="#rastrear"
                className={`nav-btn ${view === 'tracker' ? 'active' : ''}`}
                onClick={(e) => { e.preventDefault(); setView('tracker'); }}
                style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
              >
                <span aria-hidden="true">🔎</span>
                <span>Rastrear</span>
              </a>
              
              {isLoggedIn && (
                <a 
                  href="#admin"
                  className={`nav-btn ${view === 'admin' ? 'active' : ''}`}
                  onClick={(e) => { e.preventDefault(); setView('admin'); }}
                  style={{ borderLeft: '1px solid var(--border-color)', borderRadius: 0, paddingLeft: '15px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
                >
                  <span aria-hidden="true">🛠️</span>
                  <span>Panel Admin</span>
                </a>
              )}
              
              <button 
                onClick={toggleTheme} 
                className="nav-btn"
                style={{ fontSize: '1.1rem', padding: '6px' }}
                title="Cambiar Tema"
              >
                {theme === 'light' ? '🌙 Noche' : '☀️ Dia'}
              </button>

              {/* Indicador de conexión Realtime (Desktop) removido por discreción */}

              {isLoggedIn && (
                <button 
                  onClick={handleLogout} 
                  className="nav-btn logout-desktop-btn"
                  title="Cerrar Sesión"
                >
                  <span aria-hidden="true">🚪</span>
                  <span>Cerrar Sesion</span>
                </button>
              )}
            </div>
          )}

          {/* Acciones Rápidas de Cabecera para Móvil */}
          <div className="mobile-header-actions" style={{ alignItems: 'center', gap: '8px' }}>
            {/* Indicador de conexión Realtime (Móvil) removido por discreción */}

            <button 
              onClick={toggleTheme} 
              className="nav-btn-icon"
              title="Cambiar Tema"
            >
              {theme === 'light' ? '🌙' : '☀️'}
            </button>
            {isLoggedIn && (
              <button 
                onClick={handleLogout} 
                className="nav-btn-icon logout-mobile-btn"
                title="Cerrar Sesión"
              >
                🚪
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Contenido Principal */}
      <main className="container" style={{ paddingBottom: '80px', flex: 1 }}>
        {!effectiveShopOpen && view !== 'admin' && (
          <div className="glass" style={{
            background: 'rgba(231, 76, 60, 0.15)',
            border: '1px solid rgba(231, 76, 60, 0.3)',
            color: 'var(--danger)',
            padding: '12px 18px',
            borderRadius: 'var(--radius-md)',
            marginBottom: '20px',
            textAlign: 'center',
            fontWeight: '600',
            fontSize: '0.9rem'
          }}>
            En este momento estamos fuera de horario de atencion. Puedes explorar el menu o administrar la tienda, pero no se aceptan pedidos.
          </div>
        )}

        {view === 'shop' && isSyncLoaded && supabase && !isCloudSynced && <div className="glass" role="status" style={{ margin: '16px auto', padding: '14px 18px', maxWidth: '1200px' }}>La conexión está temporalmente interrumpida. Puedes explorar la carta; confirmaremos precio y disponibilidad antes de aceptar el pedido. También puedes pedir por WhatsApp.</div>}
        <React.Suspense fallback={<div className="glass route-loading" role="status" aria-live="polite"><span className="route-loading-spinner" aria-hidden="true" />Preparando tu experiencia...</div>}>
          {view === 'shop' && (
          <CustomerShop 
            flavors={flavors}
            toppings={toppings}
            bases={bases}
            packs={packs}
            popsicles={popsicles}
            onAddToCart={handleAddToCart}
            setView={setView}
            storeName={storeName}
            deliveryFee={deliveryFee}
            freeDeliveryThreshold={freeDeliveryThreshold}
            freeDeliveryEnabled={shopConfig.freeDeliveryEnabled !== false}
            deliveryCampaignText={deliveryCampaignText}
            literConfig={literConfig}
            catalogOrder={catalogOrder}
            storePhone={storePhone}
            showAlert={showAlert}
            trendsInterval={trendsInterval}
            trendsDisplayTime={trendsDisplayTime}
            tableOrdersEnabled={shopConfig.tableOrdersEnabled !== false}
            tableNumber={tableNumber}
            setTableNumber={setTableNumber}
            tableCalls={tableCalls}
            occupiedTables={shopConfig.occupiedTables || []}
            cart={cart}
            telegramToken={telegramToken}
            telegramChatId={telegramChatId}
            shopConfig={shopConfig}
            testimonials={testimonials}
            storeHeroImage={storeHeroImage}
            trackEvent={analyticsEnabled ? trackEvent : undefined}
            catalogReady={isSyncLoaded}
          />
        )}

        {view === 'customizer' && (
          <IceCreamCustomizer 
            bases={bases}
            flavors={flavors}
            toppings={toppings}
            onAddToCart={handleAddToCart}
            setView={setView}
            recommendations={recommendations}
            showAlert={showAlert}
            shopConfig={shopConfig}
          />
        )}

        {view === 'liter-customizer' && (
          <LiterCustomizer
            flavors={flavors}
            toppings={toppings}
            literConfig={literConfig}
            onAddToCart={handleAddToCart}
            setView={setView}
            showAlert={showAlert}
          />
        )}

        {view === 'cart' && (
          <Cart 
            cart={cart}
            onUpdateQuantity={handleUpdateCartQuantity}
            onRemoveFromCart={handleRemoveFromCart}
            onPlaceOrder={handlePlaceOrder}
            deliveryFee={deliveryFee}
            setView={setView}
            onAddToCart={handleAddToCart}
            flavors={flavors}
            telegramToken={telegramToken}
            telegramChatId={telegramChatId}
            freeDeliveryThreshold={freeDeliveryThreshold}
            freeDeliveryEnabled={shopConfig.freeDeliveryEnabled !== false}
            storePhone={storePhone}
            storeName={storeName}
            coupons={coupons}
            salesGoal={salesGoal}
            whatsappGreeting={whatsappGreeting}
            whatsappFooter={whatsappFooter}
            cartRecommendedPack={cartRecommendedPack}
            literConfig={literConfig}
            showAlert={showAlert}
            shopOpen={effectiveShopOpen}
            tableOrdersEnabled={shopConfig.tableOrdersEnabled !== false}
            tableNumber={tableNumber}
            occupiedTables={shopConfig.occupiedTables || []}
            shopConfig={shopConfig}
            trackEvent={analyticsEnabled ? trackEvent : undefined}
          />
        )}

        {view === 'tracker' && (
          <OrderTracker 
              orderId={activeOrderId}
              orders={orders}
              setView={setView}
              storePhone={storePhone}
              telegramToken={telegramToken}
              telegramChatId={telegramChatId}
              onClearActiveOrder={() => {
                setActiveOrderId(null);
                safeStorage.removeItem('helados_active_order_id');
              }}
          />
        )}

        {view === 'locations' && (
          <React.Suspense fallback={<div className="glass" style={{ padding: '40px', textAlign: 'center', fontFamily: 'var(--font-title)', color: 'var(--primary-color)', fontSize: '1.2rem', fontWeight: 'bold' }}>Cargando mapa de carritos...</div>}>
            <CartLocationsView
              mode="public"
              cartLocations={cartLocations}
              shopConfig={shopConfig}
              showAlert={showAlert}
              onGoToShop={() => setView('shop')}
              onRefreshCarts={handleRefreshCarts}
            />
          </React.Suspense>
        )}

        {view === 'admin' && (
          <AdminPanel 
              orders={orders}
              onPlaceOrder={handlePlaceOrder}
              onUpdateOrderStatus={handleUpdateOrderStatus}
              flavors={flavors}
              onUpdateFlavors={setFlavors}
              toppings={toppings}
              onUpdateToppings={setToppings}
              bases={bases}
              onUpdateBases={setBases}
              packs={packs}
              onUpdatePacks={setPacks}
              popsicles={popsicles}
              onUpdatePopsicles={setPopsicles}
              deliveryFee={deliveryFee}
              onChangeDeliveryFee={setDeliveryFee}
              shopOpen={effectiveShopOpen}
              shopConfig={shopConfig}
              onChangeShopConfig={setShopConfig}
              telegramToken={telegramToken}
              onChangeTelegramToken={setTelegramToken}
              telegramChatId={telegramChatId}
              onChangeTelegramChatId={setTelegramChatId}
              freeDeliveryThreshold={freeDeliveryThreshold}
              onChangeFreeDeliveryThreshold={setFreeDeliveryThreshold}
              deliveryCampaignText={deliveryCampaignText}
              onChangeDeliveryCampaignText={setDeliveryCampaignText}
              storePhone={storePhone}
              onChangeStorePhone={setStorePhone}
              staffUsers={staffUsers}
              onUpdateStaffUsers={setStaffUsers}
              soundEnabled={soundEnabled}
              onToggleSoundEnabled={() => setSoundEnabled(!soundEnabled)}
              isLoggedIn={isLoggedIn}
              setIsLoggedIn={setIsLoggedIn}
              currentUser={currentUser}
              setCurrentUser={setCurrentUser}
              onLogout={handleLogout}
              storeName={storeName}
              onChangeStoreName={setStoreName}
              storeLogo={storeLogo}
              onChangeStoreLogo={setStoreLogo}
              storeTitle={storeTitle}
              onChangeStoreTitle={setStoreTitle}
              storeFavicon={storeFavicon}
              onChangeStoreFavicon={setStoreFavicon}
              coupons={coupons}
              onUpdateCoupons={setCoupons}
              tableCalls={tableCalls}
              onUpdateTableCalls={setTableCalls}
              salesGoal={salesGoal}
              onChangeSalesGoal={setSalesGoal}
              isCloudSynced={isCloudSynced}
              whatsappGreeting={whatsappGreeting}
              onChangeWhatsappGreeting={setWhatsappGreeting}
              whatsappFooter={whatsappFooter}
              onChangeWhatsappFooter={setWhatsappFooter}
              qrCustomUrl={qrCustomUrl}
              onChangeQrCustomUrl={setQrCustomUrl}
              recommendations={recommendations}
              onUpdateRecommendations={setRecommendations}
              expenses={expenses}
              onUpdateExpenses={handleUpdateExpenses}
              cashShifts={cashShifts}
              onUpdateCashShifts={handleUpdateCashShifts}
              onUpdateOrders={handleUpdateOrders}
              cartRecommendedPack={cartRecommendedPack}
              onUpdateCartRecommendedPack={setCartRecommendedPack}
              staffPermissions={staffPermissions}
              onUpdateStaffPermissions={setStaffPermissions}
              r2Config={r2Config}
              onUpdateR2Config={setR2Config}
              literConfig={literConfig}
              onUpdateLiterConfig={setLiterConfig}
              ticketCustomMessage={ticketCustomMessage}
              onUpdateTicketCustomMessage={setTicketCustomMessage}
              catalogOrder={catalogOrder}
              onUpdateCatalogOrder={setCatalogOrder}
              storeInstagram={storeInstagram}
              onChangeStoreInstagram={setStoreInstagram}
              storeFacebook={storeFacebook}
              onChangeStoreFacebook={setStoreFacebook}
              whatsappContactMessage={whatsappContactMessage}
              onChangeWhatsappContactMessage={setWhatsappContactMessage}
              cartLocations={cartLocations}
              onUpdateCartLocations={setCartLocations}
              trendsInterval={trendsInterval}
              onChangeTrendsInterval={setTrendsInterval}
              trendsDisplayTime={trendsDisplayTime}
              tableOrdersEnabled={shopConfig.tableOrdersEnabled !== false}
              waiterTakerEnabled={shopConfig.waiterTakerEnabled !== false}
              testimonials={testimonials}
              onUpdateTestimonials={setTestimonials}
              storeHeroImage={storeHeroImage}
              onChangeStoreHeroImage={setStoreHeroImage}
              metaPixelId={metaPixelId}
              onChangeMetaPixelId={setMetaPixelId}
              googleAnalyticsId={googleAnalyticsId}
              onChangeGoogleAnalyticsId={setGoogleAnalyticsId}
              realtimeStatus={realtimeStatus}
              onRefreshCarts={handleRefreshCarts}
              isVendorApp={isVendorApp}
            />
        )}
        </React.Suspense>
      </main>

      {/* Pie de página público */}
      {!isVendorApp && (
      <footer style={{
        textAlign: 'center',
        padding: '20px 15px',
        fontSize: '0.8rem',
        color: 'var(--text-light)',
        borderTop: '1px solid var(--border-color)',
        background: 'var(--bg-secondary)',
        marginTop: 'auto',
        marginBottom: '65px' // Espacio para evitar que tape la barra inferior en móvil
      }}>
        {/* Redes Sociales del Local */}
        <div style={{ marginBottom: '15px', display: 'flex', justifyContent: 'center', gap: '20px', flexWrap: 'wrap' }}>
          <a href={storeInstagram || "https://www.instagram.com/"} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-light)', display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'none', fontWeight: '600' }} title="Instagram">
            <span aria-hidden="true">📷</span> Instagram
          </a>
          <a href={storeFacebook || "https://www.facebook.com/"} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-light)', display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'none', fontWeight: '600' }} title="Facebook">
            <span aria-hidden="true">f</span> Facebook
          </a>
          <a href={`https://wa.me/${String(storePhone || '51987654321').replace(/\D/g, '')}?text=${encodeURIComponent(whatsappContactMessage || '¡Hola! Me gustaría hacer una consulta. 🍦')}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-light)', display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'none', fontWeight: '600' }} title="WhatsApp">
            <span aria-hidden="true">💬</span> WhatsApp
          </a>
        </div>
        <div>&copy; {new Date().getFullYear()} {storeName} - Todos los derechos reservados.</div>
        <div style={{ marginTop: '5px' }}>Hecho con mucho amor por heladeros artesanales</div>
      </footer>
      )}

      {/* 📱 BARRA DE NAVEGACIÓN INFERIOR PARA MÓVIL (Bottom Tab Bar) */}
      {!isVendorApp && (
        <nav className="mobile-tab-bar glass">
          <a 
            href="#tienda"
            className={`tab-item ${view === 'shop' ? 'active' : ''}`}
            onClick={(e) => { e.preventDefault(); setView('shop'); }}
            style={{ textDecoration: 'none' }}
          >
            <span className="tab-icon">🍦</span>
            <span className="tab-label">Tienda</span>
          </a>
          <a 
            href="#personalizar"
            className={`tab-item ${view === 'customizer' ? 'active' : ''}`}
            onClick={(e) => { e.preventDefault(); setView('customizer'); }}
            style={{ textDecoration: 'none' }}
          >
            <span className="tab-icon">✦</span>
            <span className="tab-label">Crear</span>
          </a>
          <a 
            href="#carrito"
            className={`tab-item ${view === 'cart' ? 'active' : ''}`}
            onClick={(e) => { e.preventDefault(); setView('cart'); }}
            style={{ textDecoration: 'none' }}
          >
            <span className="tab-icon" style={{ position: 'relative' }}>
              🛒
              {totalCartItems > 0 && (
                <span className="tab-badge">{totalCartItems}</span>
              )}
            </span>
            <span className="tab-label">Pedido</span>
          </a>
          {locationFeatureVisible && (
          <a 
            href="#ubicacion"
            className={`tab-item ${view === 'locations' ? 'active' : ''}`}
            onClick={(e) => { e.preventDefault(); setView('locations'); }}
            style={{ textDecoration: 'none' }}
          >
            <span className="tab-icon">📍</span>
            <span className="tab-label">Mapa</span>
          </a>
          )}
          <a 
            href="#rastrear"
            className={`tab-item ${view === 'tracker' ? 'active' : ''}`}
            onClick={(e) => { e.preventDefault(); setView('tracker'); }}
            style={{ textDecoration: 'none' }}
          >
            <span className="tab-icon">🔎</span>
            <span className="tab-label">Rastrear</span>
          </a>
          {isLoggedIn && (
            <a 
              href="#admin"
              className={`tab-item ${view === 'admin' ? 'active' : ''}`}
              onClick={(e) => { e.preventDefault(); setView('admin'); }}
              style={{ textDecoration: 'none' }}
            >
              <span className="tab-icon">🛠️</span>
              <span className="tab-label">Admin</span>
            </a>
          )}
        </nav>
      )}

      {/* 💬 Burbuja de Chat Puente a Telegram */}
      {!isVendorApp && (
        <React.Suspense fallback={null}>
          <LiveChatTelegramBridge
            telegramToken={telegramToken}
            telegramChatId={telegramChatId}
            storePhone={storePhone}
            storeName={storeName}
            view={view}
            hasFloatingCart={cart.length > 0 && view !== 'cart' && view !== 'admin'}
          />
        </React.Suspense>
      )}

      {/* Floating Cart Toast/Window */}
      {!isVendorApp && cart.length > 0 && view !== 'cart' && view !== 'admin' && (
        <div className="floating-cart-toast glass animate-float-toast" style={{
          position: 'fixed',
          bottom: '80px',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '15px',
          padding: '10px 16px',
          borderRadius: '20px',
          boxShadow: '0 8px 32px rgba(255, 107, 129, 0.25)',
          border: '1px solid rgba(255, 107, 129, 0.4)',
          zIndex: 9997,
          background: 'var(--glass-bg, rgba(255, 255, 255, 0.9))',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          width: '90%',
          maxWidth: '380px'
        }}>
          <style dangerouslySetInnerHTML={{ __html: `
            @keyframes slideUpBounce {
              from { opacity: 0; transform: translate(-50%, 30px); }
              to { opacity: 1; transform: translate(-50%, 0); }
            }
            .animate-float-toast {
              animation: slideUpBounce 0.45s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            }
            .floating-cart-toast button:hover {
              transform: scale(1.05);
            }
          ` }} />
          <div className="floating-cart-summary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.2rem' }}>🛒</span>
            <span className="floating-cart-copy" style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-dark)' }}>
              <small>{totalCartItems} {totalCartItems === 1 ? 'producto' : 'productos'}</small>
              <strong>S/. {cartSubtotal.toFixed(2)}</strong>
            </span>
          </div>
          <button 
            className="btn btn-primary"
            onClick={() => setView('cart')}
            style={{ 
              padding: '6px 14px', 
              fontSize: '0.8rem', 
              borderRadius: '12px', 
              boxShadow: 'var(--shadow-sm)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'transform 0.2s ease',
              margin: 0
            }}
          >
            Ver carrito <span aria-hidden="true">→</span></button>
        </div>
      )}

      {successToast && (
        <div className="purchase-toast" role="status" aria-live="polite">
          <span className="purchase-toast-icon" aria-hidden="true">✓</span>
          <span className="purchase-toast-copy">
            <strong>{successToast.title}</strong>
            <small>{successToast.message}</small>
          </span>
          {cart.length > 0 && view !== 'cart' && view !== 'admin' && (
            <button type="button" className="purchase-toast-action" onClick={() => { setSuccessToast(null); setView('cart'); }}>
              Ver pedido
            </button>
          )}
          <button type="button" className="purchase-toast-close" aria-label="Cerrar aviso" onClick={() => setSuccessToast(null)}>×</button>
        </div>
      )}

      {/* ⚠️ Ventana de Alerta / Aviso Personalizado */}
      {customAlert && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.45)',
          backdropFilter: 'blur(5px)',
          WebkitBackdropFilter: 'blur(5px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100000,
          animation: 'fadeIn 0.25s ease-out'
        }}>
          <style dangerouslySetInnerHTML={{ __html: `
            @keyframes fadeIn {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            @keyframes scaleUp {
              from { opacity: 0; transform: scale(0.9); }
              to { opacity: 1; transform: scale(1); }
            }
            .alert-modal-content {
              animation: scaleUp 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            }
          ` }} />
          <div className="alert-modal-content" role="alertdialog" aria-modal="true" aria-labelledby="app-alert-title" aria-describedby="app-alert-message" style={{
            width: '90%',
            maxWidth: '400px',
            background: 'var(--bg-primary, #ffffff)',
            border: '1px solid var(--border-color)',
            boxShadow: '0 20px 45px rgba(0, 0, 0, 0.35)',
            borderRadius: '24px',
            padding: '24px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '15px'
          }}>
            <div style={{
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '2rem',
              backgroundColor: customAlert.type === 'error' ? 'rgba(231, 76, 60, 0.1)' : 
                               customAlert.type === 'warning' ? 'rgba(241, 196, 15, 0.1)' : 
                               customAlert.type === 'success' ? 'rgba(46, 204, 113, 0.1)' : 
                               'rgba(52, 152, 219, 0.1)',
              color: customAlert.type === 'error' ? 'var(--danger)' : 
                     customAlert.type === 'warning' ? 'var(--secondary-color)' : 
                     customAlert.type === 'success' ? 'var(--success)' : 
                     'var(--info)'
            }}>
              {customAlert.type === 'error' ? '🛑' : 
               customAlert.type === 'warning' ? '⚠️' : 
               customAlert.type === 'success' ? '🎉' : 
               'ℹ️'}
            </div>
            
            <h3 id="app-alert-title" style={{
              margin: 0,
              fontSize: '1.4rem',
              color: 'var(--text-dark)',
              fontFamily: 'var(--font-title)'
            }}>
              {customAlert.title}
            </h3>
            
            <p id="app-alert-message" style={{
              margin: 0,
              fontSize: '0.9rem',
              color: 'var(--text-light)',
              lineHeight: '1.5',
              whiteSpace: 'pre-line'
            }}>
              {customAlert.message}
            </p>

            <button
              type="button"
              className="btn btn-primary"
              autoFocus
              onClick={closeCustomAlert}
              onKeyDown={event => { if (event.key === 'Escape') closeCustomAlert(); }}
              style={{
                width: '100%',
                padding: '10px',
                fontSize: '0.95rem',
                borderRadius: '50px',
                marginTop: '5px'
              }}
            >
              {customAlert.actionLabel || 'Aceptar'}
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
