import { build } from 'esbuild';
import { build as buildClient } from 'vite';
import { mkdir, copyFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, join } from 'node:path';

const project = resolve(fileURLToPath(new URL('..', import.meta.url)));
if (resolve(process.cwd()) !== project) throw new Error('Ejecuta la compilación desde la carpeta del proyecto.');
// Only remove this project's generated build directory, never a computed external path.
const output = resolve(project, 'dist');
if (output !== join(project, 'dist')) throw new Error('Directorio de salida inválido.');
await rm(output, { recursive: true, force: true });
await buildClient({ build: { outDir: 'dist/client' } });

await build({
  entryPoints: ['server/sites-worker.js'],
  outfile: 'dist/server/index.js',
  bundle: true,
  format: 'esm',
  platform: 'browser',
  conditions: ['workerd', 'worker', 'browser'],
  target: 'es2022',
  minify: true,
  external: ['node:*'],
});
await mkdir('dist/.openai', { recursive: true });
await copyFile('.openai/hosting.json', 'dist/.openai/hosting.json');
console.log('Sites: interfaz y funciones del servidor listas.');
