export async function sendSupportMessage({ name, phone, message }, { fetchImpl = fetch, timeoutMs = 10000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl('/api/telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone, message, kind: 'support' }),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));
    if (controller.signal.aborted) throw new DOMException('Tiempo agotado', 'AbortError');
    if (!response.ok || payload.ok !== true) {
      throw new Error(response.status === 504
        ? 'Telegram está tardando en confirmar la entrega. Tu consulta sigue aquí; espera un momento antes de reintentar.'
        : 'No pudimos confirmar el envío a Telegram. Tu consulta sigue aquí; puedes reintentar.');
    }
    return payload;
  } catch (error) {
    if (controller.signal.aborted) throw new Error('La conexión está tardando demasiado. No pudimos confirmar la entrega; conservamos tu consulta.', { cause: error });
    if (error instanceof TypeError) throw new Error('No pudimos conectar con Telegram. Comprueba tu conexión y reintenta; conservamos tu consulta.', { cause: error });
    throw error;
  } finally { clearTimeout(timer); }
}
