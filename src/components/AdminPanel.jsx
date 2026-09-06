/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../utils/supabaseClient';
import { updateSyncedData } from '../utils/supabaseSync';
import SettingsManager from './admin/SettingsManager';
import InventoryManager from './admin/InventoryManager';
import FinanceManager from './admin/FinanceManager';
import OrderManager from './admin/OrderManager';
import DashboardView from './admin/DashboardView';
import OperationsCenter from './admin/OperationsCenter';
import UserManager from './admin/UserManager';
import TableOrderManager from './admin/TableOrderManager';
import CartLocationsView from './CartLocationsView';
import KitchenDisplaySystem from './admin/KitchenDisplaySystem';
import CashRegisterManager from './admin/CashRegisterManager';
import CartSettlementManager from './admin/CartSettlementManager';
import AuditLogManager from './admin/AuditLogManager';
import CustomerCRM from './admin/CustomerCRM';
import DriverDeliveryPanel from './admin/DriverDeliveryPanel';
import { notifyOperationalEvent } from '../utils/appAudioNotifications';
import './admin/operations.css';

// --- FUNCIONES DE SANITIZACIÃ“N Y SEGURIDAD ---
const sanitizeHTML = (text) => {
  if (typeof text !== 'string') return '';
  return text.replace(/<[^>]*>/g, '').trim();
};

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
  orders = [],
  onUpdateOrderStatus,
  flavors = [],
  onUpdateFlavors,
  toppings = [],
  onUpdateToppings,
  bases = [],
  onUpdateBases,
  packs = [],
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
  staffUsers = [],
  onUpdateStaffUsers,
  soundEnabled,
  onToggleSoundEnabled,
  isLoggedIn,
  setIsLoggedIn,
  currentUser,
  setCurrentUser,
  onLogout,
  storeName = 'Friozo',
  onChangeStoreName,
  storeLogo = '🍦',
  onChangeStoreLogo,
  storeTitle,
  onChangeStoreTitle,
  storeFavicon,
  onChangeStoreFavicon,
  coupons = [],
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
  recommendations = [],
  onUpdateRecommendations,
  expenses = [],
  onUpdateExpenses,
  onUpdateOrders,
  cartRecommendedPack,
  onUpdateCartRecommendedPack,
  staffPermissions = {},
  onUpdateStaffPermissions,
  r2Config = {},
  onUpdateR2Config,
  literConfig = {},
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
  trendsInterval = 25,
  onChangeTrendsInterval,
  trendsDisplayTime = 4,
  onChangeTrendsDisplayTime,
  shopConfig = {},
  onChangeShopConfig,
  tableOrdersEnabled,
  waiterTakerEnabled,
  cartLocations = [],
  onUpdateCartLocations,
  testimonials = [],
  onUpdateTestimonials,
  storeHeroImage,
  onChangeStoreHeroImage,
  metaPixelId,
  onChangeMetaPixelId,
  googleAnalyticsId,
  onChangeGoogleAnalyticsId,
  realtimeStatus,
  onRefreshCarts,
  isVendorApp,
  cashRegisterShifts = [],
  onUpdateCashRegisterShifts,
  cartSettlements = [],
  onUpdateCartSettlements,
  auditLogs = []
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

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [activeTab]);

  // --- Estados de Autenticación y Seguridad ---
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
      /* ignore */
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
      /* ignore */
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

  // --- Detector de Eventos Operativos (Sonidos, Vibración y Notificaciones Push para Android y Web) ---
  const orderTrackingMapRef = useRef(null);

  useEffect(() => {
    const ordersList = orders || [];

    // Primera carga: memorizamos pedidos sin emitir alertas para evitar ruidos al abrir la app
    if (orderTrackingMapRef.current === null) {
      orderTrackingMapRef.current = new Map(ordersList.map(o => [o.id, {
        status: o.status,
        driverId: o.assignedDriver?.id || o.assignedDriver?.email || ''
      }]));
      return;
    }

    const prevMap = orderTrackingMapRef.current;
    const nextMap = new Map();

    ordersList.forEach(order => {
      const currentDriverId = order.assignedDriver?.id || order.assignedDriver?.email || '';
      nextMap.set(order.id, {
        status: order.status,
        driverId: currentDriverId
      });

      if (!prevMap.has(order.id)) {
        // Pedido totalmente nuevo ingresado al sistema
        const clientName = order.customer?.name || 'Cliente';
        const total = Number(order.grandTotal || 0).toFixed(2);
        const payment = order.customer?.paymentMethod || 'Pago';

        if (order.status === 'Por Corroborar') {
          notifyOperationalEvent('por_corroborar', { order, soundEnabled, storeName });
          addLog(`🔔 Nuevo pedido por corroborar: #${order.id} (${clientName}) - S/. ${total} [${payment}]`);
        } else if (order.status === 'Pendiente') {
          notifyOperationalEvent('new_order', { order, soundEnabled, storeName });
          addLog(`📋 Nuevo pedido confirmado: #${order.id} (${clientName}) - S/. ${total} [${payment}]`);
        }
      } else {
        // Pedido existente: evaluar transiciones clave
        const prev = prevMap.get(order.id);
        if (prev.status !== order.status) {
          if (order.status === 'Por Corroborar') {
            notifyOperationalEvent('por_corroborar', { order, soundEnabled, storeName });
          } else if (order.status === 'Preparando') {
            notifyOperationalEvent('kitchen_prep', { order, soundEnabled, storeName });
            addLog(`👨‍🍳 Pedido #${order.id} enviado a cocina para preparación.`);
          } else if (order.status === 'En camino') {
            notifyOperationalEvent('driver_assigned', {
              order,
              soundEnabled,
              storeName,
              title: `🛵 ¡Pedido en Ruta de Entrega!`,
              body: `Pedido #${order.id} salió con ${order.assignedDriver?.name || 'repartidor'}`
            });
            addLog(`🛵 Pedido #${order.id} despachado a ruta de entrega.`);
          }
        }
        // Cambio de repartidor asignado
        if (currentDriverId && currentDriverId !== prev.driverId) {
          notifyOperationalEvent('driver_assigned', {
            order,
            soundEnabled,
            storeName,
            title: `🛵 Repartidor Asignado (${storeName})`,
            body: `Pedido #${order.id} asignado a ${order.assignedDriver?.name || 'repartidor'}`
          });
          addLog(`🛵 Pedido #${order.id} asignado a ${order.assignedDriver?.name || 'repartidor'}`);
        }
      }
    });

    orderTrackingMapRef.current = nextMap;
  }, [orders, soundEnabled, storeName]);

  // --- Detector de Nuevos Llamados en Mesa (Alerta Sonora, Vibración y Notificación) ---
  const prevCallsCount = useRef((tableCalls || []).filter(c => !c.resolved).length);

  useEffect(() => {
    const activeCalls = (tableCalls || []).filter(c => !c.resolved);
    if (activeCalls.length > (prevCallsCount.current || 0)) {
      const latestCall = activeCalls[activeCalls.length - 1];
      notifyOperationalEvent('waiter_call', {
        soundEnabled,
        storeName,
        title: `🛎️ ¡Mesa ${latestCall?.table || ''} solicita atención!`,
        body: latestCall?.request || 'Un cliente solicita asistencia de mozo.'
      });
      if (latestCall) {
        addLog(`🛎️ Mesa ${latestCall.table} solicita atención: ${latestCall.request || ''}`);
      }
    }
    prevCallsCount.current = activeCalls.length;
  }, [tableCalls, soundEnabled, storeName]);

  useEffect(() => {
    if (isLoggedIn && canUseNotifications && window.Notification?.permission === 'default') {
      try {
        window.Notification?.requestPermission?.().catch?.(() => {});
      } catch {
        /* ignore */
      }
    }
  }, [isLoggedIn, canUseNotifications]);

  // --- Control de Acceso por Ventanas/MÃ³dulos ---
  const isTabAllowed = (tabId) => {
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
    if (role.includes('vendedor')) return ['orders', 'crm', 'inventory', 'surveys', 'table_orders', 'locations', 'cash_register', 'cart_dispatch'].includes(tabId);
    if (role.includes('cocina')) return ['orders', 'kds'].includes(tabId);
    if (role.includes('repartidor') || role.includes('delivery')) return ['driver_panel', 'orders', 'locations'].includes(tabId);
    if (role.includes('cajero')) return ['orders', 'crm', 'finance', 'cash_register'].includes(tabId);
    if (role.includes('mozo') || role.includes('salon')) return ['table_orders'].includes(tabId);
    return false;
  };

  useEffect(() => {
    if (currentUser && !isTabAllowed(activeTab)) {
      const role = normalizeText(currentUser.role);
      const isDriver = role.includes('repartidor') || role.includes('delivery');
      const fallbackTab = isDriver
        ? 'driver_panel'
        : ['operations', 'driver_panel', 'orders', 'crm', 'kds', 'cash_register', 'cart_dispatch', 'table_orders', 'inventory', 'packs', 'users', 'finance', 'audit_log', 'locations', 'settings', 'stats', 'surveys']
            .find((tabId) => isTabAllowed(tabId));
      if (fallbackTab) setActiveTab(fallbackTab);
    }
  }, [currentUser, activeTab]);

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
        setAuthError(`Contraseña errada. Intentos restantes: ${5 - nextAttempts}`);
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
          <h2 style={{ marginTop: '10px' }}>{isVendorApp ? "Friozo Operadores" : "Acceso Administrativo"}</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-light)', marginTop: '4px', marginBottom: isVendorApp ? '15px' : '4px' }}>
            {isVendorApp ? "Panel exclusivo para operadores y despacho." : (supabase ? "Conectado a la base de datos Supabase." : "Ingresa con tu usuario o clave maestra.")}
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
                backgroundColor: isCloudSynced ? 'rgba(46, 204, 113, 0.1)' :
                                 realtimeStatus === 'error' ? 'rgba(231, 76, 60, 0.1)' :
                                 'rgba(241, 196, 15, 0.1)',
                color: isCloudSynced ? 'var(--success)' :
                       realtimeStatus === 'error' ? 'var(--danger)' :
                       'var(--secondary-color)',
              }}>
                <span style={{
                  display: 'inline-block',
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: isCloudSynced ? '#2ecc71' :
                              realtimeStatus === 'error' ? '#e74c3c' :
                              '#f1c40f',
                  boxShadow: isCloudSynced ? '0 0 6px rgba(46, 204, 113, 0.6)' :
                             realtimeStatus === 'error' ? '0 0 6px rgba(231, 76, 60, 0.6)' :
                             '0 0 6px rgba(241, 196, 15, 0.6)'
                }} />
                {isCloudSynced ? 'Sincronizado (Supabase)' :
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
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                type={showPassword ? "text" : "password"}
                className="form-control"
                placeholder="Contraseña"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                style={{ paddingRight: '42px' }}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(prev => !prev)}
                aria-label={showPassword ? "Ocultar contraseña" : "Ver contraseña"}
                title={showPassword ? "Ocultar contraseña" : "Ver contraseña"}
                style={{
                  position: 'absolute',
                  right: '10px',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px',
                  fontSize: '1.1rem',
                  lineHeight: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-light)'
                }}
              >
                {showPassword ? '👁️‍🗨️' : '👁️'}
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.84rem' }}>
            <input
              type="checkbox"
              id="rememberOperatorCreds"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              style={{ cursor: 'pointer', width: '16px', height: '16px' }}
            />
            <label htmlFor="rememberOperatorCreds" style={{ cursor: 'pointer', margin: 0, userSelect: 'none', color: 'var(--text-dark)', fontWeight: 500 }}>
              Recordar contraseña en este dispositivo
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
          <span 
            style={{
              display: 'inline-block',
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              background: isCloudSynced 
                ? (realtimeStatus === 'error' ? '#e74c3c' : '#2ecc71')
                : '#f1c40f',
              boxShadow: isCloudSynced 
                ? (realtimeStatus === 'error' ? '0 0 6px rgba(231, 76, 60, 0.6)' : '0 0 6px rgba(46, 204, 113, 0.6)')
                : '0 0 6px rgba(241, 196, 15, 0.6)'
            }}
            title={isCloudSynced 
              ? (realtimeStatus === 'connected' ? 'Sincronizado con Supabase (Tiempo Real Activo)' : realtimeStatus === 'error' ? 'Supabase Conectado (Error de Tiempo Real)' : 'Sincronizado con Supabase') 
              : 'Modo Local (Offline)'}
          />
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
          {isAdminUser(currentUser) && <button className={`sidebar-btn ${activeTab === 'operations' ? 'active' : ''}`} onClick={() => setActiveTab('operations')}>◉ Centro de operaciones</button>}
          {isTabAllowed('driver_panel') && (
            <button className={`sidebar-btn ${activeTab === 'driver_panel' ? 'active' : ''}`} onClick={() => setActiveTab('driver_panel')}>
              🛵 Mis Repartos ({orders.filter(o => {
                if (!o || o.status === 'Cancelado' || o.status === 'Entregado') return false;
                const d = o.assignedDriver;
                if (!d) return false;
                return String(d.email || '').toLowerCase().trim() === String(currentUser?.email || '').toLowerCase().trim() ||
                       String(d.id || '').trim() === String(currentUser?.id || '').trim();
              }).length})
            </button>
          )}
          {isTabAllowed('orders') && (
            <button className={`sidebar-btn ${activeTab === 'orders' ? 'active' : ''}`} onClick={() => setActiveTab('orders')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
              <span>📋 Pedidos ({orders.filter(o => ['Por Corroborar', 'Pendiente'].includes(o.status)).length})</span>
              {orders.filter(o => o.status === 'Por Corroborar').length > 0 && (
                <span style={{ background: '#e67e22', color: '#fff', fontSize: '0.68rem', fontWeight: 800, padding: '1px 6px', borderRadius: '10px' }} title="Pedidos por corroborar">
                  ⏳ {orders.filter(o => o.status === 'Por Corroborar').length}
                </span>
              )}
            </button>
          )}
          {isTabAllowed('crm') && (
            <button className={`sidebar-btn ${activeTab === 'crm' ? 'active' : ''}`} onClick={() => setActiveTab('crm')}>
              📇 CRM Clientes
            </button>
          )}
          {(shopConfig?.kdsEnabled !== false) && isTabAllowed('kds') && (
            <button className={`sidebar-btn ${activeTab === 'kds' ? 'active' : ''}`} onClick={() => setActiveTab('kds')}>
              👨‍🍳 KDS Cocina ({orders.filter(o => ['Pendiente', 'Preparando', 'Listo'].includes(o.status)).length})
            </button>
          )}
          {(shopConfig?.cashRegisterEnabled !== false) && isTabAllowed('cash_register') && (
            <button className={`sidebar-btn ${activeTab === 'cash_register' ? 'active' : ''}`} onClick={() => setActiveTab('cash_register')}>
              💵 Arqueo / Cierre Z
            </button>
          )}
          {(shopConfig?.cartSettlementEnabled !== false) && isTabAllowed('cart_dispatch') && (
            <button className={`sidebar-btn ${activeTab === 'cart_dispatch' ? 'active' : ''}`} onClick={() => setActiveTab('cart_dispatch')}>
              🍦 Cierre Carritos
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
              📊 Finanzas y Gastos
            </button>
          )}
          {(shopConfig?.auditLogEnabled !== false) && isTabAllowed('audit_log') && (
            <button className={`sidebar-btn ${activeTab === 'audit_log' ? 'active' : ''}`} onClick={() => setActiveTab('audit_log')}>
              🛡️ Auditoría
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
          {(tableOrdersEnabled || isAdminUser(currentUser)) && isTabAllowed('table_orders') && (
            <button className={`sidebar-btn ${activeTab === 'table_orders' ? 'active' : ''}`} onClick={() => setActiveTab('table_orders')}>
              🍽️ Pedidos en Mesa
            </button>
          )}
          {isTabAllowed('settings') && (
            <button className={`sidebar-btn ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
              ⚙️ Ajustes Tienda
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
        {activeTab === 'operations' && isAdminUser(currentUser) && <OperationsCenter orders={orders} salesGoal={salesGoal} shopOpen={shopOpen} onNavigate={setActiveTab} onUpdateOrderStatus={onUpdateOrderStatus} groups={[
          {key:'flavors',name:'Sabores',items:flavors,update:onUpdateFlavors},
          {key:'bases',name:'Envases',items:bases,update:onUpdateBases},
          {key:'toppings',name:'Toppings y salsas',items:toppings,update:onUpdateToppings},
          {key:'popsicles',name:'Paletas',items:popsicles,update:onUpdatePopsicles},
          {key:'packs',name:'Packs',items:packs,update:onUpdatePacks}
        ]} />}

        {activeTab === 'driver_panel' && isTabAllowed('driver_panel') && (
          <DriverDeliveryPanel
            orders={orders}
            onUpdateOrderStatus={onUpdateOrderStatus}
            currentUser={currentUser}
            storeName={storeName}
            cartLocations={cartLocations}
            onUpdateCartLocations={onUpdateCartLocations}
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
            storePhone={storePhone}
            ticketCustomMessage={ticketCustomMessage}
            addLog={addLog}
            currentUser={currentUser}
            showAlert={showAlert}
            shopConfig={shopConfig}
            activeSubTab={activeTab === 'orders' ? 'orders' : 'surveys'}
            staffUsers={staffUsers}
          />
        )}

        {activeTab === 'kds' && (
          <KitchenDisplaySystem
            orders={orders}
            onUpdateOrderStatus={onUpdateOrderStatus}
            storeName={storeName}
            addLog={addLog}
            currentUser={currentUser}
            soundEnabled={soundEnabled}
          />
        )}

        {activeTab === 'cash_register' && (
          <CashRegisterManager
            orders={orders}
            currentUser={currentUser}
            storeName={storeName}
            shifts={cashRegisterShifts}
            onUpdateShifts={onUpdateCashRegisterShifts}
            addLog={addLog}
            showAlert={showAlert}
          />
        )}

        {activeTab === 'cart_dispatch' && (
          <CartSettlementManager
            currentUser={currentUser}
            storeName={storeName}
            staffUsers={staffUsers}
            cartLocations={cartLocations}
            onUpdateCartLocations={onUpdateCartLocations}
            settlements={cartSettlements}
            onUpdateSettlements={onUpdateCartSettlements}
            popsicles={popsicles}
            flavors={flavors}
            packs={packs}
            bases={bases}
            literConfig={literConfig}
            shopConfig={shopConfig}
            onChangeShopConfig={onChangeShopConfig}
            addLog={addLog}
            showAlert={showAlert}
          />
        )}

        {activeTab === 'audit_log' && (
          <AuditLogManager
            logs={auditLogs && auditLogs.length > 0 ? auditLogs : (logs || [])}
            currentUser={currentUser}
            storeName={storeName}
          />
        )}

        {activeTab === 'crm' && (
          <CustomerCRM
            orders={orders}
            storeName={storeName}
            showAlert={showAlert}
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
          <FinanceManager
            orders={orders}
            onUpdateOrders={onUpdateOrders}
            expenses={expenses}
            onUpdateExpenses={onUpdateExpenses}
            packs={packs}
            addLog={addLog}
            currentUser={currentUser}
            showAlert={showAlert}
          />
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

        {(tableOrdersEnabled || isAdminUser(currentUser)) && activeTab === 'table_orders' && (
          <TableOrderManager
            onUpdateOrderStatus={onUpdateOrderStatus}
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
