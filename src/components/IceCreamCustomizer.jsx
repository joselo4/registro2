import React, { useState } from 'react';

// Coordenadas fijas para toppings distribuidos armónicamente sobre las bolas de helado
const TOPPING_SPRINKLES = [
  { dx: -24, dy: -24, rot: 15, color: '#ff4757' },
  { dx: 18, dy: -28, rot: -35, color: '#ffa502' },
  { dx: 0, dy: -34, rot: 45, color: '#2ed573' },
  { dx: -32, dy: -8, rot: -15, color: '#1e90ff' },
  { dx: 28, dy: -12, rot: 25, color: '#ff6b81' },
  { dx: -10, dy: -20, rot: 80, color: '#f1c40f' },
  { dx: 10, dy: -18, rot: -50, color: '#9b59b6' },
  { dx: -18, dy: 6, rot: 30, color: '#2ed573' },
  { dx: 22, dy: 4, rot: -20, color: '#ffa502' },
  { dx: 0, dy: 10, rot: 65, color: '#ff4757' },
  { dx: -38, dy: 16, rot: -40, color: '#f1c40f' },
  { dx: 36, dy: 18, rot: 40, color: '#1e90ff' },
];

const OREO_CHUNKS = [
  { dx: -22, dy: -24, r: 4.2 },
  { dx: 16, dy: -26, r: 3.8 },
  { dx: -2, dy: -32, r: 4.8 },
  { dx: -30, dy: -6, r: 3.5 },
  { dx: 26, dy: -8, r: 4.0 },
  { dx: -8, dy: -14, r: 4.5 },
  { dx: 12, dy: -12, r: 3.6 },
  { dx: -18, dy: 8, r: 3.8 },
  { dx: 20, dy: 10, r: 4.2 },
  { dx: 0, dy: 14, r: 3.4 },
];

const PEANUT_CHUNKS = [
  { dx: -20, dy: -22, rx: 4.5, ry: 2.5, rot: 25 },
  { dx: 18, dy: -24, rx: 4.0, ry: 2.2, rot: -35 },
  { dx: 0, dy: -30, rx: 5.0, ry: 2.6, rot: 75 },
  { dx: -26, dy: -4, rx: 4.2, ry: 2.4, rot: -15 },
  { dx: 24, dy: -6, rx: 4.6, ry: 2.5, rot: 40 },
  { dx: -12, dy: 8, rx: 3.8, ry: 2.2, rot: 15 },
  { dx: 16, dy: 10, rx: 4.2, ry: 2.4, rot: -45 },
];

const GUMMY_BEARS = [
  { dx: -22, dy: -18, color: '#2ed573' },
  { dx: 20, dy: -20, color: '#ff4757' },
  { dx: 0, dy: -26, color: '#ffa502' },
  { dx: -16, dy: 4, color: '#9b59b6' },
  { dx: 18, dy: 6, color: '#1e90ff' }
];

export default function IceCreamCustomizer({
  bases = [],
  flavors = [],
  toppings = [],
  onAddToCart,
  setView,
  recommendations = [],
  showAlert,
  shopConfig
}) {
  const alert = (msg) => {
    if (showAlert) {
      const isError = msg.toLowerCase().includes('límite') || msg.toLowerCase().includes('añade') || msg.toLowerCase().includes('al menos');
      const isSuccess = msg.toLowerCase().includes('cargó') || msg.toLowerCase().includes('éxito');
      const type = isError ? 'warning' : isSuccess ? 'success' : 'info';
      const title = isError ? 'Atención' : isSuccess ? '¡Listo!' : 'Aviso';
      showAlert(title, msg, type);
    } else {
      window.alert(msg);
    }
  };

  const activeBases = bases.filter(b => b.active !== false);
  const activeFlavors = flavors.filter(f => f.active !== false);
  const activeSolidToppings = toppings.filter(t => t.active !== false && t.category === 'solido');
  const activeLiquidToppings = toppings.filter(t => t.active !== false && t.category === 'liquido');

  const defaultCustomizer = shopConfig?.defaultCustomizer || {
    baseId: 'cono',
    flavorId: 'lucuma',
    toppingId: 'chispas',
    syrupId: 'fresa_sauce'
  };

  const [selectedBase, setSelectedBase] = useState(() => {
    const baseIdVal = defaultCustomizer.baseId || 'cono';
    return activeBases.find(b => b.id === baseIdVal) || activeBases[0] || bases[0] || { id: 'cono', name: 'Cono', price: 0 };
  });

  const [selectedScoops, setSelectedScoops] = useState(() => {
    const flavorIdVal = defaultCustomizer.flavorId || 'lucuma';
    const defaultFlavor = activeFlavors.find(f => f.id === flavorIdVal) || activeFlavors[0];
    return defaultFlavor ? [defaultFlavor] : [];
  });

  const [selectedToppings, setSelectedToppings] = useState(() => {
    const toppingIdVal = defaultCustomizer.toppingId || 'chispas';
    if (toppingIdVal === 'none' || toppingIdVal === 'none_topping') return [];
    const defaultTopping = activeSolidToppings.find(t => t.id === toppingIdVal);
    return defaultTopping ? [defaultTopping] : [];
  });

  const [selectedSyrup, setSelectedSyrup] = useState(() => {
    const syrupIdVal = defaultCustomizer.syrupId || 'fresa_sauce';
    if (syrupIdVal === 'none' || syrupIdVal === 'none_syrup') return null;
    const defaultSyrup = toppings.find(t => t.id === syrupIdVal);
    return defaultSyrup ? { id: defaultSyrup.id, name: defaultSyrup.name, price: defaultSyrup.price } : null;
  });

  const [isAdding, setIsAdding] = useState(false);
  const [customTab, setCustomTab] = useState('base'); // 'base' | 'scoops' | 'toppings'

  const handleAddScoop = (flavor) => {
    if (selectedScoops.length >= 5) {
      alert("¡El límite es de 5 bolas de helado!");
      return;
    }
    setSelectedScoops([...selectedScoops, flavor]);
  };

  const handleRemoveScoop = (index) => {
    const next = [...selectedScoops];
    next.splice(index, 1);
    setSelectedScoops(next);
  };

  const handleToggleTopping = (topping) => {
    const exists = selectedToppings.find(t => t.id === topping.id);
    if (exists) {
      setSelectedToppings(selectedToppings.filter(t => t.id !== topping.id));
    } else {
      setSelectedToppings([...selectedToppings, topping]);
    }
  };

  const handleToggleSyrup = (syrup) => {
    if (selectedSyrup && selectedSyrup.id === syrup.id) {
      setSelectedSyrup(null);
    } else {
      setSelectedSyrup(syrup);
    }
  };

  // Precios
  const basePrice = selectedBase?.price || 0;
  const scoopsPrice = selectedScoops.reduce((sum, s) => sum + (s.price || 0), 0);
  const toppingsPrice = selectedToppings.reduce((sum, t) => sum + (t.price || 0), 0);
  const syrupPrice = selectedSyrup ? (selectedSyrup.price || 0) : 0;
  const totalPrice = basePrice + scoopsPrice + toppingsPrice + syrupPrice;

  // Cargar combinaciones sugeridas
  const applyPresetRecommendation = (rec) => {
    const baseObj = bases.find(b => b.id === rec.baseId) || bases[0] || selectedBase;
    const scoopsList = [];
    if (rec.flavorIds) {
      rec.flavorIds.forEach(fid => {
        const flavorObj = flavors.find(f => f.id === fid);
        if (flavorObj) scoopsList.push(flavorObj);
      });
    }
    const toppingsList = [];
    if (rec.toppingIds) {
      rec.toppingIds.forEach(tid => {
        const toppingObj = toppings.find(t => t.id === tid);
        if (toppingObj) toppingsList.push(toppingObj);
      });
    }
    let syrupObj = null;
    if (rec.syrupId) {
      const sMatch = toppings.find(t => t.id === rec.syrupId);
      if (sMatch) {
        syrupObj = { id: sMatch.id, name: sMatch.name, price: sMatch.price };
      } else if (rec.syrupId === 'fudge') syrupObj = { id: 'fudge', name: 'Fudge de Chocolate', price: 0.50 };
      else if (rec.syrupId === 'fresa') syrupObj = { id: 'fresa', name: 'Salsa de Fresa', price: 0.50 };
      else if (rec.syrupId === 'manjar') syrupObj = { id: 'manjar', name: 'Manjar Blanco', price: 0.50 };
    }

    setSelectedBase(baseObj);
    setSelectedScoops(scoopsList.length > 0 ? scoopsList : selectedScoops);
    setSelectedToppings(toppingsList);
    setSelectedSyrup(syrupObj);
    alert(`¡Se cargó la sugerencia: ${rec.name}!`);
  };

  const handleAddCustomToCart = () => {
    if (isAdding) return;
    if (selectedScoops.length === 0) {
      alert("Por favor, añade al menos una bola de helado.");
      return;
    }

    setIsAdding(true);
    const name = `Helado Personalizado en ${selectedBase.name} (${selectedScoops.length} bola${selectedScoops.length > 1 ? 's' : ''})`;
    const customItem = {
      type: 'custom',
      base: selectedBase,
      scoops: selectedScoops,
      toppings: selectedToppings,
      syrup: selectedSyrup,
      price: totalPrice,
      quantity: 1,
      name: name
    };

    onAddToCart(customItem);
    setView('shop');
  };

  // Coordenadas gourmet para 1 a 5 bolas de helado dispuestas armónicamente (nunca desbordan)
  const getScoopLayout = (count) => {
    if (count === 1) {
      return [{ x: 150, y: 168, r: 46, order: 0 }];
    }
    if (count === 2) {
      return [
        { x: 150, y: 182, r: 43, order: 0 },
        { x: 150, y: 122, r: 41, order: 1 }
      ];
    }
    if (count === 3) {
      return [
        { x: 128, y: 178, r: 39, order: 0 },
        { x: 172, y: 178, r: 39, order: 1 },
        { x: 150, y: 118, r: 40, order: 2 }
      ];
    }
    if (count === 4) {
      return [
        { x: 126, y: 184, r: 37, order: 0 },
        { x: 174, y: 184, r: 37, order: 1 },
        { x: 132, y: 134, r: 36, order: 2 },
        { x: 168, y: 126, r: 37, order: 3 }
      ];
    }
    if (count >= 5) {
      return [
        { x: 124, y: 190, r: 35, order: 0 },
        { x: 176, y: 190, r: 35, order: 1 },
        { x: 128, y: 144, r: 35, order: 2 },
        { x: 172, y: 144, r: 35, order: 3 },
        { x: 150, y: 94, r: 36, order: 4 }
      ];
    }
    return [];
  };

  const scoopCoords = getScoopLayout(selectedScoops.length);

  // Renderizado dinámico de la salsa en cascada natural y brillante
  const renderSyrupFlowSVG = () => {
    if (!selectedSyrup || selectedScoops.length === 0) return null;

    let syrupColor = '#d35400';
    const sId = String(selectedSyrup.id || '').toLowerCase();
    if (sId.includes('fudge') || sId.includes('choco')) {
      syrupColor = '#2b1108';
    } else if (sId.includes('fresa') || sId.includes('sauce') || sId.includes('frutilla')) {
      syrupColor = '#d00000';
    } else if (sId.includes('manjar') || sId.includes('caramel')) {
      syrupColor = '#d35400';
    }

    const topCoord = scoopCoords[scoopCoords.length - 1] || { x: 150, y: 150, r: 40 };
    const { x, y, r } = topCoord;

    return (
      <g filter="url(#artisanDropShadow)">
        {/* Capa base de salsa que chorrea sobre la corona */}
        <path
          d={`M ${x - r + 3} ${y + 2}
             C ${x - r * 0.9} ${y - r - 2} ${x + r * 0.9} ${y - r - 2} ${x + r - 3} ${y + 2}
             C ${x + r - 6} ${y + 12} ${x + r - 12} ${y + 4} ${x + r - 18} ${y + 16}
             C ${x + r - 24} ${y + 26} ${x + r - 30} ${y + 8} ${x + r - 36} ${y + 20}
             C ${x + r - 42} ${y + 28} ${x + r - 48} ${y + 6} ${x + r - 54} ${y + 18}
             C ${x + r - 62} ${y + 10} ${x - r + 10} ${y + 14} ${x - r + 3} ${y + 2} Z`}
          fill={syrupColor}
        />
        {/* Gotas bulbosas en la punta del chorreado */}
        <circle cx={x + r - 18} cy={y + 17} r="3.2" fill={syrupColor} />
        <circle cx={x + r - 36} cy={y + 21} r="3.8" fill={syrupColor} />
        <circle cx={x + r - 54} cy={y + 19} r="3" fill={syrupColor} />

        {/* Reflejo brillante de la salsa (acabado jugoso y apetecible) */}
        <path
          d={`M ${x - r * 0.55} ${y - r * 0.45} Q ${x} ${y - r * 0.85} ${x + r * 0.5} ${y - r * 0.4}`}
          stroke="rgba(255, 255, 255, 0.65)"
          strokeWidth="2.8"
          strokeLinecap="round"
          fill="none"
        />
        <circle cx={x + r - 36} cy={y + 21} r="1.2" fill="white" opacity="0.8" />
        <circle cx={x + r - 18} cy={y + 17} r="0.9" fill="white" opacity="0.8" />
      </g>
    );
  };

  // Renderizado de Toppings distribuidos armónicamente
  const renderToppingsSVG = () => {
    if (selectedScoops.length === 0 || selectedToppings.length === 0) return null;

    const centerCoord = scoopCoords[scoopCoords.length - 1] || { x: 150, y: 150 };

    return selectedToppings.map(topping => {
      if (topping.id === 'chispas') {
        return (
          <g key="toppings-chispas">
            {TOPPING_SPRINKLES.map((sp, i) => (
              <rect
                key={`ch-${i}`}
                x={centerCoord.x + sp.dx}
                y={centerCoord.y + sp.dy}
                width="6.5"
                height="2.8"
                rx="1.4"
                fill={sp.color}
                transform={`rotate(${sp.rot}, ${centerCoord.x + sp.dx + 3.2}, ${centerCoord.y + sp.dy + 1.4})`}
                filter="url(#subtleToppingShadow)"
              />
            ))}
          </g>
        );
      }

      if (topping.id === 'oreo') {
        return (
          <g key="toppings-oreo">
            {OREO_CHUNKS.map((o, i) => (
              <g key={`or-${i}`}>
                <circle
                  cx={centerCoord.x + o.dx}
                  cy={centerCoord.y + o.dy}
                  r={o.r}
                  fill="#1c1f24"
                  stroke="#101216"
                  strokeWidth="0.6"
                  filter="url(#subtleToppingShadow)"
                />
                <circle
                  cx={centerCoord.x + o.dx + o.r * 0.3}
                  cy={centerCoord.y + o.dy - o.r * 0.3}
                  r={o.r * 0.35}
                  fill="#f8f9fa"
                  opacity="0.8"
                />
              </g>
            ))}
          </g>
        );
      }

      if (topping.id === 'mani') {
        return (
          <g key="toppings-mani">
            {PEANUT_CHUNKS.map((p, i) => (
              <ellipse
                key={`mn-${i}`}
                cx={centerCoord.x + p.dx}
                cy={centerCoord.y + p.dy}
                rx={p.rx}
                ry={p.ry}
                fill="#e59866"
                stroke="#af601a"
                strokeWidth="0.8"
                transform={`rotate(${p.rot}, ${centerCoord.x + p.dx}, ${centerCoord.y + p.dy})`}
                filter="url(#subtleToppingShadow)"
              />
            ))}
          </g>
        );
      }

      if (topping.id === 'gomitas') {
        return (
          <g key="toppings-gomitas">
            {GUMMY_BEARS.map((g, i) => (
              <g key={`gm-${i}`} filter="url(#subtleToppingShadow)">
                <rect
                  x={centerCoord.x + g.dx - 4}
                  y={centerCoord.y + g.dy - 6}
                  width="8"
                  height="12"
                  rx="3"
                  fill={g.color}
                  opacity="0.88"
                />
                <circle cx={centerCoord.x + g.dx - 3} cy={centerCoord.y + g.dy - 6} r="2" fill={g.color} opacity="0.88" />
                <circle cx={centerCoord.x + g.dx + 3} cy={centerCoord.y + g.dy - 6} r="2" fill={g.color} opacity="0.88" />
                <circle cx={centerCoord.x + g.dx - 1} cy={centerCoord.y + g.dy - 2} r="1" fill="white" opacity="0.65" />
              </g>
            ))}
          </g>
        );
      }

      return null;
    });
  };

  return (
    <div className="customizer-section" style={{ maxWidth: '1140px', margin: '0 auto', paddingBottom: '50px' }}>
      <style dangerouslySetInnerHTML={{ __html: `
        .icecream-customizer-wrapper {
          display: grid;
          grid-template-columns: 360px 1fr;
          gap: 28px;
          align-items: start;
        }
        @media (max-width: 900px) {
          .icecream-customizer-wrapper {
            grid-template-columns: 1fr;
            gap: 20px;
          }
          .customizer-preview-sticky {
            position: relative !important;
            top: 0 !important;
          }
        }
        .flavor-item-card {
          background: white;
          border: 1.5px solid #eaeaea;
          border-radius: 16px;
          padding: 12px 10px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.03);
          transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
          min-height: 145px;
          justify-content: space-between;
        }
        .flavor-item-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(0,0,0,0.06);
          border-color: rgba(255, 107, 129, 0.4);
        }
        .flavor-item-card.is-active {
          border-color: var(--primary-color);
          background: linear-gradient(180deg, #ffffff 0%, rgba(255, 107, 129, 0.04) 100%);
          box-shadow: 0 6px 18px rgba(255, 107, 129, 0.14);
        }
        .step-pill-btn {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 10px 16px;
          border-radius: 14px;
          border: 1px solid var(--border-color);
          background: white;
          cursor: pointer;
          transition: all 0.25s ease;
          font-weight: 600;
          font-size: 0.82rem;
          color: var(--text-light);
        }
        .step-pill-btn.active {
          background: var(--primary-color);
          color: white;
          border-color: var(--primary-color);
          box-shadow: 0 4px 14px rgba(255, 107, 129, 0.3);
        }
        .step-pill-btn.completed:not(.active) {
          color: var(--text-dark);
          border-color: rgba(255, 107, 129, 0.3);
          background: rgba(255, 107, 129, 0.05);
        }
        @keyframes scoop-drop-in {
          0% { transform: translateY(-40px) scale(0.85); opacity: 0; }
          70% { transform: translateY(4px) scale(1.04); }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }
      ` }} />

      {/* ENCABEZADO CON BOTÓN DE RETORNO Y TÍTULO */}
      <div style={{ marginBottom: '18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            className="btn btn-secondary"
            style={{ padding: '7px 14px', fontSize: '0.85rem', borderRadius: '12px', fontWeight: 600 }}
            onClick={() => setView('shop')}
          >
            ← Volver a la Tienda
          </button>
          <div>
            <h2 style={{ fontSize: '1.6rem', fontFamily: 'var(--font-title)', margin: 0, color: 'var(--text-dark)', lineHeight: '1.2' }}>
              Arma tu Combinación
            </h2>
            <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-light)' }}>
              Elige tu envase, tus sabores favoritos y decora con toppings artesanales
            </p>
          </div>
        </div>

        {/* Indicador rápido de precio total */}
        <div style={{ background: 'white', padding: '6px 16px', borderRadius: '20px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>Total actual:</span>
          <strong style={{ fontSize: '1.1rem', color: 'var(--primary-color)' }}>S/. {totalPrice.toFixed(2)}</strong>
        </div>
      </div>

      {/* 🌟 BARRA DE COMBINACIONES RECOMENDADAS */}
      {recommendations.length > 0 && (
        <div style={{
          padding: '12px 16px',
          marginBottom: '20px',
          background: 'linear-gradient(135deg, rgba(255, 107, 129, 0.07) 0%, rgba(229, 142, 38, 0.07) 100%)',
          borderRadius: '16px',
          border: '1px solid rgba(255, 107, 129, 0.15)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          overflowX: 'auto'
        }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-dark)', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '5px' }}>
            👑 <span>Sugerencias del Maestro:</span>
          </span>
          <div style={{ display: 'flex', gap: '8px', flex: 1, overflowX: 'auto', paddingBottom: '2px' }}>
            {recommendations.map(rec => (
              <button
                key={rec.id}
                type="button"
                onClick={() => applyPresetRecommendation(rec)}
                style={{
                  padding: '6px 14px',
                  fontSize: '0.76rem',
                  fontWeight: 600,
                  borderRadius: '20px',
                  background: 'white',
                  border: '1px solid rgba(255, 107, 129, 0.25)',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  whiteSpace: 'nowrap',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
                  transition: 'all 0.2s ease'
                }}
              >
                <span>✨</span>
                <span>{rec.name}</span>
                <span style={{ fontSize: '0.65rem', background: 'rgba(255, 107, 129, 0.12)', color: 'var(--primary-color)', padding: '2px 6px', borderRadius: '8px', fontWeight: 'bold' }}>
                  Probar
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* CONTENEDOR PRINCIPAL: VISTA PREVIA (IZQUIERDA) + CONTROLES (DERECHA) */}
      <div className="icecream-customizer-wrapper">

        {/* 1. COLUMNA DE VISTA PREVIA (FIJA / STICKY) */}
        <div className="customizer-preview-sticky" style={{ position: 'sticky', top: '85px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          
          {/* Escenario de la ilustración del helado */}
          <div style={{
            background: 'radial-gradient(circle at 50% 45%, #ffffff 0%, #fff6f0 100%)',
            borderRadius: '24px',
            border: '1px solid rgba(255, 107, 129, 0.15)',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.04)',
            padding: '16px 12px 10px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            position: 'relative'
          }}>
            {/* Medalla indicadora superior */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.95)',
              padding: '4px 12px',
              borderRadius: '20px',
              fontSize: '0.72rem',
              fontWeight: 'bold',
              color: 'var(--text-dark)',
              border: '1px solid rgba(0,0,0,0.06)',
              boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              marginBottom: '4px'
            }}>
              <span>🍨</span>
              <span>{selectedScoops.length} de 5 bolas • {selectedBase.name}</span>
            </div>

            {/* SVG ILUSTRATIVO PROFESIONAL Y APETECIBLE */}
            <svg
              viewBox="0 0 300 360"
              style={{
                width: '100%',
                maxHeight: '310px',
                height: '310px',
                display: 'block',
                overflow: 'visible'
              }}
            >
              <defs>
                {/* Sombra de caída suave en el suelo */}
                <filter id="floorBlur" x="-30%" y="-30%" width="160%" height="160%">
                  <feGaussianBlur stdDeviation="6" />
                </filter>
                <filter id="artisanDropShadow" x="-25%" y="-25%" width="150%" height="150%">
                  <feDropShadow dx="0" dy="3.5" stdDeviation="3.5" floodOpacity="0.16" />
                </filter>
                <filter id="subtleToppingShadow" x="-30%" y="-30%" width="160%" height="160%">
                  <feDropShadow dx="0" dy="1.2" stdDeviation="1" floodOpacity="0.22" />
                </filter>

                {/* Sombreado 3D de esferas de helado */}
                <radialGradient id="scoop3DShadow" cx="30%" cy="28%" r="72%">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
                  <stop offset="60%" stopColor="#000000" stopOpacity="0.04" />
                  <stop offset="85%" stopColor="#000000" stopOpacity="0.18" />
                  <stop offset="100%" stopColor="#000000" stopOpacity="0.35" />
                </radialGradient>

                {/* Brillo especular superior de helado fresco */}
                <radialGradient id="scoopSpecular" cx="32%" cy="26%" r="40%">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity="0.55" />
                  <stop offset="45%" stopColor="#ffffff" stopOpacity="0.15" />
                  <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
                </radialGradient>

                {/* Textura dorada del cono de waffle */}
                <linearGradient id="waffleConeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#d37719" />
                  <stop offset="25%" stopColor="#f39c12" />
                  <stop offset="50%" stopColor="#f7b731" />
                  <stop offset="80%" stopColor="#e58e26" />
                  <stop offset="100%" stopColor="#b75a13" />
                </linearGradient>

                {/* Gradiente para vaso de gelato artesanal */}
                <linearGradient id="gelatoCupGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#ff758c" />
                  <stop offset="35%" stopColor="#ff8fa3" />
                  <stop offset="70%" stopColor="#ffb3c1" />
                  <stop offset="100%" stopColor="#ee5253" />
                </linearGradient>

                {/* Barquillo artesanal enrollado */}
                <linearGradient id="waferGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#c98341" />
                  <stop offset="40%" stopColor="#f0b27a" />
                  <stop offset="100%" stopColor="#935116" />
                </linearGradient>
              </defs>

              {/* Sombra de apoyo en el suelo */}
              <ellipse cx="150" cy="336" rx="72" ry="9" fill="rgba(0,0,0,0.12)" filter="url(#floorBlur)" />

              {/* -------------------- 1. BASES DEL HELADO -------------------- */}

              {/* BASE A: CONO ARTESANAL CRUJIENTE */}
              {selectedBase.id === 'cono' && (
                <g filter="url(#artisanDropShadow)">
                  {/* Cuerpo cónico con curvatura orgánica */}
                  <path
                    d="M 98 198 Q 124 268 150 330 Q 176 268 202 198 Z"
                    fill="url(#waffleConeGrad)"
                  />
                  {/* Textura de rejilla de waffle horneado (rombos en perspectiva cilíndrica) */}
                  <g opacity="0.48" stroke="#8a410b" strokeWidth="1.3" fill="none">
                    {/* Diagonales hacia la derecha */}
                    <path d="M 104 205 Q 128 255 150 326" />
                    <path d="M 118 202 Q 138 248 150 310" />
                    <path d="M 136 200 Q 148 240 150 292" />
                    <path d="M 158 200 Q 165 230 150 274" />
                    <path d="M 178 202 Q 182 220 150 255" />

                    {/* Diagonales hacia la izquierda */}
                    <path d="M 196 205 Q 172 255 150 326" />
                    <path d="M 182 202 Q 162 248 150 310" />
                    <path d="M 164 200 Q 152 240 150 292" />
                    <path d="M 142 200 Q 135 230 150 274" />
                    <path d="M 122 202 Q 118 220 150 255" />

                    {/* Líneas horizontales curvadas */}
                    <path d="M 103 218 Q 150 228 197 218" />
                    <path d="M 110 240 Q 150 250 190 240" />
                    <path d="M 118 262 Q 150 272 182 262" />
                    <path d="M 128 284 Q 150 292 172 284" />
                    <path d="M 138 306 Q 150 312 162 306" />
                  </g>

                  {/* Borde superior enrollado del cono de waffle */}
                  <ellipse cx="150" cy="198" rx="52" ry="9" fill="#e58e26" stroke="#b75a13" strokeWidth="2.5" />
                  <ellipse cx="150" cy="197" rx="48" ry="7" fill="#8a410b" opacity="0.6" />
                </g>
              )}

              {/* BASE B: VASO GELATO MODERNO */}
              {selectedBase.id === 'vaso' && (
                <g filter="url(#artisanDropShadow)">
                  {/* Cuerpo del vaso */}
                  <path
                    d="M 94 212 L 110 320 Q 150 327 190 320 L 206 212 Z"
                    fill="url(#gelatoCupGrad)"
                  />
                  {/* Borde superior de cartón blanco grueso */}
                  <rect x="88" y="206" width="124" height="10" rx="5" fill="#ffffff" stroke="#ffb3c1" strokeWidth="1.5" />
                  {/* Fondo oscuro interior donde reposa el helado */}
                  <ellipse cx="150" cy="214" rx="54" ry="7" fill="#4a2213" opacity="0.25" />

                  {/* Emblema central de heladería */}
                  <circle cx="150" cy="268" r="18" fill="white" opacity="0.95" />
                  <text x="150" y="274" fontSize="17" textAnchor="middle">🍧</text>
                  <path d="M 116 304 Q 150 312 184 304" stroke="rgba(255,255,255,0.4)" strokeWidth="2" fill="none" />
                </g>
              )}

              {/* BASE C: COPA WAFFLE CANASTILLA */}
              {selectedBase.id === 'waffle' && (
                <g filter="url(#artisanDropShadow)">
                  <path
                    d="M 72 210 Q 94 222 116 212 Q 134 222 150 212 Q 166 222 184 212 Q 206 222 228 210 Q 212 312 150 316 Q 88 312 72 210 Z"
                    fill="url(#waffleConeGrad)"
                  />
                  {/* Rejilla de waffle de la copa */}
                  <g opacity="0.45" stroke="#8a410b" strokeWidth="1.3" fill="none">
                    <path d="M 85 220 Q 150 236 215 220" />
                    <path d="M 95 244 Q 150 260 205 244" />
                    <path d="M 108 268 Q 150 280 192 268" />
                    <path d="M 122 292 Q 150 300 178 292" />
                  </g>
                  <ellipse cx="150" cy="214" rx="68" ry="11" fill="#b75a13" opacity="0.4" />
                </g>
              )}

              {/* BASE D: OTRA BASE O IMAGEN PERSONALIZADA */}
              {selectedBase.id !== 'cono' && selectedBase.id !== 'vaso' && selectedBase.id !== 'waffle' && (
                <g filter="url(#artisanDropShadow)">
                  {selectedBase.image && selectedBase.image.trim() !== '' ? (
                    <>
                      <ellipse cx="150" cy="270" rx="55" ry="45" fill="#ffffff" opacity="0.95" />
                      <image href={selectedBase.image} x="95" y="210" width="110" height="110" preserveAspectRatio="xMidYMid meet" />
                    </>
                  ) : (
                    <g>
                      <path d="M 94 212 L 110 320 Q 150 327 190 320 L 206 212 Z" fill="#e0f7fa" stroke="#00acc1" strokeWidth="2" />
                      <rect x="88" y="206" width="124" height="10" rx="5" fill="#00acc1" />
                      <circle cx="150" cy="268" r="20" fill="white" opacity="0.9" />
                      <text x="150" y="275" fontSize="20" textAnchor="middle">{selectedBase.icon || '🍨'}</text>
                    </g>
                  )}
                </g>
              )}

              {/* -------------------- 2. BOLAS DE HELADO (GELATO ARTESANAL) -------------------- */}
              {selectedScoops.map((scoop, idx) => {
                const coord = scoopCoords[idx];
                if (!coord) return null;
                const { x, y, r } = coord;

                return (
                  <g
                    key={`scoop-${idx}`}
                    style={{
                      animation: 'scoop-drop-in 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards',
                      transformOrigin: `${x}px ${y}px`
                    }}
                  >
                    {/* Sombra de contacto con la bola o base inferior */}
                    <ellipse
                      cx={x}
                      cy={y + r * 0.72}
                      rx={r * 0.82}
                      ry="6.5"
                      fill="rgba(0,0,0,0.18)"
                      filter="url(#floorBlur)"
                    />

                    {/* Esfera principal del helado */}
                    <circle cx={x} cy={y} r={r} fill={scoop.color} />

                    {/* Sombreado 3D para darle volumen esférico real */}
                    <circle cx={x} cy={y} r={r} fill="url(#scoop3DShadow)" />

                    {/* Brillo especular suave para aspecto fresco y cremoso */}
                    <circle cx={x} cy={y} r={r} fill="url(#scoopSpecular)" />

                    {/* Pliegues cremosos característicos del helado artesanal */}
                    <path
                      d={`M ${x - r * 0.55} ${y - r * 0.12} Q ${x - r * 0.1} ${y - r * 0.65} ${x + r * 0.42} ${y - r * 0.42}`}
                      stroke="rgba(255,255,255,0.4)"
                      strokeWidth={Math.max(2, r * 0.08)}
                      strokeLinecap="round"
                      fill="none"
                    />
                    <path
                      d={`M ${x - r * 0.5} ${y + r * 0.22} Q ${x} ${y + r * 0.42} ${x + r * 0.5} ${y + r * 0.18}`}
                      stroke="rgba(0,0,0,0.12)"
                      strokeWidth={Math.max(1.8, r * 0.07)}
                      strokeLinecap="round"
                      fill="none"
                    />

                    {/* Falda ondulada en la base de la bola (acabado de cuchara de helado) */}
                    <path
                      d={`M ${x - r + 3} ${y + r * 0.55}
                         Q ${x - r * 0.55} ${y + r * 0.82} ${x - r * 0.25} ${y + r * 0.6}
                         Q ${x} ${y + r * 0.88} ${x + r * 0.25} ${y + r * 0.6}
                         Q ${x + r * 0.55} ${y + r * 0.82} ${x + r - 3} ${y + r * 0.55}
                         Q ${x + r * 0.4} ${y + r * 0.38} ${x} ${y + r * 0.4}
                         Q ${x - r * 0.4} ${y + r * 0.38} ${x - r + 3} ${y + r * 0.55} Z`}
                      fill={scoop.color}
                      opacity="0.95"
                    />
                  </g>
                );
              })}

              {/* -------------------- 3. BARQUILLO PIRULÍN DECORATIVO ARTESANAL -------------------- */}
              {selectedScoops.length >= 1 && (
                <g transform="translate(195, 110) rotate(26)" filter="url(#artisanDropShadow)">
                  {/* Tubo de barquillo crujiente */}
                  <rect x="0" y="0" width="11" height="78" rx="5" fill="url(#waferGrad)" stroke="#874312" strokeWidth="0.8" />
                  {/* Espirales de chocolate */}
                  <g stroke="#3a1608" strokeWidth="2" opacity="0.75" strokeLinecap="round">
                    <line x1="1" y1="12" x2="10" y2="18" />
                    <line x1="1" y1="26" x2="10" y2="32" />
                    <line x1="1" y1="40" x2="10" y2="46" />
                    <line x1="1" y1="54" x2="10" y2="60" />
                    <line x1="1" y1="68" x2="10" y2="74" />
                  </g>
                  <circle cx="5.5" cy="5" r="4.2" fill="#240c04" />
                </g>
              )}

              {/* -------------------- 4. SALSA Y JARABE EN CASCADA -------------------- */}
              {renderSyrupFlowSVG()}

              {/* -------------------- 5. TOPPINGS SÓLIDOS -------------------- */}
              {renderToppingsSVG()}
            </svg>
          </div>

          {/* TARJETA COMPACTA: RESUMEN DE TU RECETA */}
          <div style={{
            background: 'white',
            borderRadius: '18px',
            border: '1px solid var(--border-color)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
            padding: '14px 16px'
          }}>
            <strong style={{ fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-dark)', marginBottom: '10px' }}>
              <span>📝</span> Tu Creación Especial:
            </strong>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.78rem' }}>
              
              {/* Fila Envase */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-light)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>🍦</span> Envase:
                </span>
                <strong style={{ color: 'var(--text-dark)' }}>
                  {selectedBase.name} {selectedBase.price > 0 && `(+S/. ${selectedBase.price.toFixed(2)})`}
                </strong>
              </div>

              {/* Fila Sabores */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-light)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>🍨</span> Sabores ({selectedScoops.length}/5):
                  </span>
                  {selectedScoops.length === 0 && (
                    <span style={{ color: 'var(--danger)', fontWeight: 'bold', fontSize: '0.72rem' }}>¡Elige al menos 1!</span>
                  )}
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '2px' }}>
                  {selectedScoops.map((scoop, idx) => (
                    <span
                      key={`sum-${idx}`}
                      onClick={() => handleRemoveScoop(idx)}
                      title="Clic para quitar"
                      style={{
                        background: scoop.color,
                        color: scoop.id === 'coco' || scoop.id === 'vainilla' ? '#333' : 'white',
                        padding: '2px 8px',
                        borderRadius: '10px',
                        fontSize: '0.68rem',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        border: '1px solid rgba(0,0,0,0.1)'
                      }}
                    >
                      {scoop.name} <span style={{ opacity: 0.8 }}>✕</span>
                    </span>
                  ))}
                </div>
              </div>

              {/* Fila Extras */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                <span style={{ color: 'var(--text-light)', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
                  <span>🍬</span> Extras:
                </span>
                <span style={{ color: 'var(--text-dark)', fontWeight: 600, textAlign: 'right', fontSize: '0.74rem' }}>
                  {[
                    ...selectedToppings.map(t => t.name),
                    selectedSyrup ? selectedSyrup.name : null
                  ].filter(Boolean).join(', ') || 'Sin extras seleccionados'}
                </span>
              </div>

            </div>
          </div>

        </div>

        {/* 2. COLUMNA DE OPCIONES Y CONFIGURACIÓN (DERECHA) */}
        <div style={{
          background: 'white',
          borderRadius: '24px',
          border: '1px solid var(--border-color)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.03)',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>

          <div>
            {/* STEPPER HORIZONTAL MODERNO */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '22px' }}>
              <button
                type="button"
                className={`step-pill-btn ${customTab === 'base' ? 'active' : 'completed'}`}
                onClick={() => setCustomTab('base')}
              >
                <span>{customTab !== 'base' ? '✓' : '1.'}</span>
                <span>Envase</span>
              </button>

              <button
                type="button"
                className={`step-pill-btn ${customTab === 'scoops' ? 'active' : selectedScoops.length > 0 ? 'completed' : ''}`}
                onClick={() => setCustomTab('scoops')}
              >
                <span>{selectedScoops.length > 0 && customTab !== 'scoops' ? '✓' : '2.'}</span>
                <span>Sabores ({selectedScoops.length}/5)</span>
              </button>

              <button
                type="button"
                className={`step-pill-btn ${customTab === 'toppings' ? 'active' : (selectedToppings.length > 0 || selectedSyrup) ? 'completed' : ''}`}
                onClick={() => setCustomTab('toppings')}
              >
                <span>{(selectedToppings.length > 0 || selectedSyrup) && customTab !== 'toppings' ? '✓' : '3.'}</span>
                <span>Extras</span>
              </button>
            </div>

            {/* ÁREA DE CONTENIDO DE PESTAÑAS (CON ALTURA MÍNIMA PARA EVITAR SALTOS) */}
            <div style={{ minHeight: '380px' }}>

              {/* PESTAÑA 1: ENVASES */}
              {customTab === 'base' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{
                    background: 'rgba(255, 107, 129, 0.05)',
                    padding: '10px 14px',
                    borderRadius: '12px',
                    fontSize: '0.8rem',
                    color: 'var(--primary-color)',
                    fontWeight: '600'
                  }}>
                    🍦 Paso 1: Selecciona la base para tu helado
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '12px' }}>
                    {activeBases.map(base => {
                      const isSelected = selectedBase.id === base.id;
                      return (
                        <button
                          key={base.id}
                          type="button"
                          onClick={() => {
                            setSelectedBase(base);
                            setCustomTab('scoops');
                          }}
                          style={{
                            padding: '16px 12px',
                            borderRadius: '18px',
                            border: isSelected ? '2px solid var(--primary-color)' : '1px solid var(--border-color)',
                            background: isSelected ? 'rgba(255, 107, 129, 0.05)' : 'white',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '8px',
                            position: 'relative',
                            transition: 'all 0.2s ease',
                            boxShadow: isSelected ? '0 4px 14px rgba(255, 107, 129, 0.15)' : 'var(--shadow-sm)'
                          }}
                        >
                          {isSelected && (
                            <span style={{
                              position: 'absolute',
                              top: '8px',
                              right: '8px',
                              background: 'var(--primary-color)',
                              color: 'white',
                              width: '18px',
                              height: '18px',
                              borderRadius: '50%',
                              fontSize: '0.65rem',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 'bold'
                            }}>✓</span>
                          )}

                          {base.image ? (
                            <img src={base.image} alt={base.name} style={{ width: '48px', height: '48px', objectFit: 'contain' }} />
                          ) : (
                            <span style={{ fontSize: '2.4rem', lineHeight: '1' }}>{base.icon || '🍨'}</span>
                          )}

                          <strong style={{ fontSize: '0.88rem', color: 'var(--text-dark)' }}>{base.name}</strong>
                          <span style={{ fontSize: '0.78rem', color: 'var(--primary-color)', fontWeight: 'bold' }}>
                            {base.price === 0 ? 'Gratis' : `+ S/. ${base.price.toFixed(2)}`}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* PESTAÑA 2: SABORES */}
              {customTab === 'scoops' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  
                  {/* Barra de progreso y slots de bolas */}
                  <div style={{
                    background: 'rgba(255, 107, 129, 0.05)',
                    padding: '10px 14px',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '10px'
                  }}>
                    <div>
                      <div style={{ fontSize: '0.82rem', fontWeight: 'bold', color: 'var(--primary-color)' }}>
                        🍨 Paso 2: Añade tus sabores favoritos
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-light)' }}>
                        Puedes mezclar o repetir sabores (Máx. 5 bolas)
                      </div>
                    </div>

                    {/* Indicador visual de 5 slots de bolas */}
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      {[0, 1, 2, 3, 4].map(idx => {
                        const filled = selectedScoops[idx];
                        return (
                          <div
                            key={`slot-${idx}`}
                            onClick={() => filled && handleRemoveScoop(idx)}
                            title={filled ? `Quitar ${filled.name}` : 'Espacio disponible'}
                            style={{
                              width: '24px',
                              height: '24px',
                              borderRadius: '50%',
                              backgroundColor: filled ? filled.color : 'transparent',
                              border: filled ? '2px solid rgba(0,0,0,0.15)' : '2px dashed rgba(0,0,0,0.2)',
                              cursor: filled ? 'pointer' : 'default',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '0.65rem',
                              fontWeight: 'bold',
                              color: filled?.id === 'coco' || filled?.id === 'vainilla' ? '#333' : 'white',
                              transition: 'all 0.2s ease'
                            }}
                          >
                            {filled ? '✕' : '+'}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Parrilla de sabores uniforme (sin deformación de tamaño) */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(115px, 1fr))', gap: '10px' }}>
                    {activeFlavors.map(flavor => {
                      const count = selectedScoops.filter(s => s.id === flavor.id).length;
                      const isSelected = count > 0;

                      return (
                        <div
                          key={flavor.id}
                          className={`flavor-item-card ${isSelected ? 'is-active' : ''}`}
                        >
                          {/* Punto de color con efecto brillante */}
                          <div style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '50%',
                            backgroundColor: flavor.color,
                            border: '2px solid rgba(0,0,0,0.1)',
                            boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
                            position: 'relative'
                          }}>
                            <div style={{
                              position: 'absolute',
                              top: '3px',
                              left: '4px',
                              width: '8px',
                              height: '6px',
                              borderRadius: '50%',
                              backgroundColor: 'rgba(255,255,255,0.6)'
                            }} />
                          </div>

                          <div style={{ textAlign: 'center', width: '100%' }}>
                            <strong style={{ fontSize: '0.8rem', color: 'var(--text-dark)', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {flavor.name}
                            </strong>
                            <span style={{ fontSize: '0.72rem', color: 'var(--primary-color)', fontWeight: 600 }}>
                              S/. {flavor.price.toFixed(2)}
                            </span>
                          </div>

                          {/* Control inferior fijo: no cambia de tamaño */}
                          <div style={{ width: '100%', height: '30px', display: 'flex', alignItems: 'center' }}>
                            {count === 0 ? (
                              <button
                                type="button"
                                disabled={selectedScoops.length >= 5}
                                onClick={() => handleAddScoop(flavor)}
                                style={{
                                  width: '100%',
                                  height: '100%',
                                  borderRadius: '10px',
                                  border: '1px solid rgba(255, 107, 129, 0.25)',
                                  background: 'rgba(255, 107, 129, 0.06)',
                                  color: 'var(--primary-color)',
                                  fontSize: '0.74rem',
                                  fontWeight: 'bold',
                                  cursor: selectedScoops.length >= 5 ? 'not-allowed' : 'pointer',
                                  opacity: selectedScoops.length >= 5 ? 0.5 : 1,
                                  transition: 'all 0.2s ease'
                                }}
                              >
                                + Añadir
                              </button>
                            ) : (
                              <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                width: '100%',
                                height: '100%',
                                background: 'white',
                                border: '1px solid var(--primary-color)',
                                borderRadius: '10px',
                                padding: '2px'
                              }}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const idx = selectedScoops.findIndex(s => s.id === flavor.id);
                                    if (idx >= 0) handleRemoveScoop(idx);
                                  }}
                                  style={{
                                    width: '24px',
                                    height: '24px',
                                    borderRadius: '6px',
                                    border: 'none',
                                    background: 'rgba(231, 76, 60, 0.1)',
                                    color: '#e74c3c',
                                    fontWeight: 'bold',
                                    fontSize: '0.9rem',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                  }}
                                >
                                  -
                                </button>
                                <span style={{ fontSize: '0.82rem', fontWeight: 'bold', color: 'var(--text-dark)' }}>
                                  {count}
                                </span>
                                <button
                                  type="button"
                                  disabled={selectedScoops.length >= 5}
                                  onClick={() => handleAddScoop(flavor)}
                                  style={{
                                    width: '24px',
                                    height: '24px',
                                    borderRadius: '6px',
                                    border: 'none',
                                    background: 'var(--primary-color)',
                                    color: 'white',
                                    fontWeight: 'bold',
                                    fontSize: '0.9rem',
                                    cursor: selectedScoops.length >= 5 ? 'not-allowed' : 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    opacity: selectedScoops.length >= 5 ? 0.4 : 1
                                  }}
                                >
                                  +
                                </button>
                              </div>
                            )}
                          </div>

                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* PESTAÑA 3: TOPPINGS Y SALSAS */}
              {customTab === 'toppings' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  
                  <div style={{
                    background: 'rgba(255, 107, 129, 0.05)',
                    padding: '10px 14px',
                    borderRadius: '12px',
                    fontSize: '0.8rem',
                    color: 'var(--primary-color)',
                    fontWeight: '600'
                  }}>
                    🍬 Paso 3: Agrega toppings crujientes y salsas artesanales
                  </div>

                  {/* Sección Toppings Sólidos */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <strong style={{ fontSize: '0.82rem', color: 'var(--text-dark)' }}>
                        🍬 Toppings Crujientes (Opcional):
                      </strong>
                      {selectedToppings.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setSelectedToppings([])}
                          style={{ background: 'none', border: 'none', color: 'var(--text-light)', fontSize: '0.72rem', cursor: 'pointer', textDecoration: 'underline' }}
                        >
                          Limpiar selección
                        </button>
                      )}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => setSelectedToppings([])}
                        style={{
                          padding: '10px 8px',
                          borderRadius: '14px',
                          border: selectedToppings.length === 0 ? '2px solid var(--primary-color)' : '1px solid var(--border-color)',
                          background: selectedToppings.length === 0 ? 'rgba(255, 107, 129, 0.05)' : 'white',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <span style={{ fontSize: '1.4rem' }}>🚫</span>
                        <strong style={{ fontSize: '0.75rem', color: 'var(--text-dark)' }}>Sin Toppings</strong>
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-light)' }}>Gratis</span>
                      </button>

                      {activeSolidToppings.map(topping => {
                        const isSelected = selectedToppings.some(t => t.id === topping.id);
                        return (
                          <button
                            key={topping.id}
                            type="button"
                            onClick={() => handleToggleTopping(topping)}
                            style={{
                              padding: '10px 8px',
                              borderRadius: '14px',
                              border: isSelected ? '2px solid var(--primary-color)' : '1px solid var(--border-color)',
                              background: isSelected ? 'rgba(255, 107, 129, 0.05)' : 'white',
                              cursor: 'pointer',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              gap: '4px',
                              position: 'relative'
                            }}
                          >
                            {isSelected && (
                              <span style={{
                                position: 'absolute',
                                top: '4px',
                                right: '4px',
                                background: 'var(--primary-color)',
                                color: 'white',
                                width: '15px',
                                height: '15px',
                                borderRadius: '50%',
                                fontSize: '0.58rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 'bold'
                              }}>✓</span>
                            )}
                            {topping.image ? (
                              <img src={topping.image} alt={topping.name} style={{ width: '28px', height: '28px', objectFit: 'contain' }} />
                            ) : (
                              <span style={{ fontSize: '1.4rem' }}>🍬</span>
                            )}
                            <strong style={{ fontSize: '0.75rem', color: 'var(--text-dark)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
                              {topping.name}
                            </strong>
                            <span style={{ fontSize: '0.68rem', color: 'var(--primary-color)', fontWeight: 'bold' }}>
                              + S/. {topping.price.toFixed(2)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Sección Salsas y Jarabes */}
                  <div>
                    <strong style={{ fontSize: '0.82rem', color: 'var(--text-dark)', display: 'block', marginBottom: '8px' }}>
                      🍫 Salsas & Baños Artesanales:
                    </strong>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => setSelectedSyrup(null)}
                        style={{
                          padding: '10px 8px',
                          borderRadius: '14px',
                          border: selectedSyrup === null ? '2px solid var(--primary-color)' : '1px solid var(--border-color)',
                          background: selectedSyrup === null ? 'rgba(255, 107, 129, 0.05)' : 'white',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <span style={{ fontSize: '1.4rem' }}>🚫</span>
                        <strong style={{ fontSize: '0.75rem', color: 'var(--text-dark)' }}>Sin Salsa</strong>
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-light)' }}>Gratis</span>
                      </button>

                      {activeLiquidToppings.map(syrup => {
                        const isSelected = selectedSyrup?.id === syrup.id || (syrup.id === 'fresa_sauce' && selectedSyrup?.id === 'fresa');
                        const icon = syrup.id.includes('fudge') ? '🍫' : (syrup.id.includes('fresa') ? '🍓' : '🍯');

                        return (
                          <button
                            key={syrup.id}
                            type="button"
                            onClick={() => handleToggleSyrup({ id: syrup.id, name: syrup.name, price: syrup.price })}
                            style={{
                              padding: '10px 8px',
                              borderRadius: '14px',
                              border: isSelected ? '2px solid var(--primary-color)' : '1px solid var(--border-color)',
                              background: isSelected ? 'rgba(255, 107, 129, 0.05)' : 'white',
                              cursor: 'pointer',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              gap: '4px',
                              position: 'relative'
                            }}
                          >
                            {isSelected && (
                              <span style={{
                                position: 'absolute',
                                top: '4px',
                                right: '4px',
                                background: 'var(--primary-color)',
                                color: 'white',
                                width: '15px',
                                height: '15px',
                                borderRadius: '50%',
                                fontSize: '0.58rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 'bold'
                              }}>✓</span>
                            )}
                            {syrup.image ? (
                              <img src={syrup.image} alt={syrup.name} style={{ width: '28px', height: '28px', objectFit: 'contain' }} />
                            ) : (
                              <span style={{ fontSize: '1.4rem' }}>{icon}</span>
                            )}
                            <strong style={{ fontSize: '0.75rem', color: 'var(--text-dark)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
                              {syrup.name}
                            </strong>
                            <span style={{ fontSize: '0.68rem', color: 'var(--primary-color)', fontWeight: 'bold' }}>
                              + S/. {syrup.price.toFixed(2)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                </div>
              )}

            </div>
          </div>

          {/* NAVEGACIÓN ENTRE PASOS Y BARRA DE CONVERSIÓN DE CARRITO */}
          <div style={{ marginTop: '20px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
            
            {/* Botones de flujo */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              {customTab !== 'base' ? (
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: '8px 14px', fontSize: '0.8rem', borderRadius: '12px', fontWeight: 600 }}
                  onClick={() => setCustomTab(customTab === 'toppings' ? 'scoops' : 'base')}
                >
                  ← Paso Anterior
                </button>
              ) : <div />}

              {customTab !== 'toppings' && (
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{
                    padding: '8px 18px',
                    fontSize: '0.82rem',
                    borderRadius: '12px',
                    fontWeight: 'bold',
                    background: 'var(--secondary-color)',
                    borderColor: 'var(--secondary-color)'
                  }}
                  onClick={() => setCustomTab(customTab === 'base' ? 'scoops' : 'toppings')}
                >
                  Siguiente Paso →
                </button>
              )}
            </div>

            {/* Tarjeta de checkout del personalizador */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(255, 107, 129, 0.08) 0%, rgba(229, 142, 38, 0.08) 100%)',
              borderRadius: '18px',
              border: '1px solid rgba(255, 107, 129, 0.2)',
              padding: '14px 18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px'
            }}>
              <div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-light)', fontWeight: 600 }}>Total de tu Combinación:</span>
                <div style={{ fontSize: '1.6rem', color: 'var(--text-dark)', fontWeight: 'bold', lineHeight: '1.2' }}>
                  S/. {totalPrice.toFixed(2)}
                </div>
              </div>

              <button
                type="button"
                className="btn btn-primary"
                disabled={selectedScoops.length === 0 || isAdding}
                onClick={handleAddCustomToCart}
                style={{
                  padding: '12px 24px',
                  fontSize: '0.92rem',
                  fontWeight: 'bold',
                  background: 'linear-gradient(135deg, var(--primary-color) 0%, var(--secondary-color) 100%)',
                  boxShadow: '0 6px 18px rgba(255, 107, 129, 0.35)',
                  cursor: selectedScoops.length === 0 ? 'not-allowed' : 'pointer',
                  border: 'none',
                  borderRadius: '14px',
                  opacity: selectedScoops.length === 0 ? 0.6 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <span>🛒</span>
                <span>{isAdding ? 'Agregando...' : '¡Agregar al Carrito!'}</span>
              </button>
            </div>

            <div style={{ textAlign: 'center', marginTop: '10px', fontSize: '0.7rem', color: 'var(--text-light)' }}>
              ✨ Preparado al momento con ingredientes 100% artesanales y fruta fresca
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
