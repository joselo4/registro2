export const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });

export const normalizeEmail = (value) => String(value || '').trim().toLowerCase();

export const normalizeRole = (value, fallback = 'Vendedor') => {
  const lower = String(value || '').trim().toLowerCase();
  return ({ administrador: 'Administrador', admin: 'Administrador', vendedor: 'Vendedor', cocina: 'Cocina', repartidor: 'Repartidor', cajero: 'Cajero', mozo: 'Mozo' })[lower] || fallback;
};

export const fail = (status, step, error) => json({ ok: false, step, error }, status);

export const sameOriginRequest = (request) => {
  const origin = request.headers.get('Origin');
  if (!origin) return true;
  try {
    const originUrl = new URL(origin);
    const requestUrl = new URL(request.url);
    if (originUrl.origin === requestUrl.origin) return true;
    if (['https://localhost', 'http://localhost', 'capacitor://localhost'].includes(origin)) return true;

    const isLocalRequest = ['localhost', '127.0.0.1', '::1'].includes(requestUrl.hostname);
    const trustedLocalOrigins = new Set([
      'http://localhost',
      'https://localhost',
      'http://localhost:5173',
      'http://127.0.0.1:5173',
    ]);
    if (isLocalRequest && trustedLocalOrigins.has(originUrl.origin)) return true;

    return originUrl.protocol === 'capacitor:' && originUrl.hostname === 'localhost';
  } catch {
    return false;
  }
};

export const getSupabaseConfig = (env) => {
  const supabaseUrl = String(env.SUPABASE_URL || env.VITE_SUPABASE_URL || '').trim();
  const serviceRoleKey = String(env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  return { supabaseUrl, serviceRoleKey };
};

export const createAdminClient = async (env) => {
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig(env);
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase admin no esta configurado en el servidor.');
  }
  if (!/^https?:\/\/.+/i.test(supabaseUrl)) {
    throw new Error('SUPABASE_URL debe empezar con http:// o https://.');
  }

  const { createClient } = await import('@supabase/supabase-js');
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
};

export const getBearerToken = (request) => {
  const authHeader = request.headers.get('Authorization') || '';
  return authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
};

export const getAuthenticatedUser = async (request, env) => {
  const accessToken = getBearerToken(request);
  if (!accessToken) return { user: null, error: 'Falta el token de sesion.' };

  const adminClient = await createAdminClient(env);
  const { data, error } = await adminClient.auth.getUser(accessToken);
  if (error || !data?.user) {
    return { user: null, error: error?.message || 'No se pudo validar la sesion.' };
  }
  if (!await hasActiveStaffRecord(adminClient, data.user)) {
    return { user: null, error: 'La cuenta no tiene un rol activo.' };
  }
  return { user: data.user, adminClient };
};

export const trustedRole = (user) => normalizeRole(user?.app_metadata?.role || '', '');

export const hasActiveStaffRecord = async (client, user) => {
  if (!user || !trustedRole(user) || String(user.app_metadata?.status || '').toLowerCase().includes('suspend')) return false;
  const { data, error } = await client.from('helados_sync').select('value').eq('key', 'staff_users').maybeSingle();
  if (error || !Array.isArray(data?.value)) return false;
  const match = data.value.find(item =>
    (user.id && String(item.id) === String(user.id)) ||
    (user.email && normalizeEmail(item.email) === normalizeEmail(user.email))
  );
  return Boolean(match && String(match.status || 'Activo').trim().toLowerCase() === 'activo' && normalizeRole(match.role, '') === trustedRole(user));
};

export const isTrustedAdmin = (user) =>
  !String(user?.app_metadata?.status || '').toLowerCase().includes('suspend') &&
  trustedRole(user) === 'Administrador';

export const isTrustedStaff = (user) => {
  const role = trustedRole(user).toLowerCase();
  return !String(user?.app_metadata?.status || '').toLowerCase().includes('suspend') &&
    (isTrustedAdmin(user) || role === 'vendedor');
};
