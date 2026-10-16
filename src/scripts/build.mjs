import { build } from 'esbuild';
import { mkdir, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
await mkdir(path.join(root, 'dist/web'), { recursive: true });
await mkdir(path.join(root, 'dist/lambda'), { recursive: true });
await Promise.all([
  build({ entryPoints: [path.join(root, 'lambda/ingest.mjs')], outfile: path.join(root, 'dist/lambda/ingest.mjs'), bundle: true, platform: 'node', target: 'node22', format: 'esm', banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" } }),
  build({ entryPoints: [path.join(root, 'web/app.mjs')], outfile: path.join(root, 'dist/web/app.js'), bundle: true, platform: 'browser', target: 'es2022', minify: true, legalComments: 'linked' }),
  ...['index.html', 'styles.css'].map((file) => copyFile(path.join(root, 'web', file), path.join(root, 'dist/web', file))),
  copyFile(path.join(root, 'node_modules/@svg-maps/japan/README.md'), path.join(root, 'dist/web/MAP-LICENSE.md')),
]);
console.log('Built Lambda and static website.');