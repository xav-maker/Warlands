import { sql, type Kysely } from 'kysely';

/**
 * Péage des routes : l'or payé à chaque départ de ville et à chaque retour à l'étape précédente va à un compte
 * système dédié, pour qu'il reste visible au grand livre.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`insert into gold_account (code) values ('SINK_ROUTE_TOLL')`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`delete from gold_account where code = 'SINK_ROUTE_TOLL'`.execute(db);
}
