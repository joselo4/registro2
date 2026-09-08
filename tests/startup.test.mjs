import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const script = readFileSync(new URL('../public/startup.js', import.meta.url), 'utf8');
test('a module failure gives a useful retry without deleting the cart', () => {
  const handlers = {};
  let reloads = 0;
  let timedOut;
  const status = { textContent: 'Cargando' };
  const retry = { hidden: true, addEventListener: (event, action) => { handlers.click = action; } };
  const elements = { 'startup-status': status, 'startup-retry': retry };
  vm.runInNewContext(script, {
    document: { getElementById: id => elements[id] },
    window: {
      addEventListener: (name, action) => { handlers[name] = action; },
      removeEventListener: name => { delete handlers[name]; },
      setTimeout: callback => { timedOut = callback; return 1; },
      clearTimeout: () => {}, location: { reload: () => { reloads++; } }
    }
  });
  handlers.error();
  assert.equal(retry.hidden, false);
  assert.match(status.textContent, /Tu carrito no se borrará/);
  handlers.click();
  assert.equal(reloads, 1);
  delete elements['startup-status'];
  timedOut(); // Late timers cannot change a successfully loaded storefront.
  handlers['friozo:ready']();
  assert.equal(handlers.error, undefined);
});
