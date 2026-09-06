import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_KEY;

// Opciones optimizadas para persistencia y tiempo real en aplicaciones móviles (Capacitor/APK) y navegadores web
const clientOptions = {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // En entornos Capacitor/APK las URLs internas (ej. capacitor://localhost o file://) pueden alterar la sesión si detectSessionInUrl está activo
    detectSessionInUrl: false,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
    timeout: 30000,
    // Heartbeat a 15s para evitar que operadores móviles / NAT cierren la conexión por inactividad
    heartbeatIntervalMs: 15000,
  },
  global: {
    headers: {
      'x-client-info': 'donhelado-app@1.0.0',
    },
  },
};

// Inicializa el cliente solo si las credenciales están provistas en el archivo .env
export const supabase = (supabaseUrl && supabaseAnonKey) 
  ? createClient(supabaseUrl, supabaseAnonKey, clientOptions) 
  : null;

// Mensaje informativo en consola sobre el estado de la conexión
if (supabase) {
  console.log("🔌 Supabase inicializado correctamente con soporte de reconexión móvil y heartbeat.");
} else {
  console.log("💾 Supabase no configurado. Utilizando base de datos local (LocalStorage) en modo fuera de línea.");
}

