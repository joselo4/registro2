import { useState, useRef, useEffect } from 'react';
import DessertPreview, { BasePhoto, ScoopPhoto, ToppingPhoto } from './DessertPreview';
import { available, cleanName, creationTotal, money, resolveRecommendation } from '../utils/dessert';
import './customizer.css';

const MAX_SCOOPS = 5;
const steps = [
  { label: 'Envase', title: 'Elige tu envase', hint: 'Crujiente, práctico o para compartir a cucharadas.' },
  { label: 'Sabores', title: '¿Qué sabores te provocan?', hint: `Toca un sabor para sumarlo. Hasta ${MAX_SCOOPS} bolas.` },
  { label: 'Toppings', title: 'El toque final', hint: 'Opcional: algo crujiente y una salsa.' },
];
const syrupColor = syrup => /fresa|sauce/.test(`${syrup?.id} ${syrup?.name}`.toLowerCase()) ? '#c23a4c' : /manjar|caramel/.test(`${syrup?.id} ${syrup?.name}`.toLowerCase()) ? '#c98a45' : '#4a2517';
const isFruity = flavor => /fresa|mango|maracu|lim[oó]n|frut|coco|pi[ñn]a|aguaymanto/.test(`${flavor.name} ${flavor.id}`.toLowerCase());

export default function IceCreamCustomizer({bases = [], flavors = [], toppings = [], recommendations = [], onAddToCart, setView, showAlert, shopConfig}) {
  const defaults = shopConfig?.defaultCustomizer || {};
  const activeBases = bases.filter(available);
  const activeFlavors = flavors.filter(available);
  const activeToppings = toppings.filter(t => available(t) && t.category === 'solido');
  const activeSyrups = toppings.filter(t => available(t) && t.category === 'liquido');
  const [baseId, setBaseId] = useState(() => activeBases.find(b => b.id === defaults.baseId)?.id || activeBases[0]?.id);
  const [scoopIds, setScoopIds] = useState(() => { const f = activeFlavors.find(f => f.id === defaults.flavorId) || activeFlavors.find(f => f.id === 'lucuma') || activeFlavors[0]; return f ? [f.id] : []; });
  const [toppingIds, setToppingIds] = useState(() => activeToppings.some(t => t.id === defaults.toppingId) ? [defaults.toppingId] : []);
  const [syrupId, setSyrupId] = useState(() => activeSyrups.find(t => t.id === defaults.syrupId)?.id || null);
  const [step, setStep] = useState(0);
  const [query, setQuery] = useState('');
  const [family, setFamily] = useState('Todos');
  const [notice, setNotice] = useState('');
  const [adding, setAdding] = useState(false);
  const [pulse, setPulse] = useState(0);
  const addingRef = useRef(false);
  const panelRef = useRef(null);
  const advanceTimer = useRef(null);
  useEffect(() => () => window.clearTimeout(advanceTimer.current), []);

  const base = activeBases.find(b => b.id === baseId) || activeBases[0];
  const scoops = scoopIds.map(id => activeFlavors.find(f => f.id === id)).filter(Boolean);
  const extras = toppingIds.map(id => activeToppings.find(t => t.id === id)).filter(Boolean);
  const syrup = activeSyrups.find(t => t.id === syrupId) || null;
  const total = creationTotal(base, scoops, extras, syrup);
  const validPresets = recommendations.map(rec => ({...rec, resolved: resolveRecommendation(rec, bases, flavors, toppings)})).filter(rec => rec.resolved);
  const search = query.trim().toLocaleLowerCase('es');
  const visibleFlavors = activeFlavors.filter(f => f.name.toLocaleLowerCase('es').includes(search) && (family === 'Todos' || (family === 'Frutales' ? isFruity(f) : !isFruity(f))));
  const cheapestScoop = activeFlavors.reduce((min, f) => Math.min(min, Number(f.price) || 0), Infinity);
  const summary = [base?.name, scoops.length ? `${scoops.length} bola${scoops.length === 1 ? '' : 's'}` : null, extras.length + (syrup ? 1 : 0) ? `${extras.length + (syrup ? 1 : 0)} extra${extras.length + (syrup ? 1 : 0) === 1 ? '' : 's'}` : null].filter(Boolean).join(' · ');

  const changed = message => { setNotice(message); setPulse(value => value + 1); };
  const goToStep = next => {
    window.clearTimeout(advanceTimer.current);
    setStep(next);
    // Keep the new step in view on phones, below the sticky preview.
    window.requestAnimationFrame(() => panelRef.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' }));
  };
  function chooseBase(nextBase) {
    setBaseId(nextBase.id);
    changed(`${nextBase.name} elegido.`);
    if (step === 0) advanceTimer.current = window.setTimeout(() => goToStep(1), 450);
  }
  function addScoop(flavor) {
    if (scoops.length >= MAX_SCOOPS) { setNotice(`Tu helado ya tiene ${MAX_SCOOPS} bolas. Quita una para probar otro sabor.`); return; }
    setScoopIds([...scoops.map(s => s.id), flavor.id]);
    changed(scoops.length === 0 ? `${flavor.name} añadido. ¡Suma otro sabor para combinar!` : `${flavor.name} añadido a tu helado.`);
  }
  function removeScoop(index) {
    if (index < 0) return;
    setScoopIds(scoops.filter((_, i) => i !== index).map(s => s.id));
    changed('Bola retirada. Hay espacio para otro sabor.');
  }
  function toggleTopping(topping) {
    const selected = toppingIds.includes(topping.id);
    setToppingIds(selected ? toppingIds.filter(id => id !== topping.id) : [...toppingIds, topping.id]);
    changed(selected ? `${topping.name} retirado.` : `${topping.name} añadido.`);
  }
  function applyPreset(rec) {
    const result = resolveRecommendation(rec, bases, flavors, toppings);
    if (!result) { setNotice('Esta combinación ya no está disponible. Elige otra.'); return; }
    setBaseId(result.base.id); setScoopIds(result.scoops.map(s => s.id)); setToppingIds(result.toppings.map(t => t.id)); setSyrupId(result.syrup?.id || null);
    changed(`Elegiste ${cleanName(rec.name)}. Añádelo o dale tu toque.`);
    goToStep(1);
  }
  async function addToCart() {
    if (addingRef.current) return;
    if (!base || !scoops.length) { setNotice('Elige un envase y al menos un sabor para continuar.'); goToStep(base ? 1 : 0); return; }
    addingRef.current = true; setAdding(true);
    try {
      const result = await onAddToCart({type:'custom', base, scoops, toppings:extras, syrup, price:total, quantity:1, name:`Helado en ${base.name} · ${scoops.length} bola${scoops.length === 1 ? '' : 's'}`});
      if (result === false) { addingRef.current = false; setAdding(false); return; }
      setView('cart');
    } catch { addingRef.current = false; setAdding(false); if (showAlert) showAlert('No se pudo añadir', 'Intenta de nuevo. Tu combinación sigue aquí.', 'error'); else setNotice('No se pudo añadir. Intenta de nuevo.'); }
  }
  const tip = scoops.length === 1 && step === 1 && Number.isFinite(cheapestScoop)
    ? `Tip: con 2 bolas se disfruta más. Suma otra desde ${money(cheapestScoop)}.`
    : '';

  return <section className="atelier" aria-label="Crea tu helado">
    <header className="atelier-heading">
      <button type="button" className="atelier-back" onClick={() => setView('shop')}>← Carta</button>
      <div><span className="atelier-eyebrow">CREA TU HELADO</span><h1>Un helado muy <em>tuyo.</em></h1></div>
    </header>

    {validPresets.length > 0 && <div className="atelier-quickstart">
      <p><strong>¿Sin ideas?</strong> Empieza con un favorito</p>
      <div className="atelier-preset-row">{validPresets.map(rec => <button type="button" key={rec.id} onClick={() => applyPreset(rec)}>
        <span className="atelier-preset-art" aria-hidden="true"><DessertPreview compact base={rec.resolved.base} scoops={rec.resolved.scoops} toppings={rec.resolved.toppings} syrup={rec.resolved.syrup} /></span>
        <span className="atelier-preset-copy"><strong>{cleanName(rec.name)}</strong><small>{rec.resolved.scoops.map(s => s.name).join(' + ')}</small><b>{money(rec.resolved.price)}</b></span>
      </button>)}</div>
    </div>}

    <div className="atelier-layout">
      <aside className="atelier-stage" aria-label="Tu helado">
        <div key={pulse} className={`atelier-stage-art ${pulse ? 'is-changing' : ''}`}><DessertPreview base={base} scoops={scoops} toppings={extras} syrup={syrup} /></div>
        <div className="atelier-stage-meta">
          <span className="atelier-stage-count">{scoops.length}/{MAX_SCOOPS} bolas</span>
          <strong>{base?.name || 'Elige tu envase'}</strong>
          <ul className="atelier-scoop-chips" aria-label="Sabores elegidos">
            {scoops.map((s, i) => <li key={`${s.id}-${i}`}><span>{s.name}</span><button type="button" aria-label={`Quitar bola ${i + 1} de ${s.name}`} onClick={() => removeScoop(i)}>×</button></li>)}
            {extras.map(t => <li key={t.id} className="is-extra"><span>{t.name}</span><button type="button" aria-label={`Quitar ${t.name}`} onClick={() => toggleTopping(t)}>×</button></li>)}
            {syrup && <li className="is-extra"><span>{syrup.name}</span><button type="button" aria-label={`Quitar ${syrup.name}`} onClick={() => { setSyrupId(null); changed('Salsa retirada.'); }}>×</button></li>}
          </ul>
          {!scoops.length && <small>Tu primera bola te espera.</small>}
        </div>
      </aside>

      <div className="atelier-controls" ref={panelRef}>
        <div className="atelier-steps" role="tablist" aria-label="Pasos de tu creación">{steps.map((item, i) => {
          const done = i === 0 ? Boolean(base) : i === 1 ? scoops.length > 0 : extras.length > 0 || Boolean(syrup);
          return <button type="button" key={item.label} role="tab" id={`atelier-tab-${i}`} aria-selected={step === i} aria-controls="atelier-step-panel" tabIndex={step === i ? 0 : -1}
            onKeyDown={e => { if (['ArrowLeft','ArrowRight'].includes(e.key)) { e.preventDefault(); const next = (i + (e.key === 'ArrowRight' ? 1 : 2)) % 3; goToStep(next); document.getElementById(`atelier-tab-${next}`)?.focus(); } }}
            onClick={() => goToStep(i)} className={`${step === i ? 'selected' : ''} ${done && step !== i ? 'done' : ''}`}>
            <span aria-hidden="true">{done && step !== i ? '✓' : i + 1}</span>{item.label}
          </button>;
        })}</div>

        <div id="atelier-step-panel" role="tabpanel" aria-labelledby={`atelier-tab-${step}`} className="atelier-panel">
          <div className="atelier-panel-heading"><h2>{steps[step].title}</h2><p>{steps[step].hint}</p></div>

          {step === 0 && <div className="atelier-bases">{activeBases.map(b => <button type="button" key={b.id} className={`atelier-base ${base?.id === b.id ? 'selected' : ''}`} aria-pressed={base?.id === b.id} onClick={() => chooseBase(b)}>
            <span className="atelier-choice-check" aria-hidden="true">{base?.id === b.id ? '✓' : ''}</span>
            <BasePhoto base={b} />
            <strong>{b.name}</strong>
            <span className="atelier-price-tag">{Number(b.price) > 0 ? `+ ${money(b.price)}` : 'Incluido'}</span>
          </button>)}{!activeBases.length && <p>No hay envases disponibles por el momento.</p>}</div>}

          {step === 1 && <>
            <div className="atelier-flavor-tools">
              <div className="atelier-families">{['Todos','Cremosos','Frutales'].map(label => <button type="button" key={label} aria-pressed={family === label} className={family === label ? 'selected' : ''} onClick={() => setFamily(label)}>{label}</button>)}</div>
              <input type="search" aria-label="Buscar sabores" placeholder="Buscar sabor…" value={query} onChange={e => setQuery(e.target.value)} />
            </div>
            <div className="atelier-flavors">{visibleFlavors.map(flavor => {
              const quantity = scoops.filter(s => s.id === flavor.id).length;
              const full = scoops.length >= MAX_SCOOPS;
              return <article className={`atelier-flavor ${quantity ? 'selected' : ''}`} key={flavor.id}>
                <button type="button" className="atelier-flavor-add" disabled={full} onClick={() => addScoop(flavor)} aria-label={`Añadir una bola de ${flavor.name}, ${money(flavor.price)}`}>
                  <span className="atelier-flavor-photo"><ScoopPhoto flavor={flavor} />{flavor.isPremium && <span className="atelier-flavor-badge">ESPECIAL</span>}</span>
                  <strong>{flavor.name}</strong>
                  <span className="atelier-unit-price">{money(flavor.price)}</span>
                  {!quantity && <span className="atelier-flavor-plus" aria-hidden="true">+</span>}
                </button>
                {quantity > 0 && <div className="atelier-quantity">
                  <button type="button" aria-label={`Quitar una bola de ${flavor.name}`} onClick={() => removeScoop(scoops.map(s => s.id).lastIndexOf(flavor.id))}>−</button>
                  <output aria-label={`Bolas de ${flavor.name}`}>{quantity}</output>
                  <button type="button" disabled={full} aria-label={`Añadir otra bola de ${flavor.name}`} onClick={() => addScoop(flavor)}>+</button>
                </div>}
              </article>;
            })}</div>
            {!visibleFlavors.length && <p className="atelier-empty-small">No encontramos ese sabor. Prueba otra búsqueda.</p>}
          </>}

          {step === 2 && <>
            {activeToppings.length > 0 && <><h3 className="atelier-extras-heading">Toppings <span>puedes combinar</span></h3>
            <div className="atelier-toppings">{activeToppings.map(t => { const selected = toppingIds.includes(t.id); return <button type="button" key={t.id} className={`atelier-topping ${selected ? 'selected' : ''}`} aria-pressed={selected} onClick={() => toggleTopping(t)}><ToppingPhoto topping={t}/><strong>{t.name}</strong><span>+ {money(t.price)}</span><b aria-hidden="true">{selected ? '✓' : '+'}</b></button>; })}</div></>}
            {activeSyrups.length > 0 && <><h3 className="atelier-extras-heading">Salsa <span>elige una</span></h3>
            <div className="atelier-syrups"><button type="button" className={!syrup ? 'selected' : ''} aria-pressed={!syrup} onClick={() => { setSyrupId(null); changed('Sin salsa.'); }}><i className="atelier-syrup-swatch is-none" aria-hidden="true" /><strong>Sin salsa</strong></button>{activeSyrups.map(t => <button type="button" key={t.id} className={syrup?.id === t.id ? 'selected' : ''} aria-pressed={syrup?.id === t.id} onClick={() => { setSyrupId(t.id); changed(`${t.name} añadida.`); }}><i className="atelier-syrup-swatch" style={{ '--syrup': syrupColor(t) }} aria-hidden="true" /><strong>{t.name}</strong><span>+ {money(t.price)}</span></button>)}</div></>}
            <p className="atelier-allergen-note">¿Tienes alguna alergia? Consulta los ingredientes con la tienda antes de pedir.</p>
          </>}

          <p className="atelier-live" role="status" aria-live="polite">{notice || tip || `${scoops.length} de ${MAX_SCOOPS} bolas elegidas.`}{notice && tip ? ` ${tip}` : ''}</p>
          {step < 2 && <button type="button" className="atelier-next" onClick={() => goToStep(step + 1)}>Siguiente: {steps[step + 1].label.toLowerCase()} →</button>}
        </div>
      </div>
    </div>

    <div className="atelier-cartbar">
      <div className="atelier-cartbar-copy"><small>{summary || 'Tu creación'}</small><strong>{money(total)}</strong></div>
      <button type="button" disabled={!base || !scoops.length || adding} onClick={addToCart}>{adding ? 'Añadiendo…' : 'Añadir al pedido'} <span aria-hidden="true">→</span></button>
    </div>
  </section>;
}
