# Don Helado

Tienda y panel de operaciones con React, Vite, Supabase y Cloudflare Pages Functions.

## Desarrollo

```bash
npm install
cp .env.example .env
npm run dev
```

Para verificar cambios: `npm run lint`, `npm test`, `npm run test:views` y `npm run build`.

## Canales de venta

En la web pública, abre **Acceso al panel de gestión** desde el pie de página e inicia sesión como administrador. Los accesos **Canales y ajustes** y **Conversiones GA4** aparecen al inicio del menú lateral.

En **Canales y ajustes → Canales de venta** se pueden combinar mesas, barra y delivery, o dejar solo uno. Pulsa **Guardar canales** para aplicar el cambio. El checkout y el tomador muestran los canales permitidos. La API rechaza pedidos nuevos dirigidos a canales desactivados. Los pedidos ya existentes siguen visibles para poder terminarlos o cobrarlos.

Desde **Pedidos en Mesa → Monitor de Mesas y Barra** se puede abrir el **Tomador de Pedidos** con la mesa o barra seleccionada. Al confirmar, el pedido aparece en el monitor. Una mesa con pedido activo no se puede abrir por segunda vez desde el tomador.

## Panel de conversiones GA4

El ID de medición `G-…` se configura en **Ajustes Tienda** y permite enviar los eventos `view_item`, `add_to_cart`, `begin_checkout` y `purchase`. El panel **Conversiones GA4** consulta recuentos reales de esos eventos en la propiedad y requiere configuración adicional del servidor:

1. Crea o selecciona un proyecto de Google Cloud y habilita la **Google Analytics Data API**.
2. Crea una cuenta de servicio y concédele acceso de **Lector** a la propiedad GA4.
3. Configura `GA4_PROPERTY_ID` con el ID numérico de la propiedad. Es distinto del ID de medición `G-…`.
4. Configura `GA4_SERVICE_ACCOUNT_JSON` con el JSON completo de la cuenta de servicio como secreto del servidor de Cloudflare Pages. Nunca lo publiques con el prefijo `VITE_` ni lo confirmes en Git.
5. Configura `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` en el servidor para validar el acceso de administradores.

Para desarrollo local, estas variables pueden estar en `.env` (excluido de Git). El panel muestra un estado de configuración hasta que las credenciales estén disponibles. GA4 puede tardar en procesar eventos recientes. El panel muestra recuentos de eventos, no usuarios únicos.
