import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sanitizeHTML,
  sanitizeText,
  sanitizePhone,
  sanitizeUrlToHTTPS,
  safeStorage
} from '../src/utils/security.js';

test('sanitizeHTML strips html tags and returns clean string', () => {
  assert.equal(sanitizeHTML('<script>alert("xss")</script>Hello'), 'Hello');
  assert.equal(sanitizeHTML('<img src=x onerror=alert(1)><b>Helado</b>'), 'Helado');
  assert.equal(sanitizeHTML(null), '');
  assert.equal(sanitizeHTML(undefined), '');
  assert.equal(sanitizeHTML(12345), '12345');
  assert.equal(sanitizeHTML('   Normal text   '), 'Normal text');
});

test('sanitizeText strips tags, control characters and caps length', () => {
  const dirty = '<p>Helado Artesanal\x00\x08</p>';
  assert.equal(sanitizeText(dirty, 50), 'Helado Artesanal');
  assert.equal(sanitizeText('1234567890', 5), '12345');
  assert.equal(sanitizeText(null), '');
  assert.equal(sanitizeText(undefined), '');
});

test('sanitizePhone cleans non-digit/non-plus characters', () => {
  assert.equal(sanitizePhone('+51 987-654-321'), '+51987654321');
  assert.equal(sanitizePhone('987654321'), '987654321');
  assert.equal(sanitizePhone('(01) 456-7890'), '014567890');
  assert.equal(sanitizePhone(null), '');
  assert.equal(sanitizePhone(undefined), '');
});

test('sanitizeUrlToHTTPS allows valid HTTP/HTTPS and blocks dangerous schemes', () => {
  assert.equal(sanitizeUrlToHTTPS('https://friozo.pe/pedido?id=123'), 'https://friozo.pe/pedido?id=123');
  assert.equal(sanitizeUrlToHTTPS('http://localhost:5173'), 'http://localhost:5173');
  assert.equal(sanitizeUrlToHTTPS('javascript:alert(1)'), '');
  assert.equal(sanitizeUrlToHTTPS('data:text/html,<script>alert(1)</script>'), '');
  assert.equal(sanitizeUrlToHTTPS('//evil.com/phishing'), '');
  assert.equal(sanitizeUrlToHTTPS(''), '');
  assert.equal(sanitizeUrlToHTTPS(null), '');
});

test('safeStorage methods handle storage gracefully without throwing', () => {
  // In node environment, window is undefined, safeStorage should return fallbacks safely
  assert.equal(safeStorage.getItem('test_key', 'fallback_val'), 'fallback_val');
  assert.equal(safeStorage.setItem('test_key', 'test_val'), false);
  assert.equal(safeStorage.removeItem('test_key'), false);
  assert.equal(safeStorage.getJSON('test_key', { ok: true }).ok, true);
  assert.equal(safeStorage.setJSON('test_key', { ok: true }), false);
});

test('safeStorage works when window.localStorage is present and catches quota exceptions', () => {
  const store = {};
  globalThis.window = {
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => {
        if (k === 'overflow') throw new Error('QuotaExceededError');
        store[k] = String(v);
      },
      removeItem: (k) => {
        delete store[k];
      }
    }
  };

  assert.equal(safeStorage.setItem('greeting', 'hola'), true);
  assert.equal(safeStorage.getItem('greeting'), 'hola');
  assert.equal(safeStorage.getItem('nonexistent', 'def'), 'def');
  assert.equal(safeStorage.setJSON('data', { count: 42 }), true);
  assert.deepEqual(safeStorage.getJSON('data'), { count: 42 });
  assert.equal(safeStorage.setItem('overflow', 'fail'), false);
  assert.equal(safeStorage.removeItem('greeting'), true);
  assert.equal(safeStorage.getItem('greeting'), null);

  delete globalThis.window;
});

