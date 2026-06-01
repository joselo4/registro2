import React, { useState } from 'react';

// Coordenadas y estilos para decoraciones en SVG
const CHISPAS_OFFSETS = [
  { dx: -15, dy: -12, angle: 15, color: '#ff4757' },
  { dx: 15, dy: -10, angle: -30, color: '#ffa502' },
  { dx: 0, dy: -18, angle: 45, color: '#2ed573' },
  { dx: -20, dy: 5, angle: -10, color: '#1e90ff' },
  { dx: 20, dy: 2, angle: 25, color: '#ff6b81' },
  { dx: -5, dy: -5, angle: 80, color: '#f1c40f' },
  { dx: 8, dy: -22, angle: -45, color: '#9b59b6' },
  { dx: -12, dy: -20, angle: 60, color: '#2ecc71' }
];

const OREO_OFFSETS = [
  { dx: -12, dy: -15, r: 3 },
  { dx: 14, dy: -8, r: 2.5 },
  { dx: -2, dy: -18, r: 4 },
  { dx: -14, dy: 2, r: 2 },
  { dx: 12, dy: 0, r: 3 },
  { dx: -6, dy: -6, r: 3.5 },
  { dx: 6, dy: -12, r: 2 }
];

const MANI_OFFSETS = [
  { dx: -12, dy: -12, rx: 4, ry: 2, angle: 20 },
  { dx: 14, dy: -15, rx: 3, ry: 1.5, angle: -40 },
  { dx: 2, dy: -16, rx: 4, ry: 2, angle: 70 },
  { dx: -14, dy: 0, rx: 3, ry: 1.8, angle: -10 },
  { dx: 12, dy: 5, rx: 4, ry: 2, angle: 45 }
];

const GOMITA_OFFSETS = [
  { dx: -10, dy: -8, color: '#2ed573' },
  { dx: 10, dy: -10, color: '#ff4757' },
  { dx: 0, dy: -15, color: '#ffa502' }
];

export default function IceCreamCustomizer({ bases, flavors, toppings, onAddToCart, setView, recommendations = [], showAlert }) {
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
  const activeToppings = toppings.filter(t => t.active !== false && t.category === 'solido');

  // --- NUEVO: Cargar con cono + 1 bola + toppings por defecto ---
  const [selectedBase, setSelectedBase] = useState(() => activeBases.find(b => b.id === 'cono') || activeBases[0] || bases[0]); // Cono por defecto
  
  const [selectedScoops, setSelectedScoops] = useState(() => {
    // Sabor inicial por defecto lúcuma (si está activo) o el primero de la lista
    const defaultFlavor = activeFlavors.find(f => f.id === 'lucuma') || activeFlavors[0];
    return defaultFlavor ? [defaultFlavor] : [];
  });

  const [selectedToppings, setSelectedToppings] = useState(() => {
    // Topping de chispas por defecto
    const defaultTopping = activeToppings.find(t => t.id === 'chispas');
    return defaultTopping ? [defaultTopping] : [];
  });

  const [selectedSyrup, setSelectedSyrup] = useState(null); // Jarabe inicial nulo
  const [customTab, setCustomTab] = useState('base'); 

  const handleAddScoop = (flavor) => {
    if (selectedScoops.length >= 5) {
      alert("¡El límite es de 5 bolas de helado!");
      return;
    }
    setSelectedScoops([...selectedScoops, flavor]);
  };

  const handleRemoveScoop = (index) => {
    const newScoops = [...selectedScoops];
    newScoops.splice(index, 1);
    setSelectedScoops(newScoops);
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

  // Calcular precio
  const basePrice = selectedBase.price;
  const scoopsPrice = selectedScoops.reduce((sum, s) => sum + s.price, 0);
  const toppingsPrice = selectedToppings.reduce((sum, t) => sum + t.price, 0);
  const syrupPrice = selectedSyrup ? selectedSyrup.price : 0;
  const totalPrice = basePrice + scoopsPrice + toppingsPrice + syrupPrice;

  // Determinar coordenadas de apilamiento según cantidad de bolas (soporta hasta 30 de forma dinámica)
  const getScoopCoords = () => {
    const count = selectedScoops.length;
    if (count === 0) return [];
    
    const coords = [];
    // Spacing y radio dinámicos para que las bolas queden apiladas en el contenedor SVG sin desbordar
    const spacing = count > 3 ? Math.max(6, 32 - (count * 0.6)) : 35;
    const baseRadius = count > 5 ? Math.max(16, 38 - (count * 0.5)) : 38;
    
    for (let i = 0; i < count; i++) {
      const y = 150 - (i * spacing);
      const r = Math.max(12, baseRadius - (i * 0.35));
      coords.push({ y, r });
    }
    return coords;
  };

  const scoopCoords = getScoopCoords();

  // --- NUEVO: Aplicar combinaciones recomendadas dinámicamente ---
  const applyPresetRecommendation = (rec) => {
    // Encontrar base
    const baseObj = bases.find(b => b.id === rec.baseId) || bases[0];
    
    // Encontrar sabores
    const scoopsList = [];
    if (rec.flavorIds) {
      rec.flavorIds.forEach(fid => {
        const flavorObj = flavors.find(f => f.id === fid);
        if (flavorObj) scoopsList.push(flavorObj);
      });
    }

    // Encontrar toppings
    const toppingsList = [];
    if (rec.toppingIds) {
      rec.toppingIds.forEach(tid => {
        const toppingObj = toppings.find(t => t.id === tid);
        if (toppingObj) toppingsList.push(toppingObj);
      });
    }

    // Encontrar jarabe (syrup)
    let syrupObj = null;
    if (rec.syrupId) {
      if (rec.syrupId === 'fudge') syrupObj = { id: 'fudge', name: 'Fudge de Chocolate', price: 0.50 };
      else if (rec.syrupId === 'fresa') syrupObj = { id: 'fresa', name: 'Salsa de Fresa', price: 0.50 };
      else if (rec.syrupId === 'manjar') syrupObj = { id: 'manjar', name: 'Manjar Blanco', price: 0.50 };
    }

    setSelectedBase(baseObj);
    setSelectedScoops(scoopsList);
    setSelectedToppings(toppingsList);
    setSelectedSyrup(syrupObj);
    alert(`¡Se cargó la recomendación: ${rec.name}!`);
  };

  const handleAddCustomToCart = () => {
    if (selectedScoops.length === 0) {
      alert("Por favor, añade al menos una bola de helado.");
      return;
    }

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

  // --- MODIFICADO: Renderizar jarabes en todas las bolas seleccionadas ---
  const renderSyrupsSVG = () => {
    if (!selectedSyrup) return null;
    
    return scoopCoords.map((coord, idx) => {
      const { y, r } = coord;
      let color = '#3d1d11'; // fudge
      if (selectedSyrup.id === 'fresa') color = '#e84118';
      if (selectedSyrup.id === 'manjar') color = '#e67e22';

      const pathD = `M ${100 - r + 3} ${y + 5} 
                     C ${100 - r} ${y - r - 3} ${100 + r} ${y - r - 3} ${100 + r - 3} ${y + 5} 
                     C ${100 + r - 8} ${y + 12} ${100 + r - 15} ${y + 2} ${100 + r - 22} ${y + 10} 
                     C ${100 + r - 29} ${y} ${100 + r - 38} ${y + 15} ${100 + r - 45} ${y + 4} 
                     C ${100 + r - 52} ${y - 2} ${100 - r + 12} ${y + 12} ${100 - r + 3} ${y + 5} Z`;

      return <path key={idx} d={pathD} fill={color} filter="url(#shadow)" />;
    });
  };

  return (
    <div className="customizer-section">
      <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.85rem' }} onClick={() => setView('shop')}>
          ← Tienda
        </button>
        <h2 style={{ fontSize: '1.4rem' }}>Arma tu Combinación</h2>
      </div>

      {/* 🌟 NUEVO: COMBINACIONES RECOMENDADAS (AUMENTO DE VENTAS RÁPIDAS) */}
      <div className="glass" style={{ padding: '10px 15px', marginBottom: '15px', background: 'linear-gradient(135deg, rgba(255, 107, 129, 0.08) 0%, rgba(229, 142, 38, 0.08) 100%)', borderRadius: 'var(--radius-md)' }}>
        <strong style={{ fontSize: '0.8rem', display: 'block', marginBottom: '6px' }}>✨ Combinaciones Recomendadas:</strong>
        <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px' }}>
          {recommendations.length === 0 ? (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-light)', padding: '4px 0' }}>No hay combinaciones recomendadas creadas.</span>
          ) : (
            recommendations.map(rec => (
              <button 
                key={rec.id}
                className="filter-btn" 
                style={{ padding: '6px 10px', fontSize: '0.75rem', flex: '0 0 auto' }}
                onClick={() => applyPresetRecommendation(rec)}
              >
                {rec.name}
              </button>
            ))
          )}
        </div>
      </div>

      <div className="glass customizer-container" style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        
        {/* VISTA PREVIA (Fija y Responsiva) */}
        <div className="customizer-preview" style={{ padding: '10px', background: 'radial-gradient(circle, var(--bg-secondary) 0%, var(--bg-primary) 100%)', minHeight: '260px' }}>
          <style dangerouslySetInnerHTML={{ __html: `
            @keyframes drop-scoop-generic {
              0% { transform: translateY(-160px) scaleY(1.3); opacity: 0; }
              60% { transform: translateY(8px) scaleY(0.85); }
              80% { transform: translateY(-4px) scaleY(1.05); }
              100% { transform: translateY(0px) scaleY(1); opacity: 1; }
            }
          ` }} />
          
          <svg viewBox="0 0 200 280" style={{ width: '100%', maxHeight: '240px', display: 'block' }}>
            <defs>
              <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="3" stdDeviation="3" floodOpacity="0.15" />
              </filter>
              <radialGradient id="customizer-specular" cx="30%" cy="30%" r="60%" fx="30%" fy="30%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.8"/>
                <stop offset="50%" stopColor="#ffffff" stopOpacity="0.2"/>
                <stop offset="100%" stopColor="#ffffff" stopOpacity="0"/>
              </radialGradient>
              <radialGradient id="customizer-shadow" cx="75%" cy="75%" r="75%">
                <stop offset="0%" stopColor="#000000" stopOpacity="0.35"/>
                <stop offset="100%" stopColor="#000000" stopOpacity="0"/>
              </radialGradient>
            </defs>

            {/* Bases */}
            {selectedBase.id === 'cono' && (
              <g filter="url(#shadow)">
                <path d="M 70 160 L 100 270 L 130 160 Z" fill="#e58e26" stroke="#c07d1e" strokeWidth="2.5" />
                <path d="M 70 160 L 100 270 M 80 160 L 100 270 M 90 160 L 100 270 M 110 160 L 100 270 M 120 160 L 100 270" stroke="#d38321" strokeWidth="1" opacity="0.6" />
                <path d="M 70 180 L 125 180 M 75 200 L 120 200 M 81 220 L 114 220 M 87 240 L 108 240" stroke="#d38321" strokeWidth="1" opacity="0.6" />
                <ellipse cx="100" cy="160" rx="30" ry="6" fill="#e58e26" stroke="#c07d1e" strokeWidth="2" />
              </g>
            )}

            {selectedBase.id === 'vaso' && (
              <g filter="url(#shadow)">
                <path d="M 62 170 L 72 250 L 128 250 L 138 170 Z" fill="#ffccd5" stroke="#ff8ca3" strokeWidth="2.5" />
                <path d="M 58 165 H 142 V 173 H 58 Z" fill="#ff8ca3" rx="2" />
                <circle cx="100" cy="210" r="14" fill="white" opacity="0.8" />
                <text x="100" y="215" fill="var(--primary-color)" fontSize="14" fontWeight="bold" textAnchor="middle">🍧</text>
              </g>
            )}

            {selectedBase.id === 'waffle' && (
              <g filter="url(#shadow)">
                <path d="M 45 170 C 45 170 55 250 100 258 C 145 250 155 170 155 170 C 155 170 125 190 100 190 C 75 190 45 170 45 170 Z" fill="#d4a373" stroke="#b0845a" strokeWidth="2.5" />
                <path d="M 50 176 L 150 176 M 55 188 L 145 188 M 65 202 L 135 202 M 72 220 L 128 220" stroke="#b0845a" strokeWidth="1.2" opacity="0.5" />
              </g>
            )}

            {selectedBase.id !== 'cono' && selectedBase.id !== 'vaso' && selectedBase.id !== 'waffle' && (
              <g filter="url(#shadow)">
                {selectedBase.image && selectedBase.image.trim() !== '' ? (
                  <>
                    {/* Fondo blanco sólido para que la imagen con fondo transparente no quede flotando ni transparente */}
                    <ellipse cx="100" cy="205" rx="42" ry="52" fill="#ffffff" opacity="0.98" />
                    <image href={selectedBase.image} x="55" y="150" width="90" height="110" preserveAspectRatio="xMidYMid meet" />
                  </>
                ) : (
                  <g>
                    <path d="M 62 170 L 72 250 L 128 250 L 138 170 Z" fill="#e0f7fa" stroke="#00acc1" strokeWidth="2.5" />
                    <path d="M 58 165 H 142 V 173 H 58 Z" fill="#00acc1" rx="2" />
                    <circle cx="100" cy="210" r="18" fill="white" opacity="0.9" />
                    <text x="100" y="216" fontSize="18" textAnchor="middle">{selectedBase.icon || '🍨'}</text>
                  </g>
                )}
              </g>
            )}

            {/* Bolas de Helado */}
            {selectedScoops.map((scoop, idx) => {
              const { y, r } = scoopCoords[idx];
              return (
                <g key={idx} filter="url(#shadow)" style={{ animation: 'drop-scoop-generic 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards', transformOrigin: '100px ' + y + 'px' }}>
                  <circle cx="100" cy={y} r={r} fill={scoop.color} />
                  <circle cx="100" cy={y} r={r} fill="url(#customizer-shadow)" />
                  <circle cx="100" cy={y} r={r} fill="url(#customizer-specular)" />
                  <ellipse cx={100 - r/3} cy={y - r/3} rx={r/2.5} ry={r/5} fill="white" opacity="0.15" transform={`rotate(-15, ${100 - r/3}, ${y - r/3})`} />
                  <path d={`M ${100 - r} ${y + 5} Q ${100 - r/2} ${y + r - 3} 100 ${y + 5} Q ${100 + r/2} ${y + r - 3} ${100 + r} ${y + 5} Q ${100} ${y + r + 2} ${100 - r} ${y + 5}`} fill={scoop.color} opacity="0.9" />
                  <path d={`M ${100 - r} ${y + 5} Q ${100 - r/2} ${y + r - 3} 100 ${y + 5} Q ${100 + r/2} ${y + r - 3} ${100 + r} ${y + 5} Q ${100} ${y + r + 2} ${100 - r} ${y + 5}`} fill="url(#customizer-shadow)" opacity="0.3" />
                </g>
              );
            })}

            {/* MODIFICADO: Jarabes en cada una de las bolas de helado seleccionadas */}
            {renderSyrupsSVG()}

            {/* MODIFICADO: Toppings Sólidos esparcidos en cada una de las bolas seleccionadas */}
            {selectedToppings.map(topping => {
              return scoopCoords.map((coord, scoopIdx) => {
                const { y } = coord;

                if (topping.id === 'chispas') {
                  return CHISPAS_OFFSETS.map((o, idx) => (
                    <rect
                      key={`${scoopIdx}-${topping.id}-${idx}`}
                      x={100 + o.dx}
                      y={y + o.dy}
                      width="5"
                      height="2"
                      rx="0.8"
                      fill={o.color}
                      transform={`rotate(${o.angle}, ${100 + o.dx}, ${y + o.dy})`}
                    />
                  ));
                }

                if (topping.id === 'oreo') {
                  return OREO_OFFSETS.map((o, idx) => (
                    <circle
                      key={`${scoopIdx}-${topping.id}-${idx}`}
                      cx={100 + o.dx}
                      cy={y + o.dy}
                      r={o.r}
                      fill="#2f3542"
                      stroke="#1e222b"
                      strokeWidth="0.5"
                    />
                  ));
                }

                if (topping.id === 'mani') {
                  return MANI_OFFSETS.map((o, idx) => (
                    <ellipse
                      key={`${scoopIdx}-${topping.id}-${idx}`}
                      cx={100 + o.dx}
                      cy={y + o.dy}
                      rx={o.rx}
                      ry={o.ry}
                      fill="#d4a373"
                      stroke="#b0845a"
                      strokeWidth="0.5"
                      transform={`rotate(${o.angle}, ${100 + o.dx}, ${y + o.dy})`}
                    />
                  ));
                }

                if (topping.id === 'gomitas') {
                  return GOMITA_OFFSETS.map((o, idx) => (
                    <g key={`${scoopIdx}-${topping.id}-${idx}`}>
                      <rect x={100 + o.dx - 3} y={y + o.dy - 5} width="6" height="10" rx="2" fill={o.color} opacity="0.85" />
                      <circle cx={100 + o.dx - 2} cy={y + o.dy - 5} r="1.5" fill={o.color} opacity="0.85" />
                      <circle cx={100 + o.dx + 2} cy={y + o.dy - 5} r="1.5" fill={o.color} opacity="0.85" />
                    </g>
                  ));
                }

                return null;
              });
            })}
          </svg>

          {/* Resumen */}
          <div style={{ marginTop: '5px', width: '100%', textAlign: 'center' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-light)', fontWeight: 600 }}>
              {selectedScoops.length === 0 
                ? "Agrega tu primera bola 👇" 
                : `${selectedScoops.length} bola${selectedScoops.length > 1 ? 's' : ''} en ${selectedBase.name}`
              }
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
              {selectedScoops.map((scoop, index) => (
                <span
                  key={index}
                  onClick={() => handleRemoveScoop(index)}
                  style={{
                    backgroundColor: scoop.color,
                    color: scoop.id === 'coco' || scoop.id === 'vainilla' ? '#333' : 'white',
                    padding: '2px 6px',
                    borderRadius: 'var(--radius-full)',
                    fontSize: '0.65rem',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                  title="Eliminar bola"
                >
                  {scoop.name.split(' ')[0]} ✕
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* CONTROLES (Menú por Pestañas para Móvil) */}
        <div className="customizer-options" style={{ padding: '15px' }}>
          
          {/* Selector de Pestañas */}
          <div className="catalog-filters" style={{ marginBottom: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
            <button 
              className={`filter-btn ${customTab === 'base' ? 'active' : ''}`}
              onClick={() => setCustomTab('base')}
              style={{ flex: 1, padding: '6px 2px', fontSize: '0.8rem' }}
            >
              🏢 1. Envase
            </button>
            <button 
              className={`filter-btn ${customTab === 'scoops' ? 'active' : ''}`}
              onClick={() => setCustomTab('scoops')}
              style={{ flex: 1, padding: '6px 2px', fontSize: '0.8rem' }}
            >
              🍧 2. Sabores
            </button>
            <button 
              className={`filter-btn ${customTab === 'toppings' ? 'active' : ''}`}
              onClick={() => setCustomTab('toppings')}
              style={{ flex: 1, padding: '6px 2px', fontSize: '0.8rem' }}
            >
              🍫 3. Toppings
            </button>
          </div>

          {/* Pestaña 1: Envases */}
          {customTab === 'base' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div className="option-grid">
                {activeBases.map(base => (
                  <button
                    key={base.id}
                    className={`option-btn ${selectedBase.id === base.id ? 'selected' : ''}`}
                    onClick={() => {
                      setSelectedBase(base);
                      setCustomTab('scoops'); 
                    }}
                    style={{ padding: '12px 6px' }}
                  >
                    {base.image ? (
                      <img src={base.image} alt={base.name} style={{ width: '38px', height: '38px', objectFit: 'contain', marginBottom: '4px' }} />
                    ) : (
                      <span style={{ fontSize: '1.8rem' }}>{base.icon}</span>
                    )}
                    <strong style={{ fontSize: '0.8rem' }}>{base.name}</strong>
                    <span style={{ fontSize: '0.7rem', color: 'var(--primary-color)', fontWeight: 'bold' }}>
                      {base.price === 0 ? 'Gratis' : `+ S/. ${base.price.toFixed(2)}`}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Pestaña 2: Sabores */}
          {customTab === 'scoops' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>
                  (Bolas tradicionales):
                </span>
                <strong style={{ fontSize: '0.8rem', color: 'var(--primary-color)' }}>
                  {selectedScoops.length} / 5 bolas
                </strong>
              </div>
              
              <div className="option-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '6px' }}>
                {activeFlavors.map(flavor => {
                  const count = selectedScoops.filter(s => s.id === flavor.id).length;
                  return (
                    <button
                      key={flavor.id}
                      className="option-btn"
                      onClick={() => handleAddScoop(flavor)}
                      disabled={selectedScoops.length >= 5}
                      style={{ position: 'relative', padding: '10px 4px' }}
                    >
                      {count > 0 && (
                        <span style={{
                          position: 'absolute',
                          top: '2px',
                          right: '2px',
                          background: 'var(--primary-color)',
                          color: 'white',
                          width: '16px',
                          height: '16px',
                          borderRadius: '50%',
                          fontSize: '0.65rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 'bold'
                        }}>
                          {count}
                        </span>
                      )}
                      <span className="color-dot" style={{ backgroundColor: flavor.color, width: '18px', height: '18px' }}></span>
                      <strong style={{ fontSize: '0.8rem' }}>{flavor.name}</strong>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-light)' }}>
                        S/. {flavor.price.toFixed(2)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Pestaña 3: Toppings */}
          {customTab === 'toppings' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-light)', marginBottom: '5px' }}>Toppings:</p>
                <div className="option-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '6px' }}>
                  {activeToppings.map(topping => {
                    const isSelected = selectedToppings.some(t => t.id === topping.id);
                    return (
                      <button
                        key={topping.id}
                        className={`option-btn ${isSelected ? 'selected' : ''}`}
                        onClick={() => handleToggleTopping(topping)}
                        style={{ padding: '8px 4px' }}
                      >
                        {topping.image ? (
                          <img src={topping.image} alt={topping.name} style={{ width: '22px', height: '22px', objectFit: 'contain', marginBottom: '2px' }} />
                        ) : (
                          <span style={{ fontSize: '1rem' }}>🍬</span>
                        )}
                        <strong style={{ fontSize: '0.75rem' }}>{topping.name}</strong>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-light)' }}>+ S/. {topping.price.toFixed(2)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-light)', marginBottom: '5px' }}>Jarabe / Salsa (S/. 0.50):</p>
                <div className="option-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '6px' }}>
                  {toppings.filter(t => t.category === 'liquido' && t.active !== false).map(syrup => {
                    const isSelected = selectedSyrup?.id === syrup.id || (syrup.id === 'fresa_sauce' && selectedSyrup?.id === 'fresa');
                    const icon = syrup.id === 'fudge' ? '🍫' : (syrup.id === 'fresa_sauce' || syrup.id === 'fresa' ? '🍓' : '🍯');
                    return (
                      <button
                        key={syrup.id}
                        className={`option-btn ${isSelected ? 'selected' : ''}`}
                        onClick={() => handleToggleSyrup({ id: syrup.id, name: syrup.name, price: syrup.price })}
                        style={{ padding: '8px' }}
                      >
                        {syrup.image ? (
                          <img src={syrup.image} alt={syrup.name} style={{ width: '22px', height: '22px', objectFit: 'contain', marginBottom: '2px' }} />
                        ) : (
                          <span style={{ fontSize: '1rem' }}>{icon}</span>
                        )}
                        <strong style={{ fontSize: '0.75rem' }}>{syrup.name.split(' ')[0]}</strong>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Barra de Costo y Checkout */}
          <div className="custom-price-bar" style={{ marginTop: '15px', padding: '10px' }}>
            <div>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-light)' }}>Total Helado:</span>
              <div className="price-tag" style={{ fontSize: '1.35rem', lineHeight: '1.2' }}>S/. {totalPrice.toFixed(2)}</div>
            </div>
            
            <div style={{ display: 'flex', gap: '6px' }}>
              {customTab !== 'toppings' ? (
                <button 
                  className="btn btn-secondary" 
                  style={{ padding: '6px 10px', fontSize: '0.8rem' }}
                  onClick={() => setCustomTab(customTab === 'base' ? 'scoops' : 'toppings')}
                >
                  Siguiente →
                </button>
              ) : null}
              
              <button
                className="btn btn-primary"
                disabled={selectedScoops.length === 0}
                onClick={handleAddCustomToCart}
                style={{ padding: '8px 14px', fontSize: '0.85rem' }}
              >
                🛒 Agregar
              </button>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
