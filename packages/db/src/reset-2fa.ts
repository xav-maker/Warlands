/**
 * Retire la double authentification d'un compte : `reset-2fa <e-mail>`.
 * Dépannage de l'exploitant quand un modérateur ou un joueur a perdu son application d'authentification. Lancé par
 * `pnpm reset-2fa …` en développement, `node dist/reset-2fa.js …` dans l'image. Les sessions du compte sont fermées
 * (il devra se reconnecter puis réactiver la 2FA) et l'opération est journalisée.
 */
import { createDb } from './index.ts';

const [email] = process.argv.slice(2);
const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL manquante');
  process.exit(1);
}
if (!email) {
  console.error('usage : reset-2fa <e-mail>');
  process.exit(2);
}
const db = createDb(url, { max: 1 });
try {
  const row = await db
    .selectFrom('account')
    .innerJoin('player', 'player.account_id', 'account.id')
    .select(['account.id', 'player.id as player_id', 'player.pseudo', 'account.totp_secret'])
    .where('account.email', '=', email.trim().toLowerCase())
    .executeTakeFirst();
  if (!row) {
    console.error(`aucun compte pour ${email}`);
    process.exit(1);
  }
  await db.transaction().execute(async (tx) => {
    await tx
      .updateTable('account')
      .set({ totp_secret: null, totp_pending: null, totp_last_step: null, updated_at: new Date() })
      .where('id', '=', row.id)
      .execute();
    await tx.deleteFrom('session').where('account_id', '=', row.id).execute();
    await tx
      .insertInto('admin_action')
      .values({ actor_id: null, action: 'account.totp_reset', target_id: row.player_id, data: JSON.stringify({ by: 'cli' }) })
      .execute();
  });
  console.log(`${row.pseudo} : double authentification ${row.totp_secret ? 'retirée' : 'déjà inactive'}, sessions fermées`);
} finally {
  await db.destroy();
}
