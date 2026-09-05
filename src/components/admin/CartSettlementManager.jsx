import React, { useState, useEffect, useMemo } from 'react';
import { printThermalTicket } from '../../utils/escposTicket';

export default function CartSettlementManager({
  settlements = [],
  onUpdateSettlements,
  popsicles = [],
  flavors = [],
  packs = [],
  bases = [],
  literConfig,
  currentUser,
  cartLocations = [],
  onUpdateCartLocations,
  shopConfig = {},
  onChangeShopConfig,
  storeName = 'Friozo',
  addLog,
  showAlert
}) {
  const [activeTab, setActiveTab] = useState('settlement'); // 'settlement' | 'catalog' | 'routes' | 'history' | 'alerts'

  // Lista de carritos disponibles
  const availableCarts = useMemo(() => {
    const list = (cartLocations || []).map(c => c.label || c.name || `Carrito ${c.id}`).filter(Boolean);
    if (list.length === 0) return ['Carrito 1 - Malecón', 'Carrito 2 - Plaza Principal', 'Carrito 3 - Parque Central'];
    return Array.from(new Set(list));
  }, [cartLocations]);

  const [selectedCartLabel, setSelectedCartLabel] = useState(() => availableCarts[0] || 'Carrito 1');
  const [vendorName, setVendorName] = useState(currentUser?.name || '');
  const [routeName, setRouteName] = useState('');
  const [cartStatus, setCartStatus] = useState('En Ruta'); // 'En Ruta' | 'En Pausa' | 'En Base'

  // Almacén de configuraciones y dotaciones por carrito
  const [cartConfigs, setCartConfigs] = useState(() => {
    if (shopConfig?.cartConfigs && typeof shopConfig.cartConfigs === 'object') {
      return shopConfig.cartConfigs;
    }
    try {
      const saved = localStorage.getItem('friozo_cart_catalog_configs');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Generador de dotación inicial predeterminada a partir de la carta de la heladería
  const buildDefaultItemsForCart = () => {
    const items = [];
    // Paletas
    (popsicles || []).forEach(p => {
      items.push({
        id: `pop_${p.id}`,
        name: `Paleta ${p.name}`,
        category: 'Paletas',
        price: Number(p.price) || 5.0,
        loaded: 20,
        returned: 0
      });
    });

    // Envases / Conos
    (bases || []).forEach(b => {
      items.push({
        id: `base_${b.id}`,
        name: `${b.name} (1 Bola)`,
        category: 'Conos y Vasos',
        price: (Number(b.price) || 0) + 6.0,
        loaded: 15,
        returned: 0
      });
    });

    // Litro
    if (literConfig && literConfig.active !== false) {
      items.push({
        id: 'liter_1l',
        name: 'Pote 1 Litro Artesanal',
        category: 'Potes',
        price: Number(literConfig.price) || 15.0,
        loaded: 5,
        returned: 0
      });
    }

    // Fallbacks si la carta está vacía
    if (items.length === 0) {
      return [
        { id: 'pop_fresa', name: 'Paleta Fresa Natural', category: 'Paletas', price: 5.0, loaded: 20, returned: 0 },
        { id: 'pop_maracuya', name: 'Paleta Maracuyá Rellena', category: 'Paletas', price: 6.0, loaded: 20, returned: 0 },
        { id: 'cone_single', name: 'Cono Simple (1 Bola)', category: 'Conos y Vasos', price: 6.0, loaded: 15, returned: 0 },
        { id: 'cone_double', name: 'Cono Doble (2 Bolas)', category: 'Conos y Vasos', price: 10.0, loaded: 10, returned: 0 },
        { id: 'liter_pote', name: 'Pote 1 Litro', category: 'Potes', price: 15.0, loaded: 4, returned: 0 }
      ];
    }
    return items;
  };

  // Ítems a liquidar en el formulario actual
  const [itemsToSettle, setItemsToSettle] = useState(() => {
    const savedConfig = cartConfigs[selectedCartLabel];
    if (savedConfig?.items && Array.isArray(savedConfig.items) && savedConfig.items.length > 0) {
      return savedConfig.items.map(it => ({ ...it, returned: 0 }));
    }
    return buildDefaultItemsForCart();
  });

  // Desglose de Rendición de Dinero (Efectivo vs Digital)
  const [handedCash, setHandedCash] = useState('');
  const [handedYape, setHandedYape] = useState('');
  const [settlementNotes, setSettlementNotes] = useState('');

  // Estados para añadir nueva presentación / producto al carrito
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [addMode, setAddMode] = useState('catalog'); // 'catalog' | 'custom'
  const [selectedCatalogItem, setSelectedCatalogItem] = useState('');
  const [customItemName, setCustomItemName] = useState('');
  const [customItemCategory, setCustomItemCategory] = useState('Paletas');
  const [customItemPrice, setCustomItemPrice] = useState('');
  const [customItemLoaded, setCustomItemLoaded] = useState('20');

  // Alertas de "Sin Stock"
  const [outOfStockItem, setOutOfStockItem] = useState('');
  const [outOfStockNotes, setOutOfStockNotes] = useState('');
  const [activeAlerts, setActiveAlerts] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('friozo_cart_stock_alerts') || '[]');
    } catch {
      return [];
    }
  });

  // Modal de Detalle de Liquidación Histórica
  const [viewingSettlement, setViewingSettlement] = useState(null);

  // Filtros de historial
  const [historyCartFilter, setHistoryCartFilter] = useState('all');
  const [historySearchQuery, setHistorySearchQuery] = useState('');

  // Actualizar ítems cuando se cambia de carrito
  const handleSelectCart = (cartLabel) => {
    setSelectedCartLabel(cartLabel);
    const config = cartConfigs[cartLabel];
    if (config?.routeName) setRouteName(config.routeName);
    if (config?.vendorName) setVendorName(config.vendorName);
    if (config?.status) setCartStatus(config.status);

    if (config?.items && Array.isArray(config.items) && config.items.length > 0) {
      setItemsToSettle(config.items.map(it => ({ ...it, returned: 0 })));
    } else {
      setItemsToSettle(buildDefaultItemsForCart());
    }
  };

  // Modificación de cantidad cargada, retornada y precio personalizado por ítem
  const handleItemLoadedChange = (id, val) => {
    setItemsToSettle(prev => prev.map(it => it.id === id ? { ...it, loaded: Math.max(0, parseInt(val, 10) || 0) } : it));
  };

  const handleItemReturnedChange = (id, val) => {
    setItemsToSettle(prev => prev.map(it => it.id === id ? { ...it, returned: Math.max(0, parseInt(val, 10) || 0) } : it));
  };

  const handleItemPriceChange = (id, val) => {
    const newPrice = Math.max(0, parseFloat(val) || 0);
    setItemsToSettle(prev => prev.map(it => it.id === id ? { ...it, price: newPrice } : it));
  };

  const handleRemoveItem = (id) => {
    setItemsToSettle(prev => prev.filter(it => it.id !== id));
  };

  // Cálculos automáticos de liquidación
  const totalSoldUnits = useMemo(() => {
    return itemsToSettle.reduce((sum, it) => sum + Math.max(0, (Number(it.loaded) || 0) - (Number(it.returned) || 0)), 0);
  }, [itemsToSettle]);

  const totalMoneyToHandOver = useMemo(() => {
    return itemsToSettle.reduce((sum, it) => {
      const sold = Math.max(0, (Number(it.loaded) || 0) - (Number(it.returned) || 0));
      return sum + (sold * (Number(it.price) || 0));
    }, 0);
  }, [itemsToSettle]);

  const cashNum = parseFloat(handedCash) || 0;
  const yapeNum = parseFloat(handedYape) || 0;
  const totalHandedIn = cashNum + yapeNum;
  const difference = totalHandedIn - totalMoneyToHandOver;

  // Guardar configuración actual como plantilla permanente para este carrito
  const handleSaveCartTemplate = () => {
    const newConfig = {
      ...cartConfigs,
      [selectedCartLabel]: {
        routeName: routeName || `Ruta ${selectedCartLabel}`,
        vendorName: vendorName || currentUser?.name || 'Vendedor',
        status: cartStatus,
        lastUpdated: new Date().toISOString(),
        items: itemsToSettle.map(it => ({
          id: it.id,
          name: it.name,
          category: it.category || 'Varios',
          price: Number(it.price) || 0,
          loaded: Number(it.loaded) || 0,
          returned: 0
        }))
      }
    };
    setCartConfigs(newConfig);
    try {
      localStorage.setItem('friozo_cart_catalog_configs', JSON.stringify(newConfig));
    } catch {}

    if (onChangeShopConfig && shopConfig) {
      onChangeShopConfig({
        ...shopConfig,
        cartConfigs: newConfig
      });
    }

    addLog?.(`Plantilla de dotación y precios guardada para ${selectedCartLabel} por ${currentUser?.name || 'Administrador'}.`);
    if (showAlert) {
      showAlert('Dotación Guardada', `Se guardó la lista de productos y precios personalizados para ${selectedCartLabel}.`, 'success');
    }
  };

  // Añadir producto o presentación al carrito
  const handleAddProductSubmit = (e) => {
    e.preventDefault();
    let newItem = null;

    if (addMode === 'catalog') {
      if (!selectedCatalogItem) return;
      const [type, id] = selectedCatalogItem.split(':::');
      if (type === 'popsicle') {
        const pop = popsicles.find(p => String(p.id) === id);
        if (pop) {
          newItem = {
            id: `pop_${pop.id}_${Date.now().toString().slice(-4)}`,
            name: `Paleta ${pop.name}`,
            category: 'Paletas',
            price: customItemPrice ? parseFloat(customItemPrice) : (Number(pop.price) || 5),
            loaded: parseInt(customItemLoaded, 10) || 20,
            returned: 0
          };
        }
      } else if (type === 'base') {
        const b = bases.find(base => String(base.id) === id);
        if (b) {
          newItem = {
            id: `base_${b.id}_${Date.now().toString().slice(-4)}`,
            name: `${b.name} (1 Bola)`,
            category: 'Conos y Vasos',
            price: customItemPrice ? parseFloat(customItemPrice) : ((Number(b.price) || 0) + 6),
            loaded: parseInt(customItemLoaded, 10) || 15,
            returned: 0
          };
        }
      } else if (type === 'pack') {
        const pk = packs.find(p => String(p.id) === id);
        if (pk) {
          newItem = {
            id: `pack_${pk.id}_${Date.now().toString().slice(-4)}`,
            name: pk.name,
            category: 'Combos / Packs',
            price: customItemPrice ? parseFloat(customItemPrice) : (Number(pk.price) || 18),
            loaded: parseInt(customItemLoaded, 10) || 5,
            returned: 0
          };
        }
      } else if (type === 'liter') {
        newItem = {
          id: `liter_${Date.now().toString().slice(-4)}`,
          name: 'Pote 1 Litro Artesanal',
          category: 'Potes',
          price: customItemPrice ? parseFloat(customItemPrice) : (Number(literConfig?.price) || 15),
          loaded: parseInt(customItemLoaded, 10) || 5,
          returned: 0
        };
      }
    } else {
      // Modo Presentación Personalizada
      if (!customItemName.trim()) return;
      newItem = {
        id: `cust_${Date.now().toString().slice(-6)}`,
        name: customItemName.trim(),
        category: customItemCategory || 'Personalizado',
        price: Math.max(0, parseFloat(customItemPrice) || 5.0),
        loaded: parseInt(customItemLoaded, 10) || 10,
        returned: 0
      };
    }

    if (newItem) {
      setItemsToSettle(prev => [...prev, newItem]);
      setShowAddProductModal(false);
      setCustomItemName('');
      setCustomItemPrice('');
      setSelectedCatalogItem('');
      if (showAlert) {
        showAlert('Producto Agregado', `Se agregó "${newItem.name}" al carrito con precio de S/ ${newItem.price.toFixed(2)}.`, 'success');
      }
    }
  };

  // Guardar Liquidación Diaria
  const handleSaveSettlement = (e) => {
    e.preventDefault();
    if (totalSoldUnits === 0 && !window.confirm('No has registrado ninguna unidad vendida (Carga igual a Retorno). ¿Deseas guardar de todas formas?')) {
      return;
    }

    const newRecord = {
      id: `LIQ-${Date.now().toString().slice(-6)}`,
      date: new Date().toISOString(),
      cartLabel: selectedCartLabel,
      vendorName: vendorName || currentUser?.name || 'Vendedor',
      routeName: routeName || `Ruta ${selectedCartLabel}`,
      totalUnits: totalSoldUnits,
      totalAmount: totalMoneyToHandOver,
      paymentDetails: {
        cash: cashNum,
        yape: yapeNum,
        totalHanded: totalHandedIn,
        diff: difference
      },
      notes: settlementNotes,
      details: itemsToSettle.filter(it => it.loaded > 0).map(it => ({
        name: it.name,
        category: it.category || 'Varios',
        loaded: Number(it.loaded) || 0,
        returned: Number(it.returned) || 0,
        sold: Math.max(0, (Number(it.loaded) || 0) - (Number(it.returned) || 0)),
        price: Number(it.price) || 0,
        subtotal: Math.max(0, (Number(it.loaded) || 0) - (Number(it.returned) || 0)) * (Number(it.price) || 0)
      }))
    };

    const nextSettlements = [newRecord, ...(settlements || [])];
    onUpdateSettlements(nextSettlements);
    addLog?.(`Liquidación de Carrito guardada: ${selectedCartLabel} (${newRecord.routeName}) por ${newRecord.vendorName}. Total rendido: S/ ${totalMoneyToHandOver.toFixed(2)}.`);

    // Ofrecer impresión de ticket térmico
    if (window.confirm(`✅ Liquidación guardada con éxito (Total S/ ${totalMoneyToHandOver.toFixed(2)}).\n\n¿Deseas imprimir el ticket térmico para el vendedor y archivo?`)) {
      printThermalTicket({
        type: 'cart_settlement',
        settlement: newRecord,
        storeName: storeName || 'Friozo'
      });
    }

    // Resetear formulario para siguiente turno
    setHandedCash('');
    setHandedYape('');
    setSettlementNotes('');
    setActiveTab('history');
  };

  // Emitir alerta "Sin Stock" rápida desde la calle
  const handleSendOutOfStockAlert = (e) => {
    e.preventDefault();
    if (!outOfStockItem.trim()) return;

    const alertItem = {
      id: `ALT-${Date.now().toString().slice(-4)}`,
      timestamp: new Date().toISOString(),
      cartLabel: selectedCartLabel,
      vendorName: vendorName || currentUser?.name || 'Vendedor',
      item: outOfStockItem.trim(),
      notes: outOfStockNotes.trim(),
      resolved: false
    };

    const nextAlerts = [alertItem, ...activeAlerts];
    setActiveAlerts(nextAlerts);
    try {
      localStorage.setItem('friozo_cart_stock_alerts', JSON.stringify(nextAlerts));
    } catch {}

    addLog?.(`ALERTA SIN STOCK: ${alertItem.cartLabel} se quedó sin "${alertItem.item}" (${alertItem.vendorName}).`);
    setOutOfStockItem('');
    setOutOfStockNotes('');
    if (showAlert) {
      showAlert('Alerta Emitida a Central', `Se notificó que ${alertItem.cartLabel} no tiene stock de "${alertItem.item}".`, 'warning');
    }
  };

  const handleResolveAlert = (alertId) => {
    const nextAlerts = activeAlerts.filter(a => a.id !== alertId);
    setActiveAlerts(nextAlerts);
    try {
      localStorage.setItem('friozo_cart_stock_alerts', JSON.stringify(nextAlerts));
    } catch {}
    if (showAlert) showAlert('Alerta Resuelta', 'Se marcó la alerta como atendida / reabastecida.', 'info');
  };

  // Exportar historial a Excel / CSV
  const handleExportCSV = () => {
    if (!settlements || settlements.length === 0) {
      alert('No hay liquidaciones registradas para exportar.');
      return;
    }

    let csvContent = '\uFEFF'; // UTF-8 BOM
    csvContent += 'ID Liquidación,Fecha,Hora,Carrito,Ruta,Vendedor,Unidades Vendidas,Total a Rendir,Efectivo Rendido,Yape Rendido,Diferencia,Notas\n';

    settlements.forEach(sq => {
      const d = new Date(sq.date);
      const dateStr = d.toLocaleDateString('es-PE');
      const timeStr = d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
      const row = [
        sq.id,
        `"${dateStr}"`,
        `"${timeStr}"`,
        `"${(sq.cartLabel || '').replace(/"/g, '""')}"`,
        `"${(sq.routeName || '').replace(/"/g, '""')}"`,
        `"${(sq.vendorName || '').replace(/"/g, '""')}"`,
        sq.totalUnits || 0,
        (sq.totalAmount || 0).toFixed(2),
        (sq.paymentDetails?.cash || 0).toFixed(2),
        (sq.paymentDetails?.yape || 0).toFixed(2),
        (sq.paymentDetails?.diff || 0).toFixed(2),
        `"${(sq.notes || '').replace(/"/g, '""')}"`
      ];
      csvContent += row.join(',') + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `liquidaciones_carritos_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtrado de Historial
  const filteredHistory = useMemo(() => {
    return (settlements || []).filter(sq => {
      if (historyCartFilter !== 'all' && sq.cartLabel !== historyCartFilter) return false;
      if (historySearchQuery.trim()) {
        const q = historySearchQuery.toLowerCase();
        const vendor = (sq.vendorName || '').toLowerCase();
        const route = (sq.routeName || '').toLowerCase();
        const id = (sq.id || '').toLowerCase();
        if (!vendor.includes(q) && !route.includes(q) && !id.includes(q)) return false;
      }
      return true;
    });
  }, [settlements, historyCartFilter, historySearchQuery]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Cabecera Principal con Navegación por Pestañas */}
      <div className="glass" style={{ padding: '16px 20px', borderRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '1.8rem' }}>🛒</span>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-dark)' }}>
              Liquidación de Carritos y Control de Ruta
            </h3>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-light)' }}>
              Dotación de productos, precios por ruta, cuadre matutino vs retorno y control GPS en vivo.
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className={`btn btn-sm ${activeTab === 'settlement' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '6px 12px', fontSize: '0.78rem' }}
            onClick={() => setActiveTab('settlement')}
          >
            📝 Liquidación Diaria
          </button>
          <button
            type="button"
            className={`btn btn-sm ${activeTab === 'catalog' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '6px 12px', fontSize: '0.78rem' }}
            onClick={() => setActiveTab('catalog')}
          >
            ⚙️ Dotación y Precios
          </button>
          <button
            type="button"
            className={`btn btn-sm ${activeTab === 'routes' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '6px 12px', fontSize: '0.78rem' }}
            onClick={() => setActiveTab('routes')}
          >
            🗺️ Rutas y GPS
          </button>
          <button
            type="button"
            className={`btn btn-sm ${activeTab === 'alerts' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '6px 12px', fontSize: '0.78rem', position: 'relative' }}
            onClick={() => setActiveTab('alerts')}
          >
            ⚠️ Alertas {activeAlerts.length > 0 && `(${activeAlerts.length})`}
          </button>
          <button
            type="button"
            className={`btn btn-sm ${activeTab === 'history' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '6px 12px', fontSize: '0.78rem' }}
            onClick={() => setActiveTab('history')}
          >
            📜 Historial ({settlements.length})
          </button>
        </div>
      </div>

      {/* PESTAÑA 1: LIQUIDACIÓN DIARIA */}
      {activeTab === 'settlement' && (
        <form onSubmit={handleSaveSettlement} className="glass" style={{ padding: '22px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
            <h4 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--primary-color)' }}>
              📝 Planilla de Carga vs Retorno de Carrito
            </h4>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ fontSize: '0.75rem', padding: '5px 10px' }}
                onClick={() => setShowAddProductModal(true)}
              >
                ➕ Añadir Presentación / Producto
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ fontSize: '0.75rem', padding: '5px 10px', color: '#27ae60', borderColor: '#27ae60' }}
                onClick={handleSaveCartTemplate}
                title="Guardar los productos y precios actuales como plantilla por defecto para este carrito"
              >
                💾 Guardar como Dotación Predeterminada
              </button>
            </div>
          </div>

          {/* Datos del Carrito, Ruta y Vendedor */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 'bold' }}>Carrito / Punto Móvil</label>
              <select
                className="form-control"
                style={{ fontSize: '0.82rem', padding: '6px 10px' }}
                value={selectedCartLabel}
                onChange={(e) => handleSelectCart(e.target.value)}
              >
                {availableCarts.map(cart => (
                  <option key={cart} value={cart}>{cart}</option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 'bold' }}>Ruta / Zona Asignada</label>
              <input
                type="text"
                className="form-control"
                placeholder="Ej: Ruta 1 - Malecón / Plaza"
                value={routeName}
                onChange={(e) => setRouteName(e.target.value)}
                style={{ fontSize: '0.82rem', padding: '6px 10px' }}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 'bold' }}>Vendedor / Operador</label>
              <input
                type="text"
                className="form-control"
                placeholder="Nombre del vendedor"
                value={vendorName}
                onChange={(e) => setVendorName(e.target.value)}
                style={{ fontSize: '0.82rem', padding: '6px 10px' }}
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 'bold' }}>Estado Actual</label>
              <select
                className="form-control"
                style={{ fontSize: '0.82rem', padding: '6px 10px' }}
                value={cartStatus}
                onChange={(e) => setCartStatus(e.target.value)}
              >
                <option value="En Ruta">🟢 En Ruta (Operando)</option>
                <option value="En Pausa">🟡 En Pausa / Almuerzo</option>
                <option value="En Base">🔴 En Base / Liquidación</option>
              </select>
            </div>
          </div>

          {/* Tabla Interactiva de Carga vs Retorno y Precios Personalizados */}
          <div className="admin-table-container">
            <table className="admin-table" style={{ fontSize: '0.82rem' }}>
              <thead>
                <tr>
                  <th>Presentación / Producto</th>
                  <th style={{ width: '120px', textAlign: 'center' }}>Precio Unit. (S/)</th>
                  <th style={{ width: '110px', textAlign: 'center' }}>Carga Matutina</th>
                  <th style={{ width: '110px', textAlign: 'center' }}>Retorno Cierre</th>
                  <th style={{ width: '90px', textAlign: 'center' }}>Vendidos</th>
                  <th style={{ width: '110px', textAlign: 'right' }}>Subtotal Rendir</th>
                  <th style={{ width: '40px', textAlign: 'center' }}></th>
                </tr>
              </thead>
              <tbody>
                {itemsToSettle.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '20px', color: 'var(--text-light)' }}>
                      No hay productos asignados a este carrito. Haz clic en "➕ Añadir Presentación / Producto" arriba.
                    </td>
                  </tr>
                ) : (
                  itemsToSettle.map(item => {
                    const sold = Math.max(0, (Number(item.loaded) || 0) - (Number(item.returned) || 0));
                    const subtotal = sold * (Number(item.price) || 0);
                    return (
                      <tr key={item.id}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{item.name}</div>
                          <span style={{ fontSize: '0.68rem', color: 'var(--text-light)', background: 'rgba(0,0,0,0.04)', padding: '1px 5px', borderRadius: '4px' }}>
                            {item.category || 'General'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>S/</span>
                            <input
                              type="number"
                              step="0.5"
                              min="0"
                              className="form-control"
                              value={item.price}
                              onChange={(e) => handleItemPriceChange(item.id, e.target.value)}
                              title="Personalizar precio unitario para este carrito/ruta"
                              style={{ width: '70px', textAlign: 'center', fontWeight: 'bold', padding: '3px 4px', fontSize: '0.8rem' }}
                            />
                          </div>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <input
                            type="number"
                            min="0"
                            className="form-control"
                            value={item.loaded || ''}
                            placeholder="0"
                            onChange={(e) => handleItemLoadedChange(item.id, e.target.value)}
                            style={{ textAlign: 'center', fontWeight: 'bold', padding: '4px', fontSize: '0.85rem' }}
                          />
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <input
                            type="number"
                            min="0"
                            className="form-control"
                            value={item.returned || ''}
                            placeholder="0"
                            onChange={(e) => handleItemReturnedChange(item.id, e.target.value)}
                            style={{ textAlign: 'center', fontWeight: 'bold', padding: '4px', fontSize: '0.85rem' }}
                          />
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 'bold', color: sold > 0 ? '#27ae60' : 'var(--text-light)', fontSize: '0.9rem' }}>
                          {sold} u.
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold', color: subtotal > 0 ? 'var(--primary-color)' : 'inherit', fontSize: '0.95rem' }}>
                          S/ {subtotal.toFixed(2)}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(item.id)}
                            style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '0.85rem' }}
                            title="Quitar este producto del carrito"
                          >
                            🗑️
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Cuadre de Rendición de Dinero (Efectivo vs Yape/Digital) */}
          <div style={{ background: 'var(--bg-secondary)', padding: '16px 20px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            <h5 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', color: 'var(--text-dark)' }}>
              💵 Cuadre y Rendición de Dinero
            </h5>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', alignItems: 'flex-end' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>Efectivo Entregado (S/):</label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  placeholder="0.00"
                  className="form-control"
                  value={handedCash}
                  onChange={(e) => setHandedCash(e.target.value)}
                  style={{ fontSize: '0.9rem', fontWeight: 'bold' }}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>Yape / Plin en Ruta (S/):</label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  placeholder="0.00"
                  className="form-control"
                  value={handedYape}
                  onChange={(e) => setHandedYape(e.target.value)}
                  style={{ fontSize: '0.9rem', fontWeight: 'bold' }}
                />
              </div>

              <div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-light)', display: 'block' }}>Total Rendido por Vendedor:</span>
                <strong style={{ fontSize: '1.15rem', color: '#2980b9' }}>S/ {totalHandedIn.toFixed(2)}</strong>
              </div>

              <div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-light)', display: 'block' }}>Estado del Cuadre:</span>
                <span style={{
                  display: 'inline-block',
                  padding: '4px 10px',
                  borderRadius: '12px',
                  fontSize: '0.8rem',
                  fontWeight: 'bold',
                  background: Math.abs(difference) < 0.01 ? 'rgba(46, 204, 113, 0.15)' : (difference < 0 ? 'rgba(231, 76, 60, 0.15)' : 'rgba(52, 152, 219, 0.15)'),
                  color: Math.abs(difference) < 0.01 ? '#27ae60' : (difference < 0 ? '#c0392b' : '#2980b9')
                }}>
                  {Math.abs(difference) < 0.01 ? '🟢 Cuadre Exacto' : (difference < 0 ? `🔴 Faltante: -S/ ${Math.abs(difference).toFixed(2)}` : `🔵 Sobrante: +S/ ${difference.toFixed(2)}`)}
                </span>
              </div>
            </div>

            <div className="form-group" style={{ marginTop: '12px', marginBottom: 0 }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>Observaciones / Incidencias:</label>
              <input
                type="text"
                className="form-control"
                placeholder="Ej: Faltó 1 paleta rota por golpe, cliente de sombrilla pagó con Yape, etc."
                value={settlementNotes}
                onChange={(e) => setSettlementNotes(e.target.value)}
                style={{ fontSize: '0.8rem' }}
              />
            </div>
          </div>

          {/* Resumen Final y Botón de Cierre */}
          <div style={{ background: 'var(--bg-primary)', padding: '16px 20px', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
            <div>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-light)' }}>Total Unidades Vendidas:</span>
              <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#27ae60' }}>{totalSoldUnits} unidades</div>
            </div>

            <div>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-light)' }}>Total Dinero a Rendir en Caja:</span>
              <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: 'var(--primary-color)' }}>S/ {totalMoneyToHandOver.toFixed(2)}</div>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: '10px 18px', fontSize: '0.9rem', fontWeight: 600 }}
                onClick={() => {
                  printThermalTicket({
                    type: 'cart_settlement',
                    settlement: {
                      id: `PRE-LIQ`,
                      date: new Date().toISOString(),
                      cartLabel: selectedCartLabel,
                      vendorName: vendorName || currentUser?.name || 'Vendedor',
                      routeName: routeName || `Ruta ${selectedCartLabel}`,
                      totalUnits: totalSoldUnits,
                      totalAmount: totalMoneyToHandOver,
                      paymentDetails: { cash: cashNum, yape: yapeNum, totalHanded: totalHandedIn, diff: difference },
                      notes: settlementNotes,
                      details: itemsToSettle.filter(it => it.loaded > 0).map(it => ({
                        name: it.name,
                        price: it.price,
                        loaded: it.loaded,
                        returned: it.returned,
                        sold: Math.max(0, it.loaded - it.returned),
                        subtotal: Math.max(0, it.loaded - it.returned) * it.price
                      }))
                    },
                    storeName: storeName || 'Friozo'
                  });
                }}
              >
                🧾 Vista Previa Ticket
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ padding: '10px 24px', fontSize: '0.95rem', fontWeight: 'bold' }}
              >
                🚀 Finalizar y Guardar Liquidación
              </button>
            </div>
          </div>
        </form>
      )}

      {/* PESTAÑA 2: CONFIGURACIÓN Y DOTACIÓN DE PRECIOS POR CARRITO */}
      {activeTab === 'catalog' && (
        <div className="glass" style={{ padding: '22px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h4 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text-dark)' }}>
                ⚙️ Configuración de Dotación y Precios por Carrito
              </h4>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>
                Define qué productos lleva cada carrito y ajusta los precios unitarios según la zona o circuito de venta.
              </span>
            </div>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => setShowAddProductModal(true)}
            >
              ➕ Agregar Presentación al Carrito
            </button>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Selecciona Carrito a Configurar:</label>
            <select
              className="form-control"
              style={{ fontSize: '0.82rem', padding: '6px 12px', width: 'auto' }}
              value={selectedCartLabel}
              onChange={(e) => handleSelectCart(e.target.value)}
            >
              {availableCarts.map(cart => (
                <option key={cart} value={cart}>{cart}</option>
              ))}
            </select>
          </div>

          <div className="admin-table-container">
            <table className="admin-table" style={{ fontSize: '0.82rem' }}>
              <thead>
                <tr>
                  <th>Presentación</th>
                  <th>Categoría</th>
                  <th style={{ textAlign: 'center', width: '130px' }}>Precio Carrito (S/)</th>
                  <th style={{ textAlign: 'center', width: '130px' }}>Carga Habitual (u.)</th>
                  <th style={{ textAlign: 'center', width: '60px' }}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {itemsToSettle.map(item => (
                  <tr key={item.id}>
                    <td><b>{item.name}</b></td>
                    <td>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-light)', background: 'rgba(0,0,0,0.04)', padding: '2px 6px', borderRadius: '4px' }}>
                        {item.category || 'General'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <span>S/</span>
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          className="form-control"
                          value={item.price}
                          onChange={(e) => handleItemPriceChange(item.id, e.target.value)}
                          style={{ width: '75px', textAlign: 'center', fontWeight: 'bold', padding: '3px' }}
                        />
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <input
                        type="number"
                        min="0"
                        className="form-control"
                        value={item.loaded || ''}
                        onChange={(e) => handleItemLoadedChange(item.id, e.target.value)}
                        style={{ width: '75px', textAlign: 'center', fontWeight: 'bold', padding: '3px' }}
                      />
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(item.id)}
                        style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}
                        title="Quitar de este carrito"
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                if (window.confirm('¿Deseas restaurar la dotación de este carrito con los productos y precios estándar de la tienda?')) {
                  setItemsToSettle(buildDefaultItemsForCart());
                }
              }}
            >
              🔄 Restaurar Precios Estándar
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSaveCartTemplate}
              style={{ fontWeight: 'bold' }}
            >
              💾 Guardar Plantilla de Precios y Dotación
            </button>
          </div>
        </div>
      )}

      {/* PESTAÑA 3: CONTROL DE RUTAS Y GPS EN VIVO */}
      {activeTab === 'routes' && (
        <div className="glass" style={{ padding: '22px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div>
            <h4 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text-dark)' }}>
              🗺️ Control de Rutas y Estado Operativo de Carritos
            </h4>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>
              Supervisión de ubicación en tiempo real, operador a cargo y acceso directo a navegación GPS (Google Maps / Waze).
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
            {availableCarts.map(cartLabel => {
              const locationObj = (cartLocations || []).find(c => (c.label || c.name || `Carrito ${c.id}`) === cartLabel);
              const config = cartConfigs[cartLabel] || {};

              return (
                <div key={cartLabel} style={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '12px',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ fontSize: '0.95rem' }}>{cartLabel}</strong>
                    <span style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '10px',
                      background: locationObj?.active !== false ? 'rgba(46, 204, 113, 0.15)' : 'rgba(231, 76, 60, 0.15)',
                      color: locationObj?.active !== false ? '#27ae60' : '#c0392b'
                    }}>
                      {locationObj?.active !== false ? '🟢 Activo en Calle' : '🔴 Inactivo / Base'}
                    </span>
                  </div>

                  <div style={{ fontSize: '0.78rem', color: 'var(--text-dark)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div><b>Ruta Asignada:</b> {config.routeName || 'Sin ruta fija'}</div>
                    <div><b>Vendedor:</b> {config.vendorName || locationObj?.vendorName || 'Sin asignar'}</div>
                    {locationObj?.lastUpdated && (
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-light)' }}>
                        Último ping GPS: {new Date(locationObj.lastUpdated).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    )}
                  </div>

                  {locationObj && locationObj.lat && locationObj.lng ? (
                    <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${locationObj.lat},${locationObj.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-sm"
                        style={{
                          background: '#4285F4',
                          color: '#fff',
                          textDecoration: 'none',
                          borderRadius: '6px',
                          padding: '5px 8px',
                          fontSize: '0.75rem',
                          flex: 1,
                          textAlign: 'center',
                          fontWeight: 600
                        }}
                      >
                        📍 Google Maps
                      </a>
                      <a
                        href={`https://waze.com/ul?ll=${locationObj.lat},${locationObj.lng}&navigate=yes`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-sm"
                        style={{
                          background: '#33CCFF',
                          color: '#002B49',
                          textDecoration: 'none',
                          borderRadius: '6px',
                          padding: '5px 8px',
                          fontSize: '0.75rem',
                          flex: 1,
                          textAlign: 'center',
                          fontWeight: 700
                        }}
                      >
                        🚙 Waze
                      </a>
                    </div>
                  ) : (
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-light)', fontStyle: 'italic' }}>
                      Sin coordenadas GPS reportadas hoy.
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* PESTAÑA 4: ALERTAS RÁPIDAS DE "SIN STOCK" */}
      {activeTab === 'alerts' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <form onSubmit={handleSendOutOfStockAlert} className="glass" style={{ padding: '18px', borderRadius: '14px', border: '1.5px solid #f39c12' }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '1rem', color: '#d35400' }}>
              📢 Emitir Reporte Rápido de "Sin Stock" desde la Calle
            </h4>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-light)', marginBottom: '14px' }}>
              Notifica a la central si se agotó una paleta, sabor o barquillos para coordinar reabastecimiento en ruta.
            </p>

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ width: '160px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>Carrito Emisor</label>
                <select
                  className="form-control"
                  style={{ fontSize: '0.8rem', padding: '6px 8px' }}
                  value={selectedCartLabel}
                  onChange={(e) => setSelectedCartLabel(e.target.value)}
                >
                  {availableCarts.map(cart => (
                    <option key={cart} value={cart}>{cart}</option>
                  ))}
                </select>
              </div>
              <div style={{ flex: 1, minWidth: '160px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>Producto Agotado</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Ej: Lúcuma / Conos / Fresa Rellena"
                  value={outOfStockItem}
                  onChange={(e) => setOutOfStockItem(e.target.value)}
                  style={{ fontSize: '0.8rem', padding: '6px 8px' }}
                  required
                />
              </div>
              <div style={{ flex: 2, minWidth: '200px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>Ubicación / Detalle</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Ej: Cerca al muelle, nos quedan solo 2 de vainilla"
                  value={outOfStockNotes}
                  onChange={(e) => setOutOfStockNotes(e.target.value)}
                  style={{ fontSize: '0.8rem', padding: '6px 8px' }}
                />
              </div>
              <button type="submit" className="btn btn-primary" style={{ padding: '7px 16px', background: '#d35400', borderColor: '#d35400', fontSize: '0.8rem' }}>
                🚨 Enviar Alerta
              </button>
            </div>
          </form>

          {/* Listado de Alertas Activas */}
          <div className="glass" style={{ padding: '18px', borderRadius: '14px' }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '1rem' }}>Alertas de Stock Pendientes en Calle</h4>
            {activeAlerts.length === 0 ? (
              <p style={{ color: 'var(--text-light)', fontSize: '0.8rem', margin: 0 }}>No hay alertas de stock activas. Todos los carritos están abastecidos.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {activeAlerts.map(alt => (
                  <div key={alt.id} style={{ background: 'rgba(243, 156, 18, 0.12)', border: '1px solid #f39c12', borderRadius: '10px', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                    <div>
                      <strong style={{ fontSize: '0.9rem', color: '#d35400' }}>{alt.cartLabel}: {alt.item}</strong>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-dark)', marginTop: '2px' }}>
                        Reportado por {alt.vendorName} • {alt.notes ? `"${alt.notes}" • ` : ''}{new Date(alt.timestamp).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      style={{ padding: '6px 14px', fontSize: '0.78rem', background: '#27ae60', borderColor: '#27ae60' }}
                      onClick={() => handleResolveAlert(alt.id)}
                    >
                      ✅ Reabastecido / Resolver
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* PESTAÑA 5: HISTORIAL DE LIQUIDACIONES Y RENDICIÓN */}
      {activeTab === 'history' && (
        <div className="glass" style={{ padding: '20px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <h4 style={{ margin: 0, fontSize: '1.05rem' }}>
              📜 Historial de Liquidaciones Rendidas
            </h4>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleExportCSV}
                style={{ fontSize: '0.78rem', padding: '5px 12px' }}
              >
                📥 Exportar a Excel (CSV)
              </button>
            </div>
          </div>

          {/* Filtros */}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <select
              className="form-control"
              style={{ fontSize: '0.8rem', padding: '4px 8px', width: '180px' }}
              value={historyCartFilter}
              onChange={(e) => setHistoryCartFilter(e.target.value)}
            >
              <option value="all">Todos los Carritos</option>
              {availableCarts.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <input
              type="text"
              className="form-control"
              placeholder="Buscar por vendedor o código..."
              value={historySearchQuery}
              onChange={(e) => setHistorySearchQuery(e.target.value)}
              style={{ fontSize: '0.8rem', padding: '4px 8px', flex: 1, minWidth: '200px' }}
            />
          </div>

          {filteredHistory.length === 0 ? (
            <p style={{ color: 'var(--text-light)', fontSize: '0.8rem', margin: '10px 0' }}>No se encontraron liquidaciones registradas.</p>
          ) : (
            <div className="admin-table-container">
              <table className="admin-table" style={{ fontSize: '0.8rem' }}>
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Fecha/Hora</th>
                    <th>Carrito</th>
                    <th>Ruta</th>
                    <th>Vendedor</th>
                    <th style={{ textAlign: 'center' }}>Unidades</th>
                    <th style={{ textAlign: 'right' }}>Total a Rendir</th>
                    <th style={{ textAlign: 'right' }}>Rendido</th>
                    <th style={{ textAlign: 'center' }}>Cuadre</th>
                    <th style={{ textAlign: 'center' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHistory.map(sq => {
                    const diff = sq.paymentDetails?.diff || 0;
                    return (
                      <tr key={sq.id}>
                        <td><b>{sq.id}</b></td>
                        <td>{new Date(sq.date).toLocaleDateString('es-PE')} {new Date(sq.date).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}</td>
                        <td>{sq.cartLabel}</td>
                        <td>{sq.routeName || '-'}</td>
                        <td>{sq.vendorName}</td>
                        <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{sq.totalUnits || 0} u.</td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold', color: 'var(--primary-color)' }}>
                          S/ {(sq.totalAmount || 0).toFixed(2)}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          S/ {(sq.paymentDetails?.totalHanded || sq.totalAmount || 0).toFixed(2)}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span style={{
                            fontSize: '0.72rem',
                            fontWeight: 'bold',
                            padding: '2px 6px',
                            borderRadius: '6px',
                            background: Math.abs(diff) < 0.01 ? 'rgba(46, 204, 113, 0.15)' : (diff < 0 ? 'rgba(231, 76, 60, 0.15)' : 'rgba(52, 152, 219, 0.15)'),
                            color: Math.abs(diff) < 0.01 ? '#27ae60' : (diff < 0 ? '#c0392b' : '#2980b9')
                          }}>
                            {Math.abs(diff) < 0.01 ? 'Exacto' : (diff < 0 ? `-S/${Math.abs(diff).toFixed(2)}` : `+S/${diff.toFixed(2)}`)}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                            <button
                              type="button"
                              className="btn btn-sm btn-secondary"
                              style={{ padding: '2px 6px', fontSize: '0.72rem' }}
                              onClick={() => setViewingSettlement(sq)}
                              title="Ver desglose completo de productos"
                            >
                              👁️
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm btn-secondary"
                              style={{ padding: '2px 6px', fontSize: '0.72rem' }}
                              onClick={() => {
                                printThermalTicket({
                                  type: 'cart_settlement',
                                  settlement: sq,
                                  storeName: storeName || 'Friozo'
                                });
                              }}
                              title="Reimprimir Ticket Térmico"
                            >
                              🧾
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* MODAL PARA AÑADIR PRESENTACIÓN / PRODUCTO */}
      {showAddProductModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
          padding: '15px'
        }}>
          <form onSubmit={handleAddProductSubmit} className="glass" style={{
            background: 'var(--bg-primary, #fff)',
            padding: '24px',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '460px',
            boxShadow: 'var(--shadow-lg)',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 style={{ margin: 0, fontSize: '1.1rem' }}>➕ Añadir Presentación al Carrito</h4>
              <button
                type="button"
                onClick={() => setShowAddProductModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.1rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {/* Selector de Modo */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                className={`btn btn-sm ${addMode === 'catalog' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ flex: 1, padding: '6px' }}
                onClick={() => setAddMode('catalog')}
              >
                📖 Del Catálogo
              </button>
              <button
                type="button"
                className={`btn btn-sm ${addMode === 'custom' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ flex: 1, padding: '6px' }}
                onClick={() => setAddMode('custom')}
              >
                ✨ Presentación Personalizada
              </button>
            </div>

            {addMode === 'catalog' ? (
              <div className="form-group">
                <label style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Selecciona Producto del Catálogo:</label>
                <select
                  className="form-control"
                  value={selectedCatalogItem}
                  onChange={(e) => setSelectedCatalogItem(e.target.value)}
                  style={{ fontSize: '0.85rem' }}
                  required
                >
                  <option value="">-- Elige un producto --</option>
                  <optgroup label="Paletas Artesanales">
                    {(popsicles || []).map(p => (
                      <option key={p.id} value={`popsicle:::${p.id}`}>{p.name} (S/ {p.price})</option>
                    ))}
                  </optgroup>
                  <optgroup label="Envases y Conos">
                    {(bases || []).map(b => (
                      <option key={b.id} value={`base:::${b.id}`}>{b.name} (S/ {((Number(b.price) || 0) + 6).toFixed(2)})</option>
                    ))}
                  </optgroup>
                  <optgroup label="Packs y Combos">
                    {(packs || []).map(pk => (
                      <option key={pk.id} value={`pack:::${pk.id}`}>{pk.name} (S/ {pk.price})</option>
                    ))}
                  </optgroup>
                  <optgroup label="Potes de Litro">
                    <option value="liter:::1l">Pote 1 Litro (S/ {literConfig?.price || 15})</option>
                  </optgroup>
                </select>
              </div>
            ) : (
              <>
                <div className="form-group">
                  <label style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Nombre de la Presentación / Producto:</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Ej: Vaso 2 Bolas Especial / Sandwich Helado"
                    value={customItemName}
                    onChange={(e) => setCustomItemName(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Categoría:</label>
                  <select
                    className="form-control"
                    value={customItemCategory}
                    onChange={(e) => setCustomItemCategory(e.target.value)}
                  >
                    <option value="Paletas">Paletas</option>
                    <option value="Conos y Vasos">Conos y Vasos</option>
                    <option value="Potes">Potes</option>
                    <option value="Bebidas">Bebidas</option>
                    <option value="Snacks">Snacks / Otros</option>
                  </select>
                </div>
              </>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div className="form-group">
                <label style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Precio para este Carrito (S/):</label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  className="form-control"
                  placeholder="Ej: 6.00"
                  value={customItemPrice}
                  onChange={(e) => setCustomItemPrice(e.target.value)}
                  required={addMode === 'custom'}
                />
              </div>
              <div className="form-group">
                <label style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Carga Inicial (Unidades):</label>
                <input
                  type="number"
                  min="1"
                  className="form-control"
                  placeholder="Ej: 20"
                  value={customItemLoaded}
                  onChange={(e) => setCustomItemLoaded(e.target.value)}
                  required
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '5px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ flex: 1 }}
                onClick={() => setShowAddProductModal(false)}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ flex: 1, fontWeight: 'bold' }}
              >
                Añadir al Carrito
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL DE DETALLE DE LIQUIDACIÓN HISTÓRICA */}
      {viewingSettlement && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
          padding: '15px'
        }}>
          <div className="glass" style={{
            background: 'var(--bg-primary, #fff)',
            padding: '24px',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '520px',
            maxHeight: '85vh',
            overflowY: 'auto',
            boxShadow: 'var(--shadow-lg)',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 style={{ margin: 0, fontSize: '1.1rem' }}>Detalle de Liquidación: {viewingSettlement.id}</h4>
              <button
                type="button"
                onClick={() => setViewingSettlement(null)}
                style={{ background: 'none', border: 'none', fontSize: '1.1rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{ fontSize: '0.8rem', color: 'var(--text-dark)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
              <div><b>Carrito:</b> {viewingSettlement.cartLabel}</div>
              <div><b>Ruta:</b> {viewingSettlement.routeName || '-'}</div>
              <div><b>Vendedor:</b> {viewingSettlement.vendorName}</div>
              <div><b>Fecha:</b> {new Date(viewingSettlement.date).toLocaleString('es-PE')}</div>
            </div>

            <div className="admin-table-container">
              <table className="admin-table" style={{ fontSize: '0.78rem' }}>
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th style={{ textAlign: 'center' }}>Cargados</th>
                    <th style={{ textAlign: 'center' }}>Retornados</th>
                    <th style={{ textAlign: 'center' }}>Vendidos</th>
                    <th style={{ textAlign: 'right' }}>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {(viewingSettlement.details || []).map((it, idx) => (
                    <tr key={idx}>
                      <td><b>{it.name}</b> <small>(S/ {Number(it.price).toFixed(2)})</small></td>
                      <td style={{ textAlign: 'center' }}>{it.loaded}</td>
                      <td style={{ textAlign: 'center' }}>{it.returned}</td>
                      <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{it.sold}</td>
                      <td style={{ textAlign: 'right', fontWeight: 'bold' }}>S/ {Number(it.subtotal).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ background: 'var(--bg-secondary)', padding: '12px', borderRadius: '8px', fontSize: '0.82rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Total Unidades Vendidas:</span>
                <b>{viewingSettlement.totalUnits || 0} unidades</b>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Total a Rendir:</span>
                <b style={{ color: 'var(--primary-color)' }}>S/ {(viewingSettlement.totalAmount || 0).toFixed(2)}</b>
              </div>
              {viewingSettlement.paymentDetails && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-light)' }}>
                    <span>Efectivo entregado:</span>
                    <span>S/ {(viewingSettlement.paymentDetails.cash || 0).toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-light)' }}>
                    <span>Yape / Plin rendido:</span>
                    <span>S/ {(viewingSettlement.paymentDetails.yape || 0).toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                    <span>Diferencia de Cuadre:</span>
                    <span style={{ color: (viewingSettlement.paymentDetails.diff || 0) >= 0 ? '#27ae60' : '#c0392b' }}>
                      {(viewingSettlement.paymentDetails.diff || 0) >= 0 ? `+S/ ${(viewingSettlement.paymentDetails.diff || 0).toFixed(2)}` : `-S/ ${Math.abs(viewingSettlement.paymentDetails.diff || 0).toFixed(2)}`}
                    </span>
                  </div>
                </>
              )}
              {viewingSettlement.notes && (
                <div style={{ marginTop: '4px', fontStyle: 'italic', color: 'var(--text-light)' }}>
                  Notas: "{viewingSettlement.notes}"
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ flex: 1 }}
                onClick={() => setViewingSettlement(null)}
              >
                Cerrar
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{ flex: 1, fontWeight: 'bold' }}
                onClick={() => {
                  printThermalTicket({
                    type: 'cart_settlement',
                    settlement: viewingSettlement,
                    storeName: storeName || 'Friozo'
                  });
                }}
              >
                🧾 Imprimir Ticket Térmico
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
