// Vector toppings and sauces drawn on top of the ice cream, so every choice
// looks different even when several are combined.
import { syrupColor, toppingKind } from '../utils/toppingKinds';

const SPRINKLES = ['#ff4d6d', '#ffb703', '#2ec4b6', '#4361ee', '#f72585', '#80ed99', '#ffffff'];
const GUMMIES = ['#e8364b', '#3cb54a', '#ff9f1c', '#ffd23f', '#9b5de5'];

const hashText = text => [...String(text || '')].reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) | 0, 7);

// Small deterministic random generator: same drawing on every render.
function random(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value + 0x6d2b79f5) >>> 0;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pointsIn({ cx, cy, rx, ry, count, rand }) {
  return Array.from({ length: count }, () => {
    const angle = rand() * Math.PI * 2;
    const distance = Math.sqrt(rand());
    return { x: cx + Math.cos(angle) * rx * distance, y: cy + Math.sin(angle) * ry * distance, turn: rand() * 180 - 90, pick: rand() };
  });
}

/** Scatters one topping over an elliptical area; `unit` sets the piece size. */
export function ToppingScatter({ topping, cx, cy, rx, ry, unit, seed = 1, density = 1 }) {
  const amount = base => Math.max(2, Math.round(base * density));
  const kind = toppingKind(topping);
  const rand = random(hashText(topping?.id || topping?.name) ^ (seed * 2654435761));
  if (kind === 'sprinkles') {
    return <g aria-hidden="true">{pointsIn({ cx, cy, rx, ry, count: amount(14), rand }).map((p, i) => (
      <rect key={i} x={p.x - unit * .55} y={p.y - unit * .16} width={unit * 1.1} height={unit * .32} rx={unit * .16} fill={SPRINKLES[Math.floor(p.pick * SPRINKLES.length)]} transform={`rotate(${p.turn} ${p.x} ${p.y})`} />
    ))}</g>;
  }
  if (kind === 'cookie') {
    return <g aria-hidden="true">{pointsIn({ cx, cy, rx, ry, count: amount(8), rand }).map((p, i) => {
      const size = unit * (.55 + p.pick * .5);
      const corners = Array.from({ length: 5 }, (_, k) => {
        const angle = (k / 5) * Math.PI * 2 + p.turn / 60;
        const reach = size * (.7 + ((i + k) % 3) * .18);
        return `${(p.x + Math.cos(angle) * reach).toFixed(1)},${(p.y + Math.sin(angle) * reach).toFixed(1)}`;
      }).join(' ');
      return <g key={i}><polygon points={corners} fill="#241512" />{i % 3 === 0 && <circle cx={p.x + size * .2} cy={p.y - size * .1} r={size * .28} fill="#f3ece2" />}</g>;
    })}</g>;
  }
  if (kind === 'peanut') {
    return <g aria-hidden="true">{pointsIn({ cx, cy, rx, ry, count: amount(8), rand }).map((p, i) => (
      <g key={i} transform={`rotate(${p.turn} ${p.x} ${p.y})`}>
        <ellipse cx={p.x} cy={p.y} rx={unit * .62} ry={unit * .4} fill="#c98a4a" stroke="#8a5a2b" strokeWidth={unit * .08} />
        <ellipse cx={p.x - unit * .15} cy={p.y - unit * .1} rx={unit * .22} ry={unit * .1} fill="#f0c98f" opacity=".8" />
      </g>
    ))}</g>;
  }
  if (kind === 'gummy') {
    return <g aria-hidden="true">{pointsIn({ cx, cy, rx, ry, count: amount(4), rand }).map((p, i) => {
      const color = GUMMIES[(Math.floor(p.pick * GUMMIES.length) + i) % GUMMIES.length];
      const s = unit * .9;
      return <g key={i} transform={`rotate(${p.turn / 3} ${p.x} ${p.y})`} opacity=".95">
        <ellipse cx={p.x} cy={p.y + s * .35} rx={s * .55} ry={s * .65} fill={color} />
        <circle cx={p.x} cy={p.y - s * .45} r={s * .42} fill={color} />
        <circle cx={p.x - s * .32} cy={p.y - s * .8} r={s * .16} fill={color} />
        <circle cx={p.x + s * .32} cy={p.y - s * .8} r={s * .16} fill={color} />
        <ellipse cx={p.x - s * .18} cy={p.y + s * .1} rx={s * .12} ry={s * .25} fill="#fff" opacity=".35" />
      </g>;
    })}</g>;
  }
  if (kind === 'candy') {
    return <g aria-hidden="true">{pointsIn({ cx, cy, rx, ry, count: amount(9), rand }).map((p, i) => (
      <g key={i}>
        <ellipse cx={p.x} cy={p.y} rx={unit * .5} ry={unit * .38} fill={SPRINKLES[Math.floor(p.pick * (SPRINKLES.length - 1))]} />
        <ellipse cx={p.x - unit * .14} cy={p.y - unit * .12} rx={unit * .16} ry={unit * .08} fill="#fff" opacity=".6" />
      </g>
    ))}</g>;
  }
  if (topping?.image) {
    return <image href={topping.image} x={cx - rx * .6} y={cy - ry} width={rx * 1.2} height={ry * 2} preserveAspectRatio="xMidYMid meet" />;
  }
  const color = `hsl(${Math.abs(hashText(topping?.name)) % 360} 70% 55%)`;
  return <g aria-hidden="true">{pointsIn({ cx, cy, rx, ry, count: amount(10), rand }).map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={unit * .3} fill={color} />)}</g>;
}

/** A glossy drizzle across `width`, with a couple of drips. */
export function SauceDrizzle({ syrup, cx, cy, width, stroke }) {
  const color = syrupColor(syrup);
  const wave = (y, span, lift) => {
    const left = cx - span / 2;
    const step = span / 5;
    return `M ${left} ${y} q ${step / 2} ${-lift} ${step} 0 t ${step} 0 t ${step} 0 t ${step} 0 t ${step} 0`;
  };
  const upper = wave(cy, width * .8, stroke * .9);
  const lower = wave(cy + stroke * 2.4, width, stroke * .9);
  const drips = [cx - width * .36, cx - width * .05, cx + width * .3];
  return (
    <g aria-hidden="true">
      <path d={upper} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" />
      <path d={lower} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" />
      {drips.map((x, i) => (
        <path key={i} d={`M ${x} ${cy + stroke * 2.4} v ${stroke * (1.8 + i * .6)}`} stroke={color} strokeWidth={stroke * .85} strokeLinecap="round" />
      ))}
      <path d={upper} fill="none" stroke="#fff" strokeOpacity=".35" strokeWidth={stroke * .28} strokeLinecap="round" transform={`translate(0 ${-stroke * .22})`} />
    </g>
  );
}
