import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import CustomerShop from '../src/components/CustomerShop.jsx';
import Cart from '../src/components/Cart.jsx';

const shop = { onAddToCart() {}, setView() {}, shopConfig: { popupPromotion: { enabled: false } } };
test('packs with missing badges and catalog prices stored as text render without crashing', () => {
  const html = renderToStaticMarkup(<CustomerShop {...shop} flavors={[{ id: 'fresa', name: 'Fresa', price: '2.50' }]} packs={[{ id: 'duo', name: 'Dúo', price: '12.50' }]} literConfig={{ price: '15.00' }} />);
  for (const price of ['2.50', '12.50', '15.00']) assert.ok(html.includes(price));
  assert.ok(!html.includes('NaN'));
  assert.ok(!html.includes('undefined'));
});
test('table catalog never injects excluded paletas and explains empty categories', () => {
  const html = renderToStaticMarkup(<CustomerShop {...shop} tableNumber="1" shopConfig={{ ...shop.shopConfig, tableCatalogCategories: ['classic'] }} popsicles={[{ id: 'mango', name: 'Paleta prohibida', price: 3 }]} />);
  assert.ok(!html.includes('Paleta prohibida'));
  assert.ok(html.includes('No hay productos disponibles'));
});
test('empty cart provides a path to products without a checkout form', () => {
  const html = renderToStaticMarkup(<Cart cart={[]} />);
  assert.ok(html.includes('Ver la carta'));
  assert.ok(!html.includes('<form'));
});
test('old custom items tolerate missing optional details and quantities have accessible names', () => {
  const html = renderToStaticMarkup(<Cart cart={[{ type: 'custom', name: 'Helado', price: 3, quantity: 99 }]} />);
  assert.ok(html.includes('Eliminar Helado'));
  assert.match(html, /aria-label="Agregar una unidad de Helado"[^>]*disabled/);
  assert.ok(html.includes('Confirmar pedido · S/. 297.00'));
});
