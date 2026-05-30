import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../utils/supabaseClient';

// --- FUNCIONES DE SANITIZACIÓN Y SEGURIDAD CONTRA INYECCIONES Y XSS ---
const sanitizeHTML = (text) => {
  if (typeof text !== 'string') return '';
  // Elimina cualquier etiqueta HTML, caracteres peligrosos o fragmentos de script
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
  onUpdateRecommendations
}) {
  // --- Estados de Autenticación ---
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState('');

  // --- Estados de UI ---
  const [activeTab, setActiveTab] = useState('orders'); // orders, inventory, packs, users, settings, stats
  const [orderFilter, setOrderFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState(''); 
  const [showSQLScript, setShowSQLScript] = useState(false);

  // --- Estados para CRUD: Edición y Creación ---
  const [showAddFlavor, setShowAddFlavor] = useState(false);
  const [editingFlavor, setEditingFlavor] = useState(null); 
  const [newFlavor, setNewFlavor] = useState({ name: '', price: 1.0, color: '#ff6b81', isPremium: false, isPopular: false, description: '' });

  const [showAddTopping, setShowAddTopping] = useState(false);
  const [editingTopping, setEditingTopping] = useState(null); 
  const [newTopping, setNewTopping] = useState({ name: '', price: 0.5 });

  const [showAddPack, setShowAddPack] = useState(false);
  const [editingPack, setEditingPack] = useState(null); 
  const [newPack, setNewPack] = useState({ name: '', description: '', price: 10.0, items: '', discountText: '', badge: '' });

  const [showAddRecommendation, setShowAddRecommendation] = useState(false);
  const [newRec, setNewRec] = useState({ name: '', baseId: 'cono', flavorId1: '', flavorId2: '', flavorId3: '', toppingId: '', syrupId: '' });
  const [editingRecommendation, setEditingRecommendation] = useState(null);
  const [editRec, setEditRec] = useState({ id: '', name: '', baseId: 'cono', flavorId1: '', flavorId2: '', flavorId3: '', toppingId: '', syrupId: '' });

  // --- Estados para CRUD de Bases / Envases ---
  const [showAddBase, setShowAddBase] = useState(false);
  const [editingBase, setEditingBase] = useState(null);
  const [newBase, setNewBase] = useState({ name: '', price: 0.0, icon: '🍨', description: '' });

  // --- Estados Locales para Ajustes (Evita bugs de pérdida de foco al escribir) ---
  const [localStoreName, setLocalStoreName] = useState(storeName);
  const [localStoreLogo, setLocalStoreLogo] = useState(storeLogo);
  const [localStorePhone, setLocalStorePhone] = useState(storePhone);
  const [localSalesGoal, setLocalSalesGoal] = useState(salesGoal);
  const [localFreeDeliveryThreshold, setLocalFreeDeliveryThreshold] = useState(freeDeliveryThreshold);
  const [localDeliveryCampaignText, setLocalDeliveryCampaignText] = useState(deliveryCampaignText);
  const [localTelegramToken, setLocalTelegramToken] = useState(telegramToken);
  const [localTelegramChatId, setLocalTelegramChatId] = useState(telegramChatId);
  const [localWhatsappGreeting, setLocalWhatsappGreeting] = useState(whatsappGreeting);
  const [localWhatsappFooter, setLocalWhatsappFooter] = useState(whatsappFooter);
  const [localQrCustomUrl, setLocalQrCustomUrl] = useState(qrCustomUrl);

  useEffect(() => { setLocalStoreName(storeName); }, [storeName]);
  useEffect(() => { setLocalStoreLogo(storeLogo); }, [storeLogo]);
  useEffect(() => { setLocalStorePhone(storePhone); }, [storePhone]);
  useEffect(() => { setLocalSalesGoal(salesGoal); }, [salesGoal]);
  useEffect(() => { setLocalFreeDeliveryThreshold(freeDeliveryThreshold); }, [freeDeliveryThreshold]);
  useEffect(() => { setLocalDeliveryCampaignText(deliveryCampaignText); }, [deliveryCampaignText]);
  useEffect(() => { setLocalTelegramToken(telegramToken); }, [telegramToken]);
  useEffect(() => { setLocalTelegramChatId(telegramChatId); }, [telegramChatId]);
  useEffect(() => { setLocalWhatsappGreeting(whatsappGreeting); }, [whatsappGreeting]);
  useEffect(() => { setLocalWhatsappFooter(whatsappFooter); }, [whatsappFooter]);
  useEffect(() => { setLocalQrCustomUrl(qrCustomUrl); }, [qrCustomUrl]);

  const handleSaveSettings = () => {
    onChangeStoreName(localStoreName);
    onChangeStoreLogo(localStoreLogo);
    onChangeStorePhone(localStorePhone);
    onChangeSalesGoal(parseFloat(localSalesGoal) || 0);
    onChangeFreeDeliveryThreshold(parseFloat(localFreeDeliveryThreshold) || 0);
    onChangeDeliveryCampaignText(localDeliveryCampaignText);
    onChangeTelegramToken(localTelegramToken);
    onChangeTelegramChatId(localTelegramChatId);
    onChangeWhatsappGreeting(localWhatsappGreeting);
    onChangeWhatsappFooter(localWhatsappFooter);
    onChangeQrCustomUrl(localQrCustomUrl);
    
    addLog(`Ajustes de heladería guardados en Supabase por ${currentUser?.name || 'Administrador'}.`);
    alert("¡Ajustes de heladería guardados y sincronizados correctamente en la nube!");
  };

  const [statsRange, setStatsRange] = useState('7days'); // today, 7days, 30days, all, custom
  const [statsStartDate, setStatsStartDate] = useState('');
  const [statsEndDate, setStatsEndDate] = useState('');
  const [expandedDay, setExpandedDay] = useState(null); // Para ver el desglose de pedidos de un día específico

  // --- Estados para Gestión de Usuarios ---
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', email: '', role: 'Vendedor', password: '123' });
  const [editingUserPassword, setEditingUserPassword] = useState(null); 
  const [newPasswordForUser, setNewPasswordForUser] = useState('');

  // --- NUEVO: Bitácora de Auditoría (Simulada) ---
  const [logs, setLogs] = useState(() => {
    const saved = localStorage.getItem('helados_admin_logs');
    return saved ? JSON.parse(saved) : [
      { time: new Date().toLocaleTimeString('es-PE'), text: 'Inicio de sesión administrativa habilitado.' }
    ];
  });

  const [telegramTestStatus, setTelegramTestStatus] = useState({ loading: false, success: null, error: null });

  const handleTestTelegramConnection = async () => {
    const tokenToUse = localTelegramToken || telegramToken;
    const chatIdToUse = localTelegramChatId || telegramChatId;
    if (!tokenToUse || !chatIdToUse) {
      setTelegramTestStatus({ loading: false, success: false, error: 'Por favor, ingresa tanto el Token como el Chat ID.' });
      return;
    }

    setTelegramTestStatus({ loading: true, success: null, error: null });
    try {
      const testMsg = `🔔 *¡Conexión Exitosa!*\n\nTu bot de Telegram ha sido correctamente configurado para la heladería *${localStoreName || storeName}*.\n\nRecibirás una notificación por este canal cada vez que se realice un nuevo pedido. 🎉`;
      const response = await fetch(`https://api.telegram.org/bot${tokenToUse}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: telegramChatId,
          text: testMsg,
          parse_mode: 'Markdown'
        })
      });

      const resData = await response.json();
      if (response.ok && resData.ok) {
        setTelegramTestStatus({ loading: false, success: true, error: null });
        addLog("Notificación de prueba enviada con éxito a Telegram.");
      } else {
        throw new Error(resData.description || 'Error al conectar con Telegram API.');
      }
    } catch (err) {
      setTelegramTestStatus({ 
        loading: false, 
        success: false, 
        error: `Fallo al enviar mensaje: ${err.message || err}` 
      });
      addLog(`Error probando bot de Telegram: ${err.message || err}`);
    }
  };

  const [newCoupon, setNewCoupon] = useState({ code: '', type: 'percentage', value: 10 });

  const handleAddCouponSubmit = (e) => {
    e.preventDefault();
    if (!newCoupon.code.trim()) return;

    const formattedCode = newCoupon.code.toUpperCase().trim();

    if (coupons.some(c => c.code === formattedCode)) {
      alert("Ya existe un cupón con este código.");
      return;
    }

    const added = {
      code: formattedCode,
      type: newCoupon.type,
      value: newCoupon.type === 'free_delivery' ? 0 : parseFloat(newCoupon.value) || 0,
      description: newCoupon.type === 'free_delivery' 
        ? 'Envío gratis' 
        : (newCoupon.type === 'percentage' 
            ? `${newCoupon.value}% de descuento` 
            : `S/. ${parseFloat(newCoupon.value).toFixed(2)} de descuento`)
    };

    onUpdateCoupons([...coupons, added]);
    setNewCoupon({ code: '', type: 'percentage', value: 10 });
    addLog(`Cupón creado: ${added.code} (${added.description}) por ${currentUser?.name}.`);
  };

  // --- Efectos de Persistencia ---
  useEffect(() => {
    localStorage.setItem('helados_admin_logs', JSON.stringify(logs));
  }, [logs]);

  const addLog = (text) => {
    const newLog = {
      time: new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      text
    };
    setLogs(prev => [newLog, ...prev.slice(0, 49)]); // Mantener últimas 50 operaciones
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

  // --- Manejo del Inicio de Sesión ---
  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError('');

    const userInput = sanitizeHTML(emailInput).toLowerCase().trim();
    const passwordSanitized = passwordInput.trim();

    if (!userInput || !passwordSanitized) {
      setAuthError('Por favor ingresa usuario o correo y contraseña.');
      return;
    }

    const searchEmail = userInput.includes('@') ? userInput : `${userInput}@donhelado.com`;

    // 1. Intentar iniciar sesión por medio del RPC de Supabase
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
            password: passwordSanitized, // Guardamos para operaciones RPC posteriores
            isSupabaseUser: true
          };
          
          setIsLoggedIn(true);
          setCurrentUser(userObj);
          addLog(`Inicio de sesión multidispositivo exitoso por ${userObj.name} (${userObj.role}).`);

          // Cargar lista actualizada de personal
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

    // 2. Fallback de seguridad utilizando la lista de personal registrado (staffUsers) o de respaldo
    let foundUser = staffUsers && staffUsers.length > 0
      ? staffUsers.find(u => u.email.toLowerCase() === searchEmail)
      : null;
    
    // Fallback de seguridad utilizando las credenciales de respaldo por defecto
    const BACKUP_STAFF_USERS = [
      { email: 'admin@donhelado.com', name: 'Administrador Principal', role: 'Administrador', status: 'Activo', password: 'admin' },
      { email: 'vendedor@donhelado.com', name: 'Vendedor de Turno', role: 'Vendedor', status: 'Activo', password: '123' },
      { email: 'cocina@donhelado.com', name: 'Preparador de Cocina', role: 'Cocina', status: 'Activo', password: '123' }
    ];

    if (!foundUser) {
      foundUser = BACKUP_STAFF_USERS.find(u => u.email.toLowerCase() === searchEmail);
    }
    
    if (foundUser) {
      if (foundUser.status === 'Suspendido') {
        setAuthError('🚨 Tu cuenta se encuentra SUSPENDIDA. Contacta al administrador.');
        return;
      }

      if (foundUser.password === passwordSanitized) {
        const userObj = { ...foundUser, password: passwordSanitized, isSupabaseUser: false };
        setIsLoggedIn(true);
        setCurrentUser(userObj);
        addLog(`Inicio de sesión exitoso: ${foundUser.name} (${foundUser.role}).`);
        return;
      } else {
        setAuthError('Contraseña incorrecta.');
        return;
      }
    }

    setAuthError('Credenciales incorrectas o usuario no registrado.');
  };

  const handleLogoutAction = () => {
    addLog(`Cierre de sesión por el usuario ${currentUser?.name || ''}.`);
    onLogout(); // Llama al logout centralizado en App.jsx (que limpia estados y redirige)
  };

  // --- CRUD: Sabores (Helados) ---
  const handleAddFlavorSubmit = (e) => {
    e.preventDefault();
    const sanitizedName = sanitizeHTML(newFlavor.name);
    const sanitizedDesc = sanitizeHTML(newFlavor.description);
    const priceVal = parseFloat(newFlavor.price);
    
    if (!sanitizedName) {
      alert("El nombre del sabor no puede estar vacío.");
      return;
    }
    if (isNaN(priceVal) || priceVal < 0) {
      alert("El precio debe ser un número positivo.");
      return;
    }
    
    const id = sanitizedName.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_');
    const added = { 
      id, 
      name: sanitizedName, 
      price: priceVal, 
      color: newFlavor.color, 
      isPremium: newFlavor.isPremium, 
      description: sanitizedDesc, 
      active: true 
    };
    onUpdateFlavors([...flavors, added]);
    setShowAddFlavor(false);
    addLog(`Sabor creado: ${sanitizedName} por ${currentUser?.name}.`);
    setNewFlavor({ name: '', price: 1.0, color: '#ff6b81', isPremium: false, description: '' });
  };

  const handleEditFlavorSubmit = (e) => {
    e.preventDefault();
    const sanitizedName = sanitizeHTML(editingFlavor.name);
    const sanitizedDesc = sanitizeHTML(editingFlavor.description);
    const priceVal = parseFloat(editingFlavor.price);
    
    if (!sanitizedName) {
      alert("El nombre del sabor no puede estar vacío.");
      return;
    }
    if (isNaN(priceVal) || priceVal < 0) {
      alert("El precio debe ser un número positivo.");
      return;
    }
    
    const updated = flavors.map(f => f.id === editingFlavor.id ? { 
      ...f, 
      name: sanitizedName, 
      price: priceVal, 
      color: editingFlavor.color, 
      isPremium: editingFlavor.isPremium, 
      description: sanitizedDesc,
      active: editingFlavor.active !== false
    } : f);
    onUpdateFlavors(updated);
    addLog(`Sabor modificado: ${sanitizedName} por ${currentUser?.name}.`);
    setEditingFlavor(null);
  };

  const handleDeleteFlavor = (id) => {
    const fName = flavors.find(f => f.id === id)?.name || id;
    if (window.confirm("¿Seguro que deseas eliminar permanentemente este sabor del menú?")) {
      onUpdateFlavors(flavors.filter(f => f.id !== id));
      addLog(`Sabor eliminado: ${fName} por ${currentUser?.name}.`);
    }
  };

  // --- CRUD: Toppings ---
  const handleAddToppingSubmit = (e) => {
    e.preventDefault();
    const sanitizedName = sanitizeHTML(newTopping.name);
    const priceVal = parseFloat(newTopping.price);

    if (!sanitizedName) {
      alert("El nombre del topping no puede estar vacío.");
      return;
    }
    if (isNaN(priceVal) || priceVal < 0) {
      alert("El precio del topping debe ser un número positivo.");
      return;
    }

    const id = sanitizedName.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_');
    const added = { id, name: sanitizedName, price: priceVal, active: true };
    onUpdateToppings([...toppings, added]);
    setShowAddTopping(false);
    addLog(`Topping creado: ${sanitizedName} por ${currentUser?.name}.`);
    setNewTopping({ name: '', price: 0.5 });
  };

  const handleEditToppingSubmit = (e) => {
    e.preventDefault();
    const sanitizedName = sanitizeHTML(editingTopping.name);
    const priceVal = parseFloat(editingTopping.price);

    if (!sanitizedName) {
      alert("El nombre del topping no puede estar vacío.");
      return;
    }
    if (isNaN(priceVal) || priceVal < 0) {
      alert("El precio del topping debe ser un número positivo.");
      return;
    }

    const updated = toppings.map(t => t.id === editingTopping.id ? { 
      ...t, 
      name: sanitizedName, 
      price: priceVal,
      active: editingTopping.active !== false
    } : t);
    onUpdateToppings(updated);
    addLog(`Topping modificado: ${sanitizedName} por ${currentUser?.name}.`);
    setEditingTopping(null);
  };

  const handleDeleteTopping = (id) => {
    const tName = toppings.find(t => t.id === id)?.name || id;
    if (window.confirm("¿Seguro que deseas eliminar este topping?")) {
      onUpdateToppings(toppings.filter(t => t.id !== id));
      addLog(`Topping eliminado: ${tName} por ${currentUser?.name}.`);
    }
  };

  // --- CRUD: Packs (Promos) ---
  const handleAddPackSubmit = (e) => {
    e.preventDefault();
    const sanitizedName = sanitizeHTML(newPack.name);
    const sanitizedDesc = sanitizeHTML(newPack.description);
    const sanitizedItems = sanitizeHTML(newPack.items);
    const sanitizedDiscount = sanitizeHTML(newPack.discountText);
    const sanitizedBadge = sanitizeHTML(newPack.badge);
    const priceVal = parseFloat(newPack.price);

    if (!sanitizedName) {
      alert("El nombre del pack no puede estar vacío.");
      return;
    }
    if (isNaN(priceVal) || priceVal < 0) {
      alert("El precio debe ser un número positivo.");
      return;
    }

    const id = sanitizedName.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_');
    const added = { 
      id, 
      name: sanitizedName, 
      description: sanitizedDesc,
      items: sanitizedItems,
      discountText: sanitizedDiscount,
      badge: sanitizedBadge,
      price: priceVal, 
      active: true 
    };
    onUpdatePacks([...packs, added]);
    setShowAddPack(false);
    addLog(`Combo creado: ${sanitizedName} por ${currentUser?.name}.`);
    setNewPack({ name: '', description: '', price: 10.0, items: '', discountText: '', badge: '' });
  };

  const handleEditPackSubmit = (e) => {
    e.preventDefault();
    const sanitizedName = sanitizeHTML(editingPack.name);
    const sanitizedDesc = sanitizeHTML(editingPack.description);
    const sanitizedItems = sanitizeHTML(editingPack.items);
    const sanitizedDiscount = sanitizeHTML(editingPack.discountText);
    const sanitizedBadge = sanitizeHTML(editingPack.badge);
    const priceVal = parseFloat(editingPack.price);

    if (!sanitizedName) {
      alert("El nombre del pack no puede estar vacío.");
      return;
    }
    if (isNaN(priceVal) || priceVal < 0) {
      alert("El precio debe ser un número positivo.");
      return;
    }

    const updated = packs.map(p => p.id === editingPack.id ? { 
      ...p, 
      name: sanitizedName, 
      description: sanitizedDesc,
      items: sanitizedItems,
      discountText: sanitizedDiscount,
      badge: sanitizedBadge,
      price: priceVal,
      active: editingPack.active !== false
    } : p);
    onUpdatePacks(updated);
    addLog(`Combo modificado: ${sanitizedName} por ${currentUser?.name}.`);
    setEditingPack(null);
  };

  const handleDeletePack = (id) => {
    const pName = packs.find(p => p.id === id)?.name || id;
    if (window.confirm("¿Seguro que deseas eliminar este pack promocional?")) {
      onUpdatePacks(packs.filter(p => p.id !== id));
      addLog(`Combo eliminado: ${pName} por ${currentUser?.name}.`);
    }
  };

  // --- CRUD: Usuarios (Personal) ---
  const handleAddUserSubmit = async (e) => {
    e.preventDefault();
    const sanitizedName = sanitizeHTML(newUser.name);
    const sanitizedEmail = sanitizeHTML(newUser.email).toLowerCase();
    const sanitizedPassword = sanitizeHTML(newUser.password);

    if (!sanitizedName || !sanitizedEmail || !sanitizedPassword) {
      alert("Todos los campos son obligatorios.");
      return;
    }
    if (!isValidEmail(sanitizedEmail)) {
      alert("Por favor ingresa un correo electrónico válido.");
      return;
    }

    if (staffUsers.some(u => u.email.toLowerCase() === sanitizedEmail)) {
      alert("Este correo electrónico ya está registrado.");
      return;
    }

    const added = { 
      name: sanitizedName, 
      email: sanitizedEmail, 
      role: newUser.role, 
      password: sanitizedPassword, 
      status: 'Activo' 
    };

    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('manage_admin_user', {
          p_admin_email: currentUser.email,
          p_admin_password: currentUser.password,
          p_target_email: sanitizedEmail,
          p_username: sanitizedEmail.split('@')[0],
          p_name: sanitizedName,
          p_role: newUser.role,
          p_password: sanitizedPassword,
          p_status: 'Activo',
          p_action: 'upsert'
        });
        if (error) throw error;
      } catch (err) {
        alert("Error al registrar personal en Supabase: " + err.message);
        return;
      }
    }

    onUpdateStaffUsers([...staffUsers, added]);
    setShowAddUser(false);
    addLog(`Personal registrado: ${sanitizedName} (${newUser.role}) por ${currentUser?.name}.`);
    setNewUser({ name: '', email: '', role: 'Vendedor', password: '123' });
  };

  const handleToggleUserStatus = async (email) => {
    if (email === currentUser.email) {
      alert("No puedes suspender tu propia cuenta activa.");
      return;
    }
    const userToToggle = staffUsers.find(u => u.email === email);
    if (!userToToggle) return;
    const nextStatus = userToToggle.status === 'Activo' ? 'Suspendido' : 'Activo';

    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('manage_admin_user', {
          p_admin_email: currentUser.email,
          p_admin_password: currentUser.password,
          p_target_email: email,
          p_username: userToToggle.username,
          p_name: userToToggle.name,
          p_role: userToToggle.role,
          p_status: nextStatus,
          p_action: 'upsert'
        });
        if (error) throw error;
      } catch (err) {
        alert("Error al actualizar estado en Supabase: " + err.message);
        return;
      }
    }

    const updated = staffUsers.map(u => u.email === email ? { ...u, status: nextStatus } : u);
    onUpdateStaffUsers(updated);
    addLog(`Usuario ${userToToggle.name} cambiado a estado ${nextStatus} por ${currentUser?.name}.`);
  };

  const handleDeleteUser = async (email) => {
    if (email === currentUser.email) {
      alert("No puedes eliminar tu propia cuenta activa.");
      return;
    }
    if (window.confirm("¿Seguro que deseas eliminar este usuario del personal?")) {
      if (supabase) {
        try {
          const { data, error } = await supabase.rpc('manage_admin_user', {
            p_admin_email: currentUser.email,
            p_admin_password: currentUser.password,
            p_target_email: email,
            p_action: 'delete'
          });
          if (error) throw error;
        } catch (err) {
          alert("Error al eliminar usuario en Supabase: " + err.message);
          return;
        }
      }
      onUpdateStaffUsers(staffUsers.filter(u => u.email !== email));
      addLog(`Usuario con correo ${email} eliminado por ${currentUser?.name}.`);
    }
  };

  const handleChangePasswordSubmit = async (e) => {
    e.preventDefault();
    const sanitizedPassword = sanitizeHTML(newPasswordForUser);
    if (!sanitizedPassword) {
      alert("La contraseña no puede estar vacía.");
      return;
    }

    const userToToggle = staffUsers.find(u => u.email === editingUserPassword);
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('manage_admin_user', {
          p_admin_email: currentUser.email,
          p_admin_password: currentUser.password,
          p_target_email: editingUserPassword,
          p_username: userToToggle?.username || editingUserPassword.split('@')[0],
          p_name: userToToggle?.name || editingUserPassword.split('@')[0],
          p_role: userToToggle?.role || 'Vendedor',
          p_status: userToToggle?.status || 'Activo',
          p_password: sanitizedPassword,
          p_action: 'upsert'
        });
        if (error) throw error;
      } catch (err) {
        alert("Error al actualizar contraseña en Supabase: " + err.message);
        return;
      }
    }

    const updated = staffUsers.map(u => u.email === editingUserPassword ? { ...u, password: sanitizedPassword } : u);
    onUpdateStaffUsers(updated);
    addLog(`Contraseña de usuario ${editingUserPassword} actualizada por ${currentUser?.name}.`);
    setEditingUserPassword(null);
    setNewPasswordForUser('');
    alert("¡Contraseña actualizada con éxito!");
  };

  // --- CRUD: Bases / Envases ---
  const handleAddBaseSubmit = (e) => {
    e.preventDefault();
    const nameSanitized = sanitizeHTML(newBase.name);
    const descSanitized = sanitizeHTML(newBase.description);
    const iconSanitized = sanitizeHTML(newBase.icon) || '🍨';
    const priceVal = parseFloat(newBase.price) || 0;

    if (!nameSanitized) {
      alert("El nombre de la base/envase no puede estar vacío.");
      return;
    }
    if (isNaN(priceVal) || priceVal < 0) {
      alert("El precio debe ser un número positivo.");
      return;
    }

    const id = nameSanitized.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_');
    const added = { id, name: nameSanitized, price: priceVal, icon: iconSanitized, description: descSanitized, active: true };
    onUpdateBases([...bases, added]);
    setShowAddBase(false);
    addLog(`Base/Envase creado: ${nameSanitized} por ${currentUser?.name}.`);
    setNewBase({ name: '', price: 0.0, icon: '🍨', description: '' });
  };

  const handleEditBaseSubmit = (e) => {
    e.preventDefault();
    const nameSanitized = sanitizeHTML(editingBase.name);
    const descSanitized = sanitizeHTML(editingBase.description);
    const iconSanitized = sanitizeHTML(editingBase.icon) || '🍨';
    const priceVal = parseFloat(editingBase.price) || 0;

    if (!nameSanitized) {
      alert("El nombre no puede estar vacío.");
      return;
    }
    if (isNaN(priceVal) || priceVal < 0) {
      alert("El precio debe ser un número positivo.");
      return;
    }

    const updated = bases.map(b => b.id === editingBase.id ? { 
      ...b, 
      name: nameSanitized, 
      price: priceVal,
      icon: iconSanitized,
      description: descSanitized,
      active: editingBase.active !== false
    } : b);
    onUpdateBases(updated);
    addLog(`Base/Envase modificado: ${nameSanitized} por ${currentUser?.name}.`);
    setEditingBase(null);
  };

  const handleDeleteBase = (id) => {
    const bName = bases.find(b => b.id === id)?.name || id;
    if (window.confirm("¿Seguro que deseas eliminar este envase/base?")) {
      onUpdateBases(bases.filter(b => b.id !== id));
      addLog(`Base/Envase eliminado: ${bName} por ${currentUser?.name}.`);
    }
  };

  const handleAddRecommendationSubmit = (e) => {
    e.preventDefault();
    const nameSanitized = sanitizeHTML(newRec.name);
    if (!nameSanitized) {
      alert("El nombre de la recomendación es obligatorio.");
      return;
    }

    const flavorIds = [];
    if (newRec.flavorId1) flavorIds.push(newRec.flavorId1);
    if (newRec.flavorId2) flavorIds.push(newRec.flavorId2);
    if (newRec.flavorId3) flavorIds.push(newRec.flavorId3);

    if (flavorIds.length === 0) {
      alert("Debes seleccionar al menos 1 sabor para la combinación.");
      return;
    }

    const toppingIds = [];
    if (newRec.toppingId) toppingIds.push(newRec.toppingId);

    const added = {
      id: 'rec_' + Date.now(),
      name: nameSanitized,
      baseId: newRec.baseId,
      flavorIds,
      toppingIds,
      syrupId: newRec.syrupId || null
    };

    onUpdateRecommendations([...recommendations, added]);
    setShowAddRecommendation(false);
    addLog(`Recomendación creada: ${nameSanitized} por ${currentUser?.name}.`);
    setNewRec({ name: '', baseId: 'cono', flavorId1: '', flavorId2: '', flavorId3: '', toppingId: '', syrupId: '' });
  };

  const handleEditRecommendationSubmit = (e) => {
    e.preventDefault();
    const nameSanitized = sanitizeHTML(editRec.name);
    if (!nameSanitized) {
      alert("El nombre de la combinación no puede estar vacío.");
      return;
    }

    const flavorIds = [];
    if (editRec.flavorId1) flavorIds.push(editRec.flavorId1);
    if (editRec.flavorId2) flavorIds.push(editRec.flavorId2);
    if (editRec.flavorId3) flavorIds.push(editRec.flavorId3);

    if (flavorIds.length === 0) {
      alert("Debes seleccionar al menos 1 sabor para la combinación.");
      return;
    }

    const toppingIds = [];
    if (editRec.toppingId) toppingIds.push(editRec.toppingId);

    const updated = recommendations.map(r => r.id === editRec.id ? {
      id: r.id,
      name: nameSanitized,
      baseId: editRec.baseId,
      flavorIds,
      toppingIds,
      syrupId: editRec.syrupId || null
    } : r);

    onUpdateRecommendations(updated);
    setEditingRecommendation(null);
    addLog(`Recomendación modificada: ${nameSanitized} por ${currentUser?.name}.`);
  };

  const handleDeleteRecommendation = (id) => {
    const recName = recommendations.find(r => r.id === id)?.name || id;
    if (window.confirm("¿Seguro que deseas eliminar esta combinación recomendada?")) {
      onUpdateRecommendations(recommendations.filter(r => r.id !== id));
      addLog(`Recomendación eliminada: ${recName} por ${currentUser?.name}.`);
    }
  };

  // --- NUEVO: Exportar Pedidos a Excel (CSV) ---
  const handleExportCSV = () => {
    if (orders.length === 0) {
      alert("No hay pedidos registrados para exportar.");
      return;
    }
    
    let csvContent = "\uFEFF"; // BOM para asegurar caracteres UTF-8 en Excel (acentos y S/.)
    csvContent += "ID Pedido,Fecha,Cliente,WhatsApp,Direccion,Forma Pago,Monto Pedido,Delivery,Monto Total,Estado\n";
    
    orders.forEach(o => {
      const dateStr = new Date(o.date).toLocaleString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      const row = [
        o.id,
        `"${dateStr}"`,
        `"${o.customer.name.replace(/"/g, '""')}"`,
        `"${o.customer.phone}"`,
        `"${o.customer.address.replace(/"/g, '""')}"`,
        o.customer.paymentMethod,
        o.total.toFixed(2),
        o.deliveryFee.toFixed(2),
        o.grandTotal.toFixed(2),
        o.status
      ].join(",");
      csvContent += row + "\n";
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `pedidos_${storeName.toLowerCase().replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addLog(`Base de datos de pedidos exportada a archivo CSV por ${currentUser?.name}.`);
  };

  // --- Reporte de WhatsApp ---
  const todayString = new Date().toDateString();
  const ordersToday = orders.filter(o => o.status !== 'Cancelado' && new Date(o.date).toDateString() === todayString);
  const salesToday = ordersToday.reduce((sum, o) => sum + o.grandTotal, 0);
  const avgTicket = ordersToday.length > 0 ? (salesToday / ordersToday.length) : 0;

  const handleExportSalesReport = () => {
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

  // --- RENDER TAB - PEDIDOS ---
  const renderOrdersTab = () => {
    let filtered = orderFilter === 'all' ? orders : orders.filter(o => o.status === orderFilter);
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(o => 
        o.id.toLowerCase().includes(q) || 
        o.customer.name.toLowerCase().includes(q) || 
        o.customer.phone.includes(q)
      );
    }

    const getStatusStyle = (status) => {
      switch (status) {
        case 'Pendiente': return 'status-pendiente';
        case 'Preparando': return 'status-preparando';
        case 'En camino': return 'status-en_camino';
        case 'Entregado': return 'status-entregado';
        case 'Cancelado': return 'status-cancelado';
        default: return '';
      }
    };

    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', flexWrap: 'wrap', gap: '10px' }}>
          <h3>Control de Pedidos ({filtered.length})</h3>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '0.8rem' }} onClick={handleExportCSV}>
              📥 Descargar Excel (CSV)
            </button>
            <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '0.8rem' }} onClick={handleExportSalesReport}>
              💬 Enviar Reporte
            </button>
          </div>
        </div>

        <div style={{ marginBottom: '15px' }}>
          <input
            type="text"
            className="form-control"
            placeholder="🔍 Buscar por ID de pedido o nombre de cliente..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', gap: '5px', overflowX: 'auto', paddingBottom: '6px', marginBottom: '15px' }}>
          {['all', 'Pendiente', 'Preparando', 'En camino', 'Entregado', 'Cancelado'].map(f => (
            <button
              key={f}
              className={`filter-btn ${orderFilter === f ? 'active' : ''}`}
              onClick={() => setOrderFilter(f)}
              style={{ fontSize: '0.75rem', padding: '5px 10px', whiteSpace: 'nowrap' }}
            >
              {f === 'all' ? 'Todos' : f}
            </button>
          ))}
        </div>

        <div className="glass admin-table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Pedido</th>
                <th>Cliente</th>
                <th>Monto</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center', color: 'var(--text-light)', padding: '20px' }}>
                    No se encontraron pedidos.
                  </td>
                </tr>
              ) : (
                filtered.map(order => (
                  <tr key={order.id}>
                    <td>
                      <strong>{order.id}</strong>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-light)' }}>
                        {new Date(order.date).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{order.customer.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>{order.customer.address}</div>
                    </td>
                    <td>
                      <strong style={{ color: 'var(--primary-color)', fontSize: '0.9rem' }}>S/. {order.grandTotal.toFixed(2)}</strong>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {order.status === 'Pendiente' && (
                          <button className="admin-action-btn" style={{ color: 'var(--info)' }} onClick={() => { onUpdateOrderStatus(order.id, 'Preparando'); addLog(`Pedido ${order.id} marcado como 'Preparando' por ${currentUser?.name}`); }}>
                            🍳 Servir
                          </button>
                        )}
                        {order.status === 'Preparando' && (
                          <button className="admin-action-btn" style={{ color: 'var(--secondary-color)' }} onClick={() => { onUpdateOrderStatus(order.id, 'En camino'); addLog(`Pedido ${order.id} marcado como 'En camino' por ${currentUser?.name}`); }}>
                            🛵 Enviar
                          </button>
                        )}
                        {order.status === 'En camino' && (
                          <button className="admin-action-btn" style={{ color: 'var(--success)' }} onClick={() => { onUpdateOrderStatus(order.id, 'Entregado'); addLog(`Pedido ${order.id} marcado como 'Entregado' por ${currentUser?.name}`); }}>
                            ✅ Entregado
                          </button>
                        )}
                        {order.status !== 'Entregado' && order.status !== 'Cancelado' && (
                          <button className="admin-action-btn" style={{ color: 'var(--danger)' }} onClick={() => { onUpdateOrderStatus(order.id, 'Cancelado'); addLog(`Pedido ${order.id} CANCELADO por ${currentUser?.name}`); }}>
                            ✕
                          </button>
                        )}
                        <a 
                          href={`https://wa.me/${order.customer.phone.replace(/\D/g, '')}`} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="admin-action-btn" 
                          style={{ textDecoration: 'none', color: '#25D366', textAlign: 'center' }}
                        >
                          💬 Chat
                        </a>
                        <button
                          type="button"
                          className="admin-action-btn"
                          style={{ color: '#e58e26' }}
                          title="Imprimir ticket de comanda para la cocina"
                          onClick={() => {
                            const printWindow = window.open('', '_blank');
                            const dateStr = new Date(order.date).toLocaleString('es-PE', { 
                              day: '2-digit', month: '2-digit', year: 'numeric', 
                              hour: '2-digit', minute: '2-digit', second: '2-digit' 
                            });
                            
                            const itemsHtml = order.items.map((item, idx) => {
                              if (item.type === 'custom') {
                                const scoopsStr = item.scoops ? item.scoops.map(s => s.name).join(', ') : 'Ninguno';
                                const toppingsStr = item.toppings && item.toppings.length > 0 ? item.toppings.map(t => t.name).join(', ') : 'Ninguno';
                                const syrupStr = item.syrup ? item.syrup.name : 'Ninguna';
                                return `
                                  <div style="border-bottom: 1px dashed #333; padding: 8px 0;">
                                    <div style="font-size: 1.15rem; font-weight: bold;">[${idx + 1}] HELADO PERSONALIZADO x ${item.quantity || 1}</div>
                                    <div style="margin-left: 10px; font-size: 0.95rem; line-height: 1.3;">
                                      • <b>Base:</b> ${item.base ? item.base.name : 'No especificada'}<br/>
                                      • <b>Sabores:</b> ${scoopsStr}<br/>
                                      • <b>Toppings:</b> ${toppingsStr}<br/>
                                      • <b>Salsa:</b> ${syrupStr}
                                    </div>
                                  </div>
                                `;
                              } else {
                                return `
                                  <div style="border-bottom: 1px dashed #333; padding: 8px 0;">
                                    <div style="font-size: 1.15rem; font-weight: bold;">[${idx + 1}] COMBO/PACK x ${item.quantity || 1}</div>
                                    <div style="margin-left: 10px; font-size: 0.95rem; line-height: 1.3;">
                                      • <b>Nombre:</b> ${item.name}<br/>
                                      • <b>Contenido:</b> ${item.items || 'Pack promocional'}
                                    </div>
                                  </div>
                                `;
                              }
                            }).join('');

                            printWindow.document.write(`
                              <html>
                                <head>
                                  <title>Comanda Cocina - ${order.id}</title>
                                  <style>
                                    @page { size: 80px auto; margin: 0; }
                                    body { 
                                      font-family: 'Courier New', Courier, monospace; 
                                      width: 280px; 
                                      margin: 0 auto; 
                                      padding: 10px; 
                                      color: #000;
                                      background: #fff;
                                      font-size: 12px;
                                    }
                                    .header { text-align: center; border-bottom: 2px double #000; padding-bottom: 8px; margin-bottom: 10px; }
                                    .title { font-size: 1.5rem; font-weight: bold; margin: 5px 0; }
                                    .section-title { font-size: 1rem; font-weight: bold; border-bottom: 1px solid #000; padding: 4px 0; margin-top: 10px; }
                                    .footer { text-align: center; margin-top: 20px; border-top: 1px dashed #000; padding-top: 10px; font-size: 0.75rem; }
                                  </style>
                                </head>
                                <body>
                                  <div class="header">
                                    <div style="font-size: 1.1rem; font-weight: bold;">🍦 ${storeName.toUpperCase()} 🍦</div>
                                    <div class="title">${order.id}</div>
                                    <div style="font-size: 0.8rem;">Fecha: ${dateStr}</div>
                                  </div>

                                  <div style="margin-bottom: 10px; font-size: 0.9rem;">
                                    <b>Cliente:</b> ${order.customer.name}<br/>
                                    <b>Teléfono:</b> ${order.customer.phone}<br/>
                                    <b>Tipo Pago:</b> ${order.customer.paymentMethod || 'Yape/Plin'}<br/>
                                    <b>Dirección:</b> ${order.customer.address}
                                  </div>

                                  <div class="section-title">🍨 DETALLE DE PREPARACIÓN 🍨</div>
                                  <div style="margin-top: 5px;">
                                    ${itemsHtml}
                                  </div>

                                  <div class="footer">
                                    <div style="font-weight: bold; font-size: 0.9rem;">⚠️ ¡ATENCIÓN COCINA!</div>
                                    <div style="margin-top: 4px;">Mantener cadena de frío de las cremas. Preparar con higiene extrema.</div>
                                    <div style="margin-top: 10px; font-size: 0.7rem;">Impreso desde Panel Don Helado.</div>
                                  </div>
                                  
                                  <script>
                                    window.onload = function() {
                                      window.print();
                                      setTimeout(() => { window.close(); }, 500);
                                    }
                                  </script>
                                </body>
                              </html>
                            `);
                            printWindow.document.close();
                            addLog(`Comanda de Cocina impresa para el pedido ${order.id}.`);
                          }}
                        >
                          🖨️ Ticket
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // --- RENDER TAB - CARTA HELADA (SABORES Y INVENTARIO) ---
  const renderInventoryTab = () => {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        <div className="glass" style={{ padding: '15px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <h4 style={{ fontSize: '1.05rem' }}>Carta de Sabores</h4>
            <button className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '0.75rem' }} onClick={() => { setEditingFlavor(null); setShowAddFlavor(!showAddFlavor); }}>
              {showAddFlavor ? 'Cerrar' : '➕ Nuevo Sabor'}
            </button>
          </div>

          {/* Crear */}
          {showAddFlavor && (
            <form onSubmit={handleAddFlavorSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px', background: 'rgba(0,0,0,0.02)', padding: '12px', borderRadius: '8px' }}>
              <div className="form-group"><label>Nombre Sabor</label><input type="text" className="form-control" value={newFlavor.name} onChange={(e) => setNewFlavor({ ...newFlavor, name: e.target.value })} required /></div>
              <div className="form-group"><label>Precio S/.</label><input type="number" step="0.10" className="form-control" value={newFlavor.price} onChange={(e) => setNewFlavor({ ...newFlavor, price: e.target.value })} required /></div>
              <div className="form-group"><label>Color Hex</label><input type="color" className="form-control" value={newFlavor.color} onChange={(e) => setNewFlavor({ ...newFlavor, color: e.target.value })} /></div>
              <div className="form-group">
                <label>Categoría</label>
                <select className="form-control" value={newFlavor.isPremium} onChange={(e) => setNewFlavor({ ...newFlavor, isPremium: e.target.value === 'true' })}>
                  <option value="false">Clásico (S/. 1.00)</option><option value="true">Premium (S/. 1.50)</option>
                </select>
              </div>
              <div className="form-group" style={{ gridColumn: 'span 2' }}><label>Descripción</label><input type="text" className="form-control" value={newFlavor.description} onChange={(e) => setNewFlavor({ ...newFlavor, description: e.target.value })} /></div>
              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', gridColumn: 'span 2', margin: '5px 0' }}>
                <label className="toggle-switch" style={{ transform: 'scale(0.8)' }}>
                  <input type="checkbox" checked={newFlavor.isPopular || false} onChange={(e) => setNewFlavor({ ...newFlavor, isPopular: e.target.checked })} />
                  <span className="slider"></span>
                </label>
                <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>🔥 Destacar como Producto Más Vendido / Popular</span>
              </div>
              <button type="submit" className="btn btn-primary" style={{ gridColumn: 'span 2', padding: '6px' }}>Guardar</button>
            </form>
          )}

          {/* Editar */}
          {editingFlavor && (
            <form onSubmit={handleEditFlavorSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px', background: 'rgba(229, 142, 38, 0.05)', padding: '12px', borderRadius: '8px', border: '1px solid var(--secondary-color)' }}>
              <div className="form-group" style={{ gridColumn: 'span 2' }}><strong>Editar Sabor: {editingFlavor.name}</strong></div>
              <div className="form-group"><label>Nombre</label><input type="text" className="form-control" value={editingFlavor.name} onChange={(e) => setEditingFlavor({ ...editingFlavor, name: e.target.value })} required /></div>
              <div className="form-group"><label>Precio S/.</label><input type="number" step="0.10" className="form-control" value={editingFlavor.price} onChange={(e) => setEditingFlavor({ ...editingFlavor, price: e.target.value })} required /></div>
              <div className="form-group"><label>Color</label><input type="color" className="form-control" value={editingFlavor.color} onChange={(e) => setEditingFlavor({ ...editingFlavor, color: e.target.value })} /></div>
              <div className="form-group">
                <label>Categoría</label>
                <select className="form-control" value={editingFlavor.isPremium} onChange={(e) => setEditingFlavor({ ...editingFlavor, isPremium: e.target.value === 'true' })}>
                  <option value="false">Clásico</option><option value="true">Premium</option>
                </select>
              </div>
              <div className="form-group" style={{ gridColumn: 'span 2' }}><label>Descripción</label><input type="text" className="form-control" value={editingFlavor.description} onChange={(e) => setEditingFlavor({ ...editingFlavor, description: e.target.value })} /></div>
              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', gridColumn: 'span 2', margin: '5px 0' }}>
                <label className="toggle-switch" style={{ transform: 'scale(0.8)' }}>
                  <input type="checkbox" checked={editingFlavor.isPopular || false} onChange={(e) => setEditingFlavor({ ...editingFlavor, isPopular: e.target.checked })} />
                  <span className="slider"></span>
                </label>
                <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>🔥 Destacar como Producto Más Vendido / Popular</span>
              </div>
              <div style={{ gridColumn: 'span 2', display: 'flex', gap: '8px' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1, padding: '6px' }}>Guardar Cambios</button>
                <button type="button" className="btn btn-secondary" style={{ flex: 1, padding: '6px' }} onClick={() => setEditingFlavor(null)}>Cancelar</button>
              </div>
            </form>
          )}

          <div className="admin-table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Sabor</th>
                  <th>Precio</th>
                  <th>Estado</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {flavors.map(f => (
                  <tr key={f.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: f.color }}></span>
                        <strong style={{ fontSize: '0.85rem' }}>{f.name}</strong>
                      </div>
                    </td>
                    <td style={{ fontSize: '0.85rem' }}>S/. {f.price.toFixed(2)}</td>
                    <td>
                      <label className="toggle-switch" style={{ transform: 'scale(0.8)', margin: '0 auto', display: 'block', width: 'fit-content' }}>
                        <input 
                          type="checkbox" 
                          checked={f.active !== false} 
                          onChange={() => {
                            const nextState = f.active === false ? true : false;
                            const updated = flavors.map(item => item.id === f.id ? { ...item, active: nextState } : item);
                            onUpdateFlavors(updated);
                            addLog(`Stock: Sabor ${f.name} marcado como ${nextState ? 'Disponible' : 'Agotado'}.`);
                          }} 
                        />
                        <span className="slider"></span>
                      </label>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button className="admin-action-btn" onClick={() => { setEditingFlavor(f); setShowAddFlavor(false); }}>✏️</button>
                        <button className="admin-action-btn" style={{ color: 'var(--danger)' }} onClick={() => handleDeleteFlavor(f.id)}>🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Toppings */}
        <div className="glass" style={{ padding: '15px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <h4 style={{ fontSize: '1.05rem' }}>Gestión de Toppings y Salsas</h4>
            <button className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '0.75rem' }} onClick={() => { setEditingTopping(null); setShowAddTopping(!showAddTopping); }}>
              {showAddTopping ? 'Cerrar' : '➕ Nuevo Topping'}
            </button>
          </div>

          {showAddTopping && (
            <form onSubmit={handleAddToppingSubmit} style={{ display: 'flex', gap: '10px', marginBottom: '15px', background: 'rgba(0,0,0,0.02)', padding: '12px', borderRadius: '8px' }}>
              <input type="text" className="form-control" placeholder="Nombre" value={newTopping.name} onChange={(e) => setNewTopping({ ...newTopping, name: e.target.value })} required />
              <input type="number" step="0.10" className="form-control" placeholder="Precio" value={newTopping.price} onChange={(e) => setNewTopping({ ...newTopping, price: e.target.value })} required />
              <button type="submit" className="btn btn-primary" style={{ padding: '6px 12px' }}>Agregar</button>
            </form>
          )}

          {editingTopping && (
            <form onSubmit={handleEditToppingSubmit} style={{ display: 'flex', gap: '10px', marginBottom: '15px', background: 'rgba(229, 142, 38, 0.05)', padding: '12px', borderRadius: '8px', border: '1px solid var(--secondary-color)' }}>
              <input type="text" className="form-control" value={editingTopping.name} onChange={(e) => setEditingTopping({ ...editingTopping, name: e.target.value })} required />
              <input type="number" step="0.10" className="form-control" value={editingTopping.price} onChange={(e) => setEditingTopping({ ...editingTopping, price: e.target.value })} required />
              <button type="submit" className="btn btn-primary" style={{ padding: '6px 12px' }}>Editar</button>
              <button type="button" className="btn btn-secondary" style={{ padding: '6px 12px' }} onClick={() => setEditingTopping(null)}>✕</button>
            </form>
          )}

          <div className="admin-table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Topping / Salsa</th>
                  <th>Precio</th>
                  <th>Estado</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {toppings.map(t => (
                  <tr key={t.id}>
                    <td>
                      <strong style={{ fontSize: '0.85rem' }}>{t.name}</strong>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-light)', display: 'block' }}>{t.category === 'liquido' ? 'Liquid / Jarabe' : 'Solid / Topping'}</span>
                    </td>
                    <td style={{ fontSize: '0.85rem' }}>S/. {t.price.toFixed(2)}</td>
                    <td>
                      <label className="toggle-switch" style={{ transform: 'scale(0.8)', margin: '0 auto', display: 'block', width: 'fit-content' }}>
                        <input 
                          type="checkbox" 
                          checked={t.active !== false} 
                          onChange={() => {
                            const nextState = t.active === false ? true : false;
                            const updated = toppings.map(item => item.id === t.id ? { ...item, active: nextState } : item);
                            onUpdateToppings(updated);
                            addLog(`Stock: Topping ${t.name} marcado como ${nextState ? 'Disponible' : 'Agotado'}.`);
                          }} 
                        />
                        <span className="slider"></span>
                      </label>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button className="admin-action-btn" onClick={() => { setEditingTopping(t); setShowAddTopping(false); }}>✏️</button>
                        <button className="admin-action-btn" style={{ color: 'var(--danger)' }} onClick={() => handleDeleteTopping(t.id)}>🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Envases / Bases */}
        <div className="glass" style={{ padding: '15px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <h4 style={{ fontSize: '1.05rem' }}>Disponibilidad de Envases (Bases)</h4>
            <button className="btn btn-primary" type="button" style={{ padding: '6px 12px', fontSize: '0.75rem' }} onClick={() => { setEditingBase(null); setShowAddBase(!showAddBase); }}>
              {showAddBase ? 'Cerrar' : '➕ Nuevo Envase'}
            </button>
          </div>

          {showAddBase && (
            <form onSubmit={handleAddBaseSubmit} style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '10px', marginBottom: '15px', background: 'rgba(0,0,0,0.02)', padding: '12px', borderRadius: '8px' }}>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label>Nombre del Envase</label>
                <input type="text" className="form-control" placeholder="Ej: Vaso de Vidrio Premium" value={newBase.name} onChange={(e) => setNewBase({ ...newBase, name: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Precio Adicional S/.</label>
                <input type="number" step="0.10" className="form-control" value={newBase.price} onChange={(e) => setNewBase({ ...newBase, price: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Emoji Icono</label>
                <input type="text" className="form-control" placeholder="Ej: 🍨" value={newBase.icon} onChange={(e) => setNewBase({ ...newBase, icon: e.target.value })} required />
              </div>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label>Descripción</label>
                <input type="text" className="form-control" placeholder="Ej: Copa de vidrio de alta resistencia" value={newBase.description} onChange={(e) => setNewBase({ ...newBase, description: e.target.value })} />
              </div>
              <button type="submit" className="btn btn-primary" style={{ gridColumn: 'span 2', padding: '6px' }}>Agregar Envase</button>
            </form>
          )}

          {editingBase && (
            <form onSubmit={handleEditBaseSubmit} style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '10px', marginBottom: '15px', background: 'rgba(229, 142, 38, 0.05)', padding: '12px', borderRadius: '8px', border: '1px solid var(--secondary-color)' }}>
              <div className="form-group" style={{ gridColumn: 'span 2' }}><strong>Editar Envase: {editingBase.name}</strong></div>
              <div className="form-group">
                <label>Nombre del Envase</label>
                <input type="text" className="form-control" value={editingBase.name} onChange={(e) => setEditingBase({ ...editingBase, name: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Precio Adicional S/.</label>
                <input type="number" step="0.10" className="form-control" value={editingBase.price} onChange={(e) => setEditingBase({ ...editingBase, price: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Emoji Icono</label>
                <input type="text" className="form-control" value={editingBase.icon} onChange={(e) => setEditingBase({ ...editingBase, icon: e.target.value })} required />
              </div>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label>Descripción</label>
                <input type="text" className="form-control" value={editingBase.description} onChange={(e) => setEditingBase({ ...editingBase, description: e.target.value })} />
              </div>
              <div style={{ gridColumn: 'span 2', display: 'flex', gap: '8px' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1, padding: '6px' }}>Guardar Cambios</button>
                <button type="button" className="btn btn-secondary" style={{ flex: 1, padding: '6px' }} onClick={() => setEditingBase(null)}>Cancelar</button>
              </div>
            </form>
          )}

          <div className="admin-table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Envase</th>
                  <th>Costo Adicional</th>
                  <th>Estado</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {bases.map(b => (
                  <tr key={b.id}>
                    <td>
                      <span style={{ fontSize: '1.2rem', marginRight: '6px' }}>{b.icon}</span>
                      <strong style={{ fontSize: '0.85rem' }}>{b.name}</strong>
                      {b.description && <span style={{ fontSize: '0.7rem', color: 'var(--text-light)', display: 'block' }}>{b.description}</span>}
                    </td>
                    <td style={{ fontSize: '0.85rem' }}>
                      {b.price === 0 ? 'Sin costo' : `S/. ${b.price.toFixed(2)}`}
                    </td>
                    <td>
                      <label className="toggle-switch" style={{ transform: 'scale(0.8)', margin: '0 auto', display: 'block', width: 'fit-content' }}>
                        <input 
                          type="checkbox" 
                          checked={b.active !== false} 
                          onChange={() => {
                            const nextState = b.active === false ? true : false;
                            const updated = bases.map(item => item.id === b.id ? { ...item, active: nextState } : item);
                            onUpdateBases(updated);
                            addLog(`Stock: Envase ${b.name} marcado como ${nextState ? 'Disponible' : 'Agotado'}.`);
                          }} 
                        />
                        <span className="slider"></span>
                      </label>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button className="admin-action-btn" onClick={() => { setEditingBase(b); setShowAddBase(false); }}>✏️</button>
                        <button className="admin-action-btn" style={{ color: 'var(--danger)' }} onClick={() => handleDeleteBase(b.id)}>🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ⭐ Combinaciones Recomendadas */}
        <div className="glass" style={{ padding: '15px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <h4 style={{ fontSize: '1.05rem' }}>⭐ Combinaciones Recomendadas del Menú</h4>
            <button className="btn btn-primary" type="button" style={{ padding: '6px 12px', fontSize: '0.75rem' }} onClick={() => { setEditingRecommendation(null); setShowAddRecommendation(!showAddRecommendation); }}>
              {showAddRecommendation ? 'Cerrar' : '➕ Nueva Recomendación'}
            </button>
          </div>

          {showAddRecommendation && (
            <form onSubmit={handleAddRecommendationSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px', background: 'rgba(0,0,0,0.02)', padding: '12px', borderRadius: '8px' }}>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label>Nombre de la Combinación</label>
                <input type="text" className="form-control" placeholder="Ej: 🍧 Explosión Frutal o 🍫 Triple Choc" value={newRec.name} onChange={(e) => setNewRec({ ...newRec, name: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Base / Envase</label>
                <select className="form-control" value={newRec.baseId} onChange={(e) => setNewRec({ ...newRec, baseId: e.target.value })}>
                  {bases.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Sabor de Helado 1</label>
                <select className="form-control" value={newRec.flavorId1} onChange={(e) => setNewRec({ ...newRec, flavorId1: e.target.value })} required>
                  <option value="">-- Seleccionar --</option>
                  {flavors.map(f => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Sabor de Helado 2 (Opcional)</label>
                <select className="form-control" value={newRec.flavorId2} onChange={(e) => setNewRec({ ...newRec, flavorId2: e.target.value })}>
                  <option value="">-- Ninguno --</option>
                  {flavors.map(f => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Sabor de Helado 3 (Opcional)</label>
                <select className="form-control" value={newRec.flavorId3} onChange={(e) => setNewRec({ ...newRec, flavorId3: e.target.value })}>
                  <option value="">-- Ninguno --</option>
                  {flavors.map(f => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Topping / Cobertura (Opcional)</label>
                <select className="form-control" value={newRec.toppingId} onChange={(e) => setNewRec({ ...newRec, toppingId: e.target.value })}>
                  <option value="">-- Ninguno --</option>
                  {toppings.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Salsa / Jarabe (Opcional)</label>
                <select className="form-control" value={newRec.syrupId} onChange={(e) => setNewRec({ ...newRec, syrupId: e.target.value })}>
                  <option value="">-- Ninguno --</option>
                  <option value="fudge">Fudge de Chocolate</option>
                  <option value="fresa">Salsa de Fresa</option>
                  <option value="manjar">Manjar Blanco</option>
                </select>
              </div>
              <button type="submit" className="btn btn-primary" style={{ gridColumn: 'span 2', padding: '8px' }}>Guardar Combinación Recomendada</button>
            </form>
          )}

          {editingRecommendation && (
            <form onSubmit={handleEditRecommendationSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px', background: 'rgba(230, 240, 255, 0.3)', border: '1px solid rgba(0, 100, 250, 0.1)', padding: '12px', borderRadius: '8px' }}>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label><strong>✏️ Editar Combinación: {editingRecommendation.name}</strong></label>
                <input type="text" className="form-control" placeholder="Ej: 🍧 Explosión Frutal o 🍫 Triple Choc" value={editRec.name} onChange={(e) => setEditRec({ ...editRec, name: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Base / Envase</label>
                <select className="form-control" value={editRec.baseId} onChange={(e) => setEditRec({ ...editRec, baseId: e.target.value })}>
                  {bases.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Sabor de Helado 1</label>
                <select className="form-control" value={editRec.flavorId1} onChange={(e) => setEditRec({ ...editRec, flavorId1: e.target.value })} required>
                  <option value="">-- Seleccionar --</option>
                  {flavors.map(f => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Sabor de Helado 2 (Opcional)</label>
                <select className="form-control" value={editRec.flavorId2} onChange={(e) => setEditRec({ ...editRec, flavorId2: e.target.value })}>
                  <option value="">-- Ninguno --</option>
                  {flavors.map(f => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Sabor de Helado 3 (Opcional)</label>
                <select className="form-control" value={editRec.flavorId3} onChange={(e) => setEditRec({ ...editRec, flavorId3: e.target.value })}>
                  <option value="">-- Ninguno --</option>
                  {flavors.map(f => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Topping / Cobertura (Opcional)</label>
                <select className="form-control" value={editRec.toppingId} onChange={(e) => setEditRec({ ...editRec, toppingId: e.target.value })}>
                  <option value="">-- Ninguno --</option>
                  {toppings.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Salsa / Jarabe (Opcional)</label>
                <select className="form-control" value={editRec.syrupId} onChange={(e) => setEditRec({ ...editRec, syrupId: e.target.value })}>
                  <option value="">-- Ninguno --</option>
                  <option value="fudge">Fudge de Chocolate</option>
                  <option value="fresa">Salsa de Fresa</option>
                  <option value="manjar">Manjar Blanco</option>
                </select>
              </div>
              <div style={{ gridColumn: 'span 2', display: 'flex', gap: '8px' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1, padding: '8px' }}>Actualizar Combinación</button>
                <button type="button" className="btn btn-secondary" style={{ padding: '8px 15px' }} onClick={() => setEditingRecommendation(null)}>Cancelar</button>
              </div>
            </form>
          )}

          <div className="admin-table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Combinación</th>
                  <th>Detalle Creado</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {recommendations.length === 0 ? (
                  <tr>
                    <td colSpan="3" style={{ textAlign: 'center', color: 'var(--text-light)', padding: '15px' }}>No hay combinaciones recomendadas.</td>
                  </tr>
                ) : (
                  recommendations.map(rec => {
                    const baseName = bases.find(b => b.id === rec.baseId)?.name.split(' ')[0] || rec.baseId;
                    const flavorNames = rec.flavorIds.map(fid => flavors.find(f => f.id === fid)?.name || fid).join(' + ');
                    const toppingNames = rec.toppingIds && rec.toppingIds.length > 0 ? rec.toppingIds.map(tid => toppings.find(t => t.id === tid)?.name || tid).join(', ') : 'Ninguno';
                    const syrupName = rec.syrupId ? (rec.syrupId === 'fudge' ? 'Fudge' : rec.syrupId === 'fresa' ? 'Fresa' : 'Manjar') : 'Ninguna';
                    return (
                      <tr key={rec.id}>
                        <td><strong style={{ fontSize: '0.85rem' }}>{rec.name}</strong></td>
                        <td style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>
                          {baseName} | {flavorNames} | Topping: {toppingNames} | Salsa: {syrupName}
                        </td>
                        <td>
                          <button className="admin-action-btn" style={{ color: 'var(--primary-color)', marginRight: '8px' }} onClick={() => {
                            setEditingRecommendation(rec);
                            setShowAddRecommendation(false);
                            setEditRec({
                              id: rec.id,
                              name: rec.name,
                              baseId: rec.baseId,
                              flavorId1: rec.flavorIds[0] || '',
                              flavorId2: rec.flavorIds[1] || '',
                              flavorId3: rec.flavorIds[2] || '',
                              toppingId: rec.toppingIds ? rec.toppingIds[0] || '' : '',
                              syrupId: rec.syrupId || ''
                            });
                          }}>✏️</button>
                          <button className="admin-action-btn" style={{ color: 'var(--danger)' }} onClick={() => handleDeleteRecommendation(rec.id)}>🗑️</button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    );
  };

  // --- RENDER TAB - COMBOS ---
  const renderPacksTab = () => {
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h3>Combos y Promociones</h3>
          <button className="btn btn-primary" style={{ padding: '8px 14px', fontSize: '0.8rem' }} onClick={() => { setEditingPack(null); setShowAddPack(!showAddPack); }}>
            {showAddPack ? 'Cerrar' : '➕ Nuevo Pack'}
          </button>
        </div>

        {showAddPack && (
          <form onSubmit={handleAddPackSubmit} className="glass" style={{ padding: '15px', marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div className="form-group"><label>Nombre del Pack</label><input type="text" className="form-control" value={newPack.name} onChange={(e) => setNewPack({ ...newPack, name: e.target.value })} required /></div>
            <div className="form-group"><label>Precio Combo S/.</label><input type="number" step="0.50" className="form-control" value={newPack.price} onChange={(e) => setNewPack({ ...newPack, price: e.target.value })} required /></div>
            <div className="form-group"><label>Descripción</label><input type="text" className="form-control" value={newPack.description} onChange={(e) => setNewPack({ ...newPack, description: e.target.value })} required /></div>
            <div className="form-group"><label>Artículos que incluye</label><input type="text" className="form-control" value={newPack.items} onChange={(e) => setNewPack({ ...newPack, items: e.target.value })} required /></div>
            <div className="form-group"><label>Mensaje de Ahorro</label><input type="text" className="form-control" value={newPack.discountText} onChange={(e) => setNewPack({ ...newPack, discountText: e.target.value })} /></div>
            <div className="form-group"><label>Etiqueta / Badge</label><input type="text" className="form-control" value={newPack.badge} onChange={(e) => setNewPack({ ...newPack, badge: e.target.value })} /></div>
            <button type="submit" className="btn btn-primary" style={{ padding: '8px' }}>Guardar Pack</button>
          </form>
        )}

        {editingPack && (
          <form onSubmit={handleEditPackSubmit} className="glass" style={{ padding: '15px', marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '10px', border: '1px solid var(--secondary-color)' }}>
            <strong>Editar Pack: {editingPack.name}</strong>
            <div className="form-group"><label>Nombre</label><input type="text" className="form-control" value={editingPack.name} onChange={(e) => setEditingPack({ ...editingPack, name: e.target.value })} required /></div>
            <div className="form-group"><label>Precio S/.</label><input type="number" step="0.50" className="form-control" value={editingPack.price} onChange={(e) => setEditingPack({ ...editingPack, price: e.target.value })} required /></div>
            <div className="form-group"><label>Descripción</label><input type="text" className="form-control" value={editingPack.description} onChange={(e) => setEditingPack({ ...editingPack, description: e.target.value })} required /></div>
            <div className="form-group"><label>Incluye</label><input type="text" className="form-control" value={editingPack.items} onChange={(e) => setEditingPack({ ...editingPack, items: e.target.value })} required /></div>
            <div className="form-group"><label>Mensaje Ahorro</label><input type="text" className="form-control" value={editingPack.discountText} onChange={(e) => setEditingPack({ ...editingPack, discountText: e.target.value })} /></div>
            <div className="form-group"><label>Etiqueta</label><input type="text" className="form-control" value={editingPack.badge} onChange={(e) => setEditingPack({ ...editingPack, badge: e.target.value })} /></div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="submit" className="btn btn-primary" style={{ flex: 1, padding: '8px' }}>Guardar Cambios</button>
              <button type="button" className="btn btn-secondary" style={{ flex: 1, padding: '8px' }} onClick={() => setEditingPack(null)}>Cancelar</button>
            </div>
          </form>
        )}

        <div className="glass admin-table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Combo</th>
                <th>Precio</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {packs.map(p => (
                <tr key={p.id}>
                  <td>
                    <div style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>{p.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>{p.items}</div>
                  </td>
                  <td style={{ fontSize: '0.85rem', fontWeight: 600 }}>S/. {p.price.toFixed(2)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button className="admin-action-btn" onClick={() => { setEditingPack(p); setShowAddPack(false); }}>✏️</button>
                      <button className="admin-action-btn" style={{ color: 'var(--danger)' }} onClick={() => handleDeletePack(p.id)}>🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // --- RENDER TAB: GESTIÓN DE COLABORADORES (CREAR, EDITAR, SUSPENDER, CLAVE) ---
  const renderUsersTab = () => {
    // FIX: Siempre mostrar las herramientas de personal si el rol actual es Administrador
    if (currentUser && currentUser.role !== 'Administrador') {
      return (
        <div className="glass" style={{ padding: '20px', color: 'var(--danger)' }}>
          ⚠️ Acceso Denegado. Solo el Administrador Principal puede gestionar el personal de trabajo.
        </div>
      );
    }

    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h3>👥 Gestión de Personal (Colaboradores)</h3>
          <button className="btn btn-primary" style={{ padding: '8px 14px', fontSize: '0.8rem' }} onClick={() => setShowAddUser(!showAddUser)}>
            {showAddUser ? 'Ocultar Formulario' : '➕ Registrar Nuevo Colaborador'}
          </button>
        </div>

        {/* Formulario Crear */}
        {showAddUser && (
          <form onSubmit={handleAddUserSubmit} className="glass" style={{ padding: '15px', marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div className="form-group"><label>Nombre</label><input type="text" className="form-control" value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} required /></div>
            <div className="form-group"><label>Correo Electrónico (Login)</label><input type="email" className="form-control" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} required /></div>
            <div className="form-group">
              <label>Rol de Trabajo</label>
              <select className="form-control" value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}>
                <option value="Administrador">Administrador</option>
                <option value="Vendedor">Vendedor</option>
                <option value="Cocina">Cocina / Preparador</option>
              </select>
            </div>
            <div className="form-group"><label>Contraseña</label><input type="password" className="form-control" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} required /></div>
            <button type="submit" className="btn btn-primary" style={{ padding: '8px' }}>Guardar e Inscribir</button>
          </form>
        )}

        {/* Cambiar Clave */}
        {editingUserPassword && (
          <form onSubmit={handleChangePasswordSubmit} className="glass" style={{ padding: '15px', marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '10px', border: '1px solid var(--primary-color)' }}>
            <strong>Cambiar contraseña de: {editingUserPassword}</strong>
            <div className="form-group">
              <label>Nueva Clave de Acceso</label>
              <input type="password" className="form-control" value={newPasswordForUser} onChange={(e) => setNewPasswordForUser(e.target.value)} required />
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="submit" className="btn btn-primary" style={{ flex: 1, padding: '6px' }}>Actualizar Contraseña</button>
              <button type="button" className="btn btn-secondary" style={{ flex: 1, padding: '6px' }} onClick={() => setEditingUserPassword(null)}>Cancelar</button>
            </div>
          </form>
        )}

        <div className="glass admin-table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Colaborador</th>
                <th>Rol</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {staffUsers.map(user => (
                <tr key={user.email}>
                  <td>
                    <div style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>{user.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>{user.email}</div>
                  </td>
                  <td>
                    <span style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>{user.role}</span>
                  </td>
                  <td>
                    <button 
                      className="admin-action-btn"
                      style={{ 
                        color: user.status === 'Activo' ? 'var(--success)' : 'var(--danger)',
                        borderColor: user.status === 'Activo' ? 'var(--success)' : 'var(--danger)',
                        fontSize: '0.75rem',
                        padding: '3px 8px'
                      }}
                      onClick={() => handleToggleUserStatus(user.email)}
                    >
                      {user.status === 'Activo' ? '🟢 Activo' : '🔴 Suspendido'}
                    </button>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button className="admin-action-btn" title="Cambiar clave" onClick={() => setEditingUserPassword(user.email)}>🔑</button>
                      <button className="admin-action-btn" style={{ color: 'var(--danger)' }} onClick={() => handleDeleteUser(user.email)}>🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // --- RENDER TAB - CONFIGURACIONES AVANZADAS (INCLUYE EDICIÓN DE MARCA: NOMBRE Y LOGO) ---
  const renderSettingsTab = () => {
    return (
      <div style={{ maxWidth: '650px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* Personalización de Marca */}
        <h3>Ajustes de la Heladería</h3>
        
        <div className="glass" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
          
          {/* Nombre y Logo del Local */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '15px', borderBottom: '1px solid var(--border-color)', paddingBottom: '15px' }}>
            <div className="form-group">
              <label>Nombre de la Heladería / Sitio Web</label>
              <input
                type="text"
                className="form-control"
                value={localStoreName}
                onChange={(e) => setLocalStoreName(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Emoji o URL de Imagen del Logotipo</label>
              <input
                type="text"
                className="form-control"
                placeholder="Emoji o URL de Imagen"
                value={localStoreLogo}
                onChange={(e) => setLocalStoreLogo(e.target.value)}
              />
            </div>
          </div>

          {/* Teléfono de WhatsApp */}
          <div>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '5px' }}>
              📞 Número de Celular (Llamadas y WhatsApp)
            </label>
            <input 
              type="text" 
              className="form-control" 
              value={localStorePhone} 
              onChange={(e) => setLocalStorePhone(e.target.value)} 
            />
            <span style={{ fontSize: '0.7rem', color: 'var(--text-light)' }}>
              Número de teléfono para el desvío de pedidos e interacciones del cliente.
            </span>
          </div>

          {/* Meta de Ventas del día */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
            <div>
              <strong>🎯 Meta Diaria de Ventas (S/.)</strong>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-light)', display: 'block' }}>Objetivo de ingresos diario.</span>
            </div>
            <input
              type="number"
              step="10.00"
              style={{ width: '80px', padding: '6px' }}
              className="form-control"
              value={localSalesGoal}
              onChange={(e) => setLocalSalesGoal(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
            <div>
              <strong>Monto Envío Gratis Mínimo (S/.)</strong>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-light)', display: 'block' }}>Monto necesario para delivery gratuito.</span>
            </div>
            <input
              type="number"
              step="1.00"
              style={{ width: '80px', padding: '6px' }}
              className="form-control"
              value={localFreeDeliveryThreshold}
              onChange={(e) => setLocalFreeDeliveryThreshold(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
            <div>
              <strong>Mensaje de Campaña de Delivery</strong>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-light)', display: 'block' }}>Texto secundario del banner para promociones y campañas de envío.</span>
            </div>
            <textarea
              className="form-control"
              rows={2}
              style={{ width: '100%', fontSize: '0.8rem', resize: 'vertical' }}
              value={localDeliveryCampaignText}
              onChange={(e) => setLocalDeliveryCampaignText(e.target.value)}
            />
            <div style={{ marginTop: '8px', padding: '10px', background: 'linear-gradient(135deg, rgba(46, 204, 113, 0.15) 0%, rgba(52, 152, 219, 0.1) 100%)', borderLeft: '4px solid var(--success)', borderRadius: '6px', textAlign: 'center' }}>
              <span style={{ fontSize: '0.9rem', fontWeight: 'bold', display: 'block' }}>🚚 Delivery GRATIS por compras desde S/. {parseFloat(localFreeDeliveryThreshold || 0).toFixed(2)}</span>
              {localDeliveryCampaignText && <p style={{ fontSize: '0.75rem', color: 'var(--text-light)', marginTop: '2px', marginBottom: 0 }}>{localDeliveryCampaignText}</p>}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
            <div>
              <strong>Alerta Sonora de Pedidos</strong>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-light)', display: 'block' }}>Campanada para notificar pedidos.</span>
            </div>
            <label className="toggle-switch">
              <input type="checkbox" checked={soundEnabled} onChange={onToggleSoundEnabled} />
              <span className="slider"></span>
            </label>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
            <div>
              <strong>Estado de Heladería</strong>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-light)', display: 'block' }}>Si está cerrado, se bloquea el carrito.</span>
            </div>
            <label className="toggle-switch">
              <input type="checkbox" checked={shopOpen} onChange={onToggleShopOpen} />
              <span className="slider"></span>
            </label>
          </div>

          <div className="glass" style={{ borderLeft: '4px solid #0088cc', padding: '15px', background: 'rgba(0, 136, 204, 0.03)', borderRadius: '8px', marginBottom: '15px' }}>
            <strong style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem' }}>
              ✈️ Notificaciones en tiempo real (Telegram Bot)
            </strong>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-light)', marginTop: '4px', marginBottom: '10px' }}>
              Configura tu bot de Telegram para recibir alertas instantáneas cada vez que un cliente realice un nuevo pedido.
            </p>
            <div style={{ display: 'flex', gap: '10px', flexDirection: 'column' }}>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Token del Bot (ej: 123456:ABC...)"
                  style={{ flex: 2, minWidth: '200px', fontSize: '0.8rem', padding: '8px' }}
                  value={localTelegramToken}
                  onChange={(e) => setLocalTelegramToken(e.target.value)}
                />
                <input
                  type="text"
                  className="form-control"
                  placeholder="Chat ID"
                  style={{ flex: 1, minWidth: '100px', fontSize: '0.8rem', padding: '8px' }}
                  value={localTelegramChatId}
                  onChange={(e) => setLocalTelegramChatId(e.target.value)}
                />
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: '6px 12px', fontSize: '0.75rem', backgroundColor: '#0088cc', borderColor: '#0088cc', color: 'white', cursor: 'pointer' }}
                  disabled={telegramTestStatus.loading}
                  onClick={handleTestTelegramConnection}
                >
                  {telegramTestStatus.loading ? 'Enviando...' : '⚡ Probar Conexión'}
                </button>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-light)' }}>
                  Recuerda haber enviado `/start` a tu bot en Telegram.
                </span>
              </div>

              {telegramTestStatus.success && (
                <div style={{ color: 'var(--success)', fontSize: '0.75rem', fontWeight: 600, marginTop: '3px' }}>
                  ✅ ¡Mensaje de prueba enviado con éxito! Revisa tu chat de Telegram.
                </div>
              )}
              {telegramTestStatus.error && (
                <div style={{ color: 'var(--danger)', fontSize: '0.75rem', fontWeight: 600, marginTop: '3px' }}>
                  ❌ Error: {telegramTestStatus.error}
                </div>
              )}
            </div>
          </div>

          {/* 🔌 Estado de Sincronización en la Nube */}
          <div className="glass" style={{ borderLeft: '4px solid var(--primary-color)', padding: '15px', background: 'rgba(255, 107, 129, 0.02)', borderRadius: '8px', marginBottom: '15px' }}>
            <strong style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem' }}>
              🔌 Estado de la Base de Datos en la Nube
            </strong>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-light)', marginTop: '4px', marginBottom: '10px' }}>
              Verifica el estado de sincronización en tiempo real de tu tienda con la base de datos de Supabase.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '10px' }}>
              {isCloudSynced ? (
                <span style={{
                  backgroundColor: 'rgba(46, 204, 113, 0.15)',
                  color: 'var(--success)',
                  padding: '4px 10px',
                  borderRadius: '12px',
                  fontSize: '0.75rem',
                  fontWeight: 'bold',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  🟢 Sincronizado (Supabase Activo)
                </span>
              ) : (
                <span style={{
                  backgroundColor: 'rgba(241, 196, 15, 0.15)',
                  color: 'var(--secondary-color)',
                  padding: '4px 10px',
                  borderRadius: '12px',
                  fontSize: '0.75rem',
                  fontWeight: 'bold',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  🟡 Modo Local (LocalStorage)
                </span>
              )}
              
              <button
                type="button"
                className="admin-action-btn"
                style={{ fontSize: '0.7rem', padding: '3px 8px' }}
                onClick={() => {
                  window.location.reload();
                }}
              >
                🔄 Recargar y Sincronizar
              </button>
            </div>

            <button 
              type="button" 
              onClick={() => setShowSQLScript(!showSQLScript)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--primary-color)',
                fontSize: '0.75rem',
                fontWeight: 'bold',
                cursor: 'pointer',
                padding: 0,
                textAlign: 'left',
                display: 'block'
              }}
            >
              {showSQLScript ? '🔼 Ocultar instrucciones SQL' : '🔽 Ver instrucciones SQL para activar Supabase'}
            </button>

            {showSQLScript && (
              <div style={{
                marginTop: '10px',
                padding: '10px',
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                fontSize: '0.7rem',
                color: 'var(--text-dark)',
                maxHeight: '150px',
                overflowY: 'auto'
              }}>
                <p style={{ marginBottom: '8px', fontWeight: 600 }}>Copia y ejecuta este script en el editor SQL de tu consola de Supabase:</p>
                <pre style={{
                  background: 'rgba(0,0,0,0.05)',
                  padding: '8px',
                  borderRadius: '4px',
                  overflowX: 'auto',
                  fontFamily: 'monospace',
                  whiteSpace: 'pre-wrap'
                }}>
{`-- 1. Crear la tabla de sincronización si no existe
create table if not exists public.helados_sync (
  key text primary key,
  value jsonb not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Habilitar réplica completa para soporte en tiempo real
alter table public.helados_sync replica identity full;

-- 3. Agregar la tabla a la publicación de tiempo real (evitando errores si ya existe)
do $$
begin
  if not exists (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'helados_sync'
  ) then
    alter publication supabase_realtime add table public.helados_sync;
  end if;
end $$;

-- 4. Habilitar la seguridad RLS (Seguridad a Nivel de Fila)
alter table public.helados_sync enable row level security;

-- 5. Crear políticas de seguridad limpias y seguras (se eliminan si existen para evitar errores)
drop policy if exists "Lectura pública" on public.helados_sync;
drop policy if exists "Inserción pública" on public.helados_sync;
drop policy if exists "Modificación pública" on public.helados_sync;

drop policy if exists "Lectura pública de configuración general" on public.helados_sync;
create policy "Lectura pública de configuración general" on public.helados_sync 
  for select using (key not in ('staff_users', 'telegram_token', 'telegram_chat_id'));

drop policy if exists "Lectura privada de personal y credenciales" on public.helados_sync;
create policy "Lectura privada de personal y credenciales" on public.helados_sync 
  for select to authenticated using (key in ('staff_users', 'telegram_token', 'telegram_chat_id'));

drop policy if exists "Inserción de configuración general" on public.helados_sync;
create policy "Inserción de configuración general" on public.helados_sync 
  for insert with check (key not in ('staff_users', 'telegram_token', 'telegram_chat_id'));

drop policy if exists "Inserción privada de personal y credenciales" on public.helados_sync;
create policy "Inserción privada de personal y credenciales" on public.helados_sync 
  for insert to authenticated with check (key in ('staff_users', 'telegram_token', 'telegram_chat_id'));

drop policy if exists "Modificación de configuración general" on public.helados_sync;
create policy "Modificación de configuración general" on public.helados_sync 
  for update using (key not in ('staff_users', 'telegram_token', 'telegram_chat_id')) with check (key not in ('staff_users', 'telegram_token', 'telegram_chat_id'));

drop policy if exists "Modificación privada de personal y credenciales" on public.helados_sync;
create policy "Modificación privada de personal y credenciales" on public.helados_sync 
  for update to authenticated using (key in ('staff_users', 'telegram_token', 'telegram_chat_id')) with check (key in ('staff_users', 'telegram_token', 'telegram_chat_id'));`}
                </pre>
              </div>
            )}
          </div>

          {/* 📱 Generador de Código QR para Mesas */}
          <div className="glass" style={{ borderLeft: '4px solid var(--secondary-color)', padding: '15px', background: 'rgba(229, 142, 38, 0.02)', borderRadius: '8px', marginBottom: '15px' }}>
            <strong style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem' }}>
              📱 Código QR para Clientes en Tienda
            </strong>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-light)', marginTop: '4px', marginBottom: '10px' }}>
              Genera e imprime un código QR para las mesas del local. Tus clientes podrán escanearlo y realizar pedidos directamente desde sus móviles.
            </p>

            <div style={{ marginBottom: '15px', borderBottom: '1px dashed var(--border-color)', paddingBottom: '15px' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>
                🔗 Enlace personalizado para el Código QR
              </label>
              <input 
                type="text" 
                className="form-control" 
                placeholder={`Por defecto: ${window.location.origin + window.location.pathname}`}
                value={localQrCustomUrl || ''} 
                onChange={(e) => setLocalQrCustomUrl(e.target.value)} 
              />
              <span style={{ fontSize: '0.7rem', color: 'var(--text-light)', display: 'block', marginTop: '3px' }}>
                Si deseas redirigir a un número de mesa específico (ej: <code>{window.location.origin + window.location.pathname}?mesa=4</code>) o a un dominio específico, ingrésalo aquí.
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
              <div style={{
                background: 'white',
                padding: '8px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: 'var(--shadow-sm)'
              }}>
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=130x130&data=${encodeURIComponent(qrCustomUrl || (window.location.origin + window.location.pathname))}`}
                  alt="Código QR Heladería"
                  style={{ width: '130px', height: '130px', display: 'block' }}
                />
              </div>
              <div style={{ flex: 1, minWidth: '200px' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 'bold', display: 'block', color: 'var(--text-dark)' }}>Enlace del local:</span>
                <code style={{ fontSize: '0.75rem', color: 'var(--primary-color)', display: 'block', margin: '4px 0 10px', wordBreak: 'break-all' }}>
                  {qrCustomUrl || (window.location.origin + window.location.pathname)}
                </code>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: '6px 12px', fontSize: '0.75rem', cursor: 'pointer' }}
                  onClick={() => {
                    const printWindow = window.open('', '_blank');
                    const targetQr = qrCustomUrl || (window.location.origin + window.location.pathname);
                    printWindow.document.write(`
                      <html>
                        <head>
                          <title>Imprimir QR de Heladería</title>
                          <style>
                            body { font-family: 'Outfit', sans-serif; text-align: center; padding: 40px; }
                            .card { border: 3px solid #ff6b81; border-radius: 20px; padding: 30px; display: inline-block; max-width: 400px; }
                            h1 { color: #ff6b81; margin-bottom: 5px; }
                            p { color: #666; margin-bottom: 20px; }
                          </style>
                        </head>
                        <body>
                          <div class="card">
                            <h1>🍦 ¡Pide desde tu Celular!</h1>
                            <p>Escanea este código QR para ver la carta digital, armar tu helado personalizado y pedir al instante.</p>
                            <img src="https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(targetQr)}" width="250" height="250" />
                            <h2 style="color: #e58e26; margin-top: 20px;">${storeName}</h2>
                          </div>
                          <script>window.onload = function() { window.print(); }</script>
                        </body>
                      </html>
                    `);
                    printWindow.document.close();
                  }}
                >
                  🖨️ Imprimir QR de Mesas
                </button>
              </div>
            </div>
          </div>

          {/* 📝 Gestor de Plantilla de WhatsApp */}
          <div className="glass" style={{ borderLeft: '4px solid var(--info)', padding: '15px', background: 'rgba(52, 152, 219, 0.02)', borderRadius: '8px', marginBottom: '15px' }}>
            <strong style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem' }}>
              📝 Personalización del Mensaje de WhatsApp
            </strong>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-light)', marginTop: '4px', marginBottom: '12px' }}>
              Personaliza el saludo inicial y la despedida de los mensajes que envían los clientes por WhatsApp al confirmar su pedido.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div className="form-group">
                <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>Texto de Saludo (Cabecera):</label>
                <textarea
                  className="form-control"
                  rows="2"
                  style={{ fontSize: '0.8rem', padding: '6px', resize: 'vertical', width: '100%', fontFamily: 'inherit' }}
                  value={localWhatsappGreeting}
                  onChange={(e) => setLocalWhatsappGreeting(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>Texto de Despedida (Pie de página):</label>
                <input
                  type="text"
                  className="form-control"
                  style={{ fontSize: '0.8rem', padding: '6px', width: '100%' }}
                  value={localWhatsappFooter}
                  onChange={(e) => setLocalWhatsappFooter(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Gestión de Cupones */}
          <div className="glass" style={{ padding: '15px', borderRadius: '8px', marginBottom: '15px' }}>
            <strong style={{ display: 'block', fontSize: '0.95rem', marginBottom: '8px' }}>🎫 Gestión de Cupones de Descuento</strong>
            
            {/* Formulario de Nuevo Cupón */}
            <form onSubmit={handleAddCouponSubmit} style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '15px', background: 'rgba(0,0,0,0.02)', padding: '10px', borderRadius: '6px' }}>
              <input
                type="text"
                placeholder="CÓDIGO (Ej: PROMO20)"
                className="form-control"
                style={{ flex: '1 1 120px', textTransform: 'uppercase', fontSize: '0.8rem', padding: '6px' }}
                value={newCoupon.code}
                onChange={(e) => setNewCoupon({ ...newCoupon, code: e.target.value.toUpperCase() })}
                required
              />
              <select
                className="form-control"
                style={{ flex: '1 1 120px', fontSize: '0.8rem', padding: '6px' }}
                value={newCoupon.type}
                onChange={(e) => setNewCoupon({ ...newCoupon, type: e.target.value })}
              >
                <option value="percentage">Porcentaje (%)</option>
                <option value="flat">Monto Fijo (S/.)</option>
                <option value="free_delivery">Envío Gratis</option>
              </select>
              {newCoupon.type !== 'free_delivery' && (
                <input
                  type="number"
                  placeholder="Valor"
                  className="form-control"
                  style={{ width: '80px', fontSize: '0.8rem', padding: '6px' }}
                  value={newCoupon.value}
                  onChange={(e) => setNewCoupon({ ...newCoupon, value: parseFloat(e.target.value) || 0 })}
                  required
                />
              )}
              <button type="submit" className="btn btn-primary" style={{ padding: '4px 10px', fontSize: '0.75rem' }}>
                ➕ Añadir
              </button>
            </form>

            {/* Lista de Cupones */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {!coupons || coupons.length === 0 ? (
                <span style={{ fontSize: '0.8rem', color: 'var(--text-light)' }}>No hay cupones activos creados.</span>
              ) : (
                coupons.map(coupon => (
                  <div key={coupon.code} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px dashed var(--border-color)', paddingBottom: '6px', fontSize: '0.8rem' }}>
                    <div>
                      <strong style={{ color: 'var(--primary-color)' }}>{coupon.code}</strong>
                      <span style={{ color: 'var(--text-light)', marginLeft: '10px' }}>
                        {coupon.type === 'percentage' && `${coupon.value}% de desc.`}
                        {coupon.type === 'flat' && `S/. ${coupon.value.toFixed(2)} de desc.`}
                        {coupon.type === 'free_delivery' && 'Envío Gratis'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        onUpdateCoupons(coupons.filter(c => c.code !== coupon.code));
                        addLog(`Cupón eliminado: ${coupon.code}.`);
                      }}
                      style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '0.9rem' }}
                    >
                      🗑️
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Bitácora de Operaciones (Logs) */}
          <div>
            <strong style={{ display: 'block', fontSize: '0.9rem', marginBottom: '8px' }}>📜 Bitácora de Operaciones Recientes (Auditoría)</strong>
            <div style={{
              background: 'rgba(0,0,0,0.03)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              padding: '10px',
              maxHeight: '120px',
              overflowY: 'auto',
              fontFamily: 'monospace',
              fontSize: '0.75rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}>
              {logs.map((log, idx) => (
                <div key={idx} style={{ borderBottom: '1px dashed rgba(0,0,0,0.05)', paddingBottom: '2px' }}>
                  <span style={{ color: 'var(--primary-color)', marginRight: '5px' }}>[{log.time}]</span>
                  <span>{log.text}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <button className="btn btn-secondary" onClick={handleLogoutAction} style={{ color: 'var(--danger)', borderColor: 'var(--danger)', fontSize: '0.8rem', padding: '6px 12px' }}>
              🚪 Cerrar Sesión ({currentUser?.name})
            </button>
            <button className="btn btn-primary" onClick={handleSaveSettings} style={{ padding: '8px 20px', fontSize: '0.85rem', cursor: 'pointer' }}>
              💾 Guardar Ajustes de Heladería
            </button>
          </div>
        </div>
      </div>
    );
  };

  // --- RENDER TAB - METRICAS Y VENTAS CON LA META DIARIA ---
  const renderStatsTab = () => {
    // Filtrar pedidos según rango de fecha seleccionado
    const getFilteredOrdersForStats = () => {
      const todayString = new Date().toDateString();
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayString = yesterday.toDateString();
      const now = new Date();

      return orders.filter(order => {
        if (order.status === 'Cancelado') return false;
        
        const orderDate = new Date(order.date);
        
        if (statsRange === 'today') {
          return orderDate.toDateString() === todayString;
        } else if (statsRange === 'yesterday') {
          return orderDate.toDateString() === yesterdayString;
        } else if (statsRange === '7days') {
          const diffDays = (new Date() - orderDate) / (1000 * 60 * 60 * 24);
          return diffDays <= 7;
        } else if (statsRange === '30days') {
          const diffDays = (new Date() - orderDate) / (1000 * 60 * 60 * 24);
          return diffDays <= 30;
        } else if (statsRange === 'thismonth') {
          return orderDate.getMonth() === now.getMonth() && orderDate.getFullYear() === now.getFullYear();
        } else if (statsRange === 'custom') {
          let matches = true;
          if (statsStartDate) {
            const start = new Date(statsStartDate + 'T00:00:00');
            matches = matches && orderDate >= start;
          }
          if (statsEndDate) {
            const end = new Date(statsEndDate + 'T23:59:59');
            matches = matches && orderDate <= end;
          }
          return matches;
        }
        return true; // all
      });
    };

    const statsOrders = getFilteredOrdersForStats();
    const totalSalesPeriod = statsOrders.reduce((sum, o) => sum + o.grandTotal, 0);
    const netProductSales = statsOrders.reduce((sum, o) => sum + o.total, 0);
    const deliveryRevenue = statsOrders.reduce((sum, o) => sum + o.deliveryFee, 0);
    const orderCountPeriod = statsOrders.length;
    const avgTicketPeriod = orderCountPeriod > 0 ? (totalSalesPeriod / orderCountPeriod) : 0;

    // Calcular estadísticas de productos más vendidos
    const flavorSales = {};
    const baseSales = {};
    const toppingSales = {};
    const packSales = {};
    
    // Métodos de pago y Tipos de Entrega
    const salesByPayment = {};
    const salesByDeliveryType = { delivery: 0, pickup: 0 };

    statsOrders.forEach(order => {
      // Método de Pago
      const pm = order.customer.paymentMethod || 'Otros';
      salesByPayment[pm] = (salesByPayment[pm] || 0) + order.grandTotal;

      // Tipo de Entrega
      const isDelivery = order.deliveryFee > 0 || (order.customer.address && !['recojo', 'recojo en tienda', 'tienda', 'local'].includes(order.customer.address.toLowerCase().trim()));
      if (isDelivery) {
        salesByDeliveryType.delivery += order.grandTotal;
      } else {
        salesByDeliveryType.pickup += order.grandTotal;
      }

      order.items.forEach(item => {
        const qty = item.quantity || 1;
        if (item.type === 'custom') {
          if (item.base) {
            baseSales[item.base.name] = (baseSales[item.base.name] || 0) + qty;
          }
          if (item.scoops) {
            item.scoops.forEach(scoop => {
              flavorSales[scoop.name] = (flavorSales[scoop.name] || 0) + qty;
            });
          }
          if (item.toppings) {
            item.toppings.forEach(topping => {
              toppingSales[topping.name] = (toppingSales[topping.name] || 0) + qty;
            });
          }
          if (item.syrup) {
            toppingSales[item.syrup.name] = (toppingSales[item.syrup.name] || 0) + qty;
          }
        } else if (item.type === 'pack') {
          packSales[item.name] = (packSales[item.name] || 0) + qty;
        }
      });
    });

    // Rango dinámico de fechas para la tabla de desglose
    const getDaysInRange = () => {
      const dayList = [];
      let start = new Date();
      let end = new Date();

      if (statsRange === 'today') {
        start = new Date();
        end = new Date();
      } else if (statsRange === 'yesterday') {
        start = new Date();
        start.setDate(start.getDate() - 1);
        end = new Date(start);
      } else if (statsRange === '7days') {
        start = new Date();
        start.setDate(start.getDate() - 6);
      } else if (statsRange === '30days') {
        start = new Date();
        start.setDate(start.getDate() - 29);
      } else if (statsRange === 'thismonth') {
        start = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      } else if (statsRange === 'custom') {
        start = statsStartDate ? new Date(statsStartDate + 'T00:00:00') : new Date();
        end = statsEndDate ? new Date(statsEndDate + 'T23:59:59') : new Date();
      } else { // all
        if (orders.length > 0) {
          const dates = orders.map(o => new Date(o.date).getTime());
          start = new Date(Math.min(...dates));
        } else {
          start.setDate(start.getDate() - 30);
        }
      }

      const current = new Date(start);
      current.setHours(0,0,0,0);
      const limit = new Date(end);
      limit.setHours(23,59,59,999);

      let iterations = 0;
      while (current <= limit && iterations < 366) {
        dayList.push(new Date(current));
        current.setDate(current.getDate() + 1);
        iterations++;
      }
      return dayList.reverse();
    };

    const dailyHistory = getDaysInRange().map(date => {
      const dateKey = date.toDateString();
      const dateStr = date.toLocaleDateString('es-PE', { weekday: 'short', day: '2-digit', month: '2-digit' });
      
      const dayOrders = orders.filter(o => new Date(o.date).toDateString() === dateKey);
      const validDayOrders = dayOrders.filter(o => o.status !== 'Cancelado');
      const canceledCount = dayOrders.filter(o => o.status === 'Cancelado').length;
      
      const subtotal = validDayOrders.reduce((sum, o) => sum + o.total, 0);
      const deliveryFee = validDayOrders.reduce((sum, o) => sum + o.deliveryFee, 0);
      const grandTotal = validDayOrders.reduce((sum, o) => sum + o.grandTotal, 0);
      
      return {
        date,
        dateKey,
        dateStr,
        orders: dayOrders,
        validCount: validDayOrders.length,
        canceledCount,
        subtotal,
        deliveryFee,
        sales: grandTotal
      };
    });

    // Ordenar resultados de más vendidos
    const sortedFlavors = Object.entries(flavorSales).sort((a, b) => b[1] - a[1]).slice(0, 3);
    const sortedBases = Object.entries(baseSales).sort((a, b) => b[1] - a[1]).slice(0, 3);
    const sortedToppings = Object.entries(toppingSales).sort((a, b) => b[1] - a[1]).slice(0, 3);
    const sortedPacks = Object.entries(packSales).sort((a, b) => b[1] - a[1]).slice(0, 3);

    const progressPercent = Math.min(100, Math.round((salesToday / salesGoal) * 100)) || 0;

    // Gráfico de barras ordenado cronológicamente (más antiguo a más nuevo)
    const chartData = [...dailyHistory].reverse().slice(-15); // limit to last 15 days in chart to avoid cluttering
    const maxSales = Math.max(...chartData.map(d => d.sales), 10);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Selector de Rango de Fechas */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px', flexWrap: 'wrap', gap: '10px' }}>
          <h3 style={{ margin: 0 }}>📊 Dashboard Analítico y Ventas</h3>
          <div style={{ display: 'flex', gap: '5px', background: 'rgba(0,0,0,0.03)', padding: '4px', borderRadius: '8px', flexWrap: 'wrap' }}>
            {[
              { id: 'today', label: 'Hoy' },
              { id: 'yesterday', label: 'Ayer' },
              { id: '7days', label: '7 Días' },
              { id: '30days', label: '30 Días' },
              { id: 'thismonth', label: 'Este Mes' },
              { id: 'custom', label: 'Calendario 📅' }
            ].map(r => (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  setStatsRange(r.id);
                  setExpandedDay(null);
                }}
                className={`filter-btn ${statsRange === r.id ? 'active' : ''}`}
                style={{ padding: '4px 10px', fontSize: '0.75rem', border: 'none', background: 'transparent', whiteSpace: 'nowrap' }}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {/* Input Rango Personalizado */}
        {statsRange === 'custom' && (
          <div className="glass" style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '15px', 
            padding: '12px 15px', 
            borderRadius: '8px',
            background: 'var(--bg-secondary)',
            flexWrap: 'wrap',
            marginTop: '-10px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Desde:</span>
              <input 
                type="date" 
                className="form-control" 
                style={{ padding: '6px 10px', fontSize: '0.8rem', width: '140px' }} 
                value={statsStartDate} 
                onChange={(e) => { setStatsStartDate(e.target.value); setExpandedDay(null); }} 
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Hasta:</span>
              <input 
                type="date" 
                className="form-control" 
                style={{ padding: '6px 10px', fontSize: '0.8rem', width: '140px' }} 
                value={statsEndDate} 
                onChange={(e) => { setStatsEndDate(e.target.value); setExpandedDay(null); }} 
              />
            </div>
          </div>
        )}
        
        {/* Meta Diaria y Estado Financiero */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '20px' }} className="admin-stats-columns">
          
          {/* Columna Izquierda: Meta de Ventas y Resumen del periodo */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {/* Barra de progreso de la meta de ventas (Diaria) */}
            <div className="glass" style={{ padding: '15px', borderLeft: '5px solid var(--primary-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', fontWeight: 'bold' }}>
                <span>🎯 Meta de Ventas Diaria: S/. {salesGoal.toFixed(2)}</span>
                <span style={{ color: 'var(--primary-color)' }}>{progressPercent}% Completado</span>
              </div>
              <div style={{ width: '100%', height: '8px', background: 'var(--border-color)', borderRadius: '4px', marginTop: '8px', overflow: 'hidden' }}>
                <div style={{ width: `${progressPercent}%`, height: '100%', background: 'var(--primary-color)', transition: 'width 0.4s ease' }}></div>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-light)', marginTop: '6px', marginBottom: 0 }}>
                Llevas acumulado <strong>S/. {salesToday.toFixed(2)}</strong> hoy en base a tu objetivo diario de ventas.
              </p>
            </div>

            {/* Tarjetas del periodo filtrado */}
            <div className="admin-stats-grid">
              <div className="glass stat-card" style={{ padding: '12px 15px' }}>
                <span className="stat-icon" style={{ fontSize: '1.8rem', padding: '6px' }}>💰</span>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>Ventas Brutas</span>
                  <div className="stat-value" style={{ fontSize: '1.15rem', fontWeight: 'bold' }}>S/. {totalSalesPeriod.toFixed(2)}</div>
                </div>
              </div>
              <div className="glass stat-card" style={{ padding: '12px 15px' }}>
                <span className="stat-icon" style={{ fontSize: '1.8rem', padding: '6px' }}>🍦</span>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>Ventas Netas</span>
                  <div className="stat-value" style={{ fontSize: '1.15rem', fontWeight: 'bold' }}>S/. {netProductSales.toFixed(2)}</div>
                </div>
              </div>
              <div className="glass stat-card" style={{ padding: '12px 15px' }}>
                <span className="stat-icon" style={{ fontSize: '1.8rem', padding: '6px' }}>🚚</span>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>Envío / Delivery</span>
                  <div className="stat-value" style={{ fontSize: '1.15rem', fontWeight: 'bold' }}>S/. {deliveryRevenue.toFixed(2)}</div>
                </div>
              </div>
              <div className="glass stat-card" style={{ padding: '12px 15px' }}>
                <span className="stat-icon" style={{ fontSize: '1.8rem', padding: '6px' }}>📦</span>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>Pedidos del Período</span>
                  <div className="stat-value" style={{ fontSize: '1.15rem', fontWeight: 'bold' }}>{orderCountPeriod}</div>
                </div>
              </div>
              <div className="glass stat-card" style={{ padding: '12px 15px' }}>
                <span className="stat-icon" style={{ fontSize: '1.8rem', padding: '6px' }}>📈</span>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>Ticket Promedio</span>
                  <div className="stat-value" style={{ fontSize: '1.15rem', fontWeight: 'bold' }}>S/. {avgTicketPeriod.toFixed(2)}</div>
                </div>
              </div>
              <div className="glass stat-card" style={{ padding: '12px 15px', background: 'rgba(255, 107, 129, 0.03)' }}>
                <span className="stat-icon" style={{ fontSize: '1.8rem', padding: '6px' }}>📋</span>
                <div>
                  <button 
                    type="button"
                    className="btn btn-secondary" 
                    style={{ fontSize: '0.7rem', padding: '4px 8px', marginTop: '2px' }}
                    onClick={handleExportSalesReport}
                  >
                    Copiar Reporte
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Columna Derecha: Canales de Pago */}
          <div className="glass" style={{ padding: '15px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <strong style={{ fontSize: '0.85rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>💰 Métodos de Pago y Envío</strong>
            
            {/* Medios de Pago */}
            <div>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-light)' }}>Ventas por Canal:</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
                {Object.keys(salesByPayment).length === 0 ? (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>Sin datos de pago.</span>
                ) : (
                  Object.entries(salesByPayment).map(([method, amount]) => {
                    const pct = totalSalesPeriod > 0 ? Math.round((amount / totalSalesPeriod) * 100) : 0;
                    return (
                      <div key={method}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '2px' }}>
                          <span><strong>{method === 'Yape' ? '📱 Yape' : method === 'Plin' ? '💸 Plin' : method === 'Efectivo' ? '💵 Efectivo' : '❓ Otros'}</strong></span>
                          <span>S/. {amount.toFixed(2)} ({pct}%)</span>
                        </div>
                        <div style={{ width: '100%', height: '4px', background: 'var(--border-color)', borderRadius: '2px', overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: 'var(--primary-color)' }}></div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Servicio Delivery vs Recojo */}
            <div style={{ borderTop: '1px dashed var(--border-color)', paddingTop: '8px', marginTop: '4px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-light)' }}>Canal de Entrega:</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px', fontSize: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>🛵 Reparto a domicilio:</span>
                  <strong>S/. {salesByDeliveryType.delivery.toFixed(2)} ({totalSalesPeriod > 0 ? Math.round((salesByDeliveryType.delivery / totalSalesPeriod) * 100) : 0}%)</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>🏪 Recojo en tienda:</span>
                  <strong>S/. {salesByDeliveryType.pickup.toFixed(2)} ({totalSalesPeriod > 0 ? Math.round((salesByDeliveryType.pickup / totalSalesPeriod) * 100) : 0}%)</strong>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Gráfico de Tendencia (CSS Bar Chart) */}
        {chartData.length > 1 && (
          <div className="glass" style={{ padding: '15px 20px', borderRadius: '8px' }}>
            <h4 style={{ margin: '0 0 10px 0', fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-dark)' }}>
              📈 Gráfico de Tendencia de Ventas (S/.)
            </h4>
            <div style={{
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              height: '140px',
              paddingTop: '20px',
              borderBottom: '2px solid var(--border-color)',
              paddingBottom: '8px',
              gap: '6px',
              overflowX: 'auto'
            }}>
              {chartData.map(d => {
                const heightPct = Math.round((d.sales / maxSales) * 100);
                return (
                  <div 
                    key={d.dateKey} 
                    style={{ 
                      display: 'flex', 
                      flexDirection: 'column', 
                      alignItems: 'center', 
                      flex: 1, 
                      minWidth: '35px',
                      height: '100%',
                      justifyContent: 'flex-end'
                    }}
                  >
                    <div style={{ fontSize: '0.65rem', fontWeight: 'bold', color: 'var(--primary-color)', marginBottom: '3px' }}>
                      {d.sales > 0 ? `${Math.round(d.sales)}` : ''}
                    </div>
                    <div 
                      style={{ 
                        width: '75%', 
                        height: `${Math.max(4, heightPct)}%`, 
                        background: 'linear-gradient(to top, var(--primary-color), var(--secondary-color))', 
                        borderRadius: '3px 3px 0 0',
                        boxShadow: '0 1px 5px rgba(255, 107, 129, 0.15)',
                        cursor: 'pointer'
                      }}
                      title={`${d.dateStr}: S/. ${d.sales.toFixed(2)} (${d.validCount} pedidos)`}
                    ></div>
                    <div style={{ fontSize: '0.6rem', color: 'var(--text-light)', marginTop: '6px', whiteSpace: 'nowrap' }}>
                      {d.dateStr.split(' ')[1]}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tabla de Ventas Diarias */}
        <div className="glass" style={{ padding: '20px', borderRadius: '8px' }}>
          <h4 style={{ margin: '0 0 12px 0', fontSize: '0.85rem', fontWeight: 'bold', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
            📅 Registro Diario Detallado de Ventas
          </h4>
          <div className="admin-table-container">
            <table className="admin-table" style={{ fontSize: '0.8rem' }}>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th style={{ textAlign: 'center' }}>Pedidos (Válidos / Canc.)</th>
                  <th style={{ textAlign: 'right' }}>Productos Neto</th>
                  <th style={{ textAlign: 'right' }}>Delivery</th>
                  <th style={{ textAlign: 'right' }}>Venta Bruta</th>
                  <th style={{ textAlign: 'center' }}>Meta Diaria</th>
                  <th style={{ textAlign: 'center' }}>Detalle</th>
                </tr>
              </thead>
              <tbody>
                {dailyHistory.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', color: 'var(--text-light)', padding: '15px' }}>No hay pedidos registrados en este período.</td>
                  </tr>
                ) : (
                  dailyHistory.map(day => {
                    const isGoalMet = day.sales >= salesGoal;
                    const hasOrders = day.orders.length > 0;
                    const isExpanded = expandedDay === day.dateKey;
                    
                    return (
                      <React.Fragment key={day.dateKey}>
                        <tr style={{ background: isExpanded ? 'rgba(255,107,129,0.02)' : 'transparent' }}>
                          <td><strong>{day.dateStr}</strong></td>
                          <td style={{ textAlign: 'center' }}>
                            <span style={{ color: 'var(--success)', fontWeight: 'bold' }}>{day.validCount}</span>
                            <span style={{ color: 'var(--text-light)' }}> / </span>
                            <span style={{ color: 'var(--danger)' }}>{day.canceledCount}</span>
                          </td>
                          <td style={{ textAlign: 'right' }}>S/. {day.subtotal.toFixed(2)}</td>
                          <td style={{ textAlign: 'right', color: 'var(--text-light)' }}>S/. {day.deliveryFee.toFixed(2)}</td>
                          <td style={{ textAlign: 'right' }}><strong style={{ color: 'var(--primary-color)' }}>S/. {day.sales.toFixed(2)}</strong></td>
                          <td style={{ textAlign: 'center' }}>
                            {day.sales === 0 ? (
                              <span style={{ color: 'var(--text-light)' }}>-</span>
                            ) : isGoalMet ? (
                              <span style={{ backgroundColor: 'rgba(46, 204, 113, 0.15)', color: 'var(--success)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 'bold' }}>🎯 Superada</span>
                            ) : (
                              <span style={{ backgroundColor: 'rgba(241, 196, 15, 0.15)', color: 'var(--secondary-color)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 'bold' }}>⏳ Pendiente</span>
                            )}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button 
                              type="button"
                              className="btn btn-secondary" 
                              style={{ padding: '3px 8px', fontSize: '0.65rem', minWidth: '70px', height: '24px' }}
                              onClick={() => setExpandedDay(isExpanded ? null : day.dateKey)}
                              disabled={!hasOrders}
                            >
                              {isExpanded ? '🔼 Cerrar' : '👁️ Ver Detalle'}
                            </button>
                          </td>
                        </tr>
                        
                        {isExpanded && (
                          <tr>
                            <td colSpan="7" style={{ background: 'var(--bg-secondary)', padding: '12px 15px' }}>
                              <div style={{ borderLeft: '3px solid var(--primary-color)', paddingLeft: '12px' }}>
                                <h5 style={{ margin: '0 0 10px 0', fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-dark)' }}>
                                  📋 Pedidos del {day.dateStr}
                                </h5>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                  {day.orders.map(o => (
                                    <div 
                                      key={o.id} 
                                      className="glass" 
                                      style={{ 
                                        padding: '10px', 
                                        borderRadius: '6px', 
                                        fontSize: '0.75rem',
                                        border: '1px solid var(--border-color)',
                                        background: 'var(--bg-primary)',
                                        display: 'flex',
                                        flexWrap: 'wrap',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        gap: '10px'
                                      }}
                                    >
                                      <div>
                                        <strong style={{ color: 'var(--primary-color)' }}>{o.id}</strong> 
                                        <span style={{ color: 'var(--text-light)', marginLeft: '6px' }}>({new Date(o.date).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })})</span>
                                        <div style={{ fontWeight: 600, marginTop: '2px' }}>{o.customer.name} - 📞 {o.customer.phone}</div>
                                        <div style={{ color: 'var(--text-light)', fontSize: '0.7rem' }}>📍 {o.customer.address}</div>
                                      </div>
                                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                        <span style={{ 
                                          padding: '1px 6px', 
                                          borderRadius: '4px', 
                                          fontSize: '0.65rem', 
                                          fontWeight: 'bold',
                                          color: 'white',
                                          backgroundColor: o.status === 'Entregado' ? 'var(--success)' : o.status === 'Cancelado' ? 'var(--danger)' : 'var(--secondary-color)'
                                        }}>
                                          {o.status}
                                        </span>
                                        <div style={{ marginTop: '4px' }}>
                                          <span>Método: <strong>{o.customer.paymentMethod}</strong></span>
                                          <span style={{ marginLeft: '12px' }}>Total: <strong style={{ color: 'var(--primary-color)' }}>S/. {o.grandTotal.toFixed(2)}</strong></span>
                                        </div>
                                      </div>
                                      
                                      {/* Productos comprados */}
                                      <div style={{ width: '100%', borderTop: '1px dashed var(--border-color)', paddingTop: '6px', marginTop: '4px', fontSize: '0.7rem', color: 'var(--text-light)' }}>
                                        <strong>Productos en el Pedido:</strong>
                                        <ul style={{ margin: '4px 0 0 0', paddingLeft: '15px' }}>
                                          {o.items.map((item, idx) => (
                                            <li key={idx}>
                                              {item.quantity}x {item.name || (item.type === 'custom' ? 'Helado Personalizado' : 'Pack')} - S/. {item.price.toFixed(2)}
                                            </li>
                                          ))}
                                        </ul>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Ránking de los Más Vendidos */}
        <div className="glass" style={{ padding: '20px', borderRadius: '8px' }}>
          <h4 style={{ margin: '0 0 15px 0', fontSize: '0.85rem', fontWeight: 'bold', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
            🏆 Ránking de los Más Vendidos ({statsRange === 'today' ? 'Hoy' : statsRange === 'yesterday' ? 'Ayer' : statsRange === '7days' ? '7 Días' : statsRange === '30days' ? '30 Días' : statsRange === 'thismonth' ? 'Este Mes' : 'Período'})
          </h4>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '25px' }}>
            
            {/* Top Sabores */}
            <div>
              <h5 style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--primary-color)', margin: '0 0 10px 0' }}>🍧 Sabores Más Vendidos</h5>
              {sortedFlavors.length === 0 ? (
                <span style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>Sin ventas en este período.</span>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {sortedFlavors.map(([name, count], idx) => {
                    const maxVal = sortedFlavors[0][1] || 1;
                    const pct = Math.round((count / maxVal) * 100);
                    return (
                      <div key={name}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '3px' }}>
                          <span><strong>#{idx + 1}</strong> {name}</span>
                          <span style={{ color: 'var(--text-light)' }}>{count} bola{count > 1 ? 's' : ''}</span>
                        </div>
                        <div style={{ width: '100%', height: '6px', background: 'var(--border-color)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: 'var(--primary-color)', borderRadius: '3px' }}></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Top Envases */}
            <div>
              <h5 style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--secondary-color)', margin: '0 0 10px 0' }}>👑 Envases Favoritos</h5>
              {sortedBases.length === 0 ? (
                <span style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>Sin ventas en este período.</span>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {sortedBases.map(([name, count], idx) => {
                    const maxVal = sortedBases[0][1] || 1;
                    const pct = Math.round((count / maxVal) * 100);
                    return (
                      <div key={name}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '3px' }}>
                          <span><strong>#{idx + 1}</strong> {name.split(' ')[0]}</span>
                          <span style={{ color: 'var(--text-light)' }}>{count} pedido{count > 1 ? 's' : ''}</span>
                        </div>
                        <div style={{ width: '100%', height: '6px', background: 'var(--border-color)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: 'var(--secondary-color)', borderRadius: '3px' }}></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Top Toppings */}
            <div>
              <h5 style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--info)', margin: '0 0 10px 0' }}>🍬 Toppings & Salsas</h5>
              {sortedToppings.length === 0 ? (
                <span style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>Sin ventas en este período.</span>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {sortedToppings.map(([name, count], idx) => {
                    const maxVal = sortedToppings[0][1] || 1;
                    const pct = Math.round((count / maxVal) * 100);
                    return (
                      <div key={name}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '3px' }}>
                          <span><strong>#{idx + 1}</strong> {name.split(' ')[0]}</span>
                          <span style={{ color: 'var(--text-light)' }}>{count} porci{count > 1 ? 'ones' : 'ón'}</span>
                        </div>
                        <div style={{ width: '100%', height: '6px', background: 'var(--border-color)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: 'var(--info)', borderRadius: '3px' }}></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Top Packs */}
            <div>
              <h5 style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--success)', margin: '0 0 10px 0' }}>🎁 Combos Más Pedidos</h5>
              {sortedPacks.length === 0 ? (
                <span style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>Sin ventas en este período.</span>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {sortedPacks.map(([name, count], idx) => {
                    const maxVal = sortedPacks[0][1] || 1;
                    const pct = Math.round((count / maxVal) * 100);
                    return (
                      <div key={name}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '3px' }}>
                          <span><strong>#{idx + 1}</strong> {name}</span>
                          <span style={{ color: 'var(--text-light)' }}>{count} combo{count > 1 ? 's' : ''}</span>
                        </div>
                        <div style={{ width: '100%', height: '6px', background: 'var(--border-color)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: 'var(--success)', borderRadius: '3px' }}></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    );
  };

  // --- PANTALLA DE INGRESO (LOGIN) ---
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
        <h4 style={{ marginBottom: '15px', color: 'var(--primary-color)', fontSize: '1.1rem' }}>🔧 {storeName} Admin</h4>
        <div className="sidebar-menu">
          <button className={`sidebar-btn ${activeTab === 'orders' ? 'active' : ''}`} onClick={() => setActiveTab('orders')}>
            📋 Pedidos ({orders.filter(o => o.status === 'Pendiente').length})
          </button>
          <button className={`sidebar-btn ${activeTab === 'inventory' ? 'active' : ''}`} onClick={() => setActiveTab('inventory')}>
            🍦 Carta Helada
          </button>
          <button className={`sidebar-btn ${activeTab === 'packs' ? 'active' : ''}`} onClick={() => setActiveTab('packs')}>
            🎁 Packs Combos
          </button>
          {currentUser && currentUser.role === 'Administrador' && (
            <button className={`sidebar-btn ${activeTab === 'users' ? 'active' : ''}`} onClick={() => setActiveTab('users')}>
              👥 Personal / Staff
            </button>
          )}
          <button className={`sidebar-btn ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
            ⚙️ Ajustes Tienda
          </button>
          <button className={`sidebar-btn ${activeTab === 'stats' ? 'active' : ''}`} onClick={() => setActiveTab('stats')}>
            📈 Meta e Ingresos
          </button>
        </div>
      </div>

      {/* Contenido de pestaña activa */}
      <div className="admin-content">
        {activeTab === 'orders' && renderOrdersTab()}
        {activeTab === 'inventory' && renderInventoryTab()}
        {activeTab === 'packs' && renderPacksTab()}
        {activeTab === 'users' && renderUsersTab()}
        {activeTab === 'settings' && renderSettingsTab()}
        {activeTab === 'stats' && renderStatsTab()}
      </div>
    </div>
  );
}
