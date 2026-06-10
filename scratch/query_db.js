import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Manually parse .env
const envContent = fs.readFileSync('.env', 'utf-8');
const lines = envContent.split('\n');
let supabaseUrl = '';
let supabaseKey = '';

for (const line of lines) {
  const parts = line.split('=');
  if (parts[0] === 'VITE_SUPABASE_URL') {
    supabaseUrl = parts[1].trim();
  } else if (parts[0] === 'VITE_SUPABASE_ANON_KEY') {
    supabaseKey = parts[1].trim();
  }
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Fetching order_PED-TEST-% rows...");
  const { data, error } = await supabase
    .from('helados_sync')
    .select('key, updated_at, value')
    .like('key', 'order_PED-TEST-%');

  if (error) {
    console.error("Error fetching:", error);
  } else {
    console.log("Found rows:", data.length);
    data.forEach(row => {
      console.log(`- ${row.key} (Updated: ${row.updated_at})`);
    });
  }
}

run();
