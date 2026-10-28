import test from 'node:test';
import assert from 'node:assert/strict';
import { escapeHTML } from '../src/utils/security.js';
import { printThermalTicket } from '../src/utils/escposTicket.js';
import { sniffImageType, tooManyRequests } from '../functions/api/_security.js';

const bytes = (...values) => new Uint8Array(values.flatMap(v => typeof v === 'string' ? [...v].map(c => c.charCodeAt(0)) : [v]));

test('escapeHTML neutralises markup and attribute breakouts', () => {
  assert.equal(escapeHTML('<img src=x onerror="a()">'), '&lt;img src=x onerror=&quot;a()&quot;&gt;');
  assert.equal(escapeHTML("O'Higgins & Co"), 'O&#039;Higgins &amp; Co');
  assert.equal(escapeHTML(null), '');
  assert.equal(escapeHTML(12), '12');
});

test('sniffImageType accepts raster images by signature only', () => {
  assert.equal(sniffImageType(bytes(0xff, 0xd8, 0xff, 0xe0)), 'image/jpeg');
  assert.equal(sniffImageType(bytes(0x89, 'PNG', 0x0d, 0x0a)), 'image/png');
  assert.equal(sniffImageType(bytes('GIF89a')), 'image/gif');
  assert.equal(sniffImageType(bytes('RIFF', 0, 0, 0, 0, 'WEBPVP8 ')), 'image/webp');
  assert.equal(sniffImageType(bytes(0, 0, 0, 0x1c, 'ftypavif')), 'image/avif');
  assert.equal(sniffImageType(bytes('<svg xmlns="http://www.w3.org/2000/svg">')), null);
  assert.equal(sniffImageType(bytes('<html><script>')), null);
  assert.equal(sniffImageType(new Uint8Array()), null);
});

test('tooManyRequests caps bursts per connection and window', () => {
  const request = { headers: new Headers({ 'CF-Connecting-IP': '203.0.113.9' }) };
  const other = { headers: new Headers({ 'CF-Connecting-IP': '203.0.113.10' }) };
  const start = 1_000_000;
  for (let i = 0; i < 3; i++) assert.equal(tooManyRequests(request, 'test-bucket', 3, 60_000, start + i), false);
  assert.equal(tooManyRequests(request, 'test-bucket', 3, 60_000, start + 10), true);
  assert.equal(tooManyRequests(other, 'test-bucket', 3, 60_000, start + 10), false);
  assert.equal(tooManyRequests(request, 'test-bucket', 3, 60_000, start + 61_000), false);
  assert.equal(tooManyRequests({ headers: new Headers() }, 'test-bucket', 1, 60_000, start), false);
});

test('cart settlement ticket escapes staff-entered text', () => {
  const chunks = [];
  const previousWindow = globalThis.window;
  globalThis.window = { open: () => ({ document: { write: value => chunks.push(value), close: () => {} } }) };
  try {
    printThermalTicket({
      type: 'cart_settlement',
      storeName: 'Friozo',
      settlement: {
        id: 'LIQ-1',
        cartLabel: '<b>Carrito</b>',
        vendorName: '<img src=x onerror=alert(1)>',
        routeName: 'Ruta "Centro"',
        notes: '<script>alert(2)</script>',
        details: [{ name: '<i>Paleta</i>', price: 2, loaded: 5, returned: 1, sold: 4, subtotal: 8 }],
        totalUnits: 4,
        totalAmount: 8,
      },
    });
    const html = chunks.join('');
    assert.ok(!html.includes('<img src=x'));
    assert.ok(!html.includes('<script>alert(2)'));
    assert.ok(!html.includes('<i>Paleta</i>'));
    assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
  } finally {
    globalThis.window = previousWindow;
  }
});
