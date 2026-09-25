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

El acceso administrativo no se muestra como botón en la tienda pública. El personal puede hacer doble clic en el logo o abrir directamente `https://www.pideanda.com/?admin=1` e iniciar sesión. La URL y el gesto solo abren la pantalla de acceso: la autorización real sigue dependiendo de Supabase y de las comprobaciones del servidor. El acceso **📊 Embudo de ventas** está al final del menú lateral, junto a **Todos los ajustes**.

La opción de recordar el inicio de sesión conserva únicamente el nombre de usuario. Al abrir la tienda se eliminan las contraseñas que versiones anteriores hayan guardado en el navegador.

En **Canales y ajustes → Canales de venta** se pueden combinar mesas, barra y delivery, o dejar solo uno. Pulsa **Guardar canales** para aplicar el cambio. El checkout y el tomador muestran los canales permitidos. La API rechaza pedidos nuevos dirigidos a canales desactivados. Los pedidos ya existentes siguen visibles para poder terminarlos o cobrarlos.

Desde **Pedidos en Mesa → Monitor de Mesas y Barra** se puede abrir el **Tomador de Pedidos** con la mesa o barra seleccionada. Al confirmar, el pedido aparece en el monitor. Una mesa con pedido activo no se puede abrir por segunda vez desde el tomador.

## Embudo de ventas

El panel **📊 Embudo de ventas** funciona sin configuración: la tienda cuenta de forma anónima (sin datos personales) las visitas, los productos vistos, los agregados al carrito y los inicios de checkout, y los guarda por día (hora de Lima) en `funnel_AAAA-MM-DD`. Los pedidos, las ventas, el ticket promedio, lo más pedido y los canales salen de los pedidos reales (sin cancelados ni ventas registradas por el personal). La pestaña **Google Analytics 4** es opcional.

## Panel de conversiones GA4 (opcional)

El ID de medición `G-…` se configura en **Ajustes Tienda** y permite enviar los eventos `view_item`, `add_to_cart`, `begin_checkout` y `purchase`. El panel **Conversiones GA4** consulta recuentos reales de esos eventos en la propiedad y requiere configuración adicional del servidor:

1. Crea o selecciona un proyecto de Google Cloud y habilita la **Google Analytics Data API**.
2. Crea una cuenta de servicio y concédele acceso de **Lector** a la propiedad GA4.
3. Configura `GA4_PROPERTY_ID` con el ID numérico de la propiedad. Es distinto del ID de medición `G-…`.
4. Configura `GA4_SERVICE_ACCOUNT_JSON` con el JSON completo de la cuenta de servicio como secreto del servidor de Cloudflare Pages. Nunca lo publiques con el prefijo `VITE_` ni lo confirmes en Git.
5. Configura `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` en el servidor para validar el acceso de administradores.

Para desarrollo local, estas variables pueden estar en `.env` (excluido de Git). El panel muestra un estado de configuración hasta que las credenciales estén disponibles. GA4 puede tardar en procesar eventos recientes. El panel muestra recuentos de eventos, no usuarios únicos.

## Límite de pedidos

La API acepta como máximo **10 pedidos en 24 horas por número de celular**. Además, una misma conexión puede enviar hasta 30 pedidos por hora. Los pedidos de mesa quedan exentos de este segundo tope porque en el local todos comparten el mismo wifi. Los pedidos registrados por el personal desde el panel no tienen límite.

Para agrupar pedidos por conexión, la API guarda un hash HMAC de la IP y nunca la IP en sí. La clave es `ORDER_LIMIT_SECRET`; si no está configurada, se usa `SUPABASE_SERVICE_ROLE_KEY`.
