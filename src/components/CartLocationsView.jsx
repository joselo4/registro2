import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Geolocation } from '@capacitor/geolocation';

const DEFAULT_CENTER = [-12.0464, -77.0428];
const UPDATE_INTERVAL_MS = 10 * 60 * 1000;
const DEFAULT_EMPTY_MESSAGE = 'Nuestros carritos saldran pronto a la calle. Mientras tanto, puedes pedir por delivery y recibir tus helados en casa.';
const DEFAULT_EMPTY_BUTTON = 'Ver carta y pedir delivery';

const normalizeText = (value) => (typeof value === 'string' ? value.trim().toLowerCase() : '');

const hasCoords = (cart) => Number.isFinite(Number(cart?.lat)) && Number.isFinite(Number(cart?.lng));

const toPosition = async () => {
  try {
    if (typeof Geolocation !== 'undefined') {
      try {
        const check = await Geolocation.checkPermissions();
        if (check.location !== 'granted') {
          await Geolocation.requestPermissions();
        }
      } catch (err) {
        console.warn("Capacitor permissions request not supported or failed:", err);
      }
    }
    return await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 12000,
      maximumAge: 0
    });
  } catch (nativeError) {
    if (navigator?.geolocation) {
      return await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 12000,
          maximumAge: 0
        });
      });
    }
    throw nativeError;
  }
};

const formatTime = (dateIso) => {
  if (!dateIso) return 'Sin datos';
  const date = new Date(dateIso);
  if (Number.isNaN(date.getTime())) return 'Sin datos';
  return date.toLocaleString('es-PE', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const createMarkerIcon = (cart, isMine = false) => {
  const color = isMine ? '#2ecc71' : '#ff6b81';
  const label = (cart?.label || cart?.name || 'Carrito').slice(0, 1).toUpperCase();

  return L.divIcon({
    className: 'cart-location-marker',
    html: `
      <div style="
        width: 28px;
        height: 28px;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        background: ${color};
        border: 3px solid white;
        box-shadow: 0 6px 16px rgba(0,0,0,0.24);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <span style="transform: rotate(45deg); color: white; font-size: 0.7rem; font-weight: 700;">${label}</span>
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -28]
  });
};

export default function CartLocationsView({
  mode = 'public',
  currentUser,
  cartLocations,
  onUpdateCartLocations,
  shopConfig = {},
  staffPermissions = {},
  showAlert,
  onGoToShop
}) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersLayerRef = useRef(null);
  const updateTimerRef = useRef(null);
  const currentCartIdRef = useRef(null);
  const justClickedRef = useRef(false);
  const [cartLabel, setCartLabel] = useState('');
  const [isSharing, setIsSharing] = useState(false);
  const [isLoadingPosition, setIsLoadingPosition] = useState(false);
  const [mapError, setMapError] = useState('');
  const [isInitialized, setIsInitialized] = useState(false);

  const normalizedEmail = normalizeText(currentUser?.email);
  const permissions = Array.isArray(staffPermissions?.[currentUser?.email])
    ? staffPermissions[currentUser.email]
    : Array.isArray(staffPermissions?.[normalizedEmail])
      ? staffPermissions[normalizedEmail]
      : [];

  const canManageLocation = Boolean(
    mode !== 'public' &&
    currentUser &&
    (
      normalizeText(currentUser?.role).includes('admin') ||
      permissions.includes('locations') ||
      permissions.includes('location_tracking')
    )
  );

  const visibleCarts = useMemo(() => {
    const list = Array.isArray(cartLocations?.carts) ? cartLocations.carts : [];
    return list
      .filter(Boolean)
      .filter(hasCoords)
      .filter(cart => (mode === 'public' ? cart.active === true : true))
      .sort((a, b) => new Date(b.updatedAt || b.lastUpdated || 0) - new Date(a.updatedAt || a.lastUpdated || 0));
  }, [cartLocations, mode]);

  const ownCart = useMemo(() => {
    if (!currentUser) return null;
    const list = Array.isArray(cartLocations?.carts) ? cartLocations.carts : [];
    return list.find(cart => normalizeText(cart.email) === normalizedEmail) || null;
  }, [cartLocations, currentUser, normalizedEmail]);

  // Reset initialization when user changes
  useEffect(() => {
    setIsInitialized(false);
  }, [normalizedEmail]);

  // Load the saved cart label only once on mount/user change
  useEffect(() => {
    if (isInitialized) return;
    if (ownCart?.label) {
      setCartLabel(ownCart.label);
      setIsInitialized(true);
    } else if (currentUser?.name) {
      setCartLabel(currentUser.name);
      setIsInitialized(true);
    }
  }, [ownCart, currentUser, normalizedEmail, isInitialized]);

  // Sync isSharing and currentCartIdRef when the database values update
  useEffect(() => {
    if (ownCart) {
      setIsSharing(ownCart.active === true);
      currentCartIdRef.current = ownCart.id || ownCart.email || normalizedEmail;
    } else {
      setIsSharing(false);
    }
  }, [ownCart?.active, ownCart?.id, ownCart?.email, normalizedEmail]);

  const persistCart = (nextCart) => {
    if (!onUpdateCartLocations) return;
    const currentList = Array.isArray(cartLocations?.carts) ? cartLocations.carts : [];
    const nextId = nextCart.id || nextCart.email || '';
    const nextList = currentList.filter(cart => (cart.id || cart.email || '') !== nextId);

    nextList.unshift(nextCart);
    onUpdateCartLocations({
      updatedAt: new Date().toISOString(),
      carts: nextList
    });
  };

  const handleLabelBlur = () => {
    const trimmed = cartLabel.trim();
    if (isSharing && ownCart && trimmed && trimmed !== ownCart.label) {
      const nextCart = {
        ...ownCart,
        label: trimmed,
        updatedAt: new Date().toISOString()
      };
      persistCart(nextCart);
    }
  };

  const stopSharing = () => {
    const cartId = ownCart?.id || currentCartIdRef.current || normalizedEmail;
    const nextCart = {
      id: cartId,
      email: currentUser?.email || ownCart?.email || '',
      name: currentUser?.name || ownCart?.name || 'Vendedor',
      role: currentUser?.role || ownCart?.role || 'Vendedor',
      label: cartLabel.trim() || ownCart?.label || currentUser?.name || 'Carrito',
      active: false,
      lat: ownCart?.lat ?? null,
      lng: ownCart?.lng ?? null,
      updatedAt: new Date().toISOString()
    };
    persistCart(nextCart);
    setIsSharing(false);
    if (updateTimerRef.current) {
      clearInterval(updateTimerRef.current);
      updateTimerRef.current = null;
    }
    showAlert?.('Ubicacion pausada', 'Tu carrito dejo de compartir posicion.', 'success');
  };

  const shareCurrentPosition = async () => {
    if (!canManageLocation || !onUpdateCartLocations) return;
    if (shopConfig?.locationTrackingEnabled === false) {
      showAlert?.('Funcion desactivada', 'El administrador desactivo el servicio de ubicacion.', 'warning');
      return;
    }

    setIsLoadingPosition(true);
    justClickedRef.current = true;
    try {
      const position = await toPosition();
      const coords = position.coords || position;
      const nextCart = {
        id: ownCart?.id || normalizedEmail || currentUser?.email,
        email: currentUser?.email,
        name: currentUser?.name || currentUser?.email || 'Vendedor',
        role: currentUser?.role || 'Vendedor',
        label: cartLabel.trim() || currentUser?.name || 'Carrito',
        active: true,
        lat: coords.latitude,
        lng: coords.longitude,
        accuracy: coords.accuracy ?? null,
        heading: coords.heading ?? null,
        speed: coords.speed ?? null,
        updatedAt: new Date().toISOString()
      };
      persistCart(nextCart);
      currentCartIdRef.current = nextCart.id;
      setIsSharing(true);
      showAlert?.('Ubicacion compartida', 'Tu carrito ya aparece en el mapa publico.', 'success');

      // Reset the 10-minute timer countdown so it starts fresh from this manual update!
      if (updateTimerRef.current) {
        clearInterval(updateTimerRef.current);
      }
      updateTimerRef.current = setInterval(() => {
        shareCurrentPositionRef.current();
      }, UPDATE_INTERVAL_MS);
    } catch {
      showAlert?.('No se pudo obtener la ubicacion', 'Activa el permiso de ubicacion del vendedor para continuar.', 'error');
    } finally {
      setIsLoadingPosition(false);
    }
  };

  const shareCurrentPositionRef = useRef(shareCurrentPosition);
  useEffect(() => {
    shareCurrentPositionRef.current = shareCurrentPosition;
  }, [shareCurrentPosition]);

  useEffect(() => {
    if (!canManageLocation || !isSharing) return;
    if (updateTimerRef.current) clearInterval(updateTimerRef.current);
    
    // Only execute immediately if it was NOT a manual click (e.g. on page mount/load)
    if (!justClickedRef.current) {
      shareCurrentPositionRef.current();
    } else {
      justClickedRef.current = false;
    }

    updateTimerRef.current = setInterval(() => {
      shareCurrentPositionRef.current();
    }, UPDATE_INTERVAL_MS);
    return () => {
      if (updateTimerRef.current) {
        clearInterval(updateTimerRef.current);
        updateTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManageLocation, isSharing, shopConfig?.locationTrackingEnabled]);

  useEffect(() => {
    if (!mapRef.current) return;

    try {
      setMapError('');

      if (!mapInstanceRef.current) {
        mapInstanceRef.current = L.map(mapRef.current, {
          zoomControl: true,
          scrollWheelZoom: false
        }).setView(DEFAULT_CENTER, 12);

        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap'
        }).addTo(mapInstanceRef.current);

        markersLayerRef.current = L.layerGroup().addTo(mapInstanceRef.current);
      }

      const map = mapInstanceRef.current;
      const layer = markersLayerRef.current;
      if (!layer || !map) throw new Error('No se pudo inicializar el mapa.');

      layer.clearLayers();

      const bounds = [];
      visibleCarts.forEach((cart) => {
        const lat = Number(cart.lat);
        const lng = Number(cart.lng);
        bounds.push([lat, lng]);
        const popupHtml = `
          <div style="min-width: 180px;">
            <strong>${cart.label || cart.name || 'Carrito'}</strong><br/>
            <span>Actualizacion: ${formatTime(cart.updatedAt || cart.lastUpdated)}</span>
          </div>
        `;
        L.marker([lat, lng], {
          icon: createMarkerIcon(cart, normalizeText(cart.email) === normalizedEmail)
        }).bindPopup(popupHtml).addTo(layer);
      });

      if (bounds.length > 0) {
        map.fitBounds(bounds, { padding: [30, 30] });
      } else {
        map.setView(DEFAULT_CENTER, 12);
      }

      setTimeout(() => map.invalidateSize(), 50);
    } catch (err) {
      console.warn('Mapa de carritos no disponible:', err?.message || err);
      setMapError('El mapa no pudo cargarse en este dispositivo. Puedes usar la lista de carritos visibles.');
    }
  }, [visibleCarts, normalizedEmail]);

  useEffect(() => {
    return () => {
      if (updateTimerRef.current) clearInterval(updateTimerRef.current);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  const trackingDisabled = shopConfig?.locationTrackingEnabled === false;
  const emptyMessage = shopConfig?.locationUnavailableMessage || DEFAULT_EMPTY_MESSAGE;
  const emptyButton = shopConfig?.locationUnavailableButtonText || DEFAULT_EMPTY_BUTTON;
  const showPublicEmptyState = mode === 'public' && (trackingDisabled || visibleCarts.length === 0);

  return (
    <section className="glass" style={{ padding: '18px', marginBottom: '20px' }}>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes location-pulse-dot {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.4); opacity: 0.4; }
          100% { transform: scale(1); opacity: 1; }
        }
      ` }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
        <div>
          <h2 style={{ marginBottom: '4px' }}>
            {mode === 'public' ? 'Sabes donde esta tu helado mas cercano' : 'Ubicacion de carritos'}
          </h2>
          <p style={{ color: 'var(--text-light)', fontSize: '0.92rem' }}>
            {mode === 'public'
              ? 'Mira los carritos disponibles. No pedimos la ubicacion del cliente.'
              : 'Comparte o pausa la posicion del carrito desde el celular del vendedor.'}
          </p>
        </div>
        <div style={{ minWidth: '180px', textAlign: 'right' }}>
          <div style={{ fontWeight: 700, color: 'var(--primary-color)' }}>{visibleCarts.length} carritos en mapa</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-light)' }}>Actualizacion cada 10 min</div>
        </div>
      </div>

      {mode !== 'public' && (
        <div className="glass-card" style={{ padding: '14px', marginBottom: '14px', background: 'rgba(255,255,255,0.4)' }}>
          {!canManageLocation ? (
            <div style={{ color: 'var(--danger)', fontWeight: 600 }}>No tienes permiso para compartir ubicacion.</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '10px', alignItems: 'end' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px', flexWrap: 'wrap' }}>
                  <label style={{ margin: 0 }}>Nombre visible del carrito</label>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '3px 8px',
                    borderRadius: '12px',
                    fontSize: '0.72rem',
                    fontWeight: 'bold',
                    background: isSharing ? 'rgba(46, 204, 113, 0.15)' : 'rgba(231, 76, 60, 0.15)',
                    color: isSharing ? '#2ecc71' : '#e74c3c',
                    border: '1px solid currentColor'
                  }}>
                    <span style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: 'currentColor',
                      animation: isSharing ? 'location-pulse-dot 1.5s infinite' : 'none',
                      display: 'inline-block'
                    }} />
                    {isSharing ? 'Transmitiendo en vivo' : 'Transmisión pausada'}
                  </span>
                </div>
                <input
                  className="form-control"
                  value={cartLabel}
                  onChange={(e) => setCartLabel(e.target.value)}
                  onBlur={handleLabelBlur}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleLabelBlur(); e.target.blur(); } }}
                  placeholder="Carrito Centro"
                />
                <small style={{ color: 'var(--text-light)', display: 'block', marginTop: '4px' }}>Ahorro de bateria activo: la ubicacion se envia cada 10 minutos.</small>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  className="btn btn-primary"
                  type="button"
                  onClick={shareCurrentPosition}
                  disabled={shopConfig?.locationTrackingEnabled === false || isLoadingPosition}
                >
                  {isLoadingPosition ? 'Actualizando...' : isSharing ? 'Actualizar ahora' : 'Compartir ubicacion'}
                </button>
                <button
                  className="btn btn-secondary"
                  type="button"
                  onClick={stopSharing}
                  disabled={!isSharing}
                >
                  Pausar
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {showPublicEmptyState ? (
        <div className="glass-card" style={{
          padding: '30px 20px',
          textAlign: 'center',
          background: 'linear-gradient(135deg, rgba(255, 107, 129, 0.12) 0%, rgba(229, 142, 38, 0.12) 100%)',
          border: '2px dashed var(--primary-color)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-md)',
          maxWidth: '650px',
          margin: '20px auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '12px'
        }}>
          <span style={{ fontSize: '3rem', animation: 'float 3s ease-in-out infinite' }}>🚚💨</span>
          <h3 style={{ fontFamily: 'var(--font-title)', color: 'var(--primary-color)', fontSize: '1.4rem', fontWeight: 'bold', margin: 0 }}>
            ¡Helados en camino a tu puerta!
          </h3>
          <div style={{ color: 'var(--text-dark)', maxWidth: '520px', margin: '0 auto', fontSize: '0.95rem', lineHeight: '1.5' }}>
            {emptyMessage}
          </div>
          {onGoToShop && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={onGoToShop}
              style={{
                marginTop: '8px',
                padding: '12px 24px',
                fontSize: '0.95rem',
                fontWeight: 'bold',
                borderRadius: 'var(--radius-full)',
                boxShadow: '0 4px 15px rgba(255, 107, 129, 0.35)',
                cursor: 'pointer'
              }}
            >
              {emptyButton}
            </button>
          )}
        </div>
      ) : mapError ? (
        <div className="glass-card" style={{ padding: '22px' }}>
          <strong style={{ display: 'block', marginBottom: '8px' }}>Mapa temporalmente no disponible</strong>
          <div style={{ color: 'var(--text-light)', marginBottom: '14px' }}>{mapError}</div>
          <div style={{ display: 'grid', gap: '10px' }}>
            {visibleCarts.length === 0 ? (
              <div style={{ color: 'var(--text-light)' }}>Aun no hay carritos con ubicacion compartida.</div>
            ) : visibleCarts.map((cart) => (
              <div key={cart.id || cart.email || `${cart.lat}-${cart.lng}`} className="glass" style={{ padding: '12px', borderRadius: '12px', background: 'rgba(255,255,255,0.35)' }}>
                <strong>{cart.label || cart.name || 'Carrito'}</strong>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-light)' }}>
                  Ultima ubicacion: {formatTime(cart.updatedAt || cart.lastUpdated)}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div style={{ marginBottom: '12px' }}>
            <div
              ref={mapRef}
              style={{
                width: '100%',
                height: mode === 'public' ? '360px' : '420px',
                borderRadius: '12px',
                overflow: 'hidden',
                border: '1px solid var(--border-color)'
              }}
            />
          </div>

          <div className="glass-card" style={{ padding: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <strong>Carritos visibles</strong>
              <span style={{ color: 'var(--text-light)', fontSize: '0.8rem' }}>Cada vendedor decide si comparte su posicion.</span>
            </div>
            <div style={{ display: 'grid', gap: '10px' }}>
              {visibleCarts.length === 0 ? (
                <div style={{ color: 'var(--text-light)' }}>Aun no hay carritos con ubicacion compartida.</div>
              ) : visibleCarts.map((cart) => (
                <div key={cart.id || cart.email || `${cart.lat}-${cart.lng}`} className="glass" style={{ padding: '12px', borderRadius: '12px', background: 'rgba(255,255,255,0.35)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                    <div>
                      <strong>{cart.label || cart.name || 'Carrito'}</strong>
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-light)' }}>
                        Ultima ubicacion: {formatTime(cart.updatedAt || cart.lastUpdated)}
                      </div>
                    </div>
                    {mode === 'public' && (
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${cart.lat},${cart.lng}`}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-secondary"
                        style={{ padding: '8px 14px', textDecoration: 'none' }}
                      >
                        Como llegar
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
