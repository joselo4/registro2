# Tienda, promociones y consultas

La tienda incorpora una dirección visual de fresa, mango y pistacho: fondos coloridos, títulos más expresivos, fotografías de helados protagonistas, precios y botones de pedido legibles. Se conserva el catálogo, el personalizador, el carrito, los pedidos en mesa y el modo oscuro.

## Banner

En Administración → Configuración → Banner de ofertas y promociones se editan los textos, el botón y su destino, la imagen (URL o subida), el encuadre, los cuatro colores, la composición, el tamaño del título, la altura y el redondeado. También se puede elegir su ubicación, mostrarlo según el tipo de cliente y programar inicio y fin. Los cambios usan `shopConfig.promotion` y la sincronización de configuración existente. El botón Guardar promoción confirma la escritura en la nube; si falla, conserva el borrador y muestra el error. La vista previa funciona aun estando desactivado. El anuncio de bienvenida aparece una vez por visita y puede reabrirse; respeta activación, fechas y tipo de cliente. Se puede elegir un tema, cargar una imagen optimizada desde el dispositivo y mostrar un reclamo, precio anterior y precio promocional.

Las fechas se guardan en UTC desde la zona horaria del administrador y se evalúan igual para todos los clientes. El código de cupón del banner es informativo: el descuento se administra en Cupones. La campaña inicial invita a armar un helado; no inventa descuentos.

## Telegram

Las consultas se envían como texto plano para que los caracteres introducidos por el cliente no provoquen un segundo envío por errores de formato. Se conserva el límite del servidor de 8 segundos y ahora también cubre la lectura del cuerpo de la respuesta. El cliente deja de esperar después de 10 segundos, conserva la consulta ante fallos y permite reintentar en Telegram. El chat no abre ni ofrece WhatsApp. No hay redirecciones automáticas ni confirmaciones falsas; solo se muestra éxito ante `ok: true`.

La latencia real de Telegram depende del servicio externo. Las pruebas usan respuestas simuladas; no se enviaron consultas a clientes ni administradores.

## Publicación

El proyecto utiliza Cloudflare Pages Functions (`functions/api/telegram.js`) para Telegram. Sites ahora compila la interfaz y un Worker con las mismas rutas API mediante npm run build:sites. Las credenciales de Telegram se configuran como secretos del servidor; nunca se incluyen en el navegador. Cloudflare Pages conserva su compilación habitual npm run build y sus funciones. No se requiere una migración de base de datos. La comprobación GET /api/telegram?verify=1 valida el bot y el chat de destino sin enviar mensajes ni mostrar sus datos privados. Las demás rutas administrativas mantienen sus requisitos de Supabase y almacenamiento.

## Comprobación

Pruebas de programación y segmentación del banner, enlaces seguros, serialización, renderizado de componentes, contraste en ambos temas, confirmaciones de entrega, respuestas inválidas y tiempos de espera. Compilación de producción y revisión de código.

