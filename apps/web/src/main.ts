import { createBus, createDb } from '@cr/db';
import { buildApp } from './app.ts';
import { loadConfig } from './config.ts';
import { loadGameContent } from './content.ts';
import { smtpMailer } from './mailer.ts';

const cfg = loadConfig();
const content = loadGameContent();
const db = createDb(cfg.DATABASE_URL);
// Une connexion LISTEN dédiée par instance : les événements publiés par n'importe quelle instance arrivent ici.
const bus = createBus({
  db,
  connectionString: cfg.DATABASE_URL,
  log: (m, err) => console.error(m, err instanceof Error ? err.message : ''),
});
const app = await buildApp({
  db,
  bus,
  mailer: smtpMailer(cfg.smtp, cfg.MAIL_FROM),
  appUrl: cfg.APP_URL,
  cookieSecure: cfg.SESSION_COOKIE_SECURE,
  logLevel: cfg.LOG_LEVEL,
  version: cfg.APP_VERSION,
  content,
  testTools: cfg.ENABLE_TEST_TOOLS,
});

// Arrêt propre (guide 17.5) : plus de nouvelles requêtes, fin des requêtes en cours, puis fermeture de la base.
let stopping = false;
for (const sig of ['SIGTERM', 'SIGINT'] as const) {
  process.on(sig, async () => {
    if (stopping) return;
    stopping = true;
    app.log.info({ sig }, 'arrêt demandé');
    await app.close();
    await bus.close();
    await db.destroy();
    process.exit(0);
  });
}

await app.listen({ port: cfg.PORT, host: cfg.HOST });
