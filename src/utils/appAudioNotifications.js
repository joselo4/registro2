/**
 * Sistema Unificado de Notificaciones, Sonidos Web Audio API y Vibración Háptica para Android / Web
 * Diseñado para operar en APKs de Android (WebView), navegadores móviles y escritorio sin dependencias externas.
 */

// AudioContext singleton para reactivar y compartir entre eventos
let sharedAudioCtx = null;

export const getAudioContext = () => {
  if (typeof window === 'undefined') return null;
  const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtxClass) return null;

  if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
    sharedAudioCtx = new AudioCtxClass();
  }
  if (sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
};

// Desbloqueo automático al primer toque del usuario (requisito de políticas de autoplay en Android/Chrome)
export const setupAudioUnlocker = () => {
  if (typeof window === 'undefined') return;
  const unlock = () => {
    try {
      const ctx = getAudioContext();
      if (ctx && ctx.state === 'suspended') {
        ctx.resume();
      }
    } catch {
      // Ignorar errores en navegadores restrictivos
    } finally {
      window.removeEventListener('click', unlock);
      window.removeEventListener('touchstart', unlock);
    }
  };
  window.addEventListener('click', unlock, { once: true });
  window.addEventListener('touchstart', unlock, { once: true });
};

/**
 * Vibración háptica física en dispositivos Android (APK o navegador)
 */
export const triggerDeviceVibration = (pattern = [200, 100, 200]) => {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate(pattern);
    } catch {
      /* ignore */
    }
  }
};

/**
 * Sonido 1: Nuevo Pedido por Corroborar / Alerta de Entrada
 * Acorde ascendente brillante y llamativo de 3 notas (Do5 -> Mi5 -> Sol5)
 */
export const playNewOrderSound = () => {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const notes = [
      { freq: 523.25, time: 0.00, dur: 0.22 }, // C5
      { freq: 659.25, time: 0.12, dur: 0.22 }, // E5
      { freq: 783.99, time: 0.24, dur: 0.45 }  // G5
    ];

    notes.forEach(n => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(n.freq, now + n.time);
      
      gain.gain.setValueAtTime(0.28, now + n.time);
      gain.gain.exponentialRampToValueAtTime(0.001, now + n.time + n.dur);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + n.time);
      osc.stop(now + n.time + n.dur);
    });
  } catch (err) {
    console.warn('Audio nuevo pedido no disponible:', err);
  }
};

/**
 * Sonido 2: Repartidor Asignado / Despacho a Ruta
 * Toque de dos tonos estilo corneta / bocina ágil de despacho (Re5 -> La5 -> Re6)
 */
export const playDriverAssignedSound = () => {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const sequence = [
      { freq: 587.33, start: 0.00, dur: 0.14 }, // D5
      { freq: 880.00, start: 0.12, dur: 0.18 }, // A5
      { freq: 1174.66, start: 0.28, dur: 0.35 } // D6
    ];

    sequence.forEach(s => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(s.freq, now + s.start);

      gain.gain.setValueAtTime(0.25, now + s.start);
      gain.gain.exponentialRampToValueAtTime(0.001, now + s.start + s.dur);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + s.start);
      osc.stop(now + s.start + s.dur);
    });
  } catch (err) {
    console.warn('Audio despacho no disponible:', err);
  }
};

/**
 * Sonido 3: Cocina / Preparación de Pedido
 * Timbre de comanda gastronómica (Fa5 + Do6 sostenido)
 */
export const playKitchenSound = () => {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(698.46, now); // F5
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1046.50, now); // C6

    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.65);
    osc2.stop(now + 0.65);
  } catch (err) {
    console.warn('Audio cocina no disponible:', err);
  }
};

/**
 * Sonido 4: Recordatorio de Cobro en Efectivo
 * Doble campana de atención para recordar cobrar antes de soltar el producto
 */
export const playCashReminderSound = () => {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    [0, 0.16].forEach(delay => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(783.99, now + delay); // G5
      gain.gain.setValueAtTime(0.3, now + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.18);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + delay);
      osc.stop(now + delay + 0.18);
    });
  } catch (err) {
    console.warn('Audio cobro en efectivo no disponible:', err);
  }
};

/**
 * Sonido 5: Pago Verificado / Éxito
 * Sonido de caja registradora / validación exitosa (Si5 -> Mi6)
 */
export const playPaymentVerifiedSound = () => {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(987.77, now); // B5
    osc.frequency.exponentialRampToValueAtTime(1318.51, now + 0.15); // E6

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.45);
  } catch (err) {
    console.warn('Audio pago verificado no disponible:', err);
  }
};

/**
 * Sonido 6: Solicitud de Atención en Mesa (Mozo)
 */
export const playWaiterCallSound = () => {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(587.33, now); // D5
    osc.frequency.exponentialRampToValueAtTime(880.00, now + 0.16); // A5

    gain.gain.setValueAtTime(0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.6);
  } catch (err) {
    console.warn('Audio llamado mozo no disponible:', err);
  }
};

/**
 * Notificación Push del Sistema (Android / Navegador)
 */
export const triggerSystemNotification = (title, options = {}) => {
  if (typeof window === 'undefined' || !window.Notification) return;

  if (window.Notification.permission === 'granted') {
    try {
      new window.Notification(title, {
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        ...options
      });
    } catch {
      /* ignore */
    }
  } else if (window.Notification.permission === 'default') {
    try {
      window.Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          try {
            new window.Notification(title, {
              icon: '/favicon.ico',
              badge: '/favicon.ico',
              ...options
            });
          } catch {
            /* ignore */
          }
        }
      }).catch(() => {});
    } catch {
      /* ignore */
    }
  }
};

/**
 * Despachador de Evento Operativo Integral
 * Coordina Audio + Vibración Háptica en Android + Notificación Push
 */
export const notifyOperationalEvent = (eventType, payload = {}) => {
  const {
    order,
    title,
    body,
    soundEnabled = true,
    storeName = 'Don Helado'
  } = payload;

  switch (eventType) {
    case 'por_corroborar':
    case 'new_order': {
      if (soundEnabled) playNewOrderSound();
      triggerDeviceVibration([300, 120, 300, 120, 450]);
      const notifTitle = title || `🔔 ¡Nuevo Pedido por Corroborar! (${storeName})`;
      const notifBody = body || (order
        ? `Pedido #${order.id} de ${order.customer?.name || 'Cliente'} - Total: S/. ${Number(order.grandTotal || 0).toFixed(2)} [${order.customer?.paymentMethod || 'Pago'}]`
        : 'Revisa y valida el pedido para enviarlo a cocina.');
      triggerSystemNotification(notifTitle, { body: notifBody, tag: `order_${order?.id || Date.now()}` });
      break;
    }

    case 'driver_assigned': {
      if (soundEnabled) playDriverAssignedSound();
      triggerDeviceVibration([250, 100, 250, 100, 350]);
      const notifTitle = title || `🛵 ¡Nuevo Reparto Asignado! (${storeName})`;
      const notifBody = body || (order
        ? `Pedido #${order.id} para ${order.customer?.name || 'Cliente'}. Dirección: ${order.customer?.address || 'Por coordinar'}`
        : 'Tienes un nuevo pedido listo para entrega.');
      triggerSystemNotification(notifTitle, { body: notifBody, tag: `driver_${order?.id || Date.now()}` });
      break;
    }

    case 'kitchen_prep': {
      if (soundEnabled) playKitchenSound();
      triggerDeviceVibration([200, 100, 200]);
      const notifTitle = title || `👨‍🍳 ¡A Cocina! Preparar Pedido #${order?.id || ''}`;
      const notifBody = body || (order
        ? `${order.items?.length || 1} producto(s) para ${order.customer?.orderType || 'Mesa/Delivery'}`
        : 'Nueva orden para preparar.');
      triggerSystemNotification(notifTitle, { body: notifBody, tag: `kitchen_${order?.id || Date.now()}` });
      break;
    }

    case 'cash_reminder': {
      if (soundEnabled) playCashReminderSound();
      triggerDeviceVibration([200, 100, 200, 100, 300]);
      const notifTitle = title || `💰 Recordatorio: Cobro en Efectivo (${storeName})`;
      const notifBody = body || (order
        ? `¡Recuerda cobrar S/. ${Number(order.grandTotal || 0).toFixed(2)} en efectivo a ${order.customer?.name || 'cliente'}!`
        : 'Recuerda cobrar el total en efectivo.');
      triggerSystemNotification(notifTitle, { body: notifBody, tag: `cash_${order?.id || Date.now()}` });
      break;
    }

    case 'payment_verified': {
      if (soundEnabled) playPaymentVerifiedSound();
      triggerDeviceVibration([150, 80, 150]);
      break;
    }

    case 'waiter_call': {
      if (soundEnabled) playWaiterCallSound();
      triggerDeviceVibration([250, 100, 250]);
      const notifTitle = title || `🛎️ Solicitud de Atención en Mesa`;
      const notifBody = body || 'Un cliente solicita atención del mozo.';
      triggerSystemNotification(notifTitle, { body: notifBody, tag: `call_${Date.now()}` });
      break;
    }

    default: {
      if (soundEnabled) playNewOrderSound();
      triggerDeviceVibration([200, 100, 200]);
    }
  }
};
