// A thousand customers at once: no lost orders, no overwritten orders, no lost
// visits, and one catalog read for the whole crowd.
import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost as postOrder } from '../functions/api/order.js';
import { onRequestPost as track } from '../functions/api/track.js';
import { onRequestGet as catalog, resetCatalogMemory } from '../functions/api/catalog.js';
import { onRequestPost as coupon } from '../functions/api/coupon.js';
import { funnelDayFromKey, limaDay } from '../functions/api/_funnel.js';

const CROWD = 1000;
const field = (row, key) => key.split(/->>?/).reduce((value, part) => value?.[part], row);
const likePattern = pattern => new RegExp(`^${pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.')}$`);

// Every query waits a random moment before it runs, so requests interleave the
// way they do over the network. Each insert or conditional update then runs
// atomically, as one SQL statement does in Postgres.
function racingDatabase(initial = []) {
  const rows = new Map(initial.map(row => [row.key, structuredClone(row)]));
  const stats = { reads: 0, writes: 0 };
  const jitter = () => new Promise(resolve => setTimeout(resolve, Math.random() * 4));
  return {
    rows,
    stats,
    auth: { getUser: async () => ({ data: { user: null }, error: null }) },
    from() {
      let mode = 'read', record, countOnly = false;
      const conditions = [];
      const query = {
        select(_columns, config) { countOnly = Boolean(config?.head); return query; },
        like(key, pattern) { conditions.push(row => likePattern(pattern).test(String(field(row, key) ?? ''))); return query; },
        gte(key, value) { conditions.push(row => field(row, key) != null && String(field(row, key)) >= value); return query; },
        eq(key, value) { conditions.push(row => key === 'value' ? JSON.stringify(row.value) === value : field(row, key) === value); return query; },
        is(key, value) { conditions.push(row => (row[key] ?? null) === value); return query; },
        in(key, values) { conditions.push(row => values.includes(field(row, key))); return query; },
        order() { return query; },
        limit() { return query; },
        insert(value) { mode = 'insert'; record = value; return query; },
        update(value) { mode = 'update'; record = value; return query; },
        async execute(single) {
          await jitter();
          if (mode === 'insert') {
            stats.writes++;
            if (rows.has(record.key)) return { error: { code: '23505' } };
            rows.set(record.key, structuredClone(record));
            return { data: single ? structuredClone(record) : [structuredClone(record)] };
          }
          let matches = [...rows.values()].filter(row => conditions.every(condition => condition(row)));
          if (mode === 'read') stats.reads++;
          if (countOnly) return { count: matches.length, data: null };
          if (mode === 'update') {
            stats.writes++;
            matches = matches.map(row => { const next = structuredClone({ ...row, ...record }); rows.set(row.key, next); return next; });
          }
          return { data: structuredClone(single ? matches[0] || null : matches) };
        },
        maybeSingle() { return query.execute(true); },
        then(resolve, reject) { return query.execute(false).then(resolve, reject); },
      };
      return query;
    },
  };
}

const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const customerOrder = n => ({
  id: `PED-CROWD${String(n).padStart(5, '0')}`,
  submissionKey: uuid(n),
  date: new Date().toISOString(),
  status: 'Por Corroborar',
  items: [{ type: 'pack', id: 'pack_pareja', name: 'Pack Dúo Romántico', price: 10, quantity: 1 }],
  customer: { name: `Cliente ${n}`, phone: String(900000000 + n), address: `Jr. Prueba ${n}`, orderType: 'Delivery', paymentMethod: 'Yape' },
  grandTotal: 10,
});
const orderRequest = order => new Request('https://shop.test/api/order', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ id: order.id, order }),
});

test(`${CROWD} simultaneous orders are all saved, each with its own data`, async () => {
  const db = racingDatabase([{ key: 'delivery_fee', value: 0 }, { key: 'free_delivery_threshold', value: 15 }]);
  const orders = Array.from({ length: CROWD }, (_, index) => customerOrder(index + 1));
  const responses = await Promise.all(orders.map(order => postOrder({ request: orderRequest(order), env: {} }, async () => db)));
  const statuses = responses.map(response => response.status);
  assert.deepEqual([...new Set(statuses)], [200], `unexpected statuses: ${[...new Set(statuses)]}`);
  const saved = [...db.rows.keys()].filter(key => key.startsWith('order_PED-CROWD'));
  assert.equal(saved.length, CROWD);
  for (const order of orders) {
    const row = db.rows.get(`order_${order.id}`).value;
    assert.equal(row.customer.name, order.customer.name);
    assert.equal(row.submissionKey, order.submissionKey);
  }
});

test('the same order sent many times at once is saved exactly once', async () => {
  const db = racingDatabase([{ key: 'delivery_fee', value: 0 }, { key: 'free_delivery_threshold', value: 15 }]);
  const order = customerOrder(7);
  const responses = await Promise.all(Array.from({ length: 50 }, () => postOrder({ request: orderRequest(order), env: {} }, async () => db)));
  assert.ok(responses.every(response => response.status === 200), 'every retry of the same order gets its receipt');
  assert.equal([...db.rows.keys()].filter(key => key === `order_${order.id}`).length, 1);
});

test('a different customer cannot take over an existing order code', async () => {
  const db = racingDatabase([{ key: 'delivery_fee', value: 0 }, { key: 'free_delivery_threshold', value: 15 }]);
  const first = customerOrder(11);
  const intruder = { ...customerOrder(12), id: first.id };
  const [a, b] = await Promise.all([postOrder({ request: orderRequest(first), env: {} }, async () => db), postOrder({ request: orderRequest(intruder), env: {} }, async () => db)]);
  assert.deepEqual([a.status, b.status].sort(), [200, 409]);
  const kept = db.rows.get(`order_${first.id}`).value;
  assert.ok([first.customer.name, intruder.customer.name].includes(kept.customer.name));
  assert.equal(kept.submissionKey === first.submissionKey ? a.status : b.status, 200, 'the stored order belongs to the request that succeeded');
});

test(`${CROWD} simultaneous visitors are all counted in the sales funnel`, async () => {
  const db = racingDatabase();
  const request = () => new Request('https://shop.test/api/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ events: { visit: 1, view_3d: 1 } }) });
  const responses = await Promise.all(Array.from({ length: CROWD }, () => track({ request: request(), env: {} }, async () => db)));
  const failed = responses.filter(response => response.status !== 200).length;
  const today = limaDay();
  const shards = [...db.rows.values()].filter(row => funnelDayFromKey(row.key) === today);
  const visits = shards.reduce((sum, row) => sum + (row.value.visit || 0), 0);
  const views3d = shards.reduce((sum, row) => sum + (row.value.view_3d || 0), 0);
  assert.equal(failed, 0);
  assert.equal(visits, CROWD);
  assert.equal(views3d, CROWD);
  assert.ok(shards.length > 1, 'counts are spread over several rows');
});

test(`${CROWD} simultaneous catalog requests share a single database read`, async () => {
  resetCatalogMemory();
  const db = racingDatabase([{ key: 'flavors', value: [{ id: 'fresa' }] }, { key: 'coupons', value: [{ code: 'SECRETO' }] }, { key: 'orders', value: [{ id: 'x' }] }]);
  const request = () => new Request('https://shop.test/api/catalog');
  const responses = await Promise.all(Array.from({ length: CROWD }, () => catalog({ request: request(), env: {} }, async () => db)));
  assert.ok(responses.every(response => response.status === 200));
  assert.equal(db.stats.reads, 1);
  const body = await responses[0].json();
  assert.deepEqual(body.data.flavors, [{ id: 'fresa' }]);
  assert.equal(body.data.coupons, undefined, 'coupon codes are not public');
  assert.equal(body.data.orders, undefined, 'orders are not public');
  assert.match(responses[0].headers.get('Cache-Control'), /s-maxage=\d+/);
  resetCatalogMemory();
});

test('coupon check reveals only the requested valid code and slows guessing', async () => {
  const db = racingDatabase([{ key: 'coupons', value: [
    { code: 'HOLA10', type: 'percentage', value: 10, active: true, limit: 0 },
    { code: 'APAGADO', type: 'flat', value: 5, active: false },
    { code: 'AGOTADO', type: 'flat', value: 5, active: true, limit: 2, usedCount: 2 },
  ] }]);
  const ask = (code, ip = '198.51.100.1') => coupon({ request: new Request('https://shop.test/api/coupon', { method: 'POST', headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': ip }, body: JSON.stringify({ code }) }), env: {} }, async () => db);
  const ok = await ask('hola10');
  assert.equal(ok.status, 200);
  assert.deepEqual((await ok.json()).coupon, { code: 'HOLA10', type: 'percentage', value: 10, description: '' });
  assert.equal((await ask('APAGADO')).status, 410);
  assert.equal((await ask('AGOTADO')).status, 410);
  assert.equal((await ask('NOEXISTE')).status, 404);
  const guesses = await Promise.all(Array.from({ length: 30 }, (_, index) => ask(`PRUEBA${index}`, '198.51.100.99')));
  assert.ok(guesses.some(response => response.status === 429), 'repeated guesses from one connection are blocked');
});
