import { build } from 'esbuild';
import { readdir, mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const tests = (await readdir('tests')).filter(name => name.endsWith('.test.jsx'));
await mkdir('scratch/view-tests', { recursive: true });
await build({ entryPoints: tests.map(name => `tests/${name}`), outdir: 'scratch/view-tests', outExtension: { '.js': '.mjs' }, bundle: true, platform: 'node', format: 'esm', packages: 'external', jsx: 'automatic', loader: { '.css': 'empty' } });
const result = spawnSync(process.execPath, ['--test', ...tests.map(name => `scratch/view-tests/${name.replace(/\.jsx$/, '.mjs')}`)], { stdio: 'inherit' });
process.exitCode = result.status ?? 1;
