import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadEnv } from 'vite';
import { INITIAL_FLAVORS, INITIAL_PACKS, INITIAL_POPSICLES } from '../src/utils/mockData.js';
import { productPath } from '../src/utils/catalogRoutes.js';
import { storefrontShellBottom, storefrontShellTop } from './storefront-shell.mjs';

const ORIGIN = 'https://www.pideanda.com';
const CATEGORIES = [
  { path: '/helados/', label: 'Helados simples', kind: 'classic', key: 'flavors', intro: 'Elige un sabor artesanal y personaliza tu helado.' },
  { path: '/paletas/', label: 'Paletas artesanales', kind: 'popsicle', key: 'popsicles', intro: 'Paletas cremosas y frutales hechas para refrescarte.' },
  { path: '/promociones/', label: 'Packs y combos', kind: 'pack', key: 'packs', intro: 'Opciones para compartir y celebrar.' },
];
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const safeJson = value => JSON.stringify(value).replace(/</g, '\\u003c').replace(/&/g, '\\u0026').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
const localImage = value => typeof value === 'string' && /^\/(?!\/)[a-zA-Z0-9/_-]+\.(?:webp|png|jpe?g)$/.test(value) ? value : '';
const available = item => item && item.active !== false && item.id != null && item.name && Number.isFinite(Number(item.price)) && Number(item.price) >= 0;
const money = value => Number(value).toFixed(2);

async function publicCatalog(env, fetchImpl) {
  const url = env.VITE_SUPABASE_URL;
  const key = env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_KEY;
  if (!url || !key) {
    if (env.STATIC_CATALOG_ALLOW_SAMPLE === '1') return { flavors: INITIAL_FLAVORS, packs: INITIAL_PACKS, popsicles: INITIAL_POPSICLES, delivery_fee: 4, free_delivery_threshold: 10, store_phone: '51989466466' };
    throw new Error('Faltan las credenciales públicas de Supabase; se cancela la compilación para evitar publicar un catálogo de ejemplo.');
  }
  const endpoint = new URL('/rest/v1/helados_sync', url);
  endpoint.searchParams.set('select', 'key,value');
  endpoint.searchParams.set('key', 'in.(flavors,packs,popsicles,bases,toppings,liter_config,delivery_fee,free_delivery_threshold,store_phone,store_name,store_logo,shop_open)');
  const response = await fetchImpl(endpoint, { headers: { apikey: key, Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`No se pudo leer el catálogo público (${response.status}).`);
  const rows = await response.json();
  if (!Array.isArray(rows)) throw new Error('Respuesta inválida del catálogo público.');
  const data = Object.fromEntries(rows.map(row => [row.key, row.value]));
  if (!Array.isArray(data.flavors) || !Array.isArray(data.packs)) throw new Error('Falta el catálogo público; se cancela la compilación para evitar publicar precios antiguos.');
  return { ...data, popsicles: Array.isArray(data.popsicles) ? data.popsicles : INITIAL_POPSICLES };
}

function productCard(item, kind) {
  const image = localImage(item.image);
  const href = `${productPath(kind, item)}/`;
  return `<article class="static-product"><a href="${escapeHtml(href)}">${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(item.name)}" loading="lazy" width="160" height="160">` : '<span class="static-product-icon" aria-hidden="true">🍦</span>'}<h3>${escapeHtml(item.name)}</h3></a><p>${escapeHtml(item.description || 'Helado artesanal hecho en Andahuaylas.')}</p><strong>${kind === 'classic' ? 'Desde ' : ''}S/. ${money(item.price)}</strong><a class="static-product-action" href="${escapeHtml(href)}">Ver producto</a></article>`;
}

export function staticContent({ heading, intro, sections, deliveryText, phone, productName = '', status = true, isHome = false, startingPrice, priceText, storeName, storeLogo }) {
  const cleanPhone = String(phone || '').replace(/D/g, '');
  const message = productName ? `Hola Friozo, quiero pedir ${productName}. Confírmenme precio y disponibilidad.` : 'Hola Friozo, quiero hacer un pedido de helados.';
  const whatsapp = /^51d{9}$/.test(cleanPhone) ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}` : `https://wa.me/51989466466?text=${encodeURIComponent(message)}`;
  // The top mirrors the live storefront; the crawlable catalogue follows below.
  const top = storefrontShellTop({ startingPrice, priceText, whatsapp, storeName, storeLogo, ...(isHome ? {} : { heading, intro }) });
  const catalog = `<div class="static-catalog">${isHome ? `<h2 class="static-catalog-title">${escapeHtml(heading)}</h2><p>${escapeHtml(intro)}</p>` : ''}<p class="static-delivery">${escapeHtml(deliveryText)}</p><div class="static-actions"><a class="static-primary" href="/#catalog">Explorar la carta</a><a href="${escapeHtml(whatsapp)}" rel="noopener noreferrer">Pedir por WhatsApp</a></div>${sections.map((section, index) => `<section class="static-section"${index === 0 ? ' id="catalog"' : ''}><h2><a href="${escapeHtml(section.path)}">${escapeHtml(section.label)}</a></h2><p>${escapeHtml(section.intro)}</p><div class="static-grid">${section.items.map(item => productCard(item, section.kind)).join('')}</div></section>`).join('')}<footer class="static-footer"><p>Los precios y la disponibilidad se confirman al completar el pedido.</p>${status ? '<p id="startup-status" role="status">La compra interactiva se está activando. Puedes ver la carta y pedir por WhatsApp.</p><button id="startup-retry" type="button" hidden>Volver a cargar la tienda</button>' : ''}</footer></div>`;
  return `<div class="friozo-shell">${top}${catalog}${storefrontShellBottom()}</div>`;
}

function pageHtml(base, page) {
  let html = base.replace(/<div id="root">[\s\S]*?<\/div>\s*<script src="\/startup\.js"><\/script>/, `<div id="root">${page.content}</div>\n    <script id="friozo-initial-catalog" type="application/json">${safeJson(page.bootstrap)}</script>\n    <script src="/startup.js"></script>`);
  if (!html.includes(page.content)) throw new Error('No se encontró la raíz de la tienda para prerenderizar.');
  const replaceTag = (pattern, value) => { html = html.replace(pattern, value); };
  replaceTag(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(page.title)}</title>`);
  replaceTag(/<meta name="description" content="[^"]*"\s*\/>/, `<meta name="description" content="${escapeHtml(page.description)}" />`);
  replaceTag(/<link rel="canonical" href="[^"]*"\s*\/>/, `<link rel="canonical" href="${ORIGIN}${page.path}" />`);
  for (const [name, value] of Object.entries({ 'og:url': `${ORIGIN}${page.path}`, 'og:title': page.title, 'og:description': page.description, 'twitter:url': `${ORIGIN}${page.path}`, 'twitter:title': page.title, 'twitter:description': page.description })) {
    const attribute = name.startsWith('og:') ? 'property' : 'name';
    replaceTag(new RegExp(`<meta ${attribute}="${name}" content="[^"]*" \\/>`), `<meta ${attribute}="${name}" content="${escapeHtml(value)}" />`);
  }
  if (page.structured) html = html.replace('</head>', `    <script type="application/ld+json">${safeJson(page.structured)}</script>\n  </head>`);
  return html;
}

export async function prerenderStorefront(directory = 'dist', options = {}) {
  const root = resolve(directory);
  const env = options.env || loadEnv('production', process.cwd(), 'VITE_');
  const catalog = await publicCatalog(env, options.fetchImpl || fetch);
  const sections = CATEGORIES.map(category => ({ ...category, items: catalog[category.key].filter(available) }));
  const fee = Number(catalog.delivery_fee);
  const threshold = Number(catalog.free_delivery_threshold);
  const deliveryText = Number.isFinite(fee) && fee > 0 ? `Delivery S/. ${money(fee)}${Number.isFinite(threshold) && threshold > 0 ? ` · Gratis desde S/. ${money(threshold)}` : ''}` : 'Consulta el delivery al confirmar tu pedido';
  const phone = catalog.store_phone;
  const prices = (catalog.flavors || []).filter(available).map(item => Number(item.price)).filter(price => price > 0);
  const startingPrice = prices.length ? money(Math.min(...prices)) : '1.50';
  const base = await readFile(join(root, 'index.html'), 'utf8');
  const bootstrap = Object.fromEntries(['flavors', 'packs', 'popsicles', 'bases', 'toppings', 'liter_config', 'delivery_fee', 'free_delivery_threshold', 'store_phone', 'store_name', 'store_logo'].filter(key => Object.hasOwn(catalog, key)).map(key => [key, catalog[key]]));
  const pages = [{ path: '/', title: 'Friozo | Helados Artesanales, Paletas y Delivery en Andahuaylas', description: 'Elige helados artesanales, paletas y packs en Andahuaylas. Compra en línea o pide por WhatsApp.', heading: 'La carta de FRIOZO', intro: 'Elige tus favoritos y arma tu pedido en minutos.', sections, isHome: true }];
  for (const section of sections) pages.push({ path: section.path, title: `${section.label} en Andahuaylas | Friozo`, description: `${section.intro} Consulta la carta de Friozo y pide delivery en Andahuaylas.`, heading: section.label, intro: section.intro, sections: [section] });
  pages.push({ path: '/delivery-andahuaylas/', title: 'Delivery de helados en Andahuaylas | Friozo', description: 'Pide helados artesanales, paletas y packs Friozo con delivery en Andahuaylas.', heading: 'Delivery de helados en Andahuaylas', intro: 'Escoge tus favoritos y confirma tu dirección al hacer el pedido.', sections });
  for (const section of sections) for (const item of section.items) {
    const path = `${productPath(section.kind, item)}/`;
    const description = String(item.description || `${item.name} artesanal en Andahuaylas.`).slice(0, 220);
    pages.push({ path, title: `${item.name} | Friozo Andahuaylas`, description, heading: item.name, intro: description, productName: item.name, sections: [{ ...section, items: [item] }], structured: { '@context': 'https://schema.org', '@type': 'Product', name: item.name, description, url: `${ORIGIN}${path}`, ...(localImage(item.image) ? { image: `${ORIGIN}${item.image}` } : {}), offers: { '@type': 'Offer', priceCurrency: 'PEN', price: money(item.price), availability: 'https://schema.org/InStock', url: `${ORIGIN}${path}` } } });
  }
  const paths = new Set();
  for (const page of pages) {
    if (paths.has(page.path)) throw new Error(`Ruta de producto duplicada: ${page.path}`);
    paths.add(page.path);
    page.bootstrap = bootstrap;
    page.content = staticContent({ heading: page.heading, intro: page.intro, sections: page.sections, deliveryText, phone, productName: page.productName, isHome: page.isHome, startingPrice, priceText: typeof catalog.shop_open?.heroPriceText === 'string' ? catalog.shop_open.heroPriceText.trim().slice(0, 40) : '', storeName: catalog.store_name, storeLogo: catalog.store_logo });
    const target = join(root, page.path === '/' ? 'index.html' : `${page.path.slice(1)}index.html`);
    await mkdir(resolve(target, '..'), { recursive: true });
    await writeFile(target, pageHtml(base, page));
  }
  const lastmod = new Date().toISOString().slice(0, 10);
  await writeFile(join(root, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.map(page => `  <url><loc>${ORIGIN}${page.path}</loc><lastmod>${lastmod}</lastmod></url>`).join('\n')}\n</urlset>\n`);
  console.log(`Catálogo HTML generado: ${pages.length} páginas públicas.`);
  return pages.map(page => page.path);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await prerenderStorefront(process.argv[2] || 'dist');
