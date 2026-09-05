-- =====================================================================
-- SCRIPT DE SEGURIDAD Y PROTECCIÓN DE DATOS V2 (SUPABASE) - FRIOZO
-- Ejecuta este script completo en el 'SQL Editor' de tu panel de Supabase.
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

-- 7. POLÍTICA TOTAL PARA PERSONAL AUTENTICADO (ROL 'authenticated')
-- Cualquier usuario autenticado en Supabase Auth (admin/vendedor/cocina) tiene control operativo.
CREATE POLICY "Permitir todo a personal autenticado" 
ON public.helados_sync
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

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
      AND auth.uid() IS NOT NULL
    ORDER BY COALESCE(item->>'name', item->>'email');
$$;

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
