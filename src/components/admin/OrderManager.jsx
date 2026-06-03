import React, { useState, useEffect } from 'react';

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
  ticketCustomMessage,
  addLog,
  currentUser,
  showAlert,
  activeSubTab: activeSubTabProp
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

  const todayStr = new Date().toDateString();
  const kpis = {
    toCorroborate: orders.filter(o => o.status === 'Por Corroborar').length,
    pending: orders.filter(o => o.status === 'Pendiente').length,
    preparing: orders.filter(o => o.status === 'Preparando').length,
    delivery: orders.filter(o => o.status === 'En camino').length,
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

          {/* Tarjetas KPI */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px', marginBottom: '20px' }}>
            <div className="glass" style={{ padding: '12px 15px', borderRadius: '12px', borderLeft: '4px solid #e67e22', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '1.2rem' }}>⏳</span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-light)', fontWeight: 'bold', textTransform: 'uppercase' }}>Por Corroborar</span>
              <strong style={{ fontSize: '1.3rem', color: '#e67e22' }}>{kpis.toCorroborate}</strong>
            </div>
            <div className="glass" style={{ padding: '12px 15px', borderRadius: '12px', borderLeft: '4px solid var(--secondary-color)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '1.2rem' }}>📋</span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-light)', fontWeight: 'bold', textTransform: 'uppercase' }}>Pendientes</span>
              <strong style={{ fontSize: '1.3rem', color: 'var(--text-dark)' }}>{kpis.pending}</strong>
            </div>
            <div className="glass" style={{ padding: '12px 15px', borderRadius: '12px', borderLeft: '4px solid #3498db', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '1.2rem' }}>🍳</span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-light)', fontWeight: 'bold', textTransform: 'uppercase' }}>Preparando</span>
              <strong style={{ fontSize: '1.3rem', color: 'var(--text-dark)' }}>{kpis.preparing}</strong>
            </div>
            <div className="glass" style={{ padding: '12px 15px', borderRadius: '12px', borderLeft: '4px solid #9b59b6', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '1.2rem' }}>🛵</span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-light)', fontWeight: 'bold', textTransform: 'uppercase' }}>En camino</span>
              <strong style={{ fontSize: '1.3rem', color: 'var(--text-dark)' }}>{kpis.delivery}</strong>
            </div>
            <div className="glass" style={{ padding: '12px 15px', borderRadius: '12px', borderLeft: '4px solid var(--success)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '1.2rem' }}>💰</span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-light)', fontWeight: 'bold', textTransform: 'uppercase' }}>Ventas Hoy</span>
              <strong style={{ fontSize: '1.2rem', color: 'var(--success)' }}>S/. {kpis.todaySales.toFixed(2)}</strong>
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
                  displayedOrders.map(order => (
                    <tr key={order.id}>
                      <td>
                        <strong>{order.id}</strong>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-light)', marginTop: '2px' }}>
                          {new Date(order.date).toLocaleDateString('es-PE')} {new Date(order.date).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: true })}
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
                          {order.status === 'Por Corroborar' && (
                            <button className="admin-action-btn" style={{ color: '#e67e22', fontWeight: 'bold' }} onClick={() => { onUpdateOrderStatus(order.id, 'Pendiente'); addLog(`Pedido ${order.id} corroborado por ${currentUser?.name}`); }}>
                              ✅ Corroborar
                            </button>
                          )}
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
                            <button 
                              className="admin-action-btn" 
                              style={{ color: 'var(--danger)' }} 
                              onClick={() => { 
                                if (window.confirm(`⚠️ ¿Estás seguro de que deseas CANCELAR el pedido ${order.id} de ${order.customer.name}?`)) {
                                  onUpdateOrderStatus(order.id, 'Cancelado'); 
                                  addLog(`Pedido ${order.id} CANCELADO por ${currentUser?.name}`); 
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
                                      <div style="margin-top: 8px; font-size: 0.7rem; color: #555;">Impreso desde Panel Don Helado.</div>
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
                  ))
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
