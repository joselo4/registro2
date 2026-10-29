import test from 'node:test';
import assert from 'node:assert/strict';
import { base64UrlDecode, base64UrlEncode, encryptPayload, sendWebPush, vapidAuthorization } from '../functions/api/_webpush.js';
import { cleanSubscription, notifyStaff } from '../functions/api/_pushStore.js';
import { onRequestPost as pushPost } from '../functions/api/push.js';

const subtle = crypto.subtle;
const enc = new TextEncoder();
const concat = (...parts) => { const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0)); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; } return out; };
const hmac = async (key, data) => new Uint8Array(await subtle.sign('HMAC', await subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']), data));
const hkdf = async (salt, ikm, info, len) => (await hmac(await hmac(salt, ikm), concat(info, new Uint8Array([1])))).slice(0, len);

// A browser-side subscription: an ECDH key pair and a 16-byte auth secret.
async function makeBrowser() {
  const keys = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const publicRaw = new Uint8Array(await subtle.exportKey('raw', keys.publicKey));
  const auth = crypto.getRandomValues(new Uint8Array(16));
  return { keys, subscription: { endpoint: 'https://push.example.com/send/abc', keys: { p256dh: base64UrlEncode(publicRaw), auth: base64UrlEncode(auth) } }, publicRaw, auth };
}

// RFC 8291 decryption, as the phone's browser performs it.
async function decrypt(body, browser) {
  const salt = body.slice(0, 16);
  const idLength = body[20];
  const serverPublic = body.slice(21, 21 + idLength);
  const ciphertext = body.slice(21 + idLength);
  const serverKey = await subtle.importKey('raw', serverPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await subtle.deriveBits({ name: 'ECDH', public: serverKey }, browser.keys.privateKey, 256));
  const ikm = await hkdf(browser.auth, shared, concat(enc.encode('WebPush: info\0'), browser.publicRaw, serverPublic), 32);
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);
  const key = await subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']);
  const plain = new Uint8Array(await subtle.decrypt({ name: 'AES-GCM', iv: nonce }, key, ciphertext));
  assert.equal(plain.at(-1), 2, 'last record delimiter');
  return new TextDecoder().decode(plain.slice(0, -1));
}

async function makeVapid() {
  const pair = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const publicKey = base64UrlEncode(new Uint8Array(await subtle.exportKey('raw', pair.publicKey)));
  const privateKey = (await subtle.exportKey('jwk', pair.privateKey)).d;
  return { pair, env: { VAPID_PUBLIC_KEY: publicKey, VAPID_PRIVATE_KEY: privateKey, VAPID_SUBJECT: 'mailto:test@example.com' } };
}

test('payload encrypted for a subscription decrypts with the browser keys', async () => {
  const browser = await makeBrowser();
  const body = await encryptPayload({ payload: '{"title":"🔔 Pedido por validar"}', p256dh: browser.subscription.keys.p256dh, auth: browser.subscription.keys.auth });
  assert.equal(new DataView(body.buffer, 16, 4).getUint32(0), 4096);
  assert.equal(await decrypt(body, browser), '{"title":"🔔 Pedido por validar"}');
});

test('VAPID token is a valid ES256 JWT for the push service origin', async () => {
  const { pair, env } = await makeVapid();
  const header = await vapidAuthorization({ endpoint: 'https://fcm.googleapis.com/fcm/send/x', publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY, subject: env.VAPID_SUBJECT, now: 1_700_000_000_000 });
  const [, token, key] = header.match(/^vapid t=([^,]+), k=(.+)$/);
  assert.equal(key, env.VAPID_PUBLIC_KEY);
  const [h, c, s] = token.split('.');
  const claims = JSON.parse(new TextDecoder().decode(base64UrlDecode(c)));
  assert.equal(claims.aud, 'https://fcm.googleapis.com');
  assert.equal(claims.exp, 1_700_000_000 + 43200);
  assert.ok(await subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pair.publicKey, base64UrlDecode(s), enc.encode(`${h}.${c}`)));
});

test('sendWebPush posts an encrypted body and flags gone subscriptions', async () => {
  const { env } = await makeVapid();
  const browser = await makeBrowser();
  const calls = [];
  const fetchImpl = async (url, init) => { calls.push({ url, init }); return new Response(null, { status: calls.length === 1 ? 201 : 410 }); };
  const ok = await sendWebPush({ subscription: browser.subscription, payload: { title: 'Hola' }, env, fetchImpl });
  assert.deepEqual([ok.ok, ok.gone], [true, false]);
  assert.equal(calls[0].init.headers['Content-Encoding'], 'aes128gcm');
  assert.equal(JSON.parse(await decrypt(calls[0].init.body, browser)).title, 'Hola');
  const gone = await sendWebPush({ subscription: browser.subscription, payload: {}, env, fetchImpl });
  assert.equal(gone.gone, true);
  assert.equal((await sendWebPush({ subscription: browser.subscription, payload: {}, env: {}, fetchImpl })).ok, false);
});

test('cleanSubscription accepts only well-formed https subscriptions', async () => {
  const { subscription } = await makeBrowser();
  assert.ok(cleanSubscription(subscription));
  assert.equal(cleanSubscription({ ...subscription, endpoint: 'http://push.example.com/x' }), null);
  assert.equal(cleanSubscription({ ...subscription, keys: { ...subscription.keys, auth: 'x' } }), null);
  assert.equal(cleanSubscription({ endpoint: 'javascript:alert(1)', keys: subscription.keys }), null);
});

function fakeClient(initial = []) {
  const state = { value: initial, updated_at: 't0' };
  const builder = () => {
    let op = null; let payload = null;
    const chain = {
      select: () => chain, eq: () => chain, is: () => chain,
      update: (row) => { op = 'update'; payload = row; return chain; },
      insert: (row) => { op = 'insert'; payload = row; return chain; },
      maybeSingle: async () => {
        if (op) { state.value = payload.value; state.updated_at = payload.updated_at; return { data: { key: 'push_subscriptions' }, error: null }; }
        return { data: { value: state.value, updated_at: state.updated_at }, error: null };
      },
    };
    return chain;
  };
  return { state, from: () => builder() };
}

test('notifyStaff sends to subscribed phones and prunes gone ones', async () => {
  const { env } = await makeVapid();
  const a = (await makeBrowser()).subscription;
  const b = { ...(await makeBrowser()).subscription, endpoint: 'https://push.example.com/send/gone' };
  const client = fakeClient([{ ...a, email: 'x@y.com' }, { ...b, email: 'z@y.com' }]);
  const fetchImpl = async (url) => new Response(null, { status: url.endsWith('/gone') ? 410 : 201 });
  const result = await notifyStaff(client, env, { title: 'Pedido' }, { fetchImpl });
  assert.deepEqual([result.sent, result.removed], [1, 1]);
  assert.deepEqual(client.state.value.map(item => item.endpoint), [a.endpoint]);
  assert.deepEqual(await notifyStaff(client, {}, { title: 'x' }), { sent: 0 });
});

test('push route requires a staff session and stores only clean subscriptions', async () => {
  const { env } = await makeVapid();
  const { subscription } = await makeBrowser();
  const client = fakeClient([]);
  const request = body => new Request('https://shop.test/api/push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const anonymous = await pushPost({ request: request({ action: 'subscribe', subscription }), env }, async () => ({ user: null, error: 'x' }), async () => client);
  assert.equal(anonymous.status, 401);
  const staff = async () => ({ user: { email: 'Ana@Friozo.pe', app_metadata: { role: 'cajero' } } });
  const bad = await pushPost({ request: request({ action: 'subscribe', subscription: { endpoint: 'http://x' } }), env }, staff, async () => client);
  assert.equal(bad.status, 400);
  const ok = await pushPost({ request: request({ action: 'subscribe', subscription }), env }, staff, async () => client);
  assert.equal(ok.status, 200);
  assert.equal(client.state.value.length, 1);
  assert.equal(client.state.value[0].email, 'ana@friozo.pe');
  const other = async () => ({ user: { email: 'otro@friozo.pe', app_metadata: { role: 'vendedor' } } });
  await pushPost({ request: request({ action: 'unsubscribe', endpoint: subscription.endpoint }), env }, other, async () => client);
  assert.equal(client.state.value.length, 1, 'another staff member cannot remove it');
  await pushPost({ request: request({ action: 'unsubscribe', endpoint: subscription.endpoint }), env }, staff, async () => client);
  assert.equal(client.state.value.length, 0);
});
