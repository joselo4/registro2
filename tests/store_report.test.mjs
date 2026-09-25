import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost as track } from '../functions/api/track.js';
import { buildStoreReport, onRequestGet as storeReport } from '../functions/api/store-report.js';
import { cleanFunnelEvents, limaDay } from '../functions/api/_funnel.js';

// Minimal helados_sync model: select/eq/like/gte/is, insert and conditional update.
function database(initial = []) {
  const rows = new Map(initial.map(row => [row.key, structuredClone(row)]));
  const field = (row, key) => key.split(/->>?/).reduce((value, part) => value?.[part], row);
  return {
    rows,
    from() {
      let mode = 'read', record, conditions = [];
      const query = {
        select() { return query; },
        eq(key, value) { conditions.push(row => field(row, key) === value); return query; },
        is(key, value) { conditions.push(row => (row[key] ?? null) === value); return query; },
        like(key, pattern) { const re = new RegExp(`^${pattern.replace(/%/g, '.*')}$`); conditions.push(row => re.test(String(field(row, key) ?? ''))); return query; },
        gte(key, value) { conditions.push(row => field(row, key) != null && String(field(row, key)) >= value); return query; },
        insert(value) { mode = 'insert'; record = value; return query; },
        update(value) { mode = 'update'; record = value; return query; },
        async execute(single) {
          if (mode === 'insert') {
            if (rows.has(record.key)) return { error: { code: '23505' } };
            rows.set(record.key, structuredClone(record));
            return { data: single ? structuredClone(record) : [structuredClone(record)] };
          }
          let matches = [...rows.values()].filter(row => conditions.every(condition => condition(row)));
          if (mode === 'update') matches = matches.map(row => { const next = { ...row, ...structuredClone(record) }; rows.set(row.key, next); return next; });
          return { data: structuredClone(single ? matches[0] || null : matches) };
        },
        maybeSingle() { return query.execute(true); },
        then(resolve, reject) { return query.execute(false).then(resolve, reject); },
      };
      return query;
    },
  };
}
const post = body => new Request('https://shop.test/api/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

test('funnel counts are anonymous, bounded and add up per Lima day', async () => {
  assert.deepEqual(cleanFunnelEvents({ visit: 1, view_item: 500, purchase: 9, email: 'x', add_to_cart: -2 }), { visit: 1, view_item: 30 });
  const db = database();
  assert.equal((await track({ request: post({ events: { visit: 1, view_item: 2 } }), env: {} }, async () => db)).status, 200);
  assert.equal((await track({ request: post({ events: { view_item: 3, add_to_cart: 1 } }), env: {} }, async () => db)).status, 200);
  const today = db.rows.get(`funnel_${limaDay()}`).value;
  assert.deepEqual(today, { visit: 1, view_item: 5, add_to_cart: 1 });
  assert.equal((await track({ request: post({ events: { purchase: 5 } }), env: {} }, async () => db)).status, 200);
  assert.equal(db.rows.get(`funnel_${limaDay()}`).value.purchase, undefined); // purchases come from real orders
});

test('the store report joins funnel steps with real, non-cancelled orders', () => {
  const now = new Date('2026-09-25T18:00:00Z');
  const report = buildStoreReport({
    days: 7,
    now,
    funnelRows: [{ key: 'funnel_2026-09-25', value: { visit: 40, view_item: 25, add_to_cart: 9, begin_checkout: 6 } }],
    orders: [
      { status: 'Entregado', date: '2026-09-25T17:00:00Z', grandTotal: 20, customer: { orderType: 'Delivery' }, items: [{ name: 'Paleta', price: 3, quantity: 4 }] },
      { status: 'Por Corroborar', date: '2026-09-24T20:00:00Z', grandTotal: 10, customer: { orderType: 'Barra' }, items: [{ name: 'Paleta', price: 3, quantity: 1 }] },
      { status: 'Cancelado', date: '2026-09-25T17:00:00Z', grandTotal: 99, items: [] },
      { status: 'Entregado', date: '2026-09-25T17:00:00Z', grandTotal: 50, isOperator: true, items: [] },
    ],
  });
  assert.equal(report.totals.visit, 40);
  assert.equal(report.totals.purchase, 2);
  assert.equal(report.totals.revenue, 30);
  assert.equal(report.averageTicket, 15);
  assert.deepEqual(report.channels, { Delivery: 1, Barra: 1 });
  assert.equal(report.topProducts[0].units, 5);
  assert.equal(report.series.length, 7);
});

test('only administrators can read the store report', async () => {
  const request = new Request('https://shop.test/api/store-report?days=7');
  assert.equal((await storeReport({ request, env: {} }, { authenticate: async () => ({ user: null }) })).status, 401);
  assert.equal((await storeReport({ request, env: {} }, { authenticate: async () => ({ user: { app_metadata: { role: 'Vendedor' } } }) })).status, 403);
  const db = database([{ key: `funnel_${limaDay()}`, value: { visit: 3 } }]);
  const response = await storeReport({ request, env: {} }, { authenticate: async () => ({ user: { app_metadata: { role: 'Administrador' } }, adminClient: db }) });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).totals.visit, 3);
});
