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
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Obtiene todos los datos sincronizados desde la tabla `helados_sync` en Supabase.
 * Usa caché de 5 minutos para ahorrar egress. Devuelve un objeto clave-valor.
 */
export const fetchSyncedData = async (isAdmin = false) => {
  if (!supabase) return null;

  // Comprobar caché
  const cacheKey = isAdmin ? 'admin' : 'client';
  const now = Date.now();
  if (_syncCache[cacheKey] && (now - _syncCacheTime[cacheKey]) < CACHE_TTL_MS) {
    return _syncCache[cacheKey];
  }

  try {
    let query = supabase.from('helados_sync').select('*');
    
    if (!isAdmin) {
      // Filtrar datos de otros clientes (privacidad) y configuraciones sensibles (seguridad)
      // También ahorra ancho de banda (egress) al no descargar todo el historial
      query = query
        .not('key', 'like', 'order_%')
        .not('key', 'like', 'expense_%')
        .neq('key', 'telegram_token')
        .neq('key', 'telegram_chat_id')
        .neq('key', 'expenses')
        .neq('key', 'orders')
        .neq('key', 'staff_permissions');
    }

    const { data, error } = await query;
    if (error) throw error;
    
    const syncData = {};
    if (data && data.length > 0) {
      data.forEach(row => {
        syncData[row.key] = row.value;
      });
    }

    // Guardar en caché
    _syncCache[cacheKey] = syncData;
    _syncCacheTime[cacheKey] = Date.now();

    return syncData;
  } catch (err) {
    console.warn("⚠️ Supabase Sync: Fetch fallido. Usando datos locales.", err.message);
    return null;
  }
};

/**
 * Guarda o actualiza un registro clave-valor en la tabla `helados_sync` en Supabase.
 */
export const updateSyncedData = async (key, value) => {
  if (!supabase) return false;
  try {
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
 * Suscribe la aplicación a los cambios de la tabla `helados_sync` en tiempo real.
 * Ejecuta el callback onUpdateCallback(key, value) ante cada cambio remoto.
 */
export const subscribeToSync = (onUpdateCallback, isAdmin = false) => {
  if (!supabase) return null;
  try {
    if (!isAdmin) {
      // Para clientes estándar, solo suscribirse a 'shop_open', 'flavors' y 'toppings' para ahorrar un 99% de egress
      const channel = supabase
        .channel('helados-realtime-client-channel')
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'helados_sync', filter: 'key=eq.shop_open' },
          (payload) => {
            if (payload.new && payload.new.key) {
              invalidateSyncCache();
              onUpdateCallback(payload.new.key, payload.new.value);
            }
          }
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'helados_sync', filter: 'key=eq.flavors' },
          (payload) => {
            if (payload.new && payload.new.key) {
              invalidateSyncCache();
              onUpdateCallback(payload.new.key, payload.new.value);
            }
          }
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'helados_sync', filter: 'key=eq.toppings' },
          (payload) => {
            if (payload.new && payload.new.key) {
              invalidateSyncCache();
              onUpdateCallback(payload.new.key, payload.new.value);
            }
          }
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'helados_sync', filter: 'key=eq.catalog_order' },
          (payload) => {
            if (payload.new && payload.new.key) {
              invalidateSyncCache();
              onUpdateCallback(payload.new.key, payload.new.value);
            }
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log("🔌 Canal Supabase Realtime (Cliente) suscrito con éxito.");
          }
        });
      return channel;
    } else {
      // Para administradores, suscribirse a todos los cambios
      const channel = supabase
        .channel('helados-realtime-admin-channel')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'helados_sync' },
          (payload) => {
            if (payload.new && payload.new.key) {
              invalidateSyncCache(); // Invalidar caché cuando llegue cambio remoto
              onUpdateCallback(payload.new.key, payload.new.value);
            }
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log("🔌 Canal Supabase Realtime (Admin) suscrito con éxito.");
          }
        });
      return channel;
    }
  } catch (err) {
    console.warn("⚠️ Supabase Realtime: Suscripción fallida.", err.message);
    return null;
  }
};
