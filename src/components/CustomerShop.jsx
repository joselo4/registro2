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
                {isPopular && <span className="product-badge" style={{ backgroundColor: 'var(--primary-color)' }}>🔥 El Más Pedido</span>}
                {flavor.isPremium && !isPopular && <span className="product-badge">Premium</span>}
                
                {/* MODIFICADO: Ilustración de cono de helado SVG de alta calidad en la carta helada */}
                <div className="product-illustration" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '120px' }}>
                  <svg viewBox="0 0 100 120" width="80" height="96" style={{ display: 'block' }}>
                    <defs>
                      <filter id={`sh-${flavor.id}`} x="-10%" y="-10%" width="120%" height="120%">
                        <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity="0.1" />
                      </filter>
                    </defs>
                    
                    {/* Sombra base */}
                    <ellipse cx="50" cy="112" rx="18" ry="3" fill="rgba(0,0,0,0.06)" />
                    
                    {/* Cono Waffle */}
                    <g filter={`url(#sh-${flavor.id})`}>
                      <path d="M35 65 L50 110 L65 65 Z" fill="#d4a373" stroke="#b0845a" strokeWidth="1.2" />
                      {/* Dibujo de rejilla del waffle cono */}
                      <path d="M35 65 L50 110 M40 65 L50 110 M45 65 L50 110 M55 65 L50 110 M60 65 L50 110" stroke="#b0845a" strokeWidth="0.6" opacity="0.4" />
                      <path d="M35 72 H65 M37 82 H63 M40 92 H60 M43 102 H57" stroke="#b0845a" strokeWidth="0.6" opacity="0.4" />
                    </g>
                    
                    {/* Bola de Helado con brillo 3D y faldón realista */}
                    <g filter={`url(#sh-${flavor.id})`}>
                      <circle cx="50" cy="50" r="22" fill={flavor.color} />
                      <ellipse cx="44" cy="42" rx="8" ry="4" fill="white" opacity="0.25" transform="rotate(-15, 44, 42)" />
                      <path d="M 28 53 Q 39 59 50 53 Q 61 59 72 53 Q 50 63 28 53" fill={flavor.color} opacity="0.9" />
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
            const isBestDeal = pack.id === 'pack_ahorro';
            return (
              <div key={pack.id} className="glass-card product-card" style={{ borderColor: 'rgba(229, 142, 38, 0.2)' }}>
                {pack.badge && (
                  <span className="product-badge" style={{ backgroundColor: isBestDeal ? 'var(--success)' : 'var(--secondary-color)' }}>
                    {pack.badge}
                  </span>
                )}
                <div className="product-illustration" style={{ fontSize: '5rem' }}>
                  🎁
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
