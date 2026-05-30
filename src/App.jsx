import React, { useState, useEffect, useRef } from 'react';
import { 
  INITIAL_FLAVORS, 
  INITIAL_BASES, 
  INITIAL_TOPPINGS, 
  INITIAL_PACKS, 
  INITIAL_ORDERS 
} from './utils/mockData';
import CustomerShop from './components/CustomerShop';
import IceCreamCustomizer from './components/IceCreamCustomizer';
import Cart from './components/Cart';
import OrderTracker from './components/OrderTracker';
import AdminPanel from './components/AdminPanel';
import { fetchSyncedData, updateSyncedData, subscribeToSync } from './utils/supabaseSync';
import { supabase } from './utils/supabaseClient';

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

// Helper to render emoji or URL/image logo
const renderLogo = (logo, size = '32px') => {
  if (!logo) return null;
  const isUrl = logo.startsWith('http://') || logo.startsWith('https://') || logo.startsWith('/') || logo.startsWith('./') || logo.includes('.') || logo.startsWith('data:image/');
  if (isUrl) {
    return <img src={logo} alt="Logo" style={{ width: size, height: size, objectFit: 'contain', borderRadius: '50%' }} />;
  }
  return <span className="logo-icon">{logo}</span>;
};

// Live chat bubble bridged to Telegram
function LiveChatTelegramBridge({ telegramToken, telegramChatId, storePhone, storeName, view }) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  if (view === 'admin') return null;

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!message.trim()) return;

    if (!telegramToken || !telegramChatId) {
      const waMessage = `Hola, mi nombre es ${name || 'Cliente'}. Tengo una consulta:\n\n${message}`;
      const cleanPhone = String(storePhone || '').replace(/\D/g, '');
      const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(waMessage)}`;
      window.open(waUrl, '_blank');
      setIsOpen(false);
      setMessage('');
      return;
    }

    setSending(true);
    const textMsg = `💬 *¡NUEVO MENSAJE DE CLIENTE!* 💬\n\n` +
      `*Cliente:* ${name.trim() || 'Anónimo'}\n` +
      `*Mensaje:* ${message.trim()}\n\n` +
      `_Enviado desde el chat en vivo de la heladería._`;

    try {
      const response = await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: telegramChatId,
          text: textMsg,
          parse_mode: 'Markdown'
        })
      });

      if (response.ok) {
        setSent(true);
        setMessage('');
        setTimeout(() => {
          setSent(false);
          setIsOpen(false);
        }, 3000);
      } else {
        alert("Error al enviar mensaje. Por favor, inténtalo de nuevo.");
      }
    } catch (err) {
      console.error("Error al enviar mensaje a Telegram:", err);
      alert("Error de conexión. Inténtalo de nuevo.");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        .live-chat-bubble {
          position: fixed;
          bottom: 85px;
          right: 20px;
          width: 56px;
          height: 56px;
          background: linear-gradient(135deg, var(--primary-color) 0%, var(--secondary-color) 100%);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 1.6rem;
          cursor: pointer;
          box-shadow: 0 4px 15px rgba(255, 107, 129, 0.4);
          z-index: 9999;
          transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), box-shadow 0.3s ease;
        }
        .live-chat-bubble:hover {
          transform: scale(1.1);
          box-shadow: 0 6px 20px rgba(255, 107, 129, 0.5);
        }
        .live-chat-window {
          position: fixed;
          bottom: 155px;
          right: 20px;
          width: 320px;
          max-width: calc(100vw - 40px);
          background: var(--glass-bg, rgba(255, 255, 255, 0.9));
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid var(--border-color);
          border-radius: 16px;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
          z-index: 9998;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          animation: slideUpIn 0.3s cubic-bezier(0.165, 0.84, 0.44, 1);
        }
        @keyframes slideUpIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .live-chat-header {
          padding: 12px 16px;
          background: linear-gradient(135deg, var(--primary-color) 0%, var(--secondary-color) 100%);
          color: white;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .live-chat-header h4 {
          margin: 0;
          font-size: 0.95rem;
          font-weight: 700;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .live-chat-close {
          background: none;
          border: none;
          color: white;
          font-size: 1.2rem;
          cursor: pointer;
          opacity: 0.8;
          transition: opacity 0.2s ease;
          padding: 0;
          line-height: 1;
        }
        .live-chat-close:hover {
          opacity: 1;
        }
        .live-chat-body {
          padding: 15px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .live-chat-welcome {
          font-size: 0.78rem;
          color: var(--text-light);
          margin: 0 0 5px 0;
          line-height: 1.4;
        }
        .live-chat-form {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .live-chat-form label {
          font-size: 0.72rem;
          font-weight: bold;
          margin-bottom: -4px;
          color: var(--text-dark);
          text-align: left;
          display: block;
        }
        .live-chat-success {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 25px 15px;
          text-align: center;
          gap: 10px;
        }
        .live-chat-success-icon {
          font-size: 3rem;
          animation: scalePop 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
        @keyframes scalePop {
          0% { transform: scale(0.5); }
          100% { transform: scale(1); }
        }
      ` }} />

      {/* Burbuja flotante */}
      <div 
        className="live-chat-bubble"
        onClick={() => setIsOpen(!isOpen)}
        title="Chat de soporte en vivo"
      >
        {isOpen ? '✕' : '💬'}
      </div>

      {/* Ventana de chat */}
      {isOpen && (
        <div className="live-chat-window">
          <div className="live-chat-header">
            <h4>🍦 Chat en Vivo</h4>
            <button className="live-chat-close" onClick={() => setIsOpen(false)}>✕</button>
          </div>
          
          {sent ? (
            <div className="live-chat-success">
              <span className="live-chat-success-icon">✅</span>
              <strong style={{ fontSize: '0.9rem', color: 'var(--text-dark)' }}>¡Mensaje Enviado!</strong>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-light)', margin: 0 }}>
                Tu mensaje ha sido enviado al administrador a través del puente de soporte. Te responderemos muy pronto.
              </p>
            </div>
          ) : (
            <div className="live-chat-body">
              <p className="live-chat-welcome">
                ¿Tienes alguna consulta o inconveniente con tu pedido? Escríbenos directamente y un administrador te atenderá de inmediato.
              </p>
              
              <form className="live-chat-form" onSubmit={handleSendMessage}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Tu Nombre (Opcional)</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Ej: Carlos"
                    style={{ fontSize: '0.8rem', padding: '6px 10px' }}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Tu Mensaje</label>
                  <textarea
                    className="form-control"
                    rows="3"
                    placeholder="Escribe tu consulta aquí..."
                    style={{ fontSize: '0.8rem', padding: '6px 10px', resize: 'none' }}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    required
                  />
                </div>

                <button 
                  type="submit" 
                  className="btn btn-primary"
                  style={{ width: '100%', padding: '8px', fontSize: '0.8rem', marginTop: '5px', cursor: 'pointer' }}
                  disabled={sending}
                >
                  {sending ? 'Enviando...' : (!telegramToken || !telegramChatId ? '💬 Enviar por WhatsApp' : '🚀 Enviar Mensaje')}
                </button>
              </form>
            </div>
          )}
        </div>
      )}
    </>
  );
}

// Usuarios de personal por defecto para la administración
const DEFAULT_STAFF_USERS = [
  { email: 'admin@donhelado.com', name: 'Administrador Principal', role: 'Administrador', status: 'Activo', password: 'admin' },
  { email: 'vendedor@donhelado.com', name: 'Vendedor de Turno', role: 'Vendedor', status: 'Activo', password: '123' },
  { email: 'cocina@donhelado.com', name: 'Preparador de Cocina', role: 'Cocina', status: 'Activo', password: '123' }
];

export default function App() {
  const isRemoteUpdate = useRef({});
  const [isCloudSynced, setIsCloudSynced] = useState(false);
  const [isSyncLoaded, setIsSyncLoaded] = useState(false);

  const [qrCustomUrl, setQrCustomUrl] = useState(() => {
    return localStorage.getItem('helados_qr_custom_url') || '';
  });

  const [recommendations, setRecommendations] = useState(() => {
    const saved = localStorage.getItem('helados_recommendations');
    return saved ? JSON.parse(saved) : DEFAULT_RECOMMENDATIONS;
  });

  // --- NUEVO: Estado de Meta de Ventas centralizado en App.jsx ---
  const [salesGoal, setSalesGoal] = useState(() => {
    const saved = localStorage.getItem('helados_sales_goal');
    return saved ? parseFloat(saved) : 100.0;
  });

  const [whatsappGreeting, setWhatsappGreeting] = useState(() => {
    return localStorage.getItem('helados_whatsapp_greeting') || '¡Hola Don Helado! 🍦\nAcabo de realizar un pedido:';
  });

  const [whatsappFooter, setWhatsappFooter] = useState(() => {
    return localStorage.getItem('helados_whatsapp_footer') || 'Hecho desde la heladería interactiva.';
  });

  // --- Estados de Marca de la Heladería (Sincronizado con LocalStorage) ---
  const [storeName, setStoreName] = useState(() => {
    return localStorage.getItem('helados_store_name') || 'Don Helado';
  });

  const [storeLogo, setStoreLogo] = useState(() => {
    return localStorage.getItem('helados_store_logo') || '🍦';
  });

  // --- Estados de Datos de Tienda ---
  const [flavors, setFlavors] = useState(() => {
    const saved = localStorage.getItem('helados_flavors');
    return saved ? JSON.parse(saved) : INITIAL_FLAVORS;
  });

  const [toppings, setToppings] = useState(() => {
    const saved = localStorage.getItem('helados_toppings');
    return saved ? JSON.parse(saved) : INITIAL_TOPPINGS;
  });

  const [bases, setBases] = useState(() => {
    const saved = localStorage.getItem('helados_bases');
    return saved ? JSON.parse(saved) : INITIAL_BASES;
  });

  const [packs, setPacks] = useState(() => {
    const saved = localStorage.getItem('helados_packs');
    return saved ? JSON.parse(saved) : INITIAL_PACKS;
  });

  const [orders, setOrders] = useState(() => {
    const saved = localStorage.getItem('helados_orders');
    return saved ? JSON.parse(saved) : INITIAL_ORDERS;
  });

  const [deliveryFee, setDeliveryFee] = useState(() => {
    const saved = localStorage.getItem('helados_delivery_fee');
    return saved ? parseFloat(saved) : 2.0;
  });

  const [shopOpen, setShopOpen] = useState(() => {
    const saved = localStorage.getItem('helados_shop_open');
    return saved ? JSON.parse(saved) : true;
  });

  // --- Configuración Dinámica y Gestión de Usuarios ---
  const [freeDeliveryThreshold, setFreeDeliveryThreshold] = useState(() => {
    const saved = localStorage.getItem('helados_free_delivery_threshold');
    return saved ? parseFloat(saved) : 15.0; 
  });

  const [deliveryCampaignText, setDeliveryCampaignText] = useState(() => {
    return localStorage.getItem('helados_delivery_campaign_text') || '¡Arma tu helado con toppings o elige un pack promocional para no pagar envío!';
  });

  const [storePhone, setStorePhone] = useState(() => {
    const saved = localStorage.getItem('helados_store_phone');
    return saved || '51987654321'; 
  });

  const [staffUsers, setStaffUsers] = useState(() => {
    const saved = localStorage.getItem('helados_staff_users');
    return saved ? JSON.parse(saved) : DEFAULT_STAFF_USERS;
  });

  const [soundEnabled, setSoundEnabled] = useState(() => {
    const saved = localStorage.getItem('helados_sound_enabled');
    return saved ? JSON.parse(saved) : true;
  });

  // --- NUEVO: Estado de Seguridad Centralizado en App.jsx ---
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    return localStorage.getItem('helados_admin_logged_in') === 'true';
  });

  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('helados_admin_current_user');
    return saved ? JSON.parse(saved) : null;
  });

  // --- Estados de Integración de Notificaciones (Telegram) ---
  const [telegramToken, setTelegramToken] = useState(() => {
    return localStorage.getItem('helados_telegram_token') || '';
  });

  const [telegramChatId, setTelegramChatId] = useState(() => {
    return localStorage.getItem('helados_telegram_chat_id') || '';
  });

  // --- Estados de Cupones de Descuento (Manejado por Admin) ---
  const [coupons, setCoupons] = useState(() => {
    const saved = localStorage.getItem('helados_coupons');
    return saved ? JSON.parse(saved) : [
      { code: 'HELADO10', type: 'percentage', value: 10, description: '10% de descuento' },
      { code: 'ENVIOFREE', type: 'free_delivery', value: 0, description: 'Envío gratis' },
      { code: 'AHORRO5', type: 'flat', value: 5, description: 'S/. 5.00 de descuento' }
    ];
  });

  // --- NUEVO: Estado del Combo Recomendado del Carrito (Sincronizado) ---
  const [cartRecommendedPack, setCartRecommendedPack] = useState(() => {
    const saved = localStorage.getItem('helados_cart_recommended_pack');
    return saved ? JSON.parse(saved) : {
      active: true,
      name: 'Pack Dúo Romántico',
      price: 10.0,
      description: '2 Copas Waffle de 3 bolas + Fudge de chocolate gratis',
      id: 'pack_pareja'
    };
  });

  // --- NUEVO: Estado de Gastos y Egresos (Sincronizado) ---
  const [expenses, setExpenses] = useState(() => {
    const saved = localStorage.getItem('helados_expenses');
    return saved ? JSON.parse(saved) : [];
  });

  // --- Estados de Flujo de Cliente ---
  const [view, setView] = useState('shop'); 
  const [cart, setCart] = useState([]);
  const [activeOrderId, setActiveOrderId] = useState(() => {
    const saved = localStorage.getItem('helados_active_order_id');
    return saved || null;
  });
  
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('helados_theme');
    return saved || 'light';
  });

  // --- NUEVO: Efecto de Sincronización e Inicialización Supabase ---
  useEffect(() => {
    let activeChannel = null;
    let authSubscription = null;

    const initSync = async () => {
      if (!supabase) {
        console.log("💾 Supabase no configurado. Utilizando base de datos local (LocalStorage) en modo fuera de línea.");
        setIsSyncLoaded(true);
        return;
      }

      // 1. Verificar la sesión activa de Supabase al montar el componente
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (session) {
          console.log("🔑 Sesión activa de Supabase recuperada:", session.user.email);
          const userRole = session.user.user_metadata?.role || 'Administrador';
          const userName = session.user.user_metadata?.name || 'Administrador Supabase';
          setIsLoggedIn(true);
          setCurrentUser({
            email: session.user.email,
            role: userRole,
            name: userName,
            isSupabaseUser: true
          });
        } else {
          // Si el usuario guardado localmente es un usuario de Supabase, pero no hay sesión activa, cerramos sesión
          const savedUser = localStorage.getItem('helados_admin_current_user');
          if (savedUser) {
            const parsed = JSON.parse(savedUser);
            if (parsed && parsed.isSupabaseUser) {
              console.log("⚠️ Sesión de Supabase expirada. Limpiando estado de sesión.");
              setIsLoggedIn(false);
              setCurrentUser(null);
            }
          }
        }
      } catch (err) {
        console.error("Error al obtener la sesión de Supabase:", err);
      }
      
      const serverData = await fetchSyncedData();
      if (serverData) {
        console.log("🔌 Datos recuperados de Supabase:", Object.keys(serverData));
        setIsCloudSynced(true);
        
        // Desactivamos temporalmente escrituras mientras cargamos
        Object.keys(serverData).forEach(k => {
          isRemoteUpdate.current[k] = true;
        });

        if (serverData.store_name !== undefined) setStoreName(serverData.store_name);
        if (serverData.store_logo !== undefined) setStoreLogo(serverData.store_logo);
        if (serverData.flavors !== undefined) setFlavors(serverData.flavors);
        if (serverData.toppings !== undefined) setToppings(serverData.toppings);
        if (serverData.bases !== undefined) setBases(serverData.bases);
        if (serverData.packs !== undefined) setPacks(serverData.packs);
        if (serverData.orders !== undefined) setOrders(serverData.orders);
        if (serverData.delivery_fee !== undefined) setDeliveryFee(parseFloat(serverData.delivery_fee) || 0);
        if (serverData.shop_open !== undefined) setShopOpen(!!serverData.shop_open);
        if (serverData.free_delivery_threshold !== undefined) setFreeDeliveryThreshold(parseFloat(serverData.free_delivery_threshold) || 0);
        if (serverData.delivery_campaign_text !== undefined) setDeliveryCampaignText(serverData.delivery_campaign_text);
        if (serverData.store_phone !== undefined) setStorePhone(serverData.store_phone);
        if (serverData.sound_enabled !== undefined) setSoundEnabled(!!serverData.sound_enabled);
        if (serverData.coupons !== undefined) setCoupons(serverData.coupons);
        if (serverData.telegram_token !== undefined) setTelegramToken(serverData.telegram_token);
        if (serverData.telegram_chat_id !== undefined) setTelegramChatId(serverData.telegram_chat_id);
        if (serverData.sales_goal !== undefined) setSalesGoal(parseFloat(serverData.sales_goal) || 100.0);
        if (serverData.whatsapp_greeting !== undefined) setWhatsappGreeting(serverData.whatsapp_greeting);
        if (serverData.whatsapp_footer !== undefined) setWhatsappFooter(serverData.whatsapp_footer);
        if (serverData.qr_custom_url !== undefined) setQrCustomUrl(serverData.qr_custom_url);
        if (serverData.recommendations !== undefined) setRecommendations(serverData.recommendations);
        if (serverData.cart_recommended_pack !== undefined) setCartRecommendedPack(serverData.cart_recommended_pack);
        if (serverData.expenses !== undefined) setExpenses(serverData.expenses);
      }

      // 2. Recuperar la lista de personal desde Supabase de forma segura (multidispositivo)
      try {
        const { data: adminList, error: adminListError } = await supabase.rpc('get_all_admins');
        if (!adminListError && adminList) {
          console.log("👥 Personal recuperado de Supabase:", adminList.length);
          setStaffUsers(adminList);
        }
      } catch (err) {
        console.warn("⚠️ No se pudo obtener la lista de personal de Supabase:", err.message);
      }

      // Suscribirse a cambios en tiempo real
      activeChannel = subscribeToSync((key, value) => {
        const valueStr = JSON.stringify(value);
        
        // Marcar que es un cambio remoto para evitar re-escribir a la nube
        isRemoteUpdate.current[key] = true;

        switch (key) {
          case 'store_name':
            setStoreName(prev => JSON.stringify(prev) !== valueStr ? value : prev);
            break;
          case 'store_logo':
            setStoreLogo(prev => JSON.stringify(prev) !== valueStr ? value : prev);
            break;
          case 'flavors':
            setFlavors(prev => JSON.stringify(prev) !== valueStr ? value : prev);
            break;
          case 'toppings':
            setToppings(prev => JSON.stringify(prev) !== valueStr ? value : prev);
            break;
          case 'bases':
            setBases(prev => JSON.stringify(prev) !== valueStr ? value : prev);
            break;
          case 'packs':
            setPacks(prev => JSON.stringify(prev) !== valueStr ? value : prev);
            break;
          case 'orders':
            setOrders(prev => JSON.stringify(prev) !== valueStr ? value : prev);
            break;
          case 'delivery_fee':
            setDeliveryFee(prev => JSON.stringify(prev) !== valueStr ? value : prev);
            break;
          case 'shop_open':
            setShopOpen(prev => JSON.stringify(prev) !== valueStr ? value : prev);
            break;
          case 'free_delivery_threshold':
            setFreeDeliveryThreshold(prev => JSON.stringify(prev) !== valueStr ? value : prev);
            break;
          case 'delivery_campaign_text':
            setDeliveryCampaignText(prev => prev !== value ? value : prev);
            break;
          case 'store_phone':
            setStorePhone(prev => JSON.stringify(prev) !== valueStr ? value : prev);
            break;
          case 'staff_users':
            setStaffUsers(prev => JSON.stringify(prev) !== valueStr ? value : prev);
            break;
          case 'sound_enabled':
            setSoundEnabled(prev => JSON.stringify(prev) !== valueStr ? value : prev);
            break;
          case 'coupons':
            setCoupons(prev => JSON.stringify(prev) !== valueStr ? value : prev);
            break;
          case 'telegram_token':
            setTelegramToken(prev => JSON.stringify(prev) !== valueStr ? value : prev);
            break;
          case 'telegram_chat_id':
            setTelegramChatId(prev => JSON.stringify(prev) !== valueStr ? value : prev);
            break;
          case 'sales_goal':
            setSalesGoal(prev => JSON.stringify(prev) !== valueStr ? value : prev);
            break;
          case 'whatsapp_greeting':
            setWhatsappGreeting(prev => JSON.stringify(prev) !== valueStr ? value : prev);
            break;
          case 'whatsapp_footer':
            setWhatsappFooter(prev => JSON.stringify(prev) !== valueStr ? value : prev);
            break;
          case 'qr_custom_url':
            setQrCustomUrl(prev => prev !== value ? value : prev);
            break;
          case 'recommendations':
            setRecommendations(prev => JSON.stringify(prev) !== valueStr ? value : prev);
            break;
          case 'cart_recommended_pack':
            setCartRecommendedPack(prev => JSON.stringify(prev) !== valueStr ? value : prev);
            break;
          case 'expenses':
            setExpenses(prev => JSON.stringify(prev) !== valueStr ? value : prev);
            break;
          default:
            break;
        }
      });

      // 3. Suscribirse a cambios del estado de autenticación de Supabase
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        console.log(`🔔 Supabase Auth Evento: ${event}`);
        if (session) {
          const userRole = session.user.user_metadata?.role || 'Administrador';
          const userName = session.user.user_metadata?.name || 'Administrador Supabase';
          setIsLoggedIn(true);
          setCurrentUser({
            email: session.user.email,
            role: userRole,
            name: userName,
            isSupabaseUser: true
          });
          
          // Re-sincronizar los datos una vez que tenemos la sesión activa para poder ver las claves protegidas por RLS
          const updatedServerData = await fetchSyncedData();
          if (updatedServerData) {
            if (updatedServerData.staff_users !== undefined) setStaffUsers(updatedServerData.staff_users);
            if (updatedServerData.telegram_token !== undefined) setTelegramToken(updatedServerData.telegram_token);
            if (updatedServerData.telegram_chat_id !== undefined) setTelegramChatId(updatedServerData.telegram_chat_id);
          }
        } else {
          // Si el estado cambia a cerrado y el usuario actual era de Supabase, limpiamos el estado
          const savedUser = localStorage.getItem('helados_admin_current_user');
          if (savedUser) {
            const parsed = JSON.parse(savedUser);
            if (parsed && parsed.isSupabaseUser) {
              setIsLoggedIn(false);
              setCurrentUser(null);
            }
          }
        }
      });
      authSubscription = subscription;
      setIsSyncLoaded(true);
    };

    initSync();

    return () => {
      if (activeChannel && supabase) {
        supabase.removeChannel(activeChannel);
      }
      if (authSubscription) {
        authSubscription.unsubscribe();
      }
    };
  }, []);

  // --- Efectos de Persistencia ---
  useEffect(() => {
    localStorage.setItem('helados_store_name', storeName);
    document.title = `${storeName} - Heladería Online Interactiva`;
    if (!isSyncLoaded) return;
    if (isRemoteUpdate.current['store_name']) {
      isRemoteUpdate.current['store_name'] = false;
    } else {
      updateSyncedData('store_name', storeName);
    }
  }, [storeName, isSyncLoaded]);

  useEffect(() => {
    localStorage.setItem('helados_store_logo', storeLogo);
    if (!isSyncLoaded) return;
    if (isRemoteUpdate.current['store_logo']) {
      isRemoteUpdate.current['store_logo'] = false;
    } else {
      updateSyncedData('store_logo', storeLogo);
    }
  }, [storeLogo, isSyncLoaded]);

  useEffect(() => {
    localStorage.setItem('helados_flavors', JSON.stringify(flavors));
    if (!isSyncLoaded) return;
    if (isRemoteUpdate.current['flavors']) {
      isRemoteUpdate.current['flavors'] = false;
    } else {
      updateSyncedData('flavors', flavors);
    }
  }, [flavors, isSyncLoaded]);

  useEffect(() => {
    localStorage.setItem('helados_toppings', JSON.stringify(toppings));
    if (!isSyncLoaded) return;
    if (isRemoteUpdate.current['toppings']) {
      isRemoteUpdate.current['toppings'] = false;
    } else {
      updateSyncedData('toppings', toppings);
    }
  }, [toppings, isSyncLoaded]);

  useEffect(() => {
    localStorage.setItem('helados_bases', JSON.stringify(bases));
    if (!isSyncLoaded) return;
    if (isRemoteUpdate.current['bases']) {
      isRemoteUpdate.current['bases'] = false;
    } else {
      updateSyncedData('bases', bases);
    }
  }, [bases, isSyncLoaded]);

  useEffect(() => {
    localStorage.setItem('helados_packs', JSON.stringify(packs));
    if (!isSyncLoaded) return;
    if (isRemoteUpdate.current['packs']) {
      isRemoteUpdate.current['packs'] = false;
    } else {
      updateSyncedData('packs', packs);
    }
  }, [packs, isSyncLoaded]);

  useEffect(() => {
    localStorage.setItem('helados_orders', JSON.stringify(orders));
    if (!isSyncLoaded) return;
    if (isRemoteUpdate.current['orders']) {
      isRemoteUpdate.current['orders'] = false;
    } else {
      updateSyncedData('orders', orders);
    }
  }, [orders, isSyncLoaded]);

  useEffect(() => {
    localStorage.setItem('helados_delivery_fee', deliveryFee.toString());
    if (!isSyncLoaded) return;
    if (isRemoteUpdate.current['delivery_fee']) {
      isRemoteUpdate.current['delivery_fee'] = false;
    } else {
      updateSyncedData('delivery_fee', deliveryFee);
    }
  }, [deliveryFee, isSyncLoaded]);

  useEffect(() => {
    localStorage.setItem('helados_shop_open', JSON.stringify(shopOpen));
    if (!isSyncLoaded) return;
    if (isRemoteUpdate.current['shop_open']) {
      isRemoteUpdate.current['shop_open'] = false;
    } else {
      updateSyncedData('shop_open', shopOpen);
    }
  }, [shopOpen, isSyncLoaded]);

  useEffect(() => {
    localStorage.setItem('helados_free_delivery_threshold', freeDeliveryThreshold.toString());
    if (!isSyncLoaded) return;
    if (isRemoteUpdate.current['free_delivery_threshold']) {
      isRemoteUpdate.current['free_delivery_threshold'] = false;
    } else {
      updateSyncedData('free_delivery_threshold', freeDeliveryThreshold);
    }
  }, [freeDeliveryThreshold, isSyncLoaded]);

  useEffect(() => {
    localStorage.setItem('helados_delivery_campaign_text', deliveryCampaignText);
    if (!isSyncLoaded) return;
    if (isRemoteUpdate.current['delivery_campaign_text']) {
      isRemoteUpdate.current['delivery_campaign_text'] = false;
    } else {
      updateSyncedData('delivery_campaign_text', deliveryCampaignText);
    }
  }, [deliveryCampaignText, isSyncLoaded]);

  useEffect(() => {
    localStorage.setItem('helados_store_phone', storePhone);
    if (!isSyncLoaded) return;
    if (isRemoteUpdate.current['store_phone']) {
      isRemoteUpdate.current['store_phone'] = false;
    } else {
      updateSyncedData('store_phone', storePhone);
    }
  }, [storePhone, isSyncLoaded]);

  useEffect(() => {
    localStorage.setItem('helados_staff_users', JSON.stringify(staffUsers));
    // El personal ahora se administra de forma segura multidispositivo con RPCs
  }, [staffUsers]);

  useEffect(() => {
    localStorage.setItem('helados_sound_enabled', JSON.stringify(soundEnabled));
    if (!isSyncLoaded) return;
    if (isRemoteUpdate.current['sound_enabled']) {
      isRemoteUpdate.current['sound_enabled'] = false;
    } else {
      updateSyncedData('sound_enabled', soundEnabled);
    }
  }, [soundEnabled, isSyncLoaded]);

  useEffect(() => {
    localStorage.setItem('helados_telegram_token', telegramToken);
    if (!isSyncLoaded) return;
    if (isRemoteUpdate.current['telegram_token']) {
      isRemoteUpdate.current['telegram_token'] = false;
    } else {
      updateSyncedData('telegram_token', telegramToken);
    }
  }, [telegramToken, isSyncLoaded]);

  useEffect(() => {
    localStorage.setItem('helados_telegram_chat_id', telegramChatId);
    if (!isSyncLoaded) return;
    if (isRemoteUpdate.current['telegram_chat_id']) {
      isRemoteUpdate.current['telegram_chat_id'] = false;
    } else {
      updateSyncedData('telegram_chat_id', telegramChatId);
    }
  }, [telegramChatId, isSyncLoaded]);

  useEffect(() => {
    localStorage.setItem('helados_coupons', JSON.stringify(coupons));
    if (!isSyncLoaded) return;
    if (isRemoteUpdate.current['coupons']) {
      isRemoteUpdate.current['coupons'] = false;
    } else {
      updateSyncedData('coupons', coupons);
    }
  }, [coupons, isSyncLoaded]);

  useEffect(() => {
    localStorage.setItem('helados_sales_goal', salesGoal.toString());
    if (!isSyncLoaded) return;
    if (isRemoteUpdate.current['sales_goal']) {
      isRemoteUpdate.current['sales_goal'] = false;
    } else {
      updateSyncedData('sales_goal', salesGoal);
    }
  }, [salesGoal, isSyncLoaded]);

  useEffect(() => {
    localStorage.setItem('helados_whatsapp_greeting', whatsappGreeting);
    if (!isSyncLoaded) return;
    if (isRemoteUpdate.current['whatsapp_greeting']) {
      isRemoteUpdate.current['whatsapp_greeting'] = false;
    } else {
      updateSyncedData('whatsapp_greeting', whatsappGreeting);
    }
  }, [whatsappGreeting, isSyncLoaded]);

  useEffect(() => {
    localStorage.setItem('helados_whatsapp_footer', whatsappFooter);
    if (!isSyncLoaded) return;
    if (isRemoteUpdate.current['whatsapp_footer']) {
      isRemoteUpdate.current['whatsapp_footer'] = false;
    } else {
      updateSyncedData('whatsapp_footer', whatsappFooter);
    }
  }, [whatsappFooter, isSyncLoaded]);

  useEffect(() => {
    localStorage.setItem('helados_qr_custom_url', qrCustomUrl);
    if (!isSyncLoaded) return;
    if (isRemoteUpdate.current['qr_custom_url']) {
      isRemoteUpdate.current['qr_custom_url'] = false;
    } else {
      updateSyncedData('qr_custom_url', qrCustomUrl);
    }
  }, [qrCustomUrl, isSyncLoaded]);

  useEffect(() => {
    localStorage.setItem('helados_recommendations', JSON.stringify(recommendations));
    if (!isSyncLoaded) return;
    if (isRemoteUpdate.current['recommendations']) {
      isRemoteUpdate.current['recommendations'] = false;
    } else {
      updateSyncedData('recommendations', recommendations);
    }
  }, [recommendations, isSyncLoaded]);

  useEffect(() => {
    localStorage.setItem('helados_cart_recommended_pack', JSON.stringify(cartRecommendedPack));
    if (!isSyncLoaded) return;
    if (isRemoteUpdate.current['cart_recommended_pack']) {
      isRemoteUpdate.current['cart_recommended_pack'] = false;
    } else {
      updateSyncedData('cart_recommended_pack', cartRecommendedPack);
    }
  }, [cartRecommendedPack, isSyncLoaded]);

  useEffect(() => {
    localStorage.setItem('helados_expenses', JSON.stringify(expenses));
    if (!isSyncLoaded) return;
    if (isRemoteUpdate.current['expenses']) {
      isRemoteUpdate.current['expenses'] = false;
    } else {
      updateSyncedData('expenses', expenses);
    }
  }, [expenses, isSyncLoaded]);

  // Persistir Estados de Sesión de Admin
  useEffect(() => {
    localStorage.setItem('helados_admin_logged_in', isLoggedIn.toString());
  }, [isLoggedIn]);

  // Control de Expiración de Sesión de Admin (10 Días)
  useEffect(() => {
    if (isLoggedIn) {
      const loginTime = localStorage.getItem('helados_admin_login_timestamp');
      if (loginTime) {
        const elapsed = Date.now() - parseInt(loginTime, 10);
        const tenDaysMs = 10 * 24 * 60 * 60 * 1000; // 10 días en milisegundos
        if (elapsed > tenDaysMs) {
          console.log("🔒 Sesión caducada tras 10 días. Cerrando sesión automáticamente...");
          alert("🔒 Por razones de seguridad, tu sesión administrativa ha expirado tras 10 días de uso continuo. Por favor, inicia sesión de nuevo.");
          handleLogout();
        }
      } else {
        localStorage.setItem('helados_admin_login_timestamp', Date.now().toString());
      }
    }
  }, [isLoggedIn]);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('helados_admin_current_user', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('helados_admin_current_user');
    }
  }, [currentUser]);

  useEffect(() => {
    if (activeOrderId) {
      localStorage.setItem('helados_active_order_id', activeOrderId);
    } else {
      localStorage.removeItem('helados_active_order_id');
    }
  }, [activeOrderId]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('helados_theme', theme);
  }, [theme]);

  // --- Funciones del Carrito ---
  const handleAddToCart = (item) => {
    if (!shopOpen) {
      alert(`Lo sentimos, ${storeName} se encuentra CERRADO temporalmente en este momento.`);
      return;
    }

    if (item.type === 'pack') {
      const idx = cart.findIndex(i => i.type === 'pack' && i.id === item.id);
      if (idx !== -1) {
        const newCart = [...cart];
        newCart[idx].quantity += 1;
        setCart(newCart);
        alert(`Se incrementó la cantidad del ${item.name} en el carrito.`);
        return;
      }
    } else if (item.type === 'custom') {
      const idx = cart.findIndex(i => {
        if (i.type !== 'custom') return false;
        if (i.base.id !== item.base.id) return false;
        if (i.scoops.length !== item.scoops.length) return false;
        if (i.toppings.length !== item.toppings.length) return false;
        if (i.syrup?.id !== item.syrup?.id) return false;

        const sameScoops = i.scoops.every((s, sIdx) => s.id === item.scoops[sIdx].id);
        const sameToppings = i.toppings.every((t, tIdx) => t.id === item.toppings[tIdx].id);

        return sameScoops && sameToppings;
      });

      if (idx !== -1) {
        const newCart = [...cart];
        newCart[idx].quantity += 1;
        setCart(newCart);
        alert(`Se incrementó la cantidad de tu helado personalizado idéntico.`);
        return;
      }
    }

    setCart([...cart, item]);
    alert("¡Helado añadido al carrito exitosamente!");
  };

  const handleUpdateCartQuantity = (index, newQty) => {
    if (newQty <= 0) {
      handleRemoveFromCart(index);
      return;
    }
    const newCart = [...cart];
    newCart[index].quantity = newQty;
    setCart(newCart);
  };

  const handleRemoveFromCart = (index) => {
    const newCart = cart.filter((_, idx) => idx !== index);
    setCart(newCart);
  };

  const handlePlaceOrder = (newOrder) => {
    setOrders([newOrder, ...orders]);
    setCart([]);
    setActiveOrderId(newOrder.id);
    setView('tracker');
  };

  const handleUpdateOrderStatus = (orderId, newStatus) => {
    const updated = orders.map(o => o.id === orderId ? { ...o, status: newStatus } : o);
    setOrders(updated);
  };

  const handleLogout = async () => {
    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.warn("Error al cerrar sesión en Supabase:", err.message);
      }
    }
    setIsLoggedIn(false);
    setCurrentUser(null);
    setView('shop'); // Redirige a la tienda al cerrar sesión
  };

  const totalCartItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  // Easter Egg: Doble clic en logotipo abre login administrativo
  const handleLogoDoubleClick = () => {
    setView('admin');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      
      {/* Barra de Navegación (Cabecera Principal) */}
      <nav className="navbar glass">
        <div className="container nav-container">
          <a 
            href="#" 
            className="logo" 
            onClick={(e) => { e.preventDefault(); setView('shop'); }}
            onDoubleClick={handleLogoDoubleClick}
            title="Doble clic para administrar"
            style={{ cursor: 'pointer' }}
          >
            {renderLogo(storeLogo)}
            <span>{storeName}</span>
          </a>

          {/* Menú de Navegación para Escritorio */}
          <div className="nav-links desktop-only">
            <button 
              className={`nav-btn ${view === 'shop' ? 'active' : ''}`}
              onClick={() => setView('shop')}
            >
              🍨 Tienda
            </button>
            <button 
              className={`nav-btn ${view === 'customizer' ? 'active' : ''}`}
              onClick={() => setView('customizer')}
            >
              🎨 Personalizar
            </button>
            <button 
              className={`nav-btn ${view === 'cart' ? 'active' : ''}`}
              onClick={() => setView('cart')}
            >
              🛒 Carrito 
              {totalCartItems > 0 && <span className="cart-badge">{totalCartItems}</span>}
            </button>
            <button 
              className={`nav-btn ${view === 'tracker' ? 'active' : ''}`}
              onClick={() => setView('tracker')}
            >
              🔍 Rastrear
            </button>
            
            {isLoggedIn && (
              <button 
                className={`nav-btn ${view === 'admin' ? 'active' : ''}`}
                onClick={() => setView('admin')}
                style={{ borderLeft: '1px solid var(--border-color)', borderRadius: 0, paddingLeft: '15px' }}
              >
                🔧 Panel Admin
              </button>
            )}
            
            <button 
              onClick={toggleTheme} 
              className="nav-btn"
              style={{ fontSize: '1.1rem', padding: '6px' }}
              title="Cambiar Tema"
            >
              {theme === 'light' ? '🌙' : '☀️'}
            </button>

            {isLoggedIn && (
              <button 
                onClick={handleLogout} 
                className="nav-btn logout-desktop-btn"
                title="Cerrar Sesión"
              >
                🚪 Cerrar Sesión
              </button>
            )}
          </div>

          {/* Acciones Rápidas de Cabecera para Móvil */}
          <div className="mobile-header-actions">
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
        {!shopOpen && view !== 'admin' && (
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
            🔒 En este momento estamos fuera de horario de atención. Puedes explorar el menú o administrar la tienda, pero no se aceptan pedidos.
          </div>
        )}

        {view === 'shop' && (
          <CustomerShop 
            flavors={flavors}
            packs={packs}
            onAddToCart={handleAddToCart}
            setView={setView}
            storeName={storeName}
            freeDeliveryThreshold={freeDeliveryThreshold}
            deliveryCampaignText={deliveryCampaignText}
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
            storePhone={storePhone}
            storeName={storeName}
            coupons={coupons}
            salesGoal={salesGoal}
            whatsappGreeting={whatsappGreeting}
            whatsappFooter={whatsappFooter}
            cartRecommendedPack={cartRecommendedPack}
          />
        )}

        {view === 'tracker' && (
          <OrderTracker 
            orderId={activeOrderId}
            orders={orders}
            setView={setView}
            storePhone={storePhone}
          />
        )}

        {view === 'admin' && (
          <AdminPanel 
            orders={orders}
            onUpdateOrderStatus={handleUpdateOrderStatus}
            flavors={flavors}
            onUpdateFlavors={setFlavors}
            toppings={toppings}
            onUpdateToppings={setToppings}
            bases={bases}
            onUpdateBases={setBases}
            packs={packs}
            onUpdatePacks={setPacks}
            deliveryFee={deliveryFee}
            onChangeDeliveryFee={setDeliveryFee}
            shopOpen={shopOpen}
            onToggleShopOpen={() => setShopOpen(!shopOpen)}
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
            coupons={coupons}
            onUpdateCoupons={setCoupons}
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
            onUpdateExpenses={setExpenses}
            onUpdateOrders={setOrders}
            cartRecommendedPack={cartRecommendedPack}
            onUpdateCartRecommendedPack={setCartRecommendedPack}
          />
        )}
      </main>

      {/* 🔑 PIE DE PÁGINA (Footer) CON ACCESO DISCRETO */}
      <footer style={{
        textAlign: 'center',
        padding: '15px',
        fontSize: '0.8rem',
        color: 'var(--text-light)',
        borderTop: '1px solid var(--border-color)',
        background: 'var(--bg-secondary)',
        marginTop: 'auto',
        marginBottom: '65px' // Espacio para evitar que tape la barra inferior en móvil
      }}>
        <div>&copy; {new Date().getFullYear()} {storeName} - Todos los derechos reservados.</div>
        <div style={{ marginTop: '5px' }}>
          Hecho con mucho 💖 para heladeros artesanos.
          <button 
            onClick={() => setView('admin')}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-light)',
              fontSize: '0.75rem',
              marginLeft: '10px',
              opacity: 0.3
            }}
            title="Acceso administrativo"
          >
            🔑
          </button>
        </div>
      </footer>

      {/* 📱 BARRA DE NAVEGACIÓN INFERIOR PARA MÓVIL (Bottom Tab Bar) */}
      <nav className="mobile-tab-bar glass">
        <button 
          className={`tab-item ${view === 'shop' ? 'active' : ''}`}
          onClick={() => setView('shop')}
        >
          <span className="tab-icon">🍨</span>
          <span className="tab-label">Tienda</span>
        </button>
        <button 
          className={`tab-item ${view === 'customizer' ? 'active' : ''}`}
          onClick={() => setView('customizer')}
        >
          <span className="tab-icon">🎨</span>
          <span className="tab-label">Diseñar</span>
        </button>
        <button 
          className={`tab-item ${view === 'cart' ? 'active' : ''}`}
          onClick={() => setView('cart')}
        >
          <span className="tab-icon" style={{ position: 'relative' }}>
            🛒
            {totalCartItems > 0 && (
              <span className="tab-badge">{totalCartItems}</span>
            )}
          </span>
          <span className="tab-label">Carrito</span>
        </button>
        <button 
          className={`tab-item ${view === 'tracker' ? 'active' : ''}`}
          onClick={() => setView('tracker')}
        >
          <span className="tab-icon">🔍</span>
          <span className="tab-label">Rastrear</span>
        </button>
        {isLoggedIn && (
          <button 
            className={`tab-item ${view === 'admin' ? 'active' : ''}`}
            onClick={() => setView('admin')}
          >
            <span className="tab-icon">🔧</span>
            <span className="tab-label">Admin</span>
          </button>
        )}
      </nav>

      {/* 💬 Burbuja de Chat Puente a Telegram */}
      <LiveChatTelegramBridge 
        telegramToken={telegramToken}
        telegramChatId={telegramChatId}
        storePhone={storePhone}
        storeName={storeName}
        view={view}
      />

    </div>
  );
}
