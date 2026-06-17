import {
  createAdminClient,
  fail,
  getSupabaseConfig,
  isTrustedAdmin,
  json,
  normalizeEmail,
  normalizeRole,
  sameOriginRequest,
} from './_security.js';

const normalizeStatus = (value) => {
  const status = String(value || '').trim();
  if (!status) return 'Activo';
  if (status.toLowerCase().includes('suspend')) return 'Suspendido';
  return status;
};

const syncStaffUsers = async (adminClient, nextStaffValue) => {
  const { error } = await adminClient
    .from('helados_sync')
    .upsert(
      {
        key: 'staff_users',
        value: nextStaffValue,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' }
    );

  if (error) {
    return { ok: false, error: error.message || 'No se pudo actualizar el personal.' };
  }

  return { ok: true };
};

const validateAccessToken = async (adminClient, env, accessToken) => {
  const { data: userResult, error: userError } = await adminClient.auth.getUser(accessToken);
  if (!userError && userResult?.user) {
    return { user: userResult.user, error: null };
  }

  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig(env);
  const response = await fetch(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/user`, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.id) {
    return {
      user: null,
      error: payload?.msg || payload?.error_description || payload?.error || userError?.message || 'No se pudo validar la sesión del administrador.',
    };
  }

  return { user: payload, error: null };
};

const isStaffAdmin = (staffUsers, email) => {
  const normalizedEmail = normalizeEmail(email);
  return staffUsers.some((item) => {
    const role = normalizeRole(item?.role, '').toLowerCase();
    const status = String(item?.status || 'Activo').trim().toLowerCase();
    return normalizeEmail(item?.email) === normalizedEmail
      && role.includes('admin')
      && !status.includes('suspend');
  });
};

export async function onRequestPost({ request, env }) {
  try {
    if (!sameOriginRequest(request)) return fail(403, 'origin', 'Origen no permitido.');

    const body = await request.json();
    const authHeader = request.headers.get('Authorization') || '';
    const headerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    const bodyToken = String(body.adminAccessToken || body.accessToken || '').trim();
    const accessToken = headerToken || bodyToken;

    const adminClient = await createAdminClient(env);
    const { supabaseUrl, serviceRoleKey } = getSupabaseConfig(env);
    const skipLegacyConfigCheck = Boolean(env.LEGACY_CONFIG_CHECK);

    if (!skipLegacyConfigCheck) {
      if (!supabaseUrl || !serviceRoleKey) {
        return fail(503, 'config', 'Supabase Auth admin no está configurado en el servidor.');
      }
      if (!/^https?:\/\/.+/i.test(supabaseUrl)) {
        return fail(500, 'config', 'SUPABASE_URL debe empezar con http:// o https:// y no puede tener espacios ni comillas.');
      }
    }

    if (!accessToken) {
      return fail(401, 'auth', 'Falta el token de sesión del administrador.');
    }

    const { user: caller, error: tokenError } = await validateAccessToken(adminClient, env, accessToken);
    if (!caller) {
      return fail(401, 'auth', tokenError || 'No se pudo validar la sesión del administrador.');
    }

    const { data: staffRow, error: staffError } = await adminClient
      .from('helados_sync')
      .select('value')
      .eq('key', 'staff_users')
      .maybeSingle();

    if (staffError) {
      return fail(502, 'staff_read', staffError.message || 'No se pudo leer el personal sincronizado.');
    }

    const currentStaff = Array.isArray(staffRow?.value) ? staffRow.value : [];

    if (!isTrustedAdmin(caller) && !isStaffAdmin(currentStaff, caller.email)) {
      return fail(403, 'authz', 'Solo un administrador puede cambiar usuarios de Auth.');
    }

    const action = String(body.action || 'upsert').toLowerCase();
    const email = normalizeEmail(body.email);
    const password = String(body.password || '').trim();
    const name = String(body.name || '').trim();
    const role = normalizeRole(body.role);
    const status = normalizeStatus(body.status);

    if (!email) {
      return fail(400, 'input', 'Falta el correo del usuario.');
    }

    if (action !== 'delete' && password && password.length < 6) {
      return fail(400, 'input', 'La contraseña debe tener al menos 6 caracteres para Supabase Auth.');
    }

    const { data: listData, error: listError } = await adminClient.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

    if (listError) {
      return fail(502, 'auth_list', listError.message || 'No se pudo listar usuarios Auth.');
    }

    const authUser = listData?.users?.find((u) => normalizeEmail(u.email) === email) || null;
    const existingStaffUser = currentStaff.find((item) => normalizeEmail(item?.email) === email) || null;

    const nextStaffValue = (() => {
      if (action === 'delete') {
        return currentStaff.filter((item) => normalizeEmail(item?.email) !== email);
      }

      const nextUser = {
        id: existingStaffUser?.id || authUser?.id || crypto.randomUUID(),
        username: existingStaffUser?.username || email.split('@')[0],
        email,
        name: name || existingStaffUser?.name || email.split('@')[0],
        role,
        status,
        allowedTabs: Array.isArray(existingStaffUser?.allowedTabs) ? existingStaffUser.allowedTabs : [],
      };

      return [
        ...currentStaff.filter((item) => normalizeEmail(item?.email) !== email),
        nextUser,
      ];
    })();

    if (action === 'delete') {
      if (authUser?.id) {
        const { error } = await adminClient.auth.admin.deleteUser(authUser.id);
        if (error) return fail(502, 'auth_delete', error.message || 'No se pudo eliminar el usuario Auth.');
      }
      const staffResult = await syncStaffUsers(adminClient, nextStaffValue);
      if (!staffResult.ok) {
        return json({ ok: true, action: 'delete', warning: staffResult.error });
      }
      return json({ ok: true, action: 'delete' });
    }

    const payload = {
      email,
      email_confirm: true,
      user_metadata: {
        name,
      },
      app_metadata: {
        role,
      },
    };

    if (password) payload.password = password;

    if (authUser?.id) {
      const { error } = await adminClient.auth.admin.updateUserById(authUser.id, payload);
      if (error) return fail(502, 'auth_update', error.message || 'No se pudo actualizar el usuario Auth.');
      const staffResult = await syncStaffUsers(adminClient, nextStaffValue);
      if (!staffResult.ok) {
        return json({ ok: true, action: 'update', userId: authUser.id, warning: staffResult.error });
      }
      return json({ ok: true, action: 'update', userId: authUser.id });
    }

    if (!password) {
      return fail(400, 'input', 'Se necesita contraseña para crear el usuario Auth.');
    }

    const { data: created, error: createError } = await adminClient.auth.admin.createUser(payload);
    if (createError) {
      return fail(502, 'auth_create', createError.message || 'No se pudo crear el usuario Auth.');
    }

    const createdUser = created?.user || null;
    if (createdUser?.id) {
      const createdIndex = nextStaffValue.findIndex((item) => normalizeEmail(item?.email) === email);
      if (createdIndex >= 0) {
        nextStaffValue[createdIndex] = {
          ...nextStaffValue[createdIndex],
          id: createdUser.id,
        };
      }
    }

    const staffResult = await syncStaffUsers(adminClient, nextStaffValue);
    if (!staffResult.ok) {
      return json({ ok: true, action: 'create', userId: created?.user?.id || null, warning: staffResult.error });
    }

    return json({ ok: true, action: 'create', userId: created?.user?.id || null });
  } catch (err) {
    return json({ error: err.message || 'Error inesperado.' }, 500);
  }
}
