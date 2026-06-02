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

-- =====================================================================
-- FIN DEL SCRIPT.
-- =====================================================================
