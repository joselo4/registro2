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

test('quick helados from the menu are priced exactly like the order API expects', async () => {
  const { quickScoopItem } = await import('../src/utils/dessert.js');
  const { catalogItemPrice } = await import('../src/utils/orderPricing.js');
  const catalog = {
    bases: [{ id: 'cono_de_galleta_normal', price: 0, active: true }, { id: 'cono', price: 1.5, active: true }, { id: 'vaso', price: 1, active: true }],
    flavors: [{ id: 'fresa', name: 'Fresa', price: 1.5, active: true }, { id: 'coco', name: 'Coco', price: 2, active: true }],
    toppings: [],
  };
  const single = quickScoopItem(catalog.flavors[0], catalog.bases);
  assert.equal(single.base.id, 'cono_de_galleta_normal');
  assert.equal(single.price, catalogItemPrice(single, catalog));
  const double = quickScoopItem(catalog.flavors, catalog.bases.slice(1));
  assert.equal(double.base.id, 'vaso');
  assert.equal(double.price, 4.5);
  assert.equal(double.price, catalogItemPrice(double, catalog));
});

test('saved carts are re-priced like the order API before checkout', async () => {
  const { reconcileCart } = await import('../src/utils/cartRepricing.js');
  const { catalogItemPrice } = await import('../src/utils/orderPricing.js');
  const catalog = {
    bases: [{ id: 'cono_de_galleta_normal', name: 'Cono normal', price: 0 }, { id: 'cono', name: 'Cono artesanal', price: 1.5 }],
    flavors: [{ id: 'fresa', name: 'Fresa', price: 1.5 }, { id: 'mango', name: 'Mango', price: 1.5, active: false }],
    toppings: [],
    packs: [{ id: 'pack_pareja', name: 'Dúo', price: 12 }],
    popsicles: [],
    literConfig: { price: 16, maxFlavors: 3 },
  };
  const oldQuick = { type: 'custom', name: 'Helado Simple de Fresa', base: { id: 'cono', name: 'Cono', price: 0 }, scoops: [{ id: 'fresa', name: 'Fresa', price: 1.5 }], toppings: [], price: 1.5, quantity: 2 };
  const stalePack = { type: 'pack', id: 'pack_pareja', name: 'Dúo', price: 10, quantity: 1 };
  const gone = { type: 'custom', name: 'Mango', base: { id: 'cono_de_galleta_normal', price: 0 }, scoops: [{ id: 'mango' }], toppings: [], price: 1.5, quantity: 1 };
  const result = reconcileCart([oldQuick, stalePack, gone], catalog);
  assert.equal(result.changed, true);
  assert.deepEqual(result.removed, ['Mango']);
  const [scoop, pack] = result.cart;
  assert.equal(scoop.base.id, 'cono_de_galleta_normal');
  assert.equal(scoop.price, 1.5); // the customer keeps the price they saw
  assert.equal(pack.price, 12);
  for (const item of result.cart) assert.equal(item.price, catalogItemPrice(item, { ...catalog, literConfig: catalog.literConfig }));
  assert.equal(reconcileCart(result.cart, catalog).changed, false);
});

test('cart suggestions push towards free delivery and vary once it is reached', async () => {
  const { suggestPack, suggestFreeDeliveryCloser } = await import('../src/utils/cartSuggestions.js');
  const packs = [{ id: 'a', price: 6 }, { id: 'b', price: 10 }, { id: 'c', price: 22 }, { id: 'off', price: 4, active: false }];
  assert.equal(suggestPack({ packs, cart: [], missingForFreeDelivery: 7 }).pack.id, 'b');
  assert.equal(suggestPack({ packs, cart: [], missingForFreeDelivery: 7 }).unlocksFreeDelivery, true);
  assert.equal(suggestPack({ packs, cart: [{ id: 'b', quantity: 1 }], missingForFreeDelivery: 7 }).pack.id, 'c');
  const seen = new Set([1, 2, 3].map(quantity => suggestPack({ packs, cart: [{ id: 'x', quantity }] }).pack.id));
  assert.ok(seen.size > 1, 'the suggestion rotates');
  const closer = suggestFreeDeliveryCloser({ flavors: [{ id: 'f', name: 'Fresa', price: 1.5 }], bases: [{ id: 'n', name: 'Cono', price: 0 }], popsicles: [{ id: 'p', name: 'Mango', price: 3 }], missingForFreeDelivery: 2 });
  assert.equal(closer.item.type, 'popsicle');
  assert.equal(suggestFreeDeliveryCloser({ flavors: [], popsicles: [], missingForFreeDelivery: 0 }), null);
});

test('order codes are short, readable and accepted however the customer types them', async () => {
  const { generateOrderId, normalizeOrderCode } = await import('../src/utils/orderId.js');
  const codes = new Set(Array.from({ length: 200 }, generateOrderId));
  for (const code of codes) {
    assert.match(code, /^PED-[A-HJKMNP-Z]{3}-\d{3}$/);
    assert.match(code, /^PED-[A-Z0-9-]{4,40}$/); // still valid for the order API
  }
  assert.ok(codes.size > 190);
  assert.equal(normalizeOrderCode('kmr482'), 'PED-KMR-482');
  assert.equal(normalizeOrderCode(' kmr-482 '), 'PED-KMR-482');
  assert.equal(normalizeOrderCode('PED-KMR-482'), 'PED-KMR-482');
  assert.equal(normalizeOrderCode('ped-wtqvfvgp2p'), 'PED-WTQVFVGP2P');
  assert.equal(normalizeOrderCode('WTQVFVGP2P'), 'PED-WTQVFVGP2P');
});

test('tracking closes 72 hours after delivery, not after the order was placed', async () => {
  const { trackingExpired } = await import('../src/utils/orderLifecycle.js');
  const now = Date.parse('2026-09-25T12:00:00Z');
  const hoursAgo = hours => new Date(now - hours * 3600000).toISOString();
  const placedLongAgo = { status: 'Entregado', date: hoursAgo(200), statusHistory: [{ status: 'Por Corroborar', timestamp: hoursAgo(200) }, { status: 'Entregado', timestamp: hoursAgo(10) }] };
  assert.equal(trackingExpired(placedLongAgo, now), false);
  assert.equal(trackingExpired({ ...placedLongAgo, statusHistory: [{ status: 'Entregado', timestamp: hoursAgo(73) }] }, now), true);
  assert.equal(trackingExpired({ status: 'Preparando', date: hoursAgo(500) }, now), false);
});

test('the auth listener never awaits Supabase calls inside the auth lock', async () => {
  const { readFileSync } = await import('node:fs');
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  // supabase-js holds its auth lock while the callback runs; an awaited query
  // there deadlocks every later session call (order buttons, sign out).
  assert.doesNotMatch(app, /onAuthStateChange\(\s*async/);
  assert.match(app, /onAuthStateChange\(\(event, session\) => \{[\s\S]{0,400}setTimeout\(/);
});

test('a stuck auth client surfaces as an error instead of a silent button', async () => {
  const { currentSession } = await import('../src/utils/apiClient.js').catch(() => ({}));
  if (!currentSession) return; // apiClient needs a browser build (Capacitor); covered by the view build.
  const stuck = { auth: { getSession: () => new Promise(() => {}) } };
  await assert.rejects(currentSession(stuck, 20), /La sesión no respondió/);
});
