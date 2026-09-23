import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { enabledOrderChannels, isOrderTypeEnabled, preferredOrderType } from '../src/utils/orderChannels.js';
import { onRequestGet, summarizeReport } from '../functions/api/ga4-report.js';

test('canales permiten operar solo con mesas, barra o delivery', () => {
  const tableOnly = { tableOrdersEnabled: true, barOrdersEnabled: false, deliveryOrdersEnabled: false };
  const barOnly = { tableOrdersEnabled: false, barOrdersEnabled: true, deliveryOrdersEnabled: false };
  const deliveryOnly = { tableOrdersEnabled: false, barOrdersEnabled: false, deliveryOrdersEnabled: true };
  assert.deepEqual(enabledOrderChannels(tableOnly), { Mesa: true, Barra: false, Delivery: false });
  assert.equal(preferredOrderType(tableOnly), 'Mesa');
  assert.equal(preferredOrderType(barOnly), 'Barra');
  assert.equal(preferredOrderType(deliveryOnly, 3), 'Delivery');
  assert.equal(isOrderTypeEnabled(tableOnly, 'Mesa_Llevar'), true);
  assert.equal(isOrderTypeEnabled(tableOnly, 'Delivery'), false);
  assert.equal(isOrderTypeEnabled(barOnly, 'Llevar'), true);
  assert.equal(isOrderTypeEnabled(deliveryOnly, 'Barra'), false);
});

test('informe GA4 resume eventos por día y excluye eventos ajenos', () => {
  const report = { rows: [
    { dimensionValues: [{ value: '20260921' }, { value: 'view_item' }], metricValues: [{ value: '14' }] },
    { dimensionValues: [{ value: '20260921' }, { value: 'purchase' }], metricValues: [{ value: '2' }] },
    { dimensionValues: [{ value: '20260922' }, { value: 'add_to_cart' }], metricValues: [{ value: '4' }] },
    { dimensionValues: [{ value: '20260922' }, { value: 'page_view' }], metricValues: [{ value: '200' }] },
  ] };
  assert.deepEqual(summarizeReport(report), {
    totals: { view_item: 14, add_to_cart: 4, begin_checkout: 0, purchase: 2 },
    days: [
      { date: '20260921', view_item: 14, add_to_cart: 0, begin_checkout: 0, purchase: 2 },
      { date: '20260922', view_item: 0, add_to_cart: 4, begin_checkout: 0, purchase: 0 },
    ],
  });
});

test('API GA4 exige administrador y configuración del servidor', async () => {
  const request = new Request('https://example.com/api/ga4-report?days=30');
  const admin = { user: { email: 'admin@donhelado.com' } };
  const unauthenticated = await onRequestGet({ request, env: {} }, { authenticate: async () => ({ user: null }) });
  assert.equal(unauthenticated.status, 401);
  const forbidden = await onRequestGet({ request, env: {} }, { authenticate: async () => ({ user: { email: 'cliente@example.com' }, adminClient: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { value: [] } }) }) }) }) } }) });
  assert.equal(forbidden.status, 403);
  const config = await onRequestGet({ request, env: {} }, { authenticate: async () => admin });
  assert.equal(config.status, 503);
  assert.match((await config.json()).error, /GA4_PROPERTY_ID/);
});

test('API GA4 consulta solo eventos del embudo con credenciales del servidor', async () => {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const credentials = { client_email: 'report@example.iam.gserviceaccount.com', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }) };
  let reportBody;
  const fetcher = async (url, options) => {
    if (url.includes('oauth2.googleapis.com')) {
      assert.match(options.body.get('assertion'), /^ey/);
      return new Response(JSON.stringify({ access_token: 'test-access-token' }), { status: 200 });
    }
    assert.match(url, /properties\/123456:runReport$/);
    assert.equal(options.headers.Authorization, 'Bearer test-access-token');
    reportBody = JSON.parse(options.body);
    return new Response(JSON.stringify({ rows: [{ dimensionValues: [{ value: '20260923' }, { value: 'purchase' }], metricValues: [{ value: '3' }] }] }), { status: 200 });
  };
  const response = await onRequestGet({ request: new Request('https://example.com/api/ga4-report?days=7'), env: { GA4_PROPERTY_ID: '123456', GA4_SERVICE_ACCOUNT_JSON: JSON.stringify(credentials) } }, { authenticate: async () => ({ user: { email: 'admin@donhelado.com' } }), fetcher });
  assert.equal(response.status, 200);
  assert.deepEqual(reportBody.dimensionFilter.filter.inListFilter.values, ['view_item', 'add_to_cart', 'begin_checkout', 'purchase']);
  assert.equal(reportBody.dateRanges[0].startDate, '6daysAgo');
  assert.equal((await response.json()).totals.purchase, 3);
});
