import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestGet, onRequestPost } from '../functions/api/telegram.js';
import { sendSupportMessage } from '../src/utils/supportMessaging.js';

const env = { TELEGRAM_BOT_TOKEN: 'test-token', TELEGRAM_CHAT_ID: 'test-chat' };
const details = { name: 'Ana_*[', phone: '+51 987654321', message: '¿Tienen chocolate_*[ y fresa? 🍓' };
const request = body => new Request('https://shop.test/api/telegram', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://shop.test' }, body: JSON.stringify({ kind: 'support', ...body }) });

test('customer punctuation reaches Telegram unchanged with a single plain-text request', async t => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    calls++;
    const body = JSON.parse(options.body);
    assert.equal(body.parse_mode, undefined);
    assert.ok(body.text.includes(details.message));
    assert.ok(body.text.includes(details.name));
    return Response.json({ ok: true });
  });
  const result = await onRequestPost({ request: request(details), env });
  assert.equal(result.status, 200); assert.equal(calls, 1);
  assert.deepEqual(await result.json(), { ok: true });
});
test('missing Telegram configuration and invalid phone fail before any send', async t => {
  t.mock.method(globalThis, 'fetch', () => { assert.fail('must not contact Telegram'); });
  assert.equal((await onRequestPost({ request: request(details), env: {} })).status, 503);
  assert.equal((await onRequestPost({ request: request({ ...details, phone: '+ - - - -' }), env })).status, 400);
});
test('non-JSON or failed upstream responses never report delivery', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response('upstream proxy page'));
  assert.equal((await onRequestPost({ request: request(details), env })).status, 502);
});
test('client reports success only with an explicit confirmation', async () => {
  assert.deepEqual(await sendSupportMessage(details, { fetchImpl: async () => Response.json({ ok: true }) }), { ok: true });
  for (const response of [Response.json({}), Response.json({ ok: false }), new Response('<html>fallback</html>'), Response.json({ error: 'offline' }, { status: 503 })]) {
    await assert.rejects(sendSupportMessage(details, { fetchImpl: async () => response }), /No pudimos confirmar/);
  }
});
test('client aborts a stalled send and does not retry or mutate the draft', async () => {
  let calls = 0;
  const original = { ...details };
  await assert.rejects(sendSupportMessage(details, { timeoutMs: 20, fetchImpl: (_url, { signal }) => {
    calls++;
    return new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError'))));
  } }), /conservamos tu consulta/);
  assert.equal(calls, 1); assert.deepEqual(details, original);
});
test('timeout covers the response body as well as connection setup', async () => {
  await assert.rejects(sendSupportMessage(details, { timeoutMs: 10, fetchImpl: async (_url, { signal }) => ({
    ok: true,
    json: () => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))),
  }) }), /conservamos tu consulta/);
});

test('connection errors are understandable and never offer WhatsApp', async () => {
  await assert.rejects(sendSupportMessage(details, { fetchImpl: async () => { throw new TypeError('Failed to fetch'); } }), error => {
    assert.ok(error.message.includes('No pudimos conectar con Telegram'));
    assert.ok(!/WhatsApp|Failed to fetch/.test(error.message));
    return true;
  });
});
test('Telegram diagnostics verify credentials without sending messages or returning private metadata', async t => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async url => {
    calls.push(url);
    return Response.json({ok:true,result:{id:12345,title:'Private chat'}});
  });
  const response = await onRequestGet({request:new Request('https://shop.test/api/telegram?verify=1'),env});
  assert.equal(response.status,200);
  assert.deepEqual(await response.json(), {ok:true,botValid:true,destinationAccessible:true});
  assert.equal(calls.length,2);
  assert.ok(calls.every(url => !url.includes('sendMessage')));
});
