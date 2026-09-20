import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import CashRegisterManager from '../src/components/admin/CashRegisterManager.jsx';

const noop = async () => true;

test('cash register offers a real opening flow when there is no active shift', () => {
  const html = renderToStaticMarkup(
    <CashRegisterManager shifts={[]} onUpdateShifts={noop} currentUser={{ name: 'Caja' }} />
  );
  assert.ok(html.includes('Apertura de Turno de Caja'));
  assert.ok(html.includes('Abrir Caja e Iniciar Turno'));
});

test('cash register counts only delivered and collected sales after opening', () => {
  const deliveredAt = '2026-09-19T15:00:00.000Z';
  const orders = [
    {
      id: 'FIS-CASH', status: 'Entregado', paymentVerified: true, grandTotal: 25,
      customer: { paymentMethod: 'Efectivo' }, date: deliveredAt,
      statusHistory: [{ status: 'Entregado', timestamp: deliveredAt }],
    },
    {
      id: 'PED-YAPE', status: 'Entregado', paymentVerified: true, grandTotal: 18,
      customer: { paymentMethod: 'Yape' }, date: deliveredAt,
      statusHistory: [{ status: 'Entregado', timestamp: deliveredAt }],
    },
    {
      id: 'PED-PENDING', status: 'Pendiente', paymentVerified: false, grandTotal: 99,
      customer: { paymentMethod: 'Efectivo' }, date: deliveredAt,
      statusHistory: [{ status: 'Pendiente', timestamp: deliveredAt }],
    },
  ];
  const shifts = [{
    id: 'Z-TEST', status: 'open', openedAt: '2026-09-19T14:00:00.000Z',
    startingCash: 100, movements: [{ id: 'MOV-1', type: 'out', amount: 5 }],
  }];
  const html = renderToStaticMarkup(
    <CashRegisterManager orders={orders} shifts={shifts} onUpdateShifts={noop} currentUser={{ name: 'Caja' }} />
  );
  assert.ok(html.includes('Turno Activo: Z-TEST'));
  assert.ok(html.includes('+S/ 25.00'));
  assert.ok(html.includes('Yape S/ 18.00'));
  assert.ok(html.includes('S/ 120.00'));
  assert.ok(!html.includes('+S/ 124.00'));
});
