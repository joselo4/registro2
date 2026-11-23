import DessertPreview from './DessertPreview';

// Packs and litres without their own photo are shown with the shop's photographed
// cones, waffle cups and eco cup (no drawn cartoon). The picture follows what the
// pack text says it contains, so a 12-cone pack never looks like a 3-cone one.
const TONES = [
  { id: 'fresa', name: 'Fresa', color: '#ff6b81' },
  { id: 'chocolate', name: 'Chocolate', color: '#6b3a24' },
  { id: 'mango', name: 'Mango', color: '#ffbe76' },
  { id: 'vainilla', name: 'Vainilla', color: '#f7d794' },
  { id: 'menta', name: 'Menta', color: '#9aecdb' },
  { id: 'lucuma', name: 'Lúcuma', color: '#e58e26' },
];
const tone = index => TONES[index % TONES.length];
const CONE = { id: 'cono', name: 'Cono' };
const COPA = { id: 'copa', name: 'Copa Waffle' };

function packContents(pack) {
  const text = `${pack?.name || ''} ${pack?.items || ''} ${pack?.description || ''}`.toLowerCase();
  const copas = text.match(/(\d+)\s*copas?\b/);
  if (copas || /copa|waffle/.test(text)) {
    const scoops = text.match(/(\d+)\s*bolas/);
    return { kind: 'cups', count: Math.min(4, Math.max(1, Number(copas?.[1]) || 2)), scoops: Math.min(3, Math.max(1, Number(scoops?.[1]) || 2)) };
  }
  const cones = text.match(/(\d+)\s*(?:helados|barquillos|conos|bolas)/);
  return { kind: 'cones', count: Math.min(12, Math.max(1, Number(cones?.[1]) || 3)) };
}

function Piece({ base, scoops, index }) {
  return (
    <span className="pack-photo-item" style={{ '--i': index }}>
      <DessertPreview compact base={base} scoops={scoops} />
    </span>
  );
}

export default function PackPhoto({ pack }) {
  const contents = packContents(pack);
  const label = pack?.name || 'Pack de helados';
  if (contents.kind === 'cups') {
    return (
      <div className="pack-photo is-cups" role="img" aria-label={label}>
        {Array.from({ length: contents.count }, (_, i) => (
          <Piece key={i} index={i} base={COPA} scoops={Array.from({ length: contents.scoops }, (_, s) => tone(i * contents.scoops + s))} />
        ))}
      </div>
    );
  }
  if (contents.count <= 5) {
    return (
      <div className={`pack-photo is-cones count-${contents.count}`} role="img" aria-label={label}>
        {Array.from({ length: contents.count }, (_, i) => <Piece key={i} index={i} base={CONE} scoops={[tone(i)]} />)}
      </div>
    );
  }
  // Large packs: a back row and a front row of cones.
  const back = Math.ceil(contents.count / 2);
  const front = contents.count - back;
  return (
    <div className="pack-photo is-crowd" role="img" aria-label={label}>
      <div className="pack-photo-row is-back">{Array.from({ length: back }, (_, i) => <Piece key={i} index={i} base={CONE} scoops={[tone(i + 3)]} />)}</div>
      <div className="pack-photo-row is-front">{Array.from({ length: front }, (_, i) => <Piece key={i} index={i} base={CONE} scoops={[tone(i)]} />)}</div>
    </div>
  );
}

// A litre pot without its own photo: the photographed cup with three scoops.
export function LiterPhoto() {
  return (
    <div className="liter-photo" role="img" aria-label="Pote de helado de 1 litro">
      <DessertPreview compact base={{ id: 'vaso', name: 'Vaso' }} scoops={TONES.slice(0, 3)} />
    </div>
  );
}
