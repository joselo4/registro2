import test from 'node:test';
import assert from 'node:assert/strict';
import { validateOrderInput, getOrderStageInfo } from '../src/utils/orderValidation.js';
import { OPEN_STATUSES, NEXT_STATUS, operationsSummary } from '../src/utils/operations.js';

test('Order input validation rejects empty cart', () => {
  const result = validateOrderInput({
    cart: [],
    name: 'Juan Perez',
    phone: '987654321',
    address: 'Av. Primavera 123',
    orderType: 'Delivery',
    paymentMethod: 'Yape'
  });
  assert.equal(result.isValid, false);
  assert.ok(result.errors.cart);
});

test('Order input validation rejects invalid phone (< 9 digits)', () => {
  const result = validateOrderInput({
    cart: [{ id: '1', name: 'Helado', price: 10, quantity: 1 }],
    name: 'Maria Quispe',
    phone: '98765', // Invalid: only 5 digits
    address: 'Av. Los Próceres 450',
    orderType: 'Delivery',
    paymentMethod: 'Plin'
  });
  assert.equal(result.isValid, false);
  assert.ok(result.errors.phone);
});

test('Order input validation rejects delivery with missing or short address', () => {
  const result = validateOrderInput({
    cart: [{ id: '1', name: 'Helado', price: 10, quantity: 1 }],
    name: 'Carlos Ruiz',
    phone: '987654321',
    address: 'Jr.', // Invalid: too short (< 5 chars)
    orderType: 'Delivery',
    paymentMethod: 'Efectivo'
  });
  assert.equal(result.isValid, false);
  assert.ok(result.errors.address);
});

test('Order input validation rejects table order without table number', () => {
  const result = validateOrderInput({
    cart: [{ id: '1', name: 'Helado', price: 10, quantity: 1 }],
    name: '',
    phone: '',
    needsTable: true,
    tableNumber: null,
    orderType: 'Mesa',
    paymentMethod: 'Efectivo'
  });
  assert.equal(result.isValid, false);
  assert.ok(result.errors.table);
});

test('Order input validation rejects occupied table', () => {
  const result = validateOrderInput({
    cart: [{ id: '1', name: 'Helado', price: 10, quantity: 1 }],
    name: 'Ana Gomez',
    phone: '912345678',
    needsTable: true,
    tableNumber: '4',
    occupiedTables: ['4', '5'],
    orderType: 'Mesa',
    paymentMethod: 'Efectivo'
  });
  assert.equal(result.isValid, false);
  assert.ok(result.errors.table);
  assert.ok(result.errors.table.includes('Mesa 4 ya cuenta con un pedido activo'));
});

test('Order input validation approves valid delivery order', () => {
  const result = validateOrderInput({
    cart: [{ id: '1', name: 'Helado 2 bolas', price: 12, quantity: 2 }],
    name: 'Pedro Ramos',
    phone: '987654321',
    address: 'Jr. Constitución 520, int 2',
    orderType: 'Delivery',
    paymentMethod: 'Yape'
  });
  assert.equal(result.isValid, true);
  assert.equal(Object.keys(result.errors).length, 0);
});

test('Order input validation approves valid table order even with blank name fallback', () => {
  const result = validateOrderInput({
    cart: [{ id: '1', name: 'Copa Helada', price: 15, quantity: 1 }],
    name: '',
    phone: '',
    needsTable: true,
    tableNumber: '2',
    occupiedTables: ['1', '3'],
    orderType: 'Mesa',
    paymentMethod: 'Efectivo'
  });
  assert.equal(result.isValid, true);
});

test('getOrderStageInfo returns correct steps for Delivery and Mesa', () => {
  assert.equal(getOrderStageInfo('Por Corroborar', true).text, '1/6 Validar pedido y pago');
  assert.equal(getOrderStageInfo('Pendiente', true).text, '2/6 En cola');
  assert.equal(getOrderStageInfo('Preparando', true).text, '3/6 Preparando');
  assert.equal(getOrderStageInfo('En camino', true).text, '5/6 En camino');
  assert.equal(getOrderStageInfo('Entregado', true).text, '6/6 Entregado');

  assert.equal(getOrderStageInfo('Por Corroborar', false).text, '1/5 Validar pedido y pago');
  assert.equal(getOrderStageInfo('Pendiente', false).text, '2/5 En cola');
  assert.equal(getOrderStageInfo('Preparando', false).text, '3/5 Preparando');
  assert.equal(getOrderStageInfo('Entregado', false).text, '5/5 Entregado');
});

test('OPEN_STATUSES includes Por Corroborar and NEXT_STATUS transitions to Pendiente', () => {
  assert.ok(OPEN_STATUSES.includes('Por Corroborar'), 'OPEN_STATUSES must include Por Corroborar');
  assert.equal(NEXT_STATUS['Por Corroborar'], 'Pendiente');
  assert.equal(NEXT_STATUS['Pendiente'], 'Preparando');
  assert.equal(NEXT_STATUS['Preparando'], 'Listo');
  assert.equal(NEXT_STATUS['En camino'], 'Entregado');
});

test('operationsSummary includes orders in Por Corroborar in queue', () => {
  const now = Date.now();
  const mockOrders = [
    {
      id: 'PED-001',
      date: new Date(now).toISOString(),
      grandTotal: 30,
      status: 'Por Corroborar',
      items: [{ type: 'custom', scoops: [{ name: 'Fresa' }], quantity: 1 }]
    },
    {
      id: 'PED-002',
      date: new Date(now).toISOString(),
      grandTotal: 20,
      status: 'Pendiente',
      items: [{ type: 'custom', scoops: [{ name: 'Chocolate' }], quantity: 1 }]
    }
  ];

  const summary = operationsSummary(mockOrders, now);
  assert.equal(summary.queue.length, 2, 'Queue must include both Por Corroborar and Pendiente orders');
});
