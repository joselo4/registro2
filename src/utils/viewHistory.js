// Customer screens get their own browser history entry, so the phone's back
// button returns to the previous screen instead of leaving the store.
const VIEW_HASHES = {
  shop: '',
  customizer: '#personalizar',
  'liter-customizer': '#litro',
  cart: '#carrito',
  tracker: '#rastrear',
  locations: '#ubicacion',
  admin: '',
};

const HASH_ALIASES = { '#tienda': 'shop' };

export const isKnownView = view => Object.hasOwn(VIEW_HASHES, String(view));

export function viewFromHash(hash) {
  const clean = String(hash || '').toLowerCase();
  if (!clean || clean === '#') return null;
  if (HASH_ALIASES[clean]) return HASH_ALIASES[clean];
  return Object.keys(VIEW_HASHES).find(view => VIEW_HASHES[view] && VIEW_HASHES[view] === clean) || null;
}

export function urlForView(view, location) {
  return `${location.pathname}${location.search}${VIEW_HASHES[view] ?? ''}`;
}

// Mesas son números de 1 a 999, igual que la validación del servidor.
export const cleanTableParam = value => {
  const table = String(value || '').trim();
  return /^[1-9]\d{0,2}$/.test(table) ? table : null;
};
