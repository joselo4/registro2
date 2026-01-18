import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Verificación en consola para depurar errores en producción
console.log("Supabase Status:", {
  url: supabaseUrl ? "OK" : "FALTA URL",
  key: supabaseKey ? "OK" : "FALTA KEY"
});

if (!supabaseUrl || !supabaseKey) {
  console.error("URGENTE: Faltan las variables de entorno en Render.");
}

// Usamos cadenas vacías si no existen para evitar que la app crashee en blanco inmediatamente,
// aunque la base de datos no funcione, al menos cargará la interfaz con errores.
export const supabase = createClient(supabaseUrl || '', supabaseKey || '');