import React, { useState } from 'react';

const CHISPAS_OFFSETS = [
  { dx: -25, dy: 0, angle: 15, color: '#ff4757' },
  { dx: 25, dy: 2, angle: -30, color: '#ffa502' },
  { dx: 0, dy: -5, angle: 45, color: '#2ed573' },
  { dx: -35, dy: 6, angle: -10, color: '#1e90ff' },
  { dx: 35, dy: 8, angle: 25, color: '#ff6b81' },
  { dx: -10, dy: 4, angle: 80, color: '#f1c40f' },
  { dx: 15, dy: -2, angle: -45, color: '#9b59b6' },
  { dx: -20, dy: -3, angle: 60, color: '#2ecc71' }
];

const OREO_OFFSETS = [
  { dx: -20, dy: 2, r: 3.5 },
  { dx: 25, dy: 5, r: 2.5 },
  { dx: -5, dy: -4, r: 4 },
  { dx: -35, dy: 8, r: 2.2 },
  { dx: 35, dy: 6, r: 3 },
  { dx: -12, dy: 5, r: 3.5 },
  { dx: 12, dy: -2, r: 2.5 }
];

const MANI_OFFSETS = [
  { dx: -22, dy: 4, rx: 4, ry: 2, angle: 20 },
  { dx: 24, dy: 1, rx: 3, ry: 1.5, angle: -40 },
  { dx: 2, dy: -3, rx: 4, ry: 2, angle: 70 },
  { dx: -30, dy: 8, rx: 3, ry: 1.8, angle: -10 },
  { dx: 30, dy: 7, rx: 4, ry: 2, angle: 45 }
];

const GOMITA_OFFSETS = [
  { dx: -18, dy: 4, color: '#2ed573' },
  { dx: 18, dy: 2, color: '#ff4757' },
  { dx: 0, dy: -2, color: '#ffa502' }
];

export default function LiterCustomizer({ flavors, toppings = [], literConfig, onAddToCart, setView, showAlert }) {
  const alert = (msg) => {
    if (showAlert) {
      const isError = msg.toLowerCase().includes('error') || msg.toLowerCase().includes('falló') || msg.toLowerCase().includes('selecciona') || msg.toLowerCase().includes('límite') || msg.toLowerCase().includes('máximo') || msg.toLowerCase().includes('por favor');
      const type = isError ? 'warning' : 'info';
      const title = isError ? 'Atención' : 'Aviso';
      showAlert(title, msg, type);
    } else {
      window.alert(msg);
    }
  };

  const activeFlavors = (flavors || []).filter(f => f.active !== false);
  const maxFlavors = parseInt(literConfig?.maxFlavors, 10) || 3;
  const basePrice = parseFloat(literConfig?.price) || 15.0;

  // Lista de sabores seleccionados para el pote de 1 litro
  const [selectedFlavors, setSelectedFlavors] = useState([]);
  const [selectedToppings, setSelectedToppings] = useState([]);
  const [selectedSyrup, setSelectedSyrup] = useState(null);
  const [activeTab, setActiveTab] = useState('flavors'); // flavors, toppings
  const [flavorError, setFlavorError] = useState(false); // Estado para resaltar error de sabor

  const handleAddFlavor = (flavor) => {
    if (selectedFlavors.length >= maxFlavors) {
      alert(`El helado de litro permite hasta un máximo de ${maxFlavors} sabores.`);
      return;
    }
    setSelectedFlavors([...selectedFlavors, flavor]);
  };

  const handleRemoveFlavor = (index) => {
    const next = [...selectedFlavors];
    next.splice(index, 1);
    setSelectedFlavors(next);
  };

  const handleClear = () => {
    setSelectedFlavors([]);
    setSelectedToppings([]);
    setSelectedSyrup(null);
  };

  const handleToggleTopping = (topping) => {
    const exists = selectedToppings.find(t => t.id === topping.id);
    if (exists) {
      setSelectedToppings(selectedToppings.filter(t => t.id !== topping.id));
    } else {
      if (selectedToppings.length >= 3) {
        alert("Puedes seleccionar hasta un máximo de 3 toppings en tu helado de litro.");
        return;
      }
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

  // Calcular precio total
  const toppingsPrice = selectedToppings.reduce((sum, t) => sum + (parseFloat(t.price) || 0), 0);
  const syrupPrice = selectedSyrup ? (parseFloat(selectedSyrup.price) || 0) : 0;
  const totalPrice = basePrice + toppingsPrice + syrupPrice;

  const handleAddLiterToCart = () => {
    if (selectedFlavors.length === 0) {
      // Mostrar alerta descriptiva
      if (showAlert) {
        showAlert(
          '🍨 Selecciona un Sabor',
          'Debes elegir al menos 1 sabor para armar tu helado de 1 Litro. ¡Explora los sabores disponibles en la pestaña de Sabores y elige tu combinación favorita!',
          'warning'
        );
      } else {
        window.alert("Por favor, selecciona al menos 1 sabor antes de agregar el helado de litro al carrito.");
      }
      // Resaltar el error visualmente
      setFlavorError(true);
      setActiveTab('flavors');
      setTimeout(() => setFlavorError(false), 2000);
      return;
    }

    // Estructurar el nombre según si es un solo sabor o varios
    let name = "";
    if (selectedFlavors.length === 1) {
      name = `Helado de 1 Litro (Sabor Único: ${selectedFlavors[0].name})`;
    } else {
      const namesList = selectedFlavors.map(f => f.name).join(' - ');
      name = `Helado de 1 Litro (${selectedFlavors.length} Sabores: ${namesList})`;
    }

    // Append toppings & syrup to title if selected
    if (selectedToppings.length > 0 || selectedSyrup) {
      const parts = [];
      if (selectedToppings.length > 0) parts.push("Toppings");
      if (selectedSyrup) parts.push("Salsa");
      name += ` + ${parts.join(' y ')}`;
    }

    const literItem = {
      type: 'liter',
      id: `liter_${Date.now()}`,
      name: name,
      price: totalPrice,
      quantity: 1,
      scoops: selectedFlavors.map(f => ({ 
        id: f.id, 
        name: f.name, 
        color: f.color || '#cccccc', 
        price: parseFloat(f.price) || 0 
      })),
      toppings: selectedToppings.map(t => ({ 
        id: t.id, 
        name: t.name, 
        price: parseFloat(t.price) || 0 
      })),
      syrup: selectedSyrup ? { 
        id: selectedSyrup.id, 
        name: selectedSyrup.name, 
        price: parseFloat(selectedSyrup.price) || 0 
      } : null
    };

    onAddToCart(literItem);
    setView('shop');
  };

  // Renderizar las capas de helado dentro del envase de 1 Litro SVG
  const renderIceCreamLayers = () => {
    const count = selectedFlavors.length;
    if (count === 0) {
      return (
        <g>
          {/* Tub interior vacío/sombra */}
          <path d="M 45 60 L 52 145 C 52 145, 100 152, 148 145 L 155 60 Z" fill="rgba(0,0,0,0.05)" />
          <text x="100" y="105" fill="var(--text-light)" fontSize="10" fontWeight="bold" textAnchor="middle" opacity="0.6">
            Selecciona Sabores
          </text>
        </g>
      );
    }

    if (count === 1) {
      const color = selectedFlavors[0].color;
      return (
        <g>
          {/* Relleno completo de un solo sabor */}
          <path d="M 44 58 L 52 145 C 52 145, 100 152, 148 145 L 156 58 Z" fill={color} />
          {/* Textura superior redondeada (copete del helado) */}
          <path d="M 42 58 C 42 45, 100 45, 100 45 C 100 45, 158 45, 158 58 Z" fill={color} />
          <ellipse cx="100" cy="58" rx="58" ry="8" fill="white" opacity="0.15" />
        </g>
      );
    }

    if (count === 2) {
      const c1 = selectedFlavors[0].color;
      const c2 = selectedFlavors[1].color;
      return (
        <g>
          {/* Lado izquierdo */}
          <path d="M 44 58 L 52 145 C 52 145, 100 148, 100 148 L 100 58 Z" fill={c1} />
          <path d="M 42 58 C 42 45, 100 45, 100 58 Z" fill={c1} />
          
          {/* Lado derecho */}
          <path d="M 100 58 L 100 148 C 100 148, 148 145, 148 145 L 156 58 Z" fill={c2} />
          <path d="M 100 58 C 100 45, 158 45, 158 58 Z" fill={c2} />
          
          <ellipse cx="100" cy="58" rx="58" ry="8" fill="white" opacity="0.15" />
          {/* Línea divisoria suave */}
          <line x1="100" y1="50" x2="100" y2="148" stroke="rgba(0,0,0,0.1)" strokeWidth="1.5" strokeDasharray="2,2" />
        </g>
      );
    }

    if (count === 3) {
      const c1 = selectedFlavors[0].color;
      const c2 = selectedFlavors[1].color;
      const c3 = selectedFlavors[2].color;
      return (
        <g>
          {/* Sección 1 (Izquierda) */}
          <path d="M 44 58 L 52 145 C 52 145, 80 146, 80 146 L 80 58 Z" fill={c1} />
          <path d="M 42 58 C 42 45, 80 47, 80 58 Z" fill={c1} />

          {/* Sección 2 (Centro) */}
          <path d="M 80 58 L 80 146 C 80 146, 120 147, 120 147 L 120 58 Z" fill={c2} />
          <path d="M 80 58 C 80 47, 120 47, 120 58 Z" fill={c2} />

          {/* Sección 3 (Derecha) */}
          <path d="M 120 58 L 120 147 C 120 147, 148 145, 148 145 L 156 58 Z" fill={c3} />
          <path d="M 120 58 C 120 47, 158 45, 158 58 Z" fill={c3} />

          <ellipse cx="100" cy="58" rx="58" ry="8" fill="white" opacity="0.15" />
          <line x1="80" y1="52" x2="80" y2="146" stroke="rgba(0,0,0,0.08)" strokeWidth="1.2" />
          <line x1="120" y1="52" x2="120" y2="147" stroke="rgba(0,0,0,0.08)" strokeWidth="1.2" />
        </g>
      );
    }

    // Para 4 o más sabores
    return (
      <g>
        {selectedFlavors.slice(0, 4).map((f, index, arr) => {
          const h = 87 / arr.length;
          const yStart = 58 + (index * h);
          const yEnd = yStart + h;
          return (
            <g key={index}>
              <path d={`M 44 ${yStart} L 52 ${yEnd} L 148 ${yEnd} L 156 ${yStart} Z`} fill={f.color} />
            </g>
          );
        })}
        <ellipse cx="100" cy="58" rx="58" ry="8" fill="white" opacity="0.15" />
      </g>
    );
  };

  // Renderizar coberturas / toppings sólidas sobre el helado en el SVG
  const renderToppingDecorations = () => {
    return selectedToppings.map(topping => {
      if (topping.id === 'chispas') {
        return CHISPAS_OFFSETS.map((offset, i) => (
          <line
            key={`chispas-${i}`}
            x1={100 + offset.dx}
            y1={52 + offset.dy}
            x2={100 + offset.dx + 4}
            y2={52 + offset.dy + 2}
            stroke={offset.color}
            strokeWidth="2.5"
            strokeLinecap="round"
            transform={`rotate(${offset.angle}, ${100 + offset.dx}, ${52 + offset.dy})`}
          />
        ));
      }
      if (topping.id === 'oreo') {
        return OREO_OFFSETS.map((offset, i) => (
          <circle
            key={`oreo-${i}`}
            cx={100 + offset.dx}
            cy={52 + offset.dy}
            r={offset.r}
            fill="#2f3542"
          />
        ));
      }
      if (topping.id === 'mani') {
        return MANI_OFFSETS.map((offset, i) => (
          <ellipse
            key={`mani-${i}`}
            cx={100 + offset.dx}
            cy={52 + offset.dy}
            rx={offset.rx}
            ry={offset.ry}
            fill="#f1c40f"
            transform={`rotate(${offset.angle}, ${100 + offset.dx}, ${52 + offset.dy})`}
          />
        ));
      }
      if (topping.id === 'gomitas') {
        return GOMITA_OFFSETS.map((offset, i) => (
          <rect
            key={`gomitas-${i}`}
            x={100 + offset.dx - 3}
            y={52 + offset.dy - 3}
            width="6"
            height="6"
            rx="1.5"
            fill={offset.color}
            opacity="0.9"
          />
        ));
      }
      return null;
    });
  };

  // Renderizar jarabe/salsa cayendo sobre el helado en el SVG
  const renderSyrupDecoration = () => {
    if (!selectedSyrup) return null;
    const color = selectedSyrup.id === 'fudge' ? '#3d1d07' : (selectedSyrup.id === 'fresa_sauce' || selectedSyrup.id === 'fresa' ? '#ff3838' : '#ffa502');
    return (
      <path
        d="M 50 56 C 50 56, 70 65, 85 58 C 100 52, 115 62, 130 56 C 145 50, 150 56, 150 56 Q 140 68, 100 66 Q 60 68, 50 56 Z"
        fill={color}
        opacity="0.95"
      />
    );
  };

  return (
    <div className="customizer-section">
      <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.85rem' }} onClick={() => setView('shop')}>
          ← Tienda
        </button>
        <h2 style={{ fontSize: '1.4rem' }}>Arma tu Litro de Helado</h2>
      </div>

      <div className="glass customizer-container" style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        {/* VISTA PREVIA DEL POTE DE HELADO */}
        <div className="customizer-preview" style={{ padding: '20px', background: 'radial-gradient(circle, var(--bg-secondary) 0%, var(--bg-primary) 100%)', minHeight: '260px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          
          <svg viewBox="0 0 200 200" style={{ width: '100%', maxHeight: '180px', display: 'block' }}>
            <defs>
              <filter id="tubShadow" x="-10%" y="-10%" width="120%" height="120%">
                <feDropShadow dx="0" dy="4" stdDeviation="4" floodOpacity="0.15" />
              </filter>
              <linearGradient id="tubGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#f5f6fa" stopOpacity="0.8" />
              </linearGradient>
            </defs>

            {/* Sombra base del pote */}
            <ellipse cx="100" cy="155" rx="55" ry="8" fill="rgba(0,0,0,0.06)" />

            <g filter="url(#tubShadow)">
              {/* Helado por capas */}
              {renderIceCreamLayers()}

              {/* Jarabes/Salsas */}
              {renderSyrupDecoration()}

              {/* Coberturas/Toppings */}
              {renderToppingDecorations()}

              {/* Pote / Envase de 1L Transparente/Plástico */}
              <path d="M 40 56 L 50 148 C 50 148, 100 156, 150 148 L 160 56 Z" fill="url(#tubGrad)" opacity="0.35" stroke="var(--border-color)" strokeWidth="1.5" />
              {/* Aro/Borde superior del pote */}
              <ellipse cx="100" cy="56" rx="60" ry="10" fill="none" stroke="var(--border-color)" strokeWidth="2.5" />
              {/* Detalle de etiqueta "1 Litro" */}
              <rect x="75" y="85" width="50" height="28" rx="4" fill="white" stroke="var(--primary-color)" strokeWidth="1" opacity="0.9" />
              <text x="100" y="98" fill="var(--primary-color)" fontSize="8" fontWeight="bold" textAnchor="middle">1 LITRO</text>
              <text x="100" y="108" fill="var(--text-dark)" fontSize="7" fontWeight="bold" textAnchor="middle">DON HELADO</text>
            </g>
          </svg>

          <div style={{ marginTop: '10px', textAlign: 'center', width: '100%' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-dark)' }}>
              {selectedFlavors.length === 0 
                ? "Selecciona los sabores para llenar tu pote 👇"
                : `Llevas ${selectedFlavors.length} de ${maxFlavors} sabores permitidos`
              }
            </span>
            <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
              {selectedFlavors.map((flavor, index) => (
                <span
                  key={`flav-${index}`}
                  onClick={() => handleRemoveFlavor(index)}
                  style={{
                    backgroundColor: flavor.color,
                    color: flavor.id === 'coco' || flavor.id === 'vainilla' ? '#333' : 'white',
                    padding: '3px 8px',
                    borderRadius: 'var(--radius-full)',
                    fontSize: '0.7rem',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                  title="Remover sabor"
                >
                  {flavor.name} ✕
                </span>
              ))}
              {selectedToppings.map((topping, index) => (
                <span
                  key={`top-${topping.id}`}
                  onClick={() => handleToggleTopping(topping)}
                  style={{
                    backgroundColor: '#eccc68',
                    color: '#333',
                    padding: '3px 8px',
                    borderRadius: 'var(--radius-full)',
                    fontSize: '0.7rem',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                  title="Remover topping"
                >
                  🍬 {topping.name} ✕
                </span>
              ))}
              {selectedSyrup && (
                <span
                  onClick={() => setSelectedSyrup(null)}
                  style={{
                    backgroundColor: '#ff7f50',
                    color: 'white',
                    padding: '3px 8px',
                    borderRadius: 'var(--radius-full)',
                    fontSize: '0.7rem',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                  title="Remover salsa"
                >
                  🍯 {selectedSyrup.name} ✕
                </span>
              )}
            </div>
          </div>
        </div>

        {/* CONTROLES DE SELECCIÓN */}
        <div className="customizer-options" style={{ padding: '15px' }}>
          {/* Sub-pestañas */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: '12px' }}>
            <button
              type="button"
              className={`tab-item ${activeTab === 'flavors' ? 'active' : ''}`}
              onClick={() => { setActiveTab('flavors'); setFlavorError(false); }}
              style={{
                flex: 1,
                padding: '8px',
                fontSize: '0.8rem',
                fontWeight: 'bold',
                background: flavorError ? 'rgba(241, 196, 15, 0.12)' : 'transparent',
                border: 'none',
                borderBottom: flavorError
                  ? '2px solid var(--secondary-color)'
                  : activeTab === 'flavors' ? '2px solid var(--primary-color)' : 'none',
                color: flavorError ? 'var(--secondary-color)' : activeTab === 'flavors' ? 'var(--primary-color)' : 'var(--text-light)',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                animation: flavorError ? 'flavorTabShake 0.5s ease' : 'none'
              }}
            >
              {flavorError ? '⚠️' : '🍨'} Sabores ({selectedFlavors.length}/{maxFlavors})
              {flavorError && <span style={{ display: 'block', fontSize: '0.65rem', color: 'var(--secondary-color)', fontWeight: 'bold' }}>¡Selecciona aquí!</span>}
            </button>
            <button
              type="button"
              className={`tab-item ${activeTab === 'toppings' ? 'active' : ''}`}
              onClick={() => setActiveTab('toppings')}
              style={{
                flex: 1,
                padding: '8px',
                fontSize: '0.8rem',
                fontWeight: 'bold',
                background: 'transparent',
                border: 'none',
                borderBottom: activeTab === 'toppings' ? '2px solid var(--primary-color)' : 'none',
                color: activeTab === 'toppings' ? 'var(--primary-color)' : 'var(--text-light)',
                cursor: 'pointer'
              }}
            >
              🍬 Toppings y Salsa ({selectedToppings.length + (selectedSyrup ? 1 : 0)})
            </button>
          </div>
          <style dangerouslySetInnerHTML={{ __html: `
            @keyframes flavorTabShake {
              0%, 100% { transform: translateX(0); }
              20% { transform: translateX(-6px); }
              40% { transform: translateX(6px); }
              60% { transform: translateX(-4px); }
              80% { transform: translateX(4px); }
            }
          ` }} />

          {activeTab === 'flavors' ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-light)' }}>Elige tus sabores (puedes repetir):</span>
                {selectedFlavors.length > 0 && (
                  <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '0.7rem', color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={handleClear}>
                    Limpiar todo
                  </button>
                )}
              </div>

              <div className="option-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '8px', maxHeight: '180px', overflowY: 'auto', paddingRight: '2px' }}>
                {activeFlavors.map(flavor => {
                  const occurrences = selectedFlavors.filter(f => f.id === flavor.id).length;
                  return (
                    <button
                      key={flavor.id}
                      className="option-btn"
                      onClick={() => handleAddFlavor(flavor)}
                      disabled={selectedFlavors.length >= maxFlavors}
                      style={{ position: 'relative', padding: '12px 6px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}
                    >
                      {occurrences > 0 && (
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
                          {occurrences}
                        </span>
                      )}
                      <span className="color-dot" style={{ backgroundColor: flavor.color, width: '20px', height: '20px', marginBottom: '2px' }}></span>
                      <strong style={{ fontSize: '0.8rem', textAlign: 'center', width: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{flavor.name}</strong>
                      {flavor.isPremium && (
                        <span style={{ fontSize: '0.6rem', color: 'var(--secondary-color)', fontWeight: 'bold' }}>Premium</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-light)', display: 'block', marginBottom: '6px' }}>Toppings Sólidos (Opcional - Máx 3):</span>
                <div className="option-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '6px', maxHeight: '110px', overflowY: 'auto' }}>
                  {toppings.filter(t => t.category === 'solido' && t.active !== false).map(topping => {
                    const isSelected = selectedToppings.some(t => t.id === topping.id);
                    return (
                      <button
                        key={topping.id}
                        type="button"
                        className={`option-btn ${isSelected ? 'selected' : ''}`}
                        onClick={() => handleToggleTopping(topping)}
                        style={{ padding: '8px 4px' }}
                      >
                        <strong style={{ fontSize: '0.75rem' }}>{topping.name}</strong>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-light)' }}>+ S/. {topping.price.toFixed(2)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-light)', display: 'block', marginBottom: '6px' }}>Jarabe / Salsa (Opcional - Máx 1):</span>
                <div className="option-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '6px' }}>
                  {toppings.filter(t => t.category === 'liquido' && t.active !== false).map(syrup => {
                    const isSelected = selectedSyrup?.id === syrup.id;
                    return (
                      <button
                        key={syrup.id}
                        type="button"
                        className={`option-btn ${isSelected ? 'selected' : ''}`}
                        onClick={() => handleToggleSyrup(syrup)}
                        style={{ padding: '8px' }}
                      >
                        <strong style={{ fontSize: '0.75rem' }}>{syrup.name}</strong>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-light)' }}>+ S/. {syrup.price.toFixed(2)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Barra de Costo y Confirmación */}
          <div className="custom-price-bar" style={{ marginTop: '20px', borderTop: '1px solid var(--border-color)', paddingTop: '15px' }}>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>Total Litro Personalizado:</span>
              <div className="price-tag" style={{ fontSize: '1.4rem' }}>S/. {totalPrice.toFixed(2)}</div>
            </div>
            
            <button
              className="btn btn-primary"
              onClick={handleAddLiterToCart}
              style={{
                padding: '10px 20px',
                fontSize: '0.9rem',
                transition: 'all 0.2s ease',
                opacity: selectedFlavors.length === 0 ? 0.75 : 1
              }}
            >
              {selectedFlavors.length === 0 ? '⚠️ Selecciona un Sabor' : '🛒 Agregar 1 Litro al Carrito'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
