import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Cart from '../src/components/Cart.jsx';
import PaymentMethodsSettings from '../src/components/admin/PaymentMethodsSettings.jsx';
import { PAYMENT_METHODS } from '../src/utils/paymentMethods.js';

const cardOnly = Object.fromEntries(PAYMENT_METHODS.map(method => [method, method === 'Tarjeta']));

test('admin can configure all five methods and see when every method is disabled', () => {
  const html = renderToStaticMarkup(<PaymentMethodsSettings value={cardOnly} />);
  assert.equal((html.match(/type="checkbox"/g) || []).length, 5);
  assert.equal((html.match(/checked=""/g) || []).length, 1);
  assert.ok(html.includes('Guardar métodos de pago'));
  const empty = renderToStaticMarkup(<PaymentMethodsSettings value={{ ...cardOnly, Tarjeta: false }} />);
  assert.ok(empty.includes('No se podrán confirmar pedidos nuevos'));
});

test('checkout offers only active methods, selects card fallback and blocks when none are active', () => {
  const previousStorage = globalThis.localStorage;
  globalThis.localStorage = { getItem: () => '', setItem: () => {} };
  try {
    const props = { cart: [{ id: 'pack', type: 'pack', name: 'Helado', price: 10, quantity: 1 }], deliveryFee: 0 };
    const html = renderToStaticMarkup(<Cart {...props} shopConfig={{ paymentMethods: cardOnly }} />);
    assert.ok(html.includes('Pago con tarjeta al recibir el pedido, mediante POS'));
    assert.equal((html.match(/class="payment-btn/g) || []).length, 1);
    assert.ok(html.includes('aria-pressed="true"'));
    const empty = renderToStaticMarkup(<Cart {...props} shopConfig={{ paymentMethods: { ...cardOnly, Tarjeta: false } }} />);
    assert.ok(empty.includes('No hay métodos de pago disponibles'));
    assert.match(empty, /<button[^>]*disabled=""[^>]*>🚀 Confirmar y Enviar Pedido/);
  } finally { globalThis.localStorage = previousStorage; }
});
