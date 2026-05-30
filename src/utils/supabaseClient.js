import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_KEY;

// Inicializa el cliente solo si las credenciales están provistas en el archivo .env
export const supabase = (supabaseUrl && supabaseAnonKey) 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null;

// Mensaje informativo en consola sobre el estado de la conexión
if (supabase) {
  console.log("🔌 Supabase inicializado correctamente. Sincronización en la nube activa.");
} else {
  console.log("💾 Supabase no configurado. Utilizando base de datos local (LocalStorage) en modo fuera de línea.");
}
