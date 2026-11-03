import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/*/test/**/*.test.ts', 'apps/*/test/**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 180_000, // premier démarrage du conteneur Postgres
    pool: 'forks',
    globalSetup: ['./vitest.global-setup.ts'],
  },
});
