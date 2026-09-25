import { useId, useRef, useState } from 'react';
import { ScoopPhoto, ToppingPhoto } from './DessertPreview';
import { flavorColor, money } from '../utils/dessert';
import './customizer.css';

const MAX_TOPPINGS = 3;
const syrupColor = syrup => /fresa|sauce/.test(`${syrup?.id} ${syrup?.name}`.toLowerCase()) ? '#c23a4c' : /manjar|caramel/.test(`${syrup?.id} ${syrup?.name}`.toLowerCase()) ? '#c98a45' : '#4a2517';
const sprinkleColors = ['#ff4757', '#ffa502', '#2ed573', '#1e90ff', '#ff6b81', '#9b59b6'];

// A family tub that fills with one stripe per chosen flavour.
function LiterTub({ flavors = [], toppings = [], syrup = null }) {
  const uid = useId().replace(/:/g, '');
  const width = 180;
  const stripe = flavors.length ? width / flavors.length : width;
  const empty = flavors.length === 0;
  return (
    <svg className="liter-tub" viewBox="0 0 240 190" role="img" aria-label={empty ? 'Pote de 1 litro vacío' : `Pote de 1 litro con ${flavors.map(f => f.name).join(', ')}`}>
      <defs>
        <clipPath id={`${uid}-body`}><path d="M30 64 H210 L197 162 Q120 176 43 162 Z" /></clipPath>
        <clipPath id={`${uid}-top`}><rect x="22" y="14" width="196" height="52" /></clipPath>
        <linearGradient id={`${uid}-shade`} x1="0" x2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".28" />
          <stop offset=".45" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity=".16" />
        </linearGradient>
      </defs>
      <ellipse cx="120" cy="174" rx="82" ry="7" fill="#5b2a36" opacity=".12" />
      <g clipPath={`url(#${uid}-top)`}>
        {empty
          ? <path d="M36 64 Q120 40 204 64 Z" fill="#f3e6e9" />
          : flavors.map((flavor, index) => (
            <ellipse key={`top-${index}`} cx={30 + stripe * index + stripe / 2} cy="62" rx={stripe / 2 + 8} ry="20" fill={flavorColor(flavor)} />
          ))}
        {syrup && !empty && <path d="M40 54 Q62 40 84 52 T128 50 T172 52 T202 54" fill="none" stroke={syrupColor(syrup)} strokeWidth="6" strokeLinecap="round" />}
        {!empty && toppings.slice(0, MAX_TOPPINGS).flatMap((topping, t) => Array.from({ length: 6 }, (_, i) => (
          <rect key={`${topping.id}-${i}`} x={48 + i * 26 + t * 7} y={46 + ((i + t) % 3) * 4} width="7" height="3" rx="1.5" fill={sprinkleColors[(i + t * 2) % sprinkleColors.length]} transform={`rotate(${(i * 37 + t * 20) % 90 - 45} ${51 + i * 26 + t * 7} ${47 + ((i + t) % 3) * 4})`} />
        )))}
      </g>
      <g clipPath={`url(#${uid}-body)`}>
        <rect x="20" y="60" width="200" height="120" fill={empty ? '#fbf3f5' : '#fff'} />
        {!empty && flavors.map((flavor, index) => (
          <rect key={`body-${index}`} x={30 + stripe * index} y="60" width={stripe + .5} height="120" fill={flavorColor(flavor)} />
        ))}
        <rect x="20" y="60" width="200" height="120" fill={`url(#${uid}-shade)`} />
      </g>
      <path d="M30 64 H210 L197 162 Q120 176 43 162 Z" fill="none" stroke="#e3c9cf" strokeWidth="2" />
      <rect x="22" y="58" width="196" height="12" rx="6" fill="#fff" stroke="#e3c9cf" strokeWidth="2" />
      <text x="120" y="126" textAnchor="middle" fontSize="15" fontWeight="800" fill={empty ? '#b58a95' : '#fff'} opacity={empty ? 1 : .9} style={{ fontFamily: 'var(--font-title)' }}>{empty ? 'Elige tus sabores' : '1 LITRO'}</text>
    </svg>
  );
}

export default function LiterCustomizer({ flavors, toppings = [], literConfig, onAddToCart, setView, showAlert }) {
  const activeFlavors = (flavors || []).filter(f => f.active !== false);
  const solidToppings = toppings.filter(t => t.category === 'solido' && t.active !== false);
  const syrups = toppings.filter(t => t.category === 'liquido' && t.active !== false);
  const maxFlavors = parseInt(literConfig?.maxFlavors, 10) || 3;
  const basePrice = parseFloat(literConfig?.price) || 15.0;

  const [selectedFlavors, setSelectedFlavors] = useState([]);
  const [selectedToppings, setSelectedToppings] = useState([]);
  const [selectedSyrup, setSelectedSyrup] = useState(null);
  const [step, setStep] = useState(0);
  const [notice, setNotice] = useState('');
  const [pulse, setPulse] = useState(0);
  const [isAdding, setIsAdding] = useState(false);
  const panelRef = useRef(null);

  const toppingsPrice = selectedToppings.reduce((sum, t) => sum + (parseFloat(t.price) || 0), 0);
  const syrupPrice = selectedSyrup ? (parseFloat(selectedSyrup.price) || 0) : 0;
  const totalPrice = basePrice + toppingsPrice + syrupPrice;
  const full = selectedFlavors.length >= maxFlavors;

  const changed = message => { setNotice(message); setPulse(value => value + 1); };
  const goToStep = next => {
    setStep(next);
    window.requestAnimationFrame(() => panelRef.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' }));
  };
  const addFlavor = flavor => {
    if (full) { setNotice(`Tu litro ya tiene ${maxFlavors} sabores. Quita uno para cambiarlo.`); return; }
    setSelectedFlavors([...selectedFlavors, flavor]);
    const left = maxFlavors - selectedFlavors.length - 1;
    changed(left > 0 ? `${flavor.name} añadido. Puedes sumar ${left} sabor${left === 1 ? '' : 'es'} más.` : `${flavor.name} añadido. ¡Tu litro está completo!`);
  };
  const removeFlavorAt = index => {
    if (index < 0) return;
    setSelectedFlavors(selectedFlavors.filter((_, i) => i !== index));
    changed('Sabor retirado.');
  };
  const toggleTopping = topping => {
    const selected = selectedToppings.some(t => t.id === topping.id);
    if (!selected && selectedToppings.length >= MAX_TOPPINGS) { setNotice(`Puedes elegir hasta ${MAX_TOPPINGS} toppings.`); return; }
    setSelectedToppings(selected ? selectedToppings.filter(t => t.id !== topping.id) : [...selectedToppings, topping]);
    changed(selected ? `${topping.name} retirado.` : `${topping.name} añadido.`);
  };

  const handleAddLiterToCart = () => {
    if (isAdding) return;
    if (selectedFlavors.length === 0) {
      setNotice('Elige al menos un sabor para tu litro.');
      goToStep(0);
      if (showAlert) showAlert('Elige tus sabores', `Tu litro puede llevar hasta ${maxFlavors} sabores. Elige al menos uno para continuar.`, 'warning');
      return;
    }
    let name = selectedFlavors.length === 1
      ? `Helado de 1 Litro (Sabor Único: ${selectedFlavors[0].name})`
      : `Helado de 1 Litro (${selectedFlavors.length} Sabores: ${selectedFlavors.map(f => f.name).join(' - ')})`;
    if (selectedToppings.length > 0 || selectedSyrup) {
      const parts = [];
      if (selectedToppings.length > 0) parts.push('Toppings');
      if (selectedSyrup) parts.push('Salsa');
      name += ` + ${parts.join(' y ')}`;
    }
    const literItem = {
      type: 'liter',
      id: `liter_${Date.now()}`,
      name,
      price: totalPrice,
      quantity: 1,
      scoops: selectedFlavors.map(f => ({ id: f.id, name: f.name, color: f.color || '#cccccc', price: parseFloat(f.price) || 0 })),
      toppings: selectedToppings.map(t => ({ id: t.id, name: t.name, price: parseFloat(t.price) || 0 })),
      syrup: selectedSyrup ? { id: selectedSyrup.id, name: selectedSyrup.name, price: parseFloat(selectedSyrup.price) || 0 } : null
    };
    setIsAdding(true);
    // A closed store rejects the item: stay here with the selection intact.
    if (onAddToCart(literItem) === false) {
      setIsAdding(false);
      return;
    }
    setView('cart');
  };

  const summary = [`${selectedFlavors.length}/${maxFlavors} sabores`, selectedToppings.length + (selectedSyrup ? 1 : 0) ? `${selectedToppings.length + (selectedSyrup ? 1 : 0)} extra${selectedToppings.length + (selectedSyrup ? 1 : 0) === 1 ? '' : 's'}` : null].filter(Boolean).join(' · ');

  return (
    <section className="atelier liter-builder" aria-label="Arma tu litro">
      <header className="atelier-heading">
        <button type="button" className="atelier-back" onClick={() => setView('shop')}>← Carta</button>
        <div><span className="atelier-eyebrow">PARA LLEVAR A CASA</span><h1>Tu litro, <em>a tu gusto.</em></h1></div>
      </header>

      <div className="atelier-layout">
        <aside className="atelier-stage" aria-label="Tu pote de 1 litro">
          <div key={pulse} className={`atelier-stage-art ${pulse ? 'is-changing' : ''}`}><LiterTub flavors={selectedFlavors} toppings={selectedToppings} syrup={selectedSyrup} /></div>
          <div className="atelier-stage-meta">
            <span className="atelier-stage-count">{selectedFlavors.length}/{maxFlavors} sabores</span>
            <strong>Pote de 1 litro · {money(basePrice)}</strong>
            <ul className="atelier-scoop-chips" aria-label="Tu selección">
              {selectedFlavors.map((flavor, index) => <li key={`${flavor.id}-${index}`}><span>{flavor.name}</span><button type="button" aria-label={`Quitar ${flavor.name}`} onClick={() => removeFlavorAt(index)}>×</button></li>)}
              {selectedToppings.map(topping => <li key={topping.id} className="is-extra"><span>{topping.name}</span><button type="button" aria-label={`Quitar ${topping.name}`} onClick={() => toggleTopping(topping)}>×</button></li>)}
              {selectedSyrup && <li className="is-extra"><span>{selectedSyrup.name}</span><button type="button" aria-label={`Quitar ${selectedSyrup.name}`} onClick={() => { setSelectedSyrup(null); changed('Salsa retirada.'); }}>×</button></li>}
            </ul>
            {!selectedFlavors.length && <small>Hasta {maxFlavors} sabores en un mismo pote.</small>}
          </div>
        </aside>

        <div className="atelier-controls" ref={panelRef}>
          <div className="atelier-steps liter-steps" role="tablist" aria-label="Pasos">
            {['Sabores', 'Toppings'].map((label, index) => {
              const done = index === 0 ? selectedFlavors.length > 0 : selectedToppings.length > 0 || Boolean(selectedSyrup);
              return (
                <button type="button" key={label} role="tab" aria-selected={step === index} className={`${step === index ? 'selected' : ''} ${done && step !== index ? 'done' : ''}`} onClick={() => goToStep(index)}>
                  <span aria-hidden="true">{done && step !== index ? '✓' : index + 1}</span>{label}
                </button>
              );
            })}
          </div>

          <div className="atelier-panel" role="tabpanel">
            {step === 0 ? <>
              <div className="atelier-panel-heading"><h2>Elige hasta {maxFlavors} sabores</h2><p>Toca para sumar; puedes repetir tu favorito.</p></div>
              <div className="atelier-flavors">
                {activeFlavors.map(flavor => {
                  const quantity = selectedFlavors.filter(f => f.id === flavor.id).length;
                  return (
                    <article className={`atelier-flavor ${quantity ? 'selected' : ''}`} key={flavor.id}>
                      <button type="button" className="atelier-flavor-add" disabled={full} onClick={() => addFlavor(flavor)} aria-label={`Añadir ${flavor.name} a tu litro`}>
                        <span className="atelier-flavor-photo"><ScoopPhoto flavor={flavor} /></span>
                        <strong>{flavor.name}</strong>
                        <span className="atelier-unit-price">Incluido</span>
                        {!quantity && <span className="atelier-flavor-plus" aria-hidden="true">+</span>}
                      </button>
                      {quantity > 0 && <div className="atelier-quantity">
                        <button type="button" aria-label={`Quitar ${flavor.name}`} onClick={() => removeFlavorAt(selectedFlavors.map(f => f.id).lastIndexOf(flavor.id))}>−</button>
                        <output>{quantity}</output>
                        <button type="button" disabled={full} aria-label={`Añadir otra porción de ${flavor.name}`} onClick={() => addFlavor(flavor)}>+</button>
                      </div>}
                    </article>
                  );
                })}
              </div>
              {!activeFlavors.length && <p className="atelier-empty-small">No hay sabores disponibles por el momento.</p>}
            </> : <>
              <div className="atelier-panel-heading"><h2>Dale el toque final</h2><p>Opcional: hasta {MAX_TOPPINGS} toppings y una salsa.</p></div>
              {solidToppings.length > 0 && <><h3 className="atelier-extras-heading">Toppings <span>{selectedToppings.length}/{MAX_TOPPINGS}</span></h3>
                <div className="atelier-toppings">{solidToppings.map(topping => {
                  const selected = selectedToppings.some(t => t.id === topping.id);
                  return <button type="button" key={topping.id} className={`atelier-topping ${selected ? 'selected' : ''}`} aria-pressed={selected} onClick={() => toggleTopping(topping)}><ToppingPhoto topping={topping} /><strong>{topping.name}</strong><span>+ {money(topping.price)}</span><b aria-hidden="true">{selected ? '✓' : '+'}</b></button>;
                })}</div></>}
              {syrups.length > 0 && <><h3 className="atelier-extras-heading">Salsa <span>elige una</span></h3>
                <div className="atelier-syrups">
                  <button type="button" className={!selectedSyrup ? 'selected' : ''} aria-pressed={!selectedSyrup} onClick={() => { setSelectedSyrup(null); changed('Sin salsa.'); }}><i className="atelier-syrup-swatch is-none" aria-hidden="true" /><strong>Sin salsa</strong></button>
                  {syrups.map(syrup => <button type="button" key={syrup.id} className={selectedSyrup?.id === syrup.id ? 'selected' : ''} aria-pressed={selectedSyrup?.id === syrup.id} onClick={() => { setSelectedSyrup(syrup); changed(`${syrup.name} añadida.`); }}><i className="atelier-syrup-swatch" style={{ '--syrup': syrupColor(syrup) }} aria-hidden="true" /><strong>{syrup.name}</strong><span>+ {money(syrup.price)}</span></button>)}
                </div></>}
            </>}
            <p className="atelier-live" role="status" aria-live="polite">{notice || (selectedFlavors.length ? `${selectedFlavors.length} de ${maxFlavors} sabores elegidos.` : 'Tu primer sabor te espera.')}</p>
            {step === 0 && <button type="button" className="atelier-next" onClick={() => goToStep(1)}>Siguiente: toppings →</button>}
          </div>
        </div>
      </div>

      <div className="atelier-cartbar">
        <div className="atelier-cartbar-copy"><small>{summary}</small><strong>{money(totalPrice)}</strong></div>
        <button type="button" disabled={isAdding || !selectedFlavors.length} onClick={handleAddLiterToCart}>{isAdding ? 'Añadiendo…' : 'Añadir al pedido'} <span aria-hidden="true">→</span></button>
      </div>
    </section>
  );
}
