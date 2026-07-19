const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envPath = 'c:\\Users\\DELL\\OneDrive\\Escritorio\\registro2-main\\.env';
let envContent = '';
try {
  envContent = fs.readFileSync(envPath, 'utf8');
} catch (e) {
  console.error("Could not read .env file:", e.message);
  process.exit(1);
}

const env = {};
envContent.split(/\r?\n/).forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const key = parts[0].trim();
    const val = parts.slice(1).join('=').trim();
    env[key] = val;
  }
});

const supabaseUrl = env['VITE_SUPABASE_URL'];
const supabaseAnonKey = env['VITE_SUPABASE_ANON_KEY'];

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testFetch() {
  console.log("Fetching 'cart_locations' as anonymous client...");
  const { data, error } = await supabase
    .from('helados_sync')
    .select('*')
    .eq('key', 'cart_locations')
    .maybeSingle();

  if (error) {
    console.error("Error fetching:", error);
  } else if (!data) {
    console.log("No data returned! This means RLS policy is blocking SELECT of 'cart_locations' for anonymous users.");
  } else {
    console.log("Successfully fetched data:", data);
  }
}

testFetch();
