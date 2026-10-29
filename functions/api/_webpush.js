// Web Push without dependencies: VAPID (RFC 8292) and aes128gcm payload encryption
// (RFC 8291), built on WebCrypto so it runs in Cloudflare Workers and in Node tests.

const encoder = new TextEncoder();

export const base64UrlEncode = (bytes) => {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  for (const byte of data) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

export const base64UrlDecode = (value) => {
  const text = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
  const padded = text + '='.repeat((4 - (text.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
};

const concat = (...parts) => {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) { out.set(part, offset); offset += part.length; }
  return out;
};

const hmac = async (key, data) => {
  const cryptoKey = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, data));
};

// HKDF with a single expand block (every length used here is at most 32 bytes).
const hkdf = async (salt, ikm, info, length) => {
  const prk = await hmac(salt, ikm);
  const okm = await hmac(prk, concat(info, new Uint8Array([1])));
  return okm.slice(0, length);
};

// The VAPID key pair is configured as two base64url strings: the 65-byte public
// point and the 32-byte private scalar.
const vapidSigningKey = async (publicKey, privateKey) => {
  const point = base64UrlDecode(publicKey);
  if (point.length !== 65 || point[0] !== 4) throw new Error('VAPID_PUBLIC_KEY no es una clave P-256 válida.');
  const jwk = {
    kty: 'EC', crv: 'P-256', ext: true,
    x: base64UrlEncode(point.slice(1, 33)),
    y: base64UrlEncode(point.slice(33, 65)),
    d: String(privateKey || '').trim(),
  };
  return crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
};

export const vapidAuthorization = async ({ endpoint, publicKey, privateKey, subject, now = Date.now() }) => {
  const audience = new URL(endpoint).origin;
  const header = base64UrlEncode(encoder.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = base64UrlEncode(encoder.encode(JSON.stringify({ aud: audience, exp: Math.floor(now / 1000) + 12 * 60 * 60, sub: subject })));
  const unsigned = `${header}.${claims}`;
  const key = await vapidSigningKey(publicKey, privateKey);
  const signature = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, encoder.encode(unsigned)));
  return `vapid t=${unsigned}.${base64UrlEncode(signature)}, k=${publicKey}`;
};

export const encryptPayload = async ({ payload, p256dh, auth, salt = crypto.getRandomValues(new Uint8Array(16)), serverKeys }) => {
  const userPublic = base64UrlDecode(p256dh);
  const authSecret = base64UrlDecode(auth);
  if (userPublic.length !== 65 || authSecret.length !== 16) throw new Error('Suscripción push inválida.');
  const localKeys = serverKeys || await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const localPublic = new Uint8Array(await crypto.subtle.exportKey('raw', localKeys.publicKey));
  const userKey = await crypto.subtle.importKey('raw', userPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: userKey }, localKeys.privateKey, 256));

  const ikm = await hkdf(authSecret, shared, concat(encoder.encode('WebPush: info\0'), userPublic, localPublic), 32);
  const contentKey = await hkdf(salt, ikm, encoder.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, encoder.encode('Content-Encoding: nonce\0'), 12);

  const plaintext = concat(encoder.encode(payload), new Uint8Array([2]));
  const aesKey = await crypto.subtle.importKey('raw', contentKey, 'AES-GCM', false, ['encrypt']);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, plaintext));

  const recordSize = new Uint8Array([0, 0, 16, 0]); // 4096
  return concat(salt, recordSize, new Uint8Array([localPublic.length]), localPublic, ciphertext);
};

/**
 * Sends one notification. Returns { ok, gone } where gone means the subscription
 * no longer exists (the phone unsubscribed or reinstalled) and should be removed.
 */
export const sendWebPush = async ({ subscription, payload, env, ttl = 3600, urgency = 'high', fetchImpl = fetch }) => {
  const publicKey = String(env.VAPID_PUBLIC_KEY || '').trim();
  const privateKey = String(env.VAPID_PRIVATE_KEY || '').trim();
  if (!publicKey || !privateKey) return { ok: false, gone: false, error: 'VAPID no configurado' };
  const endpoint = String(subscription?.endpoint || '');
  if (!/^https:\/\//.test(endpoint)) return { ok: false, gone: true, error: 'endpoint inválido' };
  const body = await encryptPayload({ payload: JSON.stringify(payload), p256dh: subscription.keys?.p256dh, auth: subscription.keys?.auth });
  const authorization = await vapidAuthorization({ endpoint, publicKey, privateKey, subject: String(env.VAPID_SUBJECT || 'mailto:soporte@pideanda.com') });
  const response = await fetchImpl(endpoint, {
    method: 'POST',
    headers: {
      Authorization: authorization,
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: String(ttl),
      Urgency: urgency,
    },
    body,
  });
  return { ok: response.ok, gone: response.status === 404 || response.status === 410, status: response.status };
};
