import { sql, type Kysely } from 'kysely';

/**
 * Invitations de donjon (README 23.2, guide 9.1) : les joueurs sollicités par l'invitation en cours (l'ami invité, ou
 * jusqu'à 20 joueurs disponibles de la région pour une invitation au hasard). Seuls eux peuvent l'accepter.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    alter table dungeon_run add column invited jsonb not null default '[]';
    create index dungeon_run_invite_idx on dungeon_run (invite_expires_at) where status = 'lobby';
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    drop index dungeon_run_invite_idx;
    alter table dungeon_run drop column invited;
  `.execute(db);
}
