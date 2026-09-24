import { fail, getAuthenticatedUser, isTrustedAdmin, json, sameOriginRequest } from './_security.js';

const EVENTS = ['view_item', 'add_to_cart', 'begin_checkout', 'purchase'];
const encode = (value) => btoa(unescape(encodeURIComponent(JSON.stringify(value)))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

async function accessToken(credentials, fetcher) {
  const now = Math.floor(Date.now() / 1000);
  const header = encode({ alg: 'RS256', typ: 'JWT' });
  const payload = encode({ iss: credentials.client_email, scope: 'https://www.googleapis.com/auth/analytics.readonly', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 });
  const unsigned = `${header}.${payload}`;
  const pem = credentials.private_key.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, '');
  const binary = atob(pem);
  const keyBytes = Uint8Array.from(binary, c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', keyBytes, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const signature = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned)));
  const jwt = `${unsigned}.${btoa(String.fromCharCode(...signature)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')}`;
  const response = await fetcher('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }) });
  if (!response.ok) throw new Error('No se pudo autenticar la cuenta de servicio de GA4.');
  const data = await response.json();
  if (!data.access_token) throw new Error('Google no devolvió un token de acceso.');
  return data.access_token;
}

export const summarizeReport = (report) => {
  const totals = Object.fromEntries(EVENTS.map(event => [event, 0]));
  const days = new Map();
  for (const row of report.rows || []) {
    const date = row.dimensionValues?.[0]?.value;
    const event = row.dimensionValues?.[1]?.value;
    const count = Number(row.metricValues?.[0]?.value || 0);
    if (!date || !EVENTS.includes(event) || !Number.isFinite(count)) continue;
    totals[event] += count;
    if (!days.has(date)) days.set(date, { date, ...Object.fromEntries(EVENTS.map(name => [name, 0])) });
    days.get(date)[event] += count;
  }
  return { totals, days: [...days.values()].sort((a, b) => a.date.localeCompare(b.date)) };
};

export async function onRequestGet({ request, env }, dependencies = {}) {
  try {
    if (!sameOriginRequest(request)) return fail(403, 'origin', 'Origen no permitido.');
    const auth = await (dependencies.authenticate || getAuthenticatedUser)(request, env);
    if (!auth.user) return fail(401, 'auth', 'Inicia sesión para consultar GA4.');
    if (!isTrustedAdmin(auth.user)) return fail(403, 'authz', 'Solo un administrador puede ver las conversiones.');

    const propertyId = String(env.GA4_PROPERTY_ID || '').trim();
    if (!/^\d+$/.test(propertyId) || !env.GA4_SERVICE_ACCOUNT_JSON) return fail(503, 'config', 'Configura GA4_PROPERTY_ID y GA4_SERVICE_ACCOUNT_JSON como secretos del servidor.');
    const credentials = JSON.parse(env.GA4_SERVICE_ACCOUNT_JSON);
    if (!credentials.client_email || !credentials.private_key) return fail(503, 'config', 'La cuenta de servicio de GA4 está incompleta.');
    const requestedDays = Number(new URL(request.url).searchParams.get('days'));
    const days = [7, 30, 90].includes(requestedDays) ? requestedDays : 30;
    const fetcher = dependencies.fetcher || fetch;
    const token = await accessToken(credentials, fetcher);
    const response = await fetcher(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ dateRanges: [{ startDate: `${days - 1}daysAgo`, endDate: 'today' }], dimensions: [{ name: 'date' }, { name: 'eventName' }], metrics: [{ name: 'eventCount' }], dimensionFilter: { filter: { fieldName: 'eventName', inListFilter: { values: EVENTS } } }, limit: 1000 }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      return fail(response.status === 403 ? 403 : 502, 'ga4', error.error?.message || 'No se pudo consultar el informe de GA4.');
    }
    const report = await response.json();
    return json({ ok: true, propertyId, days, ...summarizeReport(report) });
  } catch (error) {
    return fail(502, 'ga4', error.message || 'No se pudo consultar GA4.');
  }
}
