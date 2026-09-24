const KEY = 'friozo_public_catalog_cache_v1';
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
export const PUBLIC_STORE_KEYS = [
  'store_name', 'store_logo', 'store_title', 'store_favicon', 'store_phone',
  'store_instagram', 'store_facebook', 'whatsapp_contact_message', 'shop_open',
  'catalog_order', 'flavors', 'toppings', 'bases', 'packs', 'popsicles',
  'testimonials', 'coupons', 'delivery_fee', 'free_delivery_threshold',
  'delivery_campaign_text', 'sound_enabled', 'whatsapp_greeting',
  'whatsapp_footer', 'qr_custom_url', 'recommendations', 'cart_recommended_pack',
  'liter_config', 'ticket_custom_message', 'cart_locations',
  'store_hero_image', 'meta_pixel_id', 'google_analytics_id'
];
const CACHED_STORE_KEYS = [
  'store_name', 'store_logo', 'store_title', 'store_favicon', 'store_phone',
  'shop_open', 'catalog_order', 'flavors', 'toppings', 'bases', 'packs',
  'popsicles', 'delivery_fee', 'free_delivery_threshold',
  'delivery_campaign_text', 'liter_config', 'store_hero_image'
];

export function savePublicCatalog(data, storage = globalThis.localStorage, now = Date.now()) {
  if (!storage || !data || typeof data !== 'object') return false;
  const publicData = Object.fromEntries(CACHED_STORE_KEYS.filter(key => Object.hasOwn(data, key)).map(key => [key, data[key]]));
  if (!Array.isArray(publicData.flavors) || !Array.isArray(publicData.packs)) return false;
  try {
    storage.setItem(KEY, JSON.stringify({ savedAt: now, data: publicData }));
    return true;
  } catch { return false; }
}

export function readPublicCatalog(storage = globalThis.localStorage, now = Date.now()) {
  try {
    const saved = JSON.parse(storage?.getItem(KEY) || 'null');
    if (!saved || !Number.isFinite(saved.savedAt) || saved.savedAt > now || now - saved.savedAt > MAX_AGE_MS) return null;
    const data = saved.data;
    if (!data || !Array.isArray(data.flavors) || !Array.isArray(data.packs)) return null;
    return Object.fromEntries(CACHED_STORE_KEYS.filter(key => Object.hasOwn(data, key)).map(key => [key, data[key]]));
  } catch { return null; }
}

export function readEmbeddedCatalog(documentRef = globalThis.document) {
  try {
    const raw = documentRef?.getElementById('friozo-initial-catalog')?.textContent;
    if (!raw) return null;
    const data = JSON.parse(raw);
    return Array.isArray(data?.flavors) && Array.isArray(data?.packs) ? data : null;
  } catch { return null; }
}
