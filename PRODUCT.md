# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Jóvenes por delivery** en Andahuaylas (Apurímac, Perú): piden desde el celular y reciben en casa.
- **Familias**: compran potes de 1 litro y packs para compartir.
- **Gente en la calle**: busca el carrito de helados más cercano en el mapa.
- También existen pedidos en mesa (QR) y en barra, configurables por la tienda; no son el público principal de la web.

## Product Purpose

pideanda.com es la tienda en línea de la heladería Friozo: muestra la carta, deja armar un helado a gusto, cobra (Yape, Plin, efectivo, transferencia, tarjeta POS) y permite seguir el pedido. El éxito es que el visitante del celular llegue a un pedido confirmado lo más rápido posible y vuelva a pedir.

## Positioning

- Hecho al momento: el helado se prepara cuando se pide.
- Arma tu helado: base, bolas, toppings y salsas a gusto, con vista previa.
- Sabores peruanos: lúcuma, maracuyá, frutas de la zona.
- Precio accesible: desde S/ 1 la bola.
- Carritos en la calle con ubicación en tiempo real.

## Operating Context

La mayoría llega desde anuncios en redes sociales y desde la calle, en celular. Delivery con costo y umbral de envío gratis configurables; WhatsApp y un chat (puente a Telegram) para consultas. El catálogo, precios, promociones, horarios y canales los administra el dueño desde el panel de administración (Supabase); la web pública se prerenderiza para SEO y se publica en Cloudflare Pages desde la rama `main` de GitHub.

## Capabilities and Constraints

- React 19 + Vite; CSS propio en capas (`index.css`, `artisan.css`, `sorbet.css`, `storefront-refresh.css`); modo claro y oscuro.
- Vistas públicas: tienda/carta, vista rápida de producto, armador de helado, armador de litro, carrito y checkout, rastreo de pedido, mapa de carritos.
- El panel de administración comparte la app pero no es parte del rediseño de la tienda.
- Contenido dinámico (nombres, precios, fotos, promociones) viene de la configuración: el diseño debe aguantar textos largos y productos sin foto.

## Brand Commitments

- Nombre: Friozo (logo configurable desde el panel).
- Frase del inicio: «Qué rico caer en la tentación».
- Fotos de helados actuales (cono principal, paletas, envases del armador).
- Mandato del dueño: conservar o implementar lo que motive ventas.
- Dirección visual elegida por el dueño (nov-2026): «heladería clásica», el estándar del rubro bien ejecutado; su vara de acabado son Häagen-Dazs, Baskin-Robbins, Amorino y D'Onofrio.

## Evidence on Hand

- Fotos: `public/hero-friozo-v2.webp`, `public/paletas/*.webp`, `public/customizer/*.webp`, `public/friozo_og_image.png`.
- Opiniones de clientes: solo las que el dueño configure en el panel; no inventar testimonios, cifras de ventas ni descuentos.

## Product Principles

1. El celular manda: cada pantalla se diseña primero para una mano y una pantalla de 390 px.
2. Del antojo al pedido en pocos toques: precio y botón de agregar siempre visibles.
3. Mostrar el helado, no describirlo: la foto y la vista previa del armado venden.
4. Honestidad comercial: precios, envíos y promociones salen de la configuración real.

## Accessibility & Inclusion

WCAG 2.2 AA: contraste, objetivos táctiles de 44 px, foco visible, `prefers-reduced-motion` respetado.
