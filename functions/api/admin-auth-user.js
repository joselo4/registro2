const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();

const normalizeRole = (value) => {
  const role = String(value || '').trim();
  const lower = role.toLowerCase();
  if (lower.includes('admin')) return 'Administrador';
  if (lower.includes('vendedor')) return 'Vendedor';
  if (lower.includes('cocina')) return 'Cocina';
  return role || 'Administrador';
};

const normalizeStatus = (value) => {
  const status = String(value || '').trim();
  if (!status) return 'Activo';
  if (status.toLowerCase().includes('suspend')) return 'Suspendido';
  return status;
};

const fail = (status, step, error) =>
  json({ ok: false, step, error }, status);

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

export async function onRequestPost({ request, env }) {
  try {
    const authHeader = request.headers.get('Authorization') || '';
    const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

    const supabaseUrl = String(env.SUPABASE_URL || env.VITE_SUPABASE_URL || '').trim();
    const serviceRoleKey = String(env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

    if (!supabaseUrl || !serviceRoleKey) {
      return fail(503, 'config', 'Supabase Auth admin no está configurado en el servidor.');
    }

    if (!/^https?:\/\/.+/i.test(supabaseUrl)) {
      return fail(500, 'config', 'SUPABASE_URL debe empezar con http:// o https:// y no puede tener espacios ni comillas.');
    }

    if (!accessToken) {
      return fail(401, 'auth', 'Falta el token de sesión del administrador.');
    }

    const { createClient } = await import('@supabase/supabase-js');
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    });

    const { data: userResult, error: userError } = await adminClient.auth.getUser(accessToken);
    if (userError || !userResult?.user) {
      return fail(401, 'auth', userError?.message || 'No se pudo validar la sesión del administrador.');
    }

    const caller = userResult.user;
    const callerEmail = normalizeEmail(caller.email);
    const callerRole = normalizeRole(caller.user_metadata?.role || caller.app_metadata?.role || '');
    if (callerEmail !== 'admin@donhelado.com' && !callerRole.toLowerCase().includes('admin')) {
      return fail(403, 'authz', 'Solo un administrador puede cambiar usuarios de Auth.');
    }

    const body = await request.json();
    const action = String(body.action || 'upsert').toLowerCase();
    const email = normalizeEmail(body.email);
    const password = String(body.password || '').trim();
    const name = String(body.name || '').trim();
    const role = normalizeRole(body.role);
    const status = normalizeStatus(body.status);

    if (!email) {
      return fail(400, 'input', 'Falta el correo del usuario.');
    }

    const { data: listData, error: listError } = await adminClient.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

    if (listError) {
      return fail(502, 'auth_list', listError.message || 'No se pudo listar usuarios Auth.');
    }

    const authUser = listData?.users?.find((u) => normalizeEmail(u.email) === email) || null;
    const { data: staffRow, error: staffError } = await adminClient
      .from('helados_sync')
      .select('value')
      .eq('key', 'staff_users')
      .maybeSingle();

    if (staffError) {
      return fail(502, 'staff_read', staffError.message || 'No se pudo leer el personal sincronizado.');
    }

    const currentStaff = Array.isArray(staffRow?.value) ? staffRow.value : [];
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
        password: password || existingStaffUser?.password || '',
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
        role,
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
