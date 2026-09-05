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
        ? 'Telegram está tardando en confirmar la entrega. Tu consulta sigue aquí; puedes continuar por WhatsApp.'
        : 'No pudimos confirmar el envío. Tu consulta sigue aquí; puedes reintentar o continuar por WhatsApp.');
    }
    return payload;
  } catch (error) {
    if (controller.signal.aborted) throw new Error('La conexión está tardando demasiado. No pudimos confirmar la entrega; conservamos tu consulta.', { cause: error });
    throw error;
  } finally { clearTimeout(timer); }
}
