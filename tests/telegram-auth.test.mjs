import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost } from '../functions/api/telegram.js';

const saved = { id: 'PED-SECURE001', submissionKey: '95f62394-a72d-4db0-a92b-98db316c9dd6', customer: { name: 'Ana', phone: '999999999', address: 'Av. Prueba 1', orderType: 'Delivery', paymentMethod: 'Yape' }, items: [{ name: 'Helado', quantity: 1 }], grandTotal: 10 };
const db = { from: () => ({ select() { return this; }, eq() { return this; }, async maybeSingle() { return { data: { value: saved } }; } }) };
const request = body => new Request('https://shop.test/api/telegram', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'order', orderId: saved.id, ...body }) });

test('a code alone cannot send a forged order notification', async t => {
  t.mock.method(globalThis, 'fetch', () => { assert.fail('Telegram must not be called'); });
  assert.equal((await onRequestPost({ request: request({ text: 'PEDIDO FALSO' }), env: {} }, async () => db)).status, 403);
});

test('receipt owner sends only the stored order details to Telegram', async t => {
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    const sent = JSON.parse(options.body);
    assert.match(sent.text, /Ana/);
    assert.doesNotMatch(sent.text, /PEDIDO FALSO/);
    assert.equal(sent.parse_mode, undefined);
    return Response.json({ ok: true });
  });
  const response = await onRequestPost({ request: request({ submissionKey: saved.submissionKey, text: 'PEDIDO FALSO' }), env: { TELEGRAM_BOT_TOKEN: 'token', TELEGRAM_CHAT_ID: 'chat' } }, async () => db);
  assert.equal(response.status, 200);
});

test('daily reports require an administrator session', async () => {
  const response = await onRequestPost({ request: new Request('https://shop.test/api/telegram', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'daily_report', text: 'falso' }) }), env: {} });
  assert.equal(response.status, 401);
});
