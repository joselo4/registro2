export async function onRequest(context) {
  try {
    const { request, env } = context;
    if (request.method !== 'GET') {
      return new Response('Method not allowed', { status: 405 });
    }

    const url = new URL(request.url);
    const tipo = url.searchParams.get('tipo'); // 'dni' o 'ruc'
    const numero = url.searchParams.get('numero');

    if (!tipo || !numero) {
      return new Response(JSON.stringify({ error: 'Parámetros incompletos' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const apiUrl = `https://api.apis.net.pe/v1/${tipo}?numero=${numero}`;
    
    // El token debe estar configurado en las variables de entorno de Cloudflare como APIS_TOKEN
    const apiToken = env.APIS_TOKEN || env.APIS_NET_PE_TOKEN || '';

    const headers = {
      'Accept': 'application/json'
    };

    if (apiToken) {
      headers['Authorization'] = `Bearer ${apiToken}`;
    }

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: headers
    });

    if (!response.ok) {
      return new Response(JSON.stringify({ error: 'No se encontró el documento o error en la API externa' }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const data = await response.json();

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
