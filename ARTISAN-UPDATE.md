# FRIOSO: tienda y operaciones

La tienda comparte una identidad de crema, cacao y fresa, tipografía editorial y fotografías de producto. El creador conserva el contrato de carrito existente y utiliza los precios y disponibilidad actuales del catálogo.

## Creador de helados

- Envases con coordenadas ajustadas a los bordes reales de sus fotografías.
- Composiciones de una a cinco bolas, con oclusión por capas y toppings fotográficos unidos a cada bola.
- Búsqueda de sabores, filtros, cantidades, desglose de precio y recomendaciones válidas del catálogo.
- Navegación por teclado, mensajes accesibles, estados vacíos y protección contra envíos repetidos.
- La tienda cerrada conserva la selección y no navega al carrito como si se hubiera añadido.

## Centro de operaciones

Disponible en el administrador; conserva los permisos actuales del personal.

- Pedidos abiertos ordenados por antigüedad y filtro de más de 20 minutos desde su creación.
- Inicio de preparación con el actualizador de pedidos existente.
- Demanda por sabor: cuenta bolas de pedidos personalizados pendientes o en preparación y multiplica por cantidad.
- Ventas, ticket medio y comparativa de pedidos entregados **creados en el día**, usando America/Lima. No equivale a un cierre contable por fecha de entrega o cobro.
- Conteo manual de existencias en porciones/unidades, umbral de reposición y pausa/reactivación de productos. Se guarda en el catálogo mediante los mecanismos de sincronización existentes. **No descuenta ventas automáticamente.**
- Alertas de margen bruto inferior al 50%. Los costos faltantes se muestran como incompletos. El cálculo excluye gastos fijos, transporte y descuentos.
- Exportación CSV de pedidos creados hoy, incluidos los cancelados, con estado y escape de fórmulas.
- Catálogo con búsqueda y filtros por categoría/disponibilidad, pausa y reactivación, y exportación de la selección.
- Lista descargable de reposición basada en los conteos manuales: objetivo de dos veces el mínimo registrado.
- Simulador de precio por margen bruto, con validación de costos y redondeo a céntimos, sin cambiar precios automáticamente.

Los conos normal y artesanal tienen un encaje menos profundo de las bolas y un recorte lateral en la abertura. Se mantiene la composición del vaso y la copa waffle.

## Validación

Se añadieron pruebas de geometría, precios, disponibilidad de recomendaciones, fechas de Perú, demanda, márgenes, exportación y renderizado React de 20 combinaciones de envase/cantidad. No se realizaron pedidos reales ni pruebas autenticadas en producción.

Pruebas de lógica: `node --test tests/atelier.test.mjs tests/contrast.test.mjs tests/admin-tools.test.mjs`.

Renderizado sin navegador: compilar `tests/render.test.jsx` con esbuild, JSX automático, plataforma Node, paquetes externos y cargador CSS vacío; ejecutar el resultado con `node --test`.

Las fotografías existentes se reutilizan. `public/customizer/toppings-artisan.png` es un nuevo recurso generado para los toppings. Los envases personalizados usan una representación orientativa de su tipo.
