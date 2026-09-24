import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { prerenderStorefront } from '../scripts/prerender-storefront.mjs';
import { readEmbeddedCatalog, readPublicCatalog, savePublicCatalog } from '../src/utils/publicCatalogCache.js';

test('public pages contain escaped live products, canonical URLs and a real sitemap', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'friozo-prerender-'));
  try {
    await writeFile(join(folder, 'index.html'), await readFile(new URL('../index.html', import.meta.url), 'utf8'));
    const data = [
      { key: 'flavors', value: [{ id: 'chocolate', name: 'Chocolate <script>alert(1)</script>', description: '</script><img src=x onerror=alert(1)>', price: 2, active: true }] },
      { key: 'packs', value: [{ id: 'oferta', name: 'Pack & oferta', price: 10, active: true }] },
      { key: 'popsicles', value: [{ id: 'fresa', name: 'Fresa', price: 3, active: true }] },
      { key: 'delivery_fee', value: 4 },
      { key: 'free_delivery_threshold', value: 10 },
      { key: 'store_phone', value: '51989466466' },
    ];
    const paths = await prerenderStorefront(folder, {
      env: { VITE_SUPABASE_URL: 'https://example.supabase.co', VITE_SUPABASE_ANON_KEY: 'public-key' },
      fetchImpl: async () => ({ ok: true, json: async () => data }),
    });
    assert.ok(paths.includes('/producto/classic-chocolate/'));
    const root = await readFile(join(folder, 'index.html'), 'utf8');
    const product = await readFile(join(folder, 'producto/classic-chocolate/index.html'), 'utf8');
    const sitemap = await readFile(join(folder, 'sitemap.xml'), 'utf8');
    assert.match(root, /id="catalog"/);
    assert.match(root, /Delivery S\/\. 4\.00 · Gratis desde S\/\. 10\.00/);
    assert.match(root, /Chocolate &lt;script&gt;alert\(1\)&lt;\/script&gt;/);
    assert.doesNotMatch(root, /<script>alert\(1\)<\/script>/);
    const embedded = root.match(/<script id="friozo-initial-catalog" type="application\/json">([^<]+)<\/script>/)?.[1];
    assert.ok(embedded);
    assert.equal(JSON.parse(embedded).flavors[0].price, 2);
    assert.equal(readEmbeddedCatalog({ getElementById: () => ({ textContent: embedded }) }).flavors[0].name, 'Chocolate <script>alert(1)</script>');
    assert.match(product, /rel="canonical" href="https:\/\/www\.pideanda\.com\/producto\/classic-chocolate\/"/);
    assert.match(product, /"@type":"Product"/);
    assert.doesNotMatch(product, /<img src=x onerror=alert\(1\)>/);
    assert.match(sitemap, /https:\/\/www\.pideanda\.com\/producto\/classic-chocolate\//);
  } finally {
    if (!folder.startsWith(join(tmpdir(), 'friozo-prerender-'))) throw new Error('Unexpected temporary folder');
    await rm(folder, { recursive: true, force: true });
  }
});

test('public catalog cache excludes private data and expires', () => {
  const values = new Map();
  const storage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) };
  const catalog = { flavors: [], packs: [], store_phone: '51989466466', orders: [{ id: 'private' }], staff_users: [{ email: 'private' }] };
  assert.equal(savePublicCatalog(catalog, storage, 1000), true);
  const cached = readPublicCatalog(storage, 2000);
  assert.deepEqual(cached, { store_phone: '51989466466', flavors: [], packs: [] });
  assert.equal(readPublicCatalog(storage, 1000 + 25 * 60 * 60 * 1000), null);
});
