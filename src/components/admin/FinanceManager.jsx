import React, { useState } from 'react';

// --- FUNCIONES DE SANITIZACIÓN ---
const sanitizeHTML = (text) => {
  if (typeof text !== 'string') return '';
  return text.replace(/<[^>]*>/g, '').trim();
};

export default function FinanceManager({
  orders,
  onUpdateOrders,
  expenses,
  onUpdateExpenses,
  packs,
  addLog,
  currentUser,
  showAlert
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

  // --- Estados Locales de Filtro y UI ---
  const [financeRange, setFinanceRange] = useState('today'); // today, week, month, all
  const [expandedDay, setExpandedDay] = useState(null); // Para ver el desglose de pedidos de un día específico

  // --- Estados de Venta Rápida ---
  const [quickSaleProduct, setQuickSaleProduct] = useState('libre');
  const [quickSaleAmount, setQuickSaleAmount] = useState('');
  const [quickSaleName, setQuickSaleName] = useState('');
  const [quickSalePaymentMethod, setQuickSalePaymentMethod] = useState('Efectivo');
  const [quickSaleSubmitting, setQuickSaleSubmitting] = useState(false);

  // --- Estados de Gastos ---
  const [expenseConcept, setExpenseConcept] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseCategory, setExpenseCategory] = useState('Insumos');
  const [expenseDate, setExpenseDate] = useState('');
  const [expenseSubmitting, setExpenseSubmitting] = useState(false);

  // --- Filtrar órdenes y gastos según el rango seleccionado ---
  const getFilteredFinanceData = () => {
    const today = new Date();
    today.setHours(0,0,0,0);
    const todayStr = today.toDateString();

    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - 7);

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const filteredOrders = orders.filter(o => {
      if (o.status === 'Cancelado') return false;
      const oDate = new Date(o.date);
      if (financeRange === 'today') {
        return oDate.toDateString() === todayStr;
      }
      if (financeRange === 'week') {
        return oDate >= startOfWeek;
      }
      if (financeRange === 'month') {
        return oDate >= startOfMonth;
      }
      return true; // all
    });

    const filteredExpenses = expenses.filter(e => {
      const eDate = new Date(e.date);
      eDate.setHours(0,0,0,0);
      if (financeRange === 'today') {
        return eDate.toDateString() === todayStr;
      }
      if (financeRange === 'week') {
        return eDate >= startOfWeek;
      }
      if (financeRange === 'month') {
        return eDate >= startOfMonth;
      }
      return true; // all
    });

    return { filteredOrders, filteredExpenses };
  };

  const { filteredOrders, filteredExpenses } = getFilteredFinanceData();

  const totalSales = filteredOrders.reduce((sum, o) => sum + o.grandTotal, 0);
  const totalExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  const balance = totalSales - totalExpenses;

  // Clasificar ventas por canal
  const onlineSales = filteredOrders
    .filter(o => !o.id.startsWith('FIS-'))
    .reduce((sum, o) => sum + o.grandTotal, 0);
  const physicalSales = filteredOrders
    .filter(o => o.id.startsWith('FIS-'))
    .reduce((sum, o) => sum + o.grandTotal, 0);

  // Tasa de rentabilidad estimada
  const profitMargin = totalSales > 0 ? Math.round((balance / totalSales) * 100) : 0;

  // Agrupación de gastos por categoría
  const expensesByCategory = { Insumos: 0, Servicios: 0, Alquiler: 0, Personal: 0, Otros: 0 };
  filteredExpenses.forEach(e => {
    const cat = e.category || 'Insumos';
    if (expensesByCategory[cat] !== undefined) {
      expensesByCategory[cat] += e.amount;
    } else {
      expensesByCategory['Otros'] = (expensesByCategory['Otros'] || 0) + e.amount;
    }
  });

  const handleAddPhysicalSale = async (e) => {
    e.preventDefault();
    if (quickSaleSubmitting) return;

    const amountVal = parseFloat(quickSaleAmount) || 0;
    if (amountVal <= 0) {
      alert("El monto de la venta debe ser mayor a 0.");
      return;
    }

    setQuickSaleSubmitting(true);
    const saleId = `FIS-${Math.floor(1000 + Math.random() * 9000)}`;
    const newOrder = {
      id: saleId,
      customer: {
        name: quickSaleName.trim() || 'Cliente de Tienda',
        phone: 'N/A',
        address: 'Consumo en Tienda / Venta Presencial',
        paymentMethod: quickSalePaymentMethod
      },
      items: [
        {
          name: quickSaleProduct === 'libre' ? 'Venta Rápida de Mostrador' : quickSaleProduct,
          price: amountVal,
          quantity: 1,
          type: 'custom',
          base: { id: 'tienda', name: 'Servicio en Tienda' },
          scoops: [],
          toppings: []
        }
      ],
      total: amountVal,
      deliveryFee: 0.0,
      discount: 0.0,
      couponCode: null,
      grandTotal: amountVal,
      status: 'Entregado',
      statusHistory: [
        { status: 'Entregado', timestamp: new Date().toISOString() }
      ],
      date: new Date().toISOString()
    };

    onUpdateOrders([newOrder, ...orders]);
    addLog(`Venta física registrada: ${newOrder.items[0].name} (S/. ${amountVal.toFixed(2)}) por ${currentUser?.name}.`);
    setQuickSaleAmount('');
    setQuickSaleName('');
    setQuickSaleSubmitting(false);
    alert("¡Venta física registrada con éxito!");
  };

  const handleAddExpense = async (e) => {
    e.preventDefault();
    if (expenseSubmitting) return;

    const amountVal = parseFloat(expenseAmount) || 0;
    if (!expenseConcept.trim()) {
      alert("El concepto del gasto es obligatorio.");
      return;
    }
    if (amountVal <= 0) {
      alert("El monto del gasto debe ser mayor a 0.");
      return;
    }

    setExpenseSubmitting(true);
    const newExpense = {
      id: `EXP-${Date.now()}`,
      concept: expenseConcept.trim(),
      amount: amountVal,
      category: expenseCategory,
      date: expenseDate || new Date().toISOString().split('T')[0]
    };

    onUpdateExpenses([newExpense, ...expenses]);
    addLog(`Gasto registrado: ${newExpense.concept} (S/. ${amountVal.toFixed(2)}) por ${currentUser?.name}.`);
    setExpenseConcept('');
    setExpenseAmount('');
    setExpenseSubmitting(false);
    alert("¡Gasto registrado con éxito!");
  };

  const handleDeleteExpense = (id) => {
    if (window.confirm("¿Seguro que deseas eliminar este gasto?")) {
      const exp = expenses.find(e => e.id === id);
      onUpdateExpenses(expenses.filter(e => e.id !== id));
      addLog(`Gasto eliminado: ${exp?.concept || id} por ${currentUser?.name}.`);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
        <h3 style={{ margin: 0 }}>Caja y Control de Finanzas</h3>
        <div style={{ display: 'flex', gap: '6px', background: 'rgba(0,0,0,0.03)', padding: '4px', borderRadius: '20px' }}>
          {[
            { id: 'today', label: 'Hoy 📅' },
            { id: 'week', label: 'Esta Semana 📅' },
            { id: 'month', label: 'Este Mes 📅' },
            { id: 'all', label: 'Todo 📦' }
          ].map(r => (
            <button
              key={r.id}
              type="button"
              onClick={() => setFinanceRange(r.id)}
              className={`filter-btn ${financeRange === r.id ? 'active' : ''}`}
              style={{ padding: '4px 10px', fontSize: '0.75rem', border: 'none', background: 'transparent', whiteSpace: 'nowrap' }}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Resumen Financiero */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '15px' }}>
        <div className="glass-card" style={{ padding: '15px', borderLeft: '5px solid var(--success)', background: 'linear-gradient(135deg, rgba(46, 204, 113, 0.05) 0%, rgba(255, 255, 255, 0.2) 100%)' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-light)', fontWeight: 600 }}>💰 INGRESOS TOTALES</span>
          <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: 'var(--success)', marginTop: '5px' }}>S/. {totalSales.toFixed(2)}</div>
          <span style={{ fontSize: '0.65rem', color: 'var(--text-light)', display: 'block', marginTop: '2px' }}>Pedidos online + ventas físicas</span>
        </div>
        <div className="glass-card" style={{ padding: '15px', borderLeft: '5px solid var(--danger)', background: 'linear-gradient(135deg, rgba(231, 76, 60, 0.05) 0%, rgba(255, 255, 255, 0.2) 100%)' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-light)', fontWeight: 600 }}>💸 EGRESOS / GASTOS</span>
          <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: 'var(--danger)', marginTop: '5px' }}>S/. {totalExpenses.toFixed(2)}</div>
          <span style={{ fontSize: '0.65rem', color: 'var(--text-light)', display: 'block', marginTop: '2px' }}>Compras e insumos registrados</span>
        </div>
        <div className="glass-card" style={{ padding: '15px', borderLeft: '5px solid var(--primary-color)', background: 'linear-gradient(135deg, rgba(255, 107, 129, 0.05) 0%, rgba(255, 255, 255, 0.2) 100%)' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-light)', fontWeight: 600 }}>📈 BALANCE NETO</span>
          <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: balance >= 0 ? 'var(--primary-color)' : 'var(--danger)', marginTop: '5px' }}>S/. {balance.toFixed(2)}</div>
          <span style={{ fontSize: '0.65rem', color: 'var(--text-light)', display: 'block', marginTop: '2px' }}>Ganancia real del local</span>
        </div>
        <div className="glass-card" style={{ padding: '15px', borderLeft: '5px solid var(--info)', background: 'linear-gradient(135deg, rgba(52, 152, 219, 0.05) 0%, rgba(255, 255, 255, 0.2) 100%)' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-light)', fontWeight: 600 }}>📊 RENTABILIDAD ESTIMADA</span>
          <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: profitMargin >= 25 ? 'var(--success)' : profitMargin > 0 ? 'var(--info)' : 'var(--danger)', marginTop: '5px' }}>{profitMargin}%</div>
          <span style={{ fontSize: '0.65rem', color: 'var(--text-light)', display: 'block', marginTop: '2px' }}>Margen de ganancia neta</span>
        </div>
      </div>

      {/* DESGLOSE DETALLADO */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '15px', marginTop: '5px' }}>
        <div className="glass" style={{ padding: '15px' }}>
          <strong style={{ fontSize: '0.82rem', display: 'block', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px', marginBottom: '10px' }}>
            📊 Origen y Canales de Ingresos
          </strong>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.78rem' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                <span>🛵 Pedidos Online:</span>
                <strong>S/. {onlineSales.toFixed(2)} ({totalSales > 0 ? Math.round((onlineSales / totalSales) * 100) : 0}%)</strong>
              </div>
              <div style={{ width: '100%', height: '5px', background: 'var(--border-color)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ width: `${totalSales > 0 ? (onlineSales / totalSales) * 100 : 0}%`, height: '100%', background: 'var(--primary-color)' }}></div>
              </div>
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                <span>🏪 Ventas Físicas (Mostrador):</span>
                <strong>S/. {physicalSales.toFixed(2)} ({totalSales > 0 ? Math.round((physicalSales / totalSales) * 100) : 0}%)</strong>
              </div>
              <div style={{ width: '100%', height: '5px', background: 'var(--border-color)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ width: `${totalSales > 0 ? (physicalSales / totalSales) * 100 : 0}%`, height: '100%', background: 'var(--success)' }}></div>
              </div>
            </div>
          </div>
        </div>

        <div className="glass" style={{ padding: '15px' }}>
          <strong style={{ fontSize: '0.82rem', display: 'block', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px', marginBottom: '10px' }}>
            💸 Distribución de Gastos por Categoría
          </strong>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.78rem' }}>
            {Object.entries(expensesByCategory).map(([cat, amount]) => {
              const pct = totalExpenses > 0 ? Math.round((amount / totalExpenses) * 100) : 0;
              return (
                <div key={cat}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                    <span>{cat === 'Insumos' ? '🍓' : cat === 'Servicios' ? '💡' : cat === 'Alquiler' ? '🏢' : '👤'} {cat}:</span>
                    <strong>S/. {amount.toFixed(2)} ({pct}%)</strong>
                  </div>
                  <div style={{ width: '100%', height: '5px', background: 'var(--border-color)', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: 'var(--danger)' }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
        {/* REGISTRAR VENTA FÍSICA */}
        <div className="glass" style={{ padding: '20px' }}>
          <h4 style={{ marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>🛒 Registrar Venta Física (Mostrador)</h4>
          <form onSubmit={handleAddPhysicalSale} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div className="form-group">
              <label>Producto o Detalle</label>
              <select 
                className="form-control" 
                value={quickSaleProduct} 
                onChange={(e) => {
                  setQuickSaleProduct(e.target.value);
                  if (e.target.value !== 'libre') {
                    const found = packs.find(p => p.name === e.target.value);
                    if (found) setQuickSaleAmount(found.price);
                  }
                }}
              >
                <option value="libre">✨ Venta de Importe Libre / Personalizado</option>
                {packs.map(p => (
                  <option key={p.id} value={p.name}>🎁 Pack: {p.name} (S/. {p.price.toFixed(2)})</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '10px' }}>
              <div className="form-group">
                <label>Nombre del Cliente (Opcional)</label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="Ej: Anónimo" 
                  value={quickSaleName}
                  onChange={(e) => setQuickSaleName(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Monto Cobrado S/.</label>
                <input 
                  type="number" 
                  step="0.10" 
                  className="form-control" 
                  required 
                  value={quickSaleAmount}
                  onChange={(e) => setQuickSaleAmount(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label>Método de Pago</label>
              <div className="payment-options" style={{ gap: '6px' }}>
                {['Efectivo', 'Yape', 'Plin', 'Tarjeta'].map(method => (
                  <button
                    key={method}
                    type="button"
                    className={`payment-btn ${quickSalePaymentMethod === method ? 'selected' : ''}`}
                    onClick={() => setQuickSalePaymentMethod(method)}
                    style={{ flex: 1, fontSize: '0.75rem', padding: '6px' }}
                  >
                    {method === 'Efectivo' ? '💵' : method === 'Tarjeta' ? '💳' : '📱'} {method}
                  </button>
                ))}
              </div>
            </div>

            <button 
              type="submit" 
              className="btn btn-primary" 
              style={{ width: '100%', padding: '10px', marginTop: '10px', cursor: 'pointer' }}
              disabled={quickSaleSubmitting}
            >
              {quickSaleSubmitting ? 'Registrando...' : '🛒 Guardar Venta en Caja'}
            </button>
          </form>
        </div>

        {/* REGISTRAR GASTO */}
        <div className="glass" style={{ padding: '20px' }}>
          <h4 style={{ marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>💸 Registrar Gasto / Egreso</h4>
          <form onSubmit={handleAddExpense} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div className="form-group">
              <label>Concepto del Gasto</label>
              <input 
                type="text" 
                className="form-control" 
                placeholder="Ej: Compra de 5kg de fresas" 
                required 
                value={expenseConcept}
                onChange={(e) => setExpenseConcept(e.target.value)}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '10px' }}>
              <div className="form-group">
                <label>Categoría</label>
                <select 
                  className="form-control" 
                  value={expenseCategory}
                  onChange={(e) => setExpenseCategory(e.target.value)}
                >
                  <option value="Insumos">🍓 Insumos / Ingredientes</option>
                  <option value="Servicios">💡 Servicios (Luz, Agua)</option>
                  <option value="Alquiler">🏢 Alquiler de Local</option>
                  <option value="Personal">👥 Personal / Sueldos</option>
                  <option value="Otros">📦 Otros Gastos</option>
                </select>
              </div>
              <div className="form-group">
                <label>Monto Gasto S/.</label>
                <input 
                  type="number" 
                  step="0.10" 
                  className="form-control" 
                  required 
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label>Fecha</label>
              <input 
                type="date" 
                className="form-control" 
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
              />
            </div>

            <button 
              type="submit" 
              className="btn btn-secondary" 
              style={{ width: '100%', padding: '10px', marginTop: '10px', borderColor: 'var(--danger)', color: 'var(--danger)', cursor: 'pointer' }}
              disabled={expenseSubmitting}
            >
              {expenseSubmitting ? 'Registrando...' : '💸 Guardar Egreso / Gasto'}
            </button>
          </form>
        </div>
      </div>

      {/* BITÁCORA DE GASTOS */}
      <div className="glass" style={{ padding: '15px' }}>
        <h4 style={{ marginBottom: '10px' }}>📜 Bitácora de Gastos y Egresos</h4>
        <div className="admin-table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Concepto</th>
                <th>Categoría</th>
                <th>Fecha</th>
                <th>Monto</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-light)' }}>No hay gastos registrados en el sistema para este período.</td>
                </tr>
              ) : (
                filteredExpenses.map(e => (
                  <tr key={e.id}>
                    <td><strong>{e.concept}</strong></td>
                    <td><span className="badge" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-dark)' }}>{e.category}</span></td>
                    <td>{e.date}</td>
                    <td style={{ color: 'var(--danger)', fontWeight: 'bold' }}>- S/. {e.amount.toFixed(2)}</td>
                    <td>
                      <button className="admin-action-btn" style={{ color: 'var(--danger)' }} onClick={() => handleDeleteExpense(e.id)}>🗑️</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* DESGLOSE DIARIO */}
      {financeRange !== 'today' && (() => {
        const dayMap = {};
        filteredOrders.forEach(o => {
          const d = new Date(o.date).toLocaleDateString('es-PE', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' });
          if (!dayMap[d]) dayMap[d] = { orders: [], expTotal: 0, sales: 0 };
          dayMap[d].orders.push(o);
          dayMap[d].sales += o.grandTotal;
        });
        filteredExpenses.forEach(e => {
          const d = new Date(e.date + 'T12:00:00').toLocaleDateString('es-PE', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' });
          if (!dayMap[d]) dayMap[d] = { orders: [], expTotal: 0, sales: 0 };
          dayMap[d].expTotal += e.amount;
        });
        const sortedDays = Object.entries(dayMap).sort((a, b) => {
          const p = str => { const [d,m,y] = str.split('/').map(Number); return new Date(y,m-1,d); };
          return p(b[0]) - p(a[0]);
        });
        if (sortedDays.length === 0) return null;
        return (
          <div className="glass" style={{ padding: '15px' }}>
            <h4 style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              📅 Desglose por Día
              <span style={{ fontSize: '0.7rem', color: 'var(--text-light)', fontWeight: 'normal' }}>
                {financeRange === 'week' ? 'Últimos 7 días' : financeRange === 'month' ? 'Este mes' : 'Todos los registros'} — clic para ver pedidos
              </span>
            </h4>
            <div className="admin-table-container">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Pedidos</th>
                    <th style={{ color: 'var(--success)' }}>Ingresos S/.</th>
                    <th style={{ color: 'var(--danger)' }}>Gastos S/.</th>
                    <th>Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedDays.map(([day, data]) => {
                    const bal = data.sales - data.expTotal;
                    const isExp = expandedDay === day;
                    return (
                      <React.Fragment key={day}>
                        <tr
                          style={{ cursor: data.orders.length > 0 ? 'pointer' : 'default', background: isExp ? 'rgba(255,107,129,0.04)' : '' }}
                          onClick={() => setExpandedDay(isExp ? null : day)}
                        >
                          <td><strong>{day}</strong> {data.orders.length > 0 && <span style={{ fontSize: '0.65rem', color: 'var(--primary-color)', marginLeft: '4px' }}>{isExp ? '▼' : '▶'}</span>}</td>
                          <td style={{ textAlign: 'center' }}><span style={{ background: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: '10px' }}>{data.orders.length}</span></td>
                          <td style={{ color: 'var(--success)', fontWeight: 'bold' }}>{data.sales.toFixed(2)}</td>
                          <td style={{ color: data.expTotal > 0 ? 'var(--danger)' : 'var(--text-light)' }}>{data.expTotal > 0 ? `- ${data.expTotal.toFixed(2)}` : '—'}</td>
                          <td style={{ color: bal >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 'bold' }}>{bal.toFixed(2)}</td>
                        </tr>
                        {isExp && data.orders.map(o => {
                          const hora = new Date(o.date).toLocaleTimeString('es-PE', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit', hour12: true });
                          return (
                            <tr key={o.id} style={{ background: 'rgba(0,0,0,0.018)', fontSize: '0.75rem' }}>
                              <td style={{ paddingLeft: '22px' }}><span style={{ color: 'var(--text-light)', fontFamily: 'monospace' }}>{hora}</span> · <strong>{o.id}</strong></td>
                              <td style={{ color: 'var(--text-light)' }}>{o.customer.name}</td>
                              <td style={{ color: 'var(--success)', fontWeight: '600' }}>{o.grandTotal.toFixed(2)}</td>
                              <td style={{ color: 'var(--text-light)' }}>{o.customer.paymentMethod}</td>
                              <td><span className={`badge status-badge-${(o.status || 'Pendiente').toLowerCase().replace(' ','_')}`} style={{ fontSize: '0.65rem' }}>{o.status || 'Pendiente'}</span></td>
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* DETALLE DE PEDIDOS DE HOY */}
      {financeRange === 'today' && filteredOrders.length > 0 && (
        <div className="glass" style={{ padding: '15px' }}>
          <h4 style={{ marginBottom: '10px' }}>🧾 Pedidos de Hoy ({filteredOrders.length})</h4>
          <div className="admin-table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Cliente</th>
                  <th>Hora (Lima)</th>
                  <th>Total S/.</th>
                  <th>Estado</th>
                  <th>Pago</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map(o => {
                  const hora = new Date(o.date).toLocaleTimeString('es-PE', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit', hour12: true });
                  return (
                    <tr key={o.id}>
                      <td><strong>{o.id}</strong></td>
                      <td>{o.customer.name}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{hora}</td>
                      <td style={{ color: 'var(--success)', fontWeight: 'bold' }}>{o.grandTotal.toFixed(2)}</td>
                      <td><span className={`badge status-badge-${(o.status || 'Pendiente').toLowerCase().replace(' ','_')}`} style={{ fontSize: '0.75rem' }}>{o.status || 'Pendiente'}</span></td>
                      <td>{o.customer.paymentMethod}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
