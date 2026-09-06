import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestGet, onRequestPost } from '../functions/api/order.js';
import { mergeOrders, nextOrderStatus, prepareOrderUpdate } from '../src/utils/orderLifecycle.js';
import { saveOrderChange, fetchAllSyncRows } from '../src/utils/orderRepository.js';
import { allowedOrderChange } from '../functions/api/_orderAccess.js';
import { sameOriginRequest } from '../functions/api/_security.js';

const fixture = overrides => ({ id: 'PED-TEST0001', submissionKey: 'test-submission-1', date: '2026-09-06T10:00:00Z', status: 'Por Corroborar', items: [{ name: 'Helado', price: 10, quantity: 1 }], customer: { name: 'Prueba', phone: '999999999', orderType: 'Delivery', paymentMethod: 'Yape' }, grandTotal: 10, ...overrides });

// Models PostgREST conditional updates and unique inserts, including races.
function database(initial = [], options = {}) {
  const rows = new Map(initial.map(row => [row.key, structuredClone(row)]));
  return {
    rows,
    auth: { getUser: async () => ({ data: { user: options.user }, error: null }) },
    from() {
      let mode = 'read', record, conditions = [], limit = Infinity;
      const query = {
        select() { return query; },
        order() { return query; },
        limit(n) { limit = n; return query; },
        eq(key, value) { conditions.push(row => key === 'value' ? JSON.stringify(row.value) === value : row[key] === value); return query; },
        is(key, value) { return query.eq(key, value); },
        gt(key, value) { conditions.push(row => row[key] > value); return query; },
        insert(value) { mode = 'insert'; record = value; return query; },
        update(value) { mode = 'update'; record = value; return query; },
        async execute(single) {
          if (mode !== 'read' && options.failWrite) return { error: { message: 'network write failed' } };
          if (mode !== 'read' && options.beforeWrite) options.beforeWrite(rows);
          if (mode === 'insert') {
            if (rows.has(record.key)) return { error: { code: '23505' } };
            rows.set(record.key, structuredClone(record));
            return { data: single ? structuredClone(record) : [structuredClone(record)] };
          }
          let matches = [...rows.values()].sort((a,b) => a.key.localeCompare(b.key)).filter(row => conditions.every(condition => condition(row))).slice(0, limit);
          if (mode === 'update') matches = matches.map(row => { const next = structuredClone({ ...row, ...record }); rows.set(row.key, next); return next; });
          return { data: structuredClone(single ? matches[0] || null : matches) };
        },
        maybeSingle() { return query.execute(true); },
        then(resolve, reject) { return query.execute(false).then(resolve, reject); },
      };
      return query;
    },
  };
}
const post = (client, order, extra = {}) => onRequestPost({ request: new Request('https://shop.test/api/order', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer mock-token' }, body: JSON.stringify({ id: order.id, order, ...extra }) }), env: {} }, async () => client);
const get = (client, query) => onRequestGet({ request: new Request(`https://shop.test/api/order?${query}`, { headers: { Authorization: 'Bearer mock-token' } }), env: {} }, async () => client);

test('creation confirms durable storage and does not accept injected paid/driver/status fields', async () => {
  const db = database();
  const response = await post(db, fixture({ status: 'Entregado', paymentVerified: true, tablePaid: true, assignedDriver: { id: 'bad' } }));
  assert.equal(response.status, 200);
  const { order } = await response.json();
  assert.equal(order.status, 'Por Corroborar');
  assert.equal(order.paymentVerified, false);
  assert.equal(order.tablePaid, false);
  assert.equal(order.assignedDriver, null);
  assert.deepEqual(db.rows.get(`order_${order.id}`).value, order);
  assert.deepEqual((await (await get(db, `id=${order.id}`)).json()).order, order);
});

test('failed writes and a zero-row save never produce a success receipt', async () => {
  const response = await post(database([], { failWrite: true }), fixture());
  assert.equal(response.status, 502);
  assert.equal((await response.json()).ok, false);
});

test('retry after a lost response reuses the receipt, and ID collisions cannot overwrite it', async () => {
  const db = database();
  const first = await (await post(db, fixture())).json();
  const retry = await (await post(db, fixture())).json();
  assert.deepEqual(retry.order, first.order);
  assert.equal(db.rows.size, 1);
  const collision = await post(db, fixture({ submissionKey: 'different' }));
  assert.equal(collision.status, 409);
  assert.deepEqual(db.rows.get('order_PED-TEST0001').value, first.order);
});

test('legacy orders remain trackable and can migrate by a conditional first edit', async () => {
  const order = fixture();
  const db = database([{ key: 'orders', value: [order] }]);
  assert.deepEqual((await (await get(db, 'id=PED-TEST0001')).json()).order, order);
  const saved = await saveOrderChange(db, order, { ...order, status: 'Pendiente', paymentVerified: true });
  assert.equal(saved.status, 'Pendiente');
  assert.equal(db.rows.get('order_PED-TEST0001').value.status, 'Pendiente');
  assert.equal((await post(db, fixture({ submissionKey: 'collision' }))).status, 409);
});

test('two operators cannot overwrite one another or resurrect an absent order', async () => {
  const previous = fixture();
  const record = { key: 'order_PED-TEST0001', value: previous, updated_at: previous.date };
  const db = database([record]);
  await saveOrderChange(db, previous, { ...previous, assignedDriver: { id: 'driver' } });
  await assert.rejects(saveOrderChange(db, previous, { ...previous, status: 'Pendiente', paymentVerified: true }), /Otro operador/);
  const racing = database([record], { beforeWrite: rows => rows.set(record.key, { ...record, value: { ...previous, assignedDriver: { id: 'other' } } }) });
  await assert.rejects(saveOrderChange(racing, previous, { ...previous, status: 'Pendiente', paymentVerified: true }), /Otro operador/);
  await assert.rejects(saveOrderChange(database(), previous, { ...previous, status: 'Pendiente', paymentVerified: true }), /Otro operador/);
});

test('all channels follow validation, queue, preparation, ready and confirmed delivery', () => {
  for (const type of ['Delivery', 'Mesa', 'Mesa_Llevar', 'Barra', 'Llevar']) {
    let order = fixture({ customer: { orderType: type, paymentMethod: 'Yape' } });
    assert.throws(() => prepareOrderUpdate(order, { ...order, status: 'Preparando' }), /paso anterior/);
    assert.throws(() => prepareOrderUpdate(order, { ...order, status: 'Pendiente' }), /abono/);
    order = prepareOrderUpdate(order, { ...order, status: 'Pendiente', paymentVerified: true });
    const states = ['Pendiente'];
    while (nextOrderStatus(order)) {
      const next = nextOrderStatus(order);
      if (next === 'En camino') {
        assert.throws(() => prepareOrderUpdate(order, { ...order, status: next }), /repartidor/);
        order = { ...order, assignedDriver: { id: 'driver' } };
      }
      order = prepareOrderUpdate(order, { ...order, status: next });
      states.push(next);
    }
    assert.ok(states.includes('Listo'));
    assert.equal(states.includes('En camino'), type === 'Delivery');
    assert.equal(order.status, 'Entregado');
    assert.throws(() => prepareOrderUpdate(order, { ...order, status: 'Pendiente' }), /paso anterior/);
    assert.equal(order.statusHistory.length, states.length + 1);
  }
});

test('cash delivery requires receipt; serving a table does not automatically mark it paid', () => {
  const cash = fixture({ status: 'En camino', customer: { orderType: 'Delivery', paymentMethod: 'Efectivo' } });
  assert.throws(() => prepareOrderUpdate(cash, { ...cash, status: 'Entregado' }), /cobro/);
  const table = fixture({ status: 'Listo', tablePaid: false, customer: { orderType: 'Mesa', paymentMethod: 'Pago en Caja' } });
  assert.equal(prepareOrderUpdate(table, { ...table, status: 'Entregado' }).tablePaid, false);
});

test('partial/stale list refreshes retain newer statuses, assignment and all order IDs', () => {
  const old = fixture();
  const fresh = { ...old, status: 'Listo', updatedAt: '2026-09-06T11:00:00Z', assignedDriver: { id: 'driver' } };
  const other = fixture({ id: 'PED-OTHER123' });
  const merged = mergeOrders([fresh, other], [old], []);
  assert.equal(merged.length, 2);
  assert.equal(merged.find(o => o.id === old.id).status, 'Listo');
});

test('pagination retrieves orders beyond the default 1000-row Supabase limit', async () => {
  const rows = Array.from({ length: 1250 }, (_, i) => ({ key: `order_PED-${String(i).padStart(6, '0')}`, value: fixture() }));
  assert.equal((await fetchAllSyncRows(database(rows))).length, 1250);
});

test('staff role is verified; drivers only see and update assigned orders', async () => {
  const user = { id: 'driver', email: 'driver@example.test', app_metadata: { role: 'Repartidor' } };
  const own = fixture({ status: 'Listo', assignedDriver: { id: 'driver' } });
  const other = fixture({ id: 'PED-OTHER123', assignedDriver: { id: 'other' } });
  const db = database([own, other].map(value => ({ key: `order_${value.id}`, value, updated_at: null })), { user });
  assert.equal((await (await get(db, 'scope=operations')).json()).orders.length, 1);
  assert.equal(allowedOrderChange(user, own, { ...own, status: 'En camino' }), true);
  assert.equal(allowedOrderChange(user, own, { ...own, grandTotal: 0, status: 'En camino' }), false);
  assert.equal(allowedOrderChange(user, other, { ...other, status: 'En camino' }), false);
  assert.equal((await post(database(), own, { action: 'update', previous: own })).status, 403);
  const sent = await post(db, { ...own, status: 'En camino' }, { action: 'update', previous: own });
  assert.equal(sent.status, 200);
});

test('surveys cannot regress delivery state and are rejected before delivery', async () => {
  const order = fixture();
  const db = database([{ key: `order_${order.id}`, value: order }]);
  assert.equal((await post(db, { id: order.id, survey: { rating: 5 } })).status, 400);
  db.rows.get(`order_${order.id}`).value.status = 'Entregado';
  const saved = await (await post(db, { id: order.id, status: 'Pendiente', survey: { rating: 5 } })).json();
  assert.equal(saved.order.status, 'Entregado');
  assert.equal(saved.order.survey.rating, 5);
});

test('Android HTTPS localhost is allowed while unrelated browser origins are rejected', () => {
  assert.equal(sameOriginRequest(new Request('https://www.pideanda.com/api/order', { headers: { Origin: 'https://localhost' } })), true);
  assert.equal(sameOriginRequest(new Request('https://www.pideanda.com/api/order', { headers: { Origin: 'https://other.test' } })), false);
});
