# Pedidos: validación, preparación y entrega

## Qué se corrigió

- El cliente recibía un código y perdía su carrito **antes** de que la base de datos confirmara el pedido. Ahora solo se confirma después del guardado; un fallo conserva el carrito y el reintento utiliza el mismo identificador.
- Algunos cambios de pago, edición y repartidor solo modificaban `orders`, mientras seguimiento leía `order_PED-…`. Ahora cada pedido se guarda individualmente y la lista antigua queda como compatibilidad de lectura.
- Una lista antigua podía sustituir pedidos recientes. La combinación conserva la versión más reciente por código y cada escritura comprueba que otro operador no haya cambiado el pedido.
- La carga administrativa no recorría todas las páginas de Supabase. Ahora recorre todos los registros y actualiza pedidos cada 15 segundos, además de los avisos en tiempo real y la reconexión.
- Android intentaba consultar rutas en `https://localhost`, y el servidor rechazaba ese origen. El APK utiliza la API de `https://www.pideanda.com`; el servidor reconoce el origen del APK.
- El rastreador confundía errores de conexión con pedidos inexistentes. Ahora distingue ambos casos y solo muestra pedidos confirmados por el servidor.
- Cocina podía preparar pedidos sin validar y confundir “listo” con “entregado” o “en camino”. Ahora hay pasos separados y el servidor comprueba su orden.
- Los roles Repartidor, Cajero y Mozo no estaban contemplados en las antiguas políticas operativas. La API verifica el rol del usuario autenticado. Un repartidor solo recibe sus pedidos asignados y no puede cambiar su cliente, importe ni productos.

## Cómo operar

| Paso | Acción | Resultado |
| --- | --- | --- |
| 1. Por validar | Revisar productos, datos y pago. Para Yape/Plin, verificar el abono real. | Pedido aceptado y en cola. |
| 2. En cola | Cocina pulsa **Empezar a preparar**. | Comienza la preparación. |
| 3. Preparando | Cocina pulsa **Marcar listo para entregar**. | Pedido listo; todavía no está entregado ni en ruta. |
| 4. Listo | Delivery: asignar repartidor e iniciar reparto. Mesa/barra/recojo: entregar al cliente. | Delivery pasa a En camino; los otros canales pasan a Entregado. |
| 5. En camino | El repartidor confirma la entrega y el cobro que corresponda. | Pedido entregado. |
| Mesa servida | Tras la entrega, confirmar el cobro y cerrar la mesa. | La mesa se libera únicamente cuando está pagada. |

El efectivo de delivery, barra y recojo se confirma antes de completar la entrega. Servir en mesa no significa que la cuenta esté pagada. Un pedido creado directamente por el mozo empieza en cola porque el operador ya lo revisó; las ventas rápidas presenciales se registran como ventas terminadas.

Si aparece **No se confirmó el cambio**, revisa la lista actualizada antes de intentarlo nuevamente. La aplicación no anuncia éxito, ni cambia el estado visible, sin respuesta de guardado. Los pedidos pendientes no caducan por llevar más de 72 horas abiertos.

## Instalación y publicación

La app Android 1.1 usa el mismo identificador `com.donhelado.carritos` y un código de versión mayor. El APK de esta entrega está firmado con la clave de depuración disponible en esta máquina; puede actualizar una instalación anterior que tenga esa misma firma.

La versión web y sus funciones de servidor deben publicarse juntas desde este repositorio. El APK 1.1 requiere la API actualizada en `https://www.pideanda.com`. `VITE_API_BASE_URL` permite seleccionar otro servidor al compilar Android. No debe apuntar al sitio privado de Sites, que requiere una sesión de acceso aparte.

El servidor necesita `SUPABASE_URL` (o `VITE_SUPABASE_URL`) y `SUPABASE_SERVICE_ROLE_KEY`. Esa clave es secreta y nunca debe llevar prefijo `VITE_` ni incluirse en el APK. El cliente utiliza únicamente la URL y la clave pública de Supabase. La prueba local de funciones también exige una clave de servidor válida; ya no se sustituye silenciosamente por la clave anónima.

No hace falta ejecutar una migración de base de datos. Los pedidos que solo existen en la lista antigua siguen siendo consultables y se guardan individualmente al editarlos. Un código que una versión anterior mostró sin llegar a guardar en el servidor no constituye un pedido recuperable automáticamente.

## Verificación reproducible

- `npm test`: validaciones, creación y lectura, fallos de guardado, reintentos, colisiones, concurrencia, historial, permisos, paginación y todos los canales de entrega.
- `npm run test:views`: renderizado de componentes, botones del flujo y colas de cocina y reparto.
- `npm run lint`: revisión estática del código.
- `npm run build:sites`: compilación de interfaz y servidor para Sites/Worker.
- `npm run android:assemble`: compilación de la interfaz, sincronización de Android y generación del APK instalable.

Las pruebas de guardado utilizan una base simulada con inserciones únicas y actualizaciones condicionadas. No crean pedidos ficticios ni envían avisos a clientes en producción. La instalación en un teléfono real y la prueba con cuentas reales de cada operador deben comprobarse tras publicar la API.
