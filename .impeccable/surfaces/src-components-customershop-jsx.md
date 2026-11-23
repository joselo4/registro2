---
version: 1
slug: "src-components-customershop-jsx"
primary_target: "src/components/CustomerShop.jsx"
related_targets: ["src/components/Cart.jsx","src/App.jsx"]
---

# Tienda pública pideanda.com

Scope: todas las vistas públicas (tienda/carta, vista rápida, armadores de helado y litro, carrito y checkout, rastreo, mapa). Modo: Persuade en la portada; Operate en carrito, checkout, armadores y rastreo. El panel admin queda fuera.

Audiencia y tarea: jóvenes por delivery, familias (litros y packs) y gente en la calle (mapa de carritos), casi siempre en celular desde anuncios. Acción: agregar al carrito y confirmar el pedido.

Restricciones: frase «Qué rico caer en la tentación», fotos actuales, todo el comportamiento existente, modo claro y oscuro, contenido dinámico desde el panel.

## Direction contract

THESIS: La heladería clásica jugada en serio, al nivel de Häagen-Dazs, Baskin-Robbins, Amorino y D'Onofrio: el helado es la imagen, la marca es una franja de frambuesa y el precio siempre está a un pulgar. Rechaza el collage de stickers, emojis y degradados pastel de la versión anterior.

OWN-WORLD: Fondo blanco leche; secciones alternas en gris tibio muy claro; tinta chocolate (#2a1712); color de marca frambuesa (#b3123f) para acciones y la franja superior; dorado del logo solo en la etiqueta de precio «Desde». Cada producto sobre un panel tintado con el color de su sabor. Titulares en Young Serif, interfaz en Figtree. Iconos de trazo único 1.8 en vez de emojis. Esquinas 16 px en tarjetas, botones píldora, sombras cortas.

STORY: El visitante ve el cono y la frase, entiende «hecho al momento, desde S/ 1», agrega un favorito sin bajar mucho, recorre la carta por pestañas y confirma con Yape o efectivo.

FIRST VIEWPORT: Celular: barra blanca con logo y bolsa con contador; panel de héroe con foto grande del cono sobre blanco, titular serif de dos líneas, botón frambuesa «Pedir ahora» y enlace «Arma tu helado»; sello dorado «Desde S/ 1». Debajo asoma la fila «Los más pedidos» con botón Agregar. Escritorio: titular y botones a la izquierda, cono grande a la derecha, fila de cuatro garantías debajo.

FORM: Canon del rubro (salida estándar elegida por el dueño), sin carta de ruleta; seed: 318a8ea4128c4b41 (ronda degradada, sin retadores).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
