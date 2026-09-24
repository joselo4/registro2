-- =====================================================================
-- SCRIPT DE SEGURIDAD Y PROTECCIÓN DE DATOS V2 (SUPABASE) - FRIOZO
-- Ejecuta este script completo en el 'SQL Editor' de tu panel de Supabase.
-- Antes de ejecutarlo, comprueba que cada operador (incluido el administrador)
-- tenga el mismo rol en auth.users.raw_app_meta_data.role y en staff_users,
-- y un registro con status 'Activo'. El acceso falla de forma segura si falta.
-- Despliega este SQL junto con el código actualizado; no expongas service_role.
-- =====================================================================

-- 1. Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Asegurar la existencia de la tabla helados_sync
CREATE TABLE IF NOT EXISTS public.helados_sync (
    key text PRIMARY KEY,
    value jsonb,
    updated_at timestamptz DEFAULT now()
);

-- 3. ACTIVAR ROW LEVEL SECURITY (RLS) - BLINDAJE OBLIGATORIO
ALTER TABLE public.helados_sync ENABLE ROW LEVEL SECURITY;

-- 4. ELIMINAR TODAS LAS POLÍTICAS PREVIAS PARA EVITAR CONFLICTOS
DROP POLICY IF EXISTS "Permitir lectura pública de llaves generales" ON public.helados_sync;
DROP POLICY IF EXISTS "Permitir lectura publica de catalogo" ON public.helados_sync;
DROP POLICY IF EXISTS "Permitir a clientes crear y leer sus propios pedidos" ON public.helados_sync;
DROP POLICY IF EXISTS "Permitir a clientes y vendedores actualizar ubicaciones de carritos" ON public.helados_sync;
DROP POLICY IF EXISTS "Permitir todo a administradores autenticados" ON public.helados_sync;
DROP POLICY IF EXISTS "Permitir todo a personal autenticado" ON public.helados_sync;
DROP POLICY IF EXISTS "Permitir lectura operativa a personal autenticado" ON public.helados_sync;
DROP POLICY IF EXISTS "Permitir escritura operativa a personal autenticado" ON public.helados_sync;
DROP POLICY IF EXISTS "Permitir insercion operativa a personal autenticado" ON public.helados_sync;
DROP POLICY IF EXISTS "Lectura por rol activo" ON public.helados_sync;
DROP POLICY IF EXISTS "Escritura admin" ON public.helados_sync;
DROP POLICY IF EXISTS "Escritura operativa limitada" ON public.helados_sync;
DROP POLICY IF EXISTS "Insercion operativa limitada" ON public.helados_sync;

-- 5. LIMPIEZA DE DATOS Y CREDENCIALES COMPROMETIDAS
DELETE FROM public.helados_sync WHERE key = 'r2_config';
DELETE FROM public.helados_sync WHERE key = 'telegram_token';
DELETE FROM public.helados_sync WHERE key = 'telegram_chat_id';

-- 6. POLÍTICA DE LECTURA PÚBLICA (SOLO PARA CLIENTES / ROL 'anon')
-- Los clientes anónimos SOLO pueden consultar el catálogo público.
-- 'orders', 'expenses', 'sales_goal', 'staff_users' quedan completamente bloqueados.
CREATE POLICY "Permitir lectura publica de catalogo" 
ON public.helados_sync
FOR SELECT
TO anon
USING (
    key LIKE 'order_call_%'
    OR key IN (
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
        'popsicles',
        'testimonials',
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
        'ticket_custom_message',
        'cart_locations',
        'store_hero_image',
        'meta_pixel_id',
        'google_analytics_id',
        'trends_interval',
        'trends_display_time'
    )
);

-- 7. A JWT alone is not an administrative role. Match its server-assigned
-- app_metadata role to the current active staff record. This revokes direct
-- database access immediately after a staff suspension or role change.
CREATE OR REPLACE FUNCTION public.current_app_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT CASE WHEN auth.uid() IS NULL THEN '' ELSE coalesce((
    SELECT CASE WHEN lower(item->>'role') = 'admin' THEN 'administrador' ELSE lower(item->>'role') END
    FROM public.helados_sync AS staff
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(staff.value) = 'array' THEN staff.value ELSE '[]'::jsonb END
    ) AS item
    WHERE staff.key = 'staff_users'
      AND lower(item->>'email') = lower(auth.jwt()->>'email')
      AND lower(coalesce(item->>'status', 'Activo')) NOT LIKE '%suspend%'
      AND (CASE WHEN lower(item->>'role') = 'admin' THEN 'administrador' ELSE lower(item->>'role') END)
        = (CASE WHEN lower(coalesce(auth.jwt()->'app_metadata'->>'role', '')) = 'admin'
            THEN 'administrador' ELSE lower(coalesce(auth.jwt()->'app_metadata'->>'role', '')) END)
    LIMIT 1
  ), '') END;
$$;

CREATE POLICY "Lectura por rol activo" ON public.helados_sync
FOR SELECT TO authenticated
USING (
  key IN (
    'store_name', 'store_logo', 'store_title', 'store_favicon',
    'store_phone', 'store_instagram', 'store_facebook',
    'whatsapp_contact_message', 'shop_open', 'catalog_order',
    'flavors', 'toppings', 'bases', 'packs', 'popsicles', 'testimonials', 'coupons',
    'delivery_fee', 'free_delivery_threshold', 'delivery_campaign_text',
    'sound_enabled', 'whatsapp_greeting', 'whatsapp_footer',
    'qr_custom_url', 'recommendations', 'cart_recommended_pack',
    'liter_config', 'ticket_custom_message', 'cart_locations',
    'store_hero_image', 'meta_pixel_id', 'google_analytics_id',
    'trends_interval', 'trends_display_time'
  )
  OR key LIKE 'order_call_%'
  OR public.current_app_role() = 'administrador'
  OR (public.current_app_role() IN ('vendedor', 'cocina', 'cajero', 'mozo')
      AND (key = 'orders' OR (key LIKE 'order_%' AND key NOT LIKE 'order_call_%')
           OR key = 'staff_permissions'))
);

CREATE POLICY "Escritura admin" ON public.helados_sync
FOR ALL TO authenticated
USING (public.current_app_role() = 'administrador')
WITH CHECK (public.current_app_role() = 'administrador');

-- Orders and payments are changed only through /api/order, where role,
-- transition and compare-and-swap checks run against the stored row.
CREATE POLICY "Escritura operativa limitada" ON public.helados_sync
FOR UPDATE TO authenticated
USING (public.current_app_role() IN ('vendedor', 'cajero', 'mozo', 'cocina')
       AND (key LIKE 'order_call_%' OR (public.current_app_role() = 'vendedor' AND key = 'cart_locations')))
WITH CHECK (public.current_app_role() IN ('vendedor', 'cajero', 'mozo', 'cocina')
            AND (key LIKE 'order_call_%' OR (public.current_app_role() = 'vendedor' AND key = 'cart_locations')));

CREATE POLICY "Insercion operativa limitada" ON public.helados_sync
FOR INSERT TO authenticated
WITH CHECK (public.current_app_role() IN ('vendedor', 'cajero', 'mozo', 'cocina')
            AND (key LIKE 'order_call_%' OR (public.current_app_role() = 'vendedor' AND key = 'cart_locations')));

-- 8. RPC REQUERIDO POR EL PANEL DE ADMINISTRACIÓN: get_all_admins()
-- Nota: Usa gen_random_uuid() nativo de PostgreSQL en lugar de extensiones externas
CREATE OR REPLACE FUNCTION public.get_all_admins()
RETURNS TABLE (
    id text,
    username text,
    email text,
    name text,
    role text,
    status text,
    "allowedTabs" jsonb
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, extensions, pg_temp
AS $$
    SELECT
        COALESCE(item->>'id', gen_random_uuid()::text) AS id,
        COALESCE(item->>'username', split_part(COALESCE(item->>'email', ''), '@', 1)) AS username,
        COALESCE(item->>'email', '') AS email,
        COALESCE(item->>'name', split_part(COALESCE(item->>'email', ''), '@', 1)) AS name,
        COALESCE(item->>'role', 'Vendedor') AS role,
        COALESCE(item->>'status', 'Activo') AS status,
        COALESCE(item->'allowedTabs', '[]'::jsonb) AS "allowedTabs"
    FROM public.helados_sync sync_row
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(sync_row.value, '[]'::jsonb)) AS item
    WHERE sync_row.key = 'staff_users'
      AND public.current_app_role() IN ('administrador', 'vendedor', 'cajero', 'mozo', 'cocina')
    ORDER BY COALESCE(item->>'name', item->>'email');
$$;

-- 8.1 Un canje y su pedido se confirman juntos. El bloqueo de la fila de
-- cupones serializa compras simultáneas y la transacción revierte ambos
-- cambios si el ID del pedido colisiona o falla la escritura.
CREATE OR REPLACE FUNCTION public.insert_customer_order(
    p_order jsonb,
    p_coupon_code text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    coupon_data jsonb;
    coupon_entry jsonb;
    coupon_index bigint;
    used_count integer;
    max_uses integer;
    order_id text;
BEGIN
    IF auth.role() IS DISTINCT FROM 'service_role' THEN
        RAISE EXCEPTION 'Acceso no permitido.' USING ERRCODE = '42501';
    END IF;
    order_id := p_order->>'id';
    IF p_coupon_code IS NULL OR btrim(p_coupon_code) = '' OR order_id IS NULL OR order_id !~ '^PED-[A-Z0-9-]{4,40}$'
       OR upper(coalesce(p_order->>'couponCode', '')) <> upper(coalesce(p_coupon_code, '')) THEN
        RAISE EXCEPTION 'Pedido o cupón inválido.' USING ERRCODE = '22023';
    END IF;

    SELECT value INTO coupon_data
    FROM public.helados_sync WHERE key = 'coupons' FOR UPDATE;
    IF jsonb_typeof(coupon_data) <> 'array' THEN
        RAISE EXCEPTION 'Los cupones no están configurados.' USING ERRCODE = '22023';
    END IF;
    SELECT item, ordinality INTO coupon_entry, coupon_index
    FROM jsonb_array_elements(coupon_data) WITH ORDINALITY AS coupon(item, ordinality)
    WHERE upper(item->>'code') = upper(p_coupon_code)
    LIMIT 1;
    IF coupon_entry IS NULL OR lower(coalesce(coupon_entry->>'active', 'true')) = 'false' THEN
        RAISE EXCEPTION 'El cupón ya no está disponible.' USING ERRCODE = '22023';
    END IF;
    used_count := coalesce((coupon_entry->>'usedCount')::integer, 0);
    max_uses := coalesce((coupon_entry->>'limit')::integer, 0);
    IF max_uses > 0 AND used_count >= max_uses THEN
        RAISE EXCEPTION 'El cupón alcanzó su límite.' USING ERRCODE = '22023';
    END IF;

    INSERT INTO public.helados_sync(key, value, updated_at)
    VALUES ('order_' || order_id, p_order, now());
    UPDATE public.helados_sync
    SET value = jsonb_set(coupon_data, ARRAY[(coupon_index - 1)::text, 'usedCount'], to_jsonb(used_count + 1), true),
        updated_at = now()
    WHERE key = 'coupons';
    RETURN p_order;
END;
$$;
REVOKE ALL ON FUNCTION public.insert_customer_order(jsonb, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.insert_customer_order(jsonb, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.insert_customer_order(jsonb, text) TO service_role;

-- 9. ELIMINAR CONTRASEÑAS EN TEXTO PLANO SI EXISTIERAN EN staff_users
UPDATE public.helados_sync
SET value = (
    SELECT COALESCE(jsonb_agg(item - 'password'), '[]'::jsonb)
    FROM jsonb_array_elements(COALESCE(value, '[]'::jsonb)) AS item
)
WHERE key = 'staff_users'
  AND jsonb_typeof(value) = 'array';

-- 10. HABILITAR TIEMPO REAL PARA SINCRONIZACIÓN DE PEDIDOS Y ESTADOS
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'helados_sync'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.helados_sync;
  END IF;
END;
$$;
