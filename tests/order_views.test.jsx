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
