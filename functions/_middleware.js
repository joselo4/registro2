export async function onRequest(context) {
  const url = new URL(context.request.url);
  const path = url.pathname;

  // 1. Block forbidden/arbitrary admin and dashboard paths that are not real pages
  const forbiddenPaths = [
    '/admin',
    '/admin/api',
    '/dashboard/api',
  ];

  if (forbiddenPaths.includes(path) || path.startsWith('/admin/') || path.startsWith('/dashboard/')) {
    return new Response('Not Found', { status: 404 });
  }

  // 2. Validate API routes and handle CORS
  if (path.startsWith('/api/')) {
    const validApiRoutes = [
      '/api/admin-auth-user',
      '/api/order',
      '/api/r2-upload',
      '/api/r2',
      '/api/table-call',
      '/api/telegram'
    ];

    if (!validApiRoutes.includes(path)) {
      return new Response(JSON.stringify({ error: 'Not Found' }), {
        status: 404,
        headers: { 
          'Content-Type': 'application/json; charset=utf-8' 
        }
      });
    }

    // CORS handling for API routes
    const origin = context.request.headers.get('Origin');
    const allowedOrigins = [
      'https://pideanda.com',
      'https://www.pideanda.com',
      'https://localhost',
      'http://localhost',
      'http://localhost:5173',
      'capacitor://localhost'
    ];

    let isAllowedOrigin = false;
    if (origin) {
      try {
        const originUrl = new URL(origin);
        const hostname = originUrl.hostname;
        isAllowedOrigin = allowedOrigins.includes(origin) || 
                          hostname === 'pideanda.com' || 
                          hostname.endsWith('.pideanda.com');
      } catch {
        isAllowedOrigin = false;
      }
    }

    // Handle CORS preflight (OPTIONS)
    if (context.request.method === 'OPTIONS') {
      if (isAllowedOrigin) {
        return new Response(null, {
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': origin,
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Max-Age': '86400',
            'X-XSS-Protection': '0',
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'DENY'
          }
        });
      } else {
        return new Response(null, { 
          status: 204,
          headers: {
            'X-XSS-Protection': '0',
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'DENY'
          }
        });
      }
    }

    // Proceed to actual handler
    const response = await context.next();
    const newResponse = new Response(response.body, response);

    // Inject Security headers to dynamic response
    newResponse.headers.set('X-XSS-Protection', '0');
    newResponse.headers.set('X-Content-Type-Options', 'nosniff');
    newResponse.headers.set('X-Frame-Options', 'DENY');

    // Inject CORS header to response if origin is allowed
    if (isAllowedOrigin) {
      newResponse.headers.set('Access-Control-Allow-Origin', origin);
    }

    return newResponse;
  }

  // Otherwise, proceed to the static assets (standard page loads/refresh)
  const response = await context.next();
  const newResponse = new Response(response.body, response);
  newResponse.headers.set('X-XSS-Protection', '0');
  newResponse.headers.set('X-Content-Type-Options', 'nosniff');
  newResponse.headers.set('X-Frame-Options', 'DENY');
  return newResponse;
}
