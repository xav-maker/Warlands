// Empaquette l'application en un seul fichier ESM. Les paquets du dépôt (@cr/*, en TypeScript)
// sont inclus ; les dépendances npm restent dans node_modules. views/ et public/ sont lus à côté de dist/.
import { build } from 'esbuild';
import { rmSync } from 'node:fs';

rmSync('dist', { recursive: true, force: true });
// Rediffusion des combats pour le navigateur (packages/ui-combat) → public/combat.js.
await import('../../packages/ui-combat/build.mjs');
await build({
  entryPoints: { main: 'src/main.ts', migrate: '../../packages/db/src/migrate.ts', 'grant-role': '../../packages/db/src/grant-role.ts' },
  outdir: 'dist',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node24',
  sourcemap: true,
  plugins: [
    {
      name: 'externalize-npm',
      setup(b) {
        b.onResolve({ filter: /^[^./]/ }, (args) => (args.path.startsWith('@cr/') ? undefined : { path: args.path, external: true }));
      },
    },
  ],
});
