export const DEFAULT_PROMOTION = {
  enabled: true,
  showWelcome: true,
  offerLabel: '',
  originalPrice: '',
  salePrice: '',
  eyebrow: 'HOY SE VALE UN ANTOJO',
  title: 'Tu combinación. Tu momento feliz.',
  description: 'Fruta, chocolate y ese topping que lo cambia todo. Prepara tu helado favorito a tu manera.',
  buttonText: 'Armar mi helado',
  action: 'customizer',
  link: '',
  terms: '',
  coupon: '',
  image: '/paletas/paleta-fresa-crema.png',
  imageAlt: 'Paleta de fresa con crema',
  background: '#ffcf32',
  textColor: '#492117',
  buttonColor: '#a71940',
  buttonTextColor: '#ffffff',
  layout: 'image-right',
  imageFit: 'contain',
  position: 'above-hero',
  audience: 'all',
  titleSize: 40,
  height: 260,
  radius: 28,
  startsAt: '',
  endsAt: '',
};

export const DEFAULT_POPUP_PROMOTION = {
  ...DEFAULT_PROMOTION,
  enabled: true,
  eyebrow: '¡BIENVENIDO A FRIOZO!',
  title: '¡Pide online y disfruta lo artesanal!',
  description: 'Descubre nuestros helados hechos a mano, paletas frutales y combinaciones únicas.',
  buttonText: 'Ver la carta',
  action: 'catalog',
};

export const DEFAULT_WEB_PROMOTION = {
  ...DEFAULT_PROMOTION,
  enabled: false,
  position: 'above-hero',
};

export function safePromotionUrl(value, { image = false } = {}) {
  const url = String(value || '').trim();
  if (image && url.length <= 400000 && /^data:image\/(?:webp|png|jpeg);base64,[a-z0-9+/]+=*$/i.test(url)) return url;
  if (!url || /[\s\\]/.test(url) || [...url].some(char => char.charCodeAt(0) < 32)) return '';
  if (/^\/(?!\/)/.test(url)) return url;
  if (!image && /^#[a-z][\w-]*$/i.test(url)) return url;
  try { return new URL(url).protocol === 'https:' ? url : ''; } catch { return ''; }
}

export function normalizePromotion(value = {}, baseDefaults = DEFAULT_PROMOTION) {
  const result = { ...DEFAULT_PROMOTION, ...baseDefaults };
  if (!value || typeof value !== 'object') return result;
  for (const key of ['eyebrow', 'title', 'description', 'buttonText', 'terms', 'coupon', 'imageAlt', 'offerLabel', 'originalPrice', 'salePrice']) {
    if (typeof value[key] === 'string') result[key] = value[key].slice(0, key === 'description' || key === 'terms' ? 500 : 120);
  }
  for (const key of ['background', 'textColor', 'buttonColor', 'buttonTextColor']) {
    if (/^#[\da-f]{6}$/i.test(value[key])) result[key] = value[key];
  }
  for (const [key, choices] of Object.entries({
    action: ['customizer', 'catalog', 'popsicles', 'classic', 'liter', 'packs', 'link'],
    layout: ['image-right', 'image-left', 'text-only'],
    imageFit: ['contain', 'cover'],
    position: ['above-hero', 'above-catalog'],
    audience: ['all', 'delivery', 'table'],
  })) if (choices.includes(value[key])) result[key] = value[key];
  for (const [key, min, max] of [['titleSize', 24, 64], ['height', 180, 480], ['radius', 0, 48]]) {
    if (value[key] !== '' && Number.isFinite(Number(value[key]))) result[key] = Math.min(max, Math.max(min, Number(value[key])));
  }
  for (const key of ['startsAt', 'endsAt']) {
    // Persist an explicit offset; schedules must not shift with a customer's timezone.
    if (value[key] && Number.isFinite(Date.parse(value[key]))) result[key] = new Date(value[key]).toISOString();
  }
  if (typeof value.enabled === 'boolean') result.enabled = value.enabled;
  if (typeof value.showWelcome === 'boolean') result.showWelcome = value.showWelcome;
  if ('image' in value) result.image = safePromotionUrl(value.image, { image: true });
  result.link = safePromotionUrl(value.link);
  return result;
}

export function isPromotionVisible(promotion, { tableNumber, now = Date.now() } = {}) {
  const p = normalizePromotion(promotion);
  return p.enabled && Boolean(p.title.trim()) &&
    !(p.audience === 'table' && !tableNumber) && !(p.audience === 'delivery' && tableNumber) &&
    !(p.startsAt && now < Date.parse(p.startsAt)) && !(p.endsAt && now >= Date.parse(p.endsAt));
}

export function validatePromotion(value) {
  if (!value.enabled) return '';
  if (!String(value.title || '').trim()) return 'Escribe un título para el banner.';
  if (value.startsAt && value.endsAt && Date.parse(value.endsAt) <= Date.parse(value.startsAt)) return 'La fecha de fin debe ser posterior al inicio.';
  if (value.action === 'link' && !safePromotionUrl(value.link)) return 'Introduce un enlace HTTPS o una ruta de la app para el botón.';
  if (value.image && !safePromotionUrl(value.image, { image: true })) return 'La imagen debe usar una dirección HTTPS o una ruta de la app.';
  return '';
}
