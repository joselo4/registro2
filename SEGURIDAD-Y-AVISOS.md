# Seguridad y avisos: pasos en tu cuenta

Estos pasos se hacen en paneles a los que solo tú tienes acceso. El código ya está listo para usarlos.

## 1. Avisos con el teléfono bloqueado (Web Push)

Sin estas claves, el botón «Activar avisos con pantalla bloqueada» no aparece en el panel.

1. En la carpeta del proyecto, ejecuta una sola vez:

   ```bash
   node scripts/generate-vapid-keys.mjs
   ```

2. En Cloudflare → Workers & Pages → el proyecto de la tienda → Settings → Variables and Secrets, añade como **secretos** (tipo *Secret*, no *Text*):
   - `VAPID_PUBLIC_KEY` = el primer valor que imprimió el script.
   - `VAPID_PRIVATE_KEY` = el segundo valor. No lo compartas ni lo pongas con prefijo `VITE_`.
   - `VAPID_SUBJECT` = `mailto:` seguido de tu correo.
3. Vuelve a desplegar (o espera el siguiente despliegue desde GitHub).
4. En cada teléfono del personal: abre www.pideanda.com en **Chrome**, entra al panel y pulsa «Activar avisos con pantalla bloqueada». Luego «Probar».

Límites: la app instalada como APK (Capacitor) no admite Web Push; para avisos con pantalla bloqueada usa Chrome o «Añadir a pantalla de inicio». En iPhone funciona desde iOS 16.4 solo si la tienda se añadió a la pantalla de inicio. Si generas claves nuevas, cada teléfono debe volver a activar los avisos.

## 2. Límite de peticiones en Cloudflare

El servidor ya frena ráfagas por conexión, pero la protección definitiva contra quien intente inundar el chat de Telegram o los avisos es una regla de Cloudflare.

Cloudflare → tu dominio pideanda.com → Security → WAF → Rate limiting rules → Create rule:

- **Nombre:** Avisos públicos
- **Si coincide la expresión:**
  `(http.request.method eq "POST" and http.request.uri.path in {"/api/telegram" "/api/table-call" "/api/push"})`
- **Contar por:** IP
- **Límite:** 10 peticiones cada 1 minuto (en el plan gratuito el periodo mínimo es de 10 segundos: usa 3 peticiones cada 10 segundos).
- **Acción:** Block, durante 10 minutos (o lo que permita tu plan).

Añade también `/api/coupon` a la lista de la expresión.

No incluyas `/api/order` en esta regla: los pedidos ya tienen su propio límite por teléfono y por conexión, y una mesa con varios clientes comparte la misma IP.

## 3. Cupones privados e índices de pedidos (Supabase)

Hasta ahora cualquiera podía leer todos los códigos de cupón desde el navegador (comprobado el 29 de octubre de 2026: 3 cupones visibles). La tienda ya no los descarga: comprueba un código a la vez en el servidor, con límite de intentos. Para cerrar también la lectura directa en la base de datos:

1. Publica esta versión de la tienda (para que el carrito use la comprobación nueva).
2. Supabase → SQL Editor → pega y ejecuta el contenido de `supabase-cupones-e-indices.sql`.
3. Ejecuta `node scripts/check-public-access.mjs`: `coupons` debe salir como «protegido».

El mismo archivo crea índices para que los límites de pedidos por teléfono sigan rápidos con miles de pedidos.

## 4. Comprobar qué ve un visitante sin sesión

```bash
node scripts/check-public-access.mjs
```

Usa solo la clave pública (la misma que recibe cualquier navegador) y únicamente lee. Debe terminar con «Ningún dato privado es legible sin sesión». Última comprobación: 29 de octubre de 2026. Pedidos, personal, finanzas, tokens y suscripciones estaban protegidos; los cupones eran legibles (se corrige con el paso 3). Las escrituras no se prueban desde fuera porque cambiarían datos reales; las cubren las políticas de `setup_security_v2.sql`.

## 5. Telegram

Si un pedido no llega a Telegram pero el panel sí avisa: Ajustes → «Probar notificación». Si la prueba falla, revisa `TELEGRAM_BOT_TOKEN` y `TELEGRAM_CHAT_ID` en las variables de Cloudflare y que el bot siga dentro del chat o grupo.
