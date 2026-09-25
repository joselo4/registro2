import { catalogItemPrice } from './orderPricing.js';
import { cartItemKey, money } from './checkout.js';

const activeList = list => (Array.isArray(list) ? list : []).filter(item => item && item.active !== false);

// Older versions added menu helados on a free "cono" that the catalogue now
// prices; move them to the cheapest base so the customer keeps the price
// they were shown.
function migrateQuickBase(item, bases) {
  if (item.type !== 'custom' || !item.base || Number(item.base.price) !== 0) return item;
  const current = activeList(bases).find(base => String(base.id) === String(item.base.id));
  if (!current || Number(current.price) === 0) return item;
  const cheapest = activeList(bases).reduce((best, base) => !best || Number(base.price) < Number(best.price) ? base : best, null);
  if (!cheapest || Number(cheapest.price) !== 0) return item;
  return { ...item, base: { id: cheapest.id, name: cheapest.name, price: 0 } };
}

/**
 * Brings saved cart items in line with the live catalogue, using the same
 * pricing rules the order API applies. Returns the new cart and what changed.
 */
export function reconcileCart(cart, catalog) {
  const changes = [];
  const removed = [];
  if (!Array.isArray(cart) || !Array.isArray(catalog?.flavors) || !Array.isArray(catalog?.packs)) return { cart, changes, removed, changed: false };
  const pricingCatalog = {
    bases: catalog.bases || [],
    flavors: catalog.flavors,
    toppings: catalog.toppings || [],
    packs: catalog.packs,
    popsicles: catalog.popsicles || [],
    literConfig: catalog.literConfig || { price: 15, maxFlavors: 3 },
  };
  const merged = new Map();
  for (const original of cart) {
    const item = migrateQuickBase(original, pricingCatalog.bases);
    const expected = catalogItemPrice(item, pricingCatalog);
    if (!Number.isFinite(expected)) {
      removed.push(item.name || 'Producto');
      continue;
    }
    const next = money(expected) === money(item.price) && item === original ? item : { ...item, price: money(expected) };
    if (money(expected) !== money(original.price)) changes.push({ name: item.name || 'Producto', from: money(original.price), to: money(expected) });
    const key = cartItemKey(next);
    const existing = merged.get(key);
    merged.set(key, existing ? { ...existing, quantity: Math.min(99, existing.quantity + next.quantity) } : next);
  }
  const nextCart = [...merged.values()];
  const changed = removed.length > 0 || nextCart.length !== cart.length || nextCart.some((item, index) => item !== cart[index]);
  return { cart: changed ? nextCart : cart, changes, removed, changed };
}
