import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import OrderManager from '../src/components/admin/OrderManager.jsx';
import KitchenDisplaySystem from '../src/components/admin/KitchenDisplaySystem.jsx';
import DriverDeliveryPanel from '../src/components/admin/DriverDeliveryPanel.jsx';

const order = status => ({ id: `PED-${status === 'Por Corroborar' ? 'VALIDAR' : status.toUpperCase()}`, status, date: new Date().toISOString(), customer: { name: 'Cliente de prueba', phone: '999999999', paymentMethod: 'Efectivo', orderType: 'Delivery', address: 'Dirección de prueba' }, assignedDriver: { id: 'driver', email: 'driver@example.test' }, grandTotal: 10, total: 10, deliveryFee: 0, items: [{ type: 'pack', name: 'Helado', quantity: 1, price: 10 }], statusHistory: [] });
const props = { flavors: [], toppings: [], bases: [], packs: [], shopConfig: {}, currentUser: { name: 'Operador' }, addLog: () => {}, onUpdateOrderStatus: async () => true, onUpdateOrders: async () => true };

test('kitchen only offers preparation for accepted orders; validation stays out of its queue', () => {
  const html = renderToStaticMarkup(<KitchenDisplaySystem {...props} orders={[order('Por Corroborar'), order('Pendiente'), order('Preparando')]} />);
  assert.ok(!html.includes('PED-VALIDAR'));
  assert.ok(html.includes('PED-PENDIENTE'));
  assert.ok(html.includes('Empezar a Preparar'));
  assert.ok(html.includes('Marcar listo para entregar'));
  assert.ok(html.includes('Listos para entregar'));
  assert.ok(!html.includes('Servido en Mesa'));
});

test('management separates ready from route and removes the arbitrary status selector', () => {
  const html = renderToStaticMarkup(<OrderManager {...props} orders={[order('Preparando'), order('Listo')]} />);
  assert.ok(html.includes('Marcar listo'));
  assert.ok(html.includes('Despachar a Ruta'));
  assert.ok(html.includes('Listos'));
  assert.ok(!html.includes('Cambiar estado manualmente'));
});

test('driver sees only ready assigned orders and never starts a pending preparation', () => {
  const html = renderToStaticMarkup(<DriverDeliveryPanel {...props} currentUser={{ id: 'driver', email: 'driver@example.test' }} orders={[order('Pendiente'), order('Preparando'), order('Listo')]} />);
  assert.ok(!html.includes('PED-PENDIENTE'));
  assert.ok(!html.includes('PED-PREPARANDO'));
  assert.ok(html.includes('PED-LISTO'));
  assert.ok(html.includes('Iniciar Reparto'));
});

for (const method of ['Yape', 'Plin', 'Efectivo', 'Transferencia', 'Tarjeta']) {
  test(`driver warns about unpaid ${method} on arrival and shows all collection methods`, () => {
    const delivery = order('En camino');
    delivery.customer = { ...delivery.customer, paymentMethod: method, paymentTiming: 'Al llegar' };
    const html = renderToStaticMarkup(<DriverDeliveryPanel {...props} currentUser={{ id: 'driver' }} orders={[delivery]} />);
    assert.ok(html.includes('SOLICITAR PAGO ANTES DE ENTREGAR'));
    assert.ok(html.includes('Confirmar cobro y entrega'));
    assert.ok(html.includes('S/. 10.00'));
    for (const option of ['Yape', 'Plin', 'Efectivo', 'Transferencia', 'Tarjeta']) assert.ok(html.includes(`value="${option}"`));
    assert.ok(!html.includes('PAGO CONFIRMADO'));
    const paidHtml = renderToStaticMarkup(<DriverDeliveryPanel {...props} currentUser={{ id: 'driver' }} orders={[{ ...delivery, paymentVerified: true }]} />);
    assert.ok(paidHtml.includes('No volver a cobrar'));
    assert.ok(!paidHtml.includes('Confirmar cobro y entrega'));
  });
}

test('management accepts payment on arrival without requesting an advance voucher', () => {
  const pending = order('Por Corroborar');
  pending.customer = { ...pending.customer, paymentMethod: 'Yape', paymentTiming: 'Al llegar' };
  const html = renderToStaticMarkup(<OrderManager {...props} orders={[pending]} />);
  assert.ok(html.includes('Pago al llegar'));
  assert.ok(html.includes('Pendiente de cobro'));
  assert.ok(!html.includes('para iniciar la preparaci'));
});
