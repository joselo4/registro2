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

  // Block sensitive files
  if (path.includes('.env') || path.includes('.git') || path.includes('.well-known/security.txt') === false && path.includes('.well-known')) {
    if (!path.includes('.well-known/security.txt')) {
      return new Response('Not Found', { status: 404 });
    }
  }

  // Block insecure HTTP methods
  const insecureMethods = ['TRACE', 'TRACK'];
  if (insecureMethods.includes(context.request.method)) {
    return new Response('Method Not Allowed', { status: 405 });
  }

  // 2. Validate API routes and handle CORS
  if (path.startsWith('/api/')) {
    const validApiRoutes = [
      '/api/admin-auth-user',
      '/api/order',
      '/api/r2-upload',
      '/api/r2',
      '/api/table-call',
      '/api/telegram',
      '/api/billing'
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
      'http://127.0.0.1:5173',
      'capacitor://localhost'
    ];

    let isAllowedOrigin = false;
    if (origin) {
      try {
        const originUrl = new URL(origin);
        isAllowedOrigin = allowedOrigins.includes(origin) || originUrl.host === url.host;
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
            'X-Frame-Options': 'DENY',
            'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
            'Referrer-Policy': 'strict-origin-when-cross-origin',
            'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
          }
        });
      } else {
        return new Response(null, { 
          status: 204,
          headers: {
            'X-XSS-Protection': '0',
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'DENY',
            'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
            'Referrer-Policy': 'strict-origin-when-cross-origin',
            'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
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
    newResponse.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    newResponse.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    newResponse.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    newResponse.headers.delete('X-Powered-By');

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
  newResponse.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  newResponse.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  newResponse.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  newResponse.headers.delete('X-Powered-By');
  return newResponse;
}
