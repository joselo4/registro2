import test from 'node:test';
import assert from 'node:assert/strict';
import { isGoogleMeasurementId, toGa4Event, toMetaPayload } from '../src/utils/commerceAnalytics.js';
import { formatWebVitalEvent } from '../src/utils/performanceMonitoring.js';

test('GA4 receives its standard purchase funnel with real items and no customer data', () => {
  const item = { id: 'pack-duo', name: 'Pack Dúo', type: 'pack', price: '10.00', quantity: 2, customer: { phone: '999999999' } };
  assert.equal(toGa4Event('ViewCatalog', { items: [item] }).name, 'view_item_list');
  assert.deepEqual(toGa4Event('AddToCart', { value: 20, items: [item] }).params.items[0], {
    item_id: 'pack-duo', item_name: 'Pack Dúo', item_category: 'pack', price: 10, quantity: 2
  });
  assert.equal(toGa4Event('InitiateCheckout', { value: 20, items: [item] }).name, 'begin_checkout');
  const purchase = toGa4Event('Purchase', { transaction_id: 'PED-123', value: 18, total: 22, shipping: 4, coupon: 'AHORRA', items: [item] });
  assert.equal(purchase.name, 'purchase');
  assert.equal(purchase.params.value, 18);
  assert.equal(purchase.params.shipping, 4);
  assert.equal(purchase.params.transaction_id, 'PED-123');
  assert.ok(!JSON.stringify(purchase).includes('999999999'));
  assert.equal(toGa4Event('Purchase', { value: 10, items: [item] }), null);
  assert.equal(toMetaPayload('Purchase', { total: 22, items: [item] }).value, 22);
});

test('web vital events use metric IDs and discard query strings with order codes', () => {
  assert.equal(isGoogleMeasurementId('G-ABC123XYZ'), true);
  assert.equal(isGoogleMeasurementId('G-ABC&bad=1'), false);
  const event = formatWebVitalEvent({ name: 'LCP', id: 'v4-12', value: 1800, delta: 1800, rating: 'good' }, 'https://tienda.example/pedir?track=PED-123');
  assert.equal(event.name, 'web_vital_lcp');
  assert.equal(event.params.metric_value, 1800);
  assert.equal(event.params.page_location, 'https://tienda.example/pedir');
});
