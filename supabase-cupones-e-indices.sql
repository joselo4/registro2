-- Ejecutar una vez en Supabase → SQL Editor, después de publicar esta versión de la tienda.
-- 1) Los códigos de cupón dejan de ser legibles para visitantes anónimos: la tienda
--    ahora comprueba un cupón a la vez en /api/coupon, con límite de intentos.
-- 2) Índices para que los límites de pedidos por teléfono y conexión sigan rápidos
--    cuando haya miles de pedidos guardados.
-- No cambia ni borra datos.

-- Las políticas de lectura se suman: si queda cualquier política antigua que deje leer
-- a visitantes anónimos, los cupones seguirían visibles. Se eliminan todas las de
-- lectura para anon/public en esta tabla y se crea una sola con la lista correcta.
DO $$
DECLARE
  existing_policy record;
BEGIN
  FOR existing_policy IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'helados_sync'
      AND cmd IN ('SELECT', 'ALL')
      AND (roles && ARRAY['anon', 'public']::name[])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.helados_sync', existing_policy.policyname);
  END LOOP;
END $$;

CREATE POLICY "Permitir lectura publica de catalogo"
ON public.helados_sync
FOR SELECT
TO anon
USING (
    key LIKE 'order_call_%'
    OR key IN (
        'store_name', 'store_logo', 'store_title', 'store_favicon', 'store_phone',
        'store_instagram', 'store_facebook', 'whatsapp_contact_message', 'shop_open',
        'catalog_order', 'flavors', 'toppings', 'bases', 'packs', 'popsicles',
        'testimonials', 'delivery_fee', 'free_delivery_threshold', 'delivery_campaign_text',
        'sound_enabled', 'whatsapp_greeting', 'whatsapp_footer', 'qr_custom_url',
        'recommendations', 'cart_recommended_pack', 'liter_config', 'ticket_custom_message',
        'cart_locations', 'store_hero_image', 'meta_pixel_id', 'google_analytics_id',
        'trends_interval', 'trends_display_time'
    )
);

-- Índices de pedidos. La tabla es pequeña: se crean en un instante.
CREATE INDEX IF NOT EXISTS helados_sync_order_contact_idx
  ON public.helados_sync ((value->>'contactKey'), (value->>'createdAt'))
  WHERE key LIKE 'order_PED-%';

CREATE INDEX IF NOT EXISTS helados_sync_order_client_idx
  ON public.helados_sync ((value->>'clientKey'), (value->>'createdAt'))
  WHERE key LIKE 'order_PED-%';

-- Resultado: las políticas que quedan en la tabla. Para visitantes (anon) debe haber
-- una sola de lectura: "Permitir lectura publica de catalogo".
SELECT policyname, roles, cmd FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'helados_sync'
ORDER BY cmd, policyname;
