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
  const role = String(value || '').trim();
  const lower = role.toLowerCase();
  if (lower.includes('admin')) return 'Administrador';
  if (lower.includes('vendedor')) return 'Vendedor';
  if (lower.includes('cocina')) return 'Cocina';
  return role || fallback;
};

export const fail = (status, step, error) => json({ ok: false, step, error }, status);

export const sameOriginRequest = (request) => {
  const origin = request.headers.get('Origin');
  if (!origin) return true;
  try {
    const originHost = new URL(origin).host;
    const requestHost = new URL(request.url).host;
    if (originHost === requestHost) return true;
    if (originHost.endsWith('.' + requestHost) || requestHost.endsWith('.' + originHost)) return true;
    const trustedHosts = ['localhost', 'localhost:5173'];
    return trustedHosts.includes(originHost);
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
  return { user: data.user, adminClient };
};

export const trustedRole = (user) => normalizeRole(user?.app_metadata?.role || '', '');

export const isTrustedAdmin = (user) =>
  normalizeEmail(user?.email) === 'admin@donhelado.com' ||
  trustedRole(user).toLowerCase().includes('admin');

export const isTrustedStaff = (user) => {
  const role = trustedRole(user).toLowerCase();
  return isTrustedAdmin(user) || role.includes('vendedor') || role.includes('cocina');
};
