 
import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { supabase } from '../utils/supabaseClient';
import { updateSyncedData } from '../utils/supabaseSync';
const SettingsManager = lazy(() => import('./admin/SettingsManager'));
const InventoryManager = lazy(() => import('./admin/InventoryManager'));
const FinanceManager = lazy(() => import('./admin/FinanceManager'));
const CashRegisterManager = lazy(() => import('./admin/CashRegisterManager'));
const OrderManager = lazy(() => import('./admin/OrderManager'));
const DashboardView = lazy(() => import('./admin/DashboardView'));
const OperationsCenter = lazy(() => import('./admin/OperationsCenter'));
const UserManager = lazy(() => import('./admin/UserManager'));
const TableOrderManager = lazy(() => import('./admin/TableOrderManager'));
const OrderTaker = lazy(() => import('./admin/OrderTaker'));
const AnalyticsPanel = lazy(() => import('./admin/AnalyticsPanel'));
const CustomerCRM = lazy(() => import('./admin/CustomerCRM'));
const DriverDeliveryPanel = lazy(() => import('./admin/DriverDeliveryPanel'));
const KitchenDisplaySystem = lazy(() => import('./admin/KitchenDisplaySystem'));
import CartLocationsView from './CartLocationsView';
import './admin/AdminGrowth.css';
import { sanitizeHTML } from '../utils/security';

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
      const isError = msg.toLowerCase().includes('error') || msg.toLowerCase().includes('fallÃ³') || msg.toLowerCase().includes('no se puede') || msg.toLowerCase().includes('invÃ¡lido') || msg.toLowerCase().includes('vacÃ­o') || msg.toLowerCase().includes('obligatorio') || msg.toLowerCase().includes('ya existe');
      const isSuccess = msg.toLowerCase().includes('Ã©xito') || msg.toLowerCase().includes('guardados') || msg.toLowerCase().includes('actualizados') || msg.toLowerCase().includes('sincronizados');
      const type = isError ? 'warning' : isSuccess ? 'success' : 'info';
      const title = isError ? 'AtenciÃ³n' : isSuccess ? 'OperaciÃ³n Exitosa' : 'Aviso';
      showAlert(title, msg, type);
    } else {
      window.alert(msg);
    }
  };

  // --- Estados de UI ---
  const [activeTab, setActiveTab] = useState('operations');
  const [orderTakerContext, setOrderTakerContext] = useState(null);
  const storeServiceEnabled = tableOrdersEnabled || shopConfig?.barOrdersEnabled !== false;
  useEffect(() => {
    if (!storeServiceEnabled && (activeTab === 'table_orders' || activeTab === 'ordertaker')) setActiveTab('orders');
  }, [storeServiceEnabled, activeTab]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [activeTab]);

  // --- Estados de AutenticaciÃ³n y Seguridad ---
  const [rememberMe, setRememberMe] = useState(() => {
    return localStorage.getItem('friozo_operator_remember') === 'true';
  });
  const [emailInput, setEmailInput] = useState(() => {
    try {
      const saved = localStorage.getItem('friozo_saved_operator_login');
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.user || '';
      }
    } catch {
      /* ignore invalid saved login */
    }
    return '';
  });
  const [passwordInput, setPasswordInput] = useState(() => {
    try {
      const saved = localStorage.getItem('friozo_saved_operator_login');
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.pass || '';
      }
    } catch {
      /* ignore invalid saved password */
    }
    return '';
  });
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

  // --- BitÃ¡cora de AuditorÃ­a (Simulada) ---
  const [logs, setLogs] = useState(() => {
    const saved = localStorage.getItem('helados_admin_logs');
    return saved ? JSON.parse(saved) : [
      { time: new Date().toLocaleTimeString('es-PE'), text: 'Inicio de sesiÃ³n administrativa habilitado.' }
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
    setLogs(prev => [newLog, ...prev.slice(0, 499)]); // Mantener Ãºltimas 500 operaciones
  };

   // --- Detector de Nuevos Pedidos (Alerta Sonora) ---
  const prevOrdersCount = useRef(orders.length);

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

  useEffect(() => {
    if (orders.length > prevOrdersCount.current) {
      const latestOrder = orders[0];
      if (latestOrder && latestOrder.status === 'Pendiente') {
        playNewOrderSound();
        addLog(`Nuevo pedido recibido: ${latestOrder.id} por el cliente ${latestOrder.customer.name}.`);
        if (canUseNotifications && window.Notification.permission === 'granted') {
          new window.Notification(`🍦 ¡Nuevo Pedido en ${storeName}!`, {
            body: `Cliente: ${latestOrder.customer.name} - Total: S/. ${latestOrder.grandTotal.toFixed(2)}`
          });
        }
      }
    }
    prevOrdersCount.current = orders.length;
  }, [orders, soundEnabled, canUseNotifications, storeName, playNewOrderSound]);

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

  // --- Manejo del Inicio de SesiÃ³n ---
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
        localStorage.setItem('friozo_saved_operator_login', JSON.stringify({ user: userInput, pass: passwordSanitized }));
        localStorage.setItem('friozo_operator_remember', 'true');
      } else {
        localStorage.removeItem('friozo_saved_operator_login');
        localStorage.setItem('friozo_operator_remember', 'false');
      }
      sessionStorage.setItem('helados_admin_login_timestamp', Date.now().toString());
      setIsLoggedIn(true);
      setCurrentUser(userObj);
      addLog(`Inicio de sesion ${isSupabase ? 'multidispositivo' : 'exitoso'} por ${userObj.name} (${userObj.role}).`);
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

    // 1. Intentar iniciar sesiÃ³n por medio de Supabase Auth nativo (JWT)
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
    addLog(`Cierre de sesion por el usuario ${currentUser?.name || ''}.`);
    await onLogout();
  };

  const handleExportSalesReport = () => {
    const todayString = new Date().toDateString();
    const ordersToday = orders.filter(o => o.status !== 'Cancelado' && new Date(o.date).toDateString() === todayString);
    const salesToday = ordersToday.reduce((sum, o) => sum + o.grandTotal, 0);
    const avgTicket = ordersToday.length > 0 ? (salesToday / ordersToday.length) : 0;
    const today = new Date().toLocaleDateString('es-PE');
    
    const textReport = `ðŸ“Š REPORTE DE VENTAS DIARIO - ${storeName.toUpperCase()} (${today})\n` +
      `â€¢ Pedidos VÃ¡lidos Hoy: ${ordersToday.length}\n` +
      `â€¢ Ventas de Hoy: S/. ${salesToday.toFixed(2)}\n` +
      `â€¢ Ticket Promedio Hoy: S/. ${avgTicket.toFixed(2)}\n` +
      `â€¢ Meta Diaria: S/. ${salesGoal.toFixed(2)} (${Math.round((salesToday / salesGoal) * 100)}%)\n` +
      `---------------------------\n` +
      (ordersToday.length > 0 
        ? ordersToday.map(o => `[${o.status}] ${o.id} - ${o.customer.name} - S/. ${o.grandTotal.toFixed(2)}`).join('\n')
        : 'Sin pedidos el dÃ­a de hoy.'
      );
      
    navigator.clipboard.writeText(textReport)
      .then(() => alert("Â¡Reporte de ventas copiado al portapapeles! Listo para enviar por WhatsApp."))
      .catch(() => alert("Error al copiar reporte."));
  };

  const handleExportFinancialsCSV = () => {
    if (orders.length === 0 && expenses.length === 0) {
      alert("No hay registros financieros para exportar.");
      return;
    }
    
    let csvContent = "\uFEFF";
    csvContent += "=== REPORTE FINANCIERO Y CONTROL DE CAJA ===\n";
    csvContent += `HeladerÃ­a: ${storeName}\n`;
    csvContent += `Fecha de GeneraciÃ³n: ${new Date().toLocaleString('es-PE')}\n\n`;
    csvContent += "--- RESUMEN DE VENTAS POR DÃA ---\n";
    csvContent += "Fecha,Pedidos VÃ¡lidos,Subtotal Insumos (S/.),Delivery Recaudado (S/.),Monto Total (S/.)\n";
    
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
    
    csvContent += "\n--- BITÃCORA DE GASTOS Y EGRESOS ---\n";
    csvContent += "Fecha Gasto,CategorÃ­a,Concepto,Monto (S/.)\n";
    
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
            <input
              type="text"
              className="form-control"
              placeholder="admin o admin@donhelado.com"
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
              Recordar credenciales en este equipo
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
        <h4 style={{ marginBottom: '5px', color: 'var(--primary-color)', fontSize: '1.1rem' }}>{storeName}</h4>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '6px', 
          fontSize: '0.68rem', 
          fontWeight: 'bold',
          marginBottom: '20px',
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
                            '#f1c40f',
                boxShadow: realtimeStatus === 'connected' ? '0 0 6px rgba(46, 204, 113, 0.6)' :
                           realtimeStatus === 'error' ? '0 0 6px rgba(231, 76, 60, 0.6)' :
                           '0 0 6px rgba(241, 196, 15, 0.6)'
              }}
              title={realtimeStatus === 'connected' ? 'Tiempo Real: Conectado' :
                     realtimeStatus === 'error' ? 'Tiempo Real: Desconectado' :
                     'Tiempo Real: Conectando...'}
            />
          )}
          <span>{isCloudSynced ? 'Sincronizado (Supabase)' : 'Modo Local (Offline)'}</span>
        </div>


        {currentUser && (
          <div style={{
            background: 'var(--bg-secondary, rgba(0, 0, 0, 0.02))',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            padding: '8px 12px',
            marginBottom: '15px',
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
        <div className="sidebar-menu">
          {isAdminUser(currentUser) && <section className="admin-growth-nav" aria-label="Accesos de ventas">
            <span>CONTROL DE VENTAS</span>
            <button type="button" className={activeTab === 'settings' ? 'active' : ''} onClick={() => setActiveTab('settings')}><span aria-hidden="true">⚙️</span><span>Canales y ajustes<small>Mesas · barra · delivery</small></span><span aria-hidden="true">↗</span></button>
            <button type="button" className={activeTab === 'analytics' ? 'active' : ''} onClick={() => setActiveTab('analytics')}><span aria-hidden="true">📊</span><span>Conversiones GA4<small>Del producto a la compra</small></span><span aria-hidden="true">↗</span></button>
          </section>}
          {isAdminUser(currentUser) && <button className={`sidebar-btn ${activeTab === 'operations' ? 'active' : ''}`} onClick={() => setActiveTab('operations')}>◉ Centro de operaciones</button>}
          {isTabAllowed('driver_panel') && (
            <button className={`sidebar-btn ${activeTab === 'driver_panel' ? 'active' : ''}`} onClick={() => setActiveTab('driver_panel')}>
              🛵 Mis Repartos ({orders.filter(o => {
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
            <button className={`sidebar-btn ${activeTab === 'kds' ? 'active' : ''}`} onClick={() => setActiveTab('kds')}>
              👨‍🍳 KDS Cocina ({orders.filter(o => o.status === 'Pendiente' || o.status === 'Preparando').length})
            </button>
          )}
          {isTabAllowed('orders') && (
            <>
              <button className={`sidebar-btn ${activeTab === 'orders' ? 'active' : ''}`} onClick={() => setActiveTab('orders')}>
                📦 Pedidos ({orders.filter(o => o.status === 'Pendiente').length})
              </button>
              {isTabAllowed('crm') && (
                <button className={`sidebar-btn ${activeTab === 'crm' ? 'active' : ''}`} onClick={() => setActiveTab('crm')}>
                  📇 CRM Clientes
                </button>
              )}
            </>
          )}
          {storeServiceEnabled && isTabAllowed('ordertaker') && (
            <button className={`sidebar-btn ${activeTab === 'ordertaker' ? 'active' : ''}`} onClick={() => { setOrderTakerContext(null); setActiveTab('ordertaker'); }}>
              🛒 Tomador de Pedidos
            </button>
          )}
          {isTabAllowed('inventory') && (
            <button className={`sidebar-btn ${activeTab === 'inventory' ? 'active' : ''}`} onClick={() => setActiveTab('inventory')}>
              🍦 Carta Helada
            </button>
          )}
          {isTabAllowed('packs') && (
            <button className={`sidebar-btn ${activeTab === 'packs' ? 'active' : ''}`} onClick={() => setActiveTab('packs')}>
              🎁 Packs Combos
            </button>
          )}
          {currentUser && isAdminUser(currentUser) && isTabAllowed('users') && (
            <button className={`sidebar-btn ${activeTab === 'users' ? 'active' : ''}`} onClick={() => setActiveTab('users')}>
              👥 Personal / Staff
            </button>
          )}
          {isTabAllowed('finance') && (
            <button className={`sidebar-btn ${activeTab === 'finance' ? 'active' : ''}`} onClick={() => setActiveTab('finance')}>
              💵 Caja y Finanzas
            </button>
          )}
          {isTabAllowed('stats') && (
            <button className={`sidebar-btn ${activeTab === 'stats' ? 'active' : ''}`} onClick={() => setActiveTab('stats')}>
              📈 Meta e Ingresos
            </button>
          )}
          {isTabAllowed('surveys') && (
            <button className={`sidebar-btn ${activeTab === 'surveys' ? 'active' : ''}`} onClick={() => setActiveTab('surveys')}>
              ⭐ Encuestas ({orders.filter(o => o.survey).length})
            </button>
          )}
          {storeServiceEnabled && isTabAllowed('table_orders') && (
            <button className={`sidebar-btn ${activeTab === 'table_orders' ? 'active' : ''}`} onClick={() => setActiveTab('table_orders')}>
              🍽️ Pedidos en Mesa
            </button>
          )}
          {isTabAllowed('settings') && (
            <button className={`sidebar-btn ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
              ⚙️ Todos los ajustes
            </button>
          )}
          {isTabAllowed('locations') && (
            <button className={`sidebar-btn ${activeTab === 'locations' ? 'active' : ''}`} onClick={() => setActiveTab('locations')}>
              📍 Carritos / Ubicacion
            </button>
          )}
        </div>
      </div>

      {/* Contenido de pestaÃ±a activa */}
      <div className="admin-content">
          <Suspense fallback={<div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-light)' }}>Cargando módulo...</div>}>
          {activeTab === 'operations' && isAdminUser(currentUser) && <OperationsCenter orders={orders} salesGoal={salesGoal} shopOpen={shopOpen} onNavigate={setActiveTab} onUpdateOrderStatus={onUpdateOrderStatus} groups={[
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
            onNavigate={setActiveTab}
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
            onOpenOrderTaker={(context) => { setOrderTakerContext({ ...context, key: Date.now() }); setActiveTab('ordertaker'); }}
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
            onOpenAnalytics={() => setActiveTab('analytics')}
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

      {/* Panel Flotante Persistente para Llamados de AtenciÃ³n en Mesa */}
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
          animation: 'slideUpBounceAdmin 0.4s ease',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}>
          <style dangerouslySetInnerHTML={{ __html: `
            @keyframes slideUpBounceAdmin {
              from { transform: translateY(50px); opacity: 0; }
              to { transform: translateY(0); opacity: 1; }
            }
          ` }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
            <span style={{ fontWeight: 'bold', color: 'var(--danger)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              🛎️ LLAMADOS DE MESA ACTIVAS ({tableCalls.filter(c => !c.resolved).length})
            </span>
            <span style={{ background: 'var(--danger)', color: 'white', fontSize: '0.65rem', fontWeight: 'bold', padding: '2px 8px', borderRadius: '12px' }}>PENDIENTE</span>
          </div>
          <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {tableCalls.filter(c => !c.resolved).map((call, idx) => (
              <div key={idx} style={{
                background: 'var(--bg-secondary)',
                padding: '8px 10px',
                borderRadius: '8px',
                fontSize: '0.72rem',
                borderLeft: '4px solid var(--primary-color)',
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
