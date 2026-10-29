 
import { useState, useEffect, useRef, useCallback, useMemo, lazy, Suspense, useTransition } from 'react';
import { supabase } from '../utils/supabaseClient';
import { updateSyncedData } from '../utils/supabaseSync';

// Each module keeps its own chunk, but the loader is shared so the panel can fetch
// them ahead of time; a module that is already downloaded renders without a fallback.
const moduleLoaders = {
  settings: () => import('./admin/SettingsManager'),
  inventory: () => import('./admin/InventoryManager'),
  finance: () => import('./admin/FinanceManager'),
  cash: () => import('./admin/CashRegisterManager'),
  orders: () => import('./admin/OrderManager'),
  stats: () => import('./admin/DashboardView'),
  operations: () => import('./admin/OperationsCenter'),
  users: () => import('./admin/UserManager'),
  table_orders: () => import('./admin/TableOrderManager'),
  ordertaker: () => import('./admin/OrderTaker'),
  analytics: () => import('./admin/AnalyticsPanel'),
  crm: () => import('./admin/CustomerCRM'),
  driver_panel: () => import('./admin/DriverDeliveryPanel'),
  kds: () => import('./admin/KitchenDisplaySystem'),
  locations: () => import('./CartLocationsView'),
};
const preloadedModules = new Map();
const preloadModule = (key) => {
  const load = moduleLoaders[key];
  if (!load) return null;
  if (!preloadedModules.has(key)) preloadedModules.set(key, load().catch(error => { preloadedModules.delete(key); throw error; }));
  return preloadedModules.get(key);
};
const lazyModule = (key) => lazy(() => preloadModule(key));
// Tabs whose screen is built from more than one module.
const TAB_MODULES = { finance: ['cash', 'finance'], packs: ['inventory'], surveys: ['orders'] };

const SettingsManager = lazyModule('settings');
const InventoryManager = lazyModule('inventory');
const FinanceManager = lazyModule('finance');
const CashRegisterManager = lazyModule('cash');
const OrderManager = lazyModule('orders');
const DashboardView = lazyModule('stats');
const OperationsCenter = lazyModule('operations');
const UserManager = lazyModule('users');
const TableOrderManager = lazyModule('table_orders');
const OrderTaker = lazyModule('ordertaker');
const AnalyticsPanel = lazyModule('analytics');
const CustomerCRM = lazyModule('crm');
const DriverDeliveryPanel = lazyModule('driver_panel');
const KitchenDisplaySystem = lazyModule('kds');
const CartLocationsView = lazyModule('locations');
import './admin/AdminGrowth.css';
import { readRememberedOperator } from '../utils/rememberedOperator';
import { sanitizeHTML } from '../utils/security';
import { triggerDeviceVibration } from '../utils/appAudioNotifications';
import { orderAttention, formatWait } from '../utils/orderAttention';
import PushAlertsToggle from './admin/PushAlertsToggle';
import Icon from './Icon';

// eslint-disable-next-line no-unused-vars
const isValidEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(String(email).toLowerCase().trim());
};

const normalizeText = (value) => (typeof value === 'string' ? value.trim().toLowerCase() : '');

const normalizeRoleLabel = (role, email = '') => {
  const normalizedEmail = normalizeText(email);
  const normalizedRole = typeof role === 'string' ? role.trim() : '';
  const lowerRole = normalizedRole.toLowerCase();

  if (normalizedEmail === 'admin@donhelado.com') return 'Administrador';
  if (lowerRole.includes('admin')) return 'Administrador';
  if (lowerRole.includes('vendedor')) return 'Vendedor';
  if (lowerRole.includes('cocina')) return 'Cocina';
  return normalizedRole || 'Vendedor';
};

const isAdminUser = (user) => {
  if (!user) return false;
  const email = normalizeText(user.email);
  const role = normalizeText(user.role);
  return email === 'admin@donhelado.com' || role.includes('admin');
};

export default function AdminPanel({
  onPlaceOrder,
  orders,
  onUpdateOrderStatus,
  flavors,
  onUpdateFlavors,
  toppings,
  onUpdateToppings,
  bases,
  onUpdateBases,
  packs,
  onUpdatePacks,
  popsicles = [],
  onUpdatePopsicles,
  deliveryFee,
  onChangeDeliveryFee,
  shopOpen,
  onToggleShopOpen,
  telegramToken,
  onChangeTelegramToken,
  telegramChatId,
  onChangeTelegramChatId,
  freeDeliveryThreshold,
  onChangeFreeDeliveryThreshold,
  deliveryCampaignText,
  onChangeDeliveryCampaignText,
  storePhone,
  onChangeStorePhone,
  staffUsers,
  onUpdateStaffUsers,
  soundEnabled,
  onToggleSoundEnabled,
  isLoggedIn,
  setIsLoggedIn,
  currentUser,
  setCurrentUser,
  onLogout,
  storeName,
  onChangeStoreName,
  storeLogo,
  onChangeStoreLogo,
  storeTitle,
  onChangeStoreTitle,
  storeFavicon,
  onChangeStoreFavicon,
  coupons,
  onUpdateCoupons,
  tableCalls = [],
  onUpdateTableCalls,
  salesGoal,
  onChangeSalesGoal,
  isCloudSynced,
  syncIssue = '',
  whatsappGreeting,
  onChangeWhatsappGreeting,
  whatsappFooter,
  onChangeWhatsappFooter,
  qrCustomUrl,
  onChangeQrCustomUrl,
  recommendations,
  onUpdateRecommendations,
  expenses,
  onUpdateExpenses,
  cashShifts = [],
  onUpdateCashShifts,
  onUpdateOrders,
  cartRecommendedPack,
  onUpdateCartRecommendedPack,
  staffPermissions = {},
  onUpdateStaffPermissions,
  r2Config,
  onUpdateR2Config,
  literConfig,
  onUpdateLiterConfig,
  ticketCustomMessage,
  onUpdateTicketCustomMessage,
  catalogOrder = ['popsicles', 'classic', 'liter', 'packs'],
  onUpdateCatalogOrder,
  storeInstagram,
  onChangeStoreInstagram,
  storeFacebook,
  onChangeStoreFacebook,
  whatsappContactMessage,
  onChangeWhatsappContactMessage,
  showAlert,
  trendsInterval,
  onChangeTrendsInterval,
  trendsDisplayTime,
  onChangeTrendsDisplayTime,
  shopConfig,
  onChangeShopConfig,
  tableOrdersEnabled,
  waiterTakerEnabled,
  cartLocations,
  onUpdateCartLocations,
  testimonials,
  onUpdateTestimonials,
  storeHeroImage,
  onChangeStoreHeroImage,
  metaPixelId,
  onChangeMetaPixelId,
  googleAnalyticsId,
  onChangeGoogleAnalyticsId,
  realtimeStatus,
  onRefreshCarts,
  isVendorApp
}) {
  const canUseNotifications =
    typeof window !== 'undefined' &&
    typeof window.Notification !== 'undefined';

  const alert = (msg) => {
    if (showAlert) {
      const isError = msg.toLowerCase().includes('error') || msg.toLowerCase().includes('falló') || msg.toLowerCase().includes('no se puede') || msg.toLowerCase().includes('inválido') || msg.toLowerCase().includes('vacío') || msg.toLowerCase().includes('obligatorio') || msg.toLowerCase().includes('ya existe');
      const isSuccess = msg.toLowerCase().includes('éxito') || msg.toLowerCase().includes('guardados') || msg.toLowerCase().includes('actualizados') || msg.toLowerCase().includes('sincronizados');
      const type = isError ? 'warning' : isSuccess ? 'success' : 'info';
      const title = isError ? 'Atención' : isSuccess ? 'Operación Exitosa' : 'Aviso';
      showAlert(title, msg, type);
    } else {
      window.alert(msg);
    }
  };

  // --- Estados de UI ---
  const [activeTab, setActiveTab] = useState('operations');
  // A transition keeps the current module on screen while the next one finishes loading,
  // instead of blanking the panel with a loading message.
  const [isSwitchingTab, startTabTransition] = useTransition();
  const [requestedTab, setRequestedTab] = useState('operations');
  const switchTab = useCallback((tab) => {
    (TAB_MODULES[tab] || [tab]).forEach(preloadModule);
    setRequestedTab(tab);
    startTabTransition(() => setActiveTab(tab));
  }, []);
  // The menu answers the tap right away, even while the module is still rendering.
  const navTab = isSwitchingTab ? requestedTab : activeTab;
  const [orderTakerContext, setOrderTakerContext] = useState(null);

  // Download every module in the background once the panel is open, so switching is instant.
  useEffect(() => {
    if (!isLoggedIn) return undefined;
    let cancelled = false;
    let handle = null;
    const queue = Object.keys(moduleLoaders);
    const idle = window.requestIdleCallback || ((cb) => window.setTimeout(cb, 200));
    const cancelIdle = window.cancelIdleCallback || window.clearTimeout;
    const next = () => {
      const key = queue.shift();
      if (cancelled || !key) return;
      Promise.resolve(preloadModule(key)).catch(() => {}).finally(() => {
        if (!cancelled) handle = idle(next);
      });
    };
    handle = idle(next);
    return () => { cancelled = true; if (handle) cancelIdle(handle); };
  }, [isLoggedIn]);
  const storeServiceEnabled = tableOrdersEnabled || shopConfig?.barOrdersEnabled !== false;
  useEffect(() => {
    if (!storeServiceEnabled && (activeTab === 'table_orders' || activeTab === 'ordertaker')) setActiveTab('orders');
  }, [storeServiceEnabled, activeTab]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [activeTab]);

  // --- Estados de Autenticación y Seguridad ---
  const [rememberMe, setRememberMe] = useState(() => {
    return localStorage.getItem('friozo_operator_remember') === 'true';
  });
  const [emailInput, setEmailInput] = useState(() => readRememberedOperator(localStorage));
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState('');

  const [loginAttempts, setLoginAttempts] = useState(() => {
    return parseInt(localStorage.getItem('helados_login_attempts') || '0', 10);
  });
  const [lockoutUntil, setLockoutUntil] = useState(() => {
    return parseInt(localStorage.getItem('helados_lockout_until') || '0', 10);
  });

  useEffect(() => {
    localStorage.setItem('helados_login_attempts', loginAttempts.toString());
  }, [loginAttempts]);

  useEffect(() => {
    localStorage.setItem('helados_lockout_until', lockoutUntil.toString());
  }, [lockoutUntil]);

  // --- Bitácora de Auditoría (Simulada) ---
  const [logs, setLogs] = useState(() => {
    const saved = localStorage.getItem('helados_admin_logs');
    return saved ? JSON.parse(saved) : [
      { time: new Date().toLocaleTimeString('es-PE'), text: 'Inicio de sesión administrativa habilitado.' }
    ];
  });

  useEffect(() => {
    localStorage.setItem('helados_admin_logs', JSON.stringify(logs));
  }, [logs]);

  const addLog = (text) => {
    const newLog = {
      time: new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      text
    };
    setLogs(prev => [newLog, ...prev.slice(0, 499)]); // Mantener últimas 500 operaciones
  };

   // --- Detector de Nuevos Pedidos (Alerta Sonora) ---

  const playNewOrderSound = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc1.frequency.exponentialRampToValueAtTime(783.99, ctx.currentTime + 0.15); // G5
      
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(783.99, ctx.currentTime);
      osc2.frequency.exponentialRampToValueAtTime(1046.50, ctx.currentTime + 0.15); // C6
      
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.8);
      
      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);
      
      osc1.start();
      osc2.start();
      osc1.stop(ctx.currentTime + 0.8);
      osc2.stop(ctx.currentTime + 0.8);
    } catch {
      console.warn("Audio chime blocked by autoplay policies.");
    }
  }, [soundEnabled]);

  // Orders are matched by id: a new order can arrive while another leaves the list,
  // and customer orders arrive as "Por Corroborar", not "Pendiente".
  const seenOrderIds = useRef(null);
  useEffect(() => {
    const ids = new Set(orders.map(order => order?.id).filter(Boolean));
    if (seenOrderIds.current === null) {
      seenOrderIds.current = ids;
      return;
    }
    const arrived = orders.filter(order => order?.id && !seenOrderIds.current.has(order.id) && ['Por Corroborar', 'Pendiente'].includes(order.status));
    seenOrderIds.current = ids;
    if (!arrived.length) return;
    playNewOrderSound();
    triggerDeviceVibration([250, 120, 250]);
    arrived.forEach(order => addLog(`Nuevo pedido recibido: ${order.id} por el cliente ${order.customer?.name || 'Cliente'}.`));
    if (canUseNotifications && window.Notification.permission === 'granted') {
      const first = arrived[0];
      const toValidate = arrived.filter(order => order.status === 'Por Corroborar').length;
      try {
        new window.Notification(toValidate ? `🔔 ${toValidate === 1 ? 'Pedido por validar' : `${toValidate} pedidos por validar`} en ${storeName}` : `🍦 ¡Nuevo pedido en ${storeName}!`, {
          body: `${first.customer?.name || 'Cliente'} · S/. ${Number(first.grandTotal || 0).toFixed(2)}${arrived.length > 1 ? ` y ${arrived.length - 1} más` : ''}`,
          tag: 'friozo-new-order',
          renotify: true,
          requireInteraction: toValidate > 0,
        });
      } catch {
        // Some Android WebViews only allow notifications from a service worker.
      }
    }
  }, [orders, canUseNotifications, storeName, playNewOrderSound]);

  // --- Detector de Nuevos Llamados en Mesa (Alerta Sonora y Visual) ---
  const prevCallsCount = useRef(tableCalls.filter(c => !c.resolved).length);

  const playCallWaiterSound = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      
      const osc1 = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc1.frequency.exponentialRampToValueAtTime(880.00, ctx.currentTime + 0.15); // A5
      
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);
      
      osc1.connect(gain);
      gain.connect(ctx.destination);
      
      osc1.start();
      osc1.stop(ctx.currentTime + 0.6);
    } catch {
      console.warn("Audio chime blocked by autoplay policies.");
    }
  }, [soundEnabled]);

  useEffect(() => {
    const activeCalls = tableCalls.filter(c => !c.resolved);
    if (activeCalls.length > prevCallsCount.current) {
      playCallWaiterSound();
      const latestCall = activeCalls[activeCalls.length - 1];
      if (latestCall) {
        addLog(`🛎️ Mesa ${latestCall.table} solicita atención: ${latestCall.request}`);
        if (canUseNotifications && window.Notification.permission === 'granted') {
          new window.Notification(`🛎️ ¡Mesa ${latestCall.table} solicita atención!`, {
            body: `Solicitud: ${latestCall.request}`
          });
        }
      }
    }
    prevCallsCount.current = activeCalls.length;
  }, [tableCalls, soundEnabled, canUseNotifications, playCallWaiterSound]);

  useEffect(() => {
    if (isLoggedIn && canUseNotifications && window.Notification.permission === 'default') {
      window.Notification.requestPermission().catch(() => {});
    }
  }, [isLoggedIn, canUseNotifications]);

  // --- Pedidos que requieren atención: por validar o demorados en su estado ---
  const [attentionNow, setAttentionNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setAttentionNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);
  const attention = useMemo(() => orderAttention(orders, attentionNow, shopConfig?.attentionLimits), [orders, attentionNow, shopConfig?.attentionLimits]);
  const toValidateCount = attention.toValidate.length;
  const overdueCount = attention.overdue.length;

  // While orders wait for validation, remind every two minutes: sound, vibration and a
  // system notice that replaces the previous one instead of piling up.
  useEffect(() => {
    if (!isLoggedIn || toValidateCount === 0) return undefined;
    const remind = () => {
      playNewOrderSound();
      triggerDeviceVibration([300, 150, 300]);
      if (canUseNotifications && window.Notification.permission === 'granted') {
        try {
          new window.Notification(`🔔 ${toValidateCount === 1 ? 'Tienes 1 pedido por validar' : `Tienes ${toValidateCount} pedidos por validar`}`, {
            body: 'Revisa el pago y confírmalo para que pase a cocina.',
            tag: 'friozo-to-validate',
            renotify: true,
            requireInteraction: true,
          });
        } catch {
          // Notifications may be unavailable in this WebView; the banner stays visible.
        }
      }
    };
    const timer = window.setInterval(remind, 2 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [isLoggedIn, toValidateCount, canUseNotifications, playNewOrderSound]);

  // One notice the moment an order becomes late in its status (not on every refresh).
  const announcedLate = useRef(new Set());
  useEffect(() => {
    const lateKeys = new Set(attention.overdue.map(entry => `${entry.order.id}:${entry.status}`));
    const fresh = attention.overdue.filter(entry => !announcedLate.current.has(`${entry.order.id}:${entry.status}`));
    announcedLate.current = lateKeys;
    if (!isLoggedIn || !fresh.length) return;
    triggerDeviceVibration([200, 100, 200]);
    if (canUseNotifications && window.Notification.permission === 'granted') {
      const first = fresh[0];
      try {
        new window.Notification(`⏱️ ${fresh.length === 1 ? `Pedido ${first.order.id} demorado` : `${fresh.length} pedidos demorados`}`, {
          body: `${first.label} ${formatWait(first.minutes)} (límite ${first.limit} min).`,
          tag: 'friozo-late',
          renotify: true,
        });
      } catch {
        // The banner in the panel still shows the late orders.
      }
    }
  }, [attention.overdue, isLoggedIn, canUseNotifications]);

  // The browser tab and the installed app icon show how many orders need attention.
  useEffect(() => {
    if (!isLoggedIn) return undefined;
    const prefixPattern = /^\(\d+\) /;
    const baseTitle = document.title.replace(prefixPattern, '');
    document.title = attention.count > 0 ? `(${attention.count}) ${baseTitle}` : baseTitle;
    try {
      if (attention.count > 0) navigator.setAppBadge?.(attention.count)?.catch?.(() => {});
      else navigator.clearAppBadge?.()?.catch?.(() => {});
    } catch {
      // App badges are optional.
    }
    return () => { document.title = document.title.replace(prefixPattern, ''); };
  }, [attention.count, isLoggedIn]);

  const [ordersFocus, setOrdersFocus] = useState(null);
  const openOrdersFiltered = (filter) => {
    setOrdersFocus({ filter, key: Date.now() });
    switchTab('orders');
  };

  // --- Control de Acceso por Ventanas/Módulos ---
  const isTabAllowed = useCallback((tabId) => {
    if (!currentUser) return false;
    if (isAdminUser(currentUser)) return true;

    const userPerms =
      staffPermissions[currentUser.email] ||
      staffPermissions[normalizeText(currentUser.email)] ||
      Object.entries(staffPermissions).find(([email]) => normalizeText(email) === normalizeText(currentUser.email))?.[1];

    if (userPerms) {
      return userPerms.includes(tabId);
    }

    const role = normalizeText(currentUser.role);
    if (role.includes('vendedor')) return ['orders', 'crm', 'ordertaker', 'inventory', 'surveys', 'table_orders', 'locations'].includes(tabId);
    if (role.includes('cajero')) return ['orders', 'crm', 'ordertaker', 'finance'].includes(tabId);
    if (role.includes('cocina')) return ['orders', 'kds'].includes(tabId);
    if (role.includes('repartidor') || role.includes('delivery')) return ['driver_panel', 'orders', 'locations'].includes(tabId);
    if (role.includes('mozo') || role.includes('salon')) return ['table_orders', 'ordertaker'].includes(tabId);
    return false;
  }, [currentUser, staffPermissions]);

  useEffect(() => {
    if (currentUser && !isTabAllowed(activeTab)) {
      const role = normalizeText(currentUser.role);
      const isDriver = role.includes('repartidor') || role.includes('delivery');
      const fallbackTab = (isDriver && isTabAllowed('driver_panel'))
        ? 'driver_panel'
        : ['operations', 'driver_panel', 'orders', 'kds', 'crm', 'ordertaker', 'inventory', 'packs', 'users', 'finance', 'locations', 'settings', 'stats', 'surveys', 'table_orders']
            .find((tabId) => isTabAllowed(tabId));
      if (fallbackTab) setActiveTab(fallbackTab);
    }
  }, [currentUser, activeTab, isTabAllowed]);

  // --- Manejo del Inicio de Sesión ---
  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError('');

    const now = Date.now();
    if (lockoutUntil && now < lockoutUntil) {
      const minutesLeft = Math.ceil((lockoutUntil - now) / (60 * 1000));
      setAuthError(`Panel bloqueado por seguridad. Intentalo de nuevo en ${minutesLeft} minuto(s).`);
      return;
    }

    const userInput = sanitizeHTML(emailInput).toLowerCase().trim();
    const passwordSanitized = passwordInput.trim();

    if (!userInput || !passwordSanitized) {
      setAuthError('Por favor ingresa usuario o correo y contrasena.');
      return;
    }

    const searchEmail = userInput.includes('@') ? userInput : `${userInput}@donhelado.com`;

    const handleLoginSuccess = (userObj, isSupabase) => {
      setLoginAttempts(0);
      setLockoutUntil(0);
      if (rememberMe) {
        localStorage.setItem('friozo_saved_operator_login', JSON.stringify({ user: userInput }));
        localStorage.setItem('friozo_operator_remember', 'true');
      } else {
        localStorage.removeItem('friozo_saved_operator_login');
        localStorage.setItem('friozo_operator_remember', 'false');
      }
      sessionStorage.setItem('helados_admin_login_timestamp', Date.now().toString());
      setPasswordInput('');
      setIsLoggedIn(true);
      setCurrentUser(userObj);
      addLog(`Inicio de sesión ${isSupabase ? 'multidispositivo' : 'exitoso'} por ${userObj.name} (${userObj.role}).`);
    };

    const handleLoginFailure = (customMsg) => {
      const nextAttempts = loginAttempts + 1;
      setLoginAttempts(nextAttempts);
      if (nextAttempts >= 5) {
        const blockTime = Date.now() + 15 * 60 * 1000; // 15 minutos
        setLockoutUntil(blockTime);
        setAuthError('Has superado los 5 intentos de inicio de sesión fallidos. El panel administrativo fue bloqueado temporalmente por 15 minutos.');
        addLog(`BLOQUEO DE SEGURIDAD: 5 intentos fallidos en login para usuario: ${userInput}`);
      } else {
        setAuthError(customMsg ? `${customMsg} Intentos restantes: ${5 - nextAttempts}` : `Contraseña errada. Intentos restantes: ${5 - nextAttempts}`);
      }
    };

    // 1. Intentar iniciar sesión por medio de Supabase Auth nativo (JWT)
    if (supabase) {
      try {
        console.log('Intentando inicio de sesion nativo con Supabase Auth...');
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email: searchEmail,
          password: passwordSanitized
        });

        if (!authError && authData && authData.user) {
          const user = authData.user;
          const userObj = {
            id: user.id,
            username: user.email.split('@')[0],
            email: user.email,
            name: user.user_metadata?.name || 'Administrador Supabase',
            role: normalizeRoleLabel(user.app_metadata?.role, user.email),
            status: 'Activo',
            isSupabaseUser: true
          };

          handleLoginSuccess(userObj, true);

          if (isAdminUser(userObj)) {
            try {
              const { data: adminList } = await supabase.rpc('get_all_admins');
              if (Array.isArray(adminList) && adminList.length > 0) onUpdateStaffUsers(adminList);
            } catch (err) {
              console.warn("No se pudo refrescar lista de personal", err);
            }
          }
          return;
        }
      } catch (err) {
        console.warn("Fallo al intentar login nativo Supabase Auth:", err.message);
      }
    }

    handleLoginFailure('Credenciales incorrectas o usuario no registrado en Supabase Auth.');
    return;
  };

  const handleLogoutAction = async () => {
    addLog(`Cierre de sesión por el usuario ${currentUser?.name || ''}.`);
    await onLogout();
  };

  const handleExportSalesReport = () => {
    const todayString = new Date().toDateString();
    const ordersToday = orders.filter(o => o.status !== 'Cancelado' && new Date(o.date).toDateString() === todayString);
    const salesToday = ordersToday.reduce((sum, o) => sum + o.grandTotal, 0);
    const avgTicket = ordersToday.length > 0 ? (salesToday / ordersToday.length) : 0;
    const today = new Date().toLocaleDateString('es-PE');
    
    const textReport = `📊 REPORTE DE VENTAS DIARIO - ${storeName.toUpperCase()} (${today})\n` +
      `• Pedidos Válidos Hoy: ${ordersToday.length}\n` +
      `• Ventas de Hoy: S/. ${salesToday.toFixed(2)}\n` +
      `• Ticket Promedio Hoy: S/. ${avgTicket.toFixed(2)}\n` +
      `• Meta Diaria: S/. ${salesGoal.toFixed(2)} (${Math.round((salesToday / salesGoal) * 100)}%)\n` +
      `---------------------------\n` +
      (ordersToday.length > 0 
        ? ordersToday.map(o => `[${o.status}] ${o.id} - ${o.customer.name} - S/. ${o.grandTotal.toFixed(2)}`).join('\n')
        : 'Sin pedidos el día de hoy.'
      );
      
    navigator.clipboard.writeText(textReport)
      .then(() => alert("¡Reporte de ventas copiado al portapapeles! Listo para enviar por WhatsApp."))
      .catch(() => alert("Error al copiar reporte."));
  };

  const handleExportFinancialsCSV = () => {
    if (orders.length === 0 && expenses.length === 0) {
      alert("No hay registros financieros para exportar.");
      return;
    }
    
    let csvContent = "\uFEFF";
    csvContent += "=== REPORTE FINANCIERO Y CONTROL DE CAJA ===\n";
    csvContent += `Heladería: ${storeName}\n`;
    csvContent += `Fecha de Generación: ${new Date().toLocaleString('es-PE')}\n\n`;
    csvContent += "--- RESUMEN DE VENTAS POR DÍA ---\n";
    csvContent += "Fecha,Pedidos Válidos,Subtotal Insumos (S/.),Delivery Recaudado (S/.),Monto Total (S/.)\n";
    
    const dailyMap = {};
    orders.filter(o => o.status !== 'Cancelado').forEach(o => {
      const dateKey = new Date(o.date).toDateString();
      if (!dailyMap[dateKey]) {
        dailyMap[dateKey] = { dateStr: new Date(o.date).toLocaleDateString('es-PE'), count: 0, subtotal: 0, delivery: 0, total: 0 };
      }
      dailyMap[dateKey].count++;
      dailyMap[dateKey].subtotal += o.total;
      dailyMap[dateKey].delivery += o.deliveryFee;
      dailyMap[dateKey].total += o.grandTotal;
    });
    
    Object.values(dailyMap).forEach(day => {
      csvContent += `${day.dateStr},${day.count},${day.subtotal.toFixed(2)},${day.delivery.toFixed(2)},${day.total.toFixed(2)}\n`;
    });
    
    csvContent += "\n--- BITÁCORA DE GASTOS Y EGRESOS ---\n";
    csvContent += "Fecha Gasto,Categoría,Concepto,Monto (S/.)\n";
    
    expenses.forEach(e => {
      const expenseDateStr = new Date(e.date + 'T12:00:00').toLocaleDateString('es-PE');
      csvContent += `${expenseDateStr},"${e.category}","${e.concept.replace(/"/g, '""')}",${parseFloat(e.amount).toFixed(2)}\n`;
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `reporte_financiero_${storeName.toLowerCase().replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addLog(`Reporte financiero exportado a CSV por ${currentUser?.name}.`);
  };

  // --- Pantalla de Login ---
  if (!isLoggedIn) {
    return (
      <div className="glass admin-login-container" style={{ maxWidth: '400px', width: '90%', margin: '40px auto', padding: '25px', borderRadius: 'var(--radius-lg)' }}>
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <span style={{ fontSize: '3rem' }}>🔒</span>
          <h2 style={{ marginTop: '10px' }}>Panel de gestión</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-light)', marginTop: '4px', marginBottom: isVendorApp ? '15px' : '4px' }}>
            {supabase ? 'Ingresa para gestionar pedidos, canales de venta y conversiones.' : 'Ingresa con tu usuario o clave maestra.'}
          </p>
          {isVendorApp && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '10px' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.72rem',
                fontWeight: 'bold',
                padding: '4px 10px',
                borderRadius: '12px',
                backgroundColor: realtimeStatus === 'connected' ? 'rgba(46, 204, 113, 0.1)' :
                                 realtimeStatus === 'error' ? 'rgba(231, 76, 60, 0.1)' :
                                 'rgba(241, 196, 15, 0.1)',
                color: realtimeStatus === 'connected' ? 'var(--success)' :
                       realtimeStatus === 'error' ? 'var(--danger)' :
                       'var(--secondary-color)',
              }}>
                <span style={{
                  display: 'inline-block',
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: realtimeStatus === 'connected' ? '#2ecc71' :
                              realtimeStatus === 'error' ? '#e74c3c' :
                              '#f1c40f',
                  boxShadow: realtimeStatus === 'connected' ? '0 0 6px rgba(46, 204, 113, 0.6)' :
                             realtimeStatus === 'error' ? '0 0 6px rgba(231, 76, 60, 0.6)' :
                             '0 0 6px rgba(241, 196, 15, 0.6)'
                }} />
                {realtimeStatus === 'connected' ? 'Tiempo Real En Línea' :
                 realtimeStatus === 'error' ? 'Tiempo Real Desconectado' :
                 'Conectando Tiempo Real...'}
              </div>
            </div>
          )}
        </div>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div className="form-group">
            <label>Nombre de Usuario o Correo</label>
            <input aria-label="Nombre de Usuario o Correo"
              type="text"
              className="form-control"
              placeholder="admin o admin@donhelado.com"
              autoComplete="username"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>Contraseña de Acceso</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                className="form-control"
                placeholder="Contraseña"
                autoComplete="current-password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  padding: '4px'
                }}
                title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
              >
                {showPassword ? '👁️' : '🔒'}
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
            <input
              type="checkbox"
              id="rememberMe"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
            />
            <label htmlFor="rememberMe" style={{ cursor: 'pointer', margin: 0 }}>
              Recordar solo mi usuario en este equipo
            </label>
          </div>

          {authError && (
            <p style={{ color: 'var(--danger)', fontSize: '0.8rem', fontWeight: 600 }}>{authError}</p>
          )}

          <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '12px' }}>
            Ingresar al Panel
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="admin-layout">
      {/* Sidebar */}
      <div className="glass admin-sidebar">
        <div className="admin-sidebar-head">
        <h4 style={{ margin: 0, color: 'var(--primary-color)', fontSize: '1.1rem' }}>{storeName}</h4>
        <div className="admin-sync-badge" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '0.68rem',
          fontWeight: 'bold',
          padding: '4px 10px',
          borderRadius: '12px',
          backgroundColor: isCloudSynced ? 'rgba(46, 204, 113, 0.1)' : 'rgba(241, 196, 15, 0.1)',
          color: isCloudSynced ? 'var(--success)' : 'var(--secondary-color)',
          width: 'fit-content'
        }}>
          {isCloudSynced && (
            <span 
              style={{
                display: 'inline-block',
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: realtimeStatus === 'connected' ? '#2ecc71' :
                            realtimeStatus === 'error' ? '#e74c3c' :
                            '#f1c40f'
              }}
              title={realtimeStatus === 'connected' ? 'Tiempo Real: Conectado' :
                     realtimeStatus === 'error' ? 'Tiempo Real: Desconectado' :
                     'Tiempo Real: Conectando...'}
            />
          )}
          <span>{isCloudSynced ? (syncIssue ? 'Conectado con avisos' : 'Sincronizado (Supabase)') : 'Sin conexión · reintentando'}</span>
        </div>
        </div>
        {syncIssue && <p className="admin-sync-issue" role="status">⚠️ {syncIssue}</p>}


        {currentUser && (
          <div className="admin-user-card" style={{
            background: 'var(--bg-secondary, rgba(0, 0, 0, 0.02))',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            padding: '8px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--primary-color) 0%, var(--secondary-color) 100%)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 'bold',
              fontSize: '0.85rem'
            }}>
              {(currentUser.name || currentUser.username || 'U').charAt(0).toUpperCase()}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-dark)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {currentUser.name || currentUser.username}
              </span>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-light)', fontWeight: 600 }}>
                {currentUser.role || 'Operador'}
              </span>
            </div>
          </div>
        )}
        <PushAlertsToggle />
        <nav className="sidebar-menu" aria-label="Secciones del panel">
          {isAdminUser(currentUser) && <button aria-current={navTab === 'operations' ? 'page' : undefined} className={`sidebar-btn ${navTab === 'operations' ? 'active' : ''}`} onClick={() => switchTab('operations')}><Icon name="pulse" />Centro de operaciones</button>}
          {isTabAllowed('driver_panel') && (
            <button aria-current={navTab === 'driver_panel' ? 'page' : undefined} className={`sidebar-btn ${navTab === 'driver_panel' ? 'active' : ''}`} onClick={() => switchTab('driver_panel')}>
              <Icon name="scooter" />Mis Repartos ({orders.filter(o => {
                if (!o || o.status === 'Cancelado' || o.status === 'Entregado') return false;
                const d = o.assignedDriver;
                if (!d) return false;
                if (isAdminUser(currentUser)) return true;
                return String(d.email || '').toLowerCase().trim() === String(currentUser?.email || '').toLowerCase().trim() ||
                       String(d.id || '').trim() === String(currentUser?.id || '').trim();
              }).length})
            </button>
          )}
          {isTabAllowed('kds') && (
            <button aria-current={navTab === 'kds' ? 'page' : undefined} className={`sidebar-btn ${navTab === 'kds' ? 'active' : ''}`} onClick={() => switchTab('kds')}>
              <Icon name="chef" />KDS Cocina ({orders.filter(o => o.status === 'Pendiente' || o.status === 'Preparando').length})
            </button>
          )}
          {isTabAllowed('orders') && (
            <>
              <button aria-current={navTab === 'orders' ? 'page' : undefined} className={`sidebar-btn ${navTab === 'orders' ? 'active' : ''}`} onClick={() => switchTab('orders')}>
                <Icon name="box" />Pedidos ({orders.filter(o => o.status === 'Pendiente' || o.status === 'Por Corroborar').length}){toValidateCount > 0 && <span className="sidebar-alert" aria-label={`${toValidateCount} por validar`}>{toValidateCount}</span>}
              </button>
              {isTabAllowed('crm') && (
                <button aria-current={navTab === 'crm' ? 'page' : undefined} className={`sidebar-btn ${navTab === 'crm' ? 'active' : ''}`} onClick={() => switchTab('crm')}>
                  <Icon name="contacts" />CRM Clientes
                </button>
              )}
            </>
          )}
          {storeServiceEnabled && isTabAllowed('ordertaker') && (
            <button aria-current={navTab === 'ordertaker' ? 'page' : undefined} className={`sidebar-btn ${navTab === 'ordertaker' ? 'active' : ''}`} onClick={() => { setOrderTakerContext(null); switchTab('ordertaker'); }}>
              <Icon name="receipt" />Tomador de Pedidos
            </button>
          )}
          {isTabAllowed('inventory') && (
            <button aria-current={navTab === 'inventory' ? 'page' : undefined} className={`sidebar-btn ${navTab === 'inventory' ? 'active' : ''}`} onClick={() => switchTab('inventory')}>
              <Icon name="icecream" />Carta Helada
            </button>
          )}
          {isTabAllowed('packs') && (
            <button aria-current={navTab === 'packs' ? 'page' : undefined} className={`sidebar-btn ${navTab === 'packs' ? 'active' : ''}`} onClick={() => switchTab('packs')}>
              <Icon name="gift" />Packs Combos
            </button>
          )}
          {currentUser && isAdminUser(currentUser) && isTabAllowed('users') && (
            <button aria-current={navTab === 'users' ? 'page' : undefined} className={`sidebar-btn ${navTab === 'users' ? 'active' : ''}`} onClick={() => switchTab('users')}>
              <Icon name="users" />Personal / Staff
            </button>
          )}
          {isTabAllowed('finance') && (
            <button aria-current={navTab === 'finance' ? 'page' : undefined} className={`sidebar-btn ${navTab === 'finance' ? 'active' : ''}`} onClick={() => switchTab('finance')}>
              <Icon name="wallet" />Caja y Finanzas
            </button>
          )}
          {isTabAllowed('stats') && (
            <button aria-current={navTab === 'stats' ? 'page' : undefined} className={`sidebar-btn ${navTab === 'stats' ? 'active' : ''}`} onClick={() => switchTab('stats')}>
              <Icon name="trend" />Meta e Ingresos
            </button>
          )}
          {isTabAllowed('surveys') && (
            <button aria-current={navTab === 'surveys' ? 'page' : undefined} className={`sidebar-btn ${navTab === 'surveys' ? 'active' : ''}`} onClick={() => switchTab('surveys')}>
              <Icon name="star" />Encuestas ({orders.filter(o => o.survey).length})
            </button>
          )}
          {storeServiceEnabled && isTabAllowed('table_orders') && (
            <button aria-current={navTab === 'table_orders' ? 'page' : undefined} className={`sidebar-btn ${navTab === 'table_orders' ? 'active' : ''}`} onClick={() => switchTab('table_orders')}>
              <Icon name="table" />Pedidos en Mesa
            </button>
          )}
          {isAdminUser(currentUser) && (
            <button aria-current={navTab === 'analytics' ? 'page' : undefined} className={`sidebar-btn ${navTab === 'analytics' ? 'active' : ''}`} onClick={() => switchTab('analytics')}>
              <Icon name="funnel" />Embudo de ventas
            </button>
          )}
          {isTabAllowed('settings') && (
            <button aria-current={navTab === 'settings' ? 'page' : undefined} className={`sidebar-btn ${navTab === 'settings' ? 'active' : ''}`} onClick={() => switchTab('settings')}>
              <Icon name="gear" />Todos los ajustes
            </button>
          )}
          {isTabAllowed('locations') && (
            <button aria-current={navTab === 'locations' ? 'page' : undefined} className={`sidebar-btn ${navTab === 'locations' ? 'active' : ''}`} onClick={() => switchTab('locations')}>
              <Icon name="pin" />Carritos / Ubicación
            </button>
          )}
        </nav>
      </div>

      {/* Contenido de pestaña activa */}
      <div className={`admin-content${isSwitchingTab ? ' is-switching' : ''}`} aria-busy={isSwitchingTab}>
        {(toValidateCount > 0 || overdueCount > 0) && isTabAllowed('orders') && (
          <section className="attention-bar" role="status" aria-live="polite" aria-label="Pedidos que requieren atención">
            {toValidateCount > 0 && (
              <div className="attention-item attention-validate">
                <span className="attention-dot" aria-hidden="true" />
                <span className="attention-copy">
                  <strong>{toValidateCount === 1 ? '1 pedido por validar' : `${toValidateCount} pedidos por validar`}</strong>
                  <small>El más antiguo llegó {formatWait(attention.oldestToValidateMinutes)}</small>
                  {(() => {
                    const oldest = attention.toValidate[0]?.order;
                    if (!oldest) return null;
                    const code = String(oldest.customer?.operationCode || '').trim();
                    return (
                      <span className="attention-detail">
                        {oldest.customer?.name || 'Cliente'} · S/. {Number(oldest.grandTotal || 0).toFixed(2)} · {oldest.customer?.paymentMethod || 'Pago por definir'}
                        {code && <> · Operación <b>{code}</b></>}
                      </span>
                    );
                  })()}
                </span>
                <button type="button" className="attention-action" onClick={() => openOrdersFiltered('Por Corroborar')}>Validar ahora</button>
              </div>
            )}
            {overdueCount > 0 && (
              <div className="attention-item attention-late">
                <span className="attention-dot" aria-hidden="true" />
                <span className="attention-copy">
                  <strong>{overdueCount === 1 ? '1 pedido demorado' : `${overdueCount} pedidos demorados`}</strong>
                  <small>{attention.overdue.slice(0, 2).map(entry => `${entry.order.id} · ${entry.label} ${formatWait(entry.minutes)}`).join(' — ')}</small>
                </span>
                <button type="button" className="attention-action" onClick={() => openOrdersFiltered(attention.overdue[0].status)}>Ver</button>
              </div>
            )}
          </section>
        )}
          <Suspense fallback={<div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-light)' }}>Cargando módulo...</div>}>
          {activeTab === 'operations' && isAdminUser(currentUser) && <OperationsCenter orders={orders} salesGoal={salesGoal} shopOpen={shopOpen} onNavigate={switchTab} onUpdateOrderStatus={onUpdateOrderStatus} groups={[
          {key:'flavors',name:'Sabores',items:flavors,update:onUpdateFlavors},
          {key:'bases',name:'Envases',items:bases,update:onUpdateBases},
          {key:'toppings',name:'Toppings y salsas',items:toppings,update:onUpdateToppings},
          {key:'popsicles',name:'Paletas',items:popsicles,update:onUpdatePopsicles},
          {key:'packs',name:'Packs',items:packs,update:onUpdatePacks}
        ]} />}
        {storeServiceEnabled && activeTab === 'ordertaker' && <OrderTaker catalog={{ bases, flavors, toppings, packs, popsicles, literConfig }} onPlaceOrder={onPlaceOrder} showAlert={showAlert} shopConfig={shopConfig} orders={orders} orderContext={orderTakerContext} onBack={() => { setOrderTakerContext(null); setActiveTab('table_orders'); }} onCreated={() => { if (orderTakerContext) { setOrderTakerContext(null); setActiveTab('table_orders'); } }} />}
        {activeTab === 'analytics' && isAdminUser(currentUser) && <AnalyticsPanel googleAnalyticsId={googleAnalyticsId} />}
        {activeTab === 'crm' && (
          <CustomerCRM
            orders={orders}
            storeName={storeName}
            showAlert={showAlert}
            coupons={coupons}
            onUpdateCoupons={onUpdateCoupons}
            shopConfig={shopConfig}
            onChangeShopConfig={onChangeShopConfig}
            onNavigate={switchTab}
            onPlaceOrder={onPlaceOrder}
          />
        )}

        {activeTab === 'driver_panel' && isTabAllowed('driver_panel') && (
          <DriverDeliveryPanel
            orders={orders}
            onUpdateOrderStatus={onUpdateOrderStatus}
            currentUser={currentUser}
            storeName={storeName}
            shopConfig={shopConfig}
            showAlert={showAlert}
            staffUsers={staffUsers}
          />
        )}

        {activeTab === 'kds' && isTabAllowed('kds') && (
          <KitchenDisplaySystem
            orders={orders}
            onUpdateOrderStatus={onUpdateOrderStatus}
            shopConfig={shopConfig}
            storeName={storeName}
            ticketCustomMessage={ticketCustomMessage}
            addLog={addLog}
            currentUser={currentUser}
            showAlert={showAlert}
          />
        )}

        {(activeTab === 'orders' || activeTab === 'surveys') && (
          <OrderManager
            focus={ordersFocus}
            orders={orders}
            onUpdateOrders={onUpdateOrders}
            onUpdateOrderStatus={onUpdateOrderStatus}
            flavors={flavors}
            toppings={toppings}
            bases={bases}
            packs={packs}
            storeName={storeName}
            ticketCustomMessage={ticketCustomMessage}
            addLog={addLog}
            currentUser={currentUser}
            showAlert={showAlert}
            shopConfig={shopConfig}
            activeSubTab={activeTab === 'orders' ? 'orders' : 'surveys'}
            staffUsers={staffUsers}
            onUpdateStaffUsers={onUpdateStaffUsers}
          />
        )}
        
        {(activeTab === 'inventory' || activeTab === 'packs') && (
          <InventoryManager
            flavors={flavors}
            onUpdateFlavors={onUpdateFlavors}
            toppings={toppings}
            onUpdateToppings={onUpdateToppings}
            bases={bases}
            onUpdateBases={onUpdateBases}
            recommendations={recommendations}
            onUpdateRecommendations={onUpdateRecommendations}
            packs={packs}
            onUpdatePacks={onUpdatePacks}
            popsicles={popsicles}
            onUpdatePopsicles={onUpdatePopsicles}
            r2Config={r2Config}
            addLog={addLog}
            currentUser={currentUser}
            showAlert={showAlert}
            subTab={activeTab === 'inventory' ? 'flavors' : 'packs'}
          />
        )}

        {activeTab === 'users' && (
          <UserManager
            currentUser={currentUser}
            setCurrentUser={setCurrentUser}
            staffUsers={staffUsers}
            onUpdateStaffUsers={onUpdateStaffUsers}
            staffPermissions={staffPermissions}
            onUpdateStaffPermissions={onUpdateStaffPermissions}
            addLog={addLog}
            showAlert={showAlert}
          />
        )}

        {activeTab === 'finance' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {shopConfig?.cashRegisterEnabled !== false && (
              <CashRegisterManager
                orders={orders}
                shifts={cashShifts}
                onUpdateShifts={onUpdateCashShifts}
                currentUser={currentUser}
                storeName={storeName}
                printEnabled={shopConfig?.escposPrintEnabled !== false}
                addLog={addLog}
                showAlert={showAlert}
              />
            )}
            <FinanceManager
              orders={orders}
              onUpdateOrders={onUpdateOrders}
              expenses={expenses}
              onUpdateExpenses={onUpdateExpenses}
              packs={packs}
              addLog={addLog}
              currentUser={currentUser}
              showAlert={showAlert}
              shopConfig={shopConfig}
            />
          </div>
        )}

        {activeTab === 'locations' && (
          <CartLocationsView
            mode="admin"
            currentUser={currentUser}
            cartLocations={cartLocations}
            onUpdateCartLocations={onUpdateCartLocations}
            shopConfig={shopConfig}
            staffPermissions={staffPermissions}
            showAlert={showAlert}
            onRefreshCarts={onRefreshCarts}
          />
        )}

        {storeServiceEnabled && activeTab === 'table_orders' && (
          <TableOrderManager
            orders={orders}
            onUpdateOrders={onUpdateOrders}
            flavors={flavors}
            toppings={toppings}
            bases={bases}
            packs={packs}
            literConfig={literConfig}
            deliveryFee={deliveryFee}
            storeName={storeName}
            waiterTakerEnabled={waiterTakerEnabled}
            addLog={addLog}
            currentUser={currentUser}
            showAlert={showAlert}
            tableCalls={tableCalls}
            onUpdateTableCalls={onUpdateTableCalls}
            shopConfig={shopConfig}
            onOpenOrderTaker={(context) => { setOrderTakerContext({ ...context, key: Date.now() }); switchTab('ordertaker'); }}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsManager
            storeName={storeName}
            onChangeStoreName={onChangeStoreName}
            storeLogo={storeLogo}
            onChangeStoreLogo={onChangeStoreLogo}
            storeTitle={storeTitle}
            onChangeStoreTitle={onChangeStoreTitle}
            storeFavicon={storeFavicon}
            onChangeStoreFavicon={onChangeStoreFavicon}
            storePhone={storePhone}
            onChangeStorePhone={onChangeStorePhone}
            salesGoal={salesGoal}
            onChangeSalesGoal={onChangeSalesGoal}
            freeDeliveryThreshold={freeDeliveryThreshold}
            onChangeFreeDeliveryThreshold={onChangeFreeDeliveryThreshold}
            deliveryCampaignText={deliveryCampaignText}
            onChangeDeliveryCampaignText={onChangeDeliveryCampaignText}
            telegramToken={telegramToken}
            onChangeTelegramToken={onChangeTelegramToken}
            telegramChatId={telegramChatId}
            onChangeTelegramChatId={onChangeTelegramChatId}
            soundEnabled={soundEnabled}
            onToggleSoundEnabled={onToggleSoundEnabled}
            shopOpen={shopOpen}
            onToggleShopOpen={onToggleShopOpen}
            isCloudSynced={isCloudSynced}
            whatsappGreeting={whatsappGreeting}
            onChangeWhatsappGreeting={onChangeWhatsappGreeting}
            whatsappFooter={whatsappFooter}
            onChangeWhatsappFooter={onChangeWhatsappFooter}
            qrCustomUrl={qrCustomUrl}
            onChangeQrCustomUrl={onChangeQrCustomUrl}
            ticketCustomMessage={ticketCustomMessage}
            onUpdateTicketCustomMessage={onUpdateTicketCustomMessage}
            catalogOrder={catalogOrder}
            onUpdateCatalogOrder={onUpdateCatalogOrder}
            storeInstagram={storeInstagram}
            onChangeStoreInstagram={onChangeStoreInstagram}
            storeFacebook={storeFacebook}
            onChangeStoreFacebook={onChangeStoreFacebook}
            whatsappContactMessage={whatsappContactMessage}
            onChangeWhatsappContactMessage={onChangeWhatsappContactMessage}
            trendsInterval={trendsInterval}
            onChangeTrendsInterval={onChangeTrendsInterval}
            trendsDisplayTime={trendsDisplayTime}
            onChangeTrendsDisplayTime={onChangeTrendsDisplayTime}
            shopConfig={shopConfig}
            onChangeShopConfig={onChangeShopConfig}
            r2Config={r2Config}
            onUpdateR2Config={onUpdateR2Config}
            literConfig={literConfig}
            onUpdateLiterConfig={onUpdateLiterConfig}
            coupons={coupons}
            onUpdateCoupons={onUpdateCoupons}
            logs={logs}
            addLog={addLog}
            currentUser={currentUser}
            onLogout={handleLogoutAction}
            flavors={flavors}
            onUpdateFlavors={onUpdateFlavors}
            toppings={toppings}
            onUpdateToppings={onUpdateToppings}
            bases={bases}
            onUpdateBases={onUpdateBases}
            packs={packs}
            onUpdatePacks={onUpdatePacks}
            orders={orders}
            onUpdateOrders={onUpdateOrders}
            expenses={expenses}
            onUpdateExpenses={onUpdateExpenses}
            cashShifts={cashShifts}
            onUpdateCashShifts={onUpdateCashShifts}
            deliveryFee={deliveryFee}
            onChangeDeliveryFee={onChangeDeliveryFee}
            recommendations={recommendations}
            onUpdateRecommendations={onUpdateRecommendations}
            cartRecommendedPack={cartRecommendedPack}
            onUpdateCartRecommendedPack={onUpdateCartRecommendedPack}
            staffPermissions={staffPermissions}
            onUpdateStaffPermissions={onUpdateStaffPermissions}
            cartLocations={cartLocations}
            onUpdateCartLocations={onUpdateCartLocations}
            testimonials={testimonials}
            onUpdateTestimonials={onUpdateTestimonials}
            storeHeroImage={storeHeroImage}
            onChangeStoreHeroImage={onChangeStoreHeroImage}
            metaPixelId={metaPixelId}
            onChangeMetaPixelId={onChangeMetaPixelId}
            googleAnalyticsId={googleAnalyticsId}
            onChangeGoogleAnalyticsId={onChangeGoogleAnalyticsId}
            onOpenAnalytics={() => switchTab('analytics')}
          />
        )}

        {activeTab === 'stats' && (
          <DashboardView
            orders={orders}
            salesGoal={salesGoal}
            handleExportFinancialsCSV={handleExportFinancialsCSV}
            handleExportSalesReport={handleExportSalesReport}
            currentUser={currentUser}
            flavors={flavors}
            toppings={toppings}
            bases={bases}
            packs={packs}
          />
        )}
          </Suspense>
      </div>

      {/* Panel Flotante Persistente para Llamados de Atención en Mesa */}
      {(tableOrdersEnabled || isAdminUser(currentUser)) && tableCalls.filter(c => !c.resolved).length > 0 && (
        <div style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          zIndex: 999999,
          maxWidth: '380px',
          width: 'calc(100% - 40px)',
          background: 'var(--glass-bg, rgba(255, 255, 255, 0.95))',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          border: '2px solid var(--danger)',
          borderRadius: '16px',
          boxShadow: '0 12px 36px rgba(231, 76, 60, 0.35)',
          padding: '16px',
          animation: 'slideUpAdmin 0.4s ease',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}>
          <style dangerouslySetInnerHTML={{ __html: `
            @keyframes slideUpAdmin {
              from { transform: translateY(50px); opacity: 0; }
              to { transform: translateY(0); opacity: 1; }
            }
          ` }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
            <span style={{ fontWeight: 'bold', color: 'var(--danger)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              🛎️ LLAMADOS DE MESA ACTIVOS ({tableCalls.filter(c => !c.resolved).length})
            </span>
            <span style={{ background: 'var(--danger)', color: 'var(--bg-secondary)', fontSize: '0.65rem', fontWeight: 'bold', padding: '2px 8px', borderRadius: '12px' }}>PENDIENTE</span>
          </div>
          <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {tableCalls.filter(c => !c.resolved).map((call, idx) => (
              <div key={idx} style={{
                background: 'var(--bg-secondary)',
                padding: '8px 10px',
                borderRadius: '8px',
                fontSize: '0.72rem',
                border: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '10px'
              }}>
                <div style={{ textAlign: 'left', flex: 1 }}>
                  <strong style={{ color: 'var(--primary-color)' }}>Mesa {call.table}</strong>
                  <div style={{ fontWeight: '600', marginTop: '2px', wordBreak: 'break-word', color: 'var(--text-dark)' }}>{call.request}</div>
                  <small style={{ color: 'var(--text-light)', display: 'block', marginTop: '2px', fontSize: '0.65rem' }}>
                    Hace: {new Date(call.timestamp).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
                  </small>
                </div>
                <button
                  onClick={async () => {
                    const updatedCall = { ...call, resolved: true };
                    const success = await updateSyncedData(`order_call_Mesa_${call.table}`, updatedCall);
                    if (success) {
                      addLog(`Llamado de Mesa ${call.table} ("${call.request}") marcado como atendido.`);
                    }
                  }}
                  className="btn btn-primary"
                  style={{
                    padding: '4px 8px',
                    fontSize: '0.7rem',
                    background: 'var(--success)',
                    borderColor: 'var(--success)',
                    borderRadius: '6px',
                    color: 'white',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    margin: 0
                  }}
                >
                  Atendido
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
