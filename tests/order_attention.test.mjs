import test from 'node:test';
import assert from 'node:assert/strict';
import { orderAttention, formatWait, STATUS_LIMIT_MINUTES } from '../src/utils/orderAttention.js';

const NOW = Date.parse('2026-10-29T15:00:00Z');
const ago = minutes => new Date(NOW - minutes * 60000).toISOString();
const order = (id, status, minutesAgo) => ({ id, status, date: ago(minutesAgo + 5), statusHistory: [{ status, timestamp: ago(minutesAgo) }] });

test('orders waiting for validation are listed oldest first', () => {
  const result = orderAttention([order('PED-A', 'Por Corroborar', 2), order('PED-B', 'Por Corroborar', 9), order('PED-C', 'Pendiente', 1)], NOW);
  assert.deepEqual(result.toValidate.map(entry => entry.order.id), ['PED-B', 'PED-A']);
  assert.equal(result.oldestToValidateMinutes, 9);
});

test('an order is late once it passes the limit for its current status', () => {
  const result = orderAttention([
    order('PED-1', 'Pendiente', STATUS_LIMIT_MINUTES.Pendiente),
    order('PED-2', 'Preparando', 5),
    order('PED-3', 'En camino', 50),
    order('PED-4', 'Entregado', 300),
    order('PED-5', 'Cancelado', 300),
  ], NOW);
  assert.deepEqual(result.overdue.map(entry => entry.order.id).sort(), ['PED-1', 'PED-3']);
  assert.equal(result.count, 2);
});

test('age counts from the latest entry into the current status', () => {
  const moved = { id: 'PED-X', status: 'Preparando', date: ago(120), statusHistory: [{ status: 'Pendiente', timestamp: ago(100) }, { status: 'Preparando', timestamp: ago(3) }] };
  const result = orderAttention([moved], NOW);
  assert.equal(result.overdue.length, 0);
});

test('an order waiting for validation is listed once, with its lateness flagged', () => {
  const result = orderAttention([order('PED-V', 'Por Corroborar', 20)], NOW);
  assert.equal(result.toValidate.length, 1);
  assert.equal(result.toValidate[0].late, true);
  assert.equal(result.overdue.length, 0);
  assert.equal(result.count, 1);
});

test('missing or malformed orders are ignored', () => {
  assert.equal(orderAttention([null, {}, { status: 'Pendiente' }], NOW).count, 0);
  assert.equal(orderAttention(undefined, NOW).count, 0);
});

test('formatWait reads naturally in Spanish', () => {
  assert.equal(formatWait(0), 'hace un momento');
  assert.equal(formatWait(7), 'hace 7 min');
  assert.equal(formatWait(60), 'hace 1 h');
  assert.equal(formatWait(65), 'hace 1 h 5 min');
});

test('Telegram notice flags orders that wait for validation', async () => {
  const { newOrderTelegramText } = await import('../functions/api/telegram.js');
  const base = { id: 'PED-T1', grandTotal: 12, customer: { name: 'Ana', orderType: 'Delivery', paymentMethod: 'Yape' }, items: [{ quantity: 2, name: 'Paleta' }] };
  const toValidate = newOrderTelegramText({ ...base, status: 'Por Corroborar' });
  assert.ok(toValidate.startsWith('🔔 POR VALIDAR · Nuevo pedido PED-T1'));
  assert.ok(toValidate.includes('Revisa el pago y valídalo en el panel.'));
  const queued = newOrderTelegramText({ ...base, status: 'Pendiente' });
  assert.ok(queued.startsWith('Nuevo pedido PED-T1'));
  assert.ok(queued.includes('2x Paleta') && queued.includes('S/. 12.00'));
});

test('shop limits override defaults within a safe range', async () => {
  const { attentionLimits } = await import('../src/utils/orderAttention.js');
  const limits = attentionLimits({ Pendiente: 3, Preparando: 0, Listo: 999, 'En camino': '30' });
  assert.equal(limits.Pendiente, 3);
  assert.equal(limits.Preparando, STATUS_LIMIT_MINUTES.Preparando);
  assert.equal(limits.Listo, STATUS_LIMIT_MINUTES.Listo);
  assert.equal(limits['En camino'], 30);
  const result = orderAttention([order('PED-Q', 'Pendiente', 4)], NOW, { Pendiente: 3 });
  assert.equal(result.overdue.length, 1);
});
