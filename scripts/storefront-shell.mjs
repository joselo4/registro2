// Static first paint that uses the same markup and CSS classes as the React
// storefront (navbar, hero and tab bar). The app CSS loads in <head>, so the
// page already looks final before JavaScript starts, and React replaces it
// without a visible jump from a "plain" page to the real design.

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

const navLink = (href, icon, label, active = false) =>
  `<a href="${href}" class="nav-btn${active ? ' active' : ''}" style="text-decoration:none;display:inline-flex;align-items:center"><span aria-hidden="true">${icon}</span><span>${label}</span></a>`;
const tabLink = (href, icon, label, active = false) =>
  `<a href="${href}" class="tab-item${active ? ' active' : ''}" style="text-decoration:none"><span class="tab-icon">${icon}</span><span class="tab-label">${label}</span></a>`;

// Category and product pages keep their own heading for search engines.
// Only same-site paths or https images, matching what the app would render.
const safeLogo = value => typeof value === 'string' && (/^\/(?!\/)[\w./-]+$/.test(value) || /^https:\/\/[\w.-]+\/[\w./%-]+$/.test(value)) ? value : '/favicon.svg';

export function storefrontShellTop({ startingPrice = '1.50', heading = '', intro = '', whatsapp = 'https://wa.me/51989466466', storeName = 'FRIOZO', storeLogo = '' } = {}) {
  const name = escapeHtml(String(storeName || 'FRIOZO').trim() || 'FRIOZO');
  const title = heading ? escapeHtml(heading) : 'Qué rico <span>caer en<br>la tentación.</span>';
  const description = intro ? escapeHtml(intro) : `En <strong>${name}</strong> eliges el sabor y nosotros lo hacemos al momento. Pide tu favorito o crea una mezcla solo tuya.`;
  return `<nav class="navbar glass"><div class="container nav-container">`
    + `<a href="/" class="logo" style="cursor:pointer;display:flex;align-items:center;gap:8px"><img src="${escapeHtml(safeLogo(storeLogo))}" alt="Logo" width="38" height="38" style="width:38px;height:38px;object-fit:contain;border-radius:50%"><span>${name}</span></a>`
    + `<div class="nav-links desktop-only">${navLink('#tienda', '🍦', 'Tienda', true)}${navLink('#personalizar', '✦', 'Crear el mío')}${navLink('#carrito', '🛒', 'Mi pedido')}${navLink('#ubicacion', '📍', 'Ubicacion')}${navLink('#rastrear', '🔎', 'Rastrear')}<span class="nav-btn" style="font-size:1.1rem;padding:6px">🌙 Noche</span></div>`
    + `<div class="mobile-header-actions" style="align-items:center;gap:8px"><span class="nav-btn-icon" aria-hidden="true">🌙</span></div>`
    + `</div></nav>`
    + `<main class="container" style="padding-bottom:80px;flex:1"><div class="customer-shop"><section class="hero">`
    + `<div class="hero-text"><div class="hero-eyebrow"><span class="hero-live-dot" aria-hidden="true"></span>HELADOS, FRUTA Y MUCHA FELICIDAD</div>`
    + `<h1 id="startup-title">${title}</h1>`
    + `<p class="hero-description">${description}</p>`
    + `<div class="hero-cta"><a class="btn btn-primary hero-primary-cta" href="#personalizar" style="text-decoration:none">Quiero mi helado <span aria-hidden="true">→</span></a><a class="btn btn-secondary" href="#catalog" style="text-decoration:none">Explorar la carta</a></div>`
    + `<div class="hero-quick-links" aria-label="Acciones rápidas"><a class="hero-text-link whatsapp-link" href="${escapeHtml(whatsapp)}" rel="noopener noreferrer"><span aria-hidden="true">💬</span> <span>Preguntar por WhatsApp</span></a><a class="hero-text-link" href="#ubicacion"><span aria-hidden="true">📍</span> Ver carritos cercanos</a></div>`
    + `<div class="hero-proof" aria-label="Beneficios de la tienda"><div class="hero-proof-item"><strong>Desde S/. ${escapeHtml(startingPrice)}</strong><span>placer sin vueltas</span></div><div class="hero-proof-item"><strong>Hecho para ti</strong><span>mezcla sin reglas</span></div><div class="hero-proof-item"><strong>Pide desde aquí</strong><span>sigue tu pedido en vivo</span></div></div></div>`
    + `<div class="hero-image-container"><div class="hero-circle-bg"></div><div class="hero-sticker hero-sticker-top" aria-hidden="true"><strong>Artesanal</strong><span>A TU GUSTO</span></div>`
    + `<div class="hero-graphic-premium"><img src="/hero-friozo-v2.webp" alt="Cono Friozo con tres bolas de helado artesanal, frutas y chocolate" fetchpriority="high" decoding="async" width="600" height="600" style="width:100%;height:auto;max-height:380px;object-fit:contain;filter:drop-shadow(0 20px 35px rgba(255,107,129,0.25))"></div>`
    + `<div class="hero-sticker hero-sticker-bottom"><span class="hero-sticker-icon" aria-hidden="true">✦</span><div><strong>Un poquito de felicidad.</strong><span>El toque final lo eliges tú</span></div></div></div>`
    + `</section>`;
}

export function storefrontShellBottom() {
  return `</div></main>`
    + `<nav class="mobile-tab-bar glass">${tabLink('#tienda', '🍦', 'Tienda', true)}${tabLink('#personalizar', '✦', 'Crear')}${tabLink('#carrito', '🛒', 'Pedido')}${tabLink('#ubicacion', '📍', 'Mapa')}${tabLink('#rastrear', '🔎', 'Rastrear')}</nav>`;
}
