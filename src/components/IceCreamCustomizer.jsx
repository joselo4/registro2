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

export default function IceCreamCustomizer({ bases, flavors, toppings, onAddToCart, setView, recommendations = [], showAlert, shopConfig }) {
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

  // Cargar con configuración guardada por el administrador o con valores por defecto
  const defaultCustomizer = shopConfig?.defaultCustomizer || {
    baseId: 'cono',
    flavorId: 'lucuma',
    toppingId: 'chispas',
    syrupId: 'fresa_sauce'
  };

  const [selectedBase, setSelectedBase] = useState(() => {
    const baseIdVal = defaultCustomizer.baseId || 'cono';
    return activeBases.find(b => b.id === baseIdVal) || activeBases[0] || bases[0];
  });
  
  const [selectedScoops, setSelectedScoops] = useState(() => {
    const flavorIdVal = defaultCustomizer.flavorId || 'lucuma';
    const defaultFlavor = activeFlavors.find(f => f.id === flavorIdVal) || activeFlavors[0];
    return defaultFlavor ? [defaultFlavor] : [];
  });

  const [selectedToppings, setSelectedToppings] = useState(() => {
    const toppingIdVal = defaultCustomizer.toppingId || 'chispas';
    if (toppingIdVal === 'none' || toppingIdVal === 'none_topping') return [];
    const defaultTopping = activeToppings.find(t => t.id === toppingIdVal);
    return defaultTopping ? [defaultTopping] : [];
  });

  const [selectedSyrup, setSelectedSyrup] = useState(() => {
    const syrupIdVal = defaultCustomizer.syrupId || 'fresa_sauce';
    if (syrupIdVal === 'none' || syrupIdVal === 'none_syrup') return null;
    const defaultSyrup = toppings.find(t => t.id === syrupIdVal);
    return defaultSyrup ? { id: defaultSyrup.id, name: defaultSyrup.name, price: defaultSyrup.price } : null;
  });
  const [isAdding, setIsAdding] = useState(false);
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

  // --- MODIFICADO: Renderizar jarabes en todas las bolas seleccionadas ---
  const renderSyrupsSVG = () => {
    if (!selectedSyrup) return null;
    
    return scoopCoords.map((coord, idx) => {
      const { y, r } = coord;
      let color = '#ffa502'; // default manjar (caramel color)
      const syrupId = String(selectedSyrup.id || '').toLowerCase();
      if (syrupId.includes('fudge') || syrupId.includes('choco')) {
        color = '#3d1d11'; // chocolate brown
      } else if (syrupId.includes('fresa') || syrupId.includes('sauce') || syrupId.includes('frutilla')) {
        color = '#e84118'; // bright strawberry red
      } else if (syrupId.includes('manjar') || syrupId.includes('caramel')) {
        color = '#e67e22'; // manjar orange/caramel
      }

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
      <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.85rem' }} onClick={() => setView('shop')}>
          ← Tienda
        </button>
        <h2 style={{ fontSize: '1.5rem', fontFamily: 'var(--font-title)' }}>Arma tu Combinación</h2>
      </div>

      {/* 🌟 COMBINACIONES RECOMENDADAS (AUMENTO DE VENTAS RÁPIDAS) */}
      <div className="glass" style={{ padding: '15px 20px', marginBottom: '20px', background: 'linear-gradient(135deg, rgba(255, 107, 129, 0.08) 0%, rgba(229, 142, 38, 0.08) 100%)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,107,129,0.15)' }}>
        <strong style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', color: 'var(--text-dark)' }}>
          ✨ Sugerencias del Maestro Heladero:
        </strong>
        <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '6px' }}>
          {recommendations.length === 0 ? (
            <span style={{ fontSize: '0.78rem', color: 'var(--text-light)', padding: '4px 0', fontStyle: 'italic' }}>No hay combinaciones recomendadas creadas.</span>
          ) : (
            recommendations.map(rec => (
              <button 
                key={rec.id}
                type="button"
                className="filter-btn" 
                style={{ 
                  padding: '8px 14px', 
                  fontSize: '0.78rem', 
                  fontWeight: 'bold', 
                  flex: '0 0 auto',
                  background: 'white',
                  border: '1px solid var(--border-color)',
                  borderRadius: '20px',
                  boxShadow: 'var(--shadow-sm)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onClick={() => applyPresetRecommendation(rec)}
              >
                <span>👑</span>
                <span>{rec.name}</span>
                <span style={{ fontSize: '0.65rem', background: 'rgba(255, 107, 129, 0.1)', color: 'var(--primary-color)', padding: '2px 6px', borderRadius: '10px' }}>Probar</span>
              </button>
            ))
          )}
        </div>
      </div>

      <div className="glass customizer-container" style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        
        {/* VISTA PREVIA (Fija y Responsiva) */}
        <div className="customizer-preview" style={{ padding: '15px', background: 'radial-gradient(circle, var(--bg-secondary) 0%, var(--bg-primary) 100%)', minHeight: '300px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <style dangerouslySetInnerHTML={{ __html: `
            @keyframes drop-scoop-generic {
              0% { transform: translateY(-160px) scaleY(1.3); opacity: 0; }
              60% { transform: translateY(8px) scaleY(0.85); }
              80% { transform: translateY(-4px) scaleY(1.05); }
              100% { transform: translateY(0px) scaleY(1); opacity: 1; }
            }
            @keyframes pulse-btn {
              0% { transform: scale(1); }
              50% { transform: scale(1.03); }
              100% { transform: scale(1); }
            }
            .option-btn {
              transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease !important;
            }
            .option-btn:hover {
              transform: translateY(-2px);
              box-shadow: 0 4px 10px rgba(0,0,0,0.08);
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

            {/* Jarabes */}
            {renderSyrupsSVG()}

            {/* Toppings Sólidos */}
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

          {/* Resumen de Receta en Vivo */}
          <div className="glass" style={{ 
            marginTop: '10px', 
            width: '100%', 
            padding: '12px 15px', 
            background: 'rgba(255, 255, 255, 0.72)', 
            border: '1px solid rgba(255, 107, 129, 0.12)',
            textAlign: 'left',
            borderRadius: '16px'
          }}>
            <strong style={{ fontSize: '0.8rem', display: 'block', marginBottom: '8px', color: 'var(--text-dark)' }}>
              📝 Tu Receta Especial:
            </strong>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '1rem' }}>🍦</span>
                <span style={{ color: 'var(--text-light)' }}>Envase:</span>
                <strong style={{ color: 'var(--text-dark)' }}>{selectedBase.name}</strong>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                <span style={{ fontSize: '1rem' }}>🍨</span>
                <span style={{ color: 'var(--text-light)' }}>Sabores:</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', flex: 1 }}>
                  {selectedScoops.length === 0 ? (
                    <span style={{ color: 'var(--danger)', fontWeight: 'bold' }}>¡Añade al menos un sabor!</span>
                  ) : (
                    selectedScoops.map((scoop, idx) => (
                      <span 
                        key={idx} 
                        onClick={() => handleRemoveScoop(idx)}
                        style={{
                          background: scoop.color,
                          color: scoop.id === 'coco' || scoop.id === 'vainilla' ? '#333' : 'white',
                          padding: '2px 6px',
                          borderRadius: '8px',
                          fontSize: '0.65rem',
                          fontWeight: 'bold',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px'
                        }}
                        title="Haga clic para quitar"
                      >
                        {scoop.name} ✕
                      </span>
                    ))
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '1rem' }}>🍬</span>
                <span style={{ color: 'var(--text-light)' }}>Toppings:</span>
                <strong style={{ color: 'var(--text-dark)' }}>
                  {selectedToppings.map(t => t.name).join(', ') || 'Sin toppings'}
                </strong>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '1rem' }}>🍓</span>
                <span style={{ color: 'var(--text-light)' }}>Salsa:</span>
                <strong style={{ color: 'var(--text-dark)' }}>
                  {selectedSyrup?.name || 'Sin jarabe'}
                </strong>
              </div>
            </div>
          </div>
        </div>

        {/* CONTROLES (Stepper y Contenido) */}
        <div className="customizer-options" style={{ padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          
          <div>
            {/* Stepper Horizontal Interactivo */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '25px', position: 'relative', padding: '0 10px' }}>
              <div style={{ position: 'absolute', top: '18px', left: '12%', right: '12%', height: '3px', backgroundColor: 'rgba(0, 0, 0, 0.05)', zIndex: 1 }}>
                <div style={{ 
                  height: '100%', 
                  width: customTab === 'base' ? '0%' : customTab === 'scoops' ? '50%' : '100%', 
                  backgroundColor: 'var(--primary-color)', 
                  transition: 'width 0.4s ease' 
                }} />
              </div>

              <div onClick={() => setCustomTab('base')} style={{ zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  backgroundColor: customTab === 'base' ? 'var(--primary-color)' : 'white',
                  border: '2px solid var(--primary-color)',
                  color: customTab === 'base' ? 'white' : 'var(--primary-color)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold',
                  fontSize: '0.85rem',
                  boxShadow: customTab === 'base' ? '0 0 10px rgba(255, 107, 129, 0.3)' : 'none',
                  transition: 'all 0.3s ease'
                }}>
                  {customTab !== 'base' ? '✓' : '1'}
                </div>
                <span style={{ fontSize: '0.72rem', fontWeight: 'bold', marginTop: '6px', color: customTab === 'base' ? 'var(--primary-color)' : 'var(--text-light)' }}>Envase</span>
              </div>

              <div onClick={() => setCustomTab('scoops')} style={{ zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  backgroundColor: customTab === 'scoops' ? 'var(--primary-color)' : (customTab === 'toppings' ? 'white' : 'white'),
                  border: `2px solid ${customTab === 'scoops' || customTab === 'toppings' ? 'var(--primary-color)' : 'rgba(0,0,0,0.1)'}`,
                  color: customTab === 'scoops' ? 'white' : (customTab === 'toppings' ? 'var(--primary-color)' : 'var(--text-light)'),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold',
                  fontSize: '0.85rem',
                  boxShadow: customTab === 'scoops' ? '0 0 10px rgba(255, 107, 129, 0.3)' : 'none',
                  transition: 'all 0.3s ease'
                }}>
                  {customTab === 'toppings' ? '✓' : '2'}
                </div>
                <span style={{ fontSize: '0.72rem', fontWeight: 'bold', marginTop: '6px', color: customTab === 'scoops' ? 'var(--primary-color)' : 'var(--text-light)' }}>Sabores</span>
              </div>

              <div onClick={() => setCustomTab('toppings')} style={{ zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  backgroundColor: customTab === 'toppings' ? 'var(--primary-color)' : 'white',
                  border: `2px solid ${customTab === 'toppings' ? 'var(--primary-color)' : 'rgba(0,0,0,0.1)'}`,
                  color: customTab === 'toppings' ? 'white' : 'var(--text-light)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold',
                  fontSize: '0.85rem',
                  boxShadow: customTab === 'toppings' ? '0 0 10px rgba(255, 107, 129, 0.3)' : 'none',
                  transition: 'all 0.3s ease'
                }}>
                  3
                </div>
                <span style={{ fontSize: '0.72rem', fontWeight: 'bold', marginTop: '6px', color: customTab === 'toppings' ? 'var(--primary-color)' : 'var(--text-light)' }}>Extras</span>
              </div>
            </div>

            {/* Pestaña 1: Envases */}
            {customTab === 'base' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ 
                  background: 'rgba(255, 107, 129, 0.05)', 
                  padding: '8px 12px', 
                  borderRadius: '8px', 
                  fontSize: '0.78rem', 
                  color: 'var(--primary-color)', 
                  fontWeight: '600',
                  textAlign: 'left'
                }}>
                  👉 Paso 1: Elige tu envase (Cono, Vaso o Waffle)
                </div>
                <div className="option-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '8px' }}>
                  {activeBases.map(base => (
                    <button
                      key={base.id}
                      type="button"
                      className={`option-btn ${selectedBase.id === base.id ? 'selected' : ''}`}
                      onClick={() => {
                        setSelectedBase(base);
                        setCustomTab('scoops'); 
                      }}
                      style={{ 
                        padding: '15px 10px',
                        borderRadius: '16px',
                        border: selectedBase.id === base.id ? '2px solid var(--primary-color)' : '1px solid var(--border-color)',
                        background: selectedBase.id === base.id ? 'rgba(255, 107, 129, 0.05)' : 'white',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        boxShadow: selectedBase.id === base.id ? '0 4px 12px rgba(255, 107, 129, 0.15)' : 'var(--shadow-sm)'
                      }}
                    >
                      {base.image ? (
                        <img src={base.image} alt={base.name} width="42" height="42" style={{ width: '42px', height: '42px', objectFit: 'contain', marginBottom: '6px' }} />
                      ) : (
                        <span style={{ fontSize: '2rem', marginBottom: '4px' }}>{base.icon}</span>
                      )}
                      <strong style={{ fontSize: '0.82rem', color: 'var(--text-dark)' }}>{base.name}</strong>
                      <span style={{ fontSize: '0.72rem', color: 'var(--primary-color)', fontWeight: 'bold' }}>
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
                <div style={{ 
                  background: 'rgba(255, 107, 129, 0.05)', 
                  padding: '8px 12px', 
                  borderRadius: '8px', 
                  fontSize: '0.78rem', 
                  color: 'var(--primary-color)', 
                  fontWeight: '600',
                  textAlign: 'left'
                }}>
                  👉 Paso 2: Añade sabores (¡Haz tu combinación favorita!)
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>
                    (Bolas tradicionales):
                  </span>
                  <strong style={{ fontSize: '0.8rem', color: 'var(--primary-color)' }}>
                    {selectedScoops.length} / 5 bolas
                  </strong>
                </div>
                
                <div className="option-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(105px, 1fr))', gap: '8px' }}>
                  {activeFlavors.map(flavor => {
                    const count = selectedScoops.filter(s => s.id === flavor.id).length;
                    return count === 0 ? (
                      <button
                        key={flavor.id}
                        type="button"
                        className="option-btn"
                        onClick={() => handleAddScoop(flavor)}
                        disabled={selectedScoops.length >= 5}
                        style={{
                          background: 'white',
                          border: '1px solid var(--border-color)',
                          borderRadius: '16px',
                          padding: '12px 8px',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '6px',
                          cursor: 'pointer',
                          position: 'relative',
                          transition: 'all 0.2s ease',
                          boxShadow: 'var(--shadow-sm)',
                          opacity: selectedScoops.length >= 5 ? 0.55 : 1
                        }}
                      >
                        <span className="color-dot" style={{ backgroundColor: flavor.color, width: '24px', height: '24px' }}></span>
                        <strong style={{ fontSize: '0.8rem', color: 'var(--text-dark)' }}>{flavor.name}</strong>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-light)' }}>S/. {flavor.price.toFixed(2)}</span>
                        <div style={{
                          marginTop: '4px',
                          width: '100%',
                          padding: '4px',
                          borderRadius: '8px',
                          background: 'rgba(255, 107, 129, 0.05)',
                          color: 'var(--primary-color)',
                          fontSize: '0.7rem',
                          fontWeight: 'bold',
                          textAlign: 'center'
                        }}>
                          Añadir +
                        </div>
                      </button>
                    ) : (
                      <div
                        key={flavor.id}
                        style={{
                          background: 'rgba(255, 107, 129, 0.04)',
                          border: '2px solid var(--primary-color)',
                          borderRadius: '16px',
                          padding: '12px 8px',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '6px',
                          position: 'relative',
                          transition: 'all 0.2s ease',
                          boxShadow: '0 4px 12px rgba(255, 107, 129, 0.1)'
                        }}
                      >
                        <span className="color-dot" style={{ backgroundColor: flavor.color, width: '24px', height: '24px' }}></span>
                        <strong style={{ fontSize: '0.8rem', color: 'var(--text-dark)', fontWeight: 'bold' }}>{flavor.name}</strong>
                        <span style={{ fontSize: '0.7rem', color: 'var(--primary-color)', fontWeight: 'bold' }}>S/. {flavor.price.toFixed(2)}</span>
                        
                        {/* Controles de cantidad dedicados */}
                        <div style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'space-between', 
                          width: '100%', 
                          marginTop: '4px',
                          background: 'white',
                          border: '1px solid var(--border-color)',
                          borderRadius: '10px',
                          padding: '2px'
                        }}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const idx = selectedScoops.findIndex(s => s.id === flavor.id);
                              if (idx >= 0) handleRemoveScoop(idx);
                            }}
                            style={{
                              width: '22px',
                              height: '22px',
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
                          <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-dark)' }}>{count}</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (selectedScoops.length >= 5) {
                                alert("¡El límite es de 5 bolas de helado!");
                                return;
                              }
                              handleAddScoop(flavor);
                            }}
                            disabled={selectedScoops.length >= 5}
                            style={{
                              width: '22px',
                              height: '22px',
                              borderRadius: '6px',
                              border: 'none',
                              background: 'rgba(255, 107, 129, 0.1)',
                              color: 'var(--primary-color)',
                              fontWeight: 'bold',
                              fontSize: '0.9rem',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              opacity: selectedScoops.length >= 5 ? 0.5 : 1
                            }}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Pestaña 3: Toppings y Salsas */}
            {customTab === 'toppings' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ 
                  background: 'rgba(255, 107, 129, 0.05)', 
                  padding: '8px 12px', 
                  borderRadius: '8px', 
                  fontSize: '0.78rem', 
                  color: 'var(--primary-color)', 
                  fontWeight: '600',
                  textAlign: 'left',
                  marginBottom: '5px'
                }}>
                  👉 Paso 3: Decora con Toppings y Salsas
                </div>

                <div>
                  <p style={{ fontSize: '0.78rem', fontWeight: 'bold', color: 'var(--text-dark)', marginBottom: '6px' }}>🍬 Toppings Sólidos (Opcional):</p>
                  <div className="option-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(105px, 1fr))', gap: '6px' }}>
                    <button
                      key="sin-toppings"
                      type="button"
                      className={`option-btn ${selectedToppings.length === 0 ? 'selected' : ''}`}
                      onClick={() => setSelectedToppings([])}
                      style={{ 
                        padding: '10px 6px',
                        borderRadius: '16px',
                        border: selectedToppings.length === 0 ? '2px solid var(--primary-color)' : '1px solid var(--border-color)',
                        background: selectedToppings.length === 0 ? 'rgba(255, 107, 129, 0.05)' : 'white'
                      }}
                    >
                      <span style={{ fontSize: '1.5rem', marginBottom: '2px' }}>🚫</span>
                      <strong style={{ fontSize: '0.75rem', color: 'var(--text-dark)' }}>Sin Toppings</strong>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-light)' }}>Gratis</span>
                    </button>
                    {activeToppings.map(topping => {
                      const isSelected = selectedToppings.some(t => t.id === topping.id);
                      return (
                        <button
                          key={topping.id}
                          type="button"
                          className={`option-btn ${isSelected ? 'selected' : ''}`}
                          onClick={() => handleToggleTopping(topping)}
                          style={{ 
                            padding: '10px 6px',
                            borderRadius: '16px',
                            border: isSelected ? '2px solid var(--primary-color)' : '1px solid var(--border-color)',
                            background: isSelected ? 'rgba(255, 107, 129, 0.05)' : 'white',
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
                              width: '14px',
                              height: '14px',
                              borderRadius: '50%',
                              fontSize: '0.55rem',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 'bold'
                            }}>✓</span>
                          )}
                          {topping.image ? (
                            <img src={topping.image} alt={topping.name} width="26" height="26" style={{ width: '26px', height: '26px', objectFit: 'contain', marginBottom: '4px' }} />
                          ) : (
                            <span style={{ fontSize: '1.5rem', marginBottom: '2px' }}>🍬</span>
                          )}
                          <strong style={{ fontSize: '0.75rem', color: 'var(--text-dark)' }}>{topping.name}</strong>
                          <span style={{ fontSize: '0.65rem', color: 'var(--primary-color)', fontWeight: 'bold' }}>+ S/. {topping.price.toFixed(2)}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <p style={{ fontSize: '0.78rem', fontWeight: 'bold', color: 'var(--text-dark)', marginBottom: '6px' }}>🍓 Jarabe / Salsa (S/. 0.50):</p>
                  <div className="option-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(105px, 1fr))', gap: '6px' }}>
                    <button
                      key="sin-syrup"
                      type="button"
                      className={`option-btn ${selectedSyrup === null ? 'selected' : ''}`}
                      onClick={() => setSelectedSyrup(null)}
                      style={{ 
                        padding: '10px 6px',
                        borderRadius: '16px',
                        border: selectedSyrup === null ? '2px solid var(--primary-color)' : '1px solid var(--border-color)',
                        background: selectedSyrup === null ? 'rgba(255, 107, 129, 0.05)' : 'white'
                      }}
                    >
                      <span style={{ fontSize: '1.5rem', marginBottom: '2px' }}>🚫</span>
                      <strong style={{ fontSize: '0.75rem', color: 'var(--text-dark)' }}>Sin Jarabe</strong>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-light)' }}>Gratis</span>
                    </button>
                    {toppings.filter(t => t.category === 'liquido' && t.active !== false).map(syrup => {
                      const isSelected = selectedSyrup?.id === syrup.id || (syrup.id === 'fresa_sauce' && selectedSyrup?.id === 'fresa');
                      const icon = syrup.id === 'fudge' ? '🍫' : (syrup.id === 'fresa_sauce' || syrup.id === 'fresa' ? '🍓' : '🍯');
                      return (
                        <button
                          key={syrup.id}
                          type="button"
                          className={`option-btn ${isSelected ? 'selected' : ''}`}
                          onClick={() => handleToggleSyrup({ id: syrup.id, name: syrup.name, price: syrup.price })}
                          style={{ 
                            padding: '10px 6px',
                            borderRadius: '16px',
                            border: isSelected ? '2px solid var(--primary-color)' : '1px solid var(--border-color)',
                            background: isSelected ? 'rgba(255, 107, 129, 0.05)' : 'white',
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
                              width: '14px',
                              height: '14px',
                              borderRadius: '50%',
                              fontSize: '0.55rem',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 'bold'
                            }}>✓</span>
                          )}
                          {syrup.image ? (
                            <img src={syrup.image} alt={syrup.name} width="26" height="26" style={{ width: '26px', height: '26px', objectFit: 'contain', marginBottom: '4px' }} />
                          ) : (
                            <span style={{ fontSize: '1.5rem', marginBottom: '2px' }}>{icon}</span>
                          )}
                          <strong style={{ fontSize: '0.75rem', color: 'var(--text-dark)' }}>{syrup.name.split(' ')[0]}</strong>
                          <span style={{ fontSize: '0.65rem', color: 'var(--primary-color)', fontWeight: 'bold' }}>+ S/. {syrup.price.toFixed(2)}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Botones de Navegación del Flujo y Barra de Costo */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginTop: '20px', borderTop: '1px solid var(--border-color)', paddingTop: '15px' }}>
              {customTab !== 'base' ? (
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: '8px 12px', fontSize: '0.8rem', fontWeight: 'bold' }}
                  onClick={() => setCustomTab(customTab === 'toppings' ? 'scoops' : 'base')}
                >
                  ← Atrás
                </button>
              ) : <div />}

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {customTab !== 'toppings' ? (
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ 
                      padding: '8px 16px', 
                      fontSize: '0.8rem', 
                      fontWeight: 'bold',
                      background: 'var(--secondary-color)',
                      borderColor: 'var(--secondary-color)',
                      boxShadow: '0 4px 10px rgba(229, 142, 38, 0.2)'
                    }}
                    onClick={() => setCustomTab(customTab === 'base' ? 'scoops' : 'toppings')}
                  >
                    Continuar →
                  </button>
                ) : null}
              </div>
            </div>

            {/* Barra de Costo Final y Botón de Conversión de Venta */}
            <div className="custom-price-bar" style={{ 
              marginTop: '15px', 
              padding: '12px 15px', 
              background: 'linear-gradient(135deg, rgba(255, 107, 129, 0.08) 0%, rgba(229, 142, 38, 0.08) 100%)', 
              borderRadius: '20px',
              border: '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-light)', fontWeight: 600 }}>Total de tu Creación:</span>
                  <div className="price-tag" style={{ fontSize: '1.45rem', color: 'var(--text-dark)', fontWeight: 'bold', lineHeight: '1.2' }}>S/. {totalPrice.toFixed(2)}</div>
                </div>
                
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={selectedScoops.length === 0 || isAdding}
                  onClick={handleAddCustomToCart}
                  style={{ 
                    padding: '10px 20px', 
                    fontSize: '0.88rem', 
                    fontWeight: 'bold',
                    background: 'linear-gradient(135deg, var(--primary-color) 0%, var(--secondary-color) 100%)',
                    boxShadow: '0 6px 16px rgba(255, 107, 129, 0.35)',
                    animation: 'pulse-btn 2s infinite',
                    cursor: 'pointer',
                    border: 'none',
                    borderRadius: '12px'
                  }}
                >
                  {isAdding ? 'Agregando...' : '🛒 ¡Agregar al Carrito! 🍦'}
                </button>
              </div>

              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                gap: '6px', 
                fontSize: '0.68rem', 
                color: 'var(--text-light)', 
                background: 'rgba(255,255,255,0.6)', 
                padding: '5px', 
                borderRadius: '8px'
              }}>
                <span>✨</span>
                <span>Preparado al instante con ingredientes 100% artesanales y naturales.</span>
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
