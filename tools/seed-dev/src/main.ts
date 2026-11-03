/**
 * Données de développement et de test (guide 3.1, tools/seed-dev). Jamais sur une base distante.
 *
 *   pnpm seed-dev squad <e-mail> [niveau]   escouade pleine de haut niveau (8 unités, 10 de population)
 *                                           pour le compte <e-mail> ; ses troupes actuelles vont en caserne
 */
import { join } from 'node:path';
import { createDb } from '@cr/db';
import { validateContent } from '@cr/content';
import { createTroop, startPlayer } from '@cr/domain';
import type { GameContent } from '@cr/domain';
import type { GenContent } from '@cr/gen';

const SQUAD = ['briseur', 'acolyte', 'chasseur', 'milicien', 'frondeurs', 'pyromancien'];

const url = process.env.DATABASE_URL ?? '';
const host = (() => {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
})();
if (!['localhost', '127.0.0.1', '::1', 'postgres', 'host.docker.internal'].includes(host)) {
  console.error(`seed-dev refuse la base « ${host || 'inconnue'} » : bases locales seulement (DATABASE_URL).`);
  process.exit(1);
}

const [cmd, email, levelArg] = process.argv.slice(2);
if (cmd !== 'squad' || !email) {
  console.error('usage : seed-dev squad <e-mail> [niveau]');
  process.exit(2);
}
const level = Math.min(30, Math.max(1, Number(levelArg ?? 30)));
const v = validateContent(join(import.meta.dirname, '../../../content'));
if (!v.ok) throw new Error('contenu invalide');
const content: GameContent = { pack: v.pack as unknown as GenContent, hash: v.hash! };

const db = createDb(url, { max: 2 });
try {
  await db.transaction().execute(async (tx) => {
    const p = await tx
      .selectFrom('player')
      .innerJoin('account', 'account.id', 'player.account_id')
      .selectAll('player')
      .where('account.email', '=', email.toLowerCase())
      .forUpdate()
      .executeTakeFirst();
    if (!p) throw new Error(`aucun joueur pour ${email}`);
    if (!p.started_at) await startPlayer(tx, content, p, new Date());
    await tx.updateTable('troop').set({ container: 'BARRACKS' }).where('player_id', '=', p.id).where('container', '=', 'SQUAD').execute();
    for (const type of SQUAD) await createTroop(tx, content, p.id, { type, level, container: 'SQUAD', reason: 'seed-dev' });
  });
  console.log(`escouade de niveau ${level} donnée à ${email}`);
} finally {
  await db.destroy();
}
