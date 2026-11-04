/**
 * Donne un rôle à un compte : `grant-role <e-mail> <player|moderator|admin>`.
 * Il n'existe pas d'écran pour nommer le premier administrateur : c'est cet outil, lancé par l'exploitant
 * (`pnpm grant-role …` en développement, `node dist/grant-role.js …` dans l'image). L'opération est journalisée.
 */
import { createDb } from './index.ts';

const ROLES = ['player', 'moderator', 'admin'] as const;
const [email, role] = process.argv.slice(2);
const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL manquante');
  process.exit(1);
}
if (!email || !role || !(ROLES as readonly string[]).includes(role)) {
  console.error(`usage : grant-role <e-mail> <${ROLES.join('|')}>`);
  process.exit(2);
}
const db = createDb(url, { max: 1 });
try {
  const row = await db
    .selectFrom('account')
    .innerJoin('player', 'player.account_id', 'account.id')
    .select(['account.id', 'player.id as player_id', 'player.pseudo', 'account.role'])
    .where('account.email', '=', email.trim().toLowerCase())
    .executeTakeFirst();
  if (!row) {
    console.error(`aucun compte pour ${email}`);
    process.exit(1);
  }
  await db
    .updateTable('account')
    .set({ role: role as (typeof ROLES)[number], updated_at: new Date() })
    .where('id', '=', row.id)
    .execute();
  await db
    .insertInto('admin_action')
    .values({
      actor_id: null,
      action: 'role.grant',
      target_id: row.player_id,
      data: JSON.stringify({ from: row.role, to: role, by: 'cli' }),
    })
    .execute();
  console.log(`${row.pseudo} : ${row.role} → ${role}`);
} finally {
  await db.destroy();
}
