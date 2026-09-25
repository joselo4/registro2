import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestGet, onRequestPost } from '../functions/api/order.js';
import { mergeOrders, nextOrderStatus, prepareOrderUpdate, isRecognizedSale, orderRecognizedAt, orderPaymentTiming } from '../src/utils/orderLifecycle.js';
import { saveOrderChange, fetchAllSyncRows } from '../src/utils/orderRepository.js';
import { allowedOrderChange } from '../functions/api/_orderAccess.js';
import { sameOriginRequest } from '../functions/api/_security.js';

const fixture = overrides => ({ id: 'PED-TEST0001', submissionKey: '95f62394-a72d-4db0-a92b-98db316c9dd6', date: '2026-09-06T10:00:00Z', status: 'Por Corroborar', items: [{ type: 'pack', id: 'pack_pareja', name: 'Pack Dúo Romántico', price: 10, quantity: 1 }], customer: { name: 'Prueba', phone: '999999999', address: 'Jr. Prueba 123', orderType: 'Delivery', paymentMethod: 'Yape' }, grandTotal: 10, ...overrides });

// Resolves PostgREST JSON paths such as value->customer->>phone.
const field = (row, key) => key.split(/->>?/).reduce((value, part) => value?.[part], row);
const likePattern = pattern => new RegExp(`^${pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.')}$`);

// Models PostgREST conditional updates and unique inserts, including races.
function database(initial = [], options = {}) {
  const rows = new Map(initial.map(row => [row.key, structuredClone(row)]));
  if (!options.noDefaultConfig) for (const row of [{ key: 'delivery_fee', value: 0 }, { key: 'free_delivery_threshold', value: 15 }]) if (!rows.has(row.key)) rows.set(row.key, row);
  if (options.user && !rows.has('staff_users')) rows.set('staff_users', { key: 'staff_users', value: [{ id: options.user.id, email: options.user.email, role: options.user.app_metadata?.role, status: options.user.app_metadata?.status || 'Activo' }] });
  return {
    rows,
    auth: { getUser: async () => ({ data: { user: options.user }, error: null }) },
    async rpc(name, { p_order, p_coupon_code }) {
      assert.equal(name, 'insert_customer_order');
      const key = `order_${p_order.id}`;
      if (rows.has(key)) return { error: { code: '23505' } };
      const couponRow = rows.get('coupons');
      const coupon = couponRow?.value?.find(entry => entry.code === p_coupon_code);
      if (!coupon || coupon.active === false || (coupon.limit > 0 && coupon.usedCount >= coupon.limit)) return { error: { code: '22023' } };
      if (options.failWrite) return { error: { message: 'network write failed' } };
      rows.set(key, { key, value: structuredClone(p_order) });
      coupon.usedCount = (coupon.usedCount || 0) + 1;
      return { data: structuredClone(p_order) };
    },
    from() {
      let mode = 'read', record, conditions = [], limit = Infinity, countOnly = false;
      const query = {
        select(_columns, config) { countOnly = Boolean(config?.head); return query; },
        like(key, pattern) { conditions.push(row => likePattern(pattern).test(String(field(row, key) ?? ''))); return query; },
        gte(key, value) { conditions.push(row => field(row, key) != null && String(field(row, key)) >= value); return query; },
        order() { return query; },
        limit(n) { limit = n; return query; },
        eq(key, value) { conditions.push(row => key === 'value' ? JSON.stringify(row.value) === value : field(row, key) === value); return query; },
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
          if (countOnly) return { count: matches.length, data: null };
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

test('new orders reject inconsistent totals, missing delivery details and closed stores', async () => {
  for (const changes of [{ grandTotal: 1 }, { total: 1 }, { deliveryFee: -1 }, { discount: 20 }, { customer: { ...fixture().customer, address: '' } }]) {
    const db = database();
    assert.equal((await post(db, fixture(changes))).status, 400);
    assert.ok(!db.rows.has(`order_${fixture().id}`));
  }
  const db = database([{ key: 'shop_open', value: { open: false } }]);
  assert.equal((await post(db, fixture())).status, 400);
  db.rows.get('shop_open').value.open = true;
  const created = await post(db, fixture());
  assert.equal(created.status, 200);
  assert.equal((await created.json()).order.total, 10);
  db.rows.get('shop_open').value.open = false;
  assert.equal((await post(db, fixture())).status, 200); // Recover a confirmed receipt after closing.
});

test('server checks catalog prices, coupons and shipping against stored configuration', async () => {
  assert.equal((await post(database([], { noDefaultConfig: true }), fixture())).status, 503);
  const rows = [
    { key: 'delivery_fee', value: 4 },
    { key: 'free_delivery_threshold', value: 15 },
    { key: 'coupons', value: [{ code: 'HELADO10', type: 'percentage', value: 10, active: true }] },
  ];
  const draft = fixture({ items: [{ type: 'pack', id: 'pack_pareja', name: 'Pack Dúo Romántico', price: 10, quantity: 1 }], deliveryFee: 4, grandTotal: 14 });
  for (const changes of [
    { items: [{ ...draft.items[0], price: 1 }], total: 1, grandTotal: 5 },
    { deliveryFee: 0, grandTotal: 10 },
    { discount: 5, grandTotal: 9 },
    { couponCode: 'FAKE', discount: 1, grandTotal: 13 },
  ]) {
    const db = database(rows);
    assert.equal((await post(db, { ...draft, ...changes })).status, 400);
    assert.ok(!db.rows.has(`order_${draft.id}`));
  }
  const db = database(rows);
  const discounted = { ...draft, couponCode: 'HELADO10', discount: 1, grandTotal: 13 };
  assert.equal((await post(db, discounted)).status, 200);
  assert.equal(db.rows.get('coupons').value[0].usedCount, 1);
  assert.equal((await post(db, discounted)).status, 200);
  assert.equal(db.rows.get('coupons').value[0].usedCount, 1);
});

test('simultaneous coupon orders cannot exceed the limit or save a rejected order', async () => {
  const db = database([{ key: 'coupons', value: [{ code: 'ONE', type: 'flat', value: 1, active: true, limit: 1, usedCount: 0 }] }]);
  const first = fixture({ id: 'PED-COUPON1', couponCode: 'ONE', discount: 1, grandTotal: 9 });
  const second = fixture({ id: 'PED-COUPON2', submissionKey: 'f0ad3976-d6e3-4fc0-8304-13a4fc7de39b', couponCode: 'ONE', discount: 1, grandTotal: 9 });
  const responses = await Promise.all([post(db, first), post(db, second)]);
  assert.deepEqual(responses.map(response => response.status).sort(), [200, 409]);
  assert.equal(db.rows.get('coupons').value[0].usedCount, 1);
  assert.equal([first, second].filter(order => db.rows.has(`order_${order.id}`)).length, 1);
});

test('suspended operator cannot read orders or update a delivery', async () => {
  const user = { id: 'driver', email: 'driver@example.test', app_metadata: { role: 'Repartidor', status: 'Suspendido' } };
  const order = fixture({ assignedDriver: { id: 'driver' }, status: 'En camino' });
  const db = database([{ key: `order_${order.id}`, value: order }], { user });
  assert.equal((await get(db, 'scope=operations')).status, 403);
  assert.equal((await post(db, { ...order, status: 'Entregado', paymentVerified: true }, { action: 'update', previous: order })).status, 403);
  const staleTokenUser = { ...user, app_metadata: { role: 'Repartidor', status: 'Activo' } };
  const revoked = database([{ key: `order_${order.id}`, value: order }, { key: 'staff_users', value: [{ id: 'driver', role: 'Repartidor', status: 'Suspendido' }] }], { user: staleTokenUser });
  assert.equal((await get(revoked, 'scope=operations')).status, 403);
});

test('creation confirms durable storage and does not accept injected paid/driver/status fields', async () => {
  const db = database();
  const response = await post(db, fixture({ status: 'Entregado', paymentVerified: true, tablePaid: true, assignedDriver: { id: 'bad' } }));
  assert.equal(response.status, 200);
  const { order } = await response.json();
  assert.equal(order.status, 'Por Corroborar');
  assert.equal(order.paymentVerified, false);
  assert.equal(order.tablePaid, false);
  assert.equal(order.assignedDriver, null);
  assert.equal(order.customer.paymentTiming, 'Al llegar');
  assert.deepEqual(db.rows.get(`order_${order.id}`).value, order);
  assert.deepEqual((await (await get(db, `id=${order.id}&token=${order.submissionKey}`)).json()).order, order);
  const publicView = (await (await get(db, `id=${order.id}`)).json()).order;
  assert.equal(publicView.status, order.status);
  assert.equal(publicView.limited, true);
  assert.equal(publicView.customer.phone, undefined);
  assert.equal(publicView.customer.address, undefined);
  assert.equal(publicView.submissionKey, undefined);
});

test('operator creations use authenticated server validation for queue orders and completed sales', async () => {
  const mozo = { id: 'waiter-1', email: 'mozo@example.test', app_metadata: { role: 'Mozo' } };
  const tableOrder = fixture({
    id: 'ORD-MESA001',
    status: 'Pendiente',
    paymentVerified: false,
    customer: { name: 'Mesa 4', phone: 'Sin teléfono', address: 'Mesa 4', orderType: 'Mesa', tableNumber: '4', paymentMethod: 'Efectivo', paymentTiming: 'Al llegar' },
  });
  const db = database([], { user: mozo });
  const created = await post(db, tableOrder, { action: 'create_operator' });
  assert.equal(created.status, 200);
  const savedTable = (await created.json()).order;
  assert.equal(savedTable.status, 'Pendiente');
  assert.equal(savedTable.paymentVerified, false);
  assert.equal(savedTable.tablePaid, false);
  assert.equal(savedTable.isOperator, true);
  assert.equal((await post(db, tableOrder, { action: 'create_operator' })).status, 409);

  const sale = fixture({
    id: 'FIS-1001',
    status: 'Entregado',
    paymentVerified: true,
    customer: { name: 'Mostrador', phone: 'N/A', address: 'Barra', orderType: 'Barra', paymentMethod: 'Efectivo', paymentTiming: 'Al llegar' },
  });
  const saleResponse = await post(db, sale, { action: 'create_operator' });
  assert.equal(saleResponse.status, 200);
  const savedSale = (await saleResponse.json()).order;
  assert.ok(savedSale.paymentVerifiedAt);
  assert.ok(savedSale.deliveredAt);
  assert.equal(savedSale.paymentVerifiedBy.role, 'mozo');

  const unpaidSale = { ...sale, id: 'FIS-1002', paymentVerified: false };
  assert.equal((await post(db, unpaidSale, { action: 'create_operator' })).status, 400);
  const driverDb = database([], { user: { id: 'driver', app_metadata: { role: 'Repartidor' } } });
  assert.equal((await post(driverDb, tableOrder, { action: 'create_operator' })).status, 403);
});

test('operator creations use authenticated server validation for queue orders and completed sales', async () => {
  const mozo = { id: 'waiter-1', email: 'mozo@example.test', app_metadata: { role: 'Mozo' } };
  const tableOrder = fixture({
    id: 'ORD-MESA001',
    status: 'Pendiente',
    paymentVerified: false,
    customer: { name: 'Mesa 4', phone: 'Sin teléfono', address: 'Mesa 4', orderType: 'Mesa', tableNumber: '4', paymentMethod: 'Efectivo', paymentTiming: 'Al llegar' },
  });
  const db = database([], { user: mozo });
  const created = await post(db, tableOrder, { action: 'create_operator' });
  assert.equal(created.status, 200);
  const savedTable = (await created.json()).order;
  assert.equal(savedTable.status, 'Pendiente');
  assert.equal(savedTable.paymentVerified, false);
  assert.equal(savedTable.tablePaid, false);
  assert.equal(savedTable.isOperator, true);
  assert.equal((await post(db, tableOrder, { action: 'create_operator' })).status, 409);

  const sale = fixture({
    id: 'FIS-1001',
    status: 'Entregado',
    paymentVerified: true,
    customer: { name: 'Mostrador', phone: 'N/A', address: 'Barra', orderType: 'Barra', paymentMethod: 'Efectivo', paymentTiming: 'Al llegar' },
  });
  const saleResponse = await post(db, sale, { action: 'create_operator' });
  assert.equal(saleResponse.status, 200);
  const savedSale = (await saleResponse.json()).order;
  assert.ok(savedSale.paymentVerifiedAt);
  assert.ok(savedSale.deliveredAt);
  assert.equal(savedSale.paymentVerifiedBy.role, 'mozo');

  const unpaidSale = { ...sale, id: 'FIS-1002', paymentVerified: false };
  assert.equal((await post(db, unpaidSale, { action: 'create_operator' })).status, 400);
  const driverDb = database([], { user: { id: 'driver', app_metadata: { role: 'Repartidor' } } });
  assert.equal((await post(driverDb, tableOrder, { action: 'create_operator' })).status, 403);
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
  assert.equal([...db.rows.keys()].filter(key => key.startsWith('order_')).length, 1);
  const collision = await post(db, fixture({ submissionKey: 'different' }));
  assert.equal(collision.status, 409);
  assert.deepEqual(db.rows.get('order_PED-TEST0001').value, first.order);
});

test('legacy orders remain trackable and can migrate by a conditional first edit', async () => {
  const order = fixture();
  const db = database([{ key: 'orders', value: [order] }]);
  assert.deepEqual((await (await get(db, `id=PED-TEST0001&token=${order.submissionKey}`)).json()).order, order);
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

test('retry after a lost update response returns the durable completed delivery', async () => {
  const previous = fixture({
    status: 'En camino',
    paymentVerified: false,
    assignedDriver: { id: 'driver' },
    customer: { name: 'Cliente', paymentMethod: 'Yape', paymentTiming: 'Al llegar' },
  });
  const proposed = { ...previous, status: 'Entregado', paymentVerified: true };
  const db = database([{ key: `order_${previous.id}`, value: previous, updated_at: previous.date }]);
  const saved = await saveOrderChange(db, previous, proposed);
  const retried = await saveOrderChange(db, previous, proposed);
  assert.deepEqual(retried, saved);
  assert.equal(retried.status, 'Entregado');
  assert.equal(retried.revision, saved.revision);
});

test('all channels follow validation, queue, preparation, ready and confirmed delivery', () => {
  for (const type of ['Delivery', 'Mesa', 'Mesa_Llevar', 'Barra', 'Llevar']) {
    let order = fixture({ customer: { orderType: type, paymentMethod: 'Yape', paymentTiming: 'Anticipado' } });
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

test('confirmed collections and assigned routes cannot be silently reversed', () => {
  const delivered = fixture({
    status: 'Entregado',
    paymentVerified: true,
    assignedDriver: { id: 'driver' },
    customer: { orderType: 'Delivery', paymentMethod: 'Efectivo', paymentTiming: 'Al llegar' },
  });
  assert.throws(() => prepareOrderUpdate(delivered, { ...delivered, paymentVerified: false }), /no se puede/);
  assert.throws(() => prepareOrderUpdate(delivered, { ...delivered, assignedDriver: null }), /repartidor asignado/);

  const prepaidYesterday = {
    ...delivered,
    date: '2026-09-18T15:00:00Z',
    paymentVerifiedAt: '2026-09-18T16:00:00Z',
    deliveredAt: '2026-09-19T18:00:00Z',
    statusHistory: [{ status: 'Entregado', timestamp: '2026-09-19T18:00:00Z' }],
  };
  assert.equal(isRecognizedSale(prepaidYesterday), true);
  assert.equal(orderRecognizedAt(prepaidYesterday), '2026-09-19T18:00:00.000Z');
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
  assert.equal((await fetchAllSyncRows(database(rows, { noDefaultConfig: true }))).length, 1250);
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
  assert.equal((await post(db, { id: order.id, submissionKey: order.submissionKey, survey: { rating: 5 } })).status, 400);
  db.rows.get(`order_${order.id}`).value.status = 'Entregado';
  assert.equal((await post(db, { id: order.id, survey: { rating: 5 } })).status, 403);
  const saved = await (await post(db, { id: order.id, submissionKey: order.submissionKey, status: 'Pendiente', survey: { rating: 5 } })).json();
  assert.equal(saved.order.status, 'Entregado');
  assert.equal(saved.order.survey.rating, 5);
});

test('Android HTTPS localhost is allowed while unrelated browser origins are rejected', () => {
  assert.equal(sameOriginRequest(new Request('https://www.pideanda.com/api/order', { headers: { Origin: 'https://localhost' } })), true);
  assert.equal(sameOriginRequest(new Request('https://www.pideanda.com/api/order', { headers: { Origin: 'https://other.test' } })), false);
  assert.equal(sameOriginRequest(new Request('https://www.pideanda.com/api/order', { headers: { Origin: 'http://www.pideanda.com' } })), false);
});

for (const method of ['Yape', 'Plin', 'Efectivo', 'Transferencia', 'Tarjeta']) {
  test(`payment on arrival: ${method} persists unpaid, reaches dispatch and requires collection`, async () => {
    const user = { id: 'driver', app_metadata: { role: 'Repartidor' } };
    const db = database([], { user });
    const draft = fixture({ customer: { name: 'Cliente', phone: '999999999', address: 'Jr. Prueba 123', orderType: 'Delivery', paymentMethod: method, paymentTiming: 'Al llegar' } });
    const created = await post(db, draft);
    assert.equal(created.status, 200);
    let saved = (await created.json()).order;
    assert.equal(saved.customer.paymentTiming, 'Al llegar');
    assert.equal(saved.paymentVerified, false);
    for (const status of ['Pendiente', 'Preparando', 'Listo', 'En camino']) saved = await saveOrderChange(db, saved, { ...saved, status, assignedDriver: { id: 'driver' } });
    assert.equal(saved.paymentVerified, false);
    const unpaid = await post(db, { ...saved, status: 'Entregado' }, { action: 'update', previous: saved });
    assert.equal(unpaid.status, 409);
    const delivered = await post(db, { ...saved, status: 'Entregado', paymentVerified: true }, { action: 'update', previous: saved });
    assert.equal(delivered.status, 200);
    const completed = (await delivered.json()).order;
    assert.equal(completed.paymentVerified, true);
    assert.ok(Number.isFinite(Date.parse(completed.paymentVerifiedAt)));
    assert.equal(completed.paymentVerifiedBy.role, 'repartidor');
    assert.ok(Number.isFinite(Date.parse(completed.deliveredAt)));
  });
}

test('driver records a changed collection method without permission to alter customer or total', async () => {
  const user = { id: 'driver', app_metadata: { role: 'Repartidor' } };
  const previous = fixture({ status: 'En camino', paymentVerified: false, assignedDriver: { id: 'driver' }, customer: { name: 'Cliente', paymentMethod: 'Yape', paymentTiming: 'Al llegar' } });
  for (const method of ['Yape', 'Plin', 'Efectivo', 'Transferencia', 'Tarjeta']) {
    const next = { ...previous, status: 'Entregado', paymentVerified: true, customer: { ...previous.customer, paymentMethod: method } };
    const db = database([{ key: `order_${previous.id}`, value: previous, updated_at: null }], { user });
    const response = await post(db, next, { action: 'update', previous });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).order.customer.paymentMethod, method);
    assert.equal(allowedOrderChange(user, previous, { ...next, customer: { ...next.customer, name: 'Otro' } }), false);
    assert.equal(allowedOrderChange(user, previous, { ...next, grandTotal: 1 }), false);
    assert.equal(allowedOrderChange(user, previous, { ...next, status: 'En camino' }), false);
    assert.equal(allowedOrderChange({ ...user, id: 'other' }, previous, next), false);
  }
  const prepaid = { ...previous, customer: { ...previous.customer, paymentTiming: 'Anticipado' } };
  assert.equal(allowedOrderChange(user, prepaid, { ...prepaid, status: 'Entregado', paymentVerified: true }), false);
  const paid = { ...previous, paymentVerified: true };
  assert.equal(allowedOrderChange(user, paid, { ...paid, paymentVerified: false }), false);
});

test('legacy digital delivery without timing can be collected once and backfills pay on arrival', async () => {
  const user = { id: 'driver', email: 'driver@example.test', app_metadata: { role: 'Repartidor' } };
  const previous = fixture({
    status: 'En camino',
    paymentVerified: false,
    assignedDriver: { id: 'driver', email: 'driver@example.test' },
    customer: { name: 'Cliente', paymentMethod: 'Yape' },
  });
  assert.equal(orderPaymentTiming(previous), 'Al llegar');
  const next = {
    ...previous,
    status: 'Entregado',
    paymentVerified: true,
    customer: { ...previous.customer, paymentMethod: 'Yape', paymentTiming: 'Al llegar' },
  };
  const db = database([{ key: `order_${previous.id}`, value: previous, updated_at: null }], { user });
  const response = await post(db, next, { action: 'update', previous });
  assert.equal(response.status, 200);
  const completed = (await response.json()).order;
  assert.equal(completed.status, 'Entregado');
  assert.equal(completed.paymentVerified, true);
  assert.equal(completed.customer.paymentTiming, 'Al llegar');
  assert.equal(completed.paymentVerifiedBy.role, 'repartidor');
});

test('disabled methods reject new orders, allow reactivation and preserve retry receipts', async () => {
  const config = { key: 'shop_open', value: { paymentMethods: { Tarjeta: false } } };
  const db = database([config]);
  const draft = fixture({ customer: { name: 'Cliente', phone: '999999999', address: 'Jr. Prueba 123', paymentMethod: 'Tarjeta', paymentTiming: 'Al llegar' } });
  assert.equal((await post(db, draft)).status, 400);
  assert.ok(!db.rows.has('order_' + draft.id));
  db.rows.get('shop_open').value.paymentMethods.Tarjeta = true;
  const created = await post(db, draft);
  assert.equal(created.status, 200);
  db.rows.get('shop_open').value.paymentMethods.Tarjeta = false;
  const retry = await post(db, draft);
  assert.equal(retry.status, 200);
  assert.equal((await retry.json()).order.customer.paymentMethod, 'Tarjeta');
});

test('all disabled methods block new orders and disabled methods cannot replace an existing method', async () => {
  const methods = ['Yape', 'Plin', 'Efectivo', 'Transferencia', 'Tarjeta'];
  const config = { key: 'shop_open', value: { paymentMethods: Object.fromEntries(methods.map(method => [method, false])) } };
  for (const method of methods) {
    assert.equal((await post(database([config]), fixture({ customer: { name: 'Cliente', phone: '999999999', address: 'Jr. Prueba 123', paymentMethod: method } }))).status, 400);
  }
  const user = { id: 'driver', app_metadata: { role: 'Repartidor' } };
  const previous = fixture({ status: 'En camino', paymentVerified: false, assignedDriver: { id: 'driver' }, customer: { name: 'Cliente', paymentMethod: 'Yape', paymentTiming: 'Al llegar' } });
  const db = database([config, { key: 'order_' + previous.id, value: previous, updated_at: null }], { user });
  const next = { ...previous, paymentVerified: true, status: 'Entregado', customer: { ...previous.customer, paymentMethod: 'Tarjeta' } };
  assert.equal((await post(db, next, { action: 'update', previous })).status, 400);
  assert.equal((await post(db, { ...next, customer: previous.customer }, { action: 'update', previous })).status, 200);
});

test('one phone number can place at most 10 orders in 24 hours', async () => {
  const db = database();
  const order = (n, phone = '987654321') => fixture({ id: `PED-LIMIT${String(n).padStart(3, '0')}`, submissionKey: crypto.randomUUID(), customer: { ...fixture().customer, phone } });
  for (let n = 1; n <= 10; n++) assert.equal((await post(db, order(n))).status, 200);
  const blocked = await post(db, order(11, '+51 987 654 321'));
  assert.equal(blocked.status, 429);
  assert.match((await blocked.json()).error, /máximo de 10 pedidos/);
  assert.ok(!db.rows.has('order_PED-LIMIT011'));
  assert.equal((await post(db, order(12, '912345678'))).status, 200);
  // Retrying an order that already exists returns its receipt instead of counting again.
  const first = db.rows.get('order_PED-LIMIT001').value;
  assert.equal((await post(db, { ...order(1), submissionKey: first.submissionKey })).status, 200);
  // Orders older than 24 hours no longer count.
  for (const row of db.rows.values()) if (row.key.startsWith('order_PED-LIMIT')) row.value.createdAt = '2020-01-01T00:00:00.000Z';
  assert.equal((await post(db, order(13))).status, 200);
});

test('one connection is capped, except for table orders placed inside the shop', async () => {
  const db = database();
  const env = { SUPABASE_SERVICE_ROLE_KEY: 'secret' };
  const send = (n, orderType = 'Delivery') => {
    const customer = orderType === 'Delivery' ? { ...fixture().customer, phone: `9${String(10000000 + n)}` } : { name: 'Mesa', phone: 'Mesa', orderType, tableNumber: '3', paymentMethod: 'Yape' };
    const order = fixture({ id: `PED-CONN${String(n).padStart(3, '0')}`, submissionKey: crypto.randomUUID(), customer });
    return onRequestPost({ request: new Request('https://shop.test/api/order', { method: 'POST', headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.7' }, body: JSON.stringify({ id: order.id, order }) }), env }, async () => db);
  };
  for (let n = 1; n <= 30; n++) assert.equal((await send(n)).status, 200);
  assert.equal((await send(31)).status, 429);
  assert.equal((await send(32, 'Mesa')).status, 200);
  const stored = db.rows.get('order_PED-CONN001').value;
  assert.match(stored.clientKey, /^[0-9a-f]{24}$/);
  assert.ok(!JSON.stringify(stored).includes('203.0.113.7'));
});

test('a customer can cancel an unconfirmed order to correct it, only with its receipt', async () => {
  const db = database();
  const order = fixture({ id: 'PED-FIX-101', submissionKey: crypto.randomUUID() });
  assert.equal((await post(db, order)).status, 200);
  const correct = key => onRequestPost({ request: new Request('https://shop.test/api/order', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'customer_correct', id: order.id, submissionKey: key }) }), env: {} }, async () => db);
  assert.equal((await correct(crypto.randomUUID())).status, 403);
  assert.equal(db.rows.get('order_PED-FIX-101').value.status, 'Por Corroborar');
  const response = await correct(order.submissionKey);
  assert.equal(response.status, 200);
  const saved = db.rows.get('order_PED-FIX-101').value;
  assert.equal(saved.status, 'Cancelado');
  assert.equal(saved.cancelledBy, 'cliente');
  assert.equal(saved.statusHistory.at(-1).status, 'Cancelado');
  // Once the shop confirmed (or it is already cancelled) the customer cannot change it.
  assert.equal((await correct(order.submissionKey)).status, 409);
  const confirmed = fixture({ id: 'PED-FIX-102', submissionKey: crypto.randomUUID() });
  assert.equal((await post(db, confirmed)).status, 200);
  db.rows.get('order_PED-FIX-102').value.status = 'Pendiente';
  const locked = await onRequestPost({ request: new Request('https://shop.test/api/order', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'customer_correct', id: confirmed.id, submissionKey: confirmed.submissionKey }) }), env: {} }, async () => db);
  assert.equal(locked.status, 409);
});

test('staff can move a new customer order through accept, kitchen and ready', async () => {
  const admin = { id: 'admin-1', email: 'admin@example.test', app_metadata: { role: 'Administrador' } };
  const db = database([], { user: admin });
  const order = fixture({ id: 'PED-KIT-500', submissionKey: crypto.randomUUID(), customer: { ...fixture().customer, paymentMethod: 'Efectivo' } });
  assert.equal((await post(db, order)).status, 200);
  let current = db.rows.get('order_PED-KIT-500').value;
  for (const status of ['Pendiente', 'Preparando', 'Listo']) {
    const response = await post(db, { ...current, status }, { action: 'update', previous: current });
    const payload = await response.json();
    assert.equal(response.status, 200, `${status}: ${payload.error}`);
    current = payload.order;
    assert.equal(current.status, status);
  }
});
