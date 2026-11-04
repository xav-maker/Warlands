/**
 * Marque l'adresse e-mail d'un compte comme vérifiée : `verify-email <e-mail>`.
 * Dépannage de l'exploitant (e-mail de vérification perdu, envoi en panne) : le chat, les messages et les boutiques
 * exigent une adresse vérifiée. Lancé par `pnpm verify-email …` en développement, `node dist/verify-email.js …` dans
 * l'image. L'opération est journalisée.
 */
import { createDb } from './index.ts';

const [email] = process.argv.slice(2);
const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL manquante');
  process.exit(1);
}
if (!email) {
  console.error('usage : verify-email <e-mail>');
  process.exit(2);
}
const db = createDb(url, { max: 1 });
try {
  const row = await db
    .selectFrom('account')
    .innerJoin('player', 'player.account_id', 'account.id')
    .select(['account.id', 'player.id as player_id', 'player.pseudo', 'account.email_verified_at'])
    .where('account.email', '=', email.trim().toLowerCase())
    .executeTakeFirst();
  if (!row) {
    console.error(`aucun compte pour ${email}`);
    process.exit(1);
  }
  if (row.email_verified_at) {
    console.log(`${row.pseudo} : adresse déjà vérifiée`);
  } else {
    await db.updateTable('account').set({ email_verified_at: new Date(), updated_at: new Date() }).where('id', '=', row.id).execute();
    await db
      .insertInto('admin_action')
      .values({ actor_id: null, action: 'account.verify_email', target_id: row.player_id, data: JSON.stringify({ by: 'cli' }) })
      .execute();
    console.log(`${row.pseudo} : adresse vérifiée`);
  }
} finally {
  await db.destroy();
}
