import { useState, useMemo, useEffect, useCallback, Component } from 'react';
import { sanitizeText } from '../../utils/security';


/**
 * Componente de protección contra errores inesperados (Error Boundary)
 * Garantiza que si algún dato corrupto de pedido o cliente falla, el panel no quede en blanco.
 */
class CRMErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('CRM Error Boundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="glass-card" style={{ padding: '30px', textAlign: 'center', margin: '20px auto', maxWidth: '600px', borderRadius: '16px' }}>
          <div style={{ fontSize: '3rem', marginBottom: '10px' }}>⚠️</div>
          <h3 style={{ color: 'var(--danger, #e74c3c)', margin: '0 0 10px' }}>Ocurrió un inconveniente al cargar el CRM</h3>
          <p style={{ color: 'var(--text-light)', fontSize: '0.9rem', marginBottom: '20px' }}>
            Se ha detectado un registro con formato inusual. El sistema se ha protegido para mantener seguro el panel administrativo.
          </p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
          >
            🔄 Recargar Módulo
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// --- UTILIDADES DEFENSIVAS Y DE SEGURIDAD ---
const safeNum = (val, defaultVal = 0) => {
  const n = parseFloat(val);
  return Number.isFinite(n) ? n : defaultVal;
};

const safeGetTime = (dateVal) => {
  if (!dateVal) return 0;
  const t = new Date(dateVal).getTime();
  return Number.isFinite(t) ? t : 0;
};

const safeFormatDate = (dateVal, options = {}) => {
  if (!dateVal) return 'Sin fecha';
  try {
    const d = new Date(dateVal);
    if (!Number.isFinite(d.getTime())) return 'Fecha reciente';
    return d.toLocaleDateString('es-PE', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      ...options
    });
  } catch {
    return 'Fecha reciente';
  }
};

const safeFormatDateTime = (dateVal) => {
  if (!dateVal) return 'Sin fecha';
  try {
    const d = new Date(dateVal);
    if (!Number.isFinite(d.getTime())) return 'Fecha reciente';
    return d.toLocaleString('es-PE', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return 'Fecha reciente';
  }
};

const normalizePhone = (rawPhone) => {
  if (!rawPhone) return '';
  const digits = String(rawPhone).replace(/\D/g, '');
  return digits;
};

const formatPeruvianPhoneForWhatsApp = (rawPhone) => {
  const clean = normalizePhone(rawPhone);
  if (!clean) return '';
  if (clean.length === 9 && !clean.startsWith('51')) {
    return `51${clean}`;
  }
  return clean;
};

// Etiquetas predeterminadas recomendadas
const DEFAULT_TAG_OPTIONS = [
  { label: '🌟 VIP Oro', color: '#f39c12' },
  { label: '🛵 Delivery Frecuente', color: '#3498db' },
  { label: '🍦 Fan del Helado', color: '#9b59b6' },
  { label: '🎂 Cumpleañero', color: '#e91e63' },
  { label: '🏢 Corporativo', color: '#34495e' },
  { label: '💳 Paga con Yape', color: '#00b894' },
  { label: '🚫 Exigente/Especial', color: '#e17055' }
];

/**
 * CustomerCRM - Sistema Integral de Gestión, Fidelización y Marketing de Clientes
 */
function CustomerCRMContent({
  orders = [],
  storeName = 'Friozo',
  showAlert,
  coupons = [],
  onUpdateCoupons,
  shopConfig = {},
  onChangeShopConfig,
  onNavigate
}) {
  // Estados de vista y filtros
  const [search, setSearch] = useState('');
  const [selectedSegment, setSelectedSegment] = useState('all'); // all, vip, frequent, new, inactive, birthdays, tagged
  const [sortBy, setSortBy] = useState('ltv_desc'); // ltv_desc, orders_desc, date_desc, name_asc, avg_ticket_desc
  const [selectedTagFilter, setSelectedTagFilter] = useState('');

  // Modales interactivos
  const [selectedCustomerForHistory, setSelectedCustomerForHistory] = useState(null);
  const [customerForWhatsApp, setCustomerForWhatsApp] = useState(null);
  const [customerForCoupon, setCustomerForCoupon] = useState(null);
  const [customerForEdit, setCustomerForEdit] = useState(null);
  const [showNewCustomerModal, setShowNewCustomerModal] = useState(false);
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);

  // Datos persistentes sincronizados (Nube + LocalStorage Fallback)
  const [crmMetadata, setCrmMetadata] = useState(() => {
    try {
      if (shopConfig?.crmData && typeof shopConfig.crmData === 'object') {
        return shopConfig.crmData;
      }
      const saved = localStorage.getItem('friozo_crm_data_v2');
      if (saved) return JSON.parse(saved);
      // Migración de notas legacy
      const legacyNotes = localStorage.getItem('friozo_crm_customer_notes');
      if (legacyNotes) {
        return { notes: JSON.parse(legacyNotes), tags: {}, birthdays: {}, manualCustomers: [] };
      }
    } catch {
      /* ignore */
    }
    return { notes: {}, tags: {}, birthdays: {}, manualCustomers: [] };
  });

  // Mantener en sincronía con shopConfig cuando cambie remotamente
  useEffect(() => {
    if (shopConfig?.crmData && typeof shopConfig.crmData === 'object') {
      setCrmMetadata(prev => ({
        notes: { ...(prev?.notes || {}), ...(shopConfig.crmData.notes || {}) },
        tags: { ...(prev?.tags || {}), ...(shopConfig.crmData.tags || {}) },
        birthdays: { ...(prev?.birthdays || {}), ...(shopConfig.crmData.birthdays || {}) },
        manualCustomers: shopConfig.crmData.manualCustomers || prev?.manualCustomers || []
      }));
    }
  }, [shopConfig?.crmData]);

  // Persistir metadatos tanto en LocalStorage como en Supabase shopConfig
  const saveCrmMetadata = useCallback((updater) => {
    setCrmMetadata(prev => {
      const updated = typeof updater === 'function' ? updater(prev) : updater;
      try {
        localStorage.setItem('friozo_crm_data_v2', JSON.stringify(updated));
      } catch (e) {
        console.warn('Error guardando en localStorage CRM:', e);
      }
      if (typeof onChangeShopConfig === 'function') {
        try {
          onChangeShopConfig({
            ...shopConfig,
            crmData: updated
          });
        } catch (e) {
          console.warn('Error sincronizando CRM con shopConfig:', e);
        }
      }
      return updated;
    });
  }, [onChangeShopConfig, shopConfig]);

  // Guardar nota individual
  const handleSaveNote = (customerKey, noteText) => {
    const cleanNote = sanitizeText(noteText);
    saveCrmMetadata(prev => ({
      ...prev,
      notes: { ...(prev?.notes || {}), [customerKey]: cleanNote }
    }));
  };

  // Guardar o alternar etiqueta (Tag)
  const handleToggleTag = (customerKey, tagLabel) => {
    saveCrmMetadata(prev => {
      const curTags = prev?.tags?.[customerKey] || [];
      const exists = curTags.includes(tagLabel);
      const newTags = exists ? curTags.filter(t => t !== tagLabel) : [...curTags, tagLabel];
      return {
        ...prev,
        tags: { ...(prev?.tags || {}), [customerKey]: newTags }
      };
    });
  };

  // Guardar cumpleaños
  const handleSaveBirthday = (customerKey, birthdayStr) => {
    saveCrmMetadata(prev => ({
      ...prev,
      birthdays: { ...(prev?.birthdays || {}), [customerKey]: birthdayStr }
    }));
  };

  // Crear o editar cliente manual
  const handleSaveManualCustomer = (custData) => {
    saveCrmMetadata(prev => {
      const currentList = Array.isArray(prev?.manualCustomers) ? [...prev.manualCustomers] : [];
      const existingIdx = currentList.findIndex(c => c.key === custData.key);
      if (existingIdx >= 0) {
        currentList[existingIdx] = { ...currentList[existingIdx], ...custData };
      } else {
        currentList.unshift(custData);
      }
      return {
        ...prev,
        manualCustomers: currentList
      };
    });
  };

  // --- AGREGACIÓN Y ANÁLISIS DE CLIENTES ---
  const customers = useMemo(() => {
    const map = new Map();
    const now = Date.now();
    const currentMonth = new Date().getMonth() + 1; // 1-12

    // 1. Procesar pedidos de la tienda
    (orders || []).forEach(order => {
      if (!order) return;
      const c = order.customer || {};
      const rawPhone = String(c.phone || '').trim();
      const clean = normalizePhone(rawPhone);
      const rawName = String(c.name || 'Cliente sin nombre').trim();

      // Clave unívoca
      const key = clean ? `phone_${clean}` : `name_${rawName.toLowerCase()}`;

      if (!map.has(key)) {
        map.set(key, {
          key,
          name: rawName !== 'Cliente sin nombre' ? rawName : (clean ? `Cliente ${clean}` : 'Cliente Friozo'),
          phone: rawPhone,
          cleanPhone: clean,
          address: sanitizeText(c.address || ''),
          totalOrders: 0,
          cancelledOrders: 0,
          totalSpent: 0,
          firstOrderDate: order.date || new Date().toISOString(),
          lastOrderDate: order.date || new Date().toISOString(),
          orders: [],
          itemCounts: {},
          paymentMethods: {},
          isManual: false
        });
      }

      const client = map.get(key);
      const grandTotal = safeNum(order.grandTotal, 0);

      if (order.status === 'Cancelado') {
        client.cancelledOrders += 1;
      } else {
        client.totalOrders += 1;
        client.totalSpent += grandTotal;
      }

      // Fechas de pedido
      const orderTime = safeGetTime(order.date);
      if (orderTime > 0) {
        if (safeGetTime(client.lastOrderDate) < orderTime) {
          client.lastOrderDate = order.date;
          if (c.address) client.address = sanitizeText(c.address);
          if (rawName && rawName !== 'Cliente sin nombre') client.name = rawName;
        }
        if (safeGetTime(client.firstOrderDate) > orderTime || safeGetTime(client.firstOrderDate) === 0) {
          client.firstOrderDate = order.date;
        }
      }

      // Método de pago recurrente
      const pMethod = order.paymentMethod || 'Efectivo';
      client.paymentMethods[pMethod] = (client.paymentMethods[pMethod] || 0) + 1;

      // Conteo de productos
      (order.items || []).forEach(item => {
        if (!item) return;
        const iName = item.name || 'Helado';
        const qty = safeNum(item.quantity, 1);
        client.itemCounts[iName] = (client.itemCounts[iName] || 0) + qty;
      });

      client.orders.push(order);
    });

    // 2. Incorporar clientes manuales registrados
    (crmMetadata?.manualCustomers || []).forEach(mCust => {
      if (!mCust || !mCust.key) return;
      if (!map.has(mCust.key)) {
        map.set(mCust.key, {
          key: mCust.key,
          name: mCust.name || 'Cliente Registrado',
          phone: mCust.phone || '',
          cleanPhone: normalizePhone(mCust.phone),
          address: mCust.address || '',
          totalOrders: mCust.totalOrders || 0,
          cancelledOrders: 0,
          totalSpent: safeNum(mCust.totalSpent, 0),
          firstOrderDate: mCust.createdAt || new Date().toISOString(),
          lastOrderDate: mCust.lastOrderDate || mCust.createdAt || new Date().toISOString(),
          orders: [],
          itemCounts: {},
          paymentMethods: {},
          isManual: true,
          favoriteItem: mCust.favoriteItem || ''
        });
      } else {
        // Enriquecer datos con manuales si existen
        const existing = map.get(mCust.key);
        if (mCust.name && existing.name === 'Cliente sin nombre') existing.name = mCust.name;
        if (mCust.address && !existing.address) existing.address = mCust.address;
      }
    });

    // 3. Post-procesamiento y segmentación inteligente
    const list = Array.from(map.values()).map(c => {
      // Sabor o producto favorito
      if (!c.favoriteItem) {
        const sortedFavs = Object.entries(c.itemCounts || {}).sort((a, b) => b[1] - a[1]);
        c.favoriteItem = sortedFavs[0] ? sortedFavs[0][0] : 'Helado Artesanal';
      }

      // Método de pago predilecto
      const sortedPayments = Object.entries(c.paymentMethods || {}).sort((a, b) => b[1] - a[1]);
      c.favoritePayment = sortedPayments[0] ? sortedPayments[0][0] : 'Efectivo';

      // Ticket promedio
      c.avgTicket = c.totalOrders > 0 ? (c.totalSpent / c.totalOrders) : c.totalSpent;

      // Días de inactividad
      const lastMs = safeGetTime(c.lastOrderDate);
      if (lastMs > 0) {
        const daysAgo = Math.floor((now - lastMs) / (1000 * 60 * 60 * 24));
        c.daysSinceLast = Math.max(0, daysAgo);
      } else {
        c.daysSinceLast = 0;
      }

      // Cumpleaños
      c.birthday = crmMetadata?.birthdays?.[c.key] || '';
      c.isBirthdayMonth = false;
      if (c.birthday) {
        try {
          const parts = c.birthday.split('-');
          if (parts.length >= 2) {
            const bMonth = parseInt(parts[1], 10);
            if (bMonth === currentMonth) c.isBirthdayMonth = true;
          }
        } catch {
          /* ignore */
        }
      }

      // Etiquetas asignadas
      c.tags = crmMetadata?.tags?.[c.key] || [];

      // Nota rápida asignada
      c.note = crmMetadata?.notes?.[c.key] || '';

      // Segmentación RFM
      if (c.totalSpent >= 80 || c.totalOrders >= 4) {
        c.segment = 'vip';
        c.segmentLabel = '🌟 VIP';
        c.segmentColor = '#f39c12';
      } else if (c.totalOrders >= 2) {
        c.segment = 'frequent';
        c.segmentLabel = '🔄 Frecuente';
        c.segmentColor = '#27ae60';
      } else if (c.totalOrders === 1 && c.daysSinceLast <= 25) {
        c.segment = 'new';
        c.segmentLabel = '🌱 Nuevo';
        c.segmentColor = '#2980b9';
      } else if (c.daysSinceLast > 30) {
        c.segment = 'inactive';
        c.segmentLabel = '💤 Inactivo';
        c.segmentColor = '#7f8c8d';
      } else {
        c.segment = 'regular';
        c.segmentLabel = '👤 Regular';
        c.segmentColor = '#8e44ad';
      }

      return c;
    });

    return list;
  }, [orders, crmMetadata]);

  // Métricas generales KPI
  const metrics = useMemo(() => {
    const totalClients = customers.length;
    const totalLtv = customers.reduce((sum, c) => sum + c.totalSpent, 0);
    const vipCount = customers.filter(c => c.segment === 'vip').length;
    const frequentCount = customers.filter(c => c.segment === 'frequent').length;
    const newCount = customers.filter(c => c.segment === 'new').length;
    const inactiveCount = customers.filter(c => c.segment === 'inactive').length;
    const birthdayMonthCount = customers.filter(c => c.isBirthdayMonth).length;
    const totalOrdersCount = customers.reduce((s, c) => s + c.totalOrders, 0);
    const globalAvgTicket = totalOrdersCount > 0 ? (totalLtv / totalOrdersCount) : 0;

    return {
      totalClients,
      totalLtv,
      vipCount,
      frequentCount,
      newCount,
      inactiveCount,
      birthdayMonthCount,
      globalAvgTicket
    };
  }, [customers]);

  // Lista filtrada y ordenada
  const filteredCustomers = useMemo(() => {
    const query = search.trim().toLowerCase();

    return customers
      .filter(c => {
        // Filtro por segmento
        if (selectedSegment === 'vip' && c.segment !== 'vip') return false;
        if (selectedSegment === 'frequent' && c.segment !== 'frequent') return false;
        if (selectedSegment === 'new' && c.segment !== 'new') return false;
        if (selectedSegment === 'inactive' && c.segment !== 'inactive') return false;
        if (selectedSegment === 'birthdays' && !c.isBirthdayMonth) return false;
        if (selectedSegment === 'tagged' && c.tags.length === 0) return false;

        // Filtro por etiqueta específica
        if (selectedTagFilter && !c.tags.includes(selectedTagFilter)) return false;

        // Búsqueda por texto libre
        if (!query) return true;
        return (
          (c.name || '').toLowerCase().includes(query) ||
          (c.phone || '').toLowerCase().includes(query) ||
          (c.address || '').toLowerCase().includes(query) ||
          (c.favoriteItem || '').toLowerCase().includes(query) ||
          (c.note || '').toLowerCase().includes(query) ||
          c.tags.some(t => t.toLowerCase().includes(query))
        );
      })
      .sort((a, b) => {
        if (sortBy === 'ltv_desc') return b.totalSpent - a.totalSpent;
        if (sortBy === 'orders_desc') return b.totalOrders - a.totalOrders;
        if (sortBy === 'date_desc') return safeGetTime(b.lastOrderDate) - safeGetTime(a.lastOrderDate);
        if (sortBy === 'name_asc') return (a.name || '').localeCompare(b.name || '');
        if (sortBy === 'avg_ticket_desc') return b.avgTicket - a.avgTicket;
        return 0;
      });
  }, [customers, search, selectedSegment, selectedTagFilter, sortBy]);

  // --- ACCIÓN: EXPORTAR A CSV (EXCEL) ---
  const handleExportCSV = () => {
    if (customers.length === 0) {
      showAlert?.('Sin Datos', 'No hay clientes para exportar.', 'info');
      return;
    }

    let csv = '\uFEFF'; // BOM para soporte de tildes y caracteres en Excel
    csv += 'Nombre,Teléfono,Segmento,Pedidos,LTV Total (S/.),Ticket Promedio (S/.),Última Compra,Dirección,Favorito,Cumpleaños,Etiquetas,Notas\n';

    customers.forEach(c => {
      const cleanName = `"${(c.name || '').replace(/"/g, '""')}"`;
      const phone = `"${c.phone || ''}"`;
      const seg = `"${c.segmentLabel || ''}"`;
      const addr = `"${(c.address || '').replace(/"/g, '""')}"`;
      const fav = `"${(c.favoriteItem || '').replace(/"/g, '""')}"`;
      const date = `"${safeFormatDate(c.lastOrderDate)}"`;
      const bday = `"${c.birthday || ''}"`;
      const tagsStr = `"${(c.tags || []).join('; ').replace(/"/g, '""')}"`;
      const noteStr = `"${(c.note || '').replace(/"/g, '""')}"`;

      csv += `${cleanName},${phone},${seg},${c.totalOrders},${c.totalSpent.toFixed(2)},${c.avgTicket.toFixed(2)},${date},${addr},${fav},${bday},${tagsStr},${noteStr}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `directorio_clientes_${storeName.toLowerCase()}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showAlert?.('Descarga Lista', 'Se descargó el archivo CSV compatible con Excel.', 'success');
  };

  // --- ACCIÓN: EXPORTAR A VCARD (.VCF) PARA SMARTPHONE / WHATSAPP ---
  const handleExportVCard = () => {
    const clientsWithPhone = customers.filter(c => c.cleanPhone);
    if (clientsWithPhone.length === 0) {
      showAlert?.('Sin Teléfonos', 'No hay clientes con teléfono registrado para exportar a vCard.', 'info');
      return;
    }

    let vcf = '';
    clientsWithPhone.forEach(c => {
      const formattedPhone = formatPeruvianPhoneForWhatsApp(c.cleanPhone);
      vcf += 'BEGIN:VCARD\n';
      vcf += 'VERSION:3.0\n';
      vcf += `FN:${c.name} (${storeName})\n`;
      vcf += `TEL;TYPE=CELL:+${formattedPhone}\n`;
      if (c.address) vcf += `ADR;TYPE=HOME:;;${c.address};;;;\n`;
      if (c.note || c.favoriteItem) vcf += `NOTE:Favorito: ${c.favoriteItem}. Nota: ${c.note}\n`;
      vcf += 'END:VCARD\n';
    });

    const blob = new Blob([vcf], { type: 'text/vcard;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `contactos_${storeName.toLowerCase()}_${new Date().toISOString().split('T')[0]}.vcf`;
    link.click();
    URL.revokeObjectURL(url);
    showAlert?.('Contactos Exportados', 'Archivo vCard (.vcf) listo para importar en tu teléfono o WhatsApp Business.', 'success');
  };

  // --- ACCIÓN: REORDENAR O TOMAR PEDIDO CON ESTE CLIENTE ---
  const handleStartOrderForCustomer = (customer) => {
    if (typeof onNavigate === 'function') {
      try {
        localStorage.setItem('friozo_ordertaker_prefill', JSON.stringify({
          name: customer.name,
          phone: customer.phone || customer.cleanPhone,
          address: customer.address || ''
        }));
      } catch {
        /* ignore */
      }
      onNavigate('ordertaker');
      showAlert?.('Tomador de Pedidos', `Se cargaron los datos de ${customer.name} en el mostrador.`, 'info');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      {/* Encabezado y Barra de Acciones Principales */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '16px'
      }}>
        <div>
          <h2 style={{ margin: 0, color: 'var(--text-dark)', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.45rem' }}>
            📇 CRM y Fidelización de Clientes
          </h2>
          <p style={{ margin: '5px 0 0', color: 'var(--text-light)', fontSize: '0.88rem' }}>
            Gestión de recurrencia (LTV), perfiles, campañas personalizadas por WhatsApp y cupones de recompensa.
          </p>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setShowNewCustomerModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.84rem' }}
          >
            ➕ Nuevo Cliente
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setShowBroadcastModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.84rem' }}
            title="Preparar texto de difusión masiva o estado de WhatsApp"
          >
            📢 Difusión WhatsApp
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleExportCSV}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.84rem' }}
            title="Exportar a archivo Excel / CSV"
          >
            📊 Exportar CSV
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleExportVCard}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.84rem' }}
            title="Exportar archivo .vcf para importar contactos a tu teléfono"
          >
            📇 Exportar vCard
          </button>
        </div>
      </div>

      {/* Tarjetas KPI de Rendimiento */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: '12px'
      }}>
        <div className="glass-card" style={{ padding: '14px', borderRadius: '14px' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-light)', textTransform: 'uppercase', fontWeight: 700 }}>
            Clientes Totales
          </span>
          <div style={{ fontSize: '1.55rem', fontWeight: 800, color: 'var(--text-dark)', marginTop: '4px' }}>
            {metrics.totalClients}
          </div>
          <span style={{ fontSize: '0.72rem', color: 'var(--primary-color)' }}>Cartera activa</span>
        </div>

        <div className="glass-card" style={{ padding: '14px', borderRadius: '14px' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-light)', textTransform: 'uppercase', fontWeight: 700 }}>
            LTV Acumulado
          </span>
          <div style={{ fontSize: '1.55rem', fontWeight: 800, color: '#27ae60', marginTop: '4px' }}>
            S/ {metrics.totalLtv.toFixed(2)}
          </div>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-light)' }}>Ventas generadas</span>
        </div>

        <div className="glass-card" style={{ padding: '14px', borderRadius: '14px' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-light)', textTransform: 'uppercase', fontWeight: 700 }}>
            Clientes VIP
          </span>
          <div style={{ fontSize: '1.55rem', fontWeight: 800, color: '#f39c12', marginTop: '4px' }}>
            {metrics.vipCount}
          </div>
          <span style={{ fontSize: '0.72rem', color: '#f39c12' }}>≥ S/ 80 o ≥ 4 compras</span>
        </div>

        <div className="glass-card" style={{ padding: '14px', borderRadius: '14px' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-light)', textTransform: 'uppercase', fontWeight: 700 }}>
            Frecuentes
          </span>
          <div style={{ fontSize: '1.55rem', fontWeight: 800, color: '#2980b9', marginTop: '4px' }}>
            {metrics.frequentCount}
          </div>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-light)' }}>≥ 2 compras</span>
        </div>

        <div className="glass-card" style={{ padding: '14px', borderRadius: '14px' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-light)', textTransform: 'uppercase', fontWeight: 700 }}>
            Ticket Promedio
          </span>
          <div style={{ fontSize: '1.55rem', fontWeight: 800, color: 'var(--primary-color)', marginTop: '4px' }}>
            S/ {metrics.globalAvgTicket.toFixed(2)}
          </div>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-light)' }}>Por pedido</span>
        </div>

        {metrics.birthdayMonthCount > 0 && (
          <div className="glass-card" style={{ padding: '14px', borderRadius: '14px', border: '1px solid #e91e63' }}>
            <span style={{ fontSize: '0.72rem', color: '#e91e63', textTransform: 'uppercase', fontWeight: 700 }}>
              🎂 Cumpleañeros Mes
            </span>
            <div style={{ fontSize: '1.55rem', fontWeight: 800, color: '#e91e63', marginTop: '4px' }}>
              {metrics.birthdayMonthCount}
            </div>
            <span style={{ fontSize: '0.72rem', color: '#e91e63' }}>¡Envíales su regalo!</span>
          </div>
        )}
      </div>

      {/* Controles de Búsqueda, Filtros y Segmentación */}
      <div className="glass-card" style={{ padding: '16px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ flex: '1 1 280px', position: 'relative' }}>
            <input
              type="text"
              className="form-control"
              placeholder="🔍 Buscar cliente por nombre, teléfono, dirección, sabor, etiquetas..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: '100%', fontSize: '0.9rem', padding: '8px 14px' }}
            />
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <label style={{ fontSize: '0.82rem', color: 'var(--text-light)', fontWeight: 600, margin: 0 }}>
                Ordenar:
              </label>
              <select
                className="form-control"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                style={{ width: 'auto', padding: '6px 10px', fontSize: '0.83rem' }}
              >
                <option value="ltv_desc">💰 Mayor Inversión (LTV)</option>
                <option value="orders_desc">📦 Más Pedidos</option>
                <option value="date_desc">🗓️ Última Compra</option>
                <option value="avg_ticket_desc">🎯 Mayor Ticket Promedio</option>
                <option value="name_asc">🔤 Nombre (A - Z)</option>
              </select>
            </div>

            {/* Filtro por Tag específico */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <label style={{ fontSize: '0.82rem', color: 'var(--text-light)', fontWeight: 600, margin: 0 }}>
                Etiqueta:
              </label>
              <select
                className="form-control"
                value={selectedTagFilter}
                onChange={(e) => setSelectedTagFilter(e.target.value)}
                style={{ width: 'auto', padding: '6px 10px', fontSize: '0.83rem' }}
              >
                <option value="">Todas las etiquetas</option>
                {DEFAULT_TAG_OPTIONS.map(tag => (
                  <option key={tag.label} value={tag.label}>{tag.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Segmentos rápidos */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-light)', marginRight: '4px' }}>
            Segmento:
          </span>
          {[
            { id: 'all', label: `Todos (${customers.length})` },
            { id: 'vip', label: `🌟 VIP (${metrics.vipCount})` },
            { id: 'frequent', label: `🔄 Frecuentes (${metrics.frequentCount})` },
            { id: 'new', label: `🌱 Nuevos (${metrics.newCount})` },
            { id: 'inactive', label: `💤 Inactivos (${metrics.inactiveCount})` },
            ...(metrics.birthdayMonthCount > 0 ? [{ id: 'birthdays', label: `🎂 Cumpleaños (${metrics.birthdayMonthCount})` }] : []),
            { id: 'tagged', label: `🏷️ Con Etiquetas (${customers.filter(c => c.tags.length > 0).length})` }
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSelectedSegment(tab.id)}
              style={{
                border: 'none',
                background: selectedSegment === tab.id ? 'var(--primary-color)' : 'var(--bg-secondary)',
                color: selectedSegment === tab.id ? '#ffffff' : 'var(--text-dark)',
                padding: '6px 14px',
                borderRadius: '20px',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Listado de Tarjetas de Clientes */}
      {filteredCustomers.length === 0 ? (
        <div className="glass-card" style={{ padding: '50px 20px', textAlign: 'center', color: 'var(--text-light)', borderRadius: '16px' }}>
          <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🔍</div>
          <h4 style={{ margin: '0 0 6px', color: 'var(--text-dark)' }}>No se encontraron clientes</h4>
          <p style={{ margin: 0, fontSize: '0.88rem' }}>Intenta ajustar el término de búsqueda o el filtro de segmento.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))', gap: '16px' }}>
          {filteredCustomers.map(customer => {
            const customerKey = customer.key;

            return (
              <div
                key={customerKey}
                className="glass-card"
                style={{
                  padding: '16px',
                  borderRadius: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  border: customer.isBirthdayMonth ? '2px solid #e91e63' : '1px solid var(--border-color)',
                  position: 'relative'
                }}
              >
                {/* Cabecera del Cliente */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, var(--primary-color) 0%, var(--secondary-color) 100%)',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      fontSize: '1.05rem',
                      flexShrink: 0
                    }}>
                      {(customer.name || 'C').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '0.96rem', color: 'var(--text-dark)', fontWeight: 700 }}>
                        {customer.name}
                      </h4>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-light)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>📞 {customer.phone || 'Sin teléfono'}</span>
                        {customer.isManual && (
                          <span style={{ fontSize: '0.65rem', background: '#34495e', color: '#fff', padding: '1px 5px', borderRadius: '6px' }}>
                            Manual
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                    <span style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '3px 8px',
                      borderRadius: '10px',
                      backgroundColor: `${customer.segmentColor}18`,
                      color: customer.segmentColor,
                      border: `1px solid ${customer.segmentColor}40`,
                      whiteSpace: 'nowrap'
                    }}>
                      {customer.segmentLabel}
                    </span>
                    {customer.isBirthdayMonth && (
                      <span style={{ fontSize: '0.68rem', color: '#e91e63', fontWeight: 800 }} title="Cumpleaños en este mes">
                        🎂 Cumple este mes
                      </span>
                    )}
                  </div>
                </div>

                {/* Etiquetas (Tags) */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', alignItems: 'center' }}>
                  {customer.tags.map(t => (
                    <span
                      key={t}
                      style={{
                        fontSize: '0.68rem',
                        fontWeight: 600,
                        padding: '2px 7px',
                        borderRadius: '8px',
                        background: 'rgba(52, 152, 219, 0.12)',
                        color: 'var(--primary-color)',
                        border: '1px solid rgba(52, 152, 219, 0.25)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px'
                      }}
                    >
                      {t}
                      <button
                        type="button"
                        onClick={() => handleToggleTag(customerKey, t)}
                        style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontSize: '0.65rem', color: 'var(--text-light)' }}
                        title="Quitar etiqueta"
                      >
                        ✕
                      </button>
                    </span>
                  ))}

                  <button
                    type="button"
                    onClick={() => setCustomerForEdit(customer)}
                    style={{
                      border: '1px dashed var(--border-color)',
                      background: 'transparent',
                      color: 'var(--text-light)',
                      fontSize: '0.68rem',
                      borderRadius: '8px',
                      padding: '2px 6px',
                      cursor: 'pointer'
                    }}
                    title="Añadir etiquetas o editar cliente"
                  >
                    + Etiqueta
                  </button>
                </div>

                {/* Resumen de Métricas de Compra */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr',
                  background: 'var(--bg-secondary)',
                  borderRadius: '12px',
                  padding: '8px 10px',
                  textAlign: 'center',
                  gap: '4px'
                }}>
                  <div>
                    <span style={{ fontSize: '0.66rem', color: 'var(--text-light)', display: 'block' }}>Pedidos</span>
                    <strong style={{ fontSize: '0.88rem', color: 'var(--text-dark)' }}>{customer.totalOrders}</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.66rem', color: 'var(--text-light)', display: 'block' }}>Inversión (LTV)</span>
                    <strong style={{ fontSize: '0.88rem', color: '#27ae60' }}>S/ {customer.totalSpent.toFixed(2)}</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.66rem', color: 'var(--text-light)', display: 'block' }}>Ticket Prom.</span>
                    <strong style={{ fontSize: '0.88rem', color: 'var(--primary-color)' }}>S/ {customer.avgTicket.toFixed(2)}</strong>
                  </div>
                </div>

                {/* Información contextual */}
                <div style={{ fontSize: '0.78rem', color: 'var(--text-light)', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  {customer.favoriteItem && (
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      🍦 <strong>Favorito:</strong> {customer.favoriteItem}
                    </div>
                  )}
                  {customer.address && (
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      📍 <strong>Dirección:</strong> {customer.address}
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>🗓️ <strong>Última compra:</strong> {safeFormatDate(customer.lastOrderDate)}</span>
                    <span style={{ fontSize: '0.72rem', fontWeight: 600 }}>
                      {customer.daysSinceLast === 0 ? 'Hoy' : `Hace ${customer.daysSinceLast} d`}
                    </span>
                  </div>
                </div>

                {/* Nota rápida interna del operador */}
                <div style={{ marginTop: 'auto' }}>
                  <input
                    type="text"
                    placeholder="📝 Nota rápida (ej: timbre malogrado, prefiere Yape)..."
                    defaultValue={customer.note}
                    onBlur={(e) => handleSaveNote(customerKey, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleSaveNote(customerKey, e.currentTarget.value);
                        e.currentTarget.blur();
                      }
                    }}
                    style={{
                      width: '100%',
                      padding: '5px 8px',
                      fontSize: '0.74rem',
                      borderRadius: '8px',
                      border: '1px dashed var(--border-color)',
                      background: 'transparent',
                      color: 'var(--text-dark)'
                    }}
                  />
                </div>

                {/* Botonera de Acciones Rápidas */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', paddingTop: '4px' }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => setCustomerForWhatsApp(customer)}
                    disabled={!customer.cleanPhone}
                    style={{
                      padding: '7px 8px',
                      fontSize: '0.75rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '5px',
                      backgroundColor: '#25D366',
                      borderColor: '#25D366',
                      color: '#ffffff'
                    }}
                  >
                    💬 WhatsApp
                  </button>

                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setCustomerForCoupon(customer)}
                    style={{
                      padding: '7px 8px',
                      fontSize: '0.75rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px'
                    }}
                  >
                    🎁 Crear Cupón
                  </button>

                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => handleStartOrderForCustomer(customer)}
                    style={{
                      padding: '6px 8px',
                      fontSize: '0.73rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px'
                    }}
                    title="Cargar cliente en tomador de pedidos"
                  >
                    🛒 Tomar Pedido
                  </button>

                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setSelectedCustomerForHistory(customer)}
                    style={{
                      padding: '6px 8px',
                      fontSize: '0.73rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px'
                    }}
                  >
                    📜 Pedidos ({customer.orders.length})
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* --- MODAL 1: HISTORIAL COMPLETO DE PEDIDOS --- */}
      {selectedCustomerForHistory && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.55)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
          padding: '20px'
        }}>
          <div className="glass-card" style={{
            width: '100%',
            maxWidth: '680px',
            maxHeight: '85vh',
            overflowY: 'auto',
            borderRadius: '16px',
            padding: '24px',
            background: 'var(--bg-primary, #ffffff)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, color: 'var(--text-dark)', fontSize: '1.2rem' }}>
                  📜 Historial de {selectedCustomerForHistory.name}
                </h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-light)' }}>
                  📞 {selectedCustomerForHistory.phone || 'Sin teléfono'} • {selectedCustomerForHistory.orders.length} pedidos registrados
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCustomerForHistory(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.3rem',
                  cursor: 'pointer',
                  color: 'var(--text-light)'
                }}
              >
                ✕
              </button>
            </div>

            {selectedCustomerForHistory.orders.length === 0 ? (
              <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-light)' }}>
                Este cliente no tiene pedidos registrados a través de la tienda web aún.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {selectedCustomerForHistory.orders.map((order, idx) => (
                  <div
                    key={order.id || idx}
                    style={{
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '12px',
                      padding: '14px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <strong style={{ fontSize: '0.9rem' }}>{order.id || `Pedido #${idx + 1}`}</strong>
                      <span style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: '8px',
                        backgroundColor: order.status === 'Cancelado' ? '#e74c3c20' : '#2ecc7120',
                        color: order.status === 'Cancelado' ? '#e74c3c' : '#27ae60'
                      }}>
                        {order.status || 'Completado'}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.78rem', color: 'var(--text-light)', marginBottom: '8px' }}>
                      🗓️ {safeFormatDateTime(order.date)} • 💳 {order.paymentMethod || 'Efectivo'}
                      {order.deliveryType && ` • 🛵 ${order.deliveryType}`}
                    </div>

                    <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '0.8rem', color: 'var(--text-dark)' }}>
                      {(order.items || []).map((item, iIdx) => (
                        <li key={iIdx}>
                          {item.quantity || 1}x {item.name || 'Helado'} - S/ {(safeNum(item.price, 0) * safeNum(item.quantity, 1)).toFixed(2)}
                        </li>
                      ))}
                    </ul>

                    <div style={{ textAlign: 'right', marginTop: '8px', fontWeight: 800, color: 'var(--primary-color)', fontSize: '0.92rem' }}>
                      Total: S/ {safeNum(order.grandTotal, 0).toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  handleStartOrderForCustomer(selectedCustomerForHistory);
                  setSelectedCustomerForHistory(null);
                }}
                style={{ fontSize: '0.82rem' }}
              >
                🛒 Cargar este cliente en Tomador de Pedidos
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setSelectedCustomerForHistory(null)}
                style={{ padding: '8px 18px', fontSize: '0.82rem' }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 2: WHATSAPP CON PLANTILLAS DE CAMPAÑA --- */}
      {customerForWhatsApp && (
        <WhatsAppCampaignModal
          customer={customerForWhatsApp}
          storeName={storeName}
          coupons={coupons}
          onClose={() => setCustomerForWhatsApp(null)}
          showAlert={showAlert}
        />
      )}

      {/* --- MODAL 3: GENERADOR 1-CLIC DE CUPÓN DE FIDELIZACIÓN --- */}
      {customerForCoupon && (
        <LoyaltyCouponModal
          customer={customerForCoupon}
          storeName={storeName}
          coupons={coupons}
          onUpdateCoupons={onUpdateCoupons}
          onClose={() => setCustomerForCoupon(null)}
          showAlert={showAlert}
        />
      )}

      {/* --- MODAL 4: NUEVO CLIENTE MANUAL --- */}
      {showNewCustomerModal && (
        <ManualCustomerModal
          storeName={storeName}
          onSave={(newCust) => {
            handleSaveManualCustomer(newCust);
            setShowNewCustomerModal(false);
            showAlert?.('Cliente Guardado', `Se registró exitosamente a ${newCust.name} en el CRM.`, 'success');
          }}
          onClose={() => setShowNewCustomerModal(false)}
        />
      )}

      {/* --- MODAL 5: EDITAR CLIENTE Y ETIQUETAS --- */}
      {customerForEdit && (
        <EditCustomerModal
          customer={customerForEdit}
          onSave={(updatedData) => {
            handleSaveManualCustomer({
              ...customerForEdit,
              ...updatedData
            });
            if (updatedData.birthday !== undefined) {
              handleSaveBirthday(customerForEdit.key, updatedData.birthday);
            }
            if (updatedData.tags !== undefined) {
              saveCrmMetadata(prev => ({
                ...prev,
                tags: { ...(prev?.tags || {}), [customerForEdit.key]: updatedData.tags }
              }));
            }
            setCustomerForEdit(null);
            showAlert?.('Perfil Actualizado', 'Los datos del cliente se actualizaron correctamente.', 'success');
          }}
          onClose={() => setCustomerForEdit(null)}
        />
      )}

      {/* --- MODAL 6: DIFUSIÓN MASIVA / ESTADO WHATSAPP --- */}
      {showBroadcastModal && (
        <BroadcastMessageModal
          storeName={storeName}
          customerCount={customers.length}
          onClose={() => setShowBroadcastModal(false)}
          showAlert={showAlert}
        />
      )}
    </div>
  );
}

// --- MODAL DE CAMPAÑAS DE WHATSAPP ---
function WhatsAppCampaignModal({ customer, storeName, coupons = [], onClose, showAlert }) {
  const firstName = (customer.name || 'amig@').split(' ')[0];
  const favorite = customer.favoriteItem || 'helados artesanales';

  const [campaignType, setCampaignType] = useState('promo_fav');
  const [selectedCouponCode, setSelectedCouponCode] = useState(coupons[0]?.code || '');
  const [customMessage, setCustomMessage] = useState('');

  // Generación reactiva de plantillas
  const currentMessage = useMemo(() => {
    if (campaignType === 'custom') return customMessage;

    if (campaignType === 'promo_fav') {
      return `¡Hola ${firstName}! Te saludamos de Helados ${storeName} 🍨.\n¿Te gustaría disfrutar hoy de tu favorito *${favorite}*? Tenemos delivery activo para llevártelo fresquito a tu puerta. 🛵💨\n\n¿Deseas que te enviemos la carta del día?`;
    }
    if (campaignType === 'birthday') {
      const couponSnippet = selectedCouponCode ? ` ¡Tienes un regalo especial con el código de descuento *${selectedCouponCode}*!` : '';
      return `¡Feliz cumpleaños ${firstName}! 🎂🎉 Desde Helados ${storeName} te enviamos nuestros mejores deseos.${couponSnippet}\n¿Te gustaría celebrar hoy con un delicioso helado artesanal? 🍨✨`;
    }
    if (campaignType === 'inactive_reactivate') {
      return `¡Hola ${firstName}! Te extrañamos mucho por Helados ${storeName} 🍨❤️.\nHemos renovado nuestros sabores y promociones. ¡Pide hoy y recibe una sorpresa dulce en tu delivery! 🎁🛵\n\n¿Te gustaría ver nuestras promociones activas?`;
    }
    if (campaignType === 'vip_thanks') {
      return `¡Hola ${firstName}! Queremos darte las gracias por ser uno de nuestros clientes más especiales en Helados ${storeName} 🌟.\nPor tu fidelidad, queremos consentirte en tu próximo pedido. ¡Escríbenos para darte tu sorpresa! 🍨`;
    }
    return '';
  }, [campaignType, firstName, storeName, favorite, selectedCouponCode, customMessage]);

  const handleSend = () => {
    const phone = formatPeruvianPhoneForWhatsApp(customer.cleanPhone);
    if (!phone) {
      showAlert?.('Sin Teléfono', 'Este cliente no tiene un teléfono válido registrado.', 'warning');
      return;
    }
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(currentMessage)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(currentMessage)
      .then(() => showAlert?.('Copiado', 'Texto copiado al portapapeles listo para enviar.', 'success'))
      .catch(() => showAlert?.('Error', 'No se pudo copiar el texto.', 'warning'));
  };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: '20px' }}>
      <div className="glass-card" style={{ width: '100%', maxWidth: '580px', borderRadius: '16px', padding: '24px', background: 'var(--bg-primary, #ffffff)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h3 style={{ margin: 0, color: 'var(--text-dark)', fontSize: '1.15rem' }}>
              💬 Campaña WhatsApp para {customer.name}
            </h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-light)' }}>
              📞 +{formatPeruvianPhoneForWhatsApp(customer.cleanPhone)}
            </span>
          </div>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: 'var(--text-light)' }}>✕</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-dark)', display: 'block', marginBottom: '6px' }}>
              Selecciona el tipo de mensaje:
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
              {[
                { id: 'promo_fav', label: '🍨 Promoción Favorito' },
                { id: 'birthday', label: '🎂 Saludo Cumpleaños' },
                { id: 'inactive_reactivate', label: '🎁 Reactivar Inactivo' },
                { id: 'vip_thanks', label: '🌟 Agradecimiento VIP' },
                { id: 'custom', label: '✏️ Mensaje Libre' }
              ].map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setCampaignType(t.id);
                    if (t.id === 'custom' && !customMessage) setCustomMessage(currentMessage);
                  }}
                  style={{
                    padding: '8px 10px',
                    borderRadius: '10px',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    border: campaignType === t.id ? '2px solid var(--primary-color)' : '1px solid var(--border-color)',
                    background: campaignType === t.id ? 'rgba(52, 152, 219, 0.1)' : 'var(--bg-secondary)',
                    color: campaignType === t.id ? 'var(--primary-color)' : 'var(--text-dark)',
                    cursor: 'pointer'
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {campaignType === 'birthday' && coupons.length > 0 && (
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-dark)', display: 'block', marginBottom: '4px' }}>
                Cupón a adjuntar:
              </label>
              <select
                className="form-control"
                value={selectedCouponCode}
                onChange={(e) => setSelectedCouponCode(e.target.value)}
                style={{ fontSize: '0.84rem' }}
              >
                <option value="">Sin cupón</option>
                {coupons.map(cp => (
                  <option key={cp.code} value={cp.code}>{cp.code} ({cp.discount}% desc)</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-dark)', display: 'block', marginBottom: '4px' }}>
              Vista previa del mensaje:
            </label>
            {campaignType === 'custom' ? (
              <textarea
                className="form-control"
                rows={5}
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                placeholder="Escribe tu mensaje personalizado aquí..."
                style={{ fontSize: '0.85rem' }}
              />
            ) : (
              <div style={{
                background: '#e5ddd5',
                padding: '12px 16px',
                borderRadius: '12px',
                color: '#111827',
                fontSize: '0.84rem',
                lineHeight: 1.45,
                whiteSpace: 'pre-wrap',
                borderLeft: '4px solid #25D366'
              }}>
                {currentMessage}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '10px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleCopy}
              style={{ fontSize: '0.82rem' }}
            >
              📋 Copiar Texto
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSend}
              style={{
                backgroundColor: '#25D366',
                borderColor: '#25D366',
                color: '#fff',
                fontSize: '0.82rem',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              🚀 Abrir en WhatsApp
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- MODAL DE GENERACIÓN DE CUPÓN VIP DE FIDELIZACIÓN ---
function LoyaltyCouponModal({ customer, storeName, coupons = [], onUpdateCoupons, onClose, showAlert }) {
  const cleanName = (customer.name || 'CLIENTE').replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 8);
  const [code, setCode] = useState(`VIP-${cleanName || 'PROMO'}`);
  const [discountPercent, setDiscountPercent] = useState(15);
  const [minOrder, setMinOrder] = useState(0);

  const handleCreateCoupon = () => {
    if (!code.trim()) {
      showAlert?.('Código Requerido', 'Ingresa un código de cupón válido.', 'warning');
      return;
    }
    const cleanCode = code.trim().toUpperCase();
    if (coupons.some(c => c.code.toUpperCase() === cleanCode)) {
      showAlert?.('Cupón Existente', `El cupón ${cleanCode} ya existe.`, 'warning');
      return;
    }

    const newCoupon = {
      code: cleanCode,
      discount: discountPercent,
      minOrder: safeNum(minOrder, 0),
      active: true,
      description: `Fidelización para ${customer.name}`
    };

    if (typeof onUpdateCoupons === 'function') {
      onUpdateCoupons([...coupons, newCoupon]);
      showAlert?.('Cupón Creado', `Cupón ${cleanCode} generado con ${discountPercent}% de descuento.`, 'success');

      // Si tiene teléfono, ofrecer enviárselo por WhatsApp
      if (customer.cleanPhone) {
        const phone = formatPeruvianPhoneForWhatsApp(customer.cleanPhone);
        const msg = `¡Hola ${customer.name.split(' ')[0]}! En Helados ${storeName} queremos premiar tu fidelidad 🍨🌟.\nTe hemos creado un cupón exclusivo de *${discountPercent}% de descuento* para tu próximo pedido: *${cleanCode}*.\n¡Pídelo cuando gustes por nuestra web o delivery! 🛵💨`;
        const url = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
        window.open(url, '_blank', 'noopener,noreferrer');
      }
      onClose();
    } else {
      showAlert?.('Aviso', 'El gestor de cupones no está conectado actualmente.', 'warning');
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: '20px' }}>
      <div className="glass-card" style={{ width: '100%', maxWidth: '480px', borderRadius: '16px', padding: '24px', background: 'var(--bg-primary, #ffffff)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h3 style={{ margin: 0, color: 'var(--text-dark)', fontSize: '1.15rem' }}>
              🎁 Crear Cupón para {customer.name}
            </h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-light)' }}>
              Recompensa exclusiva integrada con la tienda
            </span>
          </div>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: 'var(--text-light)' }}>✕</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-dark)', display: 'block', marginBottom: '4px' }}>
              Código del cupón:
            </label>
            <input
              type="text"
              className="form-control"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              style={{ fontSize: '0.9rem', textTransform: 'uppercase', fontWeight: 700 }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-dark)', display: 'block', marginBottom: '4px' }}>
                Descuento (%):
              </label>
              <select
                className="form-control"
                value={discountPercent}
                onChange={(e) => setDiscountPercent(parseInt(e.target.value, 10))}
                style={{ fontSize: '0.85rem' }}
              >
                <option value="5">5% de descuento</option>
                <option value="10">10% de descuento</option>
                <option value="15">15% de descuento (Recomendado)</option>
                <option value="20">20% de descuento (VIP)</option>
                <option value="25">25% de descuento</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-dark)', display: 'block', marginBottom: '4px' }}>
                Pedido mínimo (S/):
              </label>
              <input
                type="number"
                min="0"
                step="1"
                className="form-control"
                value={minOrder}
                onChange={(e) => setMinOrder(e.target.value)}
                placeholder="0 = Sin mínimo"
                style={{ fontSize: '0.85rem' }}
              />
            </div>
          </div>

          <div style={{ background: 'var(--bg-secondary)', padding: '12px', borderRadius: '10px', fontSize: '0.8rem', color: 'var(--text-light)' }}>
            💡 Al presionar Crear, el cupón se activará de inmediato en la tienda y se abrirá WhatsApp con el mensaje listo para enviarle a <strong>{customer.name}</strong>.
          </div>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} style={{ fontSize: '0.82rem' }}>
              Cancelar
            </button>
            <button type="button" className="btn btn-primary" onClick={handleCreateCoupon} style={{ fontSize: '0.82rem' }}>
              ✨ Crear y Enviar Cupón
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- MODAL DE NUEVO CLIENTE MANUAL ---
function ManualCustomerModal({ onSave, onClose }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [birthday, setBirthday] = useState('');
  const [note, setNote] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const cleanName = sanitizeText(name);
    const cleanPh = normalizePhone(phone);

    if (!cleanName) {
      alert('Por favor ingresa el nombre del cliente.');
      return;
    }

    const key = cleanPh ? `phone_${cleanPh}` : `manual_${Date.now()}`;
    const newCust = {
      key,
      name: cleanName,
      phone: phone.trim(),
      cleanPhone: cleanPh,
      address: sanitizeText(address),
      birthday,
      note: sanitizeText(note),
      tags: selectedTags,
      totalOrders: 0,
      totalSpent: 0,
      isManual: true,
      createdAt: new Date().toISOString()
    };

    onSave(newCust);
  };

  const toggleTag = (tag) => {
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: '20px' }}>
      <div className="glass-card" style={{ width: '100%', maxWidth: '520px', borderRadius: '16px', padding: '24px', background: 'var(--bg-primary, #ffffff)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, color: 'var(--text-dark)', fontSize: '1.15rem' }}>
            ➕ Registrar Nuevo Cliente Manual
          </h3>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: 'var(--text-light)' }}>✕</button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-dark)', display: 'block', marginBottom: '4px' }}>
              Nombre completo *:
            </label>
            <input
              type="text"
              required
              className="form-control"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Laura Flores"
              style={{ fontSize: '0.88rem' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-dark)', display: 'block', marginBottom: '4px' }}>
                Teléfono / WhatsApp:
              </label>
              <input
                type="tel"
                className="form-control"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Ej: 983123456"
                style={{ fontSize: '0.88rem' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-dark)', display: 'block', marginBottom: '4px' }}>
                Cumpleaños (opcional):
              </label>
              <input
                type="date"
                className="form-control"
                value={birthday}
                onChange={(e) => setBirthday(e.target.value)}
                style={{ fontSize: '0.85rem' }}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-dark)', display: 'block', marginBottom: '4px' }}>
              Dirección de entrega habitual:
            </label>
            <input
              type="text"
              className="form-control"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Ej: Av. Perú 456 (frente a la plaza)"
              style={{ fontSize: '0.88rem' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-dark)', display: 'block', marginBottom: '6px' }}>
              Etiquetas iniciales:
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {DEFAULT_TAG_OPTIONS.map(tag => (
                <button
                  key={tag.label}
                  type="button"
                  onClick={() => toggleTag(tag.label)}
                  style={{
                    padding: '4px 9px',
                    borderRadius: '12px',
                    fontSize: '0.74rem',
                    fontWeight: 600,
                    border: selectedTags.includes(tag.label) ? '2px solid var(--primary-color)' : '1px solid var(--border-color)',
                    background: selectedTags.includes(tag.label) ? 'rgba(52, 152, 219, 0.15)' : 'var(--bg-secondary)',
                    color: selectedTags.includes(tag.label) ? 'var(--primary-color)' : 'var(--text-dark)',
                    cursor: 'pointer'
                  }}
                >
                  {tag.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-dark)', display: 'block', marginBottom: '4px' }}>
              Nota interna del cliente:
            </label>
            <input
              type="text"
              className="form-control"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ej: Cliente frecuente de mostrador, pide con extra salsa..."
              style={{ fontSize: '0.85rem' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '10px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} style={{ fontSize: '0.82rem' }}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" style={{ fontSize: '0.82rem' }}>
              💾 Guardar Cliente
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// --- MODAL DE EDITAR CLIENTE Y TAGS ---
function EditCustomerModal({ customer, onSave, onClose }) {
  const [name, setName] = useState(customer.name || '');
  const [phone, setPhone] = useState(customer.phone || '');
  const [address, setAddress] = useState(customer.address || '');
  const [birthday, setBirthday] = useState(customer.birthday || '');
  const [tags, setTags] = useState(customer.tags || []);
  const [customTagInput, setCustomTagInput] = useState('');

  const toggleTag = (tag) => {
    setTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  const handleAddCustomTag = () => {
    const clean = sanitizeText(customTagInput);
    if (clean && !tags.includes(clean)) {
      setTags([...tags, clean]);
      setCustomTagInput('');
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      name: sanitizeText(name),
      phone: phone.trim(),
      cleanPhone: normalizePhone(phone),
      address: sanitizeText(address),
      birthday,
      tags
    });
  };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: '20px' }}>
      <div className="glass-card" style={{ width: '100%', maxWidth: '520px', borderRadius: '16px', padding: '24px', background: 'var(--bg-primary, #ffffff)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, color: 'var(--text-dark)', fontSize: '1.15rem' }}>
            ✏️ Editar Perfil de {customer.name}
          </h3>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: 'var(--text-light)' }}>✕</button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-dark)', display: 'block', marginBottom: '4px' }}>
              Nombre:
            </label>
            <input
              type="text"
              required
              className="form-control"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{ fontSize: '0.88rem' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-dark)', display: 'block', marginBottom: '4px' }}>
                Teléfono:
              </label>
              <input
                type="tel"
                className="form-control"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                style={{ fontSize: '0.88rem' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-dark)', display: 'block', marginBottom: '4px' }}>
                Cumpleaños:
              </label>
              <input
                type="date"
                className="form-control"
                value={birthday}
                onChange={(e) => setBirthday(e.target.value)}
                style={{ fontSize: '0.85rem' }}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-dark)', display: 'block', marginBottom: '4px' }}>
              Dirección:
            </label>
            <input
              type="text"
              className="form-control"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              style={{ fontSize: '0.88rem' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-dark)', display: 'block', marginBottom: '6px' }}>
              Etiquetas del cliente:
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
              {DEFAULT_TAG_OPTIONS.map(tag => (
                <button
                  key={tag.label}
                  type="button"
                  onClick={() => toggleTag(tag.label)}
                  style={{
                    padding: '4px 9px',
                    borderRadius: '12px',
                    fontSize: '0.74rem',
                    fontWeight: 600,
                    border: tags.includes(tag.label) ? '2px solid var(--primary-color)' : '1px solid var(--border-color)',
                    background: tags.includes(tag.label) ? 'rgba(52, 152, 219, 0.15)' : 'var(--bg-secondary)',
                    color: tags.includes(tag.label) ? 'var(--primary-color)' : 'var(--text-dark)',
                    cursor: 'pointer'
                  }}
                >
                  {tag.label}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '6px' }}>
              <input
                type="text"
                className="form-control"
                placeholder="Otra etiqueta personalizada..."
                value={customTagInput}
                onChange={(e) => setCustomTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddCustomTag(); } }}
                style={{ fontSize: '0.82rem' }}
              />
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleAddCustomTag}
                style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}
              >
                + Añadir
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '10px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} style={{ fontSize: '0.82rem' }}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" style={{ fontSize: '0.82rem' }}>
              💾 Guardar Cambios
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// --- MODAL DE DIFUSIÓN MASIVA / ESTADO WHATSAPP ---
function BroadcastMessageModal({ storeName, customerCount, onClose, showAlert }) {
  const [broadcastText, setBroadcastText] = useState(
    `🍨 ¡HOY EN HELADOS ${storeName.toUpperCase()}! 🍨\n` +
    `Disfruta de nuestros helados artesanales favoritos con delivery rápido y garantizado a todo Andahuaylas. 🛵💨\n\n` +
    `🍦 Litros artesanales con tus sabores preferidos\n` +
    `🎁 Packs especiales para compartir en familia\n` +
    `✨ Pide en línea en segundos o escríbenos directamente aquí.`
  );

  const handleCopy = () => {
    navigator.clipboard.writeText(broadcastText)
      .then(() => showAlert?.('Copiado', 'Texto de difusión copiado. Puedes pegarlo en tu Lista de Difusión de WhatsApp o Estado.', 'success'))
      .catch(() => showAlert?.('Error', 'No se pudo copiar el texto.', 'warning'));
  };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: '20px' }}>
      <div className="glass-card" style={{ width: '100%', maxWidth: '540px', borderRadius: '16px', padding: '24px', background: 'var(--bg-primary, #ffffff)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div>
            <h3 style={{ margin: 0, color: 'var(--text-dark)', fontSize: '1.15rem' }}>
              📢 Mensaje de Difusión / Estado WhatsApp
            </h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-light)' }}>
              Para tu lista de {customerCount} clientes en WhatsApp
            </span>
          </div>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: 'var(--text-light)' }}>✕</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <textarea
            className="form-control"
            rows={7}
            value={broadcastText}
            onChange={(e) => setBroadcastText(e.target.value)}
            style={{ fontSize: '0.86rem', lineHeight: 1.45 }}
          />

          <div style={{ fontSize: '0.78rem', color: 'var(--text-light)', background: 'var(--bg-secondary)', padding: '10px 12px', borderRadius: '10px' }}>
            📌 <strong>Consejo:</strong> Copia este mensaje y difúndelo mediante la función <em>Listas de Difusión</em> de WhatsApp Business o publícalo en los Estados para máxima conversión.
          </div>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '6px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} style={{ fontSize: '0.82rem' }}>
              Cerrar
            </button>
            <button type="button" className="btn btn-primary" onClick={handleCopy} style={{ fontSize: '0.82rem' }}>
              📋 Copiar Mensaje de Difusión
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Exportación Principal blindada con Error Boundary
 */
export default function CustomerCRM(props) {
  return (
    <CRMErrorBoundary>
      <CustomerCRMContent {...props} />
    </CRMErrorBoundary>
  );
}
