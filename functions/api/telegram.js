const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });

export async function onRequestPost({ request, env }) {
  try {
    const { text, parse_mode = 'Markdown' } = await request.json();

    if (!text || typeof text !== 'string') {
      return json({ error: 'Falta el texto del mensaje.' }, 400);
    }

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
        parse_mode,
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
