import React, { useState } from 'react';

export default function CartSettlementManager({
  settlements = [],
  onUpdateSettlements,
  popsicles = [],
  flavors = [],
  currentUser,
  cartLocations = [],
  addLog,
  showAlert
}) {
  const [activeTab, setActiveTab] = useState('new'); // 'new' | 'history' | 'alerts'
  const [selectedCartLabel, setSelectedCartLabel] = useState(() => {
    return cartLocations[0]?.label || 'Carrito 1';
  });
  const [vendorName, setVendorName] = useState(currentUser?.name || '');

  // Productos para liquidar: paletas y conos
  const initialItems = [
    ...(popsicles || []).map(p => ({ id: `pop_${p.id}`, name: `Paleta ${p.name}`, price: Number(p.price) || 5, loaded: 0, returned: 0 })),
    { id: 'cone_single', name: 'Conos Simples (1 Bola)', price: 6, loaded: 0, returned: 0 },
    { id: 'cone_double', name: 'Conos Dobles (2 Bolas)', price: 10, loaded: 0, returned: 0 }
  ];

  const [itemsToSettle, setItemsToSettle] = useState(initialItems);
  const [settlementNotes, setSettlementNotes] = useState('');

  // Alertas rápidas de "Sin Stock" emitidas desde la calle
  const [outOfStockItem, setOutOfStockItem] = useState('');
  const [outOfStockNotes, setOutOfStockNotes] = useState('');
  const [activeAlerts, setActiveAlerts] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('friozo_cart_stock_alerts') || '[]');
    } catch {
      return [];
    }
  });

  const handleItemLoadedChange = (id, val) => {
    setItemsToSettle(prev => prev.map(item => item.id === id ? { ...item, loaded: Math.max(0, parseInt(val, 10) || 0) } : item));
  };

  const handleItemReturnedChange = (id, val) => {
    setItemsToSettle(prev => prev.map(item => item.id === id ? { ...item, returned: Math.max(0, parseInt(val, 10) || 0) } : item));
  };

  // Cálculos automáticos de liquidación
  const totalSoldUnits = itemsToSettle.reduce((sum, it) => sum + Math.max(0, it.loaded - it.returned), 0);
  const totalMoneyToHandOver = itemsToSettle.reduce((sum, it) => {
    const sold = Math.max(0, it.loaded - it.returned);
    return sum + (sold * it.price);
  }, 0);

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
      totalUnits: totalSoldUnits,
      totalAmount: totalMoneyToHandOver,
      notes: settlementNotes,
      details: itemsToSettle.filter(it => it.loaded > 0).map(it => ({
        name: it.name,
        loaded: it.loaded,
        returned: it.returned,
        sold: Math.max(0, it.loaded - it.returned),
        price: it.price,
        subtotal: Math.max(0, it.loaded - it.returned) * it.price
      }))
    };

    const nextSettlements = [newRecord, ...(settlements || [])];
    onUpdateSettlements(nextSettlements);
    addLog?.(`Liquidación de Carrito guardada: ${selectedCartLabel} por ${newRecord.vendorName}. Total a rendir: S/ ${totalMoneyToHandOver.toFixed(2)}.`);

    // Limpiar formulario
    setItemsToSettle(initialItems);
    setSettlementNotes('');
    setActiveTab('history');
    if (showAlert) {
      showAlert('Liquidación Guardada', `Se liquidó el carrito exitosamente. Total a rendir en caja: S/ ${totalMoneyToHandOver.toFixed(2)}.`, 'success');
    }
  };

  // Emitir alerta "Sin Stock" rápida
  const handleSendOutOfStockAlert = (e) => {
    e.preventDefault();
    if (!outOfStockItem.trim()) return;

    const alertItem = {
      id: `ALT-${Date.now().toString().slice(-4)}`,
      timestamp: new Date().toISOString(),
      cartLabel: selectedCartLabel,
      vendorName: vendorName || currentUser?.name || 'Vendedor',
      item: outOfStockItem.trim(),
      notes: outOfStockNotes.trim()
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
      showAlert('Alerta Emitida a Central', `Se notificó que ${alertItem.cartLabel} no tiene stock de ${alertItem.item}.`, 'warning');
    }
  };

  const handleResolveAlert = (alertId) => {
    const nextAlerts = activeAlerts.filter(a => a.id !== alertId);
    setActiveAlerts(nextAlerts);
    try {
      localStorage.setItem('friozo_cart_stock_alerts', JSON.stringify(nextAlerts));
    } catch {}
    if (showAlert) showAlert('Alerta Resuelta', 'Se marcó la alerta como atendida/reabastecida.', 'info');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Cabecera */}
      <div className="glass" style={{ padding: '16px 20px', borderRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '1.8rem' }}>🛒</span>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.2rem' }}>Liquidación de Carritos y Control de Ruta</h3>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-light)' }}>
              Carga matutina vs. retorno al cierre: Total Cargado - Retorno = Ventas = Dinero a Rendir.
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className={`btn ${activeTab === 'new' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '6px 14px', fontSize: '0.78rem' }}
            onClick={() => setActiveTab('new')}
          >
            ➕ Nueva Liquidación
          </button>
          <button
            className={`btn ${activeTab === 'alerts' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '6px 14px', fontSize: '0.78rem', position: 'relative' }}
            onClick={() => setActiveTab('alerts')}
          >
            ⚠️ Alertas Sin Stock {activeAlerts.length > 0 && `(${activeAlerts.length})`}
          </button>
          <button
            className={`btn ${activeTab === 'history' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '6px 14px', fontSize: '0.78rem' }}
            onClick={() => setActiveTab('history')}
          >
            📜 Historial ({settlements.length})
          </button>
        </div>
      </div>

      {/* PESTAÑA 1: NUEVA LIQUIDACIÓN */}
      {activeTab === 'new' && (
        <form onSubmit={handleSaveSettlement} className="glass" style={{ padding: '22px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
            <div className="form-group">
              <label style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Carrito o Punto de Venta</label>
              <input
                type="text"
                className="form-control"
                value={selectedCartLabel}
                onChange={(e) => setSelectedCartLabel(e.target.value)}
                placeholder="Ej: Carrito Malecón / Carrito Plaza"
                required
              />
            </div>
            <div className="form-group">
              <label style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Nombre del Vendedor / Operador</label>
              <input
                type="text"
                className="form-control"
                value={vendorName}
                onChange={(e) => setVendorName(e.target.value)}
                placeholder="Nombre del personal a cargo"
                required
              />
            </div>
          </div>

          {/* Tabla de Conteo Carga vs Retorno */}
          <div className="admin-table-container">
            <table className="admin-table" style={{ fontSize: '0.82rem' }}>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th style={{ width: '90px', textAlign: 'center' }}>Precio Unit.</th>
                  <th style={{ width: '110px', textAlign: 'center' }}>Carga Matutina</th>
                  <th style={{ width: '110px', textAlign: 'center' }}>Retorno Cierre</th>
                  <th style={{ width: '100px', textAlign: 'center' }}>Vendidos</th>
                  <th style={{ width: '110px', textAlign: 'right' }}>Subtotal Rendir</th>
                </tr>
              </thead>
              <tbody>
                {itemsToSettle.map(item => {
                  const sold = Math.max(0, item.loaded - item.returned);
                  const subtotal = sold * item.price;
                  return (
                    <tr key={item.id}>
                      <td><b>{item.name}</b></td>
                      <td style={{ textAlign: 'center' }}>S/ {item.price.toFixed(2)}</td>
                      <td style={{ textAlign: 'center' }}>
                        <input
                          type="number"
                          min="0"
                          className="form-control"
                          value={item.loaded || ''}
                          placeholder="0"
                          onChange={(e) => handleItemLoadedChange(item.id, e.target.value)}
                          style={{ textAlign: 'center', fontWeight: 'bold', padding: '4px' }}
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
                          style={{ textAlign: 'center', fontWeight: 'bold', padding: '4px' }}
                        />
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 'bold', color: sold > 0 ? '#27ae60' : 'var(--text-light)' }}>
                        {sold} u.
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 'bold', color: subtotal > 0 ? 'var(--primary-color)' : 'inherit' }}>
                        S/ {subtotal.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Resumen Final de Rendición */}
          <div style={{ background: 'var(--bg-primary)', padding: '16px 20px', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
            <div>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-light)' }}>Total Unidades Vendidas:</span>
              <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#27ae60' }}>{totalSoldUnits} unidades</div>
            </div>

            <div>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-light)' }}>Total Dinero a Rendir en Caja:</span>
              <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: 'var(--primary-color)' }}>S/ {totalMoneyToHandOver.toFixed(2)}</div>
            </div>

            <button type="submit" className="btn btn-primary" style={{ padding: '10px 24px', fontSize: '0.95rem', fontWeight: 'bold' }}>
              💾 Finalizar y Guardar Liquidación
            </button>
          </div>
        </form>
      )}

      {/* PESTAÑA 2: ALERTAS RÁPIDAS DE "SIN STOCK" */}
      {activeTab === 'alerts' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <form onSubmit={handleSendOutOfStockAlert} className="glass" style={{ padding: '18px', borderRadius: '14px', border: '1px solid #f39c12' }}>
            <h4 style={{ margin: '0 0 10px 0', fontSize: '1rem', color: '#d35400' }}>
              📢 Emitir Reporte Rápido de "Sin Stock" desde la Calle
            </h4>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-light)', marginBottom: '14px' }}>
              Usa este botón si tu carrito se quedó sin barquillos o sin un sabor popular para que la central te reabastezca o pause el stock.
            </p>

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ flex: 1, minWidth: '180px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>Producto / Insumo Agotado</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Ej: Lúcuma / Barquillos / Servilletas"
                  value={outOfStockItem}
                  onChange={(e) => setOutOfStockItem(e.target.value)}
                  required
                />
              </div>
              <div style={{ flex: 2, minWidth: '220px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>Ubicación o Detalle Adicional</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Ej: Estoy en el parque principal frente al kiosco"
                  value={outOfStockNotes}
                  onChange={(e) => setOutOfStockNotes(e.target.value)}
                />
              </div>
              <button type="submit" className="btn btn-primary" style={{ padding: '8px 18px', background: '#d35400', borderColor: '#d35400' }}>
                🚨 Enviar Alerta a Central
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
                      className="btn btn-primary"
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

      {/* PESTAÑA 3: HISTORIAL DE LIQUIDACIONES */}
      {activeTab === 'history' && (
        <div className="glass" style={{ padding: '20px', borderRadius: '16px' }}>
          <h4 style={{ margin: '0 0 14px 0', fontSize: '1.05rem' }}>Historial de Liquidaciones Rendidas</h4>
          {settlements.length === 0 ? (
            <p style={{ color: 'var(--text-light)', fontSize: '0.8rem', margin: 0 }}>No hay liquidaciones registradas todavía.</p>
          ) : (
            <div className="admin-table-container">
              <table className="admin-table" style={{ fontSize: '0.8rem' }}>
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Fecha</th>
                    <th>Carrito</th>
                    <th>Vendedor</th>
                    <th>Unidades</th>
                    <th>Dinero Rendido</th>
                    <th>Detalles</th>
                  </tr>
                </thead>
                <tbody>
                  {settlements.map(sq => (
                    <tr key={sq.id}>
                      <td><b>{sq.id}</b></td>
                      <td>{new Date(sq.date).toLocaleDateString('es-PE')} {new Date(sq.date).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}</td>
                      <td>{sq.cartLabel}</td>
                      <td>{sq.vendorName}</td>
                      <td><b>{sq.totalUnits} u.</b></td>
                      <td style={{ color: 'var(--primary-color)', fontWeight: 'bold', fontSize: '0.9rem' }}>
                        S/ {(sq.totalAmount || 0).toFixed(2)}
                      </td>
                      <td>
                        <small style={{ color: 'var(--text-light)' }}>
                          {(sq.details || []).map(d => `${d.sold}x ${d.name}`).slice(0, 2).join(', ')}
                          {(sq.details || []).length > 2 ? '...' : ''}
                        </small>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
