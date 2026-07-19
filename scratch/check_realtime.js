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
  console.log("Checking if helados_sync is in supabase_realtime publication...");
  
  // We can query pg_publication_tables using RPC or using an arbitrary query if allowed.
  // Wait, does the anon key have permission to query pg_publication_tables?
  // Let's write a generic query or see if we can do it.
  const { data, error } = await supabase.from('helados_sync').select('*').limit(1);
  if (error) {
    console.error("Error connecting to helados_sync:", error);
    return;
  }
  
  // Since we cannot run raw sql via standard select, we can check if there's any RPC we can use, 
  // or if we can run it.
  // Wait! Let's check if there is an RPC we can use to run SQL or check tables.
  // No, but wait: is there any other way?
  // We can try to query publication tables directly if the schema information_schema is exposed,
  // or via pg_catalog. But pg_catalog is usually restricted for anon/authenticated roles.
  // Let's try selecting from pg_catalog anyway and see if it fails.
  const { data: pubData, error: pubError } = await supabase
    .from('pg_publication_tables')
    .select('*');
    
  if (pubError) {
    console.log("Could not query pg_publication_tables directly (expected for anon):", pubError.message);
  } else {
    console.log("Publication tables:", pubData);
  }
}

run();
