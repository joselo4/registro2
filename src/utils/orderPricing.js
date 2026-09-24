import { INITIAL_BASES, INITIAL_FLAVORS, INITIAL_PACKS, INITIAL_POPSICLES, INITIAL_TOPPINGS } from './mockData.js';
import { checkoutTotals, money } from './checkout.js';

const EXTRAS = { impulse_fudge: 1.5, impulse_oreo: 1.5, impulse_chispas: 1, impulse_cono: 1.5 };
const active = entry => entry && entry.active !== false;
const product = (list, id) => Array.isArray(list) ? list.find(entry => String(entry.id) === String(id) && active(entry)) : null;
const price = entry => Number(entry?.price);
const validPrice = (received, expected) => Number.isFinite(expected) && expected >= 0 && Math.abs(money(received) - money(expected)) < 0.011;
const validConfiguredMoney = value => (typeof value === 'number' || (typeof value === 'string' && value.trim() !== '')) && Number.isFinite(Number(value)) && Number(value) >= 0;

export function catalogItemPrice(item, catalog) {
  if (item.type === 'pack') return price(product(catalog.packs, item.id));
  if (item.type === 'popsicle') return price(product(catalog.popsicles, item.id));
  if (item.type === 'extra') return EXTRAS[item.id];
  if (item.type === 'custom') {
    const base = product(catalog.bases, item.base?.id);
    if (!base || !Array.isArray(item.scoops) || !item.scoops.length || item.scoops.length > 5 || !Array.isArray(item.toppings || []) || item.toppings.length > 5) return NaN;
    const chosen = [...item.scoops.map(s => product(catalog.flavors, s?.id)), ...(item.toppings || []).map(t => product(catalog.toppings, t?.id)), ...(item.syrup ? [product(catalog.toppings, item.syrup?.id)] : [])];
    if (chosen.some(entry => !entry)) return NaN;
    return money([base, ...chosen].reduce((sum, entry) => sum + price(entry), 0));
  }
  if (item.type === 'liter') {
    if (catalog.literConfig?.active === false || !Array.isArray(item.toppings || []) || item.toppings.length > 3) return NaN;
    const flavorIds = Array.isArray(item.scoops) && item.scoops.length
      ? item.scoops.map(s => s?.id)
      : Array.isArray(item.flavors) ? item.flavors.map(name => catalog.flavors.find(f => f.name === name)?.id) : [];
    if (!flavorIds.length || flavorIds.length > (Number(catalog.literConfig?.maxFlavors) || 3) || flavorIds.some(id => !product(catalog.flavors, id))) return NaN;
    const additions = [...(item.toppings || []).map(t => product(catalog.toppings, t?.id)), ...(item.syrup ? [product(catalog.toppings, item.syrup?.id)] : [])];
    if (additions.some(entry => !entry)) return NaN;
    return money((Number(catalog.literConfig?.price) || 15) + additions.reduce((sum, entry) => sum + price(entry), 0));
  }
  return NaN;
}

export function validateCustomerPricing(order, config) {
  if (!validConfiguredMoney(config.delivery_fee) || !validConfiguredMoney(config.free_delivery_threshold)) {
    return 'La configuración de envío no está disponible. Intenta nuevamente en unos minutos.';
  }
  const catalog = {
    bases: config.bases ?? INITIAL_BASES,
    flavors: config.flavors ?? INITIAL_FLAVORS,
    toppings: config.toppings ?? INITIAL_TOPPINGS,
    packs: config.packs ?? INITIAL_PACKS,
    popsicles: config.popsicles ?? INITIAL_POPSICLES,
    literConfig: config.liter_config ?? { price: 15, maxFlavors: 3 },
  };
  if (order.items.some(item => !validPrice(item.price, catalogItemPrice(item, catalog)))) return 'El precio de un producto cambió. Actualiza el carrito e inténtalo nuevamente.';

  const code = String(order.couponCode || '').trim().toUpperCase();
  const coupon = code && Array.isArray(config.coupons) ? config.coupons.find(c => String(c.code).toUpperCase() === code && c.active !== false && !(Number(c.limit) > 0 && Number(c.usedCount) >= Number(c.limit))) : null;
  if (code && !coupon) return 'El cupón no está disponible. Actualiza el carrito.';
  const options = {
    orderType: order.customer?.orderType,
    deliveryFee: config.delivery_fee,
    freeDeliveryThreshold: config.free_delivery_threshold,
    freeDeliveryEnabled: config.shop_open?.freeDeliveryEnabled !== false,
    coupon,
  };
  const expected = checkoutTotals(order.items, options);
  if (!validPrice(order.discount ?? 0, expected.discount)) return 'El descuento del pedido no coincide con el cupón activo.';
  if (!validPrice(order.deliveryFee ?? 0, expected.shipping)) return 'El costo de envío cambió. Actualiza el carrito.';
  return null;
}
