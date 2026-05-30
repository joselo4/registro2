import React, { useState } from 'react';

export default function CustomerShop({ 
  flavors, 
  packs, 
  onAddToCart, 
  setView, 
  storeName,
  freeDeliveryThreshold = 15.0,
  deliveryCampaignText = '¡Arma tu helado con toppings o elige un pack promocional para no pagar envío!'
}) {
  const [filter, setFilter] = useState('all'); // all, classic, packs

  const activeFlavors = flavors.filter(f => f.active);
  const activePacks = packs.filter(p => p.active);

  // Helper for dynamic premium toppings per flavor in the shop catalog
  const renderDynamicToppings = (flavorId) => {
    switch (flavorId) {
      case 'fresa':
        return (
          <g>
            {/* Semillas de fresa natural */}
            <ellipse cx="40" cy="38" rx="0.8" ry="1.5" fill="#80001a" opacity="0.6" transform="rotate(15 40 38)" />
            <ellipse cx="48" cy="32" rx="0.8" ry="1.5" fill="#80001a" opacity="0.6" transform="rotate(-10 48 32)" />
            <ellipse cx="58" cy="36" rx="0.8" ry="1.5" fill="#80001a" opacity="0.6" transform="rotate(25 58 36)" />
            <ellipse cx="62" cy="46" rx="0.8" ry="1.5" fill="#80001a" opacity="0.6" transform="rotate(-15 62 46)" />
            <ellipse cx="38" cy="48" rx="0.8" ry="1.5" fill="#80001a" opacity="0.6" transform="rotate(5 38 48)" />
            <ellipse cx="50" cy="50" rx="0.8" ry="1.5" fill="#80001a" opacity="0.6" transform="rotate(-5 50 50)" />
            {/* Hojita de menta decorativa */}
            <path d="M 50 22 C 45 15, 50 10, 50 10 C 50 10, 55 15, 50 22 Z" fill="#2ed573" />
            <path d="M 49 22 C 45 16, 48 12, 48 12 C 48 12, 52 16, 49 22 Z" fill="#26af5f" />
          </g>
        );
      case 'vainilla':
        return (
          <g>
            {/* Puntos de vaina de vainilla */}
            <circle cx="42" cy="34" r="0.6" fill="#3d3d3d" opacity="0.6" />
            <circle cx="56" cy="38" r="0.6" fill="#3d3d3d" opacity="0.5" />
            <circle cx="48" cy="46" r="0.6" fill="#3d3d3d" opacity="0.6" />
            <circle cx="36" cy="44" r="0.6" fill="#3d3d3d" opacity="0.5" />
            <circle cx="62" cy="42" r="0.6" fill="#3d3d3d" opacity="0.6" />
            {/* Salsa de caramelo suave */}
            <path d="M 33 34 Q 45 42 50 34 T 67 38" fill="none" stroke="#d5822b" strokeWidth="1.5" strokeLinecap="round" opacity="0.85" />
          </g>
        );
      case 'mango':
        return (
          <g>
            {/* Veteado de salsa de mango */}
            <path d="M 30 38 Q 42 26 50 38 T 68 40" fill="none" stroke="#ffa502" strokeWidth="2" strokeLinecap="round" opacity="0.95" />
            <path d="M 34 46 Q 48 38 64 48" fill="none" stroke="#ffa502" strokeWidth="2.5" strokeLinecap="round" opacity="0.95" />
            {/* Cubito de mango */}
            <rect x="46" y="16" width="8" height="8" rx="2" fill="#ffa502" transform="rotate(20 50 20)" stroke="#ff7f50" strokeWidth="0.6" />
            <rect x="47" y="17" width="6" height="6" rx="1.5" fill="#ffbe76" transform="rotate(20 50 20)" />
          </g>
        );
      case 'maracuya':
        return (
          <g>
            {/* Pulpa dorada y pepitas negras de maracuyá */}
            <path d="M 32 35 Q 46 22 66 32" fill="none" stroke="#ffa502" strokeWidth="2.5" strokeLinecap="round" opacity="0.9" />
            <path d="M 38 48 Q 50 38 62 48" fill="none" stroke="#ffa502" strokeWidth="2" strokeLinecap="round" opacity="0.9" />
            <path d="M 42 32 C 40 32, 40 35, 43 35 C 44 35, 44 32, 42 32" fill="#2d3436" />
            <path d="M 52 38 C 50 38, 50 41, 53 41 C 54 41, 54 38, 52 38" fill="#2d3436" />
            <path d="M 58 46 C 56 46, 56 49, 59 49 C 60 49, 60 46, 58 46" fill="#2d3436" />
          </g>
        );
      case 'menta':
        return (
          <g>
            {/* Chispitas de chocolate crocante */}
            <rect x="36" y="32" width="3" height="3" fill="#2d1d0f" rx="0.5" transform="rotate(15 36 32)" />
            <rect x="48" y="38" width="2.5" height="2.5" fill="#2d1d0f" rx="0.5" transform="rotate(45 48 38)" />
            <rect x="58" y="30" width="3" height="3" fill="#2d1d0f" rx="0.5" transform="rotate(10 58 30)" />
            <rect x="62" y="44" width="2.5" height="2.5" fill="#2d1d0f" rx="0.5" transform="rotate(30 62 44)" />
            <rect x="42" y="46" width="3" height="3" fill="#2d1d0f" rx="0.5" transform="rotate(80 42 46)" />
            <rect x="52" y="48" width="2.8" height="2.8" fill="#2d1d0f" rx="0.5" transform="rotate(-15 52 48)" />
          </g>
        );
      case 'lucuma':
        return (
          <g>
            {/* Hilos de chocolate fudge oscuro sobre lúcuma */}
            <path d="M 30 36 Q 44 48 50 32 T 68 38" fill="none" stroke="#2d1d0f" strokeWidth="2" strokeLinecap="round" opacity="0.9" />
            <path d="M 33 46 Q 50 38 65 48" fill="none" stroke="#2d1d0f" strokeWidth="2" strokeLinecap="round" opacity="0.9" />
          </g>
        );
      case 'chocolate':
        return (
          <g>
            {/* Drip brilloso de chocolate belga */}
            <path d="M 32 35 Q 46 22 66 32" fill="none" stroke="#1e172e" strokeWidth="2.5" strokeLinecap="round" opacity="0.8" />
            <path d="M 46 24 Q 50 38 52 46 Q 53 50 50 50 Q 47 50 48 46 Z" fill="#1e172e" />
            <path d="M 36 28 Q 38 36 39 42 Q 40 45 38 45 Q 36 45 37 42 Z" fill="#1e172e" />
            <path d="M 49 40 Q 50 45 49 47" stroke="white" strokeWidth="0.5" opacity="0.4" strokeLinecap="round" />
          </g>
        );
      case 'coco':
        return (
          <g>
            {/* Coco rallado espolvoreado */}
            <line x1="38" y1="32" x2="43" y2="34" stroke="#ffffff" strokeWidth="1.2" strokeLinecap="round" />
            <line x1="48" y1="36" x2="52" y2="35" stroke="#ffffff" strokeWidth="1.2" strokeLinecap="round" />
            <line x1="58" y1="32" x2="61" y2="36" stroke="#ffffff" strokeWidth="1.2" strokeLinecap="round" />
            <line x1="35" y1="44" x2="40" y2="46" stroke="#ffffff" strokeWidth="1.2" strokeLinecap="round" />
            <line x1="52" y1="48" x2="56" y2="46" stroke="#ffffff" strokeWidth="1.2" strokeLinecap="round" />
            <line x1="60" y1="44" x2="64" y2="42" stroke="#ffffff" strokeWidth="1.2" strokeLinecap="round" />
            <line x1="44" y1="42" x2="48" y2="44" stroke="#ffffff" strokeWidth="1.2" strokeLinecap="round" />
          </g>
        );
      default:
        return null;
    }
  };

  // Un helado clásico rápido es un helado simple de 1 bola en Cono
  const handleAddClassicToCart = (flavor) => {
    const customItem = {
      type: 'custom',
      base: { id: 'cono', name: 'Cono de Galleta Crujiente', price: 0.0 },
      scoops: [{ id: flavor.id, name: flavor.name, price: flavor.price, color: flavor.color }],
      toppings: [],
      price: flavor.price,
      quantity: 1,
      name: `Helado Simple de ${flavor.name}`
    };
    onAddToCart(customItem);
  };

  const handleAddPackToCart = (pack) => {
    const packItem = {
      type: 'pack',
      id: pack.id,
      name: pack.name,
      price: pack.price,
      items: pack.items,
      quantity: 1
    };
    onAddToCart(packItem);
  };

  return (
    <div className="customer-shop">
      {/* Hero Section */}
      <section className="hero">
        <div className="hero-text">
          <h1>¡Helados Deliciosos desde S/. 1.00!</h1>
          <p>
            Bienvenido a <strong>{storeName}</strong>, la mejor heladería artesanal online. Diseña tu helado favorito bola por bola con tus sabores preferidos, toppings y salsas, o elige nuestros combos de descuento.
          </p>
          <div className="hero-cta">
            <button className="btn btn-primary" onClick={() => setView('customizer')}>
              🎨 Personalizar mi Helado
            </button>
            <button className="btn btn-secondary" onClick={() => {
              const el = document.getElementById('catalog');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }}>
              🍨 Ver Catálogo
            </button>
          </div>
        </div>
        <div className="hero-image-container">
          <div className="hero-circle-bg"></div>
          <div className="hero-graphic">🍦</div>
        </div>
      </section>

      {/* BANNER DELIVERY GRATIS */}
      <div 
        className="glass" 
        style={{ 
          padding: '15px 25px', 
          marginBottom: '30px', 
          textAlign: 'center', 
          background: 'linear-gradient(135deg, rgba(46, 204, 113, 0.15) 0%, rgba(52, 152, 219, 0.1) 100%)',
          borderLeft: '5px solid var(--success)',
          borderRadius: 'var(--radius-md)'
        }}
      >
        <span style={{ fontSize: '1.1rem' }}>🚚 <strong>Delivery GRATIS</strong> por compras desde <strong>S/. {parseFloat(freeDeliveryThreshold).toFixed(2)}</strong></span>
        {deliveryCampaignText && (
          <p style={{ fontSize: '0.8rem', color: 'var(--text-light)', marginTop: '4px' }}>{deliveryCampaignText}</p>
        )}
      </div>

      {/* Banner de Personalización */}
      <section className="glass" style={{ padding: '25px', marginBottom: '40px', textAlign: 'center', background: 'linear-gradient(135deg, rgba(255, 107, 129, 0.08) 0%, rgba(229, 142, 38, 0.08) 100%)' }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '8px' }}>🎨 ¡Personaliza a tu gusto!</h2>
        <p style={{ color: 'var(--text-light)', marginBottom: '15px', maxWidth: '600px', margin: '0 auto 15px', fontSize: '0.9rem' }}>
          Elige cono o copa, añade todas las bolas de tus sabores favoritos y decóralo con toppings y jarabes en cada capa. ¡El helado de tus sueños listo en segundos!
        </p>
        <button className="btn btn-primary" onClick={() => setView('customizer')}>
          👉 Diseñar Helado Personalizado
        </button>
      </section>

      {/* Catálogo */}
      <section id="catalog" style={{ scrollMarginTop: '100px' }}>
        <h2 className="section-title">Nuestra Carta Helada</h2>
        <p className="section-subtitle">Frescura garantizada y entrega súper rápida hasta tu casa</p>

        {/* Filtros */}
        <div className="catalog-filters">
          <button 
            className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            🍨 Todo
          </button>
          <button 
            className={`filter-btn ${filter === 'classic' ? 'active' : ''}`}
            onClick={() => setFilter('classic')}
          >
            🍦 Helados Simples S/. 1.00
          </button>
          <button 
            className={`filter-btn ${filter === 'packs' ? 'active' : ''}`}
            onClick={() => setFilter('packs')}
          >
            🎁 Packs Combos
          </button>
        </div>

        {/* Grid de Productos */}
        <div className="catalog-grid">
          {/* Mostrar Helados Clásicos */}
          {(filter === 'all' || filter === 'classic') && activeFlavors.map(flavor => {
            const isPopular = flavor.isPopular === true;
            return (
              <div key={flavor.id} className="glass-card product-card">
                {isPopular && <span className="product-badge badge-popular">🔥 El Más Pedido</span>}
                {flavor.isPremium && !isPopular && <span className="product-badge badge-premium">✨ Premium</span>}
                
                {/* MODIFICADO: Ilustración de cono de helado SVG de alta calidad en la carta helada */}
                <div className="product-illustration" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '120px' }}>
                  <svg viewBox="0 0 100 120" width="90" height="108" style={{ display: 'block' }}>
                    <defs>
                      <filter id={`sh-${flavor.id}`} x="-10%" y="-10%" width="120%" height="120%">
                        <feDropShadow dx="0" dy="3" stdDeviation="3" floodOpacity="0.15" />
                      </filter>
                      <radialGradient id={`specular-${flavor.id}`} cx="30%" cy="30%" r="60%" fx="30%" fy="30%">
                        <stop offset="0%" stopColor="#ffffff" stopOpacity="0.8"/>
                        <stop offset="50%" stopColor="#ffffff" stopOpacity="0.2"/>
                        <stop offset="100%" stopColor="#ffffff" stopOpacity="0"/>
                      </radialGradient>
                      <radialGradient id={`shadow-${flavor.id}`} cx="70%" cy="70%" r="70%">
                        <stop offset="0%" stopColor="#000000" stopOpacity="0.35"/>
                        <stop offset="100%" stopColor="#000000" stopOpacity="0"/>
                      </radialGradient>
                      
                      <linearGradient id={`coneGrad-${flavor.id}`} x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#f3a683"/>
                        <stop offset="50%" stopColor="#cf8a4f"/>
                        <stop offset="100%" stopColor="#8d5624"/>
                      </linearGradient>
                      
                      <linearGradient id={`coneShadow-${flavor.id}`} x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#ffffff" stopOpacity="0.3" />
                        <stop offset="50%" stopColor="#ffffff" stopOpacity="0" />
                        <stop offset="100%" stopColor="#000000" stopOpacity="0.45" />
                      </linearGradient>
                      
                      <clipPath id={`cone-clip-${flavor.id}`}>
                        <path d="M32 63 L50 110 L68 63 Z" />
                      </clipPath>
                    </defs>
                    
                    {/* Sombra base */}
                    <ellipse cx="50" cy="114" rx="20" ry="3.5" fill="rgba(0,0,0,0.08)" />
                    
                    {/* Cono Waffle */}
                    <g filter={`url(#sh-${flavor.id})`}>
                      {/* Base Cone styled with clipPath */}
                      <g clipPath={`url(#cone-clip-${flavor.id})`}>
                        <path d="M32 63 L50 110 L68 63 Z" fill={`url(#coneGrad-${flavor.id})`} />
                        {/* Waffle Grid */}
                        <path d="M 10 30 L 80 100 M 10 40 L 80 110 M 10 20 L 80 90 M 10 10 L 80 80 M 10 50 L 80 120 M 10 0 L 80 70" stroke="#7a4b1c" strokeWidth="0.8" opacity="0.3" />
                        <path d="M 90 30 L 20 100 M 90 40 L 20 110 M 90 20 L 20 90 M 90 10 L 20 80 M 90 50 L 20 120 M 90 0 L 20 70" stroke="#7a4b1c" strokeWidth="0.8" opacity="0.3" />
                        {/* Cone 3D shadow overlay */}
                        <path d="M32 63 L50 110 L68 63 Z" fill={`url(#coneShadow-${flavor.id})`} />
                      </g>
                      {/* Outline borders */}
                      <path d="M32 63 L50 110 L68 63 Z" fill="none" stroke="#7a4b1c" strokeWidth="1" opacity="0.6" />
                    </g>
                    
                    {/* Bola de Helado con brillo 3D y faldón realista */}
                    <g filter={`url(#sh-${flavor.id})`}>
                      <circle cx="50" cy="46" r="24" fill={flavor.color} />
                      <circle cx="50" cy="46" r="24" fill={`url(#shadow-${flavor.id})`} />
                      <circle cx="50" cy="46" r="24" fill={`url(#specular-${flavor.id})`} />
                      <ellipse cx="42" cy="38" rx="8" ry="4" fill="white" opacity="0.25" transform="rotate(-15, 42, 38)" />
                      
                      {/* Dynamic Toppings */}
                      {renderDynamicToppings(flavor.id)}
                      
                      {/* Wavy Gelato faldón at the bottom of the scoop */}
                      <path d="M 25 58 Q 31 66 37 60 Q 43 67 50 61 Q 57 67 63 60 Q 69 66 75 58 Q 50 72 25 58 Z" fill={flavor.color} />
                      <path d="M 25 58 Q 31 66 37 60 Q 43 67 50 61 Q 57 67 63 60 Q 69 66 75 58 Q 50 72 25 58 Z" fill={`url(#shadow-${flavor.id})`} opacity="0.3" />
                    </g>
                  </svg>
                </div>

                <div className="product-info">
                  <div>
                    <h3>{flavor.name}</h3>
                    <p className="product-desc">{flavor.description}</p>
                  </div>
                  <div className="product-price-action">
                    <div className="price-tag">
                      S/. {flavor.price.toFixed(2)}
                      <span> / bola</span>
                    </div>
                    <button 
                      className="add-btn" 
                      title="Añadir helado simple de 1 bola al carrito"
                      onClick={() => handleAddClassicToCart(flavor)}
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Mostrar Packs */}
          {(filter === 'all' || filter === 'packs') && activePacks.map(pack => {
            const badgeClass = `badge-${pack.badge.toLowerCase().replace(/\s+/g, '-')}`;
            return (
              <div key={pack.id} className="glass-card product-card" style={{ borderColor: 'rgba(229, 142, 38, 0.2)' }}>
                {pack.badge && (
                  <span className={`product-badge ${badgeClass}`}>
                    {pack.badge}
                  </span>
                )}
                {/* MODIFICADO: Ilustración de caja de regalo SVG premium en lugar del emoji plano */}
                <div className="product-illustration">
                  <svg viewBox="0 0 100 100" width="90" height="90" style={{ display: 'block', margin: '0 auto' }}>
                    <defs>
                      <linearGradient id="boxGrad" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#ff4757" />
                        <stop offset="100%" stopColor="#ff1f3b" />
                      </linearGradient>
                      <linearGradient id="lidGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#ff6b81" />
                        <stop offset="100%" stopColor="#ff3855" />
                      </linearGradient>
                      <linearGradient id="ribbonGrad" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#eccc68" />
                        <stop offset="100%" stopColor="#ff7f50" />
                      </linearGradient>
                      <linearGradient id="goldGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#ffa502" />
                        <stop offset="100%" stopColor="#ff7f50" />
                      </linearGradient>
                      <filter id="giftShadow" x="-10%" y="-10%" width="120%" height="120%">
                        <feDropShadow dx="0" dy="3" stdDeviation="3" floodOpacity="0.15" />
                      </filter>
                    </defs>

                    <ellipse cx="50" cy="88" rx="28" ry="5" fill="rgba(0,0,0,0.1)" />

                    <g filter="url(#giftShadow)">
                      <rect x="18" y="42" width="64" height="6" rx="1" fill="rgba(0,0,0,0.15)" />
                      <rect x="22" y="44" width="56" height="40" rx="3" fill="url(#boxGrad)" />
                      <rect x="44" y="44" width="12" height="40" fill="url(#ribbonGrad)" />
                      <rect x="18" y="34" width="64" height="10" rx="2" fill="url(#lidGrad)" />
                      <rect x="44" y="34" width="12" height="10" fill="url(#ribbonGrad)" />
                      <path d="M 45 34 C 30 24, 30 12, 45 22 Z" fill="url(#goldGrad)" stroke="#ff7f50" strokeWidth="0.8" />
                      <path d="M 55 34 C 70 24, 70 12, 55 22 Z" fill="url(#goldGrad)" stroke="#ff7f50" strokeWidth="0.8" />
                      <path d="M 45 34 C 40 40, 32 45, 34 52" fill="none" stroke="url(#goldGrad)" strokeWidth="3" strokeLinecap="round" />
                      <path d="M 55 34 C 60 40, 68 45, 66 52" fill="none" stroke="url(#goldGrad)" strokeWidth="3" strokeLinecap="round" />
                      <rect x="43" y="24" width="14" height="10" rx="3" fill="url(#goldGrad)" stroke="#d5822b" strokeWidth="0.8" />
                    </g>
                  </svg>
                </div>
                <div className="product-info">
                  <div>
                    <h3>{pack.name}</h3>
                    <p className="product-desc">{pack.description}</p>
                    <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--primary-color)', marginBottom: '15px' }}>
                      📦 Incluye: {pack.items}
                    </p>
                  </div>
                  <div className="product-price-action">
                    <div className="price-tag">
                      S/. {pack.price.toFixed(2)}
                      <div style={{ fontSize: '0.75rem', color: 'var(--success)', fontWeight: 600 }}>
                        {pack.discountText}
                      </div>
                    </div>
                    <button 
                      className="add-btn" 
                      style={{ backgroundColor: 'var(--secondary-color)' }}
                      title="Añadir pack al carrito"
                      onClick={() => handleAddPackToCart(pack)}
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
