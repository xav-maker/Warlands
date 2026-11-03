// Empaquette la rediffusion pour le navigateur : apps/web/public/combat.js (fichier généré, non versionné).
import { build } from 'esbuild';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
await build({
  entryPoints: [join(here, 'src/main.ts')],
  outfile: join(here, '../../apps/web/public/combat.js'),
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: 'es2022',
  minify: true,
  sourcemap: true,
  legalComments: 'none',
});
