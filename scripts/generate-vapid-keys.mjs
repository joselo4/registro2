// Generates the key pair for staff push alerts. Run once:
//   node scripts/generate-vapid-keys.mjs
// then add both values as secrets in Cloudflare Pages (Settings → Variables and Secrets).
// Never commit the private key or prefix it with VITE_.
import { webcrypto } from 'node:crypto';

const b64url = bytes => Buffer.from(bytes).toString('base64url');
const { publicKey, privateKey } = await webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const rawPublic = new Uint8Array(await webcrypto.subtle.exportKey('raw', publicKey));
const jwk = await webcrypto.subtle.exportKey('jwk', privateKey);

console.log('VAPID_PUBLIC_KEY=' + b64url(rawPublic));
console.log('VAPID_PRIVATE_KEY=' + jwk.d);
console.log('VAPID_SUBJECT=mailto:tu-correo@ejemplo.com');
