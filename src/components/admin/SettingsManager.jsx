import React, { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabaseClient';
import { uploadToR2 } from '../../utils/r2Client';
import { updateMultipleSyncedData } from '../../utils/supabaseSync';

// --- FUNCIONES DE SANITIZACIÓN ---
const sanitizeHTML = (text) => {
  if (typeof text !== 'string') return '';
  return text.replace(/<[^>]*>/g, '').trim();
};

const sanitizeUrlToHTTPS = (url) => {
  if (typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (trimmed.toLowerCase().startsWith('http://')) {
    return 'https://' + trimmed.slice(7);
  }
  return trimmed;
};

export default function SettingsManager({
  storeName, onChangeStoreName,
  storeLogo, onChangeStoreLogo,
  storePhone, onChangeStorePhone,
  salesGoal, onChangeSalesGoal,
  freeDeliveryThreshold, onChangeFreeDeliveryThreshold,
  deliveryCampaignText, onChangeDeliveryCampaignText,
  telegramToken, onChangeTelegramToken,
  telegramChatId, onChangeTelegramChatId,
  soundEnabled, onToggleSoundEnabled,
  shopOpen, onToggleShopOpen,
  isCloudSynced,
  whatsappGreeting, onChangeWhatsappGreeting,
  whatsappFooter, onChangeWhatsappFooter,
  qrCustomUrl, onChangeQrCustomUrl,
  ticketCustomMessage, onUpdateTicketCustomMessage,
  catalogOrder, onUpdateCatalogOrder,
  r2Config, onUpdateR2Config,
  literConfig, onUpdateLiterConfig,
  coupons, onUpdateCoupons,
  logs, addLog, currentUser, onLogout,
  flavors, onUpdateFlavors,
  toppings, onUpdateToppings,
  bases, onUpdateBases,
  packs, onUpdatePacks,
  orders, onUpdateOrders,
  expenses, onUpdateExpenses,
  deliveryFee, onChangeDeliveryFee,
  onToggleShopOpen: onToggleShopOpenProp,
  recommendations, onUpdateRecommendations,
  cartRecommendedPack, onUpdateCartRecommendedPack,
  staffUsers, onUpdateStaffUsers,
  storeTitle, onChangeStoreTitle,
  storeFavicon, onChangeStoreFavicon,
  storeInstagram, onChangeStoreInstagram,
  storeFacebook, onChangeStoreFacebook,
  whatsappContactMessage, onChangeWhatsappContactMessage,
  trendsInterval, onChangeTrendsInterval,
  trendsDisplayTime, onChangeTrendsDisplayTime,
  shopConfig, onChangeShopConfig,
  staffPermissions, onUpdateStaffPermissions
}) {
  // --- Estados Locales para Ajustes (Evita lags en el dashboard completo al escribir) ---
  const [localStoreName, setLocalStoreName] = useState(storeName);
  const [localStoreLogo, setLocalStoreLogo] = useState(storeLogo);
  const [localStoreTitle, setLocalStoreTitle] = useState(storeTitle || '');
  const [localStoreFavicon, setLocalStoreFavicon] = useState(storeFavicon || '🍦');
  const [localStorePhone, setLocalStorePhone] = useState(storePhone);
  const [localStoreInstagram, setLocalStoreInstagram] = useState(storeInstagram || 'https://www.instagram.com/');
  const [localStoreFacebook, setLocalStoreFacebook] = useState(storeFacebook || 'https://www.facebook.com/');
  const [localWhatsappContactMessage, setLocalWhatsappContactMessage] = useState(whatsappContactMessage || '¡Hola! Me gustaría hacer una consulta. 🍦');
  const [localSalesGoal, setLocalSalesGoal] = useState(salesGoal);
  const [localFreeDeliveryThreshold, setLocalFreeDeliveryThreshold] = useState(freeDeliveryThreshold);
  const [localDeliveryCampaignText, setLocalDeliveryCampaignText] = useState(deliveryCampaignText);
  const [localWhatsappGreeting, setLocalWhatsappGreeting] = useState(whatsappGreeting);
  const [localWhatsappFooter, setLocalWhatsappFooter] = useState(whatsappFooter);
  const [localQrCustomUrl, setLocalQrCustomUrl] = useState(qrCustomUrl);
  const [localTicketCustomMessage, setLocalTicketCustomMessage] = useState(ticketCustomMessage || '');
  const [localCatalogOrder, setLocalCatalogOrder] = useState(() => catalogOrder || ['liter', 'classic', 'packs']);
  const [localTrendsInterval, setLocalTrendsInterval] = useState(trendsInterval || 25);
  const [localTrendsDisplayTime, setLocalTrendsDisplayTime] = useState(trendsDisplayTime || 6);
  const [localShopConfig, setLocalShopConfig] = useState(() => shopConfig || {
    open: true,
    useHours: false,
    hours: {
      monday: { enabled: true, open: '09:00', close: '22:00' },
      tuesday: { enabled: true, open: '09:00', close: '22:00' },
      wednesday: { enabled: true, open: '09:00', close: '22:00' },
      thursday: { enabled: true, open: '09:00', close: '22:00' },
      friday: { enabled: true, open: '09:00', close: '22:00' },
      saturday: { enabled: true, open: '09:00', close: '22:00' },
      sunday: { enabled: true, open: '09:00', close: '22:00' }
    }
  });

  const [localLiterActive, setLocalLiterActive] = useState(literConfig?.active !== false);
  const [localLiterPrice, setLocalLiterPrice] = useState(literConfig?.price || 15.0);
  const [localLiterMaxFlavors, setLocalLiterMaxFlavors] = useState(literConfig?.maxFlavors || 3);
  const [localLiterImage, setLocalLiterImage] = useState(literConfig?.image || '');

  const [newCoupon, setNewCoupon] = useState({ code: '', type: 'percentage', value: 10, limit: 100, active: true });
  const [editingCouponCode, setEditingCouponCode] = useState(null);
  const [editCouponData, setEditCouponData] = useState(null);
  const [qrTableNumber, setQrTableNumber] = useState('1');

  const getBaseQrUrl = () => {
    if (qrCustomUrl && qrCustomUrl.trim()) {
      let base = qrCustomUrl.trim();
      if (!/^https?:\/\//i.test(base)) {
        base = `https://${base}`;
      }
      return base;
    }
    return `${window.location.origin}${window.location.pathname}`;
  };

  const getTableQrUrl = (tableNum) => {
    const base = getBaseQrUrl();
    const separator = base.includes('?') ? '&' : '?';
    return `${base}${separator}mesa=${tableNum}`;
  };
  const [logSearchQuery, setLogSearchQuery] = useState('');
  const [logsLimit, setLogsLimit] = useState(20);
  const [showSQLScript, setShowSQLScript] = useState(false);
  const [telegramTestStatus, setTelegramTestStatus] = useState({ loading: false, success: null, error: null });

  const [uploadingState, setUploadingState] = useState({
    logo: false,
    liter: false,
    favicon: false
  });

  // --- Sincronizar estados locales con los globales cuando cambien externamente ---
  useEffect(() => { setLocalStoreName(storeName); }, [storeName]);
  useEffect(() => { setLocalStoreLogo(storeLogo); }, [storeLogo]);
  useEffect(() => { setLocalStoreTitle(storeTitle || ''); }, [storeTitle]);
  useEffect(() => { setLocalStoreFavicon(storeFavicon || '🍦'); }, [storeFavicon]);
  useEffect(() => { setLocalStoreInstagram(storeInstagram || 'https://www.instagram.com/'); }, [storeInstagram]);
  useEffect(() => { setLocalStoreFacebook(storeFacebook || 'https://www.facebook.com/'); }, [storeFacebook]);
  useEffect(() => { setLocalWhatsappContactMessage(whatsappContactMessage || '¡Hola! Me gustaría hacer una consulta. 🍦'); }, [whatsappContactMessage]);
  useEffect(() => { setLocalStorePhone(storePhone); }, [storePhone]);
  useEffect(() => { setLocalSalesGoal(salesGoal); }, [salesGoal]);
  useEffect(() => { setLocalFreeDeliveryThreshold(freeDeliveryThreshold); }, [freeDeliveryThreshold]);
  useEffect(() => { setLocalDeliveryCampaignText(deliveryCampaignText); }, [deliveryCampaignText]);
  useEffect(() => { setLocalWhatsappGreeting(whatsappGreeting); }, [whatsappGreeting]);
  useEffect(() => { setLocalWhatsappFooter(whatsappFooter); }, [whatsappFooter]);
  useEffect(() => { setLocalQrCustomUrl(qrCustomUrl); }, [qrCustomUrl]);
  useEffect(() => { setLocalTicketCustomMessage(ticketCustomMessage || ''); }, [ticketCustomMessage]);
  useEffect(() => { setLocalCatalogOrder(catalogOrder || ['liter', 'classic', 'packs']); }, [catalogOrder]);
  useEffect(() => { setLocalTrendsInterval(trendsInterval || 25); }, [trendsInterval]);
  useEffect(() => { setLocalTrendsDisplayTime(trendsDisplayTime || 6); }, [trendsDisplayTime]);
  useEffect(() => {
    if (shopConfig) {
      setLocalShopConfig(shopConfig);
    }
  }, [shopConfig]);

  useEffect(() => {
    if (literConfig) {
      setLocalLiterActive(literConfig.active !== false);
      setLocalLiterPrice(literConfig.price || 15.0);
      setLocalLiterMaxFlavors(literConfig.maxFlavors || 3);
      setLocalLiterImage(literConfig.image || '');
    }
  }, [literConfig]);

  const handleSaveSettings = () => {
    // Sanitizar URLs para evitar enlaces HTTP inseguros (mixed content) en HTTPS
    const sanitizedLogo = localStoreLogo.toLowerCase().startsWith('http') ? sanitizeUrlToHTTPS(localStoreLogo) : localStoreLogo.trim();
    const sanitizedFavicon = localStoreFavicon.toLowerCase().startsWith('http') ? sanitizeUrlToHTTPS(localStoreFavicon) : localStoreFavicon.trim();
    const sanitizedInstagram = localStoreInstagram.toLowerCase().startsWith('http') ? sanitizeUrlToHTTPS(localStoreInstagram) : localStoreInstagram.trim();
    const sanitizedFacebook = localStoreFacebook.toLowerCase().startsWith('http') ? sanitizeUrlToHTTPS(localStoreFacebook) : localStoreFacebook.trim();
    const sanitizedQrUrl = sanitizeUrlToHTTPS(localQrCustomUrl);
    const sanitizedLiterImage = sanitizeUrlToHTTPS(localLiterImage);

    onChangeStoreName(localStoreName);
    onChangeStoreLogo(sanitizedLogo);
    if (onChangeStoreTitle) onChangeStoreTitle(localStoreTitle);
    if (onChangeStoreFavicon) onChangeStoreFavicon(sanitizedFavicon);
    if (onChangeStoreInstagram) onChangeStoreInstagram(sanitizedInstagram);
    if (onChangeStoreFacebook) onChangeStoreFacebook(sanitizedFacebook);
    onChangeStorePhone(localStorePhone);
    if (onChangeWhatsappContactMessage) onChangeWhatsappContactMessage(localWhatsappContactMessage);
    onChangeSalesGoal(parseFloat(localSalesGoal) || 0);
    onChangeFreeDeliveryThreshold(parseFloat(localFreeDeliveryThreshold) || 0);
    onChangeDeliveryCampaignText(localDeliveryCampaignText);
    onChangeWhatsappGreeting(localWhatsappGreeting);
    onChangeWhatsappFooter(localWhatsappFooter);
    onChangeQrCustomUrl(sanitizedQrUrl);
    onUpdateTicketCustomMessage(localTicketCustomMessage);

    onUpdateLiterConfig({
      active: !!localLiterActive,
      price: parseFloat(localLiterPrice) || 15.0,
      maxFlavors: parseInt(localLiterMaxFlavors, 10) || 3,
      image: sanitizedLiterImage
    });

    if (onUpdateCatalogOrder) {
      onUpdateCatalogOrder(localCatalogOrder);
    }
    if (onChangeTrendsInterval) onChangeTrendsInterval(parseInt(localTrendsInterval, 10) || 25);
    if (onChangeTrendsDisplayTime) onChangeTrendsDisplayTime(parseInt(localTrendsDisplayTime, 10) || 6);
    if (onChangeShopConfig) onChangeShopConfig(localShopConfig);
    
    addLog(`Ajustes de heladería guardados en la nube por ${currentUser?.name || 'Administrador'}.`);
    alert("¡Ajustes de heladería guardados y sincronizados correctamente en la nube!");
  };

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
      limit: parseInt(newCoupon.limit, 10) || 0,
      usedCount: 0,
      active: newCoupon.active !== false,
      description: newCoupon.type === 'free_delivery' 
        ? 'Envío gratis' 
        : (newCoupon.type === 'percentage' 
            ? `${newCoupon.value}% de descuento` 
            : `S/. ${parseFloat(newCoupon.value).toFixed(2)} de descuento`)
    };

    onUpdateCoupons([...coupons, added]);
    setNewCoupon({ code: '', type: 'percentage', value: 10, limit: 100, active: true });
    addLog(`Cupón creado: ${added.code} (${added.description}) por ${currentUser?.name}.`);
  };

  const handleEditCouponClick = (coupon) => {
    setEditingCouponCode(coupon.code);
    setEditCouponData({ 
      ...coupon,
      limit: coupon.limit || 0
    });
  };

  const handleSaveCouponEdit = (e) => {
    e.preventDefault();
    if (!editCouponData.code.trim()) return;

    const formattedCode = editCouponData.code.toUpperCase().trim();

    if (formattedCode !== editingCouponCode && coupons.some(c => c.code === formattedCode)) {
      alert("Ya existe otro cupón con este código.");
      return;
    }

    const updatedValue = editCouponData.type === 'free_delivery' ? 0 : parseFloat(editCouponData.value) || 0;
    const updatedDescription = editCouponData.type === 'free_delivery' 
      ? 'Envío gratis' 
      : (editCouponData.type === 'percentage' 
          ? `${updatedValue}% de descuento` 
          : `S/. ${updatedValue.toFixed(2)} de descuento`);

    const updatedCoupons = coupons.map(c => {
      if (c.code === editingCouponCode) {
        return {
          ...c,
          code: formattedCode,
          type: editCouponData.type,
          value: updatedValue,
          limit: parseInt(editCouponData.limit, 10) || 0,
          active: editCouponData.active !== false,
          description: updatedDescription
        };
      }
      return c;
    });

    onUpdateCoupons(updatedCoupons);
    setEditingCouponCode(null);
    setEditCouponData(null);
    addLog(`Cupón editado: ${editingCouponCode} -> ${formattedCode} por ${currentUser?.name}.`);
  };

  const handleToggleCouponActive = (couponCode) => {
    const updatedCoupons = coupons.map(c => {
      if (c.code === couponCode) {
        const nextState = !c.active;
        addLog(`Cupón ${couponCode} ${nextState ? 'activado' : 'desactivado'} por ${currentUser?.name || 'Administrador'}.`);
        return { ...c, active: nextState };
      }
      return c;
    });
    onUpdateCoupons(updatedCoupons);
  };

  const handlePrintQR = () => {
    const qrLink = getTableQrUrl(qrTableNumber);
    const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrLink)}`;
    const printWindow = window.open('', '_blank', 'width=600,height=600');
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>MESA ${qrTableNumber} - ${storeName}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              text-align: center;
              padding: 40px;
              color: #222;
            }
            .container {
              border: 4px dashed #ff4081;
              padding: 30px;
              border-radius: 20px;
              max-width: 400px;
              margin: 0 auto;
            }
            h1 {
              font-size: 2.5rem;
              margin-bottom: 5px;
              color: #ff4081;
            }
            h2 {
              font-size: 1.5rem;
              margin-top: 0;
              color: #555;
            }
            img {
              margin: 20px 0;
              width: 250px;
              height: 250px;
            }
            p {
              font-size: 1rem;
              font-weight: bold;
              color: #666;
            }
          </style>
        </head>
        <body onload="window.print(); window.close();">
          <div class="container">
            <h1>${storeName}</h1>
            <h2>🍽️ MESA ${qrTableNumber}</h2>
            <img src="${qrImageUrl}" alt="Código QR Mesa ${qrTableNumber}" />
            <p>Escanea este código para ver nuestra carta digital y realizar tu pedido desde tu celular 📱</p>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleToggleTableCategory = (category, checked) => {
    setLocalShopConfig(prev => {
      const currentCategories = prev.tableCatalogCategories || ['classic', 'liter', 'packs'];
      let updatedCategories;
      if (checked) {
        if (!currentCategories.includes(category)) {
          updatedCategories = [...currentCategories, category];
        } else {
          updatedCategories = currentCategories;
        }
      } else {
        updatedCategories = currentCategories.filter(c => c !== category);
        if (updatedCategories.length === 0) {
          alert("Debes seleccionar al menos una categoría visible.");
          return prev;
        }
      }
      return {
        ...prev,
        tableCatalogCategories: updatedCategories
      };
    });
  };

  const handleImageUpload = async (file, type, targetSetter) => {
    if (!file) return;
    setUploadingState(prev => ({ ...prev, [type]: true }));
    try {
      const url = await uploadToR2(file, type);
      targetSetter(url);
      alert("📸 Imagen subida y optimizada a WebP correctamente.");
    } catch (err) {
      console.error("Error al subir imagen a R2:", err);
      alert(`❌ Error al subir imagen a Cloudflare R2: ${err.message || err}`);
    } finally {
      setUploadingState(prev => ({ ...prev, [type]: false }));
    }
  };

  const handleTestTelegramConnection = async () => {
    setTelegramTestStatus({ loading: true, success: null, error: null });
    try {
      const testMsg = `🔔 *¡Conexión Exitosa!*\n\nTu bot de Telegram ha sido correctamente configurado para la heladería *${localStoreName || storeName}*.\n\nRecibirás una notificación por este canal cada vez que se realice un nuevo pedido. 🎉`;
      const response = await fetch('/api/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: testMsg,
          parse_mode: 'Markdown',
          kind: 'test'
        })
      });

      const resData = await response.json().catch(() => ({}));
      if (response.ok && resData.ok !== false) {
        setTelegramTestStatus({ loading: false, success: true, error: null });
        addLog("Notificación de prueba enviada con éxito a Telegram.");
      } else {
        throw new Error(resData.error || 'Error al conectar con Telegram API.');
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

  const handleExportAuditoryLog = () => {
    const header = `=== REPORTE DE BITÁCORA DE AUDITORÍA - ${storeName.toUpperCase()} ===\nGenerado: ${new Date().toLocaleString('es-PE')}\n\n`;
    const logsText = logs.map(l => `[${l.time}] ${l.text}`).join('\n');
    const blob = new Blob([header + logsText], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `auditoria_${storeName.toLowerCase().replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.txt`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportBackup = () => {
    try {
      const backupData = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        storeName,
        storeLogo,
        storeTitle,
        storeFavicon,
        storeInstagram,
        storeFacebook,
        whatsappContactMessage,
        flavors,
        toppings,
        bases,
        packs,
        orders,
        expenses,
        deliveryFee,
        shopOpen,
        freeDeliveryThreshold,
        deliveryCampaignText,
        storePhone,
        salesGoal,
        whatsappGreeting,
        whatsappFooter,
        qrCustomUrl,
        recommendations,
        cartRecommendedPack,
        staffUsers,
        literConfig,
        ticketCustomMessage,
        catalogOrder,
        coupons,
        shopConfig,
        staffPermissions,
        trendsInterval,
        trendsDisplayTime
      };

      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      const filename = `backup_heladeria_${new Date().toISOString().slice(0,10)}.json`;
      downloadAnchor.setAttribute("download", filename);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      
      alert("Copia de seguridad exportada con éxito en tu computadora.");
    } catch (err) {
      alert("Error al exportar copia de seguridad: " + err.message);
    }
  };

  const handleImportBackup = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target.result);
        
        if (!data || typeof data !== 'object') {
          throw new Error("El archivo no contiene un formato de copia de seguridad válido.");
        }

        if (window.confirm("⚠️ ¿Estás seguro de que deseas restaurar esta copia de seguridad? Se reemplazarán todos los datos actuales de la heladería por los de la copia.")) {
          if (data.storeName && onChangeStoreName) onChangeStoreName(data.storeName);
          if (data.storeLogo && onChangeStoreLogo) onChangeStoreLogo(data.storeLogo);
          if (data.storeTitle && onChangeStoreTitle) onChangeStoreTitle(data.storeTitle);
          if (data.storeFavicon && onChangeStoreFavicon) onChangeStoreFavicon(data.storeFavicon);
          if (data.storeInstagram && onChangeStoreInstagram) onChangeStoreInstagram(data.storeInstagram);
          if (data.storeFacebook && onChangeStoreFacebook) onChangeStoreFacebook(data.storeFacebook);
          if (data.flavors && onUpdateFlavors) onUpdateFlavors(data.flavors);
          if (data.toppings && onUpdateToppings) onUpdateToppings(data.toppings);
          if (data.bases && onUpdateBases) onUpdateBases(data.bases);
          if (data.packs && onUpdatePacks) onUpdatePacks(data.packs);
          if (data.orders && onUpdateOrders) onUpdateOrders(data.orders);
          if (data.expenses && onUpdateExpenses) onUpdateExpenses(data.expenses);
          if (data.deliveryFee !== undefined && onChangeDeliveryFee) onChangeDeliveryFee(parseFloat(data.deliveryFee));
          if (data.shopOpen !== undefined && onToggleShopOpen) onToggleShopOpen(data.shopOpen);
          if (data.freeDeliveryThreshold !== undefined && onChangeFreeDeliveryThreshold) onChangeFreeDeliveryThreshold(parseFloat(data.freeDeliveryThreshold));
          if (data.deliveryCampaignText !== undefined && onChangeDeliveryCampaignText) onChangeDeliveryCampaignText(data.deliveryCampaignText);
          if (data.storePhone !== undefined && onChangeStorePhone) onChangeStorePhone(data.storePhone);
          if (data.whatsappContactMessage !== undefined && onChangeWhatsappContactMessage) onChangeWhatsappContactMessage(data.whatsappContactMessage);
          if (data.salesGoal !== undefined && onChangeSalesGoal) onChangeSalesGoal(parseFloat(data.salesGoal));
          if (data.whatsappGreeting !== undefined && onChangeWhatsappGreeting) onChangeWhatsappGreeting(data.whatsappGreeting);
          if (data.whatsappFooter !== undefined && onChangeWhatsappFooter) onChangeWhatsappFooter(data.whatsappFooter);
          if (data.qrCustomUrl !== undefined && onChangeQrCustomUrl) onChangeQrCustomUrl(data.qrCustomUrl);
          if (data.literConfig && onUpdateLiterConfig) onUpdateLiterConfig(data.literConfig);
          if (data.ticketCustomMessage && onUpdateTicketCustomMessage) onUpdateTicketCustomMessage(data.ticketCustomMessage);
          if (data.catalogOrder && onUpdateCatalogOrder) onUpdateCatalogOrder(data.catalogOrder);
          if (data.recommendations && onUpdateRecommendations) onUpdateRecommendations(data.recommendations);
        if (data.cartRecommendedPack && onUpdateCartRecommendedPack) onUpdateCartRecommendedPack(data.cartRecommendedPack);
          if (data.staffUsers && onUpdateStaffUsers) onUpdateStaffUsers(data.staffUsers);
          if (data.coupons && onUpdateCoupons) onUpdateCoupons(data.coupons);
          if (data.shopConfig && onChangeShopConfig) onChangeShopConfig(data.shopConfig);
          if (data.staffPermissions && onUpdateStaffPermissions) onUpdateStaffPermissions(data.staffPermissions);
          if (data.trendsInterval !== undefined && onChangeTrendsInterval) onChangeTrendsInterval(parseInt(data.trendsInterval, 10));
          if (data.trendsDisplayTime !== undefined && onChangeTrendsDisplayTime) onChangeTrendsDisplayTime(parseInt(data.trendsDisplayTime, 10));

          if (supabase) {
            const keysToSync = [];
            const addKey = (key, val) => {
              if (val !== undefined) {
                keysToSync.push({ key, value: val });
              }
            };
            addKey('store_name', data.storeName);
            addKey('store_logo', data.storeLogo);
            addKey('store_title', data.storeTitle);
            addKey('store_favicon', data.storeFavicon);
            addKey('store_instagram', data.storeInstagram);
            addKey('store_facebook', data.storeFacebook);
            addKey('flavors', data.flavors);
            addKey('toppings', data.toppings);
            addKey('bases', data.bases);
            addKey('packs', data.packs);
            addKey('orders', data.orders);
            addKey('expenses', data.expenses);
            addKey('delivery_fee', data.deliveryFee);
            if (data.shopConfig) {
              addKey('shop_open', data.shopConfig);
            } else {
              addKey('shop_open', data.shopOpen);
            }
            addKey('coupons', data.coupons);
            addKey('free_delivery_threshold', data.freeDeliveryThreshold);
            addKey('delivery_campaign_text', data.deliveryCampaignText);
            addKey('store_phone', data.storePhone);
            addKey('whatsapp_contact_message', data.whatsappContactMessage);
            addKey('sales_goal', data.salesGoal);
            addKey('whatsapp_greeting', data.whatsappGreeting);
            addKey('whatsapp_footer', data.whatsappFooter);
            addKey('qr_custom_url', data.qrCustomUrl);
            addKey('liter_config', data.literConfig);
            addKey('ticket_custom_message', data.ticketCustomMessage);
            addKey('catalog_order', data.catalogOrder);
            addKey('recommendations', data.recommendations);
            addKey('cart_recommended_pack', data.cartRecommendedPack);
            addKey('staff_users', data.staffUsers);
            addKey('staff_permissions', data.staffPermissions);
            addKey('trends_interval', data.trendsInterval);
            addKey('trends_display_time', data.trendsDisplayTime);

            if (data.orders && Array.isArray(data.orders)) {
              data.orders.forEach(o => {
                addKey(`order_${o.id}`, o);
              });
            }

            await updateMultipleSyncedData(keysToSync);
          }

          addLog(`Base de datos restaurada desde copia de seguridad por ${currentUser?.name}.`);
          alert("¡Copia de seguridad restaurada con éxito y sincronizada con la nube!");
        }
      } catch (err) {
        alert("Error al importar copia de seguridad: " + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div style={{ maxWidth: '650px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <h3>Ajustes de la Heladería</h3>
      
      <div className="glass" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
        
        {/* Nombre, Título, Logo y Favicon del Local */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '15px', borderBottom: '1px solid var(--border-color)', paddingBottom: '15px' }}>
          <div className="form-group">
            <label htmlFor="store-name-input">Nombre de la Heladería / Sitio Web</label>
            <input
              id="store-name-input"
              name="store-name"
              type="text"
              className="form-control"
              value={localStoreName}
              onChange={(e) => setLocalStoreName(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label htmlFor="store-logo-input">Emoji o Imagen Logotipo</label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                id="store-logo-input"
                name="store-logo"
                type="text"
                className="form-control"
                placeholder="Emoji o URL"
                value={localStoreLogo}
                onChange={(e) => setLocalStoreLogo(e.target.value)}
                style={{ flex: 1 }}
              />
              <label 
                htmlFor="logo-image-upload" 
                className="btn btn-secondary" 
                style={{ 
                  padding: '8px 12px', 
                  fontSize: '0.8rem', 
                  cursor: 'pointer', 
                  margin: 0, 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  gap: '4px',
                  whiteSpace: 'nowrap'
                }}
              >
                📁 {uploadingState.logo ? 'Subiendo...' : 'Subir'}
              </label>
              <input 
                type="file" 
                accept="image/*" 
                style={{ display: 'none' }} 
                id="logo-image-upload" 
                onChange={(e) => handleImageUpload(e.target.files[0], 'logo', setLocalStoreLogo)} 
                disabled={uploadingState.logo}
              />
            </div>
          </div>

          <div className="form-group" style={{ gridColumn: 'span 2' }}>
            <label htmlFor="store-title-input">Título de la Página (SEO - Recomendado min 50 caracteres)</label>
            <input
              id="store-title-input"
              name="store-title"
              type="text"
              className="form-control"
              placeholder="Ej: Don Helado - Heladería Online & Delivery de Helados Artesanales"
              value={localStoreTitle}
              onChange={(e) => setLocalStoreTitle(e.target.value)}
            />
            <span style={{ fontSize: '0.7rem', color: localStoreTitle.length >= 50 ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>
              Longitud actual: {localStoreTitle.length} caracteres {localStoreTitle.length < 50 && "(Demasiado corto para SEO)"}
            </span>
          </div>

          <div className="form-group" style={{ gridColumn: 'span 2' }}>
            <label htmlFor="store-favicon-input">Favicon de la Pestaña (Emoji o URL de Imagen)</label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                id="store-favicon-input"
                name="store-favicon"
                type="text"
                className="form-control"
                placeholder="Ej: 🍦 o enlace de imagen https://..."
                value={localStoreFavicon}
                onChange={(e) => setLocalStoreFavicon(e.target.value)}
                style={{ flex: 1 }}
              />
              <label 
                htmlFor="favicon-image-upload" 
                className="btn btn-secondary" 
                style={{ 
                  padding: '8px 12px', 
                  fontSize: '0.8rem', 
                  cursor: 'pointer', 
                  margin: 0, 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  gap: '4px',
                  whiteSpace: 'nowrap'
                }}
              >
                📁 {uploadingState.favicon ? 'Subiendo...' : 'Subir'}
              </label>
              <input 
                type="file" 
                accept="image/*" 
                style={{ display: 'none' }} 
                id="favicon-image-upload" 
                onChange={(e) => handleImageUpload(e.target.files[0], 'favicon', setLocalStoreFavicon)} 
                disabled={uploadingState.favicon}
              />
            </div>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-light)' }}>
              Puedes ingresar un Emoji (ej: 🍨) o subir una imagen cuadrada (PNG/SVG) para representarla en la pestaña del navegador.
            </span>
          </div>

          <div className="form-group" style={{ gridColumn: 'span 2' }}>
            <label htmlFor="store-instagram-input">📸 Enlace de Instagram</label>
            <input
              id="store-instagram-input"
              name="store-instagram"
              type="text"
              className="form-control"
              placeholder="Ej: https://www.instagram.com/tu_heladeria"
              value={localStoreInstagram}
              onChange={(e) => setLocalStoreInstagram(e.target.value)}
            />
          </div>

          <div className="form-group" style={{ gridColumn: 'span 2' }}>
            <label htmlFor="store-facebook-input">📘 Enlace de Facebook</label>
            <input
              id="store-facebook-input"
              name="store-facebook"
              type="text"
              className="form-control"
              placeholder="Ej: https://www.facebook.com/tu_heladeria"
              value={localStoreFacebook}
              onChange={(e) => setLocalStoreFacebook(e.target.value)}
            />
          </div>
        </div>

        {/* Teléfono de WhatsApp */}
        <div>
          <label htmlFor="store-phone-input" style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '5px' }}>
            📞 Número de Celular (Llamadas y WhatsApp)
          </label>
          <input 
            id="store-phone-input"
            name="store-phone"
            type="text" 
            className="form-control" 
            value={localStorePhone} 
            onChange={(e) => setLocalStorePhone(e.target.value)} 
          />
          <span style={{ fontSize: '0.7rem', color: 'var(--text-light)' }}>
            Número de teléfono para el desvío de pedidos e interacciones del cliente.
          </span>
        </div>

        {/* Mensaje de Consulta de WhatsApp */}
        <div>
          <label htmlFor="store-whatsapp-contact-message-input" style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '5px' }}>
            💬 Mensaje Predeterminado de Consulta de WhatsApp
          </label>
          <input 
            id="store-whatsapp-contact-message-input"
            name="store-whatsapp-contact-message"
            type="text" 
            className="form-control" 
            placeholder="Ej: ¡Hola! Me gustaría hacer una consulta. 🍦"
            value={localWhatsappContactMessage} 
            onChange={(e) => setLocalWhatsappContactMessage(e.target.value)} 
          />
          <span style={{ fontSize: '0.7rem', color: 'var(--text-light)' }}>
            El mensaje que se rellenará automáticamente cuando un cliente haga clic en el botón de WhatsApp del pie de página.
          </span>
        </div>

        {/* Meta de Ventas del día */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
          <div>
            <label htmlFor="sales-goal-input" style={{ display: 'block', cursor: 'pointer' }}>
              <strong>🎯 Meta Diaria de Ventas (S/.)</strong>
            </label>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-light)', display: 'block' }}>Objetivo de ingresos diario.</span>
          </div>
          <input
            id="sales-goal-input"
            name="sales-goal"
            type="number"
            step="10.00"
            style={{ width: '80px', padding: '6px' }}
            className="form-control"
            value={localSalesGoal}
            onChange={(e) => setLocalSalesGoal(e.target.value)}
          />
        </div>

        {/* Envío Gratis */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
          <div>
            <label htmlFor="free-delivery-threshold-input" style={{ display: 'block', cursor: 'pointer' }}>
              <strong>Monto Envío Gratis Mínimo (S/.)</strong>
            </label>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-light)', display: 'block' }}>Monto necesario para delivery gratuito.</span>
          </div>
          <input
            id="free-delivery-threshold-input"
            name="free-delivery-threshold"
            type="number"
            step="1.00"
            style={{ width: '80px', padding: '6px' }}
            className="form-control"
            value={localFreeDeliveryThreshold}
            onChange={(e) => setLocalFreeDeliveryThreshold(e.target.value)}
          />
        </div>

        {/* Mensaje de Campaña */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
          <div>
            <label htmlFor="delivery-campaign-text-input" style={{ display: 'block', cursor: 'pointer' }}>
              <strong>Mensaje de Campaña de Delivery</strong>
            </label>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-light)', display: 'block' }}>Texto secundario del banner para promociones y campañas de envío.</span>
          </div>
          <textarea
            id="delivery-campaign-text-input"
            name="delivery-campaign-text"
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

        {/* Alerta Sonora */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
          <div>
            <label htmlFor="sound-enabled-input" style={{ display: 'block', cursor: 'pointer' }}>
              <strong>Alerta Sonora de Pedidos</strong>
            </label>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-light)', display: 'block' }}>Campanada para notificar pedidos.</span>
            <button 
              type="button" 
              style={{ 
                padding: '4px 10px', 
                fontSize: '0.7rem', 
                marginTop: '6px', 
                cursor: 'pointer', 
                background: 'rgba(229, 142, 38, 0.1)', 
                color: '#e58e26', 
                border: '1px solid rgba(229, 142, 38, 0.3)', 
                borderRadius: '6px', 
                display: 'inline-flex', 
                alignItems: 'center', 
                gap: '4px',
                fontWeight: '600',
                transition: 'all 0.2s ease'
              }}
              onClick={() => {
                try {
                  const AudioContext = window.AudioContext || window.webkitAudioContext;
                  if (AudioContext) {
                    const ctx = new AudioContext();
                    const osc1 = ctx.createOscillator();
                    const osc2 = ctx.createOscillator();
                    const gain = ctx.createGain();
                    
                    osc1.type = 'sine';
                    osc1.frequency.setValueAtTime(523.25, ctx.currentTime);
                    osc1.frequency.exponentialRampToValueAtTime(783.99, ctx.currentTime + 0.15);
                    
                    osc2.type = 'triangle';
                    osc2.frequency.setValueAtTime(783.99, ctx.currentTime);
                    osc2.frequency.exponentialRampToValueAtTime(1046.50, ctx.currentTime + 0.15);
                    
                    gain.gain.setValueAtTime(0.2, ctx.currentTime);
                    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.8);
                    
                    osc1.connect(gain);
                    osc2.connect(gain);
                    gain.connect(ctx.destination);
                    
                    osc1.start();
                    osc2.start();
                    osc1.stop(ctx.currentTime + 0.8);
                    osc2.stop(ctx.currentTime + 0.8);
                  }
                } catch (e) {
                  console.warn("Audio preview blocked:", e);
                }
              }}
            >
              🔔 Probar Sonido
            </button>
          </div>
          <label className="toggle-switch" htmlFor="sound-enabled-input">
            <input id="sound-enabled-input" name="sound-enabled" type="checkbox" checked={soundEnabled} onChange={onToggleSoundEnabled} />
            <span className="slider"></span>
          </label>
        </div>

        {/* Estado de Heladería Manual */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
          <div>
            <label htmlFor="shop-open-manual-input" style={{ display: 'block', cursor: 'pointer', fontWeight: 'bold' }}>
              🟢 Estado Manual de la Heladería
            </label>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-light)', display: 'block' }}>
              Permite forzar el cierre o la apertura de la tienda de forma inmediata, ignorando los horarios.
            </span>
          </div>
          <label className="toggle-switch" htmlFor="shop-open-manual-input">
            <input 
              id="shop-open-manual-input" 
              type="checkbox" 
              checked={localShopConfig.open} 
              onChange={(e) => setLocalShopConfig(prev => ({ ...prev, open: e.target.checked }))} 
            />
            <span className="slider"></span>
          </label>
        </div>

        {/* Horarios de Atención Automáticos */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderBottom: '1px solid var(--border-color)', paddingBottom: '15px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <strong style={{ display: 'block' }}>🕒 Horario de Atención Automático</strong>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-light)', display: 'block', marginTop: '2px' }}>
                Desactiva el carrito y bloquea pedidos fuera del rango de hora establecido.
              </span>
            </div>
            <label className="toggle-switch" htmlFor="shop-hours-enabled-input">
              <input 
                id="shop-hours-enabled-input" 
                type="checkbox" 
                checked={localShopConfig.useHours} 
                onChange={(e) => setLocalShopConfig(prev => ({ ...prev, useHours: e.target.checked }))} 
              />
              <span className="slider"></span>
            </label>
          </div>

          {localShopConfig.useHours && (
            <div style={{ 
              background: 'var(--bg-secondary)', 
              padding: '12px', 
              borderRadius: '8px', 
              border: '1px solid var(--border-color)',
              marginTop: '5px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--primary-color)' }}>
                Configuración por día:
              </span>
              
              {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map(day => {
                const dayLabels = {
                  monday: 'Lunes',
                  tuesday: 'Martes',
                  wednesday: 'Miércoles',
                  thursday: 'Jueves',
                  friday: 'Viernes',
                  saturday: 'Sábado',
                  sunday: 'Domingo'
                };
                const dayConfig = localShopConfig.hours?.[day] || { enabled: true, open: '09:00', close: '22:00' };

                return (
                  <div key={day} style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between', 
                    gap: '10px',
                    paddingBottom: '8px',
                    borderBottom: day !== 'sunday' ? '1px dashed var(--border-color)' : 'none'
                  }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0, cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold', width: '90px' }}>
                      <input 
                        type="checkbox" 
                        checked={dayConfig.enabled} 
                        onChange={(e) => {
                          const updatedHours = { ...localShopConfig.hours };
                          updatedHours[day] = { ...dayConfig, enabled: e.target.checked };
                          setLocalShopConfig(prev => ({ ...prev, hours: updatedHours }));
                        }}
                      />
                      {dayLabels[day]}
                    </label>

                    {dayConfig.enabled ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <input 
                          type="time" 
                          className="form-control" 
                          style={{ padding: '2px 6px', fontSize: '0.75rem', width: '90px' }}
                          value={dayConfig.open}
                          onChange={(e) => {
                            const updatedHours = { ...localShopConfig.hours };
                            updatedHours[day] = { ...dayConfig, open: e.target.value };
                            setLocalShopConfig(prev => ({ ...prev, hours: updatedHours }));
                          }}
                        />
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>a</span>
                        <input 
                          type="time" 
                          className="form-control" 
                          style={{ padding: '2px 6px', fontSize: '0.75rem', width: '90px' }}
                          value={dayConfig.close}
                          onChange={(e) => {
                            const updatedHours = { ...localShopConfig.hours };
                            updatedHours[day] = { ...dayConfig, close: e.target.value };
                            setLocalShopConfig(prev => ({ ...prev, hours: updatedHours }));
                          }}
                        />
                      </div>
                    ) : (
                      <span style={{ fontSize: '0.75rem', color: 'var(--danger)', fontWeight: 'bold' }}> Cerrado todo el día</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Pedidos en Mesa y Tomador de Pedidos */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '15px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <strong style={{ display: 'block' }}>🍽️ Módulo de Pedidos en Mesa / Códigos QR</strong>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-light)', display: 'block', marginTop: '2px' }}>
                Permite a los clientes enviar pedidos directamente desde su mesa escaneando un código QR.
              </span>
            </div>
            <label className="toggle-switch" htmlFor="shop-table-orders-enabled-input">
              <input 
                id="shop-table-orders-enabled-input" 
                type="checkbox" 
                checked={localShopConfig.tableOrdersEnabled !== false} 
                onChange={(e) => setLocalShopConfig(prev => ({ ...prev, tableOrdersEnabled: e.target.checked }))} 
              />
              <span className="slider"></span>
            </label>
          </div>

          {localShopConfig.tableOrdersEnabled !== false && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', paddingLeft: '15px', borderLeft: '3px solid var(--primary-color)' }}>
              <div>
                <strong style={{ display: 'block', fontSize: '0.85rem' }}>Cantidad de Mesas Activas</strong>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-light)' }}>
                  Define el número total de mesas habilitadas en tu negocio.
                </span>
              </div>
              <input 
                type="number"
                className="form-control"
                style={{ fontSize: '0.8rem', padding: '6px', maxWidth: '80px', textAlign: 'center' }}
                value={localShopConfig.totalTables || 12}
                onChange={(e) => {
                  const val = Math.max(1, Math.min(100, parseInt(e.target.value, 10) || 1));
                  setLocalShopConfig(prev => ({ ...prev, totalTables: val }));
                }}
                min="1"
                max="100"
              />
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <strong style={{ display: 'block' }}>🤵 Tomador de Pedidos de Mesa (Mozo)</strong>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-light)', display: 'block', marginTop: '2px' }}>
                Habilita una pestaña dedicada en el panel administrativo para que los mozos registren pedidos de mesa directamente.
              </span>
            </div>
            <label className="toggle-switch" htmlFor="shop-waiter-taker-enabled-input">
              <input 
                id="shop-waiter-taker-enabled-input" 
                type="checkbox" 
                checked={localShopConfig.waiterTakerEnabled !== false} 
                onChange={(e) => setLocalShopConfig(prev => ({ ...prev, waiterTakerEnabled: e.target.checked }))} 
              />
              <span className="slider"></span>
            </label>
          </div>
        </div>

        {/* Ajustes de Tendencias en Vivo (Prueba Social FOMO) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
          <div>
            <strong>🔥 Ajustes de Tendencias en Vivo (Prueba Social)</strong>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-light)', display: 'block', marginTop: '2px' }}>
              Controla la frecuencia y el tiempo de exhibición de las alertas flotantes del catálogo.
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '15px' }}>
            <div className="form-group">
              <label htmlFor="trends-interval-input" style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>Frecuencia de Actualización (segundos)</label>
              <input
                id="trends-interval-input"
                type="number"
                min="10"
                max="120"
                className="form-control"
                style={{ fontSize: '0.8rem', padding: '6px' }}
                value={localTrendsInterval}
                onChange={(e) => setLocalTrendsInterval(parseInt(e.target.value, 10) || 25)}
              />
              <span style={{ fontSize: '0.65rem', color: 'var(--text-light)' }}>Cada cuántos segundos se busca un nuevo pedido.</span>
            </div>
            <div className="form-group">
              <label htmlFor="trends-display-time-input" style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>Duración Alerta (segundos)</label>
              <input
                id="trends-display-time-input"
                type="number"
                min="3"
                max="20"
                className="form-control"
                style={{ fontSize: '0.8rem', padding: '6px' }}
                value={localTrendsDisplayTime}
                onChange={(e) => setLocalTrendsDisplayTime(parseInt(e.target.value, 10) || 6)}
              />
              <span style={{ fontSize: '0.65rem', color: 'var(--text-light)' }}>Duración visible de la alerta antes de ocultarse.</span>
            </div>
          </div>
        </div>

        {/* Telegram Bot */}
        <div className="glass" style={{ borderLeft: '4px solid #0088cc', padding: '15px', background: 'rgba(0, 136, 204, 0.03)', borderRadius: '8px', marginBottom: '15px' }}>
          <strong style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem' }}>
            ✈️ Notificaciones en tiempo real (Telegram Bot)
          </strong>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-light)', marginTop: '4px', marginBottom: '0' }}>
            Esta integración ahora usa una Pages Function. El token y el chat ID se cargan como variables de entorno en Cloudflare, no en el navegador.
          </p>
        </div>

        {/* Estado Sincronización */}
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

-- 3. Habilitar la seguridad RLS
alter table public.helados_sync enable row level security;`}
              </pre>
            </div>
          )}
        </div>

        {/* QR Tables Consolidated */}
        <div className="glass" style={{ borderLeft: '4px solid var(--secondary-color)', padding: '20px', background: 'rgba(229, 142, 38, 0.02)', borderRadius: '8px', marginBottom: '15px' }}>
          <strong style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.95rem', marginBottom: '4px' }}>
            📱 Códigos QR para Clientes en Tienda
          </strong>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-light)', marginBottom: '15px' }}>
            Genera, imprime y personaliza los códigos QR para que los clientes escaneen desde sus mesas y accedan al catálogo digital.
          </p>

          {/* Enlace Base Personalizado */}
          <div style={{ marginBottom: '20px', borderBottom: '1px dashed var(--border-color)', paddingBottom: '15px' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>
              🔗 Enlace base personalizado para el Código QR
            </label>
            <input 
              type="text" 
              className="form-control" 
              placeholder={`Por defecto: ${window.location.origin + window.location.pathname}`}
              value={localQrCustomUrl || ''} 
              onChange={(e) => setLocalQrCustomUrl(e.target.value)} 
              style={{ fontSize: '0.8rem', padding: '8px' }}
            />
            <small style={{ color: 'var(--text-light)', fontSize: '0.65rem', marginTop: '4px', display: 'block' }}>
              Se utiliza para generar tanto el QR general del local como los códigos QR específicos de cada mesa.
            </small>
          </div>

          {/* Cuadrícula de Generadores: QR General y QR por Mesas */}
          <div className="qr-consolidated-grid" style={{ marginBottom: '20px' }}>
            <style>{`
              .qr-consolidated-grid {
                display: grid;
                grid-template-columns: 1fr 1.2fr;
                gap: 20px;
              }
              @media (max-width: 600px) {
                .qr-consolidated-grid {
                  grid-template-columns: 1fr;
                }
                .qr-col-general {
                  border-right: none !important;
                  border-bottom: 1px solid var(--border-color);
                  padding-right: 0 !important;
                  padding-bottom: 20px;
                }
              }
            `}</style>

            {/* Columna A: Código QR General */}
            <div style={{ borderRight: '1px solid var(--border-color)', paddingRight: '15px' }} className="qr-col-general">
              <strong style={{ fontSize: '0.85rem', display: 'block', marginBottom: '8px', color: 'var(--primary-color)' }}>
                📍 Código QR General (Sin Mesa)
              </strong>
              <p style={{ fontSize: '0.7rem', color: 'var(--text-light)', marginBottom: '12px' }}>
                Ideal para volantes, mostradores o publicidad general. Carga el catálogo vacío para llevar o delivery.
              </p>
              
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                <div style={{ background: 'white', padding: '8px', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'inline-flex' }}>
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=130x130&data=${encodeURIComponent(qrCustomUrl || (window.location.origin + window.location.pathname))}`}
                    alt="Código QR General"
                    width="120"
                    height="120"
                    style={{ width: '120px', height: '120px', display: 'block' }}
                  />
                </div>
                <div style={{ width: '100%', textAlign: 'center' }}>
                  <code style={{ fontSize: '0.7rem', color: 'var(--text-light)', display: 'block', wordBreak: 'break-all', marginBottom: '8px' }}>
                    {qrCustomUrl || (window.location.origin + window.location.pathname)}
                  </code>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ padding: '6px 12px', fontSize: '0.75rem', width: '100%' }}
                    onClick={() => {
                      const targetQr = qrCustomUrl || (window.location.origin + window.location.pathname);
                      const printFrame = document.createElement('iframe');
                      printFrame.style.position = 'fixed';
                      printFrame.style.left = '-9999px';
                      printFrame.style.width = '0px';
                      printFrame.style.height = '0px';
                      printFrame.style.border = 'none';
                      document.body.appendChild(printFrame);

                      const doc = printFrame.contentWindow.document;
                      doc.open();
                      doc.write(`
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
                              <img id="qr-img" src="https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(targetQr)}" width="250" height="250" />
                              <h2 style="color: #e58e26; margin-top: 20px;">${storeName}</h2>
                            </div>
                          </body>
                        </html>
                      `);
                      doc.close();

                      const img = doc.getElementById('qr-img');
                      if (img) {
                        img.onload = () => {
                          printFrame.contentWindow.focus();
                          printFrame.contentWindow.print();
                          setTimeout(() => { document.body.removeChild(printFrame); }, 1000);
                        };
                      }
                    }}
                  >
                    🖨️ Imprimir QR General
                  </button>
                </div>
              </div>
            </div>

            {/* Columna B: Generador de QR por Mesas (Habilitado solo si tableOrdersEnabled !== false) */}
            <div className="qr-col-mesas">
              {localShopConfig.tableOrdersEnabled !== false ? (
                <>
                  <strong style={{ fontSize: '0.85rem', display: 'block', marginBottom: '8px', color: 'var(--primary-color)' }}>
                    🍽️ Generador de Código QR para Mesas
                  </strong>
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-light)', marginBottom: '12px' }}>
                    Introduce un número de mesa para generar su enlace y código QR específico.
                  </p>
                  
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', marginBottom: '10px' }}>
                    <div className="form-group" style={{ flex: '0 0 90px' }}>
                      <label style={{ fontSize: '0.7rem', fontWeight: 'bold' }}>N° Mesa:</label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        className="form-control"
                        style={{ fontSize: '0.8rem', padding: '5px 8px', marginTop: '2px' }}
                        value={qrTableNumber}
                        onChange={(e) => setQrTableNumber(e.target.value)}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: '0.65rem', display: 'block', color: 'var(--text-light)' }}>Enlace generado:</span>
                      <code style={{ fontSize: '0.65rem', wordBreak: 'break-all', display: 'block', padding: '4px 6px', background: 'var(--bg-secondary)', borderRadius: '4px', border: '1px solid var(--border-color)', marginTop: '2px', maxHeight: '35px', overflowY: 'auto' }}>
                        {getTableQrUrl(qrTableNumber)}
                      </code>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
                    <div style={{ background: 'white', padding: '6px', borderRadius: '8px', border: '1px solid #ddd', display: 'inline-flex' }}>
                      <img 
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(getTableQrUrl(qrTableNumber))}`} 
                        alt={`QR Mesa ${qrTableNumber}`}
                        style={{ width: '120px', height: '120px', display: 'block' }}
                      />
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1, minWidth: '150px' }}>
                      <button 
                        type="button" 
                        className="btn btn-primary" 
                        style={{ padding: '8px 12px', fontSize: '0.75rem', display: 'flex', gap: '4px', justifyContent: 'center', alignItems: 'center' }}
                        onClick={handlePrintQR}
                      >
                        🖨️ Imprimir Tarjeta Mesa {qrTableNumber}
                      </button>
                      <a 
                        href={`https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(getTableQrUrl(qrTableNumber))}`}
                        target="_blank"
                        rel="noreferrer"
                        download={`qr_mesa_${qrTableNumber}.png`}
                        className="btn btn-secondary"
                        style={{ padding: '8px 12px', fontSize: '0.75rem', textAlign: 'center', textDecoration: 'none', display: 'block' }}
                      >
                        📥 Descargar QR Mesa {qrTableNumber}
                      </a>
                    </div>
                  </div>
                </>
              ) : (
                <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-secondary)', borderRadius: '8px', padding: '20px', border: '1px dashed var(--border-color)', textAlign: 'center' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-light)', fontStyle: 'italic' }}>
                    Activa el Módulo de Pedidos en Mesa arriba para habilitar el generador de códigos QR por mesa.
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Categorías Visibles al Escanear QR en Mesa */}
          {localShopConfig.tableOrdersEnabled !== false && (
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '15px', marginTop: '10px' }}>
              <strong style={{ display: 'block', fontSize: '0.85rem', marginBottom: '8px', color: 'var(--primary-color)' }}>
                📋 Productos/Secciones en la Carta QR de Mesas
              </strong>
              <p style={{ fontSize: '0.7rem', color: 'var(--text-light)', marginBottom: '10px' }}>
                Selecciona qué categorías del menú estarán visibles cuando los clientes escaneen los códigos QR de las mesas:
              </p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingLeft: '10px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 500 }}>
                  <input
                    type="checkbox"
                    checked={(localShopConfig.tableCatalogCategories || ['classic', 'liter', 'packs']).includes('classic')}
                    onChange={(e) => handleToggleTableCategory('classic', e.target.checked)}
                    style={{ width: '15px', height: '15px' }}
                  />
                  <span>🍦 Helados Simples / Sabores (Clásicos)</span>
                </label>
                
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 500 }}>
                  <input
                    type="checkbox"
                    checked={(localShopConfig.tableCatalogCategories || ['classic', 'liter', 'packs']).includes('liter')}
                    onChange={(e) => handleToggleTableCategory('liter', e.target.checked)}
                    style={{ width: '15px', height: '15px' }}
                  />
                  <span>🏺 Potes de Litro (Helado Familiar de 1L)</span>
                </label>
                
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 500 }}>
                  <input
                    type="checkbox"
                    checked={(localShopConfig.tableCatalogCategories || ['classic', 'liter', 'packs']).includes('packs')}
                    onChange={(e) => handleToggleTableCategory('packs', e.target.checked)}
                    style={{ width: '15px', height: '15px' }}
                  />
                  <span>🎁 Packs & Combos Promocionales</span>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* WhatsApp Customization */}
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

        {/* Ticket Customization */}
        <div className="glass" style={{ borderLeft: '4px solid var(--warning)', padding: '15px', background: 'rgba(229, 142, 38, 0.02)', borderRadius: '8px', marginBottom: '15px' }}>
          <strong style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem' }}>
            🖨️ Personalización de Ticket de Entrega
          </strong>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-light)', marginTop: '4px', marginBottom: '12px' }}>
            Define un mensaje personalizado que aparecerá en el pie de página de los tickets físicos impresos para los clientes.
          </p>
          <div className="form-group">
            <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>Mensaje al Pie del Ticket:</label>
            <textarea
              className="form-control"
              rows="2"
              style={{ fontSize: '0.8rem', padding: '6px', resize: 'vertical', width: '100%', fontFamily: 'inherit' }}
              value={localTicketCustomMessage}
              onChange={(e) => setLocalTicketCustomMessage(e.target.value)}
              placeholder="Ej: ¡Gracias por tu compra! Conserva tu helado en el congelador."
            />
          </div>
        </div>

        {/* Coupons */}
        {/* Coupons */}
        <div className="glass" style={{ padding: '15px', borderRadius: '8px', marginBottom: '15px' }}>
          <strong style={{ display: 'block', fontSize: '0.95rem', marginBottom: '8px' }}>🎫 Gestión de Cupones de Descuento</strong>
          
          <form onSubmit={handleAddCouponSubmit} style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '15px', background: 'rgba(0,0,0,0.02)', padding: '10px', borderRadius: '6px', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="CÓDIGO"
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
            <input
              type="number"
              placeholder="Límite canjes (0 = ilimitado)"
              className="form-control"
              style={{ width: '130px', fontSize: '0.8rem', padding: '6px' }}
              value={newCoupon.limit || ''}
              onChange={(e) => setNewCoupon({ ...newCoupon, limit: parseInt(e.target.value, 10) || 0 })}
            />
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', margin: 0 }}>
              <input
                type="checkbox"
                checked={newCoupon.active !== false}
                onChange={(e) => setNewCoupon({ ...newCoupon, active: e.target.checked })}
              />
              Activo
            </label>
            <button type="submit" className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '0.75rem' }}>
              ➕ Añadir
            </button>
          </form>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {!coupons || coupons.length === 0 ? (
              <span style={{ fontSize: '0.8rem', color: 'var(--text-light)' }}>No hay cupones registrados.</span>
            ) : (
              coupons.map(coupon => {
                const isEditing = editingCouponCode === coupon.code;
                return (
                  <div key={coupon.code} style={{ 
                    borderBottom: '1px dashed var(--border-color)', 
                    paddingBottom: '8px', 
                    fontSize: '0.8rem',
                    background: isEditing ? 'rgba(0,0,0,0.01)' : 'transparent',
                    padding: isEditing ? '8px' : '0 0 8px 0',
                    borderRadius: isEditing ? '4px' : '0'
                  }}>
                    {isEditing ? (
                      <form onSubmit={handleSaveCouponEdit} style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                        <input
                          type="text"
                          className="form-control"
                          style={{ width: '110px', fontSize: '0.75rem', padding: '4px', textTransform: 'uppercase' }}
                          value={editCouponData.code}
                          onChange={(e) => setEditCouponData({ ...editCouponData, code: e.target.value.toUpperCase() })}
                          required
                        />
                        <select
                          className="form-control"
                          style={{ width: '110px', fontSize: '0.75rem', padding: '4px' }}
                          value={editCouponData.type}
                          onChange={(e) => setEditCouponData({ ...editCouponData, type: e.target.value })}
                        >
                          <option value="percentage">Porcentaje (%)</option>
                          <option value="flat">Monto Fijo (S/.)</option>
                          <option value="free_delivery">Envío Gratis</option>
                        </select>
                        {editCouponData.type !== 'free_delivery' && (
                          <input
                            type="number"
                            className="form-control"
                            style={{ width: '65px', fontSize: '0.75rem', padding: '4px' }}
                            value={editCouponData.value}
                            onChange={(e) => setEditCouponData({ ...editCouponData, value: parseFloat(e.target.value) || 0 })}
                            required
                          />
                        )}
                        <input
                          type="number"
                          placeholder="Límite"
                          className="form-control"
                          style={{ width: '75px', fontSize: '0.75rem', padding: '4px' }}
                          value={editCouponData.limit || ''}
                          onChange={(e) => setEditCouponData({ ...editCouponData, limit: parseInt(e.target.value, 10) || 0 })}
                        />
                        <label style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.75rem', margin: 0 }}>
                          <input
                            type="checkbox"
                            checked={editCouponData.active !== false}
                            onChange={(e) => setEditCouponData({ ...editCouponData, active: e.target.checked })}
                          />
                          Activo
                        </label>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button type="submit" className="btn btn-primary" style={{ padding: '2px 6px', fontSize: '0.7rem' }} title="Guardar">💾</button>
                          <button type="button" className="btn btn-secondary" style={{ padding: '2px 6px', fontSize: '0.7rem' }} onClick={() => { setEditingCouponCode(null); setEditCouponData(null); }} title="Cancelar">❌</button>
                        </div>
                      </form>
                    ) : (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <strong style={{ color: coupon.active ? 'var(--primary-color)' : 'var(--text-light)', textDecoration: coupon.active ? 'none' : 'line-through' }}>
                            {coupon.code}
                          </strong>
                          <span style={{ color: 'var(--text-light)', marginLeft: '10px' }}>
                            {coupon.type === 'percentage' && `${coupon.value}% de desc.`}
                            {coupon.type === 'flat' && `S/. ${coupon.value.toFixed(2)} de desc.`}
                            {coupon.type === 'free_delivery' && 'Envío Gratis'}
                          </span>
                          <span style={{ 
                            fontSize: '0.7rem', 
                            marginLeft: '10px', 
                            padding: '1px 5px', 
                            borderRadius: '4px', 
                            background: 'var(--bg-secondary)', 
                            color: 'var(--text-light)',
                            fontWeight: '600'
                          }}>
                            Canjes: {coupon.usedCount || 0} / {coupon.limit > 0 ? coupon.limit : '∞'}
                          </span>
                          <span 
                            onClick={() => handleToggleCouponActive(coupon.code)}
                            style={{ 
                              fontSize: '0.68rem', 
                              marginLeft: '10px', 
                              padding: '1px 6px', 
                              borderRadius: '12px', 
                              background: coupon.active ? 'rgba(46,204,113,0.1)' : 'rgba(231,76,60,0.1)', 
                              color: coupon.active ? 'var(--success)' : 'var(--danger)',
                              cursor: 'pointer',
                              fontWeight: 'bold',
                              userSelect: 'none'
                            }}
                            title="Haz clic para activar/desactivar"
                          >
                            {coupon.active ? '🟢 Activo' : '🔴 Inactivo'}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <button
                            type="button"
                            onClick={() => handleEditCouponClick(coupon)}
                            style={{ background: 'none', border: 'none', color: 'var(--primary-color)', cursor: 'pointer', fontSize: '0.85rem' }}
                            title="Editar cupón"
                          >
                            ✏️
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              onUpdateCoupons(coupons.filter(c => c.code !== coupon.code));
                              addLog(`Cupón eliminado: ${coupon.code}.`);
                            }}
                            style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '0.85rem' }}
                            title="Eliminar cupón"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>



        {/* Cloudflare R2 */}
        <div className="glass" style={{ padding: '15px', borderRadius: '8px', marginBottom: '15px' }}>
          <strong style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', marginBottom: '4px' }}>
            📸 Almacenamiento Cloudflare R2
          </strong>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-light)', marginBottom: '0' }}>
            La subida de imágenes ahora se resuelve del lado del servidor. Configura las claves de R2 como variables de entorno en Cloudflare Pages.
          </p>
        </div>

        {/* 1 Liter Configuration */}
        <div className="glass" style={{ padding: '15px', borderRadius: '8px', marginBottom: '15px' }}>
          <strong style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', marginBottom: '4px' }}>
            🏺 Configuración del Helado de 1 Litro (Familiar)
          </strong>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-light)', marginBottom: '12px' }}>
            Habilita la venta de potes de litro y define sus parámetros de personalización y fotografía.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Activar Venta de Litro en la Tienda</span>
              <label className="toggle-switch" style={{ transform: 'scale(0.8)' }}>
                <input 
                  type="checkbox" 
                  checked={localLiterActive} 
                  onChange={(e) => setLocalLiterActive(e.target.checked)} 
                />
                <span className="slider"></span>
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div className="form-group">
                <label style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>Precio Base S/.</label>
                <input
                  type="number"
                  step="0.50"
                  className="form-control"
                  style={{ fontSize: '0.8rem', padding: '6px 10px' }}
                  value={localLiterPrice}
                  onChange={(e) => setLocalLiterPrice(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>Máx. Sabores por Pote</label>
                <input
                  type="number"
                  min="1"
                  max="5"
                  className="form-control"
                  style={{ fontSize: '0.8rem', padding: '6px 10px' }}
                  value={localLiterMaxFlavors}
                  onChange={(e) => setLocalLiterMaxFlavors(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label style={{ fontSize: '0.75rem', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>
                Fotografía de Presentación (Litro)
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {localLiterImage ? (
                  <img 
                    src={localLiterImage} 
                    alt="Pote Litro" 
                    width="40"
                    height="40"
                    style={{ width: '40px', height: '40px', objectFit: 'contain', border: '1px solid var(--border-color)', borderRadius: '6px' }} 
                  />
                ) : (
                  <span style={{ fontSize: '2rem' }}>🏺</span>
                )}
                
                <div style={{ flex: 1 }}>
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    id="liter-image-upload"
                    onChange={(e) => handleImageUpload(e.target.files[0], 'liter', setLocalLiterImage)}
                  />
                  <label 
                    htmlFor="liter-image-upload" 
                    className="btn btn-secondary" 
                    style={{ padding: '6px 10px', fontSize: '0.75rem', display: 'inline-block', cursor: 'pointer', textAlign: 'center' }}
                  >
                    {uploadingState.liter ? '⏳ Subiendo...' : '📷 Subir Foto R2'}
                  </label>
                  {localLiterImage && (
                    <button 
                      type="button" 
                      className="btn btn-secondary" 
                      style={{ padding: '6px 10px', fontSize: '0.75rem', color: 'var(--danger)', borderColor: 'var(--danger)', marginLeft: '6px' }}
                      onClick={() => setLocalLiterImage('')}
                    >
                      Quitar
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Logs */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
            <strong style={{ fontSize: '0.9rem' }}>📜 Bitácora de Operaciones Recientes (Auditoría)</strong>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <input 
                type="text" 
                className="form-control" 
                placeholder="🔍 Buscar..." 
                style={{ width: '100px', fontSize: '0.7rem', padding: '3px 8px', height: '24px' }} 
                value={logSearchQuery} 
                onChange={(e) => setLogSearchQuery(e.target.value)} 
              />
              <select 
                className="form-control" 
                style={{ width: '70px', fontSize: '0.7rem', padding: '2px 5px', height: '24px', cursor: 'pointer' }}
                value={logsLimit}
                onChange={(e) => setLogsLimit(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
              >
                <option value={20}>20 últ.</option>
                <option value={50}>50 últ.</option>
                <option value="all">Todo</option>
              </select>
              <button 
                type="button" 
                className="btn btn-secondary" 
                style={{ padding: '2px 8px', fontSize: '0.7rem', height: '24px' }} 
                onClick={handleExportAuditoryLog}
              >
                📥 Exportar
              </button>
            </div>
          </div>
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
            {(() => {
              const filtered = logs.filter(l => 
                l.text.toLowerCase().includes(logSearchQuery.toLowerCase()) || 
                l.time.includes(logSearchQuery)
              );
              const sliced = logsLimit === 'all' ? filtered : filtered.slice(0, logsLimit);
              if (sliced.length === 0) {
                return <span style={{ color: 'var(--text-light)', fontSize: '0.75rem', fontStyle: 'italic' }}>Sin operaciones coincidentes.</span>;
              }
              return sliced.map((log, idx) => (
                <div key={idx} style={{ borderBottom: '1px dashed rgba(0,0,0,0.05)', paddingBottom: '2px' }}>
                  <span style={{ color: 'var(--primary-color)', marginRight: '5px' }}>[{log.time}]</span>
                  <span>{log.text}</span>
                </div>
              ));
            })()}
          </div>
        </div>

        {/* Backups */}
        <div className="glass" style={{ padding: '20px', marginBottom: '10px' }}>
          <h4 style={{ marginBottom: '10px' }}>📦 Respaldo de Base de Datos</h4>
          <p style={{ color: 'var(--text-light)', fontSize: '0.8rem', marginBottom: '15px' }}>
            Exporta toda la configuración de la tienda a un archivo JSON local, o restáurala en cualquier momento.
          </p>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button 
              type="button" 
              className="btn btn-secondary" 
              onClick={handleExportBackup} 
              style={{ fontSize: '0.85rem', padding: '10px 18px' }}
            >
              📥 Descargar Copia
            </button>
            <input 
              type="file" 
              accept=".json" 
              id="import-backup-file-input" 
              style={{ display: 'none' }} 
              onChange={handleImportBackup} 
            />
            <label 
              htmlFor="import-backup-file-input" 
              className="btn btn-primary" 
              style={{ fontSize: '0.85rem', padding: '10px 18px', cursor: 'pointer', margin: 0 }}
            >
              📤 Subir Copia
            </label>
          </div>
        </div>

        {/* Catalog Ordering */}
        <div className="glass" style={{ padding: '20px', borderRadius: '8px', borderLeft: '4px solid var(--secondary-color)', background: 'rgba(229, 142, 38, 0.02)', marginBottom: '15px' }}>
          <strong>🗂️ Prioridad y Orden de Secciones en la Carta</strong>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-light)', marginTop: '4px', marginBottom: '15px' }}>
            Usa los botones para reorganizar cómo se muestran las categorías en el catálogo principal en tiempo real.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {localCatalogOrder.map((section, idx) => {
              const label = section === 'liter' 
                ? '🏺 Helado Familiar de 1 Litro' 
                : section === 'classic' 
                ? '🍦 Helados Simples / Sabores' 
                : '🎁 Packs & Combos Promocionales';
              return (
                <div key={section} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'var(--bg-primary)',
                  padding: '10px 15px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)'
                }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{label}</span>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      type="button"
                      className="admin-action-btn"
                      style={{ padding: '2px 6px', fontSize: '0.75rem' }}
                      disabled={idx === 0}
                      onClick={() => {
                        const newOrder = [...localCatalogOrder];
                        const temp = newOrder[idx];
                        newOrder[idx] = newOrder[idx - 1];
                        newOrder[idx - 1] = temp;
                        setLocalCatalogOrder(newOrder);
                      }}
                    >
                      ⬆️
                    </button>
                    <button
                      type="button"
                      className="admin-action-btn"
                      style={{ padding: '2px 6px', fontSize: '0.75rem' }}
                      disabled={idx === localCatalogOrder.length - 1}
                      onClick={() => {
                        const newOrder = [...localCatalogOrder];
                        const temp = newOrder[idx];
                        newOrder[idx] = newOrder[idx + 1];
                        newOrder[idx + 1] = temp;
                        setLocalCatalogOrder(newOrder);
                      }}
                    >
                      ⬇️
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-secondary" onClick={onLogout} style={{ color: 'var(--danger)', borderColor: 'var(--danger)', fontSize: '0.8rem', padding: '6px 12px' }}>
            🚪 Cerrar Sesión ({currentUser?.name})
          </button>
          <button className="btn btn-primary" onClick={handleSaveSettings} style={{ padding: '8px 20px', fontSize: '0.85rem', cursor: 'pointer' }}>
            💾 Guardar Ajustes de Heladería
          </button>
        </div>

      </div>
    </div>
  );
}
