import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { preferWebp } from '../src/utils/imageUrl.js';

test('own product PNGs are served as their WebP copies', () => {
  assert.equal(preferWebp('/paletas/paleta-fresa-crema.png'), '/paletas/paleta-fresa-crema.webp');
  assert.equal(preferWebp('/customizer/cup-eco.png?v=2'), '/customizer/cup-eco.webp?v=2');
  assert.equal(preferWebp('https://imagenes.pideanda.com/productos/a.png'), 'https://imagenes.pideanda.com/productos/a.png');
  assert.equal(preferWebp('/logo.png'), '/logo.png');
  assert.equal(preferWebp(''), '');
  assert.equal(preferWebp(undefined), undefined);
});

test('every own PNG has the WebP copy it is swapped for', async () => {
  const { readdirSync } = await import('node:fs');
  for (const folder of ['paletas', 'customizer']) {
    for (const name of readdirSync(new URL(`../public/${folder}/`, import.meta.url)).filter(file => file.endsWith('.png'))) {
      assert.ok(existsSync(new URL(`../public/${folder}/${name.replace(/\.png$/, '.webp')}`, import.meta.url)), `${folder}/${name}`);
    }
  }
});
