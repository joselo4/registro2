import { json, sameOriginRequest, createAdminClient, getAuthenticatedUser, isTrustedAdmin } from './_security.js';

const allowedKinds = new Set(['order', 'table_call', 'survey', 'support', 'test']);
const allowedParseModes = new Set(['Markdown', 'MarkdownV2', 'HTML']);
const telegramTimeoutMs = 8000;

const markdownParseError = (description = '') => {
  const normalized = String(description).toLowerCase();
  return normalized.includes("can't parse entities") || normalized.includes('parse entities');
};

const readTelegramPayload = async (response) => {
  const rawText = await response.text().catch(() => '');
  if (!rawText) return { payload: {}, rawText };

  try {
    return { payload: JSON.parse(rawText), rawText };
  } catch {
    return { payload: {}, rawText };
  }
};

const sendTelegramMessage = async ({ token, chatId, text, parseMode }) => {
  const body = { chat_id: chatId, text };
  if (parseMode) body.parse_mode = parseMode;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort('Telegram API timeout'), telegramTimeoutMs);

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    // Keep the timeout active until the response body is read, not just the headers.
    const { payload, rawText } = await readTelegramPayload(response);
    if (controller.signal.aborted) throw new Error('Telegram API timeout');
    return { response, payload, rawText };
  } finally {
    clearTimeout(timeout);
  }
};

export async function onRequestGet({ request, env }) {
  if (!sameOriginRequest(request)) {
    return json({ error: 'Origen no permitido.' }, 403);
  }

  if (new URL(request.url).searchParams.get('verify') === '1') {
    const token = String(env.TELEGRAM_BOT_TOKEN || '').trim();
    const chatId = String(env.TELEGRAM_CHAT_ID || '').trim();
    if (!token || !chatId) return json({ ok: false, error: 'Telegram no está configurado.' }, 503);
    try {
      // Read-only diagnostics: verify the bot and its configured destination.
      // Never send a test message or expose credentials or chat metadata here.
      const responses = await Promise.all([
        fetch(`https://api.telegram.org/bot${token}/getMe`, { signal: AbortSignal.timeout(telegramTimeoutMs) }),
        fetch(`https://api.telegram.org/bot${token}/getChat`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId }), signal: AbortSignal.timeout(telegramTimeoutMs),
        }),
      ]);
      const results = await Promise.all(responses.map(response => response.json()));
      const botValid = responses[0].ok && results[0].ok === true;
      const destinationAccessible = responses[1].ok && results[1].ok === true;
      return json({ ok: botValid && destinationAccessible, botValid, destinationAccessible }, botValid && destinationAccessible ? 200 : 502);
    } catch {
      return json({ ok: false, error: 'No se pudo comprobar la conexión con Telegram.' }, 502);
    }
  }
  return json({
    ok: true,
    route: '/api/telegram',
    configured: {
      botToken: Boolean(String(env.TELEGRAM_BOT_TOKEN || '').trim()),
      chatId: Boolean(String(env.TELEGRAM_CHAT_ID || '').trim()),
    },
  });
}

export async function onRequestPost({ request, env }) {
  try {
    if (!sameOriginRequest(request)) {
      return json({ error: 'Origen no permitido.' }, 403);
    }

    const body = await request.json().catch(() => ({}));
    const { 
      text, 
      parse_mode = 'Markdown', 
      kind = 'support',
      orderId,
      table,
      name,
      message
    } = body;

    if (!allowedKinds.has(kind)) {
      return json({ error: 'Tipo de notificacion no permitido.' }, 400);
    }

    // 1. Validaciones de Autorización y Base de Datos por tipo
    if (kind === 'test') {
      const { user, error } = await getAuthenticatedUser(request, env);
      if (error || !user) {
        return json({ error: error || 'Sesion requerida para pruebas.' }, 401);
      }
      if (!isTrustedAdmin(user)) {
        return json({ error: 'Solo los administradores pueden enviar pruebas.' }, 403);
      }
    } else if (kind === 'order') {
      const cleanId = String(orderId || '').trim().toUpperCase();
      const ORDER_ID_RE = /^PED-[A-Z0-9-]{4,40}$/;
      if (!cleanId || !ORDER_ID_RE.test(cleanId)) {
        return json({ error: 'Codigo de pedido invalido.' }, 400);
      }
      const adminClient = await createAdminClient(env);
      const { data, error } = await adminClient
        .from('helados_sync')
        .select('key')
        .eq('key', `order_${cleanId}`)
        .maybeSingle();
      if (error || !data) {
        return json({ error: 'El pedido no existe en el sistema.' }, 404);
      }
    } else if (kind === 'table_call') {
      const cleanTable = String(table || '').trim().replace(/[^\dA-Za-z_-]/g, '').slice(0, 20);
      if (!cleanTable) {
        return json({ error: 'Falta el numero de mesa o es invalido.' }, 400);
      }
      const adminClient = await createAdminClient(env);
      const { data, error } = await adminClient
        .from('helados_sync')
        .select('key')
        .eq('key', `order_call_Mesa_${cleanTable}`)
        .maybeSingle();
      if (error || !data) {
        return json({ error: 'El llamado de mesa no existe.' }, 404);
      }
    } else if (kind === 'survey') {
      const cleanId = String(orderId || '').trim().toUpperCase();
      const ORDER_ID_RE = /^PED-[A-Z0-9-]{4,40}$/;
      if (!cleanId || !ORDER_ID_RE.test(cleanId)) {
        return json({ error: 'Codigo de pedido invalido.' }, 400);
      }
      const adminClient = await createAdminClient(env);
      const { data, error } = await adminClient
        .from('helados_sync')
        .select('value')
        .eq('key', `order_${cleanId}`)
        .maybeSingle();
      if (error || !data || !data.value?.survey) {
        return json({ error: 'Pedido o encuesta no encontrados.' }, 404);
      }
    }

    // 2. Construcción de mensaje para 'support' o validación de mensaje de texto
    let finalText = text;
    if (kind === 'support') {
      const { phone } = body;
      const cleanName = String(name || 'Anónimo').replace(/<[^>]*>/g, '').trim().slice(0, 80);
      const cleanPhone = String(phone || '').replace(/[^0-9+\s-]/g, '').trim().slice(0, 20);
      const cleanMessage = String(message || '').replace(/<[^>]*>/g, '').trim().slice(0, 1000);

      if (cleanPhone.replace(/\D/g, '').length < 7) {
        return json({ error: 'El número de teléfono es obligatorio y debe ser válido.' }, 400);
      }
      if (!cleanMessage) {
        return json({ error: 'El mensaje de soporte no puede estar vacío.' }, 400);
      }

      // Customer text is plain text: underscores, brackets and asterisks must
      // never cause a failed parse and a second round trip to Telegram.
      finalText = `💬 ¡NUEVO MENSAJE DE CLIENTE!\n\n` +
        `Cliente: ${cleanName}\n` +
        `Teléfono: ${cleanPhone}\n` +
        `Mensaje: ${cleanMessage}\n\n` +
        `Enviado desde la web de la tienda.`;
    }

    if (!finalText || typeof finalText !== 'string') {
      return json({ error: 'Falta el texto del mensaje.' }, 400);
    }
    if (finalText.length > 3500) {
      return json({ error: 'El mensaje es demasiado largo.' }, 413);
    }

    const safeParseMode = kind === 'support' ? null : (allowedParseModes.has(parse_mode) ? parse_mode : 'Markdown');

    const token = String(env.TELEGRAM_BOT_TOKEN || '').trim();
    const chatId = String(env.TELEGRAM_CHAT_ID || '').trim();

    if (!token || !chatId) {
      return json({ error: 'Telegram no está configurado en el servidor.' }, 503);
    }

    let { response, payload, rawText } = await sendTelegramMessage({
      token,
      chatId,
      text: finalText,
      parseMode: safeParseMode,
    });

    if (safeParseMode && !response.ok && markdownParseError(payload.description)) {
      ({ response, payload, rawText } = await sendTelegramMessage({
        token,
        chatId,
        text: finalText,
        parseMode: null,
      }));
    }

    if (!response.ok || payload.ok !== true) {
      const telegramError =
        payload.description ||
        rawText ||
        response.statusText ||
        'No se pudo enviar el mensaje a Telegram.';

      return json(
        { error: `Telegram API ${response.status}: ${telegramError}` },
        502
      );
    }

    return json({ ok: true });
  } catch (err) {
    if (err?.name === 'AbortError' || /timeout/i.test(String(err?.message || err))) {
      return json({ error: 'Telegram está tardando en confirmar la entrega. Espera un momento antes de reintentar.' }, 504);
    }
    return json({ error: err?.message || String(err) || 'Error inesperado.' }, 500);
  }
}
