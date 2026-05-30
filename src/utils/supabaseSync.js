import { supabase } from './supabaseClient';

/**
 * Obtiene todos los datos sincronizados desde la tabla `helados_sync` en Supabase.
 * Devuelve un objeto clave-valor.
 */
export const fetchSyncedData = async () => {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('helados_sync')
      .select('*');
    if (error) throw error;
    
    const syncData = {};
    if (data && data.length > 0) {
      data.forEach(row => {
        syncData[row.key] = row.value;
      });
    }
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
export const subscribeToSync = (onUpdateCallback) => {
  if (!supabase) return null;
  try {
    const channel = supabase
      .channel('helados-realtime-channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'helados_sync' },
        (payload) => {
          // Si el evento es un UPDATE o INSERT remoto, notificamos el cambio
          if (payload.new && payload.new.key) {
            onUpdateCallback(payload.new.key, payload.new.value);
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log("🔌 Canal Supabase Realtime suscrito con éxito.");
        }
      });
    return channel;
  } catch (err) {
    console.warn("⚠️ Supabase Realtime: Suscripción fallida.", err.message);
    return null;
  }
};
