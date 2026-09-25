import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import IceCreamCustomizer from '../src/components/IceCreamCustomizer.jsx';
import LiterCustomizer from '../src/components/LiterCustomizer.jsx';
import Cart from '../src/components/Cart.jsx';

const bases = [{ id: 'normal', name: 'Cono normal', price: 0 }, { id: 'waffle', name: 'Copa waffle', price: 2 }];
const flavors = [{ id: 'fresa', name: 'Fresa', price: 1.5 }, { id: 'coco', name: 'Coco', price: 2 }, { id: 'menta', name: 'Menta', price: 2 }];
const toppings = [{ id: 'oreo', name: 'Galleta Oreo', price: .5, category: 'solido' }, { id: 'fudge', name: 'Fudge', price: .5, category: 'liquido' }];

test('editing a helado from the cart opens the builder with that creation', () => {
  const item = { type: 'custom', name: 'Helado', base: bases[1], scoops: [flavors[1], flavors[2]], toppings: [toppings[0]], syrup: toppings[1], price: 6.5, quantity: 3 };
  const html = renderToStaticMarkup(<IceCreamCustomizer bases={bases} flavors={flavors} toppings={toppings} editingItem={item} onSaveEdit={() => true} onCancelEdit={() => {}} onAddToCart={() => {}} setView={() => {}} />);
  assert.match(html, /EDITANDO TU HELADO/);
  assert.match(html, /Guardar cambios/);
  assert.match(html, /Copa waffle/);
  for (const name of ['Coco', 'Menta', 'Galleta Oreo', 'Fudge']) assert.match(html, new RegExp(`Quitar[^"]*${name}`));
  assert.match(html, /S\/ 7\.00/); // 2 + 2 + 2 + .5 + .5
});

test('editing a litre keeps its flavours and extras', () => {
  const item = { type: 'liter', name: 'Litro', scoops: [{ id: 'fresa' }, { id: 'coco' }], toppings: [{ id: 'oreo' }], syrup: { id: 'fudge' }, price: 17, quantity: 1 };
  const html = renderToStaticMarkup(<LiterCustomizer flavors={flavors} toppings={toppings} literConfig={{ price: 16, maxFlavors: 3 }} editingItem={item} onSaveEdit={() => true} onCancelEdit={() => {}} onAddToCart={() => {}} setView={() => {}} />);
  assert.match(html, /EDITANDO TU LITRO/);
  assert.match(html, /2\/3 sabores/);
  assert.match(html, /S\/ 17\.00/);
  assert.match(html, /Guardar cambios/);
});

test('built items in the cart offer an edit button; ready-made products do not', () => {
  const cart = [
    { type: 'custom', name: 'Helado de Fresa', base: bases[0], scoops: [flavors[0]], toppings: [], price: 1.5, quantity: 1 },
    { type: 'popsicle', id: 'p1', name: 'Paleta', price: 3, quantity: 1 },
  ];
  const html = renderToStaticMarkup(<Cart cart={cart} flavors={flavors} bases={bases} onEditItem={() => {}} onUpdateQuantity={() => {}} onRemoveFromCart={() => {}} onPlaceOrder={() => {}} setView={() => {}} onAddToCart={() => {}} shopConfig={{}} />);
  assert.equal([...html.matchAll(/class="cart-edit-btn"/g)].length, 1);
  assert.match(html, /Editar Helado de Fresa/);
});
