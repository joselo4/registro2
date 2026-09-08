# Revisión de tienda — 8 de septiembre de 2026

La portada conserva el diseño elegido por el usuario en la segunda captura: fondo rosado, imagen grande del helado sobre un círculo amarillo, título «Qué rico caer en la tentación», botones «Quiero mi helado» y «Explorar la carta», beneficios y franja inferior. Las categorías respetan la selección de la tienda y la configuración de mesas; las categorías vacías explican lo que ocurre. El carrito separa productos de entrega y pago, muestra el total en el botón de confirmación y ofrece un estado vacío con regreso a la carta. Los campos tienen autocompletado, los errores se asocian con sus campos y los controles de cantidad tienen nombres accesibles y áreas de 44 px. El diseño mantiene los temas claro y oscuro.

Se eliminó la página alternativa de texto de `index.html`, que correspondía a la primera captura. Ahora existe una sola tienda React y un estado breve de carga con la misma imagen. Si falla la carga, se informa y se permite recargar sin borrar el carrito. Se conservan los metadatos SEO y los datos estructurados. La conexión de Supabase ya no accede directamente al almacenamiento restringido durante la importación inicial.

La compilación comprueba que el HTML utilice los scripts compilados y que existan sus estilos e imagen. Los documentos HTML se revalidan y las peticiones de scripts o estilos faltantes no reciben la página HTML como sustituto. El destino solicitado para esta actualización es el repositorio GitHub `joselo4/registro2`; la página privada de Sites es una publicación independiente.

Se corrigieron bloqueos al renderizar packs sin etiqueta, precios guardados como texto y detalles opcionales ausentes. Los importes se redondean a céntimos; los descuentos no superan el subtotal ni absorben el envío. El cliente y el servidor rechazan cantidades inválidas y el servidor comprueba la coherencia aritmética de los importes y los datos de entrega.

El envío bloquea el formulario y los controles del carrito. El comprobante debe corresponder al código y clave de envío originales. Fallos de estadísticas o de apertura de WhatsApp después del guardado no convierten la compra en un fallo. El almacenamiento restringido del navegador usa una reserva en memoria durante la sesión. Los productos añadidos durante un envío no desaparecen al confirmarse el pedido anterior. Los reintentos del mismo borrador conservan su identificador.

El horario usa America/Lima tanto en cliente como en servidor y contempla turnos que cruzan medianoche. La pantalla actualiza el horario cada 30 segundos y el servidor lo vuelve a comprobar al crear el pedido. Recuperar un pedido previamente confirmado sigue funcionando después del cierre.

## Verificación y publicación

- 91 pruebas de lógica, API, inicio y persistencia simulada y 24 de renderizado: 115 aprobadas.
- Compilación de interfaz y servidor correcta. La revisión estática no presenta errores; conserva 58 avisos del proyecto.
- Consulta de solo lectura en `www.pideanda.com/api/order`: devuelve JSON y 404 para un código inexistente.
- No se crearon pedidos de prueba ni se enviaron mensajes en producción. No se realizó una prueba de compra real ni una inspección visual automatizada en navegador.
- Publicar la interfaz y `functions/` juntas para aplicar la protección del servidor en www.pideanda.com. No se modificó la configuración ni los datos de producción.
- La instalación privada de Sites no tiene configurada `SUPABASE_SERVICE_ROLE_KEY`; la vista privada sirve para revisión del diseño, pero su API de pedidos necesita esa clave secreta antes de operar. Nunca debe incluirse en código de cliente ni con prefijo VITE_.

Estas pruebas cubren los casos indicados y no garantizan ausencia absoluta de fallos. La disponibilidad de la base de datos y los avisos externos debe verificarse en el entorno donde se publique. La validación aritmética no sustituye una cotización de precios y cupones completamente calculada desde el catálogo del servidor.
