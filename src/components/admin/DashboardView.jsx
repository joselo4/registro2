import React, { useState, useEffect } from 'react';

export default function DashboardView({
  orders,
  salesGoal,
  handleExportFinancialsCSV,
  handleExportSalesReport,
  flavors = [],
  toppings = [],
  bases = [],
  packs = []
}) {
  // --- Estados Locales del Filtro y UI ---
  const [statsRange, setStatsRange] = useState('today'); // today, yesterday, 7days, 30days, thismonth, all, custom
  const [statsStartDate, setStatsStartDate] = useState('');
  const [statsEndDate, setStatsEndDate] = useState('');
  const [expandedDay, setExpandedDay] = useState(null);

  // --- Estado de Configuración del Dashboard ---
  const [dashboardConfig, setDashboardConfig] = useState(() => {
    try {
      const saved = localStorage.getItem('helados_dashboard_config');
      return saved ? JSON.parse(saved) : { showTopProducts: true, showPayments: true, showFinances: true };
    } catch {
      return { showTopProducts: true, showPayments: true, showFinances: true };
    }
  });

  useEffect(() => {
    localStorage.setItem('helados_dashboard_config', JSON.stringify(dashboardConfig));
  }, [dashboardConfig]);

  // --- Filtrar pedidos según rango de fecha seleccionado ---
  const getFilteredOrdersForStats = () => {
    const todayString = new Date().toDateString();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayString = yesterday.toDateString();
    const now = new Date();

    return orders.filter(order => {
      if (order.status === 'Cancelado') return false;
      
      const orderDate = new Date(order.date);
      
      if (statsRange === 'today') {
        return orderDate.toDateString() === todayString;
      } else if (statsRange === 'yesterday') {
        return orderDate.toDateString() === yesterdayString;
      } else if (statsRange === '7days') {
        const diffDays = (new Date() - orderDate) / (1000 * 60 * 60 * 24);
        return diffDays <= 7;
      } else if (statsRange === '30days') {
        const diffDays = (new Date() - orderDate) / (1000 * 60 * 60 * 24);
        return diffDays <= 30;
      } else if (statsRange === 'thismonth') {
        return orderDate.getMonth() === now.getMonth() && orderDate.getFullYear() === now.getFullYear();
      } else if (statsRange === 'custom') {
        let matches = true;
        if (statsStartDate) {
          const start = new Date(statsStartDate + 'T00:00:00');
          matches = matches && orderDate >= start;
        }
        if (statsEndDate) {
          const end = new Date(statsEndDate + 'T23:59:59');
          matches = matches && orderDate <= end;
        }
        return matches;
      }
      return true; // all
    });
  };

  const statsOrders = getFilteredOrdersForStats();
  const totalSalesPeriod = statsOrders.reduce((sum, o) => sum + o.grandTotal, 0);
  const netProductSales = statsOrders.reduce((sum, o) => sum + o.total, 0);
  const deliveryRevenue = statsOrders.reduce((sum, o) => sum + o.deliveryFee, 0);
  const orderCountPeriod = statsOrders.length;
  const avgTicketPeriod = orderCountPeriod > 0 ? (totalSalesPeriod / orderCountPeriod) : 0;

  // Ventas de Hoy para KPI de meta
  const todayStrKey = new Date().toDateString();
  const salesToday = orders
    .filter(o => o.status !== 'Cancelado' && new Date(o.date).toDateString() === todayStrKey)
    .reduce((sum, o) => sum + o.grandTotal, 0);

  // Calcular estadísticas de productos más vendidos
  const flavorSales = {};
  const baseSales = {};
  const toppingSales = {};
  const packSales = {};

  // Calcular Utilidades y Smart Pricing en base a insumos estimados
  let estimatedCOGS = 0;
  statsOrders.forEach(order => {
    order.items.forEach(item => {
      const qty = item.quantity || 1;
      if (item.type === 'custom') {
        // Envase cost (cono/vaso = S/. 0.15, waffle = S/. 0.50)
        if (item.base) {
          const dbBase = bases.find(b => b.id === item.base.id);
          const baseCost = (dbBase && dbBase.cost !== undefined) ? parseFloat(dbBase.cost) : (item.base.id === 'waffle' ? 0.50 : 0.15);
          estimatedCOGS += baseCost * qty;
        }
        // Scoops cost
        if (item.scoops) {
          item.scoops.forEach(scoop => {
            const dbFlavor = flavors.find(f => f.id === scoop.id);
            let scoopCost;
            if (dbFlavor && dbFlavor.cost !== undefined) {
              scoopCost = parseFloat(dbFlavor.cost);
            } else {
              const isPremium = ['lucuma', 'chocolate', 'coco'].includes(scoop.id);
              scoopCost = isPremium ? 0.50 : 0.35;
            }
            estimatedCOGS += scoopCost * qty;
          });
        }
        // Toppings cost
        if (item.toppings) {
          item.toppings.forEach(topping => {
            const dbTopping = toppings.find(t => t.id === topping.id || t.name === topping.name);
            const toppingCost = (dbTopping && dbTopping.cost !== undefined) ? parseFloat(dbTopping.cost) : 0.15;
            estimatedCOGS += toppingCost * qty;
          });
        }
        if (item.syrup) {
          const dbSyrup = toppings.find(t => t.id === item.syrup.id || t.name === item.syrup.name);
          const syrupCost = (dbSyrup && dbSyrup.cost !== undefined) ? parseFloat(dbSyrup.cost) : 0.10;
          estimatedCOGS += syrupCost * qty;
        }
      } else if (item.type === 'pack') {
        const dbPack = packs.find(p => p.id === item.id || p.name === item.name);
        let packCost;
        if (dbPack && dbPack.cost !== undefined) {
          packCost = parseFloat(dbPack.cost);
        } else {
          if (item.id === 'pack_ahorro') packCost = 2.20;
          else if (item.id === 'pack_pareja') packCost = 4.00;
          else packCost = 6.50; // pack_mega_fiesta
        }
        estimatedCOGS += packCost * qty;
      }
    });
  });

  const estimatedUtility = Math.max(0, netProductSales - estimatedCOGS);
  const utilityPercentage = netProductSales > 0 ? Math.round((estimatedUtility / netProductSales) * 100) : 0;
  
  // Métodos de pago y Tipos de Entrega
  const salesByPayment = {};
  const salesByDeliveryType = { delivery: 0, pickup: 0 };

  statsOrders.forEach(order => {
    // Método de Pago
    const pm = order.customer.paymentMethod || 'Otros';
    salesByPayment[pm] = (salesByPayment[pm] || 0) + order.grandTotal;

    // Tipo de Entrega
    const isDelivery = order.deliveryFee > 0 || (order.customer.address && !['recojo', 'recojo en tienda', 'tienda', 'local'].includes(order.customer.address.toLowerCase().trim()));
    if (isDelivery) {
      salesByDeliveryType.delivery += order.grandTotal;
    } else {
      salesByDeliveryType.pickup += order.grandTotal;
    }

    order.items.forEach(item => {
      const qty = item.quantity || 1;
      if (item.type === 'custom') {
        if (item.base) {
          baseSales[item.base.name] = (baseSales[item.base.name] || 0) + qty;
        }
        if (item.scoops) {
          item.scoops.forEach(scoop => {
            flavorSales[scoop.name] = (flavorSales[scoop.name] || 0) + qty;
          });
        }
        if (item.toppings) {
          item.toppings.forEach(topping => {
            toppingSales[topping.name] = (toppingSales[topping.name] || 0) + qty;
          });
        }
        if (item.syrup) {
          toppingSales[item.syrup.name] = (toppingSales[item.syrup.name] || 0) + qty;
        }
      } else if (item.type === 'pack') {
        packSales[item.name] = (packSales[item.name] || 0) + qty;
      }
    });
  });

  // Rango dinámico de fechas para la tabla de desglose
  const getDaysInRange = () => {
    const dayList = [];
    let start = new Date();
    let end = new Date();

    if (statsRange === 'today') {
      start = new Date();
      end = new Date();
    } else if (statsRange === 'yesterday') {
      start = new Date();
      start.setDate(start.getDate() - 1);
      end = new Date(start);
    } else if (statsRange === '7days') {
      start = new Date();
      start.setDate(start.getDate() - 6);
    } else if (statsRange === '30days') {
      start = new Date();
      start.setDate(start.getDate() - 29);
    } else if (statsRange === 'thismonth') {
      start = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    } else if (statsRange === 'custom') {
      start = statsStartDate ? new Date(statsStartDate + 'T00:00:00') : new Date();
      end = statsEndDate ? new Date(statsEndDate + 'T23:59:59') : new Date();
    } else { // all
      if (orders.length > 0) {
        const dates = orders.map(o => new Date(o.date).getTime());
        start = new Date(Math.min(...dates));
      } else {
        start.setDate(start.getDate() - 30);
      }
    }

    const current = new Date(start);
    current.setHours(0,0,0,0);
    const limit = new Date(end);
    limit.setHours(23,59,59,999);

    let iterations = 0;
    while (current <= limit && iterations < 366) {
      dayList.push(new Date(current));
      current.setDate(current.getDate() + 1);
      iterations++;
    }
    return dayList.reverse();
  };

  const dailyHistory = getDaysInRange().map(date => {
    const dateKey = date.toDateString();
    const dateStr = date.toLocaleDateString('es-PE', { weekday: 'short', day: '2-digit', month: '2-digit' });
    
    const dayOrders = orders.filter(o => new Date(o.date).toDateString() === dateKey);
    const validDayOrders = dayOrders.filter(o => o.status !== 'Cancelado');
    const canceledCount = dayOrders.filter(o => o.status === 'Cancelado').length;
    
    const subtotal = validDayOrders.reduce((sum, o) => sum + o.total, 0);
    const deliveryFee = validDayOrders.reduce((sum, o) => sum + o.deliveryFee, 0);
    const grandTotal = validDayOrders.reduce((sum, o) => sum + o.grandTotal, 0);
    
    return {
      date,
      dateKey,
      dateStr,
      orders: dayOrders,
      validCount: validDayOrders.length,
      canceledCount,
      subtotal,
      deliveryFee,
      sales: grandTotal
    };
  });

  const sortedFlavors = Object.entries(flavorSales).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const sortedBases = Object.entries(baseSales).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const sortedToppings = Object.entries(toppingSales).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const sortedPacks = Object.entries(packSales).sort((a, b) => b[1] - a[1]).slice(0, 3);

  const progressPercent = Math.min(100, Math.round((salesToday / salesGoal) * 100)) || 0;

  const chartData = [...dailyHistory].reverse().slice(-15);
  const maxSales = Math.max(...chartData.map(d => d.sales), 10);

  // Generar Insights Dinámicos
  const dynamicInsights = [];
  const topFlavorEntry = Object.entries(flavorSales).sort((a, b) => b[1] - a[1])[0];
  if (topFlavorEntry) {
    const [flavorName, flavorCount] = topFlavorEntry;
    const profitBumps = (flavorCount * 0.20).toFixed(2);
    dynamicInsights.push({
      type: 'pricing',
      title: `Ajuste de Tarifa Sabor Estrella: ${flavorName}`,
      desc: `Este sabor artesanal es altamente preferido con ${flavorCount} bolas ordenadas. Te sugerimos subir el precio de la bola en +S/. 0.20. Esto incrementará tus ganancias netas en S/. ${profitBumps} adicionales con impacto de demanda casi nulo.`,
      badge: 'Recomendado'
    });
  }

  const waffleCount = baseSales['Copa Waffle Artesanal'] || 0;
  if (waffleCount > 2) {
    dynamicInsights.push({
      type: 'bundle',
      title: 'Promoción de Copas Waffle',
      desc: `Registras ${waffleCount} Copas Waffle Artesanales vendidas. Crear una opción pre-establecida en combo con 3 sabores fijos optimizará la velocidad de preparación y mejorará tu margen operativo.`,
      badge: 'Estrategia'
    });
  }

  if (avgTicketPeriod < 15 && avgTicketPeriod > 0) {
    dynamicInsights.push({
      type: 'ticket',
      title: 'Aumentar Ticket Promedio',
      desc: `El ticket medio actual de S/. ${avgTicketPeriod.toFixed(2)} es inferior a la meta de S/. 15.00 para envío gratuito. Proponer sugerencias cruzadas (salsas, extras) elevará el ticket medio.`,
      badge: 'Sugerencia'
    });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Selector de Rango */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px', flexWrap: 'wrap', gap: '10px' }}>
        <h3 style={{ margin: 0 }}>📊 Dashboard Analítico y Ventas</h3>
        <div style={{ display: 'flex', gap: '5px', background: 'rgba(0,0,0,0.03)', padding: '4px', borderRadius: '8px', flexWrap: 'wrap' }}>
          {[
            { id: 'today', label: 'Hoy' },
            { id: 'yesterday', label: 'Ayer' },
            { id: '7days', label: '7 Días' },
            { id: '30days', label: '30 Días' },
            { id: 'thismonth', label: 'Este Mes' },
            { id: 'all', label: 'Todo' },
            { id: 'custom', label: 'Calendario 📅' }
          ].map(r => (
            <button
              key={r.id}
              type="button"
              onClick={() => {
                setStatsRange(r.id);
                setExpandedDay(null);
              }}
              className={`filter-btn ${statsRange === r.id ? 'active' : ''}`}
              style={{ padding: '4px 10px', fontSize: '0.75rem', border: 'none', background: 'transparent', whiteSpace: 'nowrap' }}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {statsRange === 'custom' && (
        <div className="glass" style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '15px', 
          padding: '12px 15px', 
          borderRadius: '8px',
          background: 'var(--bg-secondary)',
          flexWrap: 'wrap',
          marginTop: '-10px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Desde:</span>
            <input 
              type="date" 
              className="form-control" 
              style={{ padding: '6px 10px', fontSize: '0.8rem', width: '140px' }} 
              value={statsStartDate} 
              onChange={(e) => { setStatsStartDate(e.target.value); setExpandedDay(null); }} 
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Hasta:</span>
            <input 
              type="date" 
              className="form-control" 
              style={{ padding: '6px 10px', fontSize: '0.8rem', width: '140px' }} 
              value={statsEndDate} 
              onChange={(e) => { setStatsEndDate(e.target.value); setExpandedDay(null); }} 
            />
          </div>
        </div>
      )}

      {/* Personalización */}
      <div className="glass" style={{ padding: '12px 15px', borderRadius: '8px', marginBottom: '5px' }}>
        <strong style={{ fontSize: '0.8rem', display: 'block', marginBottom: '6px' }}>🎨 Personalización del Dashboard (Métricas)</strong>
        <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', fontSize: '0.72rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: 600 }}>
            <input 
              type="checkbox" 
              checked={dashboardConfig.showTopProducts !== false} 
              onChange={() => setDashboardConfig({ ...dashboardConfig, showTopProducts: !dashboardConfig.showTopProducts })} 
            />
            <span>Ránking de Productos</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: 600 }}>
            <input 
              type="checkbox" 
              checked={dashboardConfig.showPayments !== false} 
              onChange={() => setDashboardConfig({ ...dashboardConfig, showPayments: !dashboardConfig.showPayments })} 
            />
            <span>Métodos de Pago y Envío</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: 600 }}>
            <input 
              type="checkbox" 
              checked={dashboardConfig.showFinances !== false} 
              onChange={() => setDashboardConfig({ ...dashboardConfig, showFinances: !dashboardConfig.showFinances })} 
            />
            <span>Gráficos de Ventas</span>
          </label>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '20px' }} className="admin-stats-columns">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {/* Barra de progreso de meta diaria */}
          <div className="glass" style={{ padding: '15px', borderLeft: '5px solid var(--primary-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', fontWeight: 'bold' }}>
              <span>🎯 Meta de Ventas Diaria: S/. {salesGoal.toFixed(2)}</span>
              <span style={{ color: 'var(--primary-color)' }}>{progressPercent}% Completado</span>
            </div>
            <div style={{ width: '100%', height: '8px', background: 'var(--border-color)', borderRadius: '4px', marginTop: '8px', overflow: 'hidden' }}>
              <div style={{ width: `${progressPercent}%`, height: '100%', background: 'var(--primary-color)', transition: 'width 0.4s ease' }}></div>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-light)', marginTop: '6px', marginBottom: 0 }}>
              Llevas acumulado <strong>S/. {salesToday.toFixed(2)}</strong> hoy en base a tu objetivo diario de ventas.
            </p>
          </div>

          {/* Tarjetas KPI */}
          <div className="admin-stats-grid">
            <div className="glass stat-card" style={{ padding: '12px 15px' }}>
              <span className="stat-icon" style={{ fontSize: '1.8rem', padding: '6px' }}>💰</span>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>Ventas Brutas</span>
                <div className="stat-value" style={{ fontSize: '1.15rem', fontWeight: 'bold' }}>S/. {totalSalesPeriod.toFixed(2)}</div>
              </div>
            </div>
            <div className="glass stat-card" style={{ padding: '12px 15px' }}>
              <span className="stat-icon" style={{ fontSize: '1.8rem', padding: '6px' }}>🍦</span>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>Ventas Netas</span>
                <div className="stat-value" style={{ fontSize: '1.15rem', fontWeight: 'bold' }}>S/. {netProductSales.toFixed(2)}</div>
              </div>
            </div>
            <div className="glass stat-card" style={{ padding: '12px 15px' }}>
              <span className="stat-icon" style={{ fontSize: '1.8rem', padding: '6px' }}>🚚</span>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>Envío / Delivery</span>
                <div className="stat-value" style={{ fontSize: '1.15rem', fontWeight: 'bold' }}>S/. {deliveryRevenue.toFixed(2)}</div>
              </div>
            </div>
            <div className="glass stat-card" style={{ padding: '12px 15px' }}>
              <span className="stat-icon" style={{ fontSize: '1.8rem', padding: '6px' }}>📦</span>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>Pedidos del Período</span>
                <div className="stat-value" style={{ fontSize: '1.15rem', fontWeight: 'bold' }}>{orderCountPeriod}</div>
              </div>
            </div>
            <div className="glass stat-card" style={{ padding: '12px 15px' }}>
              <span className="stat-icon" style={{ fontSize: '1.8rem', padding: '6px' }}>📈</span>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>Ticket Promedio</span>
                <div className="stat-value" style={{ fontSize: '1.15rem', fontWeight: 'bold' }}>S/. {avgTicketPeriod.toFixed(2)}</div>
              </div>
            </div>
            <div className="glass stat-card" style={{ padding: '12px 15px', background: 'rgba(255, 107, 129, 0.03)' }}>
              <span className="stat-icon" style={{ fontSize: '1.8rem', padding: '6px' }}>📋</span>
              <div>
                <button 
                  type="button"
                  className="btn btn-secondary" 
                  style={{ fontSize: '0.7rem', padding: '4px 8px', marginTop: '2px' }}
                  onClick={handleExportSalesReport}
                >
                  Copiar Reporte
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Canales de Pago */}
        <div className="glass" style={{ padding: '15px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {dashboardConfig.showPayments !== false ? (
            <>
              <strong style={{ fontSize: '0.85rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>💰 Métodos de Pago y Envío</strong>
              
              {/* Gráfico Donut SVG */}
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-light)' }}>Ventas por Canal:</span>
                {(() => {
                  const paymentData = Object.entries(salesByPayment).map(([method, amount]) => ({
                    label: method === 'Yape' ? 'Yape' : method === 'Plin' ? 'Plin' : method === 'Efectivo' ? 'Efectivo' : 'Otros',
                    value: amount,
                    color: method === 'Yape' ? 'var(--primary-color)' : method === 'Plin' ? 'var(--secondary-color)' : method === 'Efectivo' ? 'var(--success)' : 'var(--text-light)'
                  }));
                  
                  const totalPayments = paymentData.reduce((sum, item) => sum + item.value, 0);
                  if (totalPayments === 0) {
                    return <div style={{ fontSize: '0.75rem', color: 'var(--text-light)', marginTop: '5px' }}>Sin datos de pago.</div>;
                  }

                  let accumulatedPercentage = 0;
                  const radius = 30;
                  const circumference = 2 * Math.PI * radius;
                  
                  return (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px', marginTop: '8px' }}>
                      <svg width="76" height="76" viewBox="0 0 76 76" style={{ flexShrink: 0 }}>
                        <circle cx="38" cy="38" r={radius} fill="transparent" stroke="var(--border-color)" strokeWidth="8" />
                        {paymentData.map((item, idx) => {
                          const percentage = item.value / totalPayments;
                          const strokeLength = percentage * circumference;
                          const strokeOffset = circumference - (accumulatedPercentage * circumference);
                          accumulatedPercentage += percentage;
                          
                          return (
                            <circle
                              key={idx}
                              cx="38"
                              cy="38"
                              r={radius}
                              fill="transparent"
                              stroke={item.color}
                              strokeWidth="8"
                              strokeDasharray={`${strokeLength} ${circumference}`}
                              strokeDashoffset={strokeOffset}
                              transform="rotate(-90 38 38)"
                              style={{ transition: 'stroke-dashoffset 0.5s ease', cursor: 'pointer' }}
                            >
                              <title>{`${item.label}: S/. ${item.value.toFixed(2)}`}</title>
                            </circle>
                          );
                        })}
                        <circle cx="38" cy="38" r="23" fill="var(--bg-secondary)" />
                      </svg>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.7rem', flexGrow: 1 }}>
                        {paymentData.map((item, idx) => {
                          const pct = Math.round((item.value / totalPayments) * 100);
                          return (
                            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ display: 'inline-block', width: '7px', height: '7px', borderRadius: '50%', backgroundColor: item.color, flexShrink: 0 }}></span>
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                <strong>{item.label}:</strong> S/. {item.value.toFixed(2)} ({pct}%)
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Delivery vs Recojo */}
              <div style={{ borderTop: '1px dashed var(--border-color)', paddingTop: '8px', marginTop: '4px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-light)' }}>Canal de Entrega:</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px', fontSize: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>🛵 Reparto a domicilio:</span>
                    <strong>S/. {salesByDeliveryType.delivery.toFixed(2)} ({totalSalesPeriod > 0 ? Math.round((salesByDeliveryType.delivery / totalSalesPeriod) * 100) : 0}%)</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>🏪 Recojo en tienda:</span>
                    <strong>S/. {salesByDeliveryType.pickup.toFixed(2)} ({totalSalesPeriod > 0 ? Math.round((salesByDeliveryType.pickup / totalSalesPeriod) * 100) : 0}%)</strong>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', color: 'var(--text-light)', fontSize: '0.75rem', padding: '30px 15px' }}>
              📴 Métricas de Canales de Pago ocultas por personalización.
            </div>
          )}
        </div>
      </div>

      {/* Smart Pricing */}
      <div className="glass" style={{ padding: '20px', borderRadius: '8px', background: 'linear-gradient(135deg, rgba(46, 204, 113, 0.05) 0%, rgba(241, 196, 15, 0.03) 100%)', borderLeft: '5px solid var(--success)' }}>
        <h4 style={{ margin: '0 0 15px 0', fontSize: '0.9rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-dark)' }}>
          💡 Smart-Pricing & Sugerencias de Utilidades
        </h4>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '20px' }}>
          <div style={{ background: 'var(--bg-primary)', padding: '12px 15px', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-light)', fontWeight: 600 }}>Ventas Netas de Productos</span>
            <span style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--text-dark)' }}>S/. {netProductSales.toFixed(2)}</span>
          </div>
          <div style={{ background: 'var(--bg-primary)', padding: '12px 15px', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-light)', fontWeight: 600 }}>Costo Estimado de Insumos (COGS)</span>
            <span style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--danger)' }}>S/. {estimatedCOGS.toFixed(2)}</span>
          </div>
          <div style={{ background: 'var(--bg-primary)', padding: '12px 15px', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--success)' }}>S/. {estimatedUtility.toFixed(2)}</span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-light)', fontWeight: 600 }}>Utilidad Neta Estimada</span>
          </div>
          <div style={{ background: 'var(--bg-primary)', padding: '12px 15px', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--primary-color)' }}>{utilityPercentage}%</span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-light)', fontWeight: 600 }}>Rentabilidad del Catálogo</span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>🚀 Recomendaciones para Maximizar Ganancias:</span>
          {dynamicInsights.length === 0 ? (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-light)', background: 'var(--bg-primary)', padding: '10px', borderRadius: '6px', textAlign: 'center' }}>
              Registra más ventas en este período para generar sugerencias analíticas de precios.
            </div>
          ) : (
            dynamicInsights.map((insight, idx) => (
              <div key={idx} style={{ 
                background: 'var(--bg-primary)', 
                padding: '12px 15px', 
                borderRadius: '8px', 
                border: '1px solid var(--border-color)',
                display: 'flex',
                gap: '12px',
                alignItems: 'flex-start',
                fontSize: '0.75rem'
              }}>
                <span style={{ fontSize: '1.2rem', marginTop: '2px' }}>
                  {insight.type === 'pricing' ? '📈' : insight.type === 'bundle' ? '📦' : insight.type === 'ticket' ? '💰' : '✨'}
                </span>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                    <strong style={{ color: 'var(--text-dark)' }}>{insight.title}</strong>
                    <span style={{ 
                      fontSize: '0.62rem', 
                      fontWeight: 'bold', 
                      padding: '1px 6px', 
                      borderRadius: '4px', 
                      color: 'white',
                      backgroundColor: insight.type === 'pricing' ? 'var(--primary-color)' : insight.type === 'bundle' ? 'var(--secondary-color)' : 'var(--success)'
                    }}>
                      {insight.badge}
                    </span>
                  </div>
                  <div style={{ color: 'var(--text-light)', lineHeight: '1.4' }}>{insight.desc}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* SVG Tendencia */}
      {dashboardConfig.showFinances !== false && chartData.length > 1 && (
        <div className="glass" style={{ padding: '15px 20px', borderRadius: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
            <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-dark)' }}>
              📈 Gráfico de Tendencia de Ventas (S/.) - Últimos 15 Días
            </h4>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: '0.7rem', padding: '4px 10px', height: '24px', display: 'flex', alignItems: 'center', gap: '4px' }}
              onClick={handleExportFinancialsCSV}
            >
              📥 Exportar Finanzas (CSV)
            </button>
          </div>
          
          <div style={{ width: '100%', overflowX: 'auto', paddingBottom: '6px' }}>
            <div style={{ minWidth: '450px', position: 'relative', height: '160px' }}>
              <svg width="100%" height="100%" viewBox="0 0 500 160" preserveAspectRatio="none" style={{ overflow: 'visible' }}>
                <defs>
                  <linearGradient id="bar-gradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary-color)" />
                    <stop offset="100%" stopColor="var(--secondary-color)" />
                  </linearGradient>
                  <filter id="bar-shadow" x="-5%" y="-5%" width="110%" height="110%">
                    <feDropShadow dx="0" dy="2" stdDeviation="1.5" floodOpacity="0.1" />
                  </filter>
                </defs>

                <line x1="30" y1="20" x2="480" y2="20" stroke="var(--border-color)" strokeWidth="0.5" strokeDasharray="3 3" opacity="0.5" />
                <line x1="30" y1="60" x2="480" y2="60" stroke="var(--border-color)" strokeWidth="0.5" strokeDasharray="3 3" opacity="0.5" />
                <line x1="30" y1="100" x2="480" y2="100" stroke="var(--border-color)" strokeWidth="0.5" strokeDasharray="3 3" opacity="0.5" />
                <line x1="30" y1="130" x2="480" y2="130" stroke="var(--border-color)" strokeWidth="1" />
                
                <text x="25" y="23" fontSize="8" fill="var(--text-light)" textAnchor="end">{Math.round(maxSales)}</text>
                <text x="25" y="63" fontSize="8" fill="var(--text-light)" textAnchor="end">{Math.round(maxSales * 0.67)}</text>
                <text x="25" y="63" fontSize="8" fill="var(--text-light)" textAnchor="end">{Math.round(maxSales * 0.33)}</text>
                <text x="25" y="133" fontSize="8" fill="var(--text-light)" textAnchor="end">0</text>

                {chartData.map((d, idx) => {
                  const barWidth = 16;
                  const spacing = (450 - (chartData.length * barWidth)) / (chartData.length - 1 || 1);
                  const x = 32 + idx * (barWidth + spacing);
                  const height = maxSales > 0 ? (d.sales / maxSales) * 105 : 0;
                  const y = 130 - height;
                  
                  return (
                    <g key={d.dateKey} filter="url(#bar-shadow)">
                      <rect
                        x={x}
                        y={y}
                        width={barWidth}
                        height={Math.max(2, height)}
                        fill="url(#bar-gradient)"
                        rx="3"
                        style={{ transition: 'all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)', cursor: 'pointer' }}
                      >
                        <title>{`${d.dateStr}: S/. ${d.sales.toFixed(2)} (${d.validCount} pedidos)`}</title>
                      </rect>
                      
                      {d.sales > 0 && (
                        <text 
                          x={x + barWidth / 2} 
                          y={y - 4} 
                          fontSize="8" 
                          fill="var(--primary-color)" 
                          fontWeight="bold" 
                          textAnchor="middle"
                        >
                          {Math.round(d.sales)}
                        </text>
                      )}

                      <text 
                        x={x + barWidth / 2} 
                        y="144" 
                        fontSize="8" 
                        fill="var(--text-light)" 
                        textAnchor="middle" 
                        transform={`rotate(-15, ${x + barWidth / 2}, 144)`}
                      >
                        {d.dateStr.split(' ')[1]}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>
        </div>
      )}

      {/* Tabla Diaria */}
      <div className="glass" style={{ padding: '20px', borderRadius: '8px' }}>
        <h4 style={{ margin: '0 0 12px 0', fontSize: '0.85rem', fontWeight: 'bold', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
          📅 Registro Diario Detallado de Ventas
        </h4>
        <div className="admin-table-container">
          <table className="admin-table" style={{ fontSize: '0.8rem' }}>
            <thead>
              <tr>
                <th>Fecha</th>
                <th style={{ textAlign: 'center' }}>Pedidos (Válidos / Canc.)</th>
                <th style={{ textAlign: 'right' }}>Productos Neto</th>
                <th style={{ textAlign: 'right' }}>Delivery</th>
                <th style={{ textAlign: 'right' }}>Venta Bruta</th>
                <th style={{ textAlign: 'center' }}>Meta Diaria</th>
                <th style={{ textAlign: 'center' }}>Detalle</th>
              </tr>
            </thead>
            <tbody>
              {dailyHistory.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', color: 'var(--text-light)', padding: '15px' }}>No hay pedidos registrados en este período.</td>
                </tr>
              ) : (
                dailyHistory.map(day => {
                  const isGoalMet = day.sales >= salesGoal;
                  const hasOrders = day.orders.length > 0;
                  const isExpanded = expandedDay === day.dateKey;
                  
                  return (
                    <React.Fragment key={day.dateKey}>
                      <tr style={{ background: isExpanded ? 'rgba(255,107,129,0.02)' : 'transparent' }}>
                        <td><strong>{day.dateStr}</strong></td>
                        <td style={{ textAlign: 'center' }}>
                          <span style={{ color: 'var(--success)', fontWeight: 'bold' }}>{day.validCount}</span>
                          <span style={{ color: 'var(--text-light)' }}> / </span>
                          <span style={{ color: 'var(--danger)' }}>{day.canceledCount}</span>
                        </td>
                        <td style={{ textAlign: 'right' }}>S/. {day.subtotal.toFixed(2)}</td>
                        <td style={{ textAlign: 'right', color: 'var(--text-light)' }}>S/. {day.deliveryFee.toFixed(2)}</td>
                        <td style={{ textAlign: 'right' }}><strong style={{ color: 'var(--primary-color)' }}>S/. {day.sales.toFixed(2)}</strong></td>
                        <td style={{ textAlign: 'center' }}>
                          {day.sales === 0 ? (
                            <span style={{ color: 'var(--text-light)' }}>-</span>
                          ) : isGoalMet ? (
                            <span style={{ backgroundColor: 'rgba(46, 204, 113, 0.15)', color: 'var(--success)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 'bold' }}>🎯 Superada</span>
                          ) : (
                            <span style={{ backgroundColor: 'rgba(241, 196, 15, 0.15)', color: 'var(--secondary-color)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 'bold' }}>⏳ Pendiente</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button 
                            type="button"
                            className="btn btn-secondary" 
                            style={{ padding: '3px 8px', fontSize: '0.65rem', minWidth: '70px', height: '24px' }}
                            onClick={() => setExpandedDay(isExpanded ? null : day.dateKey)}
                            disabled={!hasOrders}
                          >
                            {isExpanded ? '🔼 Cerrar' : '👁️ Ver Detalle'}
                          </button>
                        </td>
                      </tr>
                      
                      {isExpanded && (
                        <tr>
                          <td colSpan="7" style={{ background: 'var(--bg-secondary)', padding: '12px 15px' }}>
                            <div style={{ borderLeft: '3px solid var(--primary-color)', paddingLeft: '12px' }}>
                              <h5 style={{ margin: '0 0 10px 0', fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-dark)' }}>
                                📋 Pedidos del {day.dateStr}
                              </h5>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {day.orders.map(o => (
                                  <div 
                                    key={o.id} 
                                    className="glass" 
                                    style={{ 
                                      padding: '10px', 
                                      borderRadius: '6px', 
                                      fontSize: '0.75rem',
                                      border: '1px solid var(--border-color)',
                                      background: 'var(--bg-primary)',
                                      display: 'flex',
                                      flexWrap: 'wrap',
                                      justifyContent: 'space-between',
                                      alignItems: 'center',
                                      gap: '10px'
                                    }}
                                  >
                                    <div>
                                      <strong style={{ color: 'var(--primary-color)' }}>{o.id}</strong> 
                                      <span style={{ color: 'var(--text-light)', marginLeft: '6px' }}>({new Date(o.date).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })})</span>
                                      <div style={{ fontWeight: 600, marginTop: '2px' }}>{o.customer.name} - 📞 {o.customer.phone}</div>
                                      <div style={{ color: 'var(--text-light)', fontSize: '0.7rem' }}>📍 {o.customer.address}</div>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                      <span style={{ 
                                        padding: '1px 6px', 
                                        borderRadius: '4px', 
                                        fontSize: '0.65rem', 
                                        fontWeight: 'bold',
                                        color: 'white',
                                        backgroundColor: o.status === 'Entregado' ? 'var(--success)' : o.status === 'Cancelado' ? 'var(--danger)' : 'var(--secondary-color)'
                                      }}>
                                        {o.status}
                                      </span>
                                      <div style={{ marginTop: '4px' }}>
                                        <span>Método: <strong>{o.customer.paymentMethod}</strong></span>
                                        <span style={{ marginLeft: '12px' }}>Total: <strong style={{ color: 'var(--primary-color)' }}>S/. {o.grandTotal.toFixed(2)}</strong></span>
                                      </div>
                                    </div>
                                    
                                    <div style={{ width: '100%', borderTop: '1px dashed var(--border-color)', paddingTop: '6px', marginTop: '4px', fontSize: '0.7rem', color: 'var(--text-light)' }}>
                                      <strong>Productos en el Pedido:</strong>
                                      <ul style={{ margin: '4px 0 0 0', paddingLeft: '15px' }}>
                                        {o.items.map((item, idx) => (
                                          <li key={idx}>
                                            {item.quantity}x {item.name || (item.type === 'custom' ? 'Helado Personalizado' : 'Pack')} - S/. {item.price.toFixed(2)}
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Ránking de los Más Vendidos */}
      {dashboardConfig.showTopProducts !== false && (
        <div className="glass" style={{ padding: '20px', borderRadius: '8px' }}>
          <h4 style={{ margin: '0 0 15px 0', fontSize: '0.85rem', fontWeight: 'bold', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
            🏆 Ránking de los Más Vendidos ({statsRange === 'today' ? 'Hoy' : statsRange === 'yesterday' ? 'Ayer' : statsRange === '7days' ? '7 Días' : statsRange === '30days' ? '30 Días' : statsRange === 'thismonth' ? 'Este Mes' : 'Período'})
          </h4>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '25px' }}>
            {/* Sabores */}
            <div>
              <h5 style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--primary-color)', margin: '0 0 10px 0' }}>🍧 Sabores Más Vendidos</h5>
              {sortedFlavors.length === 0 ? (
                <span style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>Sin ventas en este período.</span>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {sortedFlavors.map(([name, count], idx) => {
                    const maxVal = sortedFlavors[0][1] || 1;
                    const pct = Math.round((count / maxVal) * 100);
                    return (
                      <div key={name}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '3px' }}>
                          <span><strong>#{idx + 1}</strong> {name}</span>
                          <span style={{ color: 'var(--text-light)' }}>{count} bola{count > 1 ? 's' : ''}</span>
                        </div>
                        <div style={{ width: '100%', height: '6px', background: 'var(--border-color)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: 'var(--primary-color)', borderRadius: '3px' }}></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Envases */}
            <div>
              <h5 style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--secondary-color)', margin: '0 0 10px 0' }}>👑 Envases Favoritos</h5>
              {sortedBases.length === 0 ? (
                <span style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>Sin ventas en este período.</span>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {sortedBases.map(([name, count], idx) => {
                    const maxVal = sortedBases[0][1] || 1;
                    const pct = Math.round((count / maxVal) * 100);
                    return (
                      <div key={name}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '3px' }}>
                          <span><strong>#{idx + 1}</strong> {name}</span>
                          <span style={{ color: 'var(--text-light)' }}>{count} pedido{count > 1 ? 's' : ''}</span>
                        </div>
                        <div style={{ width: '100%', height: '6px', background: 'var(--border-color)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: 'var(--secondary-color)', borderRadius: '3px' }}></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Toppings */}
            <div>
              <h5 style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--info)', margin: '0 0 10px 0' }}>🍬 Toppings & Salsas</h5>
              {sortedToppings.length === 0 ? (
                <span style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>Sin ventas en este período.</span>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {sortedToppings.map(([name, count], idx) => {
                    const maxVal = sortedToppings[0][1] || 1;
                    const pct = Math.round((count / maxVal) * 100);
                    return (
                      <div key={name}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '3px' }}>
                          <span><strong>#{idx + 1}</strong> {name}</span>
                          <span style={{ color: 'var(--text-light)' }}>{count} porci{count > 1 ? 'ones' : 'ón'}</span>
                        </div>
                        <div style={{ width: '100%', height: '6px', background: 'var(--border-color)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: 'var(--info)', borderRadius: '3px' }}></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Combos */}
            <div>
              <h5 style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--success)', margin: '0 0 10px 0' }}>🎁 Combos Más Pedidos</h5>
              {sortedPacks.length === 0 ? (
                <span style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>Sin ventas en este período.</span>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {sortedPacks.map(([name, count], idx) => {
                    const maxVal = sortedPacks[0][1] || 1;
                    const pct = Math.round((count / maxVal) * 100);
                    return (
                      <div key={name}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '3px' }}>
                          <span><strong>#{idx + 1}</strong> {name}</span>
                          <span style={{ color: 'var(--text-light)' }}>{count} combo{count > 1 ? 's' : ''}</span>
                        </div>
                        <div style={{ width: '100%', height: '6px', background: 'var(--border-color)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: 'var(--success)', borderRadius: '3px' }}></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
