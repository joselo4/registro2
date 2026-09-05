import React, { useState, useMemo } from 'react';

/**
 * CustomerCRM - Módulo de Gestión y Fidelización de Clientes para Helados Friozo
 * Permite a operadores y administradores ver perfiles de clientes, valor total de vida (LTV),
 * historial de compras, notas internas, y contactar en 1-clic por WhatsApp.
 */
export default function CustomerCRM({ orders = [], storeName = 'Friozo', showAlert }) {
  const [search, setSearch] = useState('');
  const [selectedSegment, setSelectedSegment] = useState('all'); // all, vip, frequent, new, inactive
  const [sortBy, setSortBy] = useState('ltv_desc'); // ltv_desc, orders_desc, date_desc, name_asc
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  // Notas de clientes guardadas en localStorage
  const [notes, setNotes] = useState(() => {
    try {
      const saved = localStorage.getItem('friozo_crm_customer_notes');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const handleSaveNote = (customerKey, noteText) => {
    const updated = { ...notes, [customerKey]: noteText };
    setNotes(updated);
    try {
      localStorage.setItem('friozo_crm_customer_notes', JSON.stringify(updated));
    } catch (e) {
      console.warn('No se pudo guardar la nota del cliente:', e);
    }
  };

  // Normalización y agregación de clientes a partir de las órdenes
  const customers = useMemo(() => {
    const map = new Map();
    const now = Date.now();

    (orders || []).forEach(order => {
      const c = order.customer || {};
      const rawPhone = String(c.phone || '').trim();
      const cleanPhone = rawPhone.replace(/\D/g, '');
      const rawName = String(c.name || 'Cliente sin nombre').trim();

      // Clave única: teléfono si existe, o nombre en minúsculas
      const key = cleanPhone ? `phone_${cleanPhone}` : `name_${rawName.toLowerCase()}`;

      if (!map.has(key)) {
        map.set(key, {
          key,
          name: rawName,
          phone: rawPhone,
          cleanPhone,
          address: c.address || '',
          totalOrders: 0,
          cancelledOrders: 0,
          totalSpent: 0,
          firstOrderDate: order.date,
          lastOrderDate: order.date,
          orders: [],
          itemCounts: {},
          favoriteItem: ''
        });
      }

      const client = map.get(key);
      if (order.status === 'Cancelado') {
        client.cancelledOrders += 1;
      } else {
        client.totalOrders += 1;
        client.totalSpent += (Number(order.grandTotal) || 0);
      }

      // Actualizar fechas
      const oDate = new Date(order.date).getTime();
      if (new Date(client.lastOrderDate).getTime() < oDate) {
        client.lastOrderDate = order.date;
        if (c.address) client.address = c.address;
        if (rawName && rawName !== 'Cliente sin nombre') client.name = rawName;
      }
      if (new Date(client.firstOrderDate).getTime() > oDate) {
        client.firstOrderDate = order.date;
      }

      // Conteo de productos favoritos
      (order.items || []).forEach(item => {
        const iName = item.name || 'Helado';
        client.itemCounts[iName] = (client.itemCounts[iName] || 0) + (item.quantity || 1);
      });

      client.orders.push(order);
    });

    const list = Array.from(map.values()).map(c => {
      // Determinar favorito
      const sortedFavs = Object.entries(c.itemCounts).sort((a, b) => b[1] - a[1]);
      c.favoriteItem = sortedFavs[0] ? sortedFavs[0][0] : 'Helado Clásico';

      // Calcular ticket promedio
      c.avgTicket = c.totalOrders > 0 ? (c.totalSpent / c.totalOrders) : 0;

      // Calcular días desde última compra
      const lastMs = new Date(c.lastOrderDate).getTime();
      const daysAgo = Math.floor((now - lastMs) / (1000 * 60 * 60 * 24));
      c.daysSinceLast = Math.max(0, daysAgo);

      // Determinar segmento
      if (c.totalSpent >= 80 || c.totalOrders >= 5) {
        c.segment = 'vip';
        c.segmentLabel = '🌟 VIP';
        c.segmentColor = '#f39c12';
      } else if (c.totalOrders >= 2) {
        c.segment = 'frequent';
        c.segmentLabel = '🔄 Frecuente';
        c.segmentColor = '#27ae60';
      } else if (c.totalOrders === 1 && c.daysSinceLast <= 20) {
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
  }, [orders]);

  // Métricas generales de clientes
  const metrics = useMemo(() => {
    const totalClients = customers.length;
    const totalLtv = customers.reduce((sum, c) => sum + c.totalSpent, 0);
    const vipCount = customers.filter(c => c.segment === 'vip').length;
    const frequentCount = customers.filter(c => c.segment === 'frequent').length;
    const globalAvgTicket = totalClients > 0 ? (totalLtv / Math.max(1, customers.reduce((s, c) => s + c.totalOrders, 0))) : 0;

    return {
      totalClients,
      totalLtv,
      vipCount,
      frequentCount,
      globalAvgTicket
    };
  }, [customers]);

  // Filtrado y ordenamiento
  const filteredCustomers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return customers
      .filter(c => {
        if (selectedSegment !== 'all' && c.segment !== selectedSegment) return false;
        if (!query) return true;
        return (
          c.name.toLowerCase().includes(query) ||
          c.phone.toLowerCase().includes(query) ||
          c.address.toLowerCase().includes(query) ||
          c.favoriteItem.toLowerCase().includes(query)
        );
      })
      .sort((a, b) => {
        if (sortBy === 'ltv_desc') return b.totalSpent - a.totalSpent;
        if (sortBy === 'orders_desc') return b.totalOrders - a.totalOrders;
        if (sortBy === 'date_desc') return new Date(b.lastOrderDate).getTime() - new Date(a.lastOrderDate).getTime();
        if (sortBy === 'name_asc') return a.name.localeCompare(b.name);
        return 0;
      });
  }, [customers, search, selectedSegment, sortBy]);

  // Acción rápida de WhatsApp
  const handleOpenWhatsApp = (customer) => {
    if (!customer.cleanPhone) {
      if (showAlert) showAlert('Sin Teléfono', 'Este cliente no tiene un teléfono registrado.', 'warning');
      else alert('Este cliente no tiene un teléfono registrado.');
      return;
    }

    let phone = customer.cleanPhone;
    if (phone.length === 9 && !phone.startsWith('51')) {
      phone = `51${phone}`;
    }

    const greetingName = customer.name !== 'Cliente sin nombre' ? customer.name.split(' ')[0] : 'amig@';
    const favText = customer.favoriteItem ? ` tu favorito *${customer.favoriteItem}*` : ' nuestros helados artesanales';
    const message = `¡Hola ${greetingName}! Te saludamos de Helados ${storeName} 🍨.\n¿Te gustaría disfrutar hoy de${favText}? Tenemos delivery activo para llevártelo fresquito a tu puerta. 🛵💨\n\n¿Deseas que te enviemos la carta del día?`;

    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  // Exportar listado a CSV
  const handleExportCSV = () => {
    if (customers.length === 0) {
      if (showAlert) showAlert('Sin Datos', 'No hay clientes registrados para exportar.', 'info');
      else alert('No hay clientes registrados para exportar.');
      return;
    }

    let csv = '\uFEFF';
    csv += 'Nombre,Telefono,Segmento,Pedidos Completados,Inversion Total (S/.),Ticket Promedio (S/.),Ultima Compra,Direccion,Producto Favorito\n';
    
    customers.forEach(c => {
      const cleanName = `"${c.name.replace(/"/g, '""')}"`;
      const phone = `"${c.phone}"`;
      const seg = `"${c.segmentLabel}"`;
      const addr = `"${c.address.replace(/"/g, '""')}"`;
      const fav = `"${c.favoriteItem.replace(/"/g, '""')}"`;
      const date = `"${new Date(c.lastOrderDate).toLocaleDateString('es-PE')}"`;

      csv += `${cleanName},${phone},${seg},${c.totalOrders},${c.totalSpent.toFixed(2)},${c.avgTicket.toFixed(2)},${date},${addr},${fav}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `directorio_clientes_friozo_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Encabezado y Métricas */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '15px'
      }}>
        <div>
          <h2 style={{ margin: 0, color: 'var(--text-dark)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            📇 CRM y Fidelización de Clientes
          </h2>
          <p style={{ margin: '4px 0 0', color: 'var(--text-light)', fontSize: '0.9rem' }}>
            Historial de compra, recurrencia (LTV) y contacto directo por WhatsApp con tus clientes.
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          className="btn btn-secondary"
          style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}
        >
          📥 Exportar Directorio CSV
        </button>
      </div>

      {/* Tarjetas KPI */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
        gap: '12px'
      }}>
        <div className="glass-card" style={{ padding: '14px', borderRadius: '12px' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-light)', textTransform: 'uppercase', fontWeight: 600 }}>
            Clientes Totales
          </span>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-dark)', marginTop: '4px' }}>
            {metrics.totalClients}
          </div>
          <span style={{ fontSize: '0.72rem', color: 'var(--primary-color)' }}>Registrados por pedidos</span>
        </div>

        <div className="glass-card" style={{ padding: '14px', borderRadius: '12px' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-light)', textTransform: 'uppercase', fontWeight: 600 }}>
            Inversión Acumulada (LTV)
          </span>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#27ae60', marginTop: '4px' }}>
            S/ {metrics.totalLtv.toFixed(2)}
          </div>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-light)' }}>Ventas generadas</span>
        </div>

        <div className="glass-card" style={{ padding: '14px', borderRadius: '12px' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-light)', textTransform: 'uppercase', fontWeight: 600 }}>
            Clientes VIP
          </span>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f39c12', marginTop: '4px' }}>
            {metrics.vipCount}
          </div>
          <span style={{ fontSize: '0.72rem', color: '#f39c12' }}>Mayor recurrencia</span>
        </div>

        <div className="glass-card" style={{ padding: '14px', borderRadius: '12px' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-light)', textTransform: 'uppercase', fontWeight: 600 }}>
            Clientes Frecuentes
          </span>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#2980b9', marginTop: '4px' }}>
            {metrics.frequentCount}
          </div>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-light)' }}>≥ 2 pedidos</span>
        </div>

        <div className="glass-card" style={{ padding: '14px', borderRadius: '12px' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-light)', textTransform: 'uppercase', fontWeight: 600 }}>
            Ticket Promedio
          </span>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary-color)', marginTop: '4px' }}>
            S/ {metrics.globalAvgTicket.toFixed(2)}
          </div>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-light)' }}>Por pedido</span>
        </div>
      </div>

      {/* Controles de Búsqueda y Segmentación */}
      <div className="glass-card" style={{ padding: '16px', borderRadius: '14px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ flex: '1 1 250px', position: 'relative' }}>
            <input
              type="text"
              className="form-control"
              placeholder="🔍 Buscar cliente por nombre, teléfono, dirección..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: '12px', fontSize: '0.9rem' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontSize: '0.82rem', color: 'var(--text-light)', fontWeight: 600, margin: 0 }}>
              Ordenar por:
            </label>
            <select
              className="form-control"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              style={{ width: 'auto', padding: '6px 12px', fontSize: '0.85rem' }}
            >
              <option value="ltv_desc">💰 Mayor Inversión (LTV)</option>
              <option value="orders_desc">📦 Más Pedidos</option>
              <option value="date_desc">🗓️ Última Compra</option>
              <option value="name_asc">🔤 Nombre (A - Z)</option>
            </select>
          </div>
        </div>

        {/* Filtro por Segmentos */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-light)', marginRight: '4px' }}>
            Segmento:
          </span>
          {[
            { id: 'all', label: `Todos (${customers.length})` },
            { id: 'vip', label: `🌟 VIP (${metrics.vipCount})` },
            { id: 'frequent', label: `🔄 Frecuentes (${metrics.frequentCount})` },
            { id: 'new', label: `🌱 Nuevos (${customers.filter(c => c.segment === 'new').length})` },
            { id: 'inactive', label: `💤 Inactivos (${customers.filter(c => c.segment === 'inactive').length})` }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setSelectedSegment(tab.id)}
              style={{
                border: 'none',
                background: selectedSegment === tab.id ? 'var(--primary-color)' : 'var(--bg-secondary)',
                color: selectedSegment === tab.id ? '#ffffff' : 'var(--text-dark)',
                padding: '6px 12px',
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

      {/* Listado de Clientes */}
      {filteredCustomers.length === 0 ? (
        <div className="glass-card" style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-light)' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '10px' }}>🔍</div>
          <p style={{ margin: 0, fontWeight: 600 }}>No se encontraron clientes con el filtro seleccionado.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '14px' }}>
          {filteredCustomers.map(customer => {
            const customerKey = customer.key;
            const currentNote = notes[customerKey] || '';

            return (
              <div
                key={customer.key}
                className="glass-card"
                style={{
                  padding: '16px',
                  borderRadius: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  border: '1px solid var(--border-color)',
                  position: 'relative'
                }}
              >
                {/* Cabecera del Cliente */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, var(--primary-color) 0%, var(--secondary-color) 100%)',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      fontSize: '1rem',
                      flexShrink: 0
                    }}>
                      {customer.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-dark)' }}>
                        {customer.name}
                      </h4>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-light)', marginTop: '2px' }}>
                        📞 {customer.phone || 'Sin número registrado'}
                      </div>
                    </div>
                  </div>

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
                </div>

                {/* Estadísticas de Compra */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr',
                  background: 'var(--bg-secondary)',
                  borderRadius: '10px',
                  padding: '8px 10px',
                  textAlign: 'center',
                  gap: '6px'
                }}>
                  <div>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-light)', display: 'block' }}>Pedidos</span>
                    <strong style={{ fontSize: '0.88rem', color: 'var(--text-dark)' }}>{customer.totalOrders}</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-light)', display: 'block' }}>Inversión (LTV)</span>
                    <strong style={{ fontSize: '0.88rem', color: '#27ae60' }}>S/ {customer.totalSpent.toFixed(2)}</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-light)', display: 'block' }}>Ticket Prom.</span>
                    <strong style={{ fontSize: '0.88rem', color: 'var(--primary-color)' }}>S/ {customer.avgTicket.toFixed(2)}</strong>
                  </div>
                </div>

                {/* Detalles adicionales */}
                <div style={{ fontSize: '0.78rem', color: 'var(--text-light)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {customer.favoriteItem && (
                    <div>
                      🍦 <strong>Favorito:</strong> {customer.favoriteItem}
                    </div>
                  )}
                  {customer.address && (
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      📍 <strong>Dirección:</strong> {customer.address}
                    </div>
                  )}
                  <div>
                    🗓️ <strong>Última compra:</strong> {new Date(customer.lastOrderDate).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })} ({customer.daysSinceLast === 0 ? 'Hoy' : `Hace ${customer.daysSinceLast} día(s)`})
                  </div>
                </div>

                {/* Nota rápida de operador */}
                <div style={{ marginTop: 'auto' }}>
                  <input
                    type="text"
                    placeholder="📝 Nota rápida (ej: timbre malogrado)..."
                    value={currentNote}
                    onChange={(e) => handleSaveNote(customerKey, e.target.value)}
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

                {/* Acciones del Cliente */}
                <div style={{ display: 'flex', gap: '8px', paddingTop: '4px' }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => handleOpenWhatsApp(customer)}
                    disabled={!customer.cleanPhone}
                    style={{
                      flex: 1,
                      padding: '8px 10px',
                      fontSize: '0.78rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '5px',
                      backgroundColor: '#25D366',
                      borderColor: '#25D366',
                      color: '#ffffff'
                    }}
                  >
                    💬 Contactar WhatsApp
                  </button>

                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setSelectedCustomer(customer)}
                    style={{
                      padding: '8px 12px',
                      fontSize: '0.78rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    📜 Ver Pedidos ({customer.orders.length})
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal / Historial de Pedidos del Cliente */}
      {selectedCustomer && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div className="glass-card" style={{
            width: '100%',
            maxWidth: '650px',
            maxHeight: '85vh',
            overflowY: 'auto',
            borderRadius: '16px',
            padding: '24px',
            background: 'var(--bg-primary, #ffffff)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, color: 'var(--text-dark)' }}>
                  📜 Historial de {selectedCustomer.name}
                </h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-light)' }}>
                  📞 {selectedCustomer.phone} • {selectedCustomer.orders.length} pedidos registrados
                </span>
              </div>
              <button
                onClick={() => setSelectedCustomer(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.2rem',
                  cursor: 'pointer',
                  color: 'var(--text-light)'
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {selectedCustomer.orders.map(order => (
                <div
                  key={order.id}
                  style={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '10px',
                    padding: '12px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <strong>{order.id}</strong>
                    <span style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '8px',
                      backgroundColor: order.status === 'Cancelado' ? '#e74c3c20' : '#2ecc7120',
                      color: order.status === 'Cancelado' ? '#e74c3c' : '#27ae60'
                    }}>
                      {order.status}
                    </span>
                  </div>

                  <div style={{ fontSize: '0.78rem', color: 'var(--text-light)', marginBottom: '6px' }}>
                    🗓️ {new Date(order.date).toLocaleString('es-PE')} • 💳 {order.paymentMethod || 'Efectivo'}
                  </div>

                  <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '0.8rem', color: 'var(--text-dark)' }}>
                    {(order.items || []).map((item, idx) => (
                      <li key={idx}>
                        {item.quantity || 1}x {item.name || 'Helado'} - S/ {(Number(item.price || 0) * (item.quantity || 1)).toFixed(2)}
                      </li>
                    ))}
                  </ul>

                  <div style={{ textAlign: 'right', marginTop: '6px', fontWeight: 700, color: 'var(--primary-color)', fontSize: '0.88rem' }}>
                    Total: S/ {(Number(order.grandTotal) || 0).toFixed(2)}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: '20px', textAlign: 'right' }}>
              <button
                className="btn btn-secondary"
                onClick={() => setSelectedCustomer(null)}
                style={{ padding: '8px 16px' }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
