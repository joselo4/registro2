// Static first paint that uses the same markup and CSS classes as the React
// storefront (navbar, hero and tab bar). The app CSS loads in <head>, so the
// page already looks final before JavaScript starts, and React replaces it
// without a visible jump from a "plain" page to the real design.

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

// Same stroke icons as src/components/Icon.jsx, as static SVG strings.
const ICONS = {
  store: '<path d="M4 9.5 5.5 4h13L20 9.5" /><path d="M4 9.5a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0" /><path d="M5.5 12v8h13v-8M10 20v-5h4v5" />',
  sparkle: '<path d="M12 3c.6 4.2 2.8 6.4 7 7-4.2.6-6.4 2.8-7 7-.6-4.2-2.8-6.4-7-7 4.2-.6 6.4-2.8 7-7z" />',
  bag: '<path d="M5 8h14l-1.2 12.5H6.2z" /><path d="M9 8V6.5a3 3 0 0 1 6 0V8" />',
  pin: '<path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z" /><circle cx="12" cy="10" r="2.5" />',
  search: '<circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" />',
  moon: '<path d="M19.5 14.5A7.5 7.5 0 0 1 9.5 4.5a7.5 7.5 0 1 0 10 10z" />',
  arrow: '<path d="M4.5 12h15M14 6.5l5.5 5.5-5.5 5.5" />',
};
const icon = (name, size = 18) => `<svg class="ui-icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICONS[name]}</svg>`;
const navLink = (href, iconName, label, active = false) =>
  `<a href="${href}" class="nav-btn${active ? ' active' : ''}" style="text-decoration:none;display:inline-flex;align-items:center">${icon(iconName)}<span>${label}</span></a>`;
const tabLink = (href, iconName, label, active = false) =>
  `<a href="${href}" class="tab-item${active ? ' active' : ''}" style="text-decoration:none"><span class="tab-icon">${icon(iconName, 22)}</span><span class="tab-label">${label}</span></a>`;

// Category and product pages keep their own heading for search engines.
// Only same-site paths or https images, matching what the app would render.
const safeLogo = value => typeof value === 'string' && (/^\/(?!\/)[\w./-]+$/.test(value) || /^https:\/\/[\w.-]+\/[\w./%-]+$/.test(value)) ? value : '/favicon.svg';

export function storefrontShellTop({ startingPrice = '1.50', priceText = '', heading = '', intro = '', whatsapp = 'https://wa.me/51989466466', storeName = 'Friozo', storeLogo = '' } = {}) {
  const name = escapeHtml(String(storeName || 'Friozo').trim() || 'Friozo');
  const title = heading ? escapeHtml(heading) : 'Qué rico <span>caer en <br>la tentación.</span>';
  const description = intro ? escapeHtml(intro) : `En <strong>${name}</strong> eliges el sabor y nosotros lo hacemos al momento. Pide tu favorito o crea una mezcla solo tuya.`;
  return `<nav class="navbar glass" aria-label="Principal"><div class="container nav-container">`
    + `<a href="/" class="logo" style="cursor:pointer;display:flex;align-items:center;gap:8px"><img src="${escapeHtml(safeLogo(storeLogo))}" alt="Logo" width="38" height="38" style="width:38px;height:38px;object-fit:contain;border-radius:50%"><span>${name}</span></a>`
    + `<div class="nav-links desktop-only">${navLink('#tienda', 'store', 'Tienda', true)}${navLink('#personalizar', 'sparkle', 'Crear el mío')}${navLink('#carrito', 'bag', 'Mi pedido')}${navLink('#ubicacion', 'pin', 'Ubicación')}${navLink('#rastrear', 'search', 'Rastrear')}<span class="nav-btn theme-toggle">${icon('moon')}<span>Noche</span></span></div>`
    + `<div class="mobile-header-actions" style="align-items:center;gap:8px"><span class="nav-btn-icon theme-toggle" aria-hidden="true">${icon('moon', 20)}</span></div>`
    + `</div></nav>`
    + `<main class="container" style="padding-bottom:80px;flex:1"><div class="customer-shop"><section class="hero">`
    + `<div class="hero-text">`
    + `<h1 id="startup-title">${title}</h1>`
    + `<p class="hero-description">${description}</p>`
    + `<div class="hero-cta"><a class="btn btn-primary hero-primary-cta" href="#catalog">Pedir ahora ${icon('arrow')}</a><a class="btn btn-secondary" href="#personalizar">${icon('sparkle')} Arma tu helado</a></div>`
    + `<div class="hero-quick-links" aria-label="Acciones rápidas"><a class="hero-text-link whatsapp-link" href="${escapeHtml(whatsapp)}" rel="noopener noreferrer"><span>Preguntar por WhatsApp</span></a><a class="hero-text-link" href="#ubicacion">${icon('pin', 16)} Ver carritos cercanos</a></div></div>`
    + `<div class="hero-image-container"><div class="hero-circle-bg" aria-hidden="true"></div>`
    + `<div class="hero-graphic-premium"><img src="/hero-friozo-v2.webp" alt="Cono Friozo con tres bolas de helado artesanal, frutas y chocolate" fetchpriority="high" decoding="async" width="600" height="600"></div>`
    + `<div class="hero-price-seal">${priceText ? `<strong>${escapeHtml(priceText)}</strong>` : `<span>Desde</span><strong>S/ ${escapeHtml(startingPrice)}</strong>`}</div></div>`
    + `</section>`;
}

export function storefrontShellBottom() {
  return `</div></main>`
    + `<nav class="mobile-tab-bar glass" aria-label="Accesos rápidos">${tabLink('#tienda', 'store', 'Tienda', true)}${tabLink('#personalizar', 'sparkle', 'Crear')}${tabLink('#carrito', 'bag', 'Pedido')}${tabLink('#ubicacion', 'pin', 'Mapa')}${tabLink('#rastrear', 'search', 'Rastrear')}</nav>`;
}
