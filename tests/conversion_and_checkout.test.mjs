import test from 'node:test';
import assert from 'node:assert/strict';
import { checkoutTotals, addCartItem } from '../src/utils/checkout.js';
import { formatDriverDispatchMessage } from '../src/utils/orderMessaging.js';

test('free delivery progress calculation reflects correct missing amount and unlocked state', () => {
  const threshold = 30.0;
  
  // Case 1: Subtotal under threshold
  const cartUnder = [
    { type: 'pack', id: 'pack-1', price: 18.0, quantity: 1 }
  ];
  const totalsUnder = checkoutTotals(cartUnder, {
    deliveryFee: 5.0,
    freeDeliveryThreshold: threshold,
    freeDeliveryEnabled: true,
    orderType: 'Delivery'
  });
  assert.equal(totalsUnder.subtotal, 18.0);
  assert.equal(totalsUnder.freeDelivery, false);
  assert.equal(totalsUnder.shipping, 5.0);
  const missingUnder = threshold - totalsUnder.subtotal;
  assert.equal(missingUnder, 12.0);
  const percentageUnder = Math.min(100, (totalsUnder.subtotal / threshold) * 100);
  assert.equal(percentageUnder, 60.0);

  // Case 2: Subtotal exactly or above threshold
  const cartOver = [
    { type: 'pack', id: 'pack-1', price: 18.0, quantity: 2 }
  ];
  const totalsOver = checkoutTotals(cartOver, {
    deliveryFee: 5.0,
    freeDeliveryThreshold: threshold,
    freeDeliveryEnabled: true,
    orderType: 'Delivery'
  });
  assert.equal(totalsOver.subtotal, 36.0);
  assert.equal(totalsOver.freeDelivery, true);
  assert.equal(totalsOver.shipping, 0);

  // Case 3: Mesa / Consumo local always has free delivery
  const totalsMesa = checkoutTotals(cartUnder, {
    deliveryFee: 5.0,
    freeDeliveryThreshold: threshold,
    freeDeliveryEnabled: true,
    orderType: 'Mesa'
  });
  assert.equal(totalsMesa.freeDelivery, true);
  assert.equal(totalsMesa.shipping, 0);
});

test('impulse cross-sell add-on items sum accurately and increment quantities', () => {
  const baseItem = { type: 'custom', id: 'ice-1', price: 8.5, quantity: 1, name: 'Helado Personalizado' };
  const impulseFudge = { type: 'extra', id: 'impulse_fudge', price: 1.5, quantity: 1, name: 'Salsa Fudge Artesanal' };
  const impulseOreo = { type: 'extra', id: 'impulse_oreo', price: 1.5, quantity: 1, name: 'Topping Galleta Oreo' };

  let cart = [baseItem];
  cart = addCartItem(cart, impulseFudge);
  cart = addCartItem(cart, impulseOreo);

  assert.equal(cart.length, 3);
  const totals = checkoutTotals(cart, { deliveryFee: 0 });
  assert.equal(totals.subtotal, 11.5); // 8.5 + 1.5 + 1.5

  // Adding the same impulse item again increments its quantity
  cart = addCartItem(cart, impulseFudge);
  assert.equal(cart.length, 3);
  const updatedFudge = cart.find(i => i.id === 'impulse_fudge');
  assert.equal(updatedFudge.quantity, 2);

  const updatedTotals = checkoutTotals(cart, { deliveryFee: 0 });
  assert.equal(updatedTotals.subtotal, 13.0);
});

test('operation code is cleanly included in driver dispatch message when provided', () => {
  const orderWithOpCode = {
    id: 'ORD-9898',
    grandTotal: 42.0,
    customer: {
      name: 'María Silva',
      phone: '987112233',
      address: 'Jr. Andahuaylas 500',
      paymentMethod: 'Yape',
      operationCode: '654321',
      orderType: 'Delivery'
    },
    items: [{ name: 'Pote 1 Litro', quantity: 1, price: 42.0 }]
  };

  const dispatchMsg = formatDriverDispatchMessage({
    order: orderWithOpCode,
    storeName: 'Friozo',
    driverName: 'Pedro'
  });

  assert.match(dispatchMsg, /Op: 654321/);
  assert.match(dispatchMsg, /#ORD-9898/);
  assert.match(dispatchMsg, /María Silva/);
  assert.match(dispatchMsg, /Jr\. Andahuaylas 500/);

  // Order without operation code omits Op text gracefully
  const orderWithoutOpCode = {
    ...orderWithOpCode,
    customer: { ...orderWithOpCode.customer, operationCode: undefined }
  };
  const dispatchMsgNoOp = formatDriverDispatchMessage({
    order: orderWithoutOpCode,
    storeName: 'Friozo',
    driverName: 'Pedro'
  });
  assert.doesNotMatch(dispatchMsgNoOp, /Op:/);
});

test('phone display formatting groups 9-digit Peruvian numbers into 3-digit segments', () => {
  const formatPhoneDisplay = (raw) => {
    const digits = String(raw || '').replace(/\D/g, '');
    const clean = digits.length === 11 && digits.startsWith('51') ? digits.slice(2) : digits;
    if (clean.length === 9) {
      return `${clean.slice(0, 3)} ${clean.slice(3, 6)} ${clean.slice(6)}`;
    }
    return clean || '987 654 321';
  };

  assert.equal(formatPhoneDisplay('987654321'), '987 654 321');
  assert.equal(formatPhoneDisplay('+51 987 654 321'), '987 654 321');
  assert.equal(formatPhoneDisplay('51987654321'), '987 654 321');
  assert.equal(formatPhoneDisplay(''), '987 654 321');
});
