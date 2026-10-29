// Read-only check of what an anonymous visitor can read from the store database.
// Uses only the public anon key (the same one every browser receives) and never writes.
//   node scripts/check-public-access.mjs
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .map(line => line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/))
    .filter(Boolean)
    .map(([, key, value]) => [key, value.replace(/^['"]|['"]$/g, '')])
);
const url = env.VITE_SUPABASE_URL;
const anonKey = env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_KEY;
if (!url || !anonKey) {
  console.error('Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY en .env');
  process.exit(1);
}

const client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });

// Keys that must never be readable without a staff session.
const PRIVATE_KEYS = ['orders', 'staff_users', 'staff_permissions', 'expenses', 'cash_shifts', 'sales_goal', 'push_subscriptions', 'telegram_token', 'telegram_chat_id', 'r2_config', 'audit_logs', 'coupons'];
// Keys the public storefront needs.
const PUBLIC_KEYS = ['flavors', 'shop_open', 'store_name'];

let problems = 0;
for (const key of PRIVATE_KEYS) {
  const { data, error } = await client.from('helados_sync').select('key').eq('key', key).maybeSingle();
  const exposed = Boolean(data) && !error;
  if (exposed) problems++;
  console.log(`${exposed ? 'EXPUESTO ' : 'protegido'}  ${key}`);
}
const { data: someOrders } = await client.from('helados_sync').select('key').like('key', 'order_PED-%').limit(1);
const ordersExposed = Array.isArray(someOrders) && someOrders.length > 0;
if (ordersExposed) problems++;
console.log(`${ordersExposed ? 'EXPUESTO ' : 'protegido'}  order_PED-* (pedidos de clientes)`);

for (const key of PUBLIC_KEYS) {
  const { data } = await client.from('helados_sync').select('key').eq('key', key).maybeSingle();
  console.log(`${data ? 'público ok' : 'NO LEGIBLE'} ${key}`);
}

// Writes are not probed: testing them would change production data. They are covered by the
// UPDATE/INSERT policies in setup_security_v2.sql, which only allow staff sessions.

console.log(problems ? `\n${problems} dato(s) privados legibles sin sesión.` : '\nNingún dato privado es legible sin sesión.');
process.exit(problems ? 2 : 0);
