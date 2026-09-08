import { readFile, access } from 'node:fs/promises';
import { resolve, relative, isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';

export async function verifyBuild(directory) {
  const root = resolve(directory);
  const html = await readFile(resolve(root, 'index.html'), 'utf8');
  if (/src=["']\/src\//.test(html)) throw new Error('El HTML aún apunta a código fuente: publica el resultado compilado.');
  const scripts = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map(match => match[1]);
  if (!scripts.some(path => /^\/assets\/.+\.js$/.test(path))) throw new Error('Falta la aplicación compilada en index.html.');
  const resources = [...scripts, ...[...html.matchAll(/<link[^>]+href="(\/[^"?#]+\.css)"/g)].map(match => match[1]), '/hero-friozo-v2.webp'];
  for (const resource of resources.filter(path => path.startsWith('/'))) {
    const target = resolve(root, resource.slice(1));
    const location = relative(root, target);
    if (location.startsWith('..') || isAbsolute(location)) throw new Error('Recurso fuera de la compilación.');
    await access(target);
  }
  return resources;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await verifyBuild(process.argv[2] || 'dist');
  console.log('Verificado: la tienda compilada incluye sus scripts, estilos e imagen.');
}
