// The store ships WebP copies of its own product photos (about a ninth of the PNG
// size). Saved catalog data may still point at the PNG; use the WebP copy instead.
const OWN_WEBP_FOLDERS = /^\/(?:paletas|customizer)\/[^?#]+\.png(?=$|[?#])/i;

export function preferWebp(src) {
  if (typeof src !== 'string' || !OWN_WEBP_FOLDERS.test(src)) return src;
  return src.replace(/\.png(?=$|[?#])/i, '.webp');
}
