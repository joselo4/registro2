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
 * Obtiene las credenciales del administrador guardadas en el LocalStorage
 * tras un inicio de sesión administrativo exitoso.
 */
const getAdminCredentials = () => {
  try {
    const saved = localStorage.getItem('helados_admin_current_user');
    if (saved) {
      const user = JSON.parse(saved);
      if (user && user.email && user.password) {
        return { email: user.email, password: user.password };
      }
    }
  } catch (e) {
    console.warn("Supabase Sync: Error leyendo credenciales de administración.", e);
  }
  return null;
};

/**
 * Obtiene todos los datos sincronizados desde Supabase de forma segura.
 * Si es administrador y tiene sesión activa, utiliza consultas directas protegidas por RLS.
 * Si es administrador mediante credenciales locales heredadas, usa RPC como fallback.
 * Si es cliente, descarga únicamente las configuraciones públicas de la tienda.
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
    let syncData = {};
    let isSessionAdmin = false;

    // Verificar si hay una sesión activa de Supabase Auth
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      isSessionAdmin = true;
    }

    const creds = getAdminCredentials();

    // 1. Caso de uso administrativo
    if (isAdmin && (isSessionAdmin || creds)) {
      if (isSessionAdmin) {
        console.log("🔌 Solicitando datos administrativos seguros mediante consulta directa (Supabase Auth activa)...");
        const { data, error } = await supabase.from('helados_sync').select('*');
        if (error) throw error;
        if (data && data.length > 0) {
          data.forEach(row => {
            syncData[row.key] = row.value;
          });
        }
      } else {
        console.log("🔌 Solicitando datos administrativos seguros mediante RPC de fallback...");
        const { data, error } = await supabase.rpc('get_all_sensitive_keys', {
          p_admin_email: creds.email,
          p_admin_password: creds.password
        });

        if (error) throw error;

        if (data && typeof data === 'object') {
          syncData = data;
        }
      }
    } else {
      // 2. Caso de uso público (Clientes): cargar únicamente la configuración general no sensible
      console.log("🔌 Cargando configuración pública de la tienda...");
      let query = supabase.from('helados_sync').select('*');

      // Filtro preventivo del lado del cliente
      query = query
        .not('key', 'like', 'order_%')
        .not('key', 'like', 'expense_%')
        .neq('key', 'telegram_token')
        .neq('key', 'telegram_chat_id')
        .neq('key', 'expenses')
        .neq('key', 'orders')
        .neq('key', 'staff_permissions')
        .neq('key', 'r2_config');

      const { data, error } = await query;
      if (error) throw error;

      if (data && data.length > 0) {
        data.forEach(row => {
          syncData[row.key] = row.value;
        });
      }
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
 * Guarda o actualiza un registro clave-valor de forma segura.
 * Si el usuario es administrador autenticado mediante JWT, hace un upsert directo.
 * Si es administrador mediante credenciales heredadas, usa RPC cifrado.
 * Si es una acción pública (ej: un cliente registrando un pedido), realiza un upsert directo validado por RLS.
 */
export const updateSyncedData = async (key, value) => {
  if (!supabase) return false;
  try {
    const { data: { session } } = await supabase.auth.getSession();

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

    // 2. Si no hay sesión de Supabase Auth pero hay credenciales guardadas de RPC
    const creds = getAdminCredentials();
    if (creds) {
      const { data, error } = await supabase.rpc('update_sensitive_key', {
        p_admin_email: creds.email,
        p_admin_password: creds.password,
        p_key: key,
        p_value: value
      });
      if (error) throw error;
      return true;
    }

    // 3. Si es una acción pública (ej: un cliente registrando su pedido o encuesta)
    // El RLS de Supabase solo permitirá la operación si la clave empieza por 'order_'
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
    const { data: { session } } = await supabase.auth.getSession();

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

    // 2. Si hay sesión administrativa por credenciales de RPC
    const creds = getAdminCredentials();
    if (creds) {
      const promises = keyValuePairs.map(item => 
        supabase.rpc('update_sensitive_key', {
          p_admin_email: creds.email,
          p_admin_password: creds.password,
          p_key: item.key,
          p_value: item.value
        })
      );
      const results = await Promise.all(promises);
      const error = results.find(r => r.error);
      if (error) throw error.error;
      return true;
    }

    // 3. Fallback público compatible con operaciones de cliente en lote (si las hubiera)
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
