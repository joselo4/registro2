import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { fail, getAuthenticatedUser, isTrustedStaff, json } from './_security.js';

const cleanPrefix = (value) =>
  String(value || 'productos')
    .trim()
    .replace(/[^a-z0-9/_-]/gi, '')
    .replace(/^\/+|\/+$/g, '') || 'productos';

export async function onRequestPost({ request, env }) {
  try {
    const { user, error } = await getAuthenticatedUser(request, env);
    if (error || !user) return fail(401, 'auth', error || 'Sesion requerida.');
    if (!isTrustedStaff(user)) return fail(403, 'authz', 'No tienes permiso para subir imagenes.');

    const formData = await request.formData();
    const file = formData.get('file');
    const prefix = cleanPrefix(formData.get('prefix'));

    if (!file || typeof file.arrayBuffer !== 'function') {
      return json({ error: 'No se recibió un archivo válido.' }, 400);
    }

    if (!String(file.type || '').startsWith('image/')) {
      return json({ error: 'Solo se permiten imagenes.' }, 400);
    }
    if (Number(file.size || 0) > 5 * 1024 * 1024) {
      return json({ error: 'La imagen no puede superar 5 MB.' }, 413);
    }

    const accountId = env.R2_ACCOUNT_ID;
    const accessKeyId = env.R2_ACCESS_KEY_ID;
    const secretAccessKey = env.R2_SECRET_ACCESS_KEY;
    const bucketName = env.R2_BUCKET_NAME;
    const publicUrl = env.R2_PUBLIC_URL;

    if (!accountId || !accessKeyId || !secretAccessKey || !bucketName || !publicUrl) {
      return json({ error: 'R2 no está configurado en el servidor.' }, 503);
    }

    const cleanName = String(file.name || 'imagen')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .substring(0, 20) || 'imagen';
    const key = `${prefix}/${Date.now()}_${cleanName}.webp`;

    const s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    const body = new Uint8Array(await file.arrayBuffer());

    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: body,
        ContentType: file.type || 'image/webp',
      })
    );

    const baseUrl = String(publicUrl).replace(/\/+$/, '');
    return json({ ok: true, url: `${baseUrl}/${key}` });
  } catch (err) {
    return json({ error: err.message || 'Error inesperado.' }, 500);
  }
}
