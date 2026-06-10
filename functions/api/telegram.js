import { json, sameOriginRequest } from './_security.js';

const allowedKinds = new Set(['order', 'table_call', 'survey', 'support', 'test']);
const allowedParseModes = new Set(['Markdown', 'MarkdownV2', 'HTML']);

export async function onRequestPost({ request, env }) {
  try {
    if (!sameOriginRequest(request)) {
      return json({ error: 'Origen no permitido.' }, 403);
    }

    const { text, parse_mode = 'Markdown', kind = 'support' } = await request.json();

    if (!text || typeof text !== 'string') {
      return json({ error: 'Falta el texto del mensaje.' }, 400);
    }
    if (text.length > 3500) {
      return json({ error: 'El mensaje es demasiado largo.' }, 413);
    }
    if (!allowedKinds.has(kind)) {
      return json({ error: 'Tipo de notificacion no permitido.' }, 400);
    }
    const safeParseMode = allowedParseModes.has(parse_mode) ? parse_mode : 'Markdown';

    const token = env.TELEGRAM_BOT_TOKEN;
    const chatId = env.TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
      return json({ error: 'Telegram no está configurado en el servidor.' }, 503);
    }

    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: safeParseMode,
      }),
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok || payload.ok === false) {
      return json(
        { error: payload.description || 'No se pudo enviar el mensaje a Telegram.' },
        502
      );
    }

    return json({ ok: true });
  } catch (err) {
    return json({ error: err.message || 'Error inesperado.' }, 500);
  }
}
