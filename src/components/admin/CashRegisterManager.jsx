import React, { useState, useMemo } from 'react';
import { printThermalTicket } from '../../utils/escposTicket';

export default function CashRegisterManager({
  orders = [],
  shifts = [],
  onUpdateShifts,
  currentUser,
  storeName = 'Friozo',
  addLog,
  showAlert
}) {
  // Encontrar turno actualmente abierto (si existe)
  const activeShift = useMemo(() => {
    return (shifts || []).find(s => s.status === 'open') || null;
  }, [shifts]);

  // Estados para Apertura
  const [openStartingCash, setOpenStartingCash] = useState(100);
  const [openNotes, setOpenNotes] = useState('');

  // Estados para Movimiento Extraordinario (Ingreso / Retiro)
  const [movementType, setMovementType] = useState('out'); // 'in' | 'out'
  const [movementAmount, setMovementAmount] = useState('');
  const [movementReason, setMovementReason] = useState('');
  const [showMovementForm, setShowMovementForm] = useState(false);

  // Estados para Conteo Físico en Arqueo Z
  const [counts, setCounts] = useState({
    b100: 0, b50: 0, b20: 0, b10: 0,
    m5: 0, m2: 0, m1: 0, m050: 0, m020: 0, m010: 0
  });
  const [closingNotes, setClosingNotes] = useState('');

  // Calcular ventas registradas desde la apertura del turno
  const shiftSales = useMemo(() => {
    if (!activeShift) return { cash: 0, yape: 0, card: 0, total: 0, count: 0 };
    const shiftStartTime = new Date(activeShift.openedAt).getTime();

    const ordersInShift = orders.filter(o => {
      if (o.status === 'Cancelado') return false;
      const orderTime = new Date(o.date).getTime();
      return orderTime >= shiftStartTime;
    });

    let cash = 0;
    let yape = 0;
    let card = 0;

    ordersInShift.forEach(o => {
      const amount = Number(o.grandTotal) || 0;
      const method = String(o.paymentMethod || '').toLowerCase();
      if (method.includes('efectivo')) {
        cash += amount;
      } else if (method.includes('yape') || method.includes('plin')) {
        yape += amount;
      } else {
        card += amount;
      }
    });

    return {
      cash,
      yape,
      card,
      total: cash + yape + card,
      count: ordersInShift.length
    };
  }, [activeShift, orders]);

  // Calcular movimientos de efectivo en el turno
  const movementsSummary = useMemo(() => {
    if (!activeShift) return { in: 0, out: 0 };
    const list = activeShift.movements || [];
    const totalIn = list.filter(m => m.type === 'in').reduce((s, m) => s + (Number(m.amount) || 0), 0);
    const totalOut = list.filter(m => m.type === 'out').reduce((s, m) => s + (Number(m.amount) || 0), 0);
    return { in: totalIn, out: totalOut };
  }, [activeShift]);

  // Efectivo esperado en gaveta
  const expectedCash = useMemo(() => {
    if (!activeShift) return 0;
    const start = Number(activeShift.startingCash) || 0;
    return start + shiftSales.cash + movementsSummary.in - movementsSummary.out;
  }, [activeShift, shiftSales.cash, movementsSummary]);

  // Conteo físico real según billetes y monedas
  const countedCash = useMemo(() => {
    return (
      (counts.b100 * 100) +
      (counts.b50 * 50) +
      (counts.b20 * 20) +
      (counts.b10 * 10) +
      (counts.m5 * 5) +
      (counts.m2 * 2) +
      (counts.m1 * 1) +
      (counts.m050 * 0.5) +
      (counts.m020 * 0.2) +
      (counts.m010 * 0.1)
    );
  }, [counts]);

  const difference = countedCash - expectedCash;

  // Acción: Abrir Turno de Caja
  const handleOpenShift = (e) => {
    e.preventDefault();
    const newShift = {
      id: `Z-${Date.now().toString().slice(-6)}`,
      status: 'open',
      openedAt: new Date().toISOString(),
      closedAt: null,
      cashierEmail: currentUser?.email || 'caja@friozo.com',
      cashierName: currentUser?.name || 'Cajero de Turno',
      startingCash: Number(openStartingCash) || 0,
      notes: openNotes,
      movements: []
    };

    const nextShifts = [newShift, ...(shifts || [])];
    onUpdateShifts(nextShifts);
    addLog?.(`Caja Chica ABIERTA con S/ ${newShift.startingCash.toFixed(2)} por ${newShift.cashierName}.`);
    if (showAlert) showAlert('Caja Abierta', `Turno iniciado con fondo de S/ ${newShift.startingCash.toFixed(2)}.`, 'success');
  };

  // Acción: Registrar Movimiento (Ingreso o Retiro menor)
  const handleAddMovement = (e) => {
    e.preventDefault();
    const amt = Number(movementAmount);
    if (!amt || amt <= 0) {
      if (showAlert) showAlert('Monto Inválido', 'Ingresa un monto válido mayor a 0.', 'warning');
      return;
    }
    if (!movementReason.trim()) {
      if (showAlert) showAlert('Motivo Requerido', 'Indica el concepto o motivo del movimiento.', 'warning');
      return;
    }

    const movement = {
      id: `MOV-${Date.now().toString().slice(-4)}`,
      timestamp: new Date().toISOString(),
      type: movementType,
      amount: amt,
      reason: movementReason.trim(),
      user: currentUser?.name || 'Cajero'
    };

    const updatedShift = {
      ...activeShift,
      movements: [...(activeShift.movements || []), movement]
    };

    const nextShifts = (shifts || []).map(s => s.id === activeShift.id ? updatedShift : s);
    onUpdateShifts(nextShifts);
    addLog?.(`Caja Chica: ${movementType === 'in' ? 'INGRESO' : 'RETIRO'} de S/ ${amt.toFixed(2)} (${movement.reason}).`);
    setMovementAmount('');
    setMovementReason('');
    setShowMovementForm(false);
    if (showAlert) showAlert('Movimiento Registrado', `${movementType === 'in' ? 'Ingreso' : 'Retiro'} de S/ ${amt.toFixed(2)} guardado.`, 'success');
  };

  // Acción: Cierre Z de Caja
  const handleCloseShift = () => {
    if (!window.confirm('¿Confirmas que deseas cerrar este turno de caja y generar el Cierre Z?')) return;

    const closedShift = {
      ...activeShift,
      status: 'closed',
      closedAt: new Date().toISOString(),
      cashSales: shiftSales.cash,
      yapeSales: shiftSales.yape,
      cardSales: shiftSales.card,
      totalTurnover: shiftSales.total,
      ordersCount: shiftSales.count,
      cashIn: movementsSummary.in,
      cashOut: movementsSummary.out,
      expectedCash,
      actualCash: countedCash,
      difference,
      closingNotes,
      countedDenominations: { ...counts }
    };

    const nextShifts = (shifts || []).map(s => s.id === activeShift.id ? closedShift : s);
    onUpdateShifts(nextShifts);
    addLog?.(`Cierre Z completado por ${currentUser?.name || 'Caja'}. Diferencia: S/ ${difference.toFixed(2)}.`);

    // Imprimir ticket de Cierre Z automáticamente
    printThermalTicket({
      type: 'cierre_z',
      shift: closedShift,
      storeName
    });

    if (showAlert) showAlert('Turno Cerrado', 'El Cierre Z se generó exitosamente y se envió a imprimir.', 'success');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Cabecera */}
      <div className="glass" style={{ padding: '16px 20px', borderRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '1.8rem' }}>💵</span>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.2rem' }}>Caja Chica y Control de Arqueo (Cierre Z)</h3>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-light)' }}>
              Apertura de turno, control de efectivo y cuadre contra cobros Yape/Plin/Tarjeta.
            </span>
          </div>
        </div>

        {activeShift && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ background: 'rgba(46, 204, 113, 0.15)', color: '#27ae60', border: '1px solid #2ecc71', padding: '4px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 'bold' }}>
              🟢 Turno Activo: {activeShift.id}
            </span>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ padding: '6px 12px', fontSize: '0.78rem' }}
              onClick={() => setShowMovementForm(!showMovementForm)}
            >
              💸 Ingreso / Retiro
            </button>
          </div>
        )}
      </div>

      {/* CASO 1: NO HAY TURNO ABIERTO (FORMULARIO DE APERTURA) */}
      {!activeShift ? (
        <div className="glass" style={{ maxWidth: '500px', margin: '20px auto', padding: '24px', borderRadius: '16px' }}>
          <div style={{ textAlign: 'center', marginBottom: '18px' }}>
            <span style={{ fontSize: '2.5rem' }}>🔓</span>
            <h3 style={{ marginTop: '8px' }}>Apertura de Turno de Caja</h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-light)' }}>
              Ingresa el fondo inicial en efectivo (sencillo / cambio base) para iniciar la atención.
            </p>
          </div>

          <form onSubmit={handleOpenShift} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="form-group">
              <label style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>Fondo Inicial en Efectivo (S/)</label>
              <input
                type="number"
                step="0.50"
                min="0"
                className="form-control"
                value={openStartingCash}
                onChange={(e) => setOpenStartingCash(e.target.value)}
                required
                style={{ fontSize: '1.2rem', fontWeight: 'bold' }}
              />
            </div>
            <div className="form-group">
              <label style={{ fontSize: '0.8rem' }}>Responsable de Caja</label>
              <input
                type="text"
                className="form-control"
                value={currentUser?.name || 'Cajero'}
                disabled
              />
            </div>
            <div className="form-group">
              <label style={{ fontSize: '0.8rem' }}>Notas de Apertura (opcional)</label>
              <input
                type="text"
                className="form-control"
                placeholder="Ej: Sencillo en monedas de S/ 2 y S/ 5"
                value={openNotes}
                onChange={(e) => setOpenNotes(e.target.value)}
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ padding: '12px', fontSize: '0.95rem', fontWeight: 'bold' }}>
              Abrir Caja e Iniciar Turno
            </button>
          </form>
        </div>
      ) : (
        /* CASO 2: TURNO EN CURSO (RESUMEN + ARQUEO) */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Formulario Modal Desplegable para Ingreso/Retiro extraordinario */}
          {showMovementForm && (
            <form onSubmit={handleAddMovement} className="glass" style={{ padding: '16px', borderRadius: '12px', border: '1px solid var(--primary-color)', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ flex: 1, minWidth: '130px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>Tipo de Operación</label>
                <select className="form-control" value={movementType} onChange={(e) => setMovementType(e.target.value)}>
                  <option value="out">🔴 Retiro / Gasto Menor</option>
                  <option value="in">🟢 Ingreso Extraordinario</option>
                </select>
              </div>
              <div style={{ flex: 1, minWidth: '120px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>Monto (S/)</label>
                <input type="number" step="0.5" className="form-control" placeholder="0.00" value={movementAmount} onChange={(e) => setMovementAmount(e.target.value)} required />
              </div>
              <div style={{ flex: 2, minWidth: '180px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>Concepto o Motivo</label>
                <input type="text" className="form-control" placeholder="Ej: Compra de hielo / pago propinas" value={movementReason} onChange={(e) => setMovementReason(e.target.value)} required />
              </div>
              <button type="submit" className="btn btn-primary" style={{ padding: '8px 16px' }}>Guardar</button>
              <button type="button" className="btn btn-secondary" style={{ padding: '8px 12px' }} onClick={() => setShowMovementForm(false)}>Cancelar</button>
            </form>
          )}

          {/* Tarjetas KPI de Estado de Caja */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
            <div className="glass" style={{ padding: '14px', borderRadius: '12px', borderLeft: '4px solid #3498db' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-light)', textTransform: 'uppercase', fontWeight: 'bold' }}>Fondo Inicial</span>
              <strong style={{ display: 'block', fontSize: '1.3rem', marginTop: '4px' }}>S/ {Number(activeShift.startingCash || 0).toFixed(2)}</strong>
              <small style={{ color: 'var(--text-light)', fontSize: '0.7rem' }}>Apertura: {new Date(activeShift.openedAt).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}</small>
            </div>

            <div className="glass" style={{ padding: '14px', borderRadius: '12px', borderLeft: '4px solid #2ecc71' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-light)', textTransform: 'uppercase', fontWeight: 'bold' }}>Ventas Efectivo</span>
              <strong style={{ display: 'block', fontSize: '1.3rem', marginTop: '4px', color: '#27ae60' }}>+S/ {shiftSales.cash.toFixed(2)}</strong>
              <small style={{ color: 'var(--text-light)', fontSize: '0.7rem' }}>Ingresos por cobro en caja</small>
            </div>

            <div className="glass" style={{ padding: '14px', borderRadius: '12px', borderLeft: '4px solid #9b59b6' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-light)', textTransform: 'uppercase', fontWeight: 'bold' }}>Pagos Digitales</span>
              <strong style={{ display: 'block', fontSize: '1.3rem', marginTop: '4px', color: '#8e44ad' }}>S/ {(shiftSales.yape + shiftSales.card).toFixed(2)}</strong>
              <small style={{ color: 'var(--text-light)', fontSize: '0.7rem' }}>Yape S/ {shiftSales.yape.toFixed(2)} | POS S/ {shiftSales.card.toFixed(2)}</small>
            </div>

            <div className="glass" style={{ padding: '14px', borderRadius: '12px', borderLeft: '4px solid #e74c3c' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-light)', textTransform: 'uppercase', fontWeight: 'bold' }}>Gastos / Retiros</span>
              <strong style={{ display: 'block', fontSize: '1.3rem', marginTop: '4px', color: '#c0392b' }}>-S/ {movementsSummary.out.toFixed(2)}</strong>
              <small style={{ color: 'var(--text-light)', fontSize: '0.7rem' }}>{activeShift.movements?.length || 0} movimientos</small>
            </div>

            <div className="glass" style={{ padding: '14px', borderRadius: '12px', borderLeft: '4px solid var(--primary-color)' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-light)', textTransform: 'uppercase', fontWeight: 'bold' }}>Efectivo Esperado</span>
              <strong style={{ display: 'block', fontSize: '1.4rem', marginTop: '4px', color: 'var(--primary-color)' }}>S/ {expectedCash.toFixed(2)}</strong>
              <small style={{ color: 'var(--text-light)', fontSize: '0.7rem' }}>Saldo teórico en gaveta</small>
            </div>
          </div>

          {/* Panel de Arqueo Ciego y Conteo Físico para Cierre Z */}
          <div className="glass" style={{ padding: '20px', borderRadius: '16px' }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '1.05rem', color: 'var(--text-dark)' }}>
              🧮 Conteo Físico de Billetes y Monedas (Arqueo Z)
            </h4>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-light)', marginBottom: '16px' }}>
              Ingresa la cantidad de piezas de cada denominación que hay físicamente en la gaveta. El sistema calculará la diferencia automáticamente.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', marginBottom: '18px' }}>
              {[
                { key: 'b100', label: 'Billetes S/ 100', val: 100 },
                { key: 'b50', label: 'Billetes S/ 50', val: 50 },
                { key: 'b20', label: 'Billetes S/ 20', val: 20 },
                { key: 'b10', label: 'Billetes S/ 10', val: 10 },
                { key: 'm5', label: 'Monedas S/ 5', val: 5 },
                { key: 'm2', label: 'Monedas S/ 2', val: 2 },
                { key: 'm1', label: 'Monedas S/ 1', val: 1 },
                { key: 'm050', label: 'Monedas S/ 0.50', val: 0.5 },
                { key: 'm020', label: 'Monedas S/ 0.20', val: 0.2 },
                { key: 'm010', label: 'Monedas S/ 0.10', val: 0.1 }
              ].map(denom => (
                <div key={denom.key} style={{ background: 'var(--bg-primary)', padding: '8px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <label style={{ fontSize: '0.72rem', display: 'block', color: 'var(--text-light)', fontWeight: 600 }}>{denom.label}</label>
                  <input
                    type="number"
                    min="0"
                    className="form-control"
                    placeholder="0"
                    value={counts[denom.key] || ''}
                    onChange={(e) => setCounts({ ...counts, [denom.key]: Math.max(0, parseInt(e.target.value, 10) || 0) })}
                    style={{ padding: '6px', fontSize: '0.9rem', textAlign: 'center', fontWeight: 'bold', marginTop: '4px' }}
                  />
                  <div style={{ fontSize: '0.68rem', color: 'var(--primary-color)', textAlign: 'right', marginTop: '2px' }}>
                    = S/ {((counts[denom.key] || 0) * denom.val).toFixed(2)}
                  </div>
                </div>
              ))}
            </div>

            {/* Resultado de la Comparación */}
            <div style={{ background: 'var(--bg-primary)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-light)' }}>Total Físico Contado:</span>
                <div style={{ fontSize: '1.4rem', fontWeight: 'bold' }}>S/ {countedCash.toFixed(2)}</div>
              </div>

              <div>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-light)' }}>Efectivo Esperado:</span>
                <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: 'var(--text-dark)' }}>S/ {expectedCash.toFixed(2)}</div>
              </div>

              <div>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-light)' }}>Diferencia de Caja:</span>
                <div style={{
                  fontSize: '1.4rem',
                  fontWeight: 'bold',
                  color: Math.abs(difference) < 0.05 ? '#27ae60' : difference > 0 ? '#2980b9' : '#c0392b'
                }}>
                  {Math.abs(difference) < 0.05 ? '✅ Cuadre Exacto' : difference > 0 ? `+S/ ${difference.toFixed(2)} (Sobrante)` : `-S/ ${Math.abs(difference).toFixed(2)} (Faltante)`}
                </div>
              </div>

              <button
                type="button"
                className="btn btn-primary"
                onClick={handleCloseShift}
                style={{ padding: '10px 20px', fontSize: '0.9rem', fontWeight: 'bold' }}
              >
                🏁 Ejecutar Cierre Z e Imprimir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HISTORIAL DE CIERRES Z ANTERIORES */}
      <div className="glass" style={{ padding: '20px', borderRadius: '16px' }}>
        <h4 style={{ margin: '0 0 12px 0', fontSize: '1.05rem' }}>📜 Historial de Turnos y Cierres Z</h4>
        {(shifts || []).filter(s => s.status === 'closed').length === 0 ? (
          <p style={{ color: 'var(--text-light)', fontSize: '0.8rem', margin: 0 }}>Aún no hay turnos cerrados registrados.</p>
        ) : (
          <div className="admin-table-container">
            <table className="admin-table" style={{ fontSize: '0.8rem' }}>
              <thead>
                <tr>
                  <th>Turno</th>
                  <th>Cierre</th>
                  <th>Cajero</th>
                  <th>Venta Total</th>
                  <th>Efectivo Esperado</th>
                  <th>Efectivo Real</th>
                  <th>Diferencia</th>
                  <th>Ticket</th>
                </tr>
              </thead>
              <tbody>
                {(shifts || []).filter(s => s.status === 'closed').map(shift => (
                  <tr key={shift.id}>
                    <td><b>{shift.id}</b></td>
                    <td>{new Date(shift.closedAt).toLocaleDateString('es-PE')} {new Date(shift.closedAt).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}</td>
                    <td>{shift.cashierName}</td>
                    <td>S/ {(shift.totalTurnover || 0).toFixed(2)}</td>
                    <td>S/ {(shift.expectedCash || 0).toFixed(2)}</td>
                    <td>S/ {(shift.actualCash || 0).toFixed(2)}</td>
                    <td style={{ fontWeight: 'bold', color: (shift.difference || 0) >= 0 ? '#27ae60' : '#c0392b' }}>
                      {(shift.difference || 0) >= 0 ? `+S/ ${(shift.difference || 0).toFixed(2)}` : `-S/ ${Math.abs(shift.difference || 0).toFixed(2)}`}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ padding: '4px 8px', fontSize: '0.72rem' }}
                        onClick={() => printThermalTicket({ type: 'cierre_z', shift, storeName })}
                      >
                        🖨️ Re-imprimir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
