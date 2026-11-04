import { sql, type Kysely } from 'kysely';

/**
 * Corrections d'administration (guide 19.5, procédure 4) : l'or rendu ou retiré à un joueur passe par deux comptes
 * système dédiés, pour que chaque correction reste visible au grand livre.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`insert into gold_account (code) values ('SOURCE_ADMIN'), ('SINK_ADMIN')`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`delete from gold_account where code in ('SOURCE_ADMIN', 'SINK_ADMIN')`.execute(db);
}
