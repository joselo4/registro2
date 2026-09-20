import test from 'node:test';
import assert from 'node:assert/strict';
import { printThermalTicket } from '../src/utils/escposTicket.js';

test('thermal ticket prints correct totals, collection notice and escaped store message', () => {
  const chunks = [];
  const previousWindow = globalThis.window;
  globalThis.window = {
    open: () => ({
      document: {
        write: value => chunks.push(value),
        close: () => {},
      },
    }),
  };
  try {
    printThermalTicket({
      type: 'delivery',
      storeName: 'Friozo',
      storePhone: '999999999',
      ticketCustomMessage: 'Gracias <script>alert(1)</script>\nVuelve pronto',
      order: {
        id: 'PED-TICKET',
        total: 12.5,
        grandTotal: 15.5,
        deliveryFee: 3,
        discount: 0,
        paymentVerified: false,
        customer: {
          name: 'Cliente', phone: '988888888', address: 'Av. Prueba 123',
          orderType: 'Delivery', paymentMethod: 'Yape', paymentTiming: 'Al llegar',
        },
        items: [{ name: 'Helado', quantity: 1, price: 12.5 }],
      },
    });
    const html = chunks.join('');
    assert.ok(html.includes('Subtotal:</span> <span>S/ 12.50'));
    assert.ok(html.includes('COBRAR AL ENTREGAR · Yape'));
    assert.ok(html.includes('Gracias &lt;script&gt;alert(1)&lt;/script&gt;<br>Vuelve pronto'));
    assert.ok(!html.includes('Gracias <script>'));
  } finally {
    globalThis.window = previousWindow;
  }
});
