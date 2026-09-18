import { onRequest as middleware } from '../functions/_middleware.js';
import { onRequestGet as telegramGet, onRequestPost as telegramPost } from '../functions/api/telegram.js';
import { onRequestGet as orderGet, onRequestPost as orderPost } from '../functions/api/order.js';
import { onRequestPost as tablePost } from '../functions/api/table-call.js';
import { onRequestPost as adminPost } from '../functions/api/admin-auth-user.js';
import { onRequestPost as uploadPost } from '../functions/api/r2-upload.js';
import { onRequestPost as r2Post } from '../functions/api/r2.js';
import { json } from '../functions/api/_security.js';

const routes = {
  '/api/telegram': { GET: telegramGet, POST: telegramPost },
  '/api/order': { GET: orderGet, POST: orderPost },
  '/api/table-call': { POST: tablePost },
  '/api/admin-auth-user': { POST: adminPost },
  '/api/r2-upload': { POST: uploadPost },
  '/api/r2': { POST: r2Post },
};

export default {
  async fetch(request, env, ctx) {
    const pathname = new URL(request.url).pathname;
    const context = { request, env, waitUntil: promise => ctx.waitUntil(promise) };
    return middleware({ ...context, next: async () => {
      if (pathname.startsWith('/api/')) {
        const handler = routes[pathname]?.[request.method];
        return handler ? handler(context) : json({ error: 'Ruta o método no permitido.' }, 405);
      }
      const asset = await env.ASSETS.fetch(request);
      if (asset.status !== 404 || !['GET', 'HEAD'].includes(request.method) || !request.headers.get('Accept')?.includes('text/html')) return asset;
      const index = new URL('/index.html', request.url);
      return env.ASSETS.fetch(new Request(index, request));
    } });
  },
};
