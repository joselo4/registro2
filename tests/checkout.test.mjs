import test from 'node:test';
import assert from 'node:assert/strict';
import { checkoutTotals, checkoutStorage, addCartItem, subtractOrderedItems, readCartDraft } from '../src/utils/checkout.js';
import { isShopOpenCurrently } from '../src/utils/storeHours.js';
import { validateOrderInput } from '../src/utils/orderValidation.js';

const item = { type: 'pack', id: 'duo', price: 10, quantity: 1, name: 'Pack dúo' };
test('checkout rounds cents and caps discounts without discounting delivery', () => {
  assert.deepEqual(checkoutTotals([{ ...item, price: '3.33', quantity: 3 }], { deliveryFee: '2.50', coupon: { type: 'percentage', value: 10 } }), { subtotal: 9.99, shipping: 2.5, discount: 1, total: 11.49, freeDelivery: false });
  assert.equal(checkoutTotals([item], { deliveryFee: 3, coupon: { type: 'flat', value: 100 } }).total, 3);
  assert.equal(checkoutTotals([item], { deliveryFee: 3, coupon: { type: 'percentage', value: -10 } }).discount, 0);
  assert.equal(checkoutTotals([item], { deliveryFee: 3, freeDeliveryThreshold: '10' }).shipping, 0);
  assert.equal(checkoutTotals([item], { deliveryFee: 3, freeDeliveryThreshold: 10, freeDeliveryEnabled: false }).shipping, 3);
  assert.equal(checkoutTotals([item], { orderType: 'Mesa', deliveryFee: 3 }).shipping, 0);
});

test('rapid additions never mutate earlier drafts and preserve purchased quantities', () => {
  const initial = [item];
  const updated = addCartItem(addCartItem(initial, item), item);
  assert.equal(initial[0].quantity, 1);
  assert.equal(updated[0].quantity, 3);
  assert.equal(addCartItem([{ ...item, quantity: 99 }], item)[0].quantity, 99);
  assert.equal(subtractOrderedItems(updated, [item])[0].quantity, 2);
  assert.deepEqual(subtractOrderedItems([item, { ...item, id: 'new' }], [item]), [{ ...item, id: 'new' }]);
  assert.equal(addCartItem([item], { ...item, price: 12 }).length, 2);
});

test('blocked storage and quota failures retain the latest pending receipt in memory', () => {
  const old = globalThis.localStorage;
  globalThis.localStorage = { getItem: () => 'stale', setItem() { throw new Error('quota'); }, removeItem() { throw new Error('blocked'); } };
  try {
    checkoutStorage.setItem('retry-test', 'latest-retry-key');
    assert.equal(checkoutStorage.getItem('retry-test'), 'latest-retry-key');
    checkoutStorage.removeItem('retry-test');
    assert.equal(checkoutStorage.getItem('retry-test'), null);
    for (const value of ['bad json', '{}', '[null]', '[{"quantity":100,"price":5}]']) {
      checkoutStorage.setItem('helados_cart_draft', value);
      assert.deepEqual(readCartDraft(), []);
    }
    checkoutStorage.setItem('helados_cart_draft', JSON.stringify([{ ...item, price: '10', quantity: '2' }]));
    assert.deepEqual(readCartDraft(), [{ ...item, quantity: 2 }]);
  } finally { checkoutStorage.removeItem('helados_cart_draft'); globalThis.localStorage = old; }
});

test('store uses Peru time, handles midnight, and closes at the configured time', () => {
  const config = { open: true, useHours: true, hours: { monday: { enabled: true, open: '20:00', close: '02:00' } } };
  assert.equal(isShopOpenCurrently(config, new Date('2026-09-08T04:00:00Z')), true); // Monday 23:00 Lima
  assert.equal(isShopOpenCurrently(config, new Date('2026-09-08T06:59:00Z')), true);
  assert.equal(isShopOpenCurrently(config, new Date('2026-09-08T07:00:00Z')), false);
  assert.equal(isShopOpenCurrently({ ...config, open: false }, new Date('2026-09-08T04:00:00Z')), false);
  assert.equal(isShopOpenCurrently({ open: true, useHours: false }), true);
});

test('checkout rejects invalid quantities, impossible prices and oversized phone numbers', () => {
  const customer = { name: 'Cliente', phone: '999999999', address: 'Jr. Prueba 123', paymentMethod: 'Yape' };
  for (const change of [{ quantity: 100 }, { quantity: -1 }, { quantity: 1.5 }, { price: NaN }, { price: -1 }]) assert.equal(validateOrderInput({ ...customer, cart: [{ ...item, ...change }] }).isValid, false);
  assert.equal(validateOrderInput({ ...customer, cart: [item], phone: '9'.repeat(16) }).isValid, false);
});
