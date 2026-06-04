-- =====================================================================
-- SCRIPT DE SEGURIDAD Y CONFIGURACIÓN DE BASE DE DATOS PARA SUPABASE
-- Ejecuta este script en el Editor SQL de tu panel de Supabase.
-- =====================================================================

-- 1. Habilitar la extensión de UUID si no está habilitada
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Asegurar la existencia de la tabla helados_sync con su estructura adecuada
CREATE TABLE IF NOT EXISTS public.helados_sync (
    key text PRIMARY KEY,
    value jsonb,
    updated_at timestamptz DEFAULT now()
);

-- 3. Habilitar Row Level Security (RLS) en la tabla
ALTER TABLE public.helados_sync ENABLE ROW LEVEL SECURITY;

-- 4. Eliminar políticas existentes para evitar duplicados
DROP POLICY IF EXISTS "Permitir lectura pública de llaves generales" ON public.helados_sync;
DROP POLICY IF EXISTS "Permitir a clientes crear y leer sus propios pedidos" ON public.helados_sync;
DROP POLICY IF EXISTS "Permitir todo a administradores autenticados" ON public.helados_sync;

-- 5. POLÍTICA A: Permitir lectura pública de llaves del catálogo (no confidenciales)
-- Regular los datos que lee el cliente (sin sesión iniciada)
CREATE POLICY "Permitir lectura pública de llaves generales" 
ON public.helados_sync
FOR SELECT
TO anon
USING (
    key IN (
        'store_name', 
        'store_logo', 
        'store_title',
        'store_favicon',
        'store_phone', 
        'store_instagram',
        'store_facebook',
        'whatsapp_contact_message',
        'shop_open',
        'catalog_order', 
        'flavors', 
        'toppings', 
        'bases', 
        'packs', 
        'coupons',
        'delivery_fee', 
        'free_delivery_threshold', 
        'delivery_campaign_text',
        'sound_enabled', 
        'whatsapp_greeting', 
        'whatsapp_footer', 
        'qr_custom_url', 
        'recommendations', 
        'cart_recommended_pack', 
        'liter_config', 
        'ticket_custom_message'
    )
);

-- 6. POLÍTICA B: Permitir a clientes crear, actualizar y consultar sus propios pedidos
-- Los pedidos se guardan en llaves individuales con el prefijo "order_" (ej: order_PED-1234)
CREATE POLICY "Permitir a clientes crear y leer sus propios pedidos" 
ON public.helados_sync
FOR ALL
TO anon
USING (key LIKE 'order_%')
WITH CHECK (key LIKE 'order_%');

-- 7. POLÍTICA C: Permitir acceso absoluto a usuarios autenticados (Administradores/Staff)
-- Cualquier usuario autenticado mediante Supabase Auth tiene control total
CREATE POLICY "Permitir todo a administradores autenticados" 
ON public.helados_sync
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- 8. [OPCIONAL] Función y disparador para actualizar automáticamente 'updated_at'
CREATE OR REPLACE FUNCTION public.trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_timestamp ON public.helados_sync;
CREATE TRIGGER set_timestamp
BEFORE UPDATE ON public.helados_sync
FOR EACH ROW
EXECUTE FUNCTION public.trigger_set_timestamp();

-- 9. RPCs para gestionar personal desde la app
-- Estas funciones trabajan sobre la llave `staff_users` dentro de `helados_sync`.

CREATE OR REPLACE FUNCTION public.get_all_admins()
RETURNS TABLE (
    id text,
    username text,
    email text,
    name text,
    role text,
    status text,
    password text,
    "allowedTabs" jsonb
)
LANGUAGE sql
AS $$
    SELECT
        COALESCE(item->>'id', uuid_generate_v4()::text) AS id,
        COALESCE(item->>'username', split_part(COALESCE(item->>'email', ''), '@', 1)) AS username,
        COALESCE(item->>'email', '') AS email,
        COALESCE(item->>'name', split_part(COALESCE(item->>'email', ''), '@', 1)) AS name,
        COALESCE(item->>'role', 'Vendedor') AS role,
        COALESCE(item->>'status', 'Activo') AS status,
        COALESCE(item->>'password', '') AS password,
        COALESCE(item->'allowedTabs', '[]'::jsonb) AS "allowedTabs"
    FROM public.helados_sync sync_row
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(sync_row.value, '[]'::jsonb)) AS item
    WHERE sync_row.key = 'staff_users'
      AND auth.uid() IS NOT NULL
      AND (
        lower(coalesce(auth.jwt() ->> 'email', '')) = 'admin@donhelado.com'
        OR lower(coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '')) LIKE '%admin%'
        OR lower(coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '')) LIKE '%admin%'
      )
    ORDER BY COALESCE(item->>'name', item->>'email');
$$;

CREATE OR REPLACE FUNCTION public.verify_admin_login(
    p_username_or_email text,
    p_password text
)
RETURNS TABLE (
    id text,
    username text,
    email text,
    name text,
    role text,
    status text,
    error text
)
LANGUAGE plpgsql
AS $$
DECLARE
    user_item jsonb;
    search_value text := lower(trim(coalesce(p_username_or_email, '')));
BEGIN
    SELECT item
    INTO user_item
    FROM public.helados_sync sync_row
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(sync_row.value, '[]'::jsonb)) AS item
    WHERE sync_row.key = 'staff_users'
      AND (
        lower(COALESCE(item->>'email', '')) = search_value
        OR lower(COALESCE(item->>'username', '')) = search_value
      )
    LIMIT 1;

    IF user_item IS NULL THEN
        RETURN QUERY SELECT NULL::text, NULL::text, NULL::text, NULL::text, NULL::text, NULL::text, 'Usuario no encontrado.'::text;
        RETURN;
    END IF;

    IF COALESCE(user_item->>'status', 'Activo') ILIKE 'Suspendido' THEN
        RETURN QUERY SELECT
            COALESCE(user_item->>'id', uuid_generate_v4()::text),
            COALESCE(user_item->>'username', split_part(COALESCE(user_item->>'email', ''), '@', 1)),
            COALESCE(user_item->>'email', ''),
            COALESCE(user_item->>'name', split_part(COALESCE(user_item->>'email', ''), '@', 1)),
            COALESCE(user_item->>'role', 'Vendedor'),
            COALESCE(user_item->>'status', 'Suspendido'),
            'Usuario suspendido.'::text;
        RETURN;
    END IF;

    IF COALESCE(user_item->>'password', '') <> COALESCE(p_password, '') THEN
        RETURN QUERY SELECT
            COALESCE(user_item->>'id', uuid_generate_v4()::text),
            COALESCE(user_item->>'username', split_part(COALESCE(user_item->>'email', ''), '@', 1)),
            COALESCE(user_item->>'email', ''),
            COALESCE(user_item->>'name', split_part(COALESCE(user_item->>'email', ''), '@', 1)),
            COALESCE(user_item->>'role', 'Vendedor'),
            COALESCE(user_item->>'status', 'Activo'),
            'Credenciales incorrectas.'::text;
        RETURN;
    END IF;

    RETURN QUERY SELECT
        COALESCE(user_item->>'id', uuid_generate_v4()::text),
        COALESCE(user_item->>'username', split_part(COALESCE(user_item->>'email', ''), '@', 1)),
        COALESCE(user_item->>'email', ''),
        COALESCE(user_item->>'name', split_part(COALESCE(user_item->>'email', ''), '@', 1)),
        COALESCE(user_item->>'role', 'Vendedor'),
        COALESCE(user_item->>'status', 'Activo'),
        NULL::text;
END;
$$;

CREATE OR REPLACE FUNCTION public.manage_admin_user(
    p_admin_email text,
    p_admin_role text DEFAULT NULL,
    p_target_email text,
    p_username text DEFAULT NULL,
    p_name text DEFAULT NULL,
    p_role text DEFAULT NULL,
    p_password text DEFAULT NULL,
    p_status text DEFAULT NULL,
    p_action text DEFAULT 'upsert'
)
RETURNS TABLE (
    success boolean,
    message text
)
LANGUAGE plpgsql
AS $$
DECLARE
    current_list jsonb := '[]'::jsonb;
    existing_user jsonb := NULL;
    normalized_target text := lower(trim(coalesce(p_target_email, '')));
    next_list jsonb := '[]'::jsonb;
    user_record jsonb;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN QUERY SELECT false, 'Sesión no autenticada.';
        RETURN;
    END IF;

    IF lower(coalesce(auth.jwt() ->> 'email', '')) <> 'admin@donhelado.com'
       AND lower(coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '')) NOT LIKE '%admin%'
       AND lower(coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '')) NOT LIKE '%admin%' THEN
        RETURN QUERY SELECT false, 'Sesión no autenticada.';
        RETURN;
    END IF;

    SELECT COALESCE(value, '[]'::jsonb)
    INTO current_list
    FROM public.helados_sync
    WHERE key = 'staff_users';

    IF lower(coalesce(p_action, 'upsert')) = 'delete' THEN
        next_list := (
            SELECT COALESCE(jsonb_agg(item), '[]'::jsonb)
            FROM jsonb_array_elements(COALESCE(current_list, '[]'::jsonb)) AS item
            WHERE lower(COALESCE(item->>'email', '')) <> normalized_target
        );
    ELSE
        SELECT item
        INTO existing_user
        FROM jsonb_array_elements(COALESCE(current_list, '[]'::jsonb)) AS item
        WHERE lower(COALESCE(item->>'email', '')) = normalized_target
        LIMIT 1;

        user_record := jsonb_build_object(
            'id', COALESCE(existing_user->>'id', uuid_generate_v4()::text),
            'username', COALESCE(NULLIF(p_username, ''), existing_user->>'username', split_part(COALESCE(p_target_email, ''), '@', 1)),
            'email', lower(COALESCE(p_target_email, '')),
            'name', COALESCE(NULLIF(p_name, ''), existing_user->>'name', split_part(COALESCE(p_target_email, ''), '@', 1)),
            'role', COALESCE(NULLIF(p_role, ''), existing_user->>'role', 'Vendedor'),
            'password', COALESCE(NULLIF(p_password, ''), existing_user->>'password', ''),
            'status', COALESCE(NULLIF(p_status, ''), existing_user->>'status', 'Activo'),
            'allowedTabs', COALESCE(existing_user->'allowedTabs', '[]'::jsonb)
        );

        next_list := (
            SELECT COALESCE(jsonb_agg(item), '[]'::jsonb)
            FROM (
                SELECT item
                FROM jsonb_array_elements(COALESCE(current_list, '[]'::jsonb)) AS item
                WHERE lower(COALESCE(item->>'email', '')) <> normalized_target
                UNION ALL
                SELECT user_record
            ) AS combined
        );
    END IF;

    INSERT INTO public.helados_sync (key, value, updated_at)
    VALUES ('staff_users', next_list, now())
    ON CONFLICT (key) DO UPDATE
    SET value = EXCLUDED.value,
        updated_at = EXCLUDED.updated_at;

    RETURN QUERY SELECT true, CASE WHEN lower(coalesce(p_action, 'upsert')) = 'delete' THEN 'Usuario eliminado.' ELSE 'Usuario guardado.' END;
END;
$$;

-- =====================================================================
-- FIN DEL SCRIPT.
-- =====================================================================
