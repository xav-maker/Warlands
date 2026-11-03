import { PgBoss } from 'pg-boss';
import pino from 'pino';
import { createDb } from '@cr/db';
import { expireListings, purgeExpiredSessions } from '@cr/domain';

const log = pino({ level: process.env.LOG_LEVEL ?? 'info', base: { role: 'worker' } });
const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL manquante');

const db = createDb(url, { max: 4 });
const boss = new PgBoss({ connectionString: url, schema: 'pgboss' });
boss.on('error', (err) => log.error({ err }, 'pg-boss'));
await boss.start();

/** Tâches planifiées (guide 11.1, 19.3, 21). */
const JOBS: Record<string, { cron: string; run: () => Promise<unknown> }> = {
  'purge-sessions': { cron: '17 * * * *', run: () => purgeExpiredSessions(db) },
  // Annonces de boutique arrivées à 7 jours : le bien retourne au vendeur (guide 11.1).
  'expire-listings': { cron: '*/5 * * * *', run: () => expireListings(db) },
};

for (const [name, job] of Object.entries(JOBS)) {
  await boss.createQueue(name);
  await boss.schedule(name, job.cron);
  await boss.work(name, async () => {
    const result = await job.run();
    log.info({ job: name, result }, 'tâche terminée');
  });
}
log.info({ jobs: Object.keys(JOBS) }, 'worker prêt');

for (const sig of ['SIGTERM', 'SIGINT'] as const) {
  process.on(sig, async () => {
    log.info({ sig }, 'arrêt demandé');
    await boss.stop({ graceful: true });
    await db.destroy();
    process.exit(0);
  });
}
