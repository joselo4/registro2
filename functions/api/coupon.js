import { createAdminClient, fail, json, sameOriginRequest, tooManyRequests } from './_security.js';

const CODE_RE = /^[A-Z0-9_-]{2,40}$/;

// Checks one coupon code. Only that coupon's discount comes back, so customers
// can no longer read every code from the public catalog.
export async function onRequestPost({ request, env }, makeClient = createAdminClient) {
  try {
    if (!sameOriginRequest(request)) return fail(403, 'origin', 'Origen no permitido.');
    // Slows down anyone trying codes one after another.
    if (tooManyRequests(request, 'coupon', 15, 10 * 60 * 1000)) return fail(429, 'rate', 'Demasiados intentos. Espera unos minutos.');
    const text = await request.text();
    if (text.length > 300) return fail(413, 'input', 'Solicitud demasiado grande.');
    let body;
    try { body = JSON.parse(text || '{}'); } catch { return fail(400, 'input', 'Solicitud inválida.'); }
    const code = String(body?.code || '').trim().toUpperCase();
    if (!CODE_RE.test(code)) return fail(404, 'invalid', 'Cupón inválido o expirado.');

    const client = await makeClient(env);
    const { data, error } = await client.from('helados_sync').select('value').eq('key', 'coupons').maybeSingle();
    if (error) return fail(502, 'read', 'No se pudo comprobar el cupón. Intenta nuevamente.');
    const coupon = (Array.isArray(data?.value) ? data.value : []).find(item => String(item?.code || '').toUpperCase() === code);
    if (!coupon) return fail(404, 'invalid', 'Cupón inválido o expirado.');
    if (coupon.active === false) return fail(410, 'inactive', 'Este cupón se encuentra inactivo.');
    if (Number(coupon.limit) > 0 && (Number(coupon.usedCount) || 0) >= Number(coupon.limit)) return fail(410, 'exhausted', 'Este cupón ha alcanzado el límite de usos.');
    return json({ ok: true, coupon: { code, type: coupon.type, value: Number(coupon.value) || 0, description: String(coupon.description || '').slice(0, 160) } });
  } catch (err) {
    console.error('coupon check failed:', err);
    return fail(500, 'server', 'No se pudo comprobar el cupón. Intenta nuevamente.');
  }
}
