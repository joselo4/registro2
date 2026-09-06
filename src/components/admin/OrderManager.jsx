import React, { useState, useEffect } from 'react';
import { buildSmsHref, formatOrderStatusMessage, normalizeSmsTemplates, formatDriverDispatchMessage, buildWhatsAppHref } from '../../utils/orderMessaging';
import { printThermalTicket } from '../../utils/escposTicket';

// --- FUNCIONES DE SANITIZACIÓN ---
const sanitizeHTML = (text) => {
  if (typeof text !== 'string') return '';
  return text.replace(/<[^>]*>/g, '').trim();
};

export default function OrderManager({
  orders,
  onUpdateOrders,
  onUpdateOrderStatus,
  flavors,
  toppings,
  bases,
  packs,
  storeName,
  storePhone,
  ticketCustomMessage,
  addLog,
  currentUser,
  showAlert,
  shopConfig,
  activeSubTab: activeSubTabProp,
  staffUsers = []
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

  // --- Sub Tab: orders o surveys ---
  const [activeSubTab, setActiveSubTab] = useState(activeSubTabProp || 'orders');

  useEffect(() => {
    if (activeSubTabProp) {
      setActiveSubTab(activeSubTabProp);
    }
  }, [activeSubTabProp]);

  // --- Estados Locales de Filtro y Búsqueda ---
  const [orderFilter, setOrderFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState(''); 
  const [dateFilterType, setDateFilterType] = useState('all'); // all, today, yesterday, 7days, custom
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [ratingFilter, setRatingFilter] = useState('all'); // all, low, high
  const [ordersLimit, setOrdersLimit] = useState(20); // 20, 40, 60, all
  const [driverFilter, setDriverFilter] = useState('all'); // all, unassigned, driverIdentifier

  const openStatusSms = (order, newStatus) => {
    if (shopConfig?.smsNotificationsEnabled !== true) return;
    const href = buildSmsHref(
      order.customer?.phone,
      formatOrderStatusMessage({
        template: normalizeSmsTemplates(shopConfig.smsTemplates)[newStatus],
        order,
        status: newStatus,
        storeName,
      })
    );
    if (!href) {
      alert('El pedido no tiene telefono valido para SMS.');
      return;
    }
    window.location.assign(href);
  };

  const handleStatusChange = (order, newStatus, logText) => {
    onUpdateOrderStatus(order.id, newStatus);
    addLog(logText);
    openStatusSms(order, newStatus);
  };

  const handleAssignDriver = (order, driverIdentifier) => {
    const selectedUser = (staffUsers || []).find(u => String(u.id || u.email) === String(driverIdentifier));
    const assignedDriver = selectedUser ? {
      id: selectedUser.id || selectedUser.email,
      name: selectedUser.name || selectedUser.email,
      email: selectedUser.email,
      phone: selectedUser.phone || ''
    } : null;

    const updated = {
      ...order,
      assignedDriver,
      updatedAt: new Date().toISOString()
    };
    onUpdateOrders(orders.map(o => o.id === order.id ? updated : o));
    if (addLog) {
      addLog(`Repartidor ${assignedDriver ? assignedDriver.name : 'desasignado'} para pedido ${order.id}`);
    }
  };

  const handleDispatchToDriverWhatsApp = (order) => {
    const assigned = order.assignedDriver;
    if (!assigned) {
      alert("Primero asigna un repartidor a este pedido.");
      return;
    }
    const driverUser = (staffUsers || []).find(u => String(u.id || u.email) === String(assigned.id || assigned.email));
    let targetPhone = driverUser?.phone || assigned.phone || '';
    if (!targetPhone) {
      targetPhone = window.prompt(`Ingresa el número de WhatsApp del repartidor (${assigned.name || 'Repartidor'}):`, '987654321');
    }
    if (!targetPhone) return;

    const message = formatDriverDispatchMessage({
      order,
      storeName,
      driverName: assigned.name
    });
    const href = buildWhatsAppHref(targetPhone, message);
    const win = window.open(href, '_blank', 'noopener,noreferrer');
    if (win) win.opener = null;
    if (addLog) {
      addLog(`Hoja de ruta despachada por WhatsApp a ${assigned.name} para pedido ${order.id}`);
    }
  };

  // --- Estados de Edición de Pedidos ---
  const [editingOrder, setEditingOrder] = useState(null);
  const [editNewFlavorId, setEditNewFlavorId] = useState(flavors[0]?.id || '');
  const [editNewBaseId, setEditNewBaseId] = useState('cono');
  const [editNewPackId, setEditNewPackId] = useState(packs[0]?.id || '');

  // --- Exportar Pedidos a Excel (CSV) ---
  const handleExportCSV = () => {
    if (orders.length === 0) {
      alert("No hay pedidos registrados para exportar.");
      return;
    }
    
    let csvContent = "\uFEFF"; // BOM para UTF-8 en Excel
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
      `---------------------------\n` +
      (ordersToday.length > 0 
        ? ordersToday.map(o => `[${o.status}] ${o.id} - ${o.customer.name} - S/. ${o.grandTotal.toFixed(2)}`).join('\n')
        : 'Sin pedidos el día de hoy.'
      );
      
    navigator.clipboard.writeText(textReport)
      .then(() => alert("¡Reporte de ventas copiado al portapapeles! Listo para enviar por WhatsApp."))
      .catch(() => alert("Error al copiar reporte."));
  };

  const handleStartEditingOrder = (order) => {
    setEditingOrder(JSON.parse(JSON.stringify(order)));
    if (flavors.length > 0) setEditNewFlavorId(flavors[0].id);
    if (packs.length > 0) setEditNewPackId(packs[0].id);
  };

  // --- RENDER SECCIÓN EDICIÓN ---
  if (editingOrder) {
    const subtotal = editingOrder.items.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);
    const grandTotal = subtotal + parseFloat(editingOrder.deliveryFee || 0);

    const handleUpdateItemQty = (idx, amount) => {
      const nextItems = [...editingOrder.items];
      const nextQty = Math.max(1, (nextItems[idx].quantity || 1) + amount);
      nextItems[idx].quantity = nextQty;
      setEditingOrder({ ...editingOrder, items: nextItems });
    };

    const handleUpdateItemPrice = (idx, priceVal) => {
      const nextItems = [...editingOrder.items];
      nextItems[idx].price = parseFloat(priceVal) || 0;
      setEditingOrder({ ...editingOrder, items: nextItems });
    };

    const handleRemoveItem = (idx) => {
      const nextItems = editingOrder.items.filter((_, i) => i !== idx);
      setEditingOrder({ ...editingOrder, items: nextItems });
    };

    const handleAddFlavorToOrder = () => {
      const f = flavors.find(flavor => flavor.id === editNewFlavorId);
      const b = bases.find(base => base.id === editNewBaseId);
      if (!f || !b) return;
      
      const newItem = {
        type: 'custom',
        base: { id: b.id, name: b.name, price: b.price },
        scoops: [{ id: f.id, name: f.name, price: f.price, color: f.color }],
        toppings: [],
        price: f.price + b.price,
        quantity: 1,
        name: `Helado de ${f.name} en ${b.name}`
      };
      setEditingOrder({ ...editingOrder, items: [...editingOrder.items, newItem] });
    };

    const handleAddPackToOrder = () => {
      const p = packs.find(pack => pack.id === editNewPackId);
      if (!p) return;
      
      const newItem = {
        type: 'pack',
        id: p.id,
        name: p.name,
        price: p.price,
        items: p.items,
        quantity: 1
      };
      setEditingOrder({ ...editingOrder, items: [...editingOrder.items, newItem] });
    };

    const handleSaveOrderEdits = () => {
      if (editingOrder.items.length === 0) {
        alert("El pedido debe tener al menos un producto.");
        return;
      }
      
      const finalSubtotal = editingOrder.items.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);
      const finalGrandTotal = finalSubtotal + parseFloat(editingOrder.deliveryFee || 0);

      const updatedOrder = {
        ...editingOrder,
        total: finalSubtotal,
        grandTotal: finalGrandTotal
      };

      const nextOrders = orders.map(o => o.id === editingOrder.id ? updatedOrder : o);
      onUpdateOrders(nextOrders);
      addLog(`Pedido ${editingOrder.id} modificado por el operador (${currentUser?.name}).`);
      setEditingOrder(null);
      alert("¡Pedido actualizado con éxito!");
    };

    return (
      <div className="glass" style={{ padding: '20px', borderRadius: 'var(--radius-lg)' }}>
        <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', marginBottom: '15px' }}>
          ✏️ Editar Pedido: <span style={{ color: 'var(--primary-color)' }}>{editingOrder.id}</span>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-light)', marginLeft: '10px', fontWeight: 'normal' }}>
            ({new Date(editingOrder.date).toLocaleDateString('es-PE')} {new Date(editingOrder.date).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: true })})
          </span>
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }} className="admin-stats-columns">
          {/* Datos del Cliente */}
          <div className="glass" style={{ padding: '15px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <strong style={{ fontSize: '0.85rem' }}>👤 Datos del Cliente</strong>
            <div className="form-group">
              <label style={{ fontSize: '0.75rem' }}>Nombre</label>
              <input 
                type="text" 
                className="form-control" 
                style={{ fontSize: '0.8rem', padding: '6px' }} 
                value={editingOrder.customer.name} 
                onChange={(e) => setEditingOrder({
                  ...editingOrder,
                  customer: { ...editingOrder.customer, name: e.target.value }
                })}
              />
            </div>
            <div className="form-group">
              <label style={{ fontSize: '0.75rem' }}>Teléfono</label>
              <input 
                type="text" 
                className="form-control" 
                style={{ fontSize: '0.8rem', padding: '6px' }} 
                value={editingOrder.customer.phone} 
                onChange={(e) => setEditingOrder({
                  ...editingOrder,
                  customer: { ...editingOrder.customer, phone: e.target.value }
                })}
              />
            </div>
            <div className="form-group">
              <label style={{ fontSize: '0.75rem' }}>Dirección de Entrega</label>
              <input 
                type="text" 
                className="form-control" 
                style={{ fontSize: '0.8rem', padding: '6px' }} 
                value={editingOrder.customer.address} 
                onChange={(e) => setEditingOrder({
                  ...editingOrder,
                  customer: { ...editingOrder.customer, address: e.target.value }
                })}
              />
            </div>
            <div className="form-group">
              <label style={{ fontSize: '0.75rem' }}>Método de Pago</label>
              <select 
                className="form-control" 
                style={{ fontSize: '0.8rem', padding: '6px' }} 
                value={editingOrder.customer.paymentMethod}
                onChange={(e) => setEditingOrder({
                  ...editingOrder,
                  customer: { ...editingOrder.customer, paymentMethod: e.target.value }
                })}
              >
                <option value="Yape">Yape</option>
                <option value="Plin">Plin</option>
                <option value="Efectivo">Efectivo</option>
                <option value="Tarjeta">Tarjeta</option>
              </select>
            </div>
          </div>

          {/* Agregar Producto */}
          <div className="glass" style={{ padding: '15px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <strong style={{ fontSize: '0.85rem' }}>➕ Agregar Producto al Pedido</strong>
            
            <div style={{ background: 'rgba(0,0,0,0.02)', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>🍦 Helado Simple</span>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '6px' }}>
                <select 
                  className="form-control" 
                  style={{ fontSize: '0.75rem', padding: '4px', flex: 1, minWidth: '100px' }}
                  value={editNewFlavorId}
                  onChange={(e) => setEditNewFlavorId(e.target.value)}
                >
                  {flavors.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
                <select 
                  className="form-control" 
                  style={{ fontSize: '0.75rem', padding: '4px', flex: 1, minWidth: '100px' }}
                  value={editNewBaseId}
                  onChange={(e) => setEditNewBaseId(e.target.value)}
                >
                  {bases.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <button type="button" className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '0.75rem', width: '100%' }} onClick={handleAddFlavorToOrder}>
                ➕ Agregar Helado
              </button>
            </div>

            <div style={{ background: 'rgba(0,0,0,0.02)', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>🎁 Combo o Promoción</span>
              <div style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
                <select 
                  className="form-control" 
                  style={{ fontSize: '0.75rem', padding: '4px', flex: 1 }}
                  value={editNewPackId}
                  onChange={(e) => setEditNewPackId(e.target.value)}
                >
                  {packs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <button type="button" className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '0.75rem', width: '100%' }} onClick={handleAddPackToOrder}>
                ➕ Agregar Combo
              </button>
            </div>
          </div>
        </div>

        {/* Detalle de Artículos */}
        <div className="glass" style={{ padding: '15px', marginBottom: '20px' }}>
          <strong style={{ fontSize: '0.85rem', display: 'block', marginBottom: '10px' }}>🍨 Productos en el Pedido</strong>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {editingOrder.items.map((item, idx) => {
              let itemLabel = item.name;
              if (item.type === 'custom') {
                const scoopsStr = item.scoops ? item.scoops.map(s => s.name).join(', ') : 'Sabor';
                const baseStr = item.base ? item.base.name : 'Envase';
                itemLabel = `Helado de ${scoopsStr} en ${baseStr}`;
              }
              return (
                <div key={idx} style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  background: 'var(--bg-primary)', 
                  padding: '8px 12px', 
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  flexWrap: 'wrap',
                  gap: '10px'
                }}>
                  <div style={{ flex: 1, minWidth: '150px' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 'bold', color: 'var(--text-dark)' }}>{itemLabel}</span>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-light)' }}>Cant:</span>
                      <button type="button" className="btn btn-secondary" style={{ padding: '2px 6px', fontSize: '0.75rem' }} onClick={() => handleUpdateItemQty(idx, -1)}>-</button>
                      <span style={{ fontSize: '0.8rem', fontWeight: 'bold', minWidth: '15px', textAlign: 'center' }}>{item.quantity || 1}</span>
                      <button type="button" className="btn btn-secondary" style={{ padding: '2px 6px', fontSize: '0.75rem' }} onClick={() => handleUpdateItemQty(idx, 1)}>+</button>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-light)' }}>Precio Unit:</span>
                      <input 
                        type="number" 
                        step="0.10" 
                        className="form-control" 
                        style={{ fontSize: '0.75rem', padding: '4px', width: '70px', height: '24px' }} 
                        value={item.price} 
                        onChange={(e) => handleUpdateItemPrice(idx, e.target.value)}
                      />
                    </div>

                    <button 
                      type="button" 
                      className="btn btn-secondary" 
                      style={{ padding: '4px 8px', color: 'var(--danger)', borderColor: 'rgba(231, 76, 60, 0.2)' }}
                      onClick={() => handleRemoveItem(idx)}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Envío y Totales */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', alignItems: 'flex-start', marginBottom: '20px' }} className="admin-stats-columns">
          <div className="glass" style={{ padding: '15px' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 'bold' }}>🚚 Costo de Delivery / Envío</label>
              <input 
                type="number" 
                step="0.50" 
                className="form-control" 
                style={{ fontSize: '0.8rem', padding: '6px', marginTop: '5px' }} 
                value={editingOrder.deliveryFee} 
                onChange={(e) => setEditingOrder({ ...editingOrder, deliveryFee: parseFloat(e.target.value) || 0 })}
              />
            </div>
          </div>

          <div className="glass" style={{ padding: '15px', display: 'flex', flexDirection: 'column', gap: '4px', textAlign: 'right' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>Subtotal: S/. {subtotal.toFixed(2)}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>Envío: S/. {parseFloat(editingOrder.deliveryFee || 0).toFixed(2)}</div>
            <div style={{ fontSize: '1.15rem', fontWeight: 'bold', color: 'var(--primary-color)', marginTop: '4px' }}>
              Total General: S/. {grandTotal.toFixed(2)}
            </div>
          </div>
        </div>

        {/* Acciones */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button type="button" className="btn btn-primary" style={{ flex: 1, padding: '10px' }} onClick={handleSaveOrderEdits}>
            💾 Guardar Cambios en Pedido
          </button>
          <button type="button" className="btn btn-secondary" style={{ flex: 1, padding: '10px' }} onClick={() => setEditingOrder(null)}>
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  // --- FILTRAR PEDIDOS ---
  let filtered = orderFilter === 'all' ? orders : orders.filter(o => o.status === orderFilter);
  if (searchQuery.trim() !== '') {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(o => 
      o.id.toLowerCase().includes(q) || 
      o.customer.name.toLowerCase().includes(q) || 
      o.customer.phone.includes(q)
    );
  }

  // Filtrar por fecha
  if (dateFilterType !== 'all') {
    const now = new Date();
    filtered = filtered.filter(o => {
      const orderDate = new Date(o.date);
      
      if (dateFilterType === 'today') {
        return orderDate.toDateString() === now.toDateString();
      }
      
      if (dateFilterType === 'yesterday') {
        const yesterday = new Date();
        yesterday.setDate(now.getDate() - 1);
        return orderDate.toDateString() === yesterday.toDateString();
      }
      
      if (dateFilterType === '7days') {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(now.getDate() - 7);
        return orderDate >= sevenDaysAgo;
      }
      
      if (dateFilterType === 'custom') {
        let start = dateStart ? new Date(dateStart + 'T00:00:00') : null;
        let end = dateEnd ? new Date(dateEnd + 'T23:59:59') : null;
        
        if (start && end) {
          return orderDate >= start && orderDate <= end;
        } else if (start) {
          return orderDate >= start;
        } else if (end) {
          return orderDate <= end;
        }
      }
      return true;
    });
  }

  // Filtrar por repartidor asignado
  if (driverFilter !== 'all') {
    filtered = filtered.filter(o => {
      if (driverFilter === 'unassigned') {
        return !o.assignedDriver;
      }
      const dId = String(o.assignedDriver?.id || o.assignedDriver?.email || '');
      return dId === driverFilter;
    });
  }

  const todayStr = new Date().toDateString();
  const kpis = {
    toCorroborate: orders.filter(o => o.status === 'Por Corroborar').length,
    pending: orders.filter(o => o.status === 'Pendiente').length,
    preparing: orders.filter(o => o.status === 'Preparando').length,
    delivery: orders.filter(o => o.status === 'En camino').length,
    delivered: orders.filter(o => o.status === 'Entregado').length,
    todaySales: orders
      .filter(o => o.status !== 'Cancelado' && new Date(o.date).toDateString() === todayStr)
      .reduce((sum, o) => sum + (o.grandTotal || 0), 0)
  };

  const displayedOrders = ordersLimit === 'all' ? filtered : filtered.slice(0, ordersLimit);

  // --- FILTRAR ENCUESTAS ---
  const surveyOrders = orders.filter(o => o.survey);
  const filteredSurveys = surveyOrders.filter(o => {
    if (ratingFilter === 'low') return o.survey.rating <= 3;
    if (ratingFilter === 'high') return o.survey.rating >= 4;
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Subnavegación */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
        <button className={`admin-action-btn ${activeSubTab === 'orders' ? 'active' : ''}`} style={{ padding: '6px 12px', fontSize: '0.8rem', fontWeight: 600, border: 'none', background: activeSubTab === 'orders' ? 'var(--primary-color)' : 'rgba(0,0,0,0.05)', color: activeSubTab === 'orders' ? 'white' : 'inherit', borderRadius: '6px', cursor: 'pointer' }} onClick={() => setActiveSubTab('orders')}>📦 Pedidos</button>
        <button className={`admin-action-btn ${activeSubTab === 'surveys' ? 'active' : ''}`} style={{ padding: '6px 12px', fontSize: '0.8rem', fontWeight: 600, border: 'none', background: activeSubTab === 'surveys' ? 'var(--primary-color)' : 'rgba(0,0,0,0.05)', color: activeSubTab === 'surveys' ? 'white' : 'inherit', borderRadius: '6px', cursor: 'pointer' }} onClick={() => setActiveSubTab('surveys')}>⭐ Encuestas y Opiniones</button>
      </div>

      {activeSubTab === 'orders' ? (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', flexWrap: 'wrap', gap: '10px' }}>
            <h3 style={{ margin: 0 }}>Control de Pedidos ({filtered.length})</h3>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '0.8rem' }} onClick={handleExportCSV}>
                📥 Descargar Excel (CSV)
              </button>
              <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '0.8rem' }} onClick={handleExportSalesReport}>
                💬 Enviar Reporte
              </button>
            </div>
          </div>

          {/* Pipeline Visualizador de Etapas Ordenadas (Secuencial de 1 a 5) */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(135px, 1fr))',
            gap: '8px',
            marginBottom: '16px',
            padding: '8px',
            background: 'rgba(0,0,0,0.02)',
            borderRadius: '12px',
            border: '1px solid var(--border-color)'
          }}>
            {[
              { id: 'Por Corroborar', step: '1', label: 'Por Corroborar', icon: '⏳', count: kpis.toCorroborate, color: '#e67e22', desc: 'Validar pago/datos' },
              { id: 'Pendiente', step: '2', label: 'Confirmados', icon: '📋', count: kpis.pending, color: '#2980b9', desc: 'En cola de cocina' },
              { id: 'Preparando', step: '3', label: 'Preparando', icon: '👨‍🍳', count: kpis.preparing, color: '#8e44ad', desc: 'En elaboración' },
              { id: 'En camino', step: '4', label: 'En Ruta / Salón', icon: '🛵', count: kpis.delivery, color: 'var(--delivery-color, #FF441F)', desc: 'Despachado' },
              { id: 'Entregado', step: '5', label: 'Entregados', icon: '🎉', count: kpis.delivered, color: 'var(--success, #27ae60)', desc: 'Completados' }
            ].map(st => {
              const isSelected = orderFilter === st.id;
              return (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setOrderFilter(orderFilter === st.id ? 'all' : st.id)}
                  style={{
                    border: isSelected ? `2px solid ${st.color}` : '1px solid var(--border-color)',
                    background: isSelected ? 'var(--bg-secondary, #fff)' : 'rgba(255,255,255,0.6)',
                    borderRadius: '8px',
                    padding: '8px 10px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px',
                    transition: 'all 0.15s ease',
                    boxShadow: isSelected ? `0 2px 8px ${st.color}25` : 'none'
                  }}
                  title={`Filtrar por ${st.label}`}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: st.color }}>
                      {st.icon} Paso {st.step}
                    </span>
                    <span style={{
                      background: st.count > 0 ? st.color : 'rgba(0,0,0,0.08)',
                      color: st.count > 0 ? '#fff' : 'inherit',
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      padding: '1px 6px',
                      borderRadius: '10px'
                    }}>
                      {st.count}
                    </span>
                  </div>
                  <strong style={{ fontSize: '0.8rem', color: 'var(--text-dark)' }}>{st.label}</strong>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-light)' }}>{st.desc}</span>
                </button>
              );
            })}
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

          {/* Filtros Combinados */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '15px', marginBottom: '15px' }}>
            <div style={{ 
              display: 'flex', 
              gap: '8px', 
              alignItems: 'center', 
              flexWrap: 'wrap', 
              padding: '10px', 
              background: 'rgba(0,0,0,0.02)', 
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-color)',
              height: '100%'
            }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-dark)' }}>📅 Filtrar Fecha:</span>
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', flex: 1 }}>
                {[
                  { id: 'all', label: 'Todos' },
                  { id: 'today', label: 'Hoy' },
                  { id: 'yesterday', label: 'Ayer' },
                  { id: '7days', label: 'Últimos 7 días' },
                  { id: 'custom', label: 'Rango' }
                ].map(df => (
                  <button
                    key={df.id}
                    type="button"
                    className={`filter-btn ${dateFilterType === df.id ? 'active' : ''}`}
                    onClick={() => setDateFilterType(df.id)}
                    style={{ fontSize: '0.7rem', padding: '4px 8px', whiteSpace: 'nowrap' }}
                  >
                    {df.label}
                  </button>
                ))}
              </div>
              
              {dateFilterType === 'custom' && (
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', width: '100%', marginTop: '8px' }}>
                  <input
                    type="date"
                    className="form-control"
                    style={{ fontSize: '0.75rem', padding: '4px 8px', width: 'auto', flex: 1 }}
                    value={dateStart}
                    onChange={(e) => setDateStart(e.target.value)}
                  />
                  <span style={{ fontSize: '0.75rem' }}>a</span>
                  <input
                    type="date"
                    className="form-control"
                    style={{ fontSize: '0.75rem', padding: '4px 8px', width: 'auto', flex: 1 }}
                    value={dateEnd}
                    onChange={(e) => setDateEnd(e.target.value)}
                  />
                </div>
              )}
            </div>

            <div style={{ 
              display: 'flex', 
              gap: '8px', 
              alignItems: 'center', 
              flexWrap: 'wrap', 
              padding: '10px', 
              background: 'rgba(0,0,0,0.02)', 
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-color)',
              height: '100%'
            }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-dark)' }}>🔢 Mostrar Últimos:</span>
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', flex: 1 }}>
                {[
                  { id: 20, label: '20' },
                  { id: 40, label: '40' },
                  { id: 60, label: '60' },
                  { id: 'all', label: 'Todos' }
                ].map(lim => (
                  <button
                    key={lim.id}
                    type="button"
                    className={`filter-btn ${ordersLimit === lim.id ? 'active' : ''}`}
                    onClick={() => setOrdersLimit(lim.id)}
                    style={{ fontSize: '0.7rem', padding: '4px 8px', minWidth: '40px', textAlign: 'center' }}
                  >
                    {lim.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ 
              display: 'flex', 
              gap: '8px', 
              alignItems: 'center', 
              flexWrap: 'wrap', 
              padding: '10px', 
              background: 'rgba(0,0,0,0.02)', 
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-color)',
              height: '100%'
            }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-dark)' }}>🛵 Repartidor:</span>
              <select
                value={driverFilter}
                onChange={(e) => setDriverFilter(e.target.value)}
                style={{
                  fontSize: '0.75rem',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-secondary, #fff)',
                  color: 'var(--text-dark)',
                  flex: 1
                }}
              >
                <option value="all">Todos los repartidores</option>
                <option value="unassigned">⚠️ Sin repartidor asignado</option>
                {staffUsers.map(u => (
                  <option key={u.id || u.email} value={u.id || u.email}>
                    🛵 {u.name || u.email} {u.role ? `(${u.role})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Banner Informativo de Finalidad de Repartidores */}
          <div style={{
            padding: '10px 14px',
            background: 'linear-gradient(135deg, rgba(255, 68, 31, 0.08) 0%, rgba(255, 68, 31, 0.02) 100%)',
            borderRadius: '8px',
            borderLeft: '4px solid var(--delivery-color, #FF441F)',
            marginBottom: '14px',
            fontSize: '0.8rem',
            color: 'var(--text-dark)',
            lineHeight: 1.5
          }}>
            <strong>🛵 Finalidad de Asignar Repartidores:</strong> Al asignar un motorizado a un pedido delivery, éste se añade a su pantalla móvil (<em>pestaña Mis Repartos</em>), se habilita su señal GPS en vivo para el cliente en el rastreador y puedes despacharle la hoja de ruta con 1 toque al WhatsApp con el botón <strong>📲 Despachar</strong>.
          </div>

          <div style={{ display: 'flex', gap: '5px', overflowX: 'auto', paddingBottom: '6px', marginBottom: '15px' }}>
            {['all', 'Por Corroborar', 'Pendiente', 'Preparando', 'En camino', 'Entregado', 'Cancelado'].map(f => (
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
                  displayedOrders.map(order => {
                    const isDelivery = order.customer?.orderType === 'Delivery' || (order.deliveryFee > 0);
                    const isMesa = order.customer?.orderType === 'Mesa' || Boolean(order.customer?.tableNumber);

                    const getStageInfo = (status, delivery) => {
                      if (status === 'Cancelado') return { text: '🛑 Cancelado', color: '#c0392b' };
                      if (status === 'Entregado') return { text: '🎉 Entregado', color: '#27ae60' };
                      if (delivery) {
                        switch (status) {
                          case 'Por Corroborar': return { text: '⏳ 1/4 Validar Pago', color: '#e67e22' };
                          case 'Pendiente': return { text: '📋 2/4 En Cola', color: '#2980b9' };
                          case 'Preparando': return { text: '👨‍🍳 3/4 Preparando', color: '#8e44ad' };
                          case 'En camino': return { text: '🛵 4/4 En Ruta', color: '#FF441F' };
                          default: return { text: status, color: '#7f8c8d' };
                        }
                      } else {
                        switch (status) {
                          case 'Por Corroborar': return { text: '⏳ 1/3 Validar Pedido', color: '#e67e22' };
                          case 'Pendiente': return { text: '📋 2/3 En Cola', color: '#2980b9' };
                          case 'Preparando': return { text: '👨‍🍳 3/3 Preparando', color: '#8e44ad' };
                          default: return { text: status, color: '#7f8c8d' };
                        }
                      }
                    };

                    const stage = getStageInfo(order.status, isDelivery);

                    return (
                    <tr key={order.id} style={isDelivery ? { background: 'rgba(255, 68, 31, 0.02)' } : {}}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <strong>{order.id}</strong>
                          {isDelivery && (
                            <span className="badge badge-delivery" style={{
                              background: 'var(--delivery-color, #FF441F)',
                              color: '#fff',
                              fontSize: '0.65rem',
                              fontWeight: 700,
                              padding: '2px 6px',
                              borderRadius: '4px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px'
                            }}>
                              🛵 DELIVERY
                            </span>
                          )}
                          {order.customer?.orderType === 'Mesa' && (
                            <span className="badge" style={{
                              background: '#3498db',
                              color: '#fff',
                              fontSize: '0.65rem',
                              fontWeight: 700,
                              padding: '2px 6px',
                              borderRadius: '4px'
                            }}>
                              🍽️ Mesa {order.customer?.tableNumber || ''}
                            </span>
                          )}
                          {(order.customer?.orderType === 'Llevar' || order.customer?.orderType === 'Barra' || order.customer?.orderType === 'Mesa_Llevar') && (
                            <span className="badge" style={{
                              background: '#9b59b6',
                              color: '#fff',
                              fontSize: '0.65rem',
                              fontWeight: 700,
                              padding: '2px 6px',
                              borderRadius: '4px'
                            }}>
                              🥡 {order.customer?.orderType === 'Barra' ? 'BARRA' : 'LLEVAR'}
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px', flexWrap: 'wrap' }}>
                          <span style={{
                            fontSize: '0.66rem',
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: `${stage.color}15`,
                            color: stage.color,
                            border: `1px solid ${stage.color}40`,
                            display: 'inline-block'
                          }}>
                            {stage.text}
                          </span>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-light)' }}>
                            {new Date(order.date).toLocaleDateString('es-PE')} {new Date(order.date).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: true })}
                          </span>
                        </div>
                        {isDelivery && (
                          <div style={{ marginTop: '5px', display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                            <select
                              aria-label="Asignar repartidor"
                              value={order.assignedDriver?.id || order.assignedDriver?.email || ''}
                              onChange={(e) => handleAssignDriver(order, e.target.value)}
                              style={{
                                fontSize: '0.72rem',
                                padding: '2px 4px',
                                borderRadius: '4px',
                                border: '1px solid var(--delivery-color, #FF441F)',
                                background: 'var(--bg-secondary, #fff)',
                                color: 'var(--text-dark)',
                                maxWidth: '140px'
                              }}
                            >
                              <option value="">🛵 Asignar repartidor...</option>
                              {staffUsers.map(u => (
                                <option key={u.id || u.email} value={u.id || u.email}>
                                  {u.name || u.email} {u.role ? `(${u.role})` : ''}
                                </option>
                              ))}
                            </select>
                            {order.assignedDriver && (
                              <button
                                type="button"
                                className="admin-action-btn"
                                onClick={() => handleDispatchToDriverWhatsApp(order)}
                                style={{
                                  background: '#25D366',
                                  color: '#fff',
                                  fontSize: '0.68rem',
                                  padding: '3px 6px',
                                  borderRadius: '4px',
                                  border: 'none',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '2px'
                                }}
                                title={`Enviar hoja de ruta por WhatsApp a ${order.assignedDriver.name}`}
                              >
                                📲 Despachar
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{order.customer.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>{order.customer.address}</div>
                      </td>
                      <td>
                        <strong style={{ color: 'var(--primary-color)', fontSize: '0.9rem' }}>S/. {order.grandTotal.toFixed(2)}</strong>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', alignItems: 'center' }}>
                          {/* Acciones principales secuenciales adaptadas al canal */}
                          {order.status === 'Por Corroborar' && (
                            <button
                              className="admin-action-btn"
                              style={{ color: '#d35400', fontWeight: 700, background: 'rgba(230,126,34,0.12)', border: '1px solid #e67e22', borderRadius: '6px', padding: '4px 8px' }}
                              onClick={() => handleStatusChange(order, 'Pendiente', `Pedido ${order.id} aceptado y confirmado por ${currentUser?.name}`)}
                              title="Validar datos/pago y enviar a cola de cocina"
                            >
                              ✅ Aceptar Pedido
                            </button>
                          )}
                          {order.status === 'Pendiente' && (
                            <button
                              className="admin-action-btn"
                              style={{ color: '#2980b9', fontWeight: 700, background: 'rgba(41,128,185,0.12)', border: '1px solid #3498db', borderRadius: '6px', padding: '4px 8px' }}
                              onClick={() => handleStatusChange(order, 'Preparando', `Pedido ${order.id} en preparación por ${currentUser?.name}`)}
                              title="Iniciar preparación en cocina o barra"
                            >
                              👨‍🍳 Preparar
                            </button>
                          )}
                          {order.status === 'Preparando' && isDelivery && (
                            <button
                              className="admin-action-btn"
                              style={{ color: '#FF441F', fontWeight: 700, background: 'rgba(255,68,31,0.12)', border: '1px solid #FF441F', borderRadius: '6px', padding: '4px 8px' }}
                              onClick={() => handleStatusChange(order, 'En camino', `Pedido ${order.id} despachado a ruta por ${currentUser?.name}`)}
                              title="Despachar con repartidor a domicilio"
                            >
                              🛵 Enviar a Ruta
                            </button>
                          )}
                          {order.status === 'Preparando' && isMesa && (
                            <button
                              className="admin-action-btn"
                              style={{ color: '#27ae60', fontWeight: 700, background: 'rgba(39,174,96,0.12)', border: '1px solid #2ecc71', borderRadius: '6px', padding: '4px 8px' }}
                              onClick={() => handleStatusChange(order, 'Entregado', `Pedido ${order.id} servido en mesa por ${currentUser?.name}`)}
                              title="Marcar como servido en mesa"
                            >
                              🍽️ Servir a Mesa
                            </button>
                          )}
                          {order.status === 'Preparando' && !isDelivery && !isMesa && (
                            <button
                              className="admin-action-btn"
                              style={{ color: '#27ae60', fontWeight: 700, background: 'rgba(39,174,96,0.12)', border: '1px solid #2ecc71', borderRadius: '6px', padding: '4px 8px' }}
                              onClick={() => handleStatusChange(order, 'Entregado', `Pedido ${order.id} entregado para llevar por ${currentUser?.name}`)}
                              title="Marcar como entregado al cliente"
                            >
                              🥡 Entregar a Cliente
                            </button>
                          )}
                          {order.status === 'En camino' && (
                            <button
                              className="admin-action-btn"
                              style={{ color: '#27ae60', fontWeight: 700, background: 'rgba(39,174,96,0.15)', border: '1px solid #2ecc71', borderRadius: '6px', padding: '4px 8px' }}
                              onClick={() => handleStatusChange(order, 'Entregado', `Pedido ${order.id} completado y entregado por ${currentUser?.name}`)}
                              title="Confirmar recepción del cliente"
                            >
                              🎉 Marcar Entregado
                            </button>
                          )}

                          {/* Selector de Corrección Rápida de Estado */}
                          <select
                            aria-label="Cambiar estado manualmente"
                            value={order.status}
                            onChange={(e) => {
                              const nextVal = e.target.value;
                              if (nextVal !== order.status) {
                                handleStatusChange(order, nextVal, `Estado de pedido ${order.id} cambiado manualmente a '${nextVal}' por ${currentUser?.name}`);
                              }
                            }}
                            style={{
                              fontSize: '0.72rem',
                              padding: '3px 6px',
                              borderRadius: '4px',
                              border: '1px solid var(--border-color)',
                              background: 'var(--bg-secondary, #fff)',
                              color: 'var(--text-dark)',
                              cursor: 'pointer'
                            }}
                            title="Cambiar estado si hubo una equivocación"
                          >
                            <option value="Por Corroborar">⏳ Por Corroborar</option>
                            <option value="Pendiente">📋 Confirmado</option>
                            <option value="Preparando">👨‍🍳 Preparando</option>
                            <option value="En camino">🛵 En camino</option>
                            <option value="Entregado">🎉 Entregado</option>
                            <option value="Cancelado">🛑 Cancelado</option>
                          </select>

                          {order.status !== 'Entregado' && order.status !== 'Cancelado' && (
                            <button 
                              className="admin-action-btn" 
                              style={{ color: 'var(--danger)' }} 
                              onClick={() => { 
                                if (window.confirm(`⚠️ ¿Estás seguro de que deseas CANCELAR el pedido ${order.id} de ${order.customer.name}?`)) {
                                  handleStatusChange(order, 'Cancelado', `Pedido ${order.id} CANCELADO por ${currentUser?.name}`); 
                                }
                              }}
                              title="Cancelar Pedido"
                            >
                              ✕ Cancelar
                            </button>
                          )}
                          {order.status !== 'Cancelado' && (
                            <button
                              type="button"
                              className="admin-action-btn"
                              style={{ color: '#0984e3' }}
                              title="Editar Pedido"
                              onClick={() => handleStartEditingOrder(order)}
                            >
                              ✏️ Editar
                            </button>
                          )}
                          <a 
                            href={`https://wa.me/${String(order.customer.phone || '').replace(/\D/g, '')}`} 
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
                            style={{ color: 'var(--delivery-color, #FF441F)', fontWeight: 600 }}
                            title="Imprimir ticket térmico ESC/POS (58mm / 80mm)"
                            onClick={() => {
                              printThermalTicket({
                                type: isDelivery ? 'delivery' : 'comanda',
                                order,
                                storeName: storeName || 'Friozo',
                                storePhone: storePhone || '',
                                ticketCustomMessage: ticketCustomMessage || ''
                              });
                            }}
                          >
                            🧾 Térmica ESC/POS
                          </button>
                          <button
                            type="button"
                            className="admin-action-btn"
                            style={{ color: '#e58e26' }}
                            title="Imprimir ticket de comanda para la cocina"
                            onClick={() => {
                              const dateStr = new Date(order.date).toLocaleString('es-PE', { 
                                day: '2-digit', month: '2-digit', year: 'numeric', 
                                hour: '2-digit', minute: '2-digit', second: '2-digit' 
                              });
                              
                              const itemsHtml = order.items.map((item, idx) => {
                                const itemPrice = parseFloat(item.price || 0);
                                const itemQuantity = item.quantity || 1;
                                const itemTotal = itemPrice * itemQuantity;
                                if (item.type === 'custom') {
                                  const scoopsStr = item.scoops ? item.scoops.map(s => s.name).join(', ') : 'Ninguno';
                                  const toppingsStr = item.toppings && item.toppings.length > 0 ? item.toppings.map(t => t.name).join(', ') : 'Ninguno';
                                  const syrupStr = item.syrup ? item.syrup.name : 'Ninguna';
                                  return `
                                    <div style="border-bottom: 1px dashed #333; padding: 6px 0; font-family: 'Courier New', Courier, monospace;">
                                      <div style="font-size: 1.05rem; font-weight: bold;">[${idx + 1}] HELADO PERSONALIZADO x ${itemQuantity}</div>
                                      <div style="margin-left: 10px; font-size: 0.9rem; line-height: 1.3;">
                                        • <b>Base:</b> ${item.base ? item.base.name : 'No especificada'}<br/>
                                        • <b>Sabores:</b> ${scoopsStr}<br/>
                                        • <b>Toppings:</b> ${toppingsStr}<br/>
                                        • <b>Salsa:</b> ${syrupStr}<br/>
                                        • <b>Precio:</b> S/. ${itemPrice.toFixed(2)} c/u (Total: S/. ${itemTotal.toFixed(2)})
                                      </div>
                                    </div>
                                  `;
                                } else {
                                  return `
                                    <div style="border-bottom: 1px dashed #333; padding: 6px 0; font-family: 'Courier New', Courier, monospace;">
                                      <div style="font-size: 1.05rem; font-weight: bold;">[${idx + 1}] COMBO/PACK x ${itemQuantity}</div>
                                      <div style="margin-left: 10px; font-size: 0.9rem; line-height: 1.3;">
                                        • <b>Nombre:</b> ${item.name}<br/>
                                        • <b>Contenido:</b> ${item.items || 'Pack promocional'}<br/>
                                        • <b>Precio:</b> S/. ${itemPrice.toFixed(2)} c/u (Total: S/. ${itemTotal.toFixed(2)})
                                      </div>
                                    </div>
                                  `;
                                }
                              }).join('');

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
                                    <title>Comanda - ${order.id}</title>
                                    <style>
                                      @media print {
                                        @page { size: auto; margin: 0mm; }
                                        body { margin: 0; }
                                      }
                                      body { 
                                        font-family: 'Courier New', Courier, monospace; 
                                        width: 260px; 
                                        margin: 0 auto; 
                                        padding: 8px; 
                                        color: #000;
                                        background: #fff;
                                        font-size: 11px;
                                        line-height: 1.3;
                                      }
                                      .header { text-align: center; border-bottom: 2px double #000; padding-bottom: 6px; margin-bottom: 8px; }
                                      .title { font-size: 1.3rem; font-weight: bold; margin: 3px 0; letter-spacing: 1px; }
                                      .section-title { font-size: 0.95rem; font-weight: bold; border-bottom: 1px solid #000; border-top: 1px solid #000; padding: 4px 0; margin-top: 8px; text-align: center; }
                                      .totals-table { width: 100%; border-collapse: collapse; margin-top: 8px; font-family: 'Courier New', Courier, monospace; font-size: 0.9rem; }
                                      .totals-table td { padding: 2px 0; }
                                      .footer { text-align: center; margin-top: 15px; border-top: 1px dashed #000; padding-top: 8px; font-size: 0.8rem; }
                                    </style>
                                  </head>
                                  <body>
                                    <div class="header">
                                      <div style="font-size: 1.15rem; font-weight: bold;">🍦 ${storeName.toUpperCase()} 🍦</div>
                                      <div class="title">PEDIDO: ${order.id}</div>
                                      <div style="font-size: 0.8rem;">Fecha: ${dateStr}</div>
                                    </div>

                                    <div style="margin-bottom: 8px; font-size: 0.9rem; border-bottom: 1px dashed #000; padding-bottom: 6px;">
                                      <b>CLIENTE:</b> ${order.customer.name}<br/>
                                      <b>TELÉFONO:</b> ${order.customer.phone}<br/>
                                      <b>PAGO:</b> ${order.customer.paymentMethod || 'Yape/Plin'}<br/>
                                      <b>DIRECCIÓN:</b> ${order.customer.address}
                                    </div>

                                    <div class="section-title">🍨 DETALLE DEL PEDIDO 🍨</div>
                                    <div style="margin-top: 4px;">
                                      ${itemsHtml}
                                    </div>

                                    <table class="totals-table">
                                      <tr>
                                        <td>Subtotal:</td>
                                        <td style="text-align: right;">S/. ${(order.total || 0).toFixed(2)}</td>
                                      </tr>
                                      ${(order.discount && order.discount > 0) ? `
                                      <tr>
                                        <td>Descuento ${order.couponCode ? `(${order.couponCode})` : ''}:</td>
                                        <td style="text-align: right;">-S/. ${(order.discount || 0).toFixed(2)}</td>
                                      </tr>
                                      ` : ''}
                                      <tr>
                                        <td>Envío:</td>
                                        <td style="text-align: right;">S/. ${(order.deliveryFee || 0).toFixed(2)}</td>
                                      </tr>
                                      <tr style="font-weight: bold; border-top: 1px double #000; font-size: 1rem;">
                                        <td style="padding-top: 4px;">TOTAL A PAGAR:</td>
                                        <td style="text-align: right; padding-top: 4px;">S/. ${(order.grandTotal || 0).toFixed(2)}</td>
                                      </tr>
                                    </table>

                                    <div class="footer">
                                      <div style="font-weight: bold; font-size: 0.85rem; margin-bottom: 4px;">⚠️ ¡ATENCIÓN COCINA / REPARTO!</div>
                                      <div style="margin-bottom: 8px; font-size: 0.75rem;">Mantener cadena de frío. Entregar con máxima higiene.</div>
                                      ${ticketCustomMessage ? `<div style="margin-top: 6px; font-size: 0.8rem; font-style: italic; font-weight: bold; border-top: 1px dashed #000; padding-top: 6px; color: #111;">${ticketCustomMessage}</div>` : ''}
                                      <div style="margin-top: 8px; font-size: 0.7rem; color: #555;">Impreso desde el panel de Friozo.</div>
                                    </div>
                                  </body>
                                </html>
                              `);
                              doc.close();

                              printFrame.contentWindow.focus();
                              printFrame.contentWindow.print();
                              setTimeout(() => {
                                document.body.removeChild(printFrame);
                              }, 1000);

                              addLog(`Comanda de Cocina impresa para el pedido ${order.id}.`);
                            }}
                          >
                            🖨️ Ticket
                          </button>
                        </div>
                      </td>
                    </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* VISTA DE ENCUESTAS */
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', flexWrap: 'wrap', gap: '10px' }}>
            <h3 style={{ margin: 0 }}>⭐ Encuestas de Satisfacción de Clientes ({filteredSurveys.length})</h3>
            <div style={{ display: 'flex', gap: '5px' }}>
              {['all', 'low', 'high'].map(f => (
                <button
                  key={f}
                  type="button"
                  className={`filter-btn ${ratingFilter === f ? 'active' : ''}`}
                  onClick={() => setRatingFilter(f)}
                  style={{ fontSize: '0.75rem', padding: '5px 10px' }}
                >
                  {f === 'all' && 'Todas'}
                  {f === 'low' && 'Críticas (1-3 🍦)'}
                  {f === 'high' && 'Excelentes (4-5 🍦)'}
                </button>
              ))}
            </div>
          </div>

          {filteredSurveys.length === 0 ? (
            <div className="glass" style={{ padding: '30px', textAlign: 'center', color: 'var(--text-light)' }}>
              <span style={{ fontSize: '3rem', display: 'block', marginBottom: '10px' }}>🍦📋</span>
              <strong>No se encontraron encuestas</strong>
              <p style={{ fontSize: '0.8rem', marginTop: '6px', margin: 0 }}>
                Las opiniones de los clientes aparecerán aquí cuando califiquen su pedido entregado.
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '15px' }}>
              {filteredSurveys.map(order => {
                const cleanPhone = String(order.customer.phone || '').replace(/\D/g, '');
                const waUrl = cleanPhone ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(`Hola ${order.customer.name}, nos comunicamos de ${storeName} con relación a tu pedido ${order.id}...`)}` : null;
                
                const surveyDateStr = order.survey.date 
                  ? new Date(order.survey.date).toLocaleString('es-PE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) 
                  : 'Reciente';

                return (
                  <div key={order.id} className="glass" style={{ 
                    padding: '15px', 
                    borderLeft: `5px solid ${order.survey.rating <= 3 ? 'var(--danger)' : 'var(--success)'}`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    boxShadow: 'var(--shadow-sm)',
                    position: 'relative'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ color: 'var(--primary-color)', fontSize: '0.95rem' }}>{order.id}</strong>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-light)' }}>🕒 {surveyDateStr}</span>
                    </div>

                    <div style={{ display: 'flex', gap: '4px', fontSize: '1.2rem', color: '#ff6b81', margin: '2px 0' }}>
                      {[1, 2, 3, 4, 5].map(idx => (
                        <span key={idx} style={{ filter: idx <= order.survey.rating ? 'none' : 'grayscale(100%) opacity(20%)' }}>🍦</span>
                      ))}
                      <strong style={{ fontSize: '0.8rem', color: 'var(--text-dark)', marginLeft: '6px', alignSelf: 'center' }}>
                        ({order.survey.rating}/5)
                      </strong>
                    </div>

                    {order.survey.comment && (
                      <div style={{ 
                        background: 'rgba(0,0,0,0.015)', 
                        padding: '8px 10px', 
                        borderRadius: '6px', 
                        fontSize: '0.8rem', 
                        fontStyle: 'italic', 
                        lineHeight: '1.4', 
                        borderLeft: '2px solid var(--border-color)',
                        color: 'var(--text-dark)'
                      }}>
                        "{order.survey.comment}"
                      </div>
                    )}

                    <div style={{ fontSize: '0.78rem', color: 'var(--text-light)', borderTop: '1px solid rgba(0,0,0,0.05)', paddingTop: '8px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <div>👤 <b>Cliente:</b> {order.customer.name}</div>
                      {order.customer.phone && <div>📞 <b>Teléfono:</b> {order.customer.phone}</div>}
                      <div>📍 <b>Dirección:</b> {order.customer.address}</div>
                      <div>🛵 <b>Estado Pedido:</b> {order.status}</div>
                    </div>

                    {waUrl && (
                      <div style={{ marginTop: 'auto', paddingTop: '10px' }}>
                        <a 
                          href={waUrl} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="btn btn-secondary" 
                          style={{ 
                            width: '100%', 
                            padding: '6px', 
                            fontSize: '0.75rem', 
                            display: 'inline-flex', 
                            alignItems: 'center', 
                            justifyContent: 'center', 
                            gap: '4px', 
                            backgroundColor: '#25D366', 
                            borderColor: '#25D366', 
                            color: 'white',
                            borderRadius: '6px',
                            textDecoration: 'none',
                            fontWeight: '600'
                          }}
                        >
                          💬 Contactar por WhatsApp
                        </a>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
