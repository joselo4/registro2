// Bump when the photos in /customizer change: they are cached as immutable.
export const customizerAsset = name => `/customizer/${name}.webp?v=2`;
export const money = value => `S/ ${Math.max(0, Number(value) || 0).toFixed(2)}`;
export const available = item => item && item.active !== false;
export const cleanName = value => String(value || '').replace(/[\p{Extended_Pictographic}\uFE0F]/gu, '').trim();
// Appetizing, saturated tones for the photographed neutral scoop.
export function flavorColor(flavor) {
  const name = `${flavor?.id} ${flavor?.name}`.toLowerCase();
  if (/chocolate|cacao/.test(name) && !/menta/.test(name)) return '#5f2f1a';
  if (/lucuma|lúcuma/.test(name)) return '#e0a14e';
  if (/manjar|dulce de leche|caramel/.test(name)) return '#d99a5b';
  if (/fresa|frutilla/.test(name)) return '#f28ea0';
  if (/menta/.test(name)) return '#8fd6b4';
  if (/maracu/.test(name)) return '#f5c542';
  if (/mango/.test(name)) return '#f7a93b';
  if (/coco/.test(name)) return '#f7f1e6';
  if (/vainilla/.test(name)) return '#f6e3b0';
  return /^#[\da-f]{6}$/i.test(flavor?.color) ? flavor.color : '#e6c8a4';
}
// SVG feFuncR/G/B tables: deep shadows and creamy highlights keep the
// scoop's texture instead of the flat look of a plain multiply.
export function flavorTone(flavor) {
  const rgb = flavorColor(flavor).slice(1).match(/.{2}/g).map(v => parseInt(v, 16) / 255);
  const lightness = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
  return rgb.map(c => [c * .25, c * .52, c * .78, c * .97, Math.min(1, c + (1 - c) * (.12 + .36 * lightness))].map(v => v.toFixed(3)).join(' '));
}
export function baseVisual(base) {
  const name = `${base?.id} ${base?.name}`.toLowerCase();
  if (/vaso|eco/.test(name)) return { key: 'cup-eco', crop: '280 600 695 610', x: 66, y: 248, w: 188, h: 156, lip: 291, shift: 32 };
  if (/waffle|copa/.test(name)) return { key: 'waffle-bowl', crop: '40 495 1180 710', x: 48, y: 245, w: 224, h: 135, lip: 302, shift: 35 };
  if (/artesan/.test(name)) return { key: 'cone-artisan', crop: '380 55 495 1110', x: 105, y: 230, w: 110, h: 215, lip: 263, shift: 0 };
  return { key: 'cone-classic', crop: '405 235 450 900', x: 105, y: 230, w: 110, h: 215, lip: 254, shift: 0 };
}
// Centers share the real opening coordinates of the photographed containers.
export function scoopLayout(count, container = 0) {
  const key = typeof container === 'object' ? container.key : container === 35 ? 'waffle-bowl' : container === 32 ? 'cup-eco' : 'cone-classic';
  const wide = key === 'waffle-bowl' || key === 'cup-eco';
  // Wide vessels use a broad nest, with the lower scoops seated behind the rim.
  const layouts = wide
    ? [[], [[160,278,66]], [[123,279,51],[196,279,51]], [[122,282,49],[197,282,49],[160,223,50]], [[119,283,45],[197,283,45],[130,230,46],[188,230,46]], [[105,284,43],[160,287,43],[213,284,43],[133,230,48],[190,230,48]]]
    : [[], [[160,219,51]], [[156,224,46],[166,166,45]], [[138,226,43],[181,226,43],[158,170,45]], [[138,226,41],[181,226,41],[137,173,41],[183,173,41]], [[139,227,40],[180,227,40],[138,176,40],[182,176,40],[160,127,42]]];
  const isCup = key === 'cup-eco';
  return (layouts[Math.min(5, Math.max(0, count))] || []).map(([x,y,r]) => ({x:isCup ? 160+(x-160)*.83 : x,y:isCup ? y-8 : key === 'cone-artisan' ? y+9 : y,r:isCup ? r*.92 : r}));
}
export function toppingCell(topping) {
  const name = `${topping?.id} ${topping?.name}`.toLowerCase();
  if (/chispa|sprinkle/.test(name)) return 0;
  if (/oreo|galleta|choco/.test(name)) return 1;
  if (/man[ií]|nuez|crocante/.test(name)) return 2;
  if (/gomi/.test(name)) return 3;
  return null;
}
export function creationTotal(base, scoops = [], toppings = [], syrup) {
  return [base, ...scoops, ...toppings, syrup].reduce((total, item) => total + Math.max(0, Number(item?.price) || 0), 0);
}
// A quick helado from the menu ("+ Agregar", suggestions) uses the cheapest
// active base and the same price the order API recomputes from the catalog.
export function quickScoopItem(flavors, bases = []) {
  const scoops = (Array.isArray(flavors) ? flavors : [flavors]).filter(Boolean).slice(0, 5)
    .map(flavor => ({ id: flavor.id, name: flavor.name, price: flavor.price, color: flavor.color }));
  const base = (Array.isArray(bases) ? bases : []).filter(available)
    .reduce((best, candidate) => !best || (Number(candidate.price) || 0) < (Number(best.price) || 0) ? candidate : best, null)
    || { id: 'cono', name: 'Cono de Galleta Crujiente', price: 0 };
  const price = Math.round(creationTotal(base, scoops) * 100) / 100;
  const names = scoops.map(scoop => scoop.name);
  return {
    type: 'custom',
    base: { id: base.id, name: base.name, price: Number(base.price) || 0 },
    scoops,
    toppings: [],
    price,
    quantity: 1,
    name: names.length > 1 ? `Helado doble de ${names.join(' y ')}` : `Helado de ${names[0] || 'la casa'}`,
  };
}
export function resolveRecommendation(rec, bases, flavors, toppings) {
  const base = bases.find(b => b.id === rec.baseId && available(b));
  const scoops = (rec.flavorIds || []).map(id => flavors.find(f => f.id === id && available(f)));
  const extras = (rec.toppingIds || []).map(id => toppings.find(t => t.id === id && available(t) && t.category === 'solido'));
  const syrupId = rec.syrupId === 'fresa' ? 'fresa_sauce' : rec.syrupId;
  const syrup = syrupId ? toppings.find(t => (t.id === syrupId || t.id === rec.syrupId) && available(t) && t.category === 'liquido') : null;
  if (!base || !scoops.length || scoops.length > 5 || scoops.some(s => !s) || extras.some(t => !t) || (syrupId && !syrup)) return null;
  return {base, scoops, toppings: extras, syrup, price: creationTotal(base, scoops, extras, syrup)};
}
