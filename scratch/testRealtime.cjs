const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envPath = '.env';
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

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env");
  process.exit(1);
}

console.log("Connecting to Supabase Realtime:", supabaseUrl);
const supabase = createClient(supabaseUrl, supabaseAnonKey);

console.log("Subscribing to client channel...");
const clientChannel = supabase
  .channel('helados-realtime-client-channel-test')
  .on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'helados_sync' },
    (payload) => {
      console.log("Client Received Event:", payload);
    }
  )
  .subscribe((status, err) => {
    console.log("Client Channel Status:", status, err || "");
    if (status === 'SUBSCRIBED') {
      console.log("Client connected successfully! Testing admin channel now...");
      testAdmin();
    }
  });

function testAdmin() {
  console.log("Subscribing to admin channel...");
  const adminChannel = supabase
    .channel('helados-realtime-admin-channel-test')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'helados_sync' },
      (payload) => {
        console.log("Admin Received Event:", payload);
      }
    )
    .subscribe((status, err) => {
      console.log("Admin Channel Status:", status, err || "");
      if (status === 'SUBSCRIBED') {
        console.log("Admin connected successfully!");
      }
    });

  setTimeout(() => {
    console.log("Timeout reached. Closing test.");
    process.exit(0);
  }, 10000);
}
