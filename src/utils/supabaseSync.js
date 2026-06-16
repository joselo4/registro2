import { supabase } from './supabaseClient';

// ─── Caché en memoria para reducir egress de Supabase ───────────────────────
// Solo almacena datos por 5 minutos. Si hay un cambio en tiempo real, se invalida.
const _syncCache = { admin: null, client: null };
const _syncCacheTime = { admin: 0, client: 0 };
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

export const invalidateSyncCache = () => {
  _syncCache.admin = null;
  _syncCache.client = null;
  _syncCacheTime.admin = 0;
  _syncCacheTime.client = 0;
};

// Cola de timeouts para debouncing de escrituras por llave
const _writeTimeouts = {};
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Obtiene todos los datos sincronizados desde Supabase de forma segura.
 * Si es administrador y tiene sesión activa, utiliza consultas directas protegidas por RLS.
 * Si es cliente, descarga únicamente las configuraciones públicas de la tienda.
 */
export const fetchSyncedData = async (isAdmin = false) => {
  if (!supabase) return null;

  // ─── Caching for public clients (massive scaling) ──────────────────────────
  const now = Date.now();
  if (!isAdmin && _syncCache.client && (now - _syncCacheTime.client < 30000)) {
    console.log("🔌 Retornando datos públicos de heladería desde caché...");
    return _syncCache.client;
  }



  try {
    let syncData = {};
    let isSessionAdmin = false;

    // Verificar si hay una sesión activa de Supabase Auth de forma segura
    let session = null;
    try {
      const { data } = await supabase.auth.getSession();
      session = data?.session || null;
    } catch (authErr) {
      console.warn("⚠️ Supabase Sync: Error al obtener sesión en fetch:", authErr.message);
    }
    if (session) {
      isSessionAdmin = true;
    }

    if (isAdmin && isSessionAdmin) {
      console.log("🔌 Solicitando datos administrativos seguros mediante consulta directa (Supabase Auth activa)...");
      const { data, error } = await supabase.from('helados_sync').select('*');
      if (error) throw error;
      if (data && data.length > 0) {
        data.forEach(row => {
          syncData[row.key] = row.value;
        });
      }
    } else {
      // Caso de uso público (Clientes): cargar únicamente la configuración general no sensible
      console.log("🔌 Cargando configuración pública de la tienda...");
      const publicKeys = [
        'store_name', 
        'store_logo', 
        'store_title',
        'store_favicon',
        'store_phone', 
        'store_instagram',
        'store_facebook',
        'whatsapp_contact_message',
        'shop_open',
        'catalog_order', 
        'flavors', 
        'toppings', 
        'bases', 
        'packs', 
        'coupons',
        'delivery_fee', 
        'free_delivery_threshold', 
        'delivery_campaign_text',
        'sound_enabled', 
        'whatsapp_greeting', 
        'whatsapp_footer', 
        'qr_custom_url', 
        'recommendations', 
        'cart_recommended_pack', 
        'liter_config', 
        'ticket_custom_message',
        'cart_locations',
        'store_hero_image',
        'meta_pixel_id',
        'google_analytics_id'
      ];

      const { data, error } = await supabase
        .from('helados_sync')
        .select('*')
        .in('key', publicKeys);

      if (error) throw error;

      if (data && data.length > 0) {
        data.forEach(row => {
          syncData[row.key] = row.value;
        });
      }
    }

    // Guardar en caché antes de retornar para optimizar solicitudes concurrentes
    if (isAdmin && isSessionAdmin) {
      _syncCache.admin = syncData;
      _syncCacheTime.admin = now;
    } else {
      _syncCache.client = syncData;
      _syncCacheTime.client = now;
    }

    return syncData;
  } catch (err) {
    console.warn("⚠️ Supabase Sync: Fetch fallido. Usando datos locales.", err.message);
    return null;
  }
};

/**
 * Guarda o actualiza un registro clave-valor de forma segura.
 * Si el usuario es administrador autenticado mediante JWT, hace un upsert directo.
 * Si es administrador mediante credenciales heredadas, usa RPC cifrado.
 * Si es una acción pública (ej: un cliente registrando un pedido), realiza un upsert directo validado por RLS.
 */
export const updateSyncedData = async (key, value) => {
  if (!supabase) return false;

  // Si la llave no requiere debouncing (ej: creación de pedidos 'order_'), se ejecuta inmediatamente.
  const shouldDebounce = !key.startsWith('order_');

  if (shouldDebounce) {
    if (_writeTimeouts[key]) {
      clearTimeout(_writeTimeouts[key]);
    }

    return new Promise((resolve) => {
      _writeTimeouts[key] = setTimeout(async () => {
        delete _writeTimeouts[key];
        const res = await _executeUpsert(key, value);
        resolve(res);
      }, 800); // 800ms de retraso para agrupar escrituras concurrentes
    });
  } else {
    return _executeUpsert(key, value);
  }
};

const updatePublicOrder = async (key, value) => {
  const id = String(key || '').replace(/^order_/, '');
  const response = await fetch('/api/order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, order: value }),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || 'No se pudo guardar el pedido.');
  }
  return true;
};

const updatePublicTableCall = async (value) => {
  const response = await fetch('/api/table-call', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(value),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || 'No se pudo enviar el llamado.');
  }
  return true;
};

const _executeUpsert = async (key, value) => {
  try {
    let session = null;
    try {
      const { data } = await supabase.auth.getSession();
      session = data?.session || null;
    } catch (authErr) {
      console.warn("⚠️ Supabase Sync: Error al obtener sesión en upsert:", authErr.message);
    }

    // 1. Si hay una sesión activa de Supabase Auth, hacemos upsert directo
    if (session) {
      const { error } = await supabase
        .from('helados_sync')
        .upsert(
          { 
            key, 
            value, 
            updated_at: new Date().toISOString() 
          }, 
          { onConflict: 'key' }
        );
      if (error) throw error;
      return true;
    }

    // 3. Si es una acción pública (ej: un cliente registrando su pedido o encuesta)
    // El RLS de Supabase solo permitirá la operación si la clave empieza por 'order_'
    if (key.startsWith('order_call_Mesa_')) {
      return await updatePublicTableCall(value);
    }

    if (key.startsWith('order_')) {
      return await updatePublicOrder(key, value);
    }

    const { error } = await supabase
      .from('helados_sync')
      .upsert(
        { 
          key, 
          value, 
          updated_at: new Date().toISOString() 
        }, 
        { onConflict: 'key' }
      );
    if (error) throw error;
    return true;
  } catch (err) {
    console.warn(`⚠️ Supabase Sync: No se pudo guardar la clave '${key}'.`, err.message);
    return false;
  }
};

/**
 * Guarda o actualiza múltiples registros clave-valor de forma atómica.
 */
export const updateMultipleSyncedData = async (keyValuePairs) => {
  if (!supabase || !keyValuePairs || keyValuePairs.length === 0) return false;
  try {
    let session = null;
    try {
      const { data } = await supabase.auth.getSession();
      session = data?.session || null;
    } catch (authErr) {
      console.warn("⚠️ Supabase Sync: Error al obtener sesión en upsert múltiple:", authErr.message);
    }

    // 1. Si hay una sesión activa de Supabase Auth, hacemos upsert en lote directo
    if (session) {
      const rows = keyValuePairs.map(item => ({
        key: item.key,
        value: item.value,
        updated_at: new Date().toISOString()
      }));
      const { error } = await supabase
        .from('helados_sync')
        .upsert(rows, { onConflict: 'key' });
      if (error) throw error;
      return true;
    }

    // 2. Fallback público compatible con operaciones de cliente en lote (si las hubiera)
    const rows = keyValuePairs.map(item => ({
      key: item.key,
      value: item.value,
      updated_at: new Date().toISOString()
    }));
    
    const { error } = await supabase
      .from('helados_sync')
      .upsert(rows, { onConflict: 'key' });
      
    if (error) throw error;
    return true;
  } catch (err) {
    console.warn("⚠️ Supabase Sync: Error en actualización en lote.", err.message);
    return false;
  }
};

/**
 * Suscribe la aplicación a los cambios de la tabla `helados_sync` en tiempo real.
 * Ejecuta el callback onUpdateCallback(key, value) ante cada cambio remoto.
 */
export const subscribeToSync = (onUpdateCallback, isAdmin = false, tableNumber = null, onStatusCallback = null) => {
  if (!supabase) return null;
  try {
    if (!isAdmin) {
      // Para clientes estándar, suscribirse a todos los cambios de llaves públicas de configuración
      const publicKeys = [
        'store_name', 
        'store_logo', 
        'store_title',
        'store_favicon',
        'store_phone', 
        'store_instagram',
        'store_facebook',
        'whatsapp_contact_message',
        'shop_open',
        'catalog_order', 
        'flavors', 
        'toppings', 
        'bases', 
        'packs', 
        'coupons',
        'delivery_fee', 
        'free_delivery_threshold', 
        'delivery_campaign_text',
        'sound_enabled', 
        'whatsapp_greeting', 
        'whatsapp_footer', 
        'qr_custom_url', 
        'recommendations', 
        'cart_recommended_pack', 
        'ticket_custom_message',
        'cart_locations',
        'store_hero_image',
        'meta_pixel_id',
        'google_analytics_id'
      ];

      const randId = Math.random().toString(36).substring(2, 10);
      const channel = supabase
        .channel(`helados-realtime-client-channel-${randId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'helados_sync' },
          (payload) => {
            const key = payload.new?.key || payload.old?.key;
            const val = payload.new?.value || null;
            if (key) {
              const isPublicKey = publicKeys.includes(key);
              const isMyTableCall = tableNumber && key === `order_call_Mesa_${tableNumber}`;
              if (isPublicKey || isMyTableCall) {
                invalidateSyncCache();
                onUpdateCallback(key, val);
              }
            }
          }
        )
        .subscribe((status, err) => {
          if (onStatusCallback) onStatusCallback(status, err);
          if (status === 'SUBSCRIBED') {
            console.log(`🔌 Canal Supabase Realtime (Cliente) suscrito con éxito (ID: ${randId}).`);
          } else if (err || status === 'CHANNEL_ERROR') {
            console.error(`❌ Error en Realtime (Cliente):`, err || status);
          }
        });
      return channel;
    } else {
      // Para administradores, suscribirse a todos los cambios
      const randId = Math.random().toString(36).substring(2, 10);
      const channel = supabase
        .channel(`helados-realtime-admin-channel-${randId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'helados_sync' },
          (payload) => {
            const key = payload.new?.key || payload.old?.key;
            const val = payload.new?.value || null;
            if (key) {
              invalidateSyncCache(); // Invalidar caché cuando llegue cambio remoto
              onUpdateCallback(key, val);
            }
          }
        )
        .subscribe((status, err) => {
          if (onStatusCallback) onStatusCallback(status, err);
          if (status === 'SUBSCRIBED') {
            console.log(`🔌 Canal Supabase Realtime (Admin) suscrito con éxito (ID: ${randId}).`);
          } else if (err || status === 'CHANNEL_ERROR') {
            console.error(`❌ Error en Realtime (Admin):`, err || status);
          }
        });
      return channel;
    }
  } catch (err) {
    console.warn("⚠️ Supabase Realtime: Suscripción fallida.", err.message);
    if (onStatusCallback) onStatusCallback('error', err);
    return null;
  }
};
