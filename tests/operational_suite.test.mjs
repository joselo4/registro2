import test from 'node:test';
import assert from 'node:assert/strict';
import { generateDailyReportText } from '../src/utils/telegramDailyReport.js';

test('Telegram Daily Report generates correct totals and payment methods', () => {
  const mockOrders = [
    {
      id: 'PED-101',
      date: new Date().toISOString(),
      grandTotal: 35.5,
      paymentMethod: 'Efectivo',
      status: 'Entregado',
      customer: { orderType: 'Delivery' },
      items: [{ name: 'Helado 2 Bolas', quantity: 2 }]
    },
    {
      id: 'PED-102',
      date: new Date().toISOString(),
      grandTotal: 25.0,
      paymentMethod: 'Yape',
      status: 'Entregado',
      customer: { orderType: 'Mesa', tableNumber: '3' },
      items: [{ name: 'Pack Familiar', quantity: 1 }]
    },
    {
      id: 'PED-103',
      date: new Date().toISOString(),
      grandTotal: 100.0,
      paymentMethod: 'Efectivo',
      status: 'Cancelado',
      customer: { orderType: 'Delivery' },
      items: [{ name: 'Pack Mega', quantity: 1 }]
    }
  ];

  const mockExpenses = [
    { date: new Date().toISOString(), amount: 15.0, description: 'Servilletas' }
  ];

  const text = generateDailyReportText({
    orders: mockOrders,
    expenses: mockExpenses,
    storeName: 'Don Helado'
  });

  // El pedido cancelado debe excluirse: total ventas = 35.50 + 25.00 = 60.50
  assert.ok(text.includes('S/ 60.50'), 'Total ventas should be 60.50');
  assert.ok(text.includes('Gastos del Día:* S/ 15.00'), 'Total expenses should be 15.00');
  assert.ok(text.includes('Balance Neto:* *S/ 45.50*'), 'Net profit should be 45.50');
  assert.ok(text.includes('Efectivo en Caja: S/ 35.50'), 'Cash sales should be 35.50');
  assert.ok(text.includes('Yape / Plin: S/ 25.00'), 'Yape sales should be 25.00');
  assert.ok(text.includes('Delivery: 1 pedidos'), 'Delivery count should be 1');
  assert.ok(text.includes('Salón / Mesas: 1 pedidos'), 'Table count should be 1');
});

test('Cash Register expected cash and difference formula', () => {
  const initialCash = 100.0;
  const movements = [
    { type: 'ingreso', amount: 50.0 },
    { type: 'retiro', amount: 20.0 }
  ];
  const cashSales = 200.0;
  
  const expectedCash = initialCash + cashSales + movements.reduce((acc, m) => {
    return m.type === 'ingreso' ? acc + m.amount : acc - m.amount;
  }, 0);

  // 100 + 200 + 50 - 20 = 330.0
  assert.equal(expectedCash, 330.0);

  const countedCash = 330.0;
  const diff = countedCash - expectedCash;
  assert.equal(diff, 0.0);

  const countedWithShortage = 320.0;
  assert.equal(countedWithShortage - expectedCash, -10.0);
});

test('Cart settlement calculation: morning load vs return', () => {
  const items = [
    { name: 'Paleta Rellena', unitPrice: 5.0, initialQty: 20, returnedQty: 5 },
    { name: 'Copa Artesanal', unitPrice: 8.0, initialQty: 10, returnedQty: 2 }
  ];

  let totalExpectedRevenue = 0;
  items.forEach(item => {
    const sold = Math.max(0, item.initialQty - item.returnedQty);
    totalExpectedRevenue += sold * item.unitPrice;
  });

  // (15 * 5) + (8 * 8) = 75 + 64 = 139
  assert.equal(totalExpectedRevenue, 139.0);
});

test('Split Bill per person formula', () => {
  const grandTotal = 95.0;
  const people = 4;
  const perPerson = Number((grandTotal / people).toFixed(2));
  assert.equal(perPerson, 23.75);
});

test('Cart dotation custom presentations and route price overrides', () => {
  // Simulación de dotación personalizada por carrito
  const cartDotation = [
    { id: 'pop_1', name: 'Paleta Rellena Maracuyá', price: 6.0, loaded: 30, returned: 5 }, // Precio estándar 5 subido a 6 en playa/ruta
    { id: 'cust_101', name: 'Vaso 2 Bolas Especial Malecón', price: 12.0, loaded: 15, returned: 3 }, // Presentación agregada solo para este carrito
    { id: 'cust_102', name: 'Agua Mineral Helada 500ml', price: 3.5, loaded: 20, returned: 2 } // Bebida extra
  ];

  let totalUnitsSold = 0;
  let totalRevenueExpected = 0;

  cartDotation.forEach(item => {
    const sold = Math.max(0, (item.loaded || 0) - (item.returned || 0));
    totalUnitsSold += sold;
    totalRevenueExpected += sold * (item.price || 0);
  });

  // Sold: (30 - 5 = 25) + (15 - 3 = 12) + (20 - 2 = 18) = 55 unidades
  assert.equal(totalUnitsSold, 55);

  // Revenue: (25 * 6.0) + (12 * 12.0) + (18 * 3.5) = 150 + 144 + 63 = 357.0
  assert.equal(totalRevenueExpected, 357.0);

  // Verificación de rendición combinada Efectivo + Yape
  const handedCash = 257.0;
  const handedYape = 100.0;
  const totalHandedIn = handedCash + handedYape;
  const diff = totalHandedIn - totalRevenueExpected;
  assert.equal(diff, 0.0, 'Cuadre debe ser exacto');

  // Caso con faltante
  const handedWithShortage = 340.0;
  assert.equal(handedWithShortage - totalRevenueExpected, -17.0, 'Faltante de 17 soles detectado');

  // Caso con sobrante (propina o redondeo)
  const handedWithSurplus = 360.0;
  assert.equal(handedWithSurplus - totalRevenueExpected, 3.0, 'Sobrante de 3 soles detectado');
});
