// Browser storage is an enhancement: privacy settings or a full disk must not
// turn a confirmed order into a failed checkout.
const memory = new Map();
export const checkoutStorage = {
  getItem(key) {
    if (memory.has(key)) return memory.get(key);
    try { return globalThis.localStorage.getItem(key); }
    catch { return memory.get(key) ?? null; }
  },
  setItem(key, value) {
    try { globalThis.localStorage.setItem(key, value); memory.delete(key); }
    catch { memory.set(key, String(value)); }
  },
  removeItem(key) {
    memory.delete(key);
    try { globalThis.localStorage.removeItem(key); } catch { memory.set(key, null); }
  }
};

export const money = value => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

export function checkoutTotals(cart, { deliveryFee = 0, freeDeliveryEnabled = true, freeDeliveryThreshold = 0, orderType = 'Delivery', coupon = null } = {}) {
  const subtotal = money(cart.reduce((sum, item) => sum + money(item.price) * Number(item.quantity), 0));
  const freeDelivery = orderType !== 'Delivery' || (freeDeliveryEnabled && Number(freeDeliveryThreshold) > 0 && subtotal >= Number(freeDeliveryThreshold)) || coupon?.type === 'free_delivery';
  const shipping = freeDelivery ? 0 : Math.max(0, money(deliveryFee) || 0);
  const rawDiscount = coupon?.type === 'percentage' ? subtotal * Number(coupon.value) / 100 : coupon?.type === 'flat' ? Number(coupon.value) : 0;
  const discount = Math.min(subtotal, Math.max(0, money(rawDiscount) || 0));
  return { subtotal, shipping, discount, total: money(subtotal + shipping - discount), freeDelivery };
}

export function cartItemKey(item) {
  return JSON.stringify({ type: item.type, id: item.id, price: Number(item.price), base: item.base?.id, scoops: item.scoops?.map(s => s?.id || s?.name || s), toppings: item.toppings?.map(t => t?.id || t?.name), syrup: item.syrup?.id });
}

export function addCartItem(cart, item) {
  const key = cartItemKey(item);
  const exists = cart.some(current => cartItemKey(current) === key);
  return exists ? cart.map(current => cartItemKey(current) === key ? { ...current, quantity: Math.min(99, Number(current.quantity) + Number(item.quantity || 1)) } : current) : [...cart, { ...item, price: Number(item.price), quantity: Math.min(99, Math.max(1, Number(item.quantity) || 1)) }];
}

// Keep products added while a request was in flight, even after navigation.
export function subtractOrderedItems(cart, items) {
  const counts = new Map();
  for (const item of items) counts.set(cartItemKey(item), (counts.get(cartItemKey(item)) || 0) + Number(item.quantity));
  return cart.map(item => {
    const key = cartItemKey(item);
    const removed = Math.min(Number(item.quantity), counts.get(key) || 0);
    counts.set(key, (counts.get(key) || 0) - removed);
    return { ...item, quantity: Number(item.quantity) - removed };
  }).filter(item => item.quantity > 0);
}

export function readCartDraft() {
  try {
    const draft = JSON.parse(checkoutStorage.getItem('helados_cart_draft'));
    return Array.isArray(draft) ? draft.filter(item => item && typeof item === 'object' && Number.isInteger(Number(item.quantity)) && Number(item.quantity) > 0 && Number(item.quantity) <= 99 && Number.isFinite(Number(item.price)) && Number(item.price) >= 0).map(item => ({ ...item, quantity: Number(item.quantity), price: Number(item.price) })) : [];
  } catch { return []; }
}
