import { sql, type Kysely } from 'kysely';

/** Remise à zéro d'une partie : l'or du joueur retourne au grand livre par ce compte système. */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`insert into gold_account (code) values ('SINK_RESET')`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`delete from gold_account where code = 'SINK_RESET'`.execute(db);
}
