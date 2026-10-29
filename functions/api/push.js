import { createAdminClient, fail, getAuthenticatedUser, json, normalizeEmail, sameOriginRequest, trustedRole } from './_security.js';
import { cleanSubscription, notifyStaff, updateSubscriptions } from './_pushStore.js';

// The public key is not secret: the browser needs it to subscribe.
export async function onRequestGet({ request, env }) {
  if (!sameOriginRequest(request)) return fail(403, 'origin', 'Origen no permitido.');
  const publicKey = String(env.VAPID_PUBLIC_KEY || '').trim();
  return json({ ok: true, configured: Boolean(publicKey && env.VAPID_PRIVATE_KEY), publicKey: publicKey || null });
}

export async function onRequestPost({ request, env }, authenticate = getAuthenticatedUser, makeClient = createAdminClient) {
  try {
    if (!sameOriginRequest(request)) return fail(403, 'origin', 'Origen no permitido.');
    const text = await request.text();
    if (text.length > 4000) return fail(413, 'input', 'Solicitud demasiado grande.');
    let body;
    try { body = JSON.parse(text || '{}'); } catch { return fail(400, 'input', 'Solicitud inválida.'); }

    const { user, error } = await authenticate(request, env);
    if (error || !user) return fail(401, 'auth', 'Inicia sesión en el panel para activar los avisos.');
    if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return fail(503, 'config', 'Los avisos push no están configurados en el servidor.');
    const client = await makeClient(env);
    const email = normalizeEmail(user.email);

    if (body.action === 'subscribe') {
      const subscription = cleanSubscription(body.subscription);
      if (!subscription) return fail(400, 'input', 'Suscripción inválida.');
      await updateSubscriptions(client, list => [
        ...list.filter(item => item.endpoint !== subscription.endpoint),
        { ...subscription, email, role: trustedRole(user), createdAt: new Date().toISOString() },
      ]);
      return json({ ok: true });
    }

    if (body.action === 'unsubscribe') {
      const endpoint = String(body.endpoint || '');
      // A phone can only remove its own entry; an admin may remove any.
      await updateSubscriptions(client, list => list.filter(item => item.endpoint !== endpoint || (item.email !== email && trustedRole(user) !== 'Administrador')));
      return json({ ok: true });
    }

    if (body.action === 'test') {
      const result = await notifyStaff(client, env, {
        title: '🔔 Avisos activados',
        body: 'Así te avisaremos de los pedidos por validar, aunque el teléfono esté bloqueado.',
        tag: 'friozo-test',
        url: '/#admin',
      }, { filter: item => item.email === email });
      return json({ ok: result.sent > 0, sent: result.sent });
    }

    return fail(400, 'input', 'Acción no reconocida.');
  } catch (err) {
    console.error('push route failed:', err);
    return fail(500, 'server', 'No se pudo actualizar los avisos. Intenta nuevamente.');
  }
}
