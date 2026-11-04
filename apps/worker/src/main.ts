import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PgBoss } from 'pg-boss';
import pino from 'pino';
import { findContentDir, loadActivePack } from '@cr/content';
import { createBus, createDb } from '@cr/db';
import {
  checkInvariants,
  expireListings,
  liftExpiredSuspensions,
  purgeExpiredSessions,
  purgeSocial,
  replayBattles,
  sweepDungeons,
  type GameContent,
  type Violation,
} from '@cr/domain';
import type { GenContent } from '@cr/gen';

const log = pino({ level: process.env.LOG_LEVEL ?? 'info', base: { role: 'worker' } });
const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL manquante');

// Contenu actif (contrôles d'invariants : population des troupes, PV maximum) : à côté de dist/ dans l'image.
const here = dirname(fileURLToPath(import.meta.url));
const active = loadActivePack(findContentDir([join(here, '..', 'content'), join(here, '..', '..', '..', 'content')]));
const content: GameContent = { pack: active.pack as unknown as GenContent, hash: active.hash };

const db = createDb(url, { max: 4 });
// Publication seulement (NOTIFY) : les exemplaires web relaient les événements à leurs flux SSE.
const bus = createBus({ db, log: (m, err) => log.error({ err }, m) });
const boss = new PgBoss({ connectionString: url, schema: 'pgboss' });
boss.on('error', (err) => log.error({ err }, 'pg-boss'));
await boss.start();

/** Signale les violations d'invariants ; rend leur nombre. */
function alert(violations: Violation[]): { violations: number } {
  if (violations.length) log.fatal({ alert: 'invariant', violations }, `${violations.length} violation(s) d'invariant`);
  return { violations: violations.length };
}

/** Tâches planifiées (guide 11.1, 19.3, 21). */
const JOBS: Record<string, { cron: string; run: () => Promise<unknown> }> = {
  'purge-sessions': { cron: '17 * * * *', run: () => purgeExpiredSessions(db) },
  // Annonces de boutique arrivées à 7 jours : le bien retourne au vendeur (guide 11.1).
  'expire-listings': { cron: '*/5 * * * *', run: () => expireListings(db) },
  // Rétention du social (README 25) : chat de région 7 jours, messages privés 90 jours.
  'purge-social': { cron: '37 * * * *', run: () => purgeSocial(db) },
  // Suspensions arrivées à leur terme : le compte redevient actif (aussi levées à la connexion).
  'lift-suspensions': { cron: '* * * * *', run: () => liftExpiredSuspensions(db) },
  // Donjons (guide 9.1, README 26) : invitations expirées, membres absents plus de 5 minutes en duo.
  'sweep-dungeons': { cron: '* * * * *', run: () => sweepDungeons(db, { publish: (e) => bus.publish(e) }) },
  // Invariants (guide 19.3) toutes les 10 minutes ; la nuit, 100 combats de la veille rejoués. Une violation est une
  // alerte critique (guide 19.2) : journal au niveau « fatal », champ alert = invariant.
  invariants: { cron: '*/10 * * * *', run: async () => alert(await checkInvariants(db, content)) },
  'invariants-nightly': {
    cron: '30 3 * * *',
    run: async () => {
      const until = new Date(new Date().setHours(0, 0, 0, 0));
      return alert(await replayBattles(db, content, { since: new Date(until.getTime() - 86_400_000), until }));
    },
  },
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
    await bus.close();
    await db.destroy();
    process.exit(0);
  });
}
