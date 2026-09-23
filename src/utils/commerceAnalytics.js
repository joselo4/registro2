const GA4_NAMES = {
  ViewCatalog: 'view_item_list',
  AddToCart: 'add_to_cart',
  InitiateCheckout: 'begin_checkout',
  Purchase: 'purchase'
};

const money = value => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number * 100) / 100 : 0;
};

export const isGoogleMeasurementId = value => /^G-[A-Z0-9]{4,20}$/i.test(String(value || '').trim());

export function toAnalyticsItem(item = {}) {
  const scoops = Array.isArray(item.scoops) ? item.scoops : [];
  const fallbackId = scoops.length
    ? `custom_${item.base?.id || 'base'}_${scoops.map(scoop => typeof scoop === 'string' ? scoop : scoop?.id || scoop?.name).join('_')}`
    : item.name || 'producto';
  const quantity = Number(item.quantity);
  return {
    item_id: String(item.id || fallbackId).slice(0, 100),
    item_name: String(item.name || 'Helado').slice(0, 100),
    item_category: String(item.type || 'helado').slice(0, 100),
    price: money(item.price),
    quantity: Number.isInteger(quantity) && quantity > 0 ? Math.min(quantity, 99) : 1
  };
}

export function toGa4Event(eventName, data = {}) {
  const name = GA4_NAMES[eventName];
  if (!name) return null;
  const items = (Array.isArray(data.items) ? data.items : []).slice(0, 200).map(toAnalyticsItem);
  if (name === 'view_item_list') {
    return { name, params: { item_list_id: String(data.item_list_id || 'catalogo'), item_list_name: String(data.item_list_name || 'Carta'), items } };
  }
  const params = { currency: 'PEN', value: money(data.value), items };
  if (name === 'purchase') {
    if (!data.transaction_id) return null;
    params.transaction_id = String(data.transaction_id);
    params.shipping = money(data.shipping);
    if (data.coupon) params.coupon = String(data.coupon);
  }
  return { name, params };
}

export function toMetaPayload(eventName, data = {}) {
  const items = (Array.isArray(data.items) ? data.items : []).map(toAnalyticsItem);
  const payload = {
    currency: 'PEN',
    value: money(eventName === 'Purchase' ? data.total ?? data.value : data.value),
    content_ids: items.map(item => item.item_id),
    contents: items.map(item => ({ id: item.item_id, quantity: item.quantity })),
    content_type: 'product',
    num_items: items.reduce((sum, item) => sum + item.quantity, 0)
  };
  if (eventName === 'Purchase' && data.transaction_id) payload.order_id = String(data.transaction_id);
  return payload;
}
