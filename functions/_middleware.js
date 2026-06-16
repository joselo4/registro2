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
      'https://localhost',
      'http://localhost',
      'http://localhost:5173',
      'capacitor://localhost'
    ];

    const isAllowedOrigin = origin && (
      allowedOrigins.includes(origin) || 
      origin.endsWith('.pideanda.com')
    );

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
          }
        });
      } else {
        return new Response(null, { status: 204 });
      }
    }

    // Proceed to actual handler
    const response = await context.next();

    // Inject CORS header to response if origin is allowed
    if (isAllowedOrigin) {
      const newResponse = new Response(response.body, response);
      newResponse.headers.set('Access-Control-Allow-Origin', origin);
      return newResponse;
    }

    return response;
  }

  // Otherwise, proceed to the static assets (standard page loads/refresh)
  return context.next();
}
