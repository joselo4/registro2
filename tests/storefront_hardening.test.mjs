import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost as tableCallPost } from '../functions/api/table-call.js';
import { onRequestPost as telegramPost } from '../functions/api/telegram.js';
import { onRequestPost as orderPost } from '../functions/api/order.js';
import { cleanTableParam, isKnownView, urlForView, viewFromHash } from '../src/utils/viewHistory.js';
import { safeStorage } from '../src/utils/security.js';

const post = (path, body) => new Request(`https://shop.test${path}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: typeof body === 'string' ? body : JSON.stringify(body),
});

const fakeDb = ({ rows = {}, writes = [] } = {}) => ({
  from: () => ({
    _key: null,
    select() { return this; },
    eq(_column, value) { this._key = value; return this; },
    async maybeSingle() { return { data: rows[this._key] ? { value: rows[this._key] } : null, error: null }; },
    async upsert(record) { writes.push(record); return { error: null }; },
  }),
});

test('customer screens map to shareable URLs and back', () => {
  const location = { pathname: '/helados/', search: '?mesa=4' };
  assert.equal(urlForView('cart', location), '/helados/?mesa=4#carrito');
  assert.equal(urlForView('shop', location), '/helados/?mesa=4');
  assert.equal(viewFromHash('#carrito'), 'cart');
  assert.equal(viewFromHash('#TIENDA'), 'shop');
  assert.equal(viewFromHash('#catalog'), null);
  assert.equal(isKnownView('tracker'), true);
  assert.equal(isKnownView('constructor'), false);
  assert.equal(isKnownView('__proto__'), false);
});

test('table links only accept the table numbers the order API accepts', () => {
  assert.equal(cleanTableParam(' 12 '), '12');
  assert.equal(cleanTableParam('0'), null);
  assert.equal(cleanTableParam('1000'), null);
  assert.equal(cleanTableParam('<b>4</b>'), null);
});

test('corrupted saved settings fall back instead of breaking the store', () => {
  const store = new Map([['list', '{"a":1}'], ['object', '[1]'], ['flag', '"yes"'], ['broken', '{']]);
  globalThis.window = { localStorage: { getItem: key => store.get(key) ?? null } };
  try {
    assert.deepEqual(safeStorage.getJSON('list', []), []);
    assert.deepEqual(safeStorage.getJSON('object', { a: 1 }), { a: 1 });
    assert.equal(safeStorage.getJSON('flag', true), true);
    assert.deepEqual(safeStorage.getJSON('broken', ['x']), ['x']);
  } finally {
    delete globalThis.window;
  }
});

test('table calls reject invented tables and disabled table service', async () => {
  const writes = [];
  const db = fakeDb({ rows: { shop_open: { tableOrdersEnabled: false } }, writes });
  const invalid = await tableCallPost({ request: post('/api/table-call', { table: 'abc', request: 'Cuenta' }), env: {} }, async () => db);
  assert.equal(invalid.status, 400);
  const disabled = await tableCallPost({ request: post('/api/table-call', { table: '3', request: 'Cuenta' }), env: {} }, async () => db);
  assert.equal(disabled.status, 400);
  const malformed = await tableCallPost({ request: post('/api/table-call', '{'), env: {} }, async () => db);
  assert.equal(malformed.status, 400);
  assert.equal(writes.length, 0);
});

test('a new table call is stamped with the server clock', async () => {
  const writes = [];
  const db = fakeDb({ rows: { shop_open: {} }, writes });
  const response = await tableCallPost({ request: post('/api/table-call', { table: '3', request: 'Cuenta', timestamp: '2001-01-01T00:00:00Z' }), env: {} }, async () => db);
  assert.equal(response.status, 200);
  assert.equal(writes[0].key, 'order_call_Mesa_3');
  assert.ok(Date.now() - Date.parse(writes[0].value.timestamp) < 5000);
});

test('Telegram only relays open, recent table calls', async t => {
  t.mock.method(globalThis, 'fetch', () => { assert.fail('Telegram must not be called'); });
  const env = { TELEGRAM_BOT_TOKEN: 'token', TELEGRAM_CHAT_ID: 'chat' };
  const stale = fakeDb({ rows: { order_call_Mesa_3: { table: '3', request: 'Cuenta', resolved: false, timestamp: '2020-01-01T00:00:00Z' } } });
  assert.equal((await telegramPost({ request: post('/api/telegram', { kind: 'table_call', table: '3' }), env }, async () => stale)).status, 409);
  const resolved = fakeDb({ rows: { order_call_Mesa_3: { table: '3', request: 'Cuenta', resolved: true, timestamp: new Date().toISOString() } } });
  assert.equal((await telegramPost({ request: post('/api/telegram', { kind: 'table_call', table: '3' }), env }, async () => resolved)).status, 409);
});

test('malformed order requests are rejected as bad input', async () => {
  const response = await orderPost({ request: post('/api/order', 'not json'), env: {} }, async () => fakeDb());
  assert.equal(response.status, 400);
});

test('an old tab reloads once after a deploy instead of showing an error', async () => {
  const { isStaleDeployError, reloadForNewDeploy } = await import('../src/utils/staleDeploy.js');
  assert.equal(isStaleDeployError(new TypeError('Failed to fetch dynamically imported module: /assets/Cart-abc.js')), true);
  assert.equal(isStaleDeployError(new Error('Cannot read properties of undefined')), false);
  const values = new Map();
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  let reloads = 0;
  const location = { reload: () => { reloads++; } };
  assert.equal(reloadForNewDeploy(storage, location, 100000), true);
  assert.equal(reloadForNewDeploy(storage, location, 120000), false); // no loop
  assert.equal(reloadForNewDeploy(storage, location, 200000), true);
  assert.equal(reloads, 2);
});
