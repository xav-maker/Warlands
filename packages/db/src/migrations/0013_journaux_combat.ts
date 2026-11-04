import { sql, type Kysely } from 'kysely';

/**
 * Journaux de combat (guide 15.3) : le journal complet est gardé 30 jours, puis effacé ; le combat garde son résumé
 * (résultat, récompenses, entrée et graine) et reste rejouable par le moteur de la même version. `log` devient
 * facultatif ; l'index sert la purge.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    alter table battle alter column log drop not null;
    create index battle_log_age_idx on battle (created_at) where log is not null;
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    drop index battle_log_age_idx;
    update battle set log = '\\x'::bytea where log is null;
    alter table battle alter column log set not null;
  `.execute(db);
}
