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
import LiterCustomizer from './components/LiterCustomizer';
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
function LiveChatTelegramBridge({ telegramToken, telegramChatId, storePhone, storeName, view, hasFloatingCart }) {
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
          bottom: ${hasFloatingCart ? '145px' : '85px'};
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
          transition: bottom 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), box-shadow 0.3s ease;
        }
        .live-chat-bubble:hover {
          transform: scale(1.1);
          box-shadow: 0 6px 20px rgba(255, 107, 129, 0.5);
        }
        .live-chat-window {
          position: fixed;
          bottom: ${hasFloatingCart ? '215px' : '155px'};
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
          transition: bottom 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
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
  { email: 'vendedor@donhelado.com', name: 'Vendedor de Turno', role: 'Vendedor', status: 'Activo', password: '123' },
  { email: 'cocina@donhelado.com', name: 'Preparador de Cocina', role: 'Cocina', status: 'Activo', password: '123' }
];

export default function App() {
  const isRemoteUpdate = useRef({});
  const allowCloudWrite = useRef(false);
  const [isCloudSynced, setIsCloudSynced] = useState(false);
  const [isSyncLoaded, setIsSyncLoaded] = useState(false);

  const [customAlert, setCustomAlert] = useState(null); // { title: string, message: string, type: 'info' | 'warning' | 'error' | 'success', onClose?: () => void }

  const showAlert = (title, message, type = 'info', onClose = null) => {
    setCustomAlert({ title, message, type, onClose });
  };

  // Local alert override for App.jsx
  const alert = (msg) => {
    const isError = msg.toLowerCase().includes('error') || msg.toLowerCase().includes('falló') || msg.toLowerCase().includes('cerrado');
    const isSuccess = msg.toLowerCase().includes('éxito') || msg.toLowerCase().includes('añadido') || msg.toLowerCase().includes('incrementó');
    const type = isError ? 'error' : isSuccess ? 'success' : 'warning';
    const title = isError ? 'Error' : isSuccess ? 'Excelente' : 'Aviso';
    showAlert(title, msg, type);
  };

  const [qrCustomUrl, setQrCustomUrl] = useState(() => {
    return localStorage.getItem('helados_qr_custom_url') || '';
  });

  const [r2Config, setR2Config] = useState(() => {
    const saved = localStorage.getItem('helados_r2_config');
    return saved ? JSON.parse(saved) : {
      accountId: '',
      accessKeyId: '',
      secretAccessKey: '',
      bucketName: '',
      publicUrl: ''
    };
  });

  const [literConfig, setLiterConfig] = useState(() => {
    const saved = localStorage.getItem('helados_liter_config');
    return saved ? JSON.parse(saved) : {
      active: true,
      price: 15.0,
      maxFlavors: 3,
      image: ''
    };
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

  // --- NUEVO: Estado del mensaje personalizado de comanda ---
  const [ticketCustomMessage, setTicketCustomMessage] = useState(() => {
    return localStorage.getItem('helados_ticket_custom_message') || '¡Gracias por preferirnos! Conserva tu helado en el congelador para mantener su textura perfecta. 🍦';
  });

  // --- NUEVO: Estado de Ordenamiento del Catálogo de la Carta (Sincronizado) ---
  const [catalogOrder, setCatalogOrder] = useState(() => {
    const saved = localStorage.getItem('helados_catalog_order');
    return saved ? JSON.parse(saved) : ['liter', 'classic', 'packs'];
  });

  // --- Estados de Marca de la Heladería (Sincronizado con LocalStorage) ---
  const [storeName, setStoreName] = useState(() => {
    return localStorage.getItem('helados_store_name') || 'Don Helado';
  });

  const [storeLogo, setStoreLogo] = useState(() => {
    return localStorage.getItem('helados_store_logo') || '🍦';
  });

  const [storeTitle, setStoreTitle] = useState(() => {
    return localStorage.getItem('helados_store_title') || 'Don Helado - Heladería Online & Delivery de Helados Artesanales';
  });

  const [storeFavicon, setStoreFavicon] = useState(() => {
    return localStorage.getItem('helados_store_favicon') || '🍦';
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

  const [staffPermissions, setStaffPermissions] = useState(() => {
    const saved = localStorage.getItem('helados_staff_permissions');
    return saved ? JSON.parse(saved) : {};
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

  // --- NUEVO: Rastrear automáticamente desde la URL (?track=PED-XXXX) ---
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const trackId = params.get('track') || params.get('orderId');
    if (trackId) {
      setActiveOrderId(trackId);
      setView('tracker');
    }
  }, []);

  // --- Función auxiliar para aplicar los datos sincronizados y combinar las órdenes ---
  const applyLoadedData = (serverData) => {
    if (serverData.store_name !== undefined) setStoreName(serverData.store_name);
    if (serverData.store_logo !== undefined) setStoreLogo(serverData.store_logo);
    if (serverData.store_title !== undefined) setStoreTitle(serverData.store_title);
    if (serverData.store_favicon !== undefined) setStoreFavicon(serverData.store_favicon);
    if (serverData.flavors !== undefined) setFlavors(serverData.flavors);
    if (serverData.toppings !== undefined) setToppings(serverData.toppings);
    if (serverData.bases !== undefined) setBases(serverData.bases);
    if (serverData.packs !== undefined) setPacks(serverData.packs);

    // Combinar órdenes generales e individuales order_PED-XXXX de forma única por ID y ordenar desc
    let initialOrders = serverData.orders || [];
    const individualOrders = [];
    Object.keys(serverData).forEach(k => {
      if (k.startsWith('order_') && serverData[k]) {
        individualOrders.push(serverData[k]);
      }
    });

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
    if (serverData.staff_permissions !== undefined) setStaffPermissions(serverData.staff_permissions);
    if (serverData.r2_config !== undefined) setR2Config(serverData.r2_config);
    if (serverData.liter_config !== undefined) setLiterConfig(serverData.liter_config);
    if (serverData.ticket_custom_message !== undefined) setTicketCustomMessage(serverData.ticket_custom_message);
    if (serverData.catalog_order !== undefined) setCatalogOrder(serverData.catalog_order);
  };

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
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (session) {
          console.log("🔑 Sesión activa de Supabase recuperada:", session.user.email);
          hasActiveSession = true;
          const userRole = session.user.user_metadata?.role || 'Administrador';
          const userName = session.user.user_metadata?.name || 'Administrador Supabase';
          setIsLoggedIn(true);
          setCurrentUser({
            email: session.user.email,
            role: userRole,
            name: userName,
            isSupabaseUser: true
          });
        }
      } catch (err) {
        console.error("Error al obtener la sesión de Supabase:", err);
      }
      
      const serverData = await fetchSyncedData(hasActiveSession || isLoggedIn);
      if (serverData) {
        console.log("🔌 Datos recuperados de Supabase:", Object.keys(serverData));
        setIsCloudSynced(true);
        
        // Desactivamos temporalmente escrituras mientras cargamos
        Object.keys(serverData).forEach(k => {
          isRemoteUpdate.current[k] = true;
        });

        applyLoadedData(serverData);

        // Habilitar escrituras después de que las actualizaciones del estado de React se procesen
        setTimeout(() => {
          allowCloudWrite.current = true;
        }, 400);
      } else {
        console.warn("⚠️ No se pudieron obtener datos de Supabase. Escrituras remotas desactivadas para proteger la base de datos.");
        allowCloudWrite.current = false;
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

      // La suscripción en tiempo real ahora se maneja de forma reactiva y separada
      // en un useEffect independiente para evitar condiciones de carrera.

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
          
          // Re-sincronizar los datos una vez que tenemos la sesión activa de forma segura
          allowCloudWrite.current = false;
          setIsSyncLoaded(false);
          const updatedServerData = await fetchSyncedData(true);
          if (updatedServerData) {
            // Desactivar temporalmente escrituras mientras cargamos datos de admin
            Object.keys(updatedServerData).forEach(k => {
              isRemoteUpdate.current[k] = true;
            });
            applyLoadedData(updatedServerData);
            if (updatedServerData.staff_users !== undefined) setStaffUsers(updatedServerData.staff_users);
            
            setTimeout(() => {
              allowCloudWrite.current = true;
            }, 400);
          } else {
            allowCloudWrite.current = false;
          }
          setIsSyncLoaded(true);
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
  }, [isLoggedIn]);

  // --- Hook de Sincronización Consolidado y Seguro ---
  const useSyncEffect = (key, value, isJSON = false) => {
    const prevValueRef = useRef(value);

    useEffect(() => {
      // 1. Guardar en localStorage
      const valueStr = isJSON ? JSON.stringify(value) : String(value);
      localStorage.setItem(`helados_${key}`, valueStr);

      // 2. Si los datos no se han cargado de la nube o no está permitido escribir, salir
      if (!isSyncLoaded || !allowCloudWrite.current) {
        prevValueRef.current = value;
        return;
      }

      // 3. Comprobar si el valor realmente cambió localmente
      const hasChanged = isJSON 
        ? JSON.stringify(prevValueRef.current) !== valueStr
        : prevValueRef.current !== value;

      if (!hasChanged) return;

      prevValueRef.current = value;

      // 4. Si es una actualización remota, limpiar bandera y no re-escribir
      if (isRemoteUpdate.current[key]) {
        isRemoteUpdate.current[key] = false;
        return;
      }

      // 5. Si está logueado, subir a la nube de forma segura
      if (isLoggedIn) {
        updateSyncedData(key, value);
      }
    }, [value, isLoggedIn, isSyncLoaded]);
  };

  // --- Invocaciones de Sincronización de Estados ---
  useSyncEffect('store_name', storeName, false);
  useSyncEffect('store_title', storeTitle, false);
  useSyncEffect('store_favicon', storeFavicon, false);
  useSyncEffect('catalog_order', catalogOrder, true);
  useSyncEffect('store_logo', storeLogo, false);
  useSyncEffect('flavors', flavors, true);
  useSyncEffect('toppings', toppings, true);
  useSyncEffect('bases', bases, true);
  useSyncEffect('packs', packs, true);
  useSyncEffect('orders', orders, true);
  useSyncEffect('delivery_fee', deliveryFee, false);
  useSyncEffect('shop_open', shopOpen, true);
  useSyncEffect('free_delivery_threshold', freeDeliveryThreshold, false);
  useSyncEffect('delivery_campaign_text', deliveryCampaignText, false);
  useSyncEffect('store_phone', storePhone, false);
  useSyncEffect('staff_permissions', staffPermissions, true);
  useSyncEffect('sound_enabled', soundEnabled, true);
  useSyncEffect('telegram_token', telegramToken, false);
  useSyncEffect('telegram_chat_id', telegramChatId, false);
  useSyncEffect('coupons', coupons, true);
  useSyncEffect('sales_goal', salesGoal, false);
  useSyncEffect('whatsapp_greeting', whatsappGreeting, false);
  useSyncEffect('whatsapp_footer', whatsappFooter, false);
  useSyncEffect('qr_custom_url', qrCustomUrl, false);
  useSyncEffect('recommendations', recommendations, true);
  useSyncEffect('cart_recommended_pack', cartRecommendedPack, true);
  useSyncEffect('expenses', expenses, true);
  useSyncEffect('r2_config', r2Config, true);
  useSyncEffect('liter_config', literConfig, true);
  useSyncEffect('ticket_custom_message', ticketCustomMessage, false);

  // --- Efectos para actualizar el título y favicon dinámicamente ---
  useEffect(() => {
    const activeTitle = storeTitle || `${storeName || 'Don Helado'} - Heladería Online & Delivery de Helados Artesanales`;
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
    localStorage.setItem('helados_staff_users', JSON.stringify(staffUsers));
  }, [staffUsers]);

  // --- Suscripción Reactiva en Tiempo Real (Supabase Realtime) ---
  useEffect(() => {
    if (!supabase || !isSyncLoaded) return;
    
    console.log(`🔌 Suscribiendo canal en tiempo real. ¿Es Admin?: ${isLoggedIn}`);

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
      if (key.startsWith('order_') && value) {
        setOrders(prev => {
          const exists = prev.some(o => o.id === value.id);
          if (exists) {
            const hasChanged = JSON.stringify(prev.find(o => o.id === value.id)) !== JSON.stringify(value);
            if (hasChanged) {
              isRemoteUpdate.current[key] = true;
              return prev.map(o => o.id === value.id ? value : o);
            }
            return prev;
          } else {
            isRemoteUpdate.current[key] = true;
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
        case 'orders':
          updateStateIfChanged(setOrders, 'orders', value);
          break;
        case 'delivery_fee':
          updateStateIfChanged(setDeliveryFee, 'delivery_fee', value);
          break;
        case 'shop_open':
          updateStateIfChanged(setShopOpen, 'shop_open', value);
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
        case 'telegram_token':
          updateStateIfChanged(setTelegramToken, 'telegram_token', value);
          break;
        case 'telegram_chat_id':
          updateStateIfChanged(setTelegramChatId, 'telegram_chat_id', value);
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
        case 'staff_permissions':
          updateStateIfChanged(setStaffPermissions, 'staff_permissions', value);
          break;
        case 'r2_config':
          updateStateIfChanged(setR2Config, 'r2_config', value);
          break;
        case 'liter_config':
          updateStateIfChanged(setLiterConfig, 'liter_config', value);
          break;
        case 'ticket_custom_message':
          updateStateIfChanged(setTicketCustomMessage, 'ticket_custom_message', value);
          break;
        default:
          break;
      }
    }, isLoggedIn);

    return () => {
      if (supabase && activeChannel) {
        supabase.removeChannel(activeChannel);
      }
    };
  }, [isLoggedIn, isSyncLoaded]);

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
    } else if (item.type === 'liter') {
      const idx = cart.findIndex(i => {
        if (i.type !== 'liter') return false;
        if (i.scoops.length !== item.scoops.length) return false;
        
        // Compare scoops sorted or in the exact same order
        return i.scoops.every((s, sIdx) => s.id === item.scoops[sIdx].id);
      });

      if (idx !== -1) {
        const newCart = [...cart];
        newCart[idx].quantity += 1;
        setCart(newCart);
        alert(`Se incrementó la cantidad de tu helado de 1 Litro idéntico.`);
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

  const handlePlaceOrder = async (newOrder) => {
    setOrders(prev => [newOrder, ...prev]);
    setCart([]);
    setActiveOrderId(newOrder.id);
    setView('tracker');
    
    // Subir el pedido individual bajo su propia clave para evitar descargar toda la lista de otros clientes
    await updateSyncedData(`order_${newOrder.id}`, newOrder);
  };

  const handleUpdateOrderStatus = async (orderId, newStatus) => {
    const updated = orders.map(o => {
      if (o.id === orderId) {
        const history = o.statusHistory || [{ status: 'Pendiente', timestamp: o.date || new Date().toISOString() }];
        const newHistory = [...history, { status: newStatus, timestamp: new Date().toISOString() }];
        return { ...o, status: newStatus, statusHistory: newHistory };
      }
      return o;
    });
    setOrders(updated);

    // Actualizar el pedido individual en la nube para que el cliente reciba la actualización en tiempo real en su rastreador
    const targetOrder = orders.find(o => o.id === orderId);
    if (targetOrder) {
      const history = targetOrder.statusHistory || [{ status: 'Pendiente', timestamp: targetOrder.date || new Date().toISOString() }];
      const newHistory = [...history, { status: newStatus, timestamp: new Date().toISOString() }];
      const updatedOrder = { ...targetOrder, status: newStatus, statusHistory: newHistory };
      await updateSyncedData(`order_${orderId}`, updatedOrder);
    }
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
            literConfig={literConfig}
            catalogOrder={catalogOrder}
            storePhone={storePhone}
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
            storePhone={storePhone}
            storeName={storeName}
            coupons={coupons}
            salesGoal={salesGoal}
            whatsappGreeting={whatsappGreeting}
            whatsappFooter={whatsappFooter}
            cartRecommendedPack={cartRecommendedPack}
            literConfig={literConfig}
            showAlert={showAlert}
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
              localStorage.removeItem('helados_active_order_id');
            }}
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
            onToggleShopOpen={(val) => setShopOpen(typeof val === 'boolean' ? val : !shopOpen)}
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
            showAlert={showAlert}
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
        hasFloatingCart={cart.length > 0 && view !== 'cart' && view !== 'admin'}
      />

      {/* Floating Cart Toast/Window */}
      {cart.length > 0 && view !== 'cart' && view !== 'admin' && (
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.2rem' }}>🛒</span>
            <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-dark)' }}>
              Tienes {totalCartItems} {totalCartItems === 1 ? 'helado' : 'helados'} en el carrito
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
            Finalizar Compra ➔
          </button>
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
          <div className="glass alert-modal-content" style={{
            width: '90%',
            maxWidth: '400px',
            background: 'var(--glass-bg, rgba(255, 255, 255, 0.95))',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-lg)',
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
            
            <h3 style={{
              margin: 0,
              fontSize: '1.4rem',
              color: 'var(--text-dark)',
              fontFamily: 'var(--font-title)'
            }}>
              {customAlert.title}
            </h3>
            
            <p style={{
              margin: 0,
              fontSize: '0.9rem',
              color: 'var(--text-light)',
              lineHeight: '1.5'
            }}>
              {customAlert.message}
            </p>
            
            <button 
              className="btn btn-primary"
              onClick={() => {
                const cb = customAlert.onClose;
                setCustomAlert(null);
                if (cb) cb();
              }}
              style={{
                width: '100%',
                padding: '10px',
                fontSize: '0.95rem',
                borderRadius: '50px',
                marginTop: '5px'
              }}
            >
              Aceptar
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
