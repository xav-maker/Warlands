/**
 * Correction d'administration (guide 19.5, procédure 4), lancée par l'exploitant depuis le shell du service web :
 *
 *   node dist/correct.js gold <e-mail> <montant> <motif…>        rend (+) ou retire (−) de l'or
 *   node dist/correct.js item <e-mail> <objet> <quantité> <motif…> rend (+, en banque) ou retire (−, de la banque)
 *
 * En développement : pnpm correct …. Tout passe par le grand livre ou l'inventaire, et va au journal d'administration.
 */
import { createDb } from '@cr/db';
import { correctGold, correctItem } from '@cr/domain';
import { isGameError } from '@cr/shared';
import { loadGameContent } from '../content.ts';

const [kind, email, a, b, ...rest] = process.argv.slice(2);
const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL manquante');
  process.exit(1);
}
const usage = 'usage : correct gold <e-mail> <montant> <motif> | correct item <e-mail> <objet> <quantité> <motif>';
if (!email || !a || (kind !== 'gold' && kind !== 'item')) {
  console.error(usage);
  process.exit(2);
}
const db = createDb(url, { max: 1 });
try {
  if (kind === 'gold') {
    const r = await correctGold(db, { email, amount: Number(a), reason: [b, ...rest].join(' ') });
    console.log(`${r.player} : ${r.amount > 0 ? '+' : ''}${r.amount} or`);
  } else {
    const r = await correctItem(db, loadGameContent(), { email, item: a, qty: Number(b), reason: rest.join(' ') });
    console.log(`${r.player} : ${r.qty > 0 ? '+' : ''}${r.qty} × ${r.item}`);
  }
} catch (e) {
  console.error(isGameError(e) ? `refusé : ${e.code} (${usage})` : e);
  process.exitCode = 1;
} finally {
  await db.destroy();
}
