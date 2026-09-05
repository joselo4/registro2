/**
 * Utilidad para generar y despachar el Reporte Nocturno Automático de Ventas a Telegram.
 */

export const generateDailyReportText = ({
  orders = [],
  expenses = [],
  storeName = 'Friozo',
  customDate = null
}) => {
  const targetDate = customDate ? new Date(customDate) : new Date();
  
  // Usar zona horaria de Lima (Perú)
  const limaDateStr = targetDate.toLocaleDateString('en-CA', { timeZone: 'America/Lima' }); // YYYY-MM-DD
  const prettyDateStr = targetDate.toLocaleDateString('es-PE', {
    timeZone: 'America/Lima',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  // Filtrar órdenes completadas o activas del día (excluyendo canceladas)
  const todayOrders = orders.filter(o => {
    if (o.status === 'Cancelado') return false;
    const orderLimaDate = new Date(o.date).toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
    return orderLimaDate === limaDateStr;
  });

  // Filtrar gastos del día
  const todayExpenses = (expenses || []).filter(e => {
    const expenseLimaDate = new Date(e.date || Date.now()).toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
    return expenseLimaDate === limaDateStr;
  });

  const totalSales = todayOrders.reduce((sum, o) => sum + (Number(o.grandTotal) || 0), 0);
  const totalExpenses = todayExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const netProfit = totalSales - totalExpenses;

  // Desglose por método de pago
  let cashSales = 0;
  let yapeSales = 0;
  let cardSales = 0;
  let otherSales = 0;

  let deliveryCount = 0;
  let tableCount = 0;
  let takeAwayCount = 0;

  const itemCounts = {};

  todayOrders.forEach(o => {
    const method = String(o.paymentMethod || '').toLowerCase();
    const amount = Number(o.grandTotal) || 0;

    if (method.includes('efectivo')) {
      cashSales += amount;
    } else if (method.includes('yape') || method.includes('plin')) {
      yapeSales += amount;
    } else if (method.includes('tarjeta') || method.includes('pos')) {
      cardSales += amount;
    } else {
      otherSales += amount;
    }

    const type = o.customer?.orderType;
    if (type === 'Delivery' || (o.deliveryFee > 0)) {
      deliveryCount++;
    } else if (type === 'Mesa' || o.customer?.tableNumber) {
      tableCount++;
    } else {
      takeAwayCount++;
    }

    (o.items || []).forEach(item => {
      const name = item.name || 'Producto';
      itemCounts[name] = (itemCounts[name] || 0) + (item.quantity || 1);
    });
  });

  // Top 3 productos más vendidos
  const sortedItems = Object.entries(itemCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, qty], i) => `   ${i + 1}. ${name} (${qty} u.)`)
    .join('\n');

  return (
    `📊 *REPORTE DE CIERRE DIARIO - ${storeName.toUpperCase()}*\n` +
    `🗓️ _${prettyDateStr}_\n\n` +
    `💰 *VENTAS TOTALES:* *S/ ${totalSales.toFixed(2)}*\n` +
    `📦 *Pedidos Atendidos:* *${todayOrders.length}*\n` +
    `💸 *Gastos del Día:* S/ ${totalExpenses.toFixed(2)}\n` +
    `📈 *Balance Neto:* *S/ ${netProfit.toFixed(2)}*\n\n` +
    `💳 *DESGLOSE POR FORMA DE PAGO:*\n` +
    `• 💵 Efectivo en Caja: S/ ${cashSales.toFixed(2)}\n` +
    `• 📱 Yape / Plin: S/ ${yapeSales.toFixed(2)}\n` +
    `• 💳 Tarjetas / POS: S/ ${cardSales.toFixed(2)}\n` +
    (otherSales > 0 ? `• 🔄 Otros: S/ ${otherSales.toFixed(2)}\n` : '') +
    `\n🛵 *CANALES DE ATENCIÓN:*\n` +
    `• 🛵 Delivery: ${deliveryCount} pedidos\n` +
    `• 🍽️ Salón / Mesas: ${tableCount} pedidos\n` +
    `• 🥡 Para Llevar: ${takeAwayCount} pedidos\n` +
    (sortedItems ? `\n🍦 *PRODUCTOS MÁS VENDIDOS:*\n${sortedItems}\n` : '') +
    `\n_Reporte generado automáticamente por el sistema de operadores Friozo._`
  );
};

export const sendTelegramDailyReport = async ({
  orders = [],
  expenses = [],
  storeName = 'Friozo',
  showAlert = null
}) => {
  try {
    const textMsg = generateDailyReportText({ orders, expenses, storeName });
    const response = await fetch('/api/telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: textMsg,
        parse_mode: 'Markdown',
        kind: 'daily_report'
      })
    });

    const resData = await response.json().catch(() => ({}));
    if (response.ok && resData.ok !== false) {
      if (showAlert) {
        showAlert('Reporte Enviado', 'El reporte diario de ventas se envió con éxito a Telegram.', 'success');
      }
      return true;
    } else {
      throw new Error(resData.error || 'No se pudo enviar el mensaje a Telegram.');
    }
  } catch (err) {
    console.warn('Error enviando reporte diario a Telegram:', err.message);
    if (showAlert) {
      showAlert('Error al Enviar Reporte', err.message, 'error');
    }
    return false;
  }
};

export const sendDailySalesReportToTelegram = async (params) => {
  const ok = await sendTelegramDailyReport(params);
  return { success: ok, error: ok ? null : 'No se pudo despachar el mensaje a Telegram' };
};
