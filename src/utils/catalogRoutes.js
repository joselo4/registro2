export const catalogSlug = value => String(value ?? '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export const productPath = (kind, item) => `/producto/${catalogSlug(kind)}-${catalogSlug(item.id)}`;

export const categoryForPath = path => ({
  '/helados': 'classic',
  '/paletas': 'popsicles',
  '/promociones': 'packs',
}[String(path || '').replace(/\/$/, '')] || 'all');
