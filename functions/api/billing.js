import { fail, getAuthenticatedUser, isTrustedAdmin, json, sameOriginRequest } from './_security.js';

const trimText = (value, max = 200) => String(value || '').trim().slice(0, max);
const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

const allowedProviderUrl = (url) => {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && parsed.hostname.length > 0;
  } catch {
    return false;
  }
};

const sanitizePayload = (payload) => {
  if (!isPlainObject(payload)) return null;
  const serialized = JSON.stringify(payload);
  if (serialized.length > 80000) return null;
  return payload;
};

const getProviderSettings = (env, provider) => {
  if (provider !== 'nubefact') return {};

  return {
    endpoint: trimText(env.NUBEFACT_ENDPOINT || env.BILLING_ENDPOINT, 600),
    token: trimText(env.NUBEFACT_TOKEN || env.BILLING_TOKEN, 1000),
  };
};

export async function onRequestPost({ request, env }) {
  try {
    if (!sameOriginRequest(request)) return fail(403, 'origin', 'Origen no permitido.');

    const { user, error } = await getAuthenticatedUser(request, env);
    if (error) return fail(401, 'auth', error);
    if (!isTrustedAdmin(user)) return fail(403, 'authz', 'Solo un administrador puede emitir comprobantes.');

    const body = await request.json().catch(() => null);
    const provider = trimText(body?.provider || 'nubefact', 40).toLowerCase();
    const payload = sanitizePayload(body?.payload);
    const { endpoint, token } = getProviderSettings(env, provider);

    if (provider !== 'nubefact') return fail(400, 'provider', 'Proveedor de facturacion no soportado.');
    if (!endpoint || !allowedProviderUrl(endpoint)) return fail(503, 'endpoint', 'La ruta de facturacion no esta configurada en el servidor.');
    if (!token) return fail(503, 'token', 'El token de facturacion no esta configurado en el servidor.');
    if (!payload) return fail(400, 'payload', 'Payload de comprobante invalido o demasiado grande.');

    const providerResponse = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Token token="${token}"`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const contentType = providerResponse.headers.get('content-type') || '';
    const result = contentType.includes('application/json')
      ? await providerResponse.json().catch(() => ({}))
      : { raw: await providerResponse.text().catch(() => '') };

    if (!providerResponse.ok) {
      return json({
        ok: false,
        provider,
        status: providerResponse.status,
        error: result?.errors || result?.error || result?.message || 'El proveedor rechazo la solicitud.',
        result,
      }, providerResponse.status >= 500 ? 502 : 400);
    }

    return json({
      ok: true,
      provider,
      status: providerResponse.status,
      result,
    });
  } catch (err) {
    return json({ ok: false, error: err.message || 'Error inesperado en facturacion.' }, 500);
  }
}
