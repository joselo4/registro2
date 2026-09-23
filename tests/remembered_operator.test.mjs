import test from 'node:test';
import assert from 'node:assert/strict';
import { readRememberedOperator } from '../src/utils/rememberedOperator.js';

test('previously saved operator passwords are removed while retaining the username', () => {
  const values = new Map([['friozo_saved_operator_login', JSON.stringify({ user: 'admin@example.com', pass: 'old-secret' })]]);
  const storage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
  };
  assert.equal(readRememberedOperator(storage), 'admin@example.com');
  assert.deepEqual(JSON.parse(values.get('friozo_saved_operator_login')), { user: 'admin@example.com' });
});
