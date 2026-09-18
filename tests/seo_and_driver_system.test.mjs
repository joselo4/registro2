import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatDriverDispatchMessage, buildWhatsAppHref } from '../src/utils/orderMessaging.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

test('index keeps SEO metadata and one application entry without an alternative storefront', () => {
  const content = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
  assert.match(content, /<title>.*Andahuaylas.*<\/title>/i);
  assert.match(content, /name="description"/);
  assert.match(content, /type="application\/ld\+json"/);
  assert.match(content, /https:\/\/www.pideanda.com\/#catalog/);
  assert.equal((content.match(/id="root"/g) || []).length, 1);
  assert.ok(content.includes('src="/src/main.jsx"'));
  assert.ok(content.includes('id="startup-status"'));
  assert.ok(!content.includes('Carta de Helados Artesanales y Sabores Exclusivos'));
  assert.ok(!content.includes('id="catalogo"'));
});

test('formatDriverDispatchMessage formats route dispatch details for WhatsApp', () => {
  const order = {
    id: 'ORD-5555',
    grandTotal: 34.50,
    customer: {
      name: 'Carlos Mendoza',
      phone: '987654321',
      address: 'Jr. Ayacucho 452',
      reference: 'Frente al parque',
      paymentMethod: 'Efectivo',
      orderType: 'delivery'
    },
    items: [
      { name: 'Copa Tentación 3 Bolas', quantity: 2 },
      { name: 'Paleta Rellena de Fresa', quantity: 1 }
    ]
  };

  const msg = formatDriverDispatchMessage({
    order,
    storeName: 'Friozo',
    driverName: 'Juan Pérez'
  });

  assert.match(msg, /HOJA DE RUTA \/ DESPACHO/i);
  assert.match(msg, /Juan Pérez/);
  assert.match(msg, /#ORD-5555/);
  assert.match(msg, /Carlos Mendoza/);
  assert.match(msg, /Jr\. Ayacucho 452/);
  assert.match(msg, /Frente al parque/);
  assert.match(msg, /COBRAR \/ VERIFICAR PAGO: S\/\. 34\.50/);
  assert.match(msg, /Copa Tentación 3 Bolas/);
  assert.match(msg, /google\.com\/maps/);
});

test('formatDriverDispatchMessage correctly marks digital payments as already paid', () => {
  const order = {
    id: 'ORD-7777',
    paymentVerified: true,
    grandTotal: 25.00,
    customer: {
      name: 'Ana Torres',
      phone: '912345678',
      address: 'Av. Perú 123',
      paymentMethod: 'Yape',
      orderType: 'delivery'
    },
    items: [{ name: 'Cono Artesanal 2 Bolas', quantity: 1 }]
  };

  const msg = formatDriverDispatchMessage({
    order,
    storeName: 'Friozo',
    driverName: 'Marcos'
  });

  assert.match(msg, /YA PAGADO \(Yape\)/);
  assert.doesNotMatch(msg, /COBRAR EN EFECTIVO/);
});

test('buildWhatsAppHref formats clean phone numbers with Peru country code 51', () => {
  const href1 = buildWhatsAppHref('987654321', 'Hola');
  assert.ok(href1.startsWith('https://wa.me/51987654321?text='));

  const href2 = buildWhatsAppHref('+51 987 654 321', 'Mensaje con espacios');
  assert.ok(href2.startsWith('https://wa.me/51987654321?text='));

  const hrefEmpty = buildWhatsAppHref('', 'Vacio');
  assert.strictEqual(hrefEmpty, '');
});

test('unverified digital dispatch messages request collection and include timing', () => {
  for (const method of ['Yape', 'Plin', 'Transferencia']) {
    const order = { grandTotal: 20, customer: { paymentMethod: method, paymentTiming: 'Al llegar' } };
    const msg = formatDriverDispatchMessage({ order });
    assert.ok(msg.includes('COBRAR / VERIFICAR PAGO: S/. 20.00'));
    assert.ok(msg.includes(method + ' · Pago al llegar'));
    assert.ok(!msg.includes('YA PAGADO'));
  }
});
