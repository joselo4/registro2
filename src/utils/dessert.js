export const money = value => `S/ ${Math.max(0, Number(value) || 0).toFixed(2)}`;
export const available = item => item && item.active !== false;
export const cleanName = value => String(value || '').replace(/[\p{Extended_Pictographic}\uFE0F]/gu, '').trim();
export function flavorColor(flavor) {
  const name = `${flavor?.id} ${flavor?.name}`.toLowerCase();
  if (/chocolate|cacao/.test(name) && !/menta/.test(name)) return '#80503b';
  if (/lucuma|lúcuma/.test(name)) return '#d8a053';
  if (/fresa/.test(name)) return '#e7a0a5';
  if (/menta/.test(name)) return '#afd1b6';
  if (/maracu/.test(name)) return '#edcb72';
  if (/mango/.test(name)) return '#efb765';
  if (/coco/.test(name)) return '#f2eee5';
  if (/vainilla/.test(name)) return '#efdfb6';
  return /^#[\da-f]{6}$/i.test(flavor?.color) ? flavor.color : '#e6c8a4';
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
export function resolveRecommendation(rec, bases, flavors, toppings) {
  const base = bases.find(b => b.id === rec.baseId && available(b));
  const scoops = (rec.flavorIds || []).map(id => flavors.find(f => f.id === id && available(f)));
  const extras = (rec.toppingIds || []).map(id => toppings.find(t => t.id === id && available(t) && t.category === 'solido'));
  const syrupId = rec.syrupId === 'fresa' ? 'fresa_sauce' : rec.syrupId;
  const syrup = syrupId ? toppings.find(t => (t.id === syrupId || t.id === rec.syrupId) && available(t) && t.category === 'liquido') : null;
  if (!base || !scoops.length || scoops.length > 5 || scoops.some(s => !s) || extras.some(t => !t) || (syrupId && !syrup)) return null;
  return {base, scoops, toppings: extras, syrup, price: creationTotal(base, scoops, extras, syrup)};
}
