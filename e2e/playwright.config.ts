/**
 * Parcours de bout en bout (guide 16.1, critère de J2). Le serveur est l'application empaquetée
 * (pnpm build), sur la base E2E_DATABASE_URL (par défaut le Postgres de docker compose).
 *
 *   pnpm build && pnpm e2e
 */
import { defineConfig, devices } from '@playwright/test';

const PORT = 3100;
export const DATABASE_URL = process.env.E2E_DATABASE_URL ?? 'postgres://cr:cr@localhost:5433/cr';

export default defineConfig({
  testDir: '.',
  timeout: 180_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never', outputFolder: 'rapport' }]] : 'list',
  use: { baseURL: `http://localhost:${PORT}`, trace: 'retain-on-failure', ...devices['Desktop Chrome'] },
  webServer: {
    command: 'node ../apps/web/dist/migrate.js && node ../apps/web/dist/main.js',
    url: `http://localhost:${PORT}/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: {
      NODE_ENV: 'production',
      DATABASE_URL,
      APP_URL: `http://localhost:${PORT}`,
      PORT: String(PORT),
      SESSION_COOKIE_SECURE: 'false',
      // Mailpit en local ; en CI, injoignable : l'envoi échoue sans bloquer l'inscription.
      SMTP_HOST: 'localhost',
      SMTP_PORT: '1025',
      MAIL_FROM: 'Les Cinq Régions <noreply@example.com>',
      LOG_LEVEL: 'warn',
      // Outils de test : escouade de niveau 30 (page Compte), porte de donjon (page de route).
      ENABLE_TEST_TOOLS: 'true',
    },
  },
});
