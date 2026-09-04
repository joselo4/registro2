import { useState, useRef } from 'react';
import DessertPreview, { ScoopPhoto, ToppingPhoto } from './DessertPreview';
import { available, baseVisual, cleanName, creationTotal, money, resolveRecommendation } from '../utils/dessert';
import './customizer.css';
const steps = ['El envase', 'Los sabores', 'El toque final'];

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
  const addingRef = useRef(false);
  const base = activeBases.find(b => b.id === baseId) || activeBases[0];
  const scoops = scoopIds.map(id => activeFlavors.find(f => f.id === id)).filter(Boolean);
  const extras = toppingIds.map(id => activeToppings.find(t => t.id === id)).filter(Boolean);
  const syrup = activeSyrups.find(t => t.id === syrupId) || null;
  const total = creationTotal(base, scoops, extras, syrup);
  const validPresets = recommendations.map(rec => ({...rec, resolved: resolveRecommendation(rec, bases, flavors, toppings)})).filter(rec => rec.resolved);
  const visibleFlavors = activeFlavors.filter(f => { const fruity = /fresa|mango|maracu|lim[oó]n|frut|coco/.test(`${f.name} ${f.id}`.toLowerCase()); return f.name.toLocaleLowerCase('es').includes(query.toLocaleLowerCase('es')) && (family === 'Todos' || (family === 'Frutales' ? fruity : !fruity)); });
  function addScoop(flavor) {
    if (scoops.length >= 5) { setNotice('Tu helado ya tiene 5 bolas. Quita una para probar otro sabor.'); return; }
    setScoopIds([...scoops.map(s => s.id), flavor.id]); setNotice(`${flavor.name} añadido a tu helado.`);
  }
  function removeScoop(index) { setScoopIds(scoops.filter((_, i) => i !== index).map(s => s.id)); setNotice('Bola retirada. Hay espacio para otro sabor.'); }
  function applyPreset(rec) {
    const result = resolveRecommendation(rec, bases, flavors, toppings);
    if (!result) { setNotice('Esta combinación ya no está disponible. Elige otra.'); return; }
    setBaseId(result.base.id); setScoopIds(result.scoops.map(s => s.id)); setToppingIds(result.toppings.map(t => t.id)); setSyrupId(result.syrup?.id || null); setStep(1); setNotice(`Elegiste ${cleanName(rec.name)}. Puedes darle tu toque.`);
  }
  async function addToCart() {
    if (addingRef.current) return;
    if (!base || !scoops.length) { setNotice('Elige un envase y al menos un sabor para continuar.'); setStep(base ? 1 : 0); return; }
    addingRef.current = true; setAdding(true);
    try {
      const result = await onAddToCart({type:'custom', base, scoops, toppings:extras, syrup, price:total, quantity:1, name:`Helado en ${base.name} · ${scoops.length} bola${scoops.length === 1 ? '' : 's'}`});
      if (result === false) { addingRef.current = false; setAdding(false); return; }
      setView('cart');
    } catch { addingRef.current = false; setAdding(false); if (showAlert) showAlert('No se pudo añadir', 'Intenta de nuevo. Tu combinación sigue aquí.', 'error'); else setNotice('No se pudo añadir. Intenta de nuevo.'); }
  }
  return <section className="atelier" aria-label="Crea tu helado">
    <button className="atelier-back" onClick={() => setView('shop')}>← Volver a la carta</button>
    <header className="atelier-heading"><div><span className="atelier-eyebrow">EL TALLER DE ANTOJOS</span><h1>Un helado muy <em>tuyo.</em></h1><p>Elige, mezcla y ponle ese algo que te encanta.</p></div><span className="atelier-note">Tu próximo favorito<br/><strong>está por nacer.</strong></span></header>
    <div className="atelier-layout">
      <aside className="atelier-preview-column">
        <div className="atelier-stage"><div className="atelier-stage-label"><span>HECHO A TU GUSTO</span><span>{scoops.length} / 5 bolas</span></div><DessertPreview base={base} scoops={scoops} toppings={extras} syrup={syrup} /><div className="atelier-stage-caption"><span>{base?.name || 'Elige tu envase'}</span><small>Vista orientativa de tu combinación</small></div></div>
        <div className="atelier-receipt"><div className="atelier-receipt-heading"><h2>Así va tu antojo</h2><button onClick={() => {setScoopIds([]); setToppingIds([]); setSyrupId(null); setStep(1); setNotice('Empieza una nueva mezcla.');}}>Empezar de nuevo</button></div>
          <dl><div><dt>{base?.name || 'Envase'}</dt><dd>{money(base?.price)}</dd></div>{scoops.map((s, i) => <div key={`${s.id}-${i}`}><dt><button aria-label={`Quitar bola ${i+1} de ${s.name}`} onClick={() => removeScoop(i)}>×</button>{s.name}</dt><dd>{money(s.price)}</dd></div>)}{extras.map(t => <div key={t.id}><dt>{t.name}</dt><dd>{money(t.price)}</dd></div>)}{syrup && <div><dt>{syrup.name}</dt><dd>{money(syrup.price)}</dd></div>}</dl>
          {!scoops.length && <p className="atelier-empty-small">Tu primera bola te espera.</p>}<div className="atelier-receipt-total"><span>Total de tu creación</span><strong>{money(total)}</strong></div>
        </div>
      </aside>
      <div className="atelier-controls">
        <div className="atelier-steps" role="tablist" aria-label="Pasos de tu creación">{steps.map((label, i) => <button key={label} role="tab" id={`atelier-tab-${i}`} aria-selected={step === i} aria-controls="atelier-step-panel" tabIndex={step === i ? 0 : -1} onKeyDown={e => {if (['ArrowLeft','ArrowRight'].includes(e.key)) {e.preventDefault(); const next=(i+(e.key==='ArrowRight'?1:2))%3; setStep(next); document.getElementById(`atelier-tab-${next}`)?.focus();}}} onClick={() => setStep(i)} className={step === i ? 'selected' : ''}><span>{String(i+1).padStart(2,'0')}</span>{label}</button>)}</div>
        <div id="atelier-step-panel" role="tabpanel" aria-labelledby={`atelier-tab-${step}`}>
          <div className="atelier-panel-heading"><span>PASO {step+1} DE 3</span><h2>{['Todo empieza por la base.','¿A qué sabe tu día?','La magia está en los detalles.'][step]}</h2><p>{['Crujiente, práctico o para saborear a cucharadas.','Hasta 5 bolas. Mezcla sabores o repite tu favorito.','Un crujiente, una salsa… o un poquito de ambos.'][step]}</p></div>
          {step === 0 && <div className="atelier-bases">{activeBases.map(b => <button key={b.id} className={`atelier-base ${base?.id === b.id ? 'selected' : ''}`} aria-pressed={base?.id === b.id} onClick={() => setBaseId(b.id)}><span className="atelier-choice-check">{base?.id === b.id ? '✓' : '+'}</span><svg viewBox={baseVisual(b).crop} aria-hidden="true"><image href={`/customizer/${baseVisual(b).key}.png`} width="1280" height="1280" /></svg><strong>{b.name}</strong><small>{b.description?.replace(/\(\+S\/.*\)/,'') || 'El comienzo de una gran combinación.'}</small><span>{Number(b.price) > 0 ? `+ ${money(b.price)}` : 'Sin costo extra'}</span></button>)}{!activeBases.length && <p>No hay envases disponibles por el momento.</p>}</div>}
          {step === 1 && <><div className="atelier-flavor-tools"><div className="atelier-families">{['Todos','Cremosos','Frutales'].map(label => <button key={label} aria-pressed={family === label} className={family === label ? 'selected' : ''} onClick={() => setFamily(label)}>{label}</button>)}</div><input type="search" aria-label="Buscar sabores" placeholder="Buscar un sabor…" value={query} onChange={e => setQuery(e.target.value)} /></div>
            <div className="atelier-flavors">{visibleFlavors.map(flavor => { const quantity = scoops.filter(s => s.id === flavor.id).length; return <article className={`atelier-flavor ${quantity ? 'selected' : ''}`} key={flavor.id}><div className="atelier-flavor-photo"><ScoopPhoto flavor={flavor} />{flavor.isPremium && <span>ESPECIAL</span>}</div><h3>{flavor.name}</h3><span className="atelier-unit-price">{money(flavor.price)} <small>/ bola</small></span>{quantity ? <div className="atelier-quantity"><button aria-label={`Quitar una bola de ${flavor.name}`} onClick={() => removeScoop(scoops.findIndex(s => s.id === flavor.id))}>−</button><output aria-label={`Bolas de ${flavor.name}`}>{quantity}</output><button disabled={scoops.length >= 5} aria-label={`Añadir otra bola de ${flavor.name}`} onClick={() => addScoop(flavor)}>+</button></div> : <button className="atelier-add-flavor" disabled={scoops.length >= 5} onClick={() => addScoop(flavor)}>+ Añadir</button>}</article>; })}</div>{!visibleFlavors.length && <p className="atelier-empty-small">No encontramos ese sabor. Prueba otra búsqueda.</p>}</>}
          {step === 2 && <><div className="atelier-extras-heading"><h3>Algo crujiente, algo divertido</h3><span>Opcional · puedes combinar</span></div><div className="atelier-toppings">{activeToppings.map(t => <button key={t.id} className={`atelier-topping ${toppingIds.includes(t.id) ? 'selected' : ''}`} aria-pressed={toppingIds.includes(t.id)} onClick={() => setToppingIds(toppingIds.includes(t.id) ? toppingIds.filter(id => id !== t.id) : [...toppingIds, t.id])}><ToppingPhoto topping={t}/><strong>{t.name}</strong><span>+ {money(t.price)}</span><b>{toppingIds.includes(t.id) ? '✓' : '+'}</b></button>)}</div><div className="atelier-extras-heading"><h3>Y para terminar… la salsa</h3><span>Elige una</span></div><div className="atelier-syrups"><button className={!syrup ? 'selected' : ''} aria-pressed={!syrup} onClick={() => setSyrupId(null)}><strong>Sin salsa</strong><span>El sabor, tal cual</span></button>{activeSyrups.map(t => <button key={t.id} className={syrup?.id === t.id ? 'selected' : ''} aria-pressed={syrup?.id === t.id} onClick={() => setSyrupId(t.id)}><strong>{t.name}</strong><span>+ {money(t.price)}</span></button>)}</div><p className="atelier-allergen-note">¿Tienes alguna alergia? Consulta los ingredientes con la tienda antes de pedir.</p></>}
        </div>
        <p className="atelier-live" role="status" aria-live="polite">{notice || `${scoops.length} de 5 bolas elegidas. Los extras son opcionales.`}</p><div className="atelier-step-actions"><button className="atelier-back" disabled={step === 0} onClick={() => setStep(step-1)}>← Anterior</button>{step < 2 && <button className="atelier-next" onClick={() => setStep(step+1)}>Elegir {step === 0 ? 'sabores' : 'extras'} →</button>}</div><div className="atelier-checkout"><div><span>Tu momento feliz, por</span><strong>{money(total)}</strong></div><button disabled={!base || !scoops.length || adding} onClick={addToCart}>{adding ? 'Añadiendo…' : 'Añadir a mi pedido'} <span>→</span></button></div>
      </div>
    </div>
    {validPresets.length > 0 && <section className="atelier-inspiration"><div><span className="atelier-eyebrow">¿TE AYUDAMOS A ELEGIR?</span><h2>Mezclas que hacen match.</h2><p>Empieza con una de estas y dale tu toque.</p></div><div className="atelier-preset-list">{validPresets.map(rec => <button key={rec.id} onClick={() => applyPreset(rec)}><strong>{cleanName(rec.name)}</strong><span>{rec.resolved.scoops.map(s => s.name).join(' + ')}</span><b>{money(rec.resolved.price)} <span>Probar →</span></b></button>)}</div></section>}
  </section>;
}
