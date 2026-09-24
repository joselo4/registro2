import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import Cart from '../src/components/Cart.jsx';
import OrderTaker from '../src/components/admin/OrderTaker.jsx';
import TableOrderManager from '../src/components/admin/TableOrderManager.jsx';

const cart = [{ id: 'pack', type: 'pack', name: 'Helado', price: 10, quantity: 1 }];
const baseConfig = { tableOrdersEnabled: false, barOrdersEnabled: false, deliveryOrdersEnabled: false };

test('checkout muestra solo el canal de venta habilitado', () => {
  const previousStorage = globalThis.localStorage;
  globalThis.localStorage = { getItem: () => '', setItem: () => {}, removeItem: () => {} };
  try {
    const onlyBar = renderToStaticMarkup(<Cart cart={cart} shopConfig={{ ...baseConfig, barOrdersEnabled: true }} />);
    assert.match(onlyBar, /Recojo en barra/);
    assert.doesNotMatch(onlyBar, /<button[^>]*>🛵 Delivery<\/button>/);
    assert.doesNotMatch(onlyBar, /<button[^>]*>🍽️ Mesa<\/button>/);
    assert.doesNotMatch(onlyBar, /Dirección de Entrega/);
    const onlyDelivery = renderToStaticMarkup(<Cart cart={cart} shopConfig={{ ...baseConfig, deliveryOrdersEnabled: true }} />);
    assert.match(onlyDelivery, /🛵 Delivery/);
    assert.match(onlyDelivery, /Dirección de Entrega/);
    assert.doesNotMatch(onlyDelivery, /Recojo en barra/);
  } finally { globalThis.localStorage = previousStorage; }
});

test('tomador y monitor respetan el canal de tienda activo', () => {
  const shopConfig = { ...baseConfig, tableOrdersEnabled: true, totalTables: 2 };
  const taker = renderToStaticMarkup(<OrderTaker catalog={{}} shopConfig={shopConfig} orders={[]} />);
  assert.match(taker, /Número de mesa/);
  assert.match(taker, /Mesa 2/);
  assert.doesNotMatch(taker, /Atención en Barra \/ Tienda/);
  const monitor = renderToStaticMarkup(<TableOrderManager orders={[]} flavors={[]} toppings={[]} bases={[]} packs={[]} shopConfig={shopConfig} tableCalls={[]} />);
  assert.match(monitor, /Monitor de Mesas y Barra/);
  assert.match(monitor, /Mesa 1/);
  assert.doesNotMatch(monitor, /Barra \(Llevar\)/);
});
