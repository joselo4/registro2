import test from 'node:test';
import assert from 'node:assert/strict';
import { createOrder, readOrder } from '../src/utils/apiClient.js';

test('checkout never accepts the receipt for another order or submission', async t => {
  const order = { id: 'PED-12345', submissionKey: 'my-key' };
  for (const receipt of [{ ...order, id: 'PED-OTHER' }, { ...order, submissionKey: 'other-key' }]) {
    t.mock.method(globalThis, 'fetch', async () => Response.json({ ok: true, order: receipt }));
    await assert.rejects(createOrder(order), /no corresponde/);
    t.mock.restoreAll();
  }
});

test('checkout rejects HTTP failures, HTML fallback pages and incomplete acknowledgments', async t => {
  for (const response of [new Response('offline', { status: 502 }), new Response('<html>app</html>'), Response.json({ ok: true }), Response.json({ ok: false, order: { id: 'PED-12345' } })]) {
    t.mock.method(globalThis, 'fetch', async () => response);
    await assert.rejects(createOrder({ id: 'PED-12345' }));
    t.mock.restoreAll();
  }
});

test('checkout returns only the server-confirmed receipt and preserves the retry key', async t => {
  const order = { id: 'PED-12345', submissionKey: 'same-retry-key' };
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, '/api/order');
    assert.deepEqual(JSON.parse(options.body).order, order);
    return Response.json({ ok: true, order: { ...order, status: 'Por Corroborar' } });
  });
  assert.equal((await createOrder(order)).status, 'Por Corroborar');
});

test('tracking keeps not-found distinct from a failed network request', async t => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ error: 'No encontrado' }, { status: 404 }));
  await assert.rejects(readOrder('PED-12345'), error => error.status === 404);
  t.mock.restoreAll();
  t.mock.method(globalThis, 'fetch', async () => { throw new TypeError('connection lost'); });
  await assert.rejects(readOrder('PED-12345'), error => error.status !== 404);
});
