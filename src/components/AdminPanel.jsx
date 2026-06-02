import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../utils/supabaseClient';
import SettingsManager from './admin/SettingsManager';
import InventoryManager from './admin/InventoryManager';
import FinanceManager from './admin/FinanceManager';
import OrderManager from './admin/OrderManager';
import DashboardView from './admin/DashboardView';
import UserManager from './admin/UserManager';

// --- FUNCIONES DE SANITIZACIÓN Y SEGURIDAD ---
const sanitizeHTML = (text) => {
  if (typeof text !== 'string') return '';
  return text.replace(/<[^>]*>/g, '').trim();
};

const isValidEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(String(email).toLowerCase().trim());
};

export default function AdminPanel({
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
  coupons,
  onUpdateCoupons,
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
  catalogOrder = ['liter', 'classic', 'packs'],
  onUpdateCatalogOrder,
  showAlert
}) {
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
  const [activeTab, setActiveTab] = useState('orders'); // orders, inventory, packs, users, finance, settings, stats, surveys

  // --- Estados de Autenticación y Seguridad ---
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
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
  const prevOrdersCount = useRef(orders.length);

  const playNewOrderSound = () => {
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
    } catch (e) {
      console.warn("Audio chime blocked by autoplay policies.");
    }
  };

  useEffect(() => {
    if (orders.length > prevOrdersCount.current) {
      const latestOrder = orders[0];
      if (latestOrder && latestOrder.status === 'Pendiente') {
        playNewOrderSound();
        addLog(`Nuevo pedido recibido: ${latestOrder.id} por el cliente ${latestOrder.customer.name}.`);
        if (Notification.permission === 'granted') {
          new Notification(`🍦 ¡Nuevo Pedido en ${storeName}!`, {
            body: `Cliente: ${latestOrder.customer.name} - Total: S/. ${latestOrder.grandTotal.toFixed(2)}`
          });
        }
      }
    }
    prevOrdersCount.current = orders.length;
  }, [orders, soundEnabled]);

  useEffect(() => {
    if (isLoggedIn && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, [isLoggedIn]);

  // --- Control de Acceso por Ventanas/Módulos ---
  const isTabAllowed = (tabId) => {
    if (!currentUser) return false;
    if (currentUser.email === 'admin@donhelado.com' || (currentUser.role === 'Administrador' && tabId === 'users')) return true;
    
    const userPerms = staffPermissions[currentUser.email];
    if (userPerms) {
      return userPerms.includes(tabId);
    }
    
    if (currentUser.role === 'Administrador') return true;
    if (currentUser.role === 'Vendedor') return ['orders', 'inventory', 'surveys'].includes(tabId);
    if (currentUser.role === 'Cocina') return ['orders'].includes(tabId);
    return false;
  };

  useEffect(() => {
    if (currentUser && !isTabAllowed(activeTab)) {
      const tabs = ['orders', 'inventory', 'packs', 'users', 'finance', 'settings', 'stats', 'surveys'];
      const allowed = tabs.find(t => isTabAllowed(t));
      if (allowed) {
        setActiveTab(allowed);
      }
    }
  }, [currentUser, activeTab]);

  // --- Manejo del Inicio de Sesión ---
  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError('');

    const now = Date.now();
    if (lockoutUntil && now < lockoutUntil) {
      const minutesLeft = Math.ceil((lockoutUntil - now) / (60 * 1000));
      setAuthError(`🚨 Panel bloqueado por seguridad. Inténtalo de nuevo en ${minutesLeft} minuto(s).`);
      return;
    }

    const userInput = sanitizeHTML(emailInput).toLowerCase().trim();
    const passwordSanitized = passwordInput.trim();

    if (!userInput || !passwordSanitized) {
      setAuthError('Por favor ingresa usuario o correo y contraseña.');
      return;
    }

    const searchEmail = userInput.includes('@') ? userInput : `${userInput}@donhelado.com`;

    const handleLoginSuccess = (userObj, isSupabase) => {
      setLoginAttempts(0);
      setLockoutUntil(0);
      localStorage.setItem('helados_admin_login_timestamp', Date.now().toString());
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
        setAuthError('🚨 Has superado los 5 intentos de inicio de sesión fallidos. El panel de administración ha sido bloqueado temporalmente por 15 minutos.');
        addLog(`BLOQUEO DE SEGURIDAD: 5 intentos fallidos en login para usuario: ${userInput}`);
      } else {
        setAuthError(customMsg || `Credenciales incorrectas. Intentos restantes: ${5 - nextAttempts}`);
      }
    };

    // 1. Intentar iniciar sesión por medio de Supabase Auth nativo (JWT)
    if (supabase) {
      try {
        console.log("🔑 Intentando inicio de sesión nativo con Supabase Auth...");
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
            role: user.user_metadata?.role || 'Administrador',
            status: 'Activo',
            password: passwordSanitized,
            isSupabaseUser: true
          };

          handleLoginSuccess(userObj, true);

          try {
            const { data: adminList } = await supabase.rpc('get_all_admins');
            if (adminList) onUpdateStaffUsers(adminList);
          } catch (err) {
            console.warn("No se pudo refrescar lista de personal", err);
          }
          return;
        }
      } catch (err) {
        console.warn("Fallo al intentar login nativo Supabase Auth:", err.message);
      }
    }

    // 2. Fallback de RPC
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('verify_admin_login', {
          p_username_or_email: userInput,
          p_password: passwordSanitized
        });
        
        if (error) throw error;
        
        if (data) {
          if (data.error === 'Usuario suspendido.') {
            setAuthError('🚨 Tu cuenta se encuentra SUSPENDIDA. Contacta al administrador.');
            return;
          }
          
          const userObj = {
            id: data.id,
            username: data.username,
            email: data.email,
            name: data.name,
            role: data.role,
            status: data.status,
            password: passwordSanitized,
            isSupabaseUser: true
          };
          
          handleLoginSuccess(userObj, true);

          try {
            const { data: adminList } = await supabase.rpc('get_all_admins');
            if (adminList) onUpdateStaffUsers(adminList);
          } catch (err) {
            console.warn("No se pudo refrescar lista de personal", err);
          }
          return;
        }
      } catch (err) {
        console.warn("Fallo en login de Supabase RPC, buscando local...", err.message);
      }
    }

    // 3. Fallback Local
    let foundUser = staffUsers && staffUsers.length > 0
      ? staffUsers.find(u => u.email.toLowerCase() === searchEmail)
      : null;
    
    if (foundUser) {
      if (foundUser.status === 'Suspendido') {
        setAuthError('🚨 Tu cuenta se encuentra SUSPENDIDA. Contacta al administrador.');
        return;
      }

      if (foundUser.password === passwordSanitized) {
        const userObj = { ...foundUser, password: passwordSanitized, isSupabaseUser: false };
        handleLoginSuccess(userObj, false);
        return;
      } else {
        handleLoginFailure('Contraseña incorrecta.');
        return;
      }
    }

    handleLoginFailure('Credenciales incorrectas o usuario no registrado.');
  };

  const handleLogoutAction = () => {
    addLog(`Cierre de sesión por el usuario ${currentUser?.name || ''}.`);
    onLogout();
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
      <div className="glass" style={{ maxWidth: '400px', width: '90%', margin: '40px auto', padding: '25px', borderRadius: 'var(--radius-lg)' }}>
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <span style={{ fontSize: '3rem' }}>🔒</span>
          <h2 style={{ marginTop: '10px' }}>Acceso Administrativo</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-light)', marginTop: '4px' }}>
            {supabase ? "Conectado a la base de datos Supabase." : "Ingresa con tu usuario o clave maestra."}
          </p>
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
            <input
              type="password"
              className="form-control"
              placeholder="Contraseña"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              required
            />
          </div>

          {authError && (
            <p style={{ color: 'var(--danger)', fontSize: '0.8rem', fontWeight: 600 }}>⚠️ {authError}</p>
          )}

          <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '12px' }}>
            🔑 Ingresar al Panel
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="admin-layout">
      {/* Sidebar */}
      <div className="glass admin-sidebar">
        <h4 style={{ marginBottom: '5px', color: 'var(--primary-color)', fontSize: '1.1rem' }}>🔧 {storeName} Admin</h4>
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
          <span>{isCloudSynced ? '🟢 Sincronizado (Supabase)' : '🟡 Modo Local (Offline)'}</span>
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
                👤 {currentUser.role || 'Operador'}
              </span>
            </div>
          </div>
        )}
        <div className="sidebar-menu">
          {isTabAllowed('orders') && (
            <button className={`sidebar-btn ${activeTab === 'orders' ? 'active' : ''}`} onClick={() => setActiveTab('orders')}>
              📋 Pedidos ({orders.filter(o => o.status === 'Pendiente').length})
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
          {currentUser && currentUser.role === 'Administrador' && isTabAllowed('users') && (
            <button className={`sidebar-btn ${activeTab === 'users' ? 'active' : ''}`} onClick={() => setActiveTab('users')}>
              👥 Personal / Staff
            </button>
          )}
          {isTabAllowed('finance') && (
            <button className={`sidebar-btn ${activeTab === 'finance' ? 'active' : ''}`} onClick={() => setActiveTab('finance')}>
              💵 Caja y Finanzas
            </button>
          )}
          {isTabAllowed('settings') && (
            <button className={`sidebar-btn ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
              ⚙️ Ajustes Tienda
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
        </div>
      </div>

      {/* Contenido de pestaña activa */}
      <div className="admin-content">
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
            activeSubTab={activeTab === 'orders' ? 'orders' : 'surveys'}
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

        {activeTab === 'settings' && (
          <SettingsManager
            storeName={storeName}
            onChangeStoreName={onChangeStoreName}
            storeLogo={storeLogo}
            onChangeStoreLogo={onChangeStoreLogo}
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
            onChangeWhitespaceGreeting={onChangeWhatsappGreeting}
            whatsappFooter={whatsappFooter}
            onChangeWhatsappFooter={onChangeWhatsappFooter}
            qrCustomUrl={qrCustomUrl}
            onChangeQrCustomUrl={onChangeQrCustomUrl}
            ticketCustomMessage={ticketCustomMessage}
            onUpdateTicketCustomMessage={onUpdateTicketCustomMessage}
            catalogOrder={catalogOrder}
            onUpdateCatalogOrder={onUpdateCatalogOrder}
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
          />
        )}

        {activeTab === 'stats' && (
          <DashboardView
            orders={orders}
            salesGoal={salesGoal}
            handleExportFinancialsCSV={handleExportFinancialsCSV}
            handleExportSalesReport={handleExportSalesReport}
            currentUser={currentUser}
          />
        )}
      </div>
    </div>
  );
}
