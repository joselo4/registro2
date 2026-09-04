import { useId } from 'react';
import { baseVisual, flavorColor, scoopLayout, toppingCell } from '../utils/dessert';

export function ToppingPhoto({ topping, className = '' }) {
  const cell = toppingCell(topping);
  if (topping.image) return <img className={`topping-photo ${className}`} src={topping.image} alt="" />;
  if (cell === null) return <span className="topping-word">{topping.name?.slice(0, 1)}</span>;
  return <svg className={`topping-photo ${className}`} viewBox={`${cell * 510} 125 510 510`} aria-hidden="true"><image href="/customizer/toppings-artisan.png" width="2039" height="771" /></svg>;
}
export function ScoopPhoto({ flavor, className = '' }) {
  return <span className={`scoop-photo ${className}`} style={{'--flavor-color': flavorColor(flavor)}}><img src="/customizer/gelato-scoop-neutral.png" alt="" /><span aria-hidden="true" /></span>;
}
export default function DessertPreview({base, scoops = [], toppings = [], syrup = null, compact = false}) {
  const uid = useId().replace(/:/g, '');
  const b = baseVisual(base);
  const coords = scoopLayout(scoops.length, b.shift);
  const sauceColor = /fresa|sauce/.test(`${syrup?.id}`) ? '#a6373d' : /manjar|caramel/.test(`${syrup?.id}`) ? '#b47940' : '#45251c';
  const container = <svg x={b.x} y={b.y} width={b.w} height={b.h} viewBox={b.crop} preserveAspectRatio="none"><image href={`/customizer/${b.key}.png`} width="1280" height="1280" /></svg>;
  return <svg className={`dessert-preview ${compact ? 'compact' : ''}`} viewBox={compact ? '68 135 184 320' : '0 0 320 470'} role="img" aria-label={`${scoops.map(s => s.name || 'Helado').join(', ') || 'Envase vacío'} en ${base?.name || 'cono'}${toppings.length ? `. Extras: ${toppings.map(t => t.name || 'Topping').join(', ')}` : ''}${syrup ? `. ${syrup.name || 'Salsa'}` : ''}`}>
    <defs>
      <filter id={`${uid}-shadow`} x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="4" stdDeviation="3" floodColor="#4f2f20" floodOpacity=".19" /></filter>
      <clipPath id={`${uid}-lip`}><rect x="0" y={b.lip} width="320" height="220" /></clipPath>
      {scoops.map((scoop, i) => {
        const rgb = flavorColor(scoop).slice(1).match(/.{2}/g).map(v => parseInt(v, 16) / 255);
        return <filter key={i} id={`${uid}-flavor-${i}`} colorInterpolationFilters="sRGB"><feColorMatrix type="saturate" values="0" /><feComponentTransfer><feFuncR type="linear" slope={rgb[0]} /><feFuncG type="linear" slope={rgb[1]} /><feFuncB type="linear" slope={rgb[2]} /></feComponentTransfer></filter>;
      })}
    </defs>
    <g filter={`url(#${uid}-shadow)`}>{container}</g>
    {scoops.map((scoop, i) => {
      const c = coords[i];
      // Extras belong to their scoop and are occluded by the next scoop.
      const extras = toppings.filter((_, ti) => ti % scoops.length === (scoops.length - 1 - i));
      const size = c.r * 2.4;
      return <g key={`${scoop.id}-${i}`}>
        <image x={c.x-size/2} y={c.y-size/2} width={size} height={size} href="/customizer/gelato-scoop-neutral.png" filter={`url(#${uid}-flavor-${i})`} />
        {syrup && <svg x={c.x-c.r*.75} y={c.y-c.r*.7} width={c.r*1.5} height={c.r*1.1} viewBox="0 0 100 75" aria-hidden="true"><path d="M 10 16 Q 48 0 87 17 Q 75 24 27 30 Q 4 35 30 43 Q 52 49 78 50 Q 92 57 68 62" fill="none" stroke={sauceColor} strokeWidth="5" strokeLinecap="round" /><path d="M 12 15 Q 47 2 85 17" fill="none" stroke="#fff6df" strokeOpacity=".28" strokeWidth="1.1" /></svg>}
        {extras.map((topping, ti) => {
          const cell = toppingCell(topping);
          if (cell === null && !topping.image) return null;
          const width = c.r * (extras.length > 1 ? .95 : 1.4);
          const x = c.x-width/2 + (extras.length > 1 ? (ti%2 ? 1 : -1)*c.r*.26 : 0);
          const y = c.y-c.r*.75 + Math.floor(ti/2)*c.r*.28;
          return topping.image ? <image key={topping.id} href={topping.image} x={x} y={y} width={width} height={width*.72} /> : <svg key={topping.id} x={x} y={y} width={width} height={width*.78} viewBox={`${cell*510} 125 510 510`} preserveAspectRatio="none"><image href="/customizer/toppings-artisan.png" width="2039" height="771" /></svg>;
        })}
      </g>;
    })}
    <g clipPath={`url(#${uid}-lip)`}>{container}</g>
  </svg>;
}
