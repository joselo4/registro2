import test from 'node:test';
import assert from 'node:assert/strict';
import { PAYMENT_METHODS, getEnabledPaymentMethods, getCollectionPaymentMethods, selectPaymentMethod } from '../src/utils/paymentMethods.js';
import { isPaymentOnArrival, requiresAdvancePayment, paymentDescription } from '../src/utils/orderLifecycle.js';

test('payment settings round-trip without losing disabled methods; stale selection falls back', () => {
  assert.deepEqual(getEnabledPaymentMethods(), PAYMENT_METHODS);
  const config = JSON.parse(JSON.stringify({ paymentMethods: { Yape: false, Plin: false, Efectivo: false, Transferencia: false, Tarjeta: true } }));
  assert.deepEqual(getEnabledPaymentMethods(config), ['Tarjeta']);
  assert.equal(selectPaymentMethod('Yape', getEnabledPaymentMethods(config)), 'Tarjeta');
  config.paymentMethods.Tarjeta = false;
  assert.equal(selectPaymentMethod('Yape', getEnabledPaymentMethods(config)), '');
  config.paymentMethods.Plin = true;
  assert.equal(selectPaymentMethod('', getEnabledPaymentMethods(config)), 'Plin');
});

test('existing orders keep only their agreed disabled method in addition to enabled methods', () => {
  const config = { paymentMethods: { Yape: false, Tarjeta: false } };
  assert.deepEqual(getCollectionPaymentMethods(config, { customer: { paymentMethod: 'Tarjeta' } }), ['Plin', 'Efectivo', 'Transferencia', 'Tarjeta']);
});

test('card orders collect on arrival and never claim an advance payment', () => {
  const order = { customer: { paymentMethod: 'Tarjeta' } };
  assert.equal(isPaymentOnArrival(order), true);
  assert.equal(requiresAdvancePayment(order), false);
  assert.equal(paymentDescription(order), 'Tarjeta · Pago al llegar');
});
