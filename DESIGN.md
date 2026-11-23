---
name: Friozo · pideanda.com
description: "The public ice-cream storefront, played as the classic heladería done properly: the ice cream is the picture, the brand is a raspberry strip, the price is always a thumb away."
colors:
  raspberry: "#b3123f"
  raspberry-deep: "#8e0d31"
  raspberry-tint: "#fcebf0"
  raspberry-text: "#b3123f"
  on-raspberry: "#ffffff"
  seal-gold: "#f6bb1e"
  seal-gold-ink: "#3d2a00"
  gold-tint: "#fff5d9"
  pistachio-green: "#1d7347"
  green-tint: "#e7f3ec"
  sky-tint: "#e8f1f8"
  milk-white: "#ffffff"
  warm-milk: "#f7f3ef"
  surface: "#ffffff"
  chocolate-ink: "#2a1712"
  cocoa-soft: "#6c5851"
  line: "#ece4df"
  line-strong: "#d9ccc5"
  footer-chocolate: "#2a1712"
  tone-strawberry: "#f2b8c6"
  tone-mango: "#f6cf6a"
  tone-pistachio: "#a8d5b5"
  dark-ground: "#160f0d"
  dark-milk: "#1f1613"
  dark-surface: "#231915"
  dark-ink: "#f8eee9"
  dark-ink-soft: "#ccb8b0"
  dark-line: "#3a2a25"
  dark-line-strong: "#574039"
  dark-raspberry: "#c8204f"
  dark-raspberry-deep: "#a9173f"
  dark-raspberry-tint: "#3a1820"
  dark-raspberry-text: "#ff8aa8"
  dark-gold-tint: "#3b2817"
  dark-green: "#7fd3a4"
  dark-green-tint: "#17291f"
  dark-sky-tint: "#172431"
  dark-footer: "#0e0907"
typography:
  display:
    fontFamily: "'Young Serif', Georgia, 'Times New Roman', serif"
    fontSize: "clamp(2.6rem, 5.4vw, 4.6rem)"
    fontWeight: 400
    lineHeight: 1.02
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "'Young Serif', Georgia, 'Times New Roman', serif"
    fontSize: "clamp(2rem, 3.6vw, 2.9rem)"
    fontWeight: 400
    lineHeight: 1.05
    letterSpacing: "-0.01em"
  title:
    fontFamily: "'Young Serif', Georgia, 'Times New Roman', serif"
    fontSize: "1.22rem"
    fontWeight: 400
    lineHeight: 1.18
    letterSpacing: "-0.01em"
  body:
    fontFamily: "'Figtree Variable', 'Figtree', system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "'Figtree Variable', 'Figtree', system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "0.9rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0em"
  price:
    fontFamily: "'Figtree Variable', 'Figtree', system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "1.2rem"
    fontWeight: 800
    lineHeight: 1.1
    fontFeature: "tnum"
rounded:
  field: "12px"
  choice: "16px"
  card-sm: "18px"
  card: "20px"
  card-lg: "22px"
  dialog: "24px"
  feature: "26px"
  hero: "28px"
  pill: "999px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "40px"
  2xl: "56px"
  3xl: "64px"
components:
  button-primary:
    backgroundColor: "{colors.raspberry}"
    textColor: "{colors.on-raspberry}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "12px 22px"
    height: "48px"
  button-primary-hover:
    backgroundColor: "{colors.raspberry-deep}"
    textColor: "{colors.on-raspberry}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.chocolate-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "12px 22px"
    height: "48px"
  button-add-card:
    backgroundColor: "{colors.raspberry}"
    textColor: "{colors.on-raspberry}"
    rounded: "{rounded.pill}"
    padding: "10px 18px"
    height: "44px"
  button-add-in-cart:
    backgroundColor: "{colors.green-tint}"
    textColor: "{colors.pistachio-green}"
    rounded: "{rounded.pill}"
    height: "44px"
  chip-filter:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.chocolate-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "8px 16px"
    height: "42px"
  chip-filter-active:
    backgroundColor: "{colors.chocolate-ink}"
    textColor: "{colors.milk-white}"
  input-field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.chocolate-ink}"
    rounded: "{rounded.field}"
    height: "48px"
  input-search:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.chocolate-ink}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "48px"
  card-product:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.chocolate-ink}"
    rounded: "{rounded.card}"
    padding: "16px 18px 18px"
  card-featured:
    backgroundColor: "{colors.raspberry-tint}"
    textColor: "{colors.chocolate-ink}"
    rounded: "{rounded.card-lg}"
    padding: "22px 20px 20px"
  hero-panel:
    backgroundColor: "{colors.warm-milk}"
    textColor: "{colors.chocolate-ink}"
    rounded: "{rounded.hero}"
    padding: "clamp(32px, 5vw, 72px) clamp(24px, 5vw, 72px)"
  price-seal:
    backgroundColor: "{colors.seal-gold}"
    textColor: "{colors.seal-gold-ink}"
    size: "clamp(92px, 9vw, 118px)"
  badge-popular:
    backgroundColor: "{colors.raspberry}"
    textColor: "{colors.on-raspberry}"
    rounded: "{rounded.pill}"
    padding: "5px 10px"
  badge-premium:
    backgroundColor: "{colors.seal-gold}"
    textColor: "{colors.seal-gold-ink}"
    rounded: "{rounded.pill}"
    padding: "5px 10px"
  nav-cart-pill:
    backgroundColor: "{colors.raspberry}"
    textColor: "{colors.on-raspberry}"
    rounded: "{rounded.pill}"
    padding: "8px 12px 8px 16px"
    height: "42px"
---

# Design System: Friozo · pideanda.com

Scope: the public storefront only (shop and menu, quick view, ice-cream and litre builders, cart and checkout, tracker, carts map). Everything here lives under the `.site-protected` wrapper. The admin panel keeps its legacy look and is not governed by this file.

## Overview

**Creative North Star: "The Classic Parlour Counter"**

Friozo plays the category standard, the heladería clásica, and holds it to the finish of Häagen-Dazs, Baskin-Robbins, Amorino and D'Onofrio (the owner's chosen bar, Nov 2026). The ice cream is the image; the brand is a raspberry strip across the top of the page and a raspberry disc behind the hero cone; the price is never more than a thumb away. Ground is milk white, sections step onto a warm grey milk tone, text is chocolate. Gold from the logo appears only where a price or a reward needs to be found instantly: the "Desde" seal, the cart counter, premium badges, star ratings.

Density is that of a shop counter on a phone: one hand, a 390px screen, every product carrying its photo, name, price and one raspberry action. Headlines are a soft, rounded serif (Young Serif) that reads like a painted shop sign; everything you tap or read to decide is in Figtree. Surfaces are flat white cards with hairline cocoa-grey borders and short, warm shadows that appear on hover only. Product photos sit on panels tinted with the colour of their flavour, so the catalogue reads as a vitrine of sabores rather than a grid of white boxes.

This world replaces the previous sticker collage of emoji, pastel gradients and floating badges. Those are rejected, not paused.

**Key Characteristics:**
- Milk-white ground, warm-milk sections, chocolate ink; raspberry for actions and the brand strip; gold reserved for price and reward.
- Young Serif 400 for headings only, Figtree for all interface text; no faux bold, no italics on the serif.
- Flavour-tinted photo panels under every product image.
- Pill buttons and chips, 18-28px rounded containers, hairline borders, flat at rest.
- One stroke icon family (24 grid, 1.8 stroke) instead of emoji.
- Mobile-first at 390px, 44px minimum targets, WCAG 2.2 AA in light and dark.

## Colors

A warm dairy palette: milk and chocolate neutrals carrying a single raspberry voice, with gold held back for the price.

### Primary
- **Friozo Raspberry** (raspberry): every primary action (Pedir ahora, Agregar, Personalizar, Confirmar), the 4px strip across the top of the header, the hero disc, the "Mi pedido" cart pill, the "Arma tu helado" feature card, active-tab indicators, chat bubble, checkout step numbers, text selection. Hover deepens to **Raspberry Deep** (raspberry-deep).
- **Raspberry Text** (raspberry-text): raspberry used as foreground (links such as "Ver todo", "Ver N", section icons, hero headline accent span, focus outline). In light it equals the fill; in dark it becomes the readable pink **dark-raspberry-text**.
- **Raspberry Tint** (raspberry-tint): selected payment method, active nav item, quick-view art panel, tracker and view hero icon discs, default featured card.

### Secondary
- **Seal Gold** (seal-gold) with **Seal Gold Ink** (seal-gold-ink): the rotated "Desde S/ 1.00" price seal, the header cart counter, premium badges, star ratings, the order-guide icon disc. Never a button fill, never body text.
- **Gold Tint** (gold-tint): pack featured card, "Lo de siempre" repeat-order block.

### Tertiary
- **Pistachio Green** (pistachio-green) with **Green Tint** (green-tint): success and delivery only: the "in cart" state of the add button, savings lines, free-delivery card, delivery banner, completed builder steps.
- **Sky Tint** (sky-tint): litre featured card only.
- **Flavour tones** (tone-strawberry, tone-mango, tone-pistachio): the default `--tone` cycle for product photo panels (nth-child 3n+1/2/3). A flavour's own colour from the panel overrides it. The panel is always `color-mix(in srgb, var(--tone) 26%, surface)` in light and 18% in dark; the raw tone is never painted at full strength.

### Neutral
- **Milk White** (milk-white / surface): page ground and card surface.
- **Warm Milk** (warm-milk): the hero panel, the order-guide card, builder stage, photo wells in cart and builder, hover fill for ghost controls, count pills.
- **Chocolate Ink** (chocolate-ink): all headings and body text, the active filter chip, the delivery banner action, the builder cart bar.
- **Cocoa Soft** (cocoa-soft): descriptions, captions, unit suffixes, inactive tabs.
- **Line** (line) and **Line Strong** (line-strong): hairline card borders and dividers; form, secondary button and stepper borders.
- **Footer Chocolate** (footer-chocolate): the full-bleed footer with milk-pink text (#f3e6e0 body, #d9c4bb and #c8b2a9 secondary); near-black dark-footer in dark mode.

### Dark theme
The `dark-*` tokens replace their light counterparts under `[data-theme="dark"] .site-protected`. Ground becomes a cocoa black, surfaces lift slightly warmer, raspberry fills brighten (dark-raspberry) and keep white text, gold stays the same.

### Named Rules
**The Raspberry Means Buy Rule.** Raspberry fill is reserved for committing actions toward an order. Navigation and selection state use chocolate ink (active filter chip, delivery banner action) or raspberry tint, never a second raspberry fill.

**The Gold Is Price Rule.** Gold marks price, count and reward (seal, cart counter, premium badge, stars). If it is not a number or a reward, it is not gold.

**The Dark Primary Rule.** In dark mode the legacy `--primary-color` maps to dark-raspberry-text, because it is used mostly as inline text colour (prices, highlights). Any background that needs raspberry must name `--fz-berry` explicitly with white text, not `--primary-color`.

## Typography

**Display Font:** Young Serif 400 (self-hosted via @fontsource/young-serif; fallback Georgia, Times New Roman, serif)
**Body Font:** Figtree Variable (via @fontsource-variable/figtree; fallback system-ui, -apple-system, Segoe UI, sans-serif)

**Character:** A soft, ball-terminal serif with the warmth of a hand-painted parlour sign, set against a clean, friendly geometric sans that does all the selling work: prices, buttons, labels.

### Hierarchy
- **Display** (400, clamp(2.6rem, 5.4vw, 4.6rem), 1.02; 2.05-2.6rem on mobile): the hero line "Qué rico caer en la tentación", max 12ch, balanced wrap, one span in raspberry text.
- **Headline** (400, clamp(2rem, 3.6vw, 2.9rem), 1.05): section titles ("La carta de Friozo"), the raspberry feature card (to 3rem). Featured row heading runs smaller (clamp 1.7-2.3rem).
- **Title** (400, 1.22rem, 1.18; 1.04rem on mobile): product names, catalogue group titles (clamp 1.35-1.7rem), dialog and guide headings, footer brand.
- **Body** (Figtree 400, 1rem, 1.55): descriptions at 0.86-0.88rem / 1.45 clamped to two lines in cards; hero description max 40ch.
- **Label** (Figtree 700, 0.9rem, letter-spacing 0): buttons, chips, form labels, links. Badges at 0.72rem 700, sentence case.
- **Price** (Figtree 800, 1.2rem, tabular figures): every price, always written "S/ 1.00" (space after S/, two decimals); unit suffix in cocoa-soft 0.78rem 600.

### Named Rules
**The No Faux Bold Rule.** Young Serif exists only in 400; `font-synthesis: none` is set. Never bold or italicise the serif; emphasis comes from colour (raspberry text) or size.

**The Serif Is a Sign Rule.** The serif names things (sections, products, the hero). Prices, buttons, cart line items and anything numeric stay in Figtree.

**The Sol Format Rule.** Prices render as "S/ 1.00": capital S, slash, one space, two decimals, tabular figures. Never "S/.1", never "1 sol".

## Layout

Mobile-first at 390px; container max 1240px. Spacing steps of 8, 12, 16, 24, 40, 56 and 64px: card grids gap 16px (8px on mobile value strip), catalogue groups 40px apart, catalogue section 56px top (40px mobile), order-path block 64px above.

- **Header:** sticky white bar, 68px tall, with the 4px raspberry strip on its top edge. Mobile adds a fixed bottom tab bar (Tienda, Crear, Pedido, Mapa, Rastrear) and the footer pads for it with the safe-area inset.
- **Hero:** desktop is a two-column grid (1.05fr / 0.95fr), copy left, cone right. Under 700px it becomes a named-area grid: title and description left, the cone on its disc in a 42% right column, two equal CTAs full width beneath, then the text links.
- **Value strip:** four guarantees with icons; 4 columns wide, 2 under 900px; on desktop it sits directly under the hero, on mobile it follows the featured row.
- **Featured row:** horizontal scroll of tinted cards (min(78vw, 290px) on mobile) so the next card peeks.
- **Catalogue:** sticky category chips under the header (top 68px desktop, 0 on mobile, bleeding to the screen edge); groups headed by a serif title, count pill and "Ver N" link; cards two per row on mobile (47% basis). The litre card spans two columns horizontally above 700px.
- **Breakpoints:** 700px (mobile layout), 900px (value strip), 1024px (wide vs compact value strip).

**The Thumb-Reach Price Rule.** Every product card shows its price and its add action in the first view of the card; on mobile the action stretches full width under the price.

## Elevation & Depth

Flat at rest, with tonal layering doing most of the work (milk white over warm milk, tinted photo panels). Shadows are warm (chocolate-based rgba), short, and appear as a response to state or for floating elements.

### Shadow Vocabulary
- **Rest** (`box-shadow: 0 1px 2px rgba(42,23,18,.05), 0 2px 10px rgba(42,23,18,.05)`): generic glass cards, product badges.
- **Lift** (`box-shadow: 0 4px 10px rgba(42,23,18,.06), 0 14px 32px rgba(42,23,18,.08)`): product card hover (pointer devices only), floating cart toast, dialogs, builder cart bar.
- **Seal** (`box-shadow: 0 6px 16px rgba(61,42,0,.22)`): the gold price seal only.
- **Photo drop** (`filter: drop-shadow(0 18px 24px rgba(42,23,18,.22))` hero; `0 10px 10px rgba(42,23,18,.14)` cards): cut-out ice-cream photos sit on their panel.
- Dark mode swaps to black shadows (0 1px 2px rgba(0,0,0,.3) and 0 10px 30px rgba(0,0,0,.35)).

### Named Rules
**The Flat Until Touched Rule.** Product cards and buttons carry no shadow and no transform at rest; hover changes border and adds Lift, never a translate or scale.

## Shapes

Generous, soft corners graduated by size: fields 12px, payment and option buttons 14-16px, small cards 18px, product cards 20px, featured, checkout and tracker cards 22px, dialogs 24px, feature cards 26px, the hero panel 28px (22px on mobile). Every button, chip, badge, search field and nav item is a full pill (999px). Circles carry meaning: the raspberry hero disc, the gold seal (rotated -8deg), icon discs, cart quantity buttons. Borders are hairlines: 1px line on containers, 1.5px line-strong on interactive outlines. Photo panels are clipped square to their card's top corners.

## Components

### Buttons
- **Shape:** full pill (999px), 48px minimum (52px in the hero, 44px inside cards).
- **Primary:** raspberry fill and 1.5px raspberry border, white Figtree 700 0.95rem, 12px 22px. Hover to raspberry-deep. Colour-only transitions (0.18s ease); no shadow, no lift.
- **Secondary:** surface fill, 1.5px line-strong border, chocolate text; hover darkens the border to chocolate.
- **In cart:** the add button turns green tint with a pistachio border and text, showing quantity.
- **On raspberry:** inside the raspberry feature card the button inverts to white with raspberry text.
- **Text link:** chocolate 600 with a line-strong underline at 4px offset; underline turns raspberry on hover.
- **Focus:** a 3px raspberry-text outline at 3px offset on every focusable element.
- **Disabled:** 45% opacity, not-allowed cursor.

### Chips
- **Filter chips:** surface pill, 1.5px line border, chocolate 700 0.9rem, optional leading icon, 42px. Hover border chocolate. **Active:** chocolate fill with milk text.
- **Count pill:** warm-milk pill, cocoa-soft 0.75rem 700, beside group titles.
- **Badges:** pill at the card's top-left, 0.72rem 700 sentence case; default white with Rest shadow, "Más pedido"/popular raspberry, premium gold.

### Cards / Containers
- **Product card:** surface, 1px line border, 20px corners, no padding on the shell. Top: 196px photo panel (150px mobile) tinted from the flavour tone. Body: 16px 18px 18px; serif title, two-line cocoa description, "Ver detalles" text link, then a hairline-divided row with price and one raspberry action.
- **Featured card:** borderless, 22px, tinted by kind (raspberry tint default, gold tint packs, green tint popsicles, sky tint litre), copy on the left 60%, photo bleeding off the right edge.
- **Containers:** cart items 18px, checkout and tracker 22px, all 1px line, no shadow.
- **Empty state:** dashed line-strong border, centred.

### Inputs / Fields
- **Style:** surface, 1.5px line-strong border, 12px corners, 48px tall (96px textarea), Figtree 500 1rem. Labels above in 700 0.85rem chocolate.
- **Focus:** border turns raspberry plus a 3px raspberry ring at 18% opacity.
- **Search:** pill-shaped field with a leading search icon; focus-within uses the same raspberry ring.
- **Payment method selector:** 14px rounded tiles with an icon; selected uses raspberry tint, raspberry border plus inset 1px raspberry, raspberry text.

### Navigation
- **Header:** white, hairline bottom border, raspberry top strip, serif logo wordmark at 1.55rem. Nav items are transparent pills (warm milk on hover, raspberry tint with raspberry text when active). "Mi pedido" is the raspberry pill with a gold counter. Theme toggle is a 44px circle with sun or moon icon.
- **Mobile tab bar:** white, top hairline and soft upward shadow; icon over 0.72rem label in cocoa-soft; active turns raspberry text, 800 weight, with a 3px raspberry bar on the top edge. The cart badge is raspberry with a surface ring.
- **Footer:** full-bleed chocolate, serif brand, outlined pill social links (white 20% border), legal text above a 14% white divider.

### Hero with Price Seal (signature)
A warm-milk panel with 28px corners holds the serif headline and two CTAs; on the right, the photographed cone stands on a solid raspberry disc (up to 420px, 108% of its column on mobile) with a deep warm drop shadow. A gold circular seal reading "DESDE" / "S/ 1.00" sits rotated -8deg at the disc's top right (bottom left on mobile, 70px). This milk panel is the chosen adaptation of the brief's "cone on white" and is the canonical hero.

### Pack Photo (signature)
Packs and litres without their own photo are composed from the shop's photographed cones, waffle cups and cup, overlapped (-14% to -34%) and counted from the pack text, so a 12-cone pack never looks like a 3-cone pack. Large counts stack in a back and front row. Never draw a cartoon substitute.

### Icons
One stroke family on a 24px grid, 1.8 stroke, round caps and joins, `currentColor`, aria-hidden; 16-20px inline. Section and value-strip icons take raspberry text; star ratings fill gold.

## Do's and Don'ts

### Do:
- **Do** put new public styling in `src/storefront-classic.css`, scoped under `.site-protected`, and keep that file the last stylesheet imported in `src/main.jsx` (after index, artisan, sorbet and storefront-refresh, which still load underneath).
- **Do** use the `--fz-*` tokens; remap a legacy token (`--primary-color`, `--radius-md`) only inside the `.site-protected` block.
- **Do** give every product card exactly one raspberry primary action next to its price.
- **Do** write prices as "S/ 1.00" in Figtree 800 with tabular figures.
- **Do** sit every product photo on a flavour-tinted panel (`--tone` mixed 26% into surface, 18% in dark).
- **Do** keep every tap target at least 44px and verify WCAG 2.2 AA contrast in both light and dark.
- **Do** use the Icon component's stroke family for interface icons.
- **Do** design at 390px first, then widen.

### Don't:
- **Don't** add eyebrows or kickers above headings; the serif title stands alone.
- **Don't** use emoji as interface icons, bullets or state marks.
- **Don't** bold, italicise or loosen the tracking of the Young Serif (it runs at -0.01em).
- **Don't** use gold for buttons or body text; it is for price, count and reward.
- **Don't** fill a background with `--primary-color` in dark mode; name `--fz-berry` explicitly.
- **Don't** bring back the sticker collage: floating stickers, pastel gradients, marquee strips or decorative blobs.
- **Don't** add translate or scale on hover; use border and the Lift shadow.
- **Don't** style the admin panel from this layer.
