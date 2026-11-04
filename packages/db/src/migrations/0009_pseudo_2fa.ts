import { sql, type Kysely } from 'kysely';

/**
 * Renommage forcé et double authentification du personnel (guide 12 et 13.4).
 * - `player.rename_required` : un modérateur a remplacé le pseudo ; le joueur peut en choisir un nouveau, une fois.
 * - `account.totp_pending` : secret proposé pendant l'activation, avant la confirmation par un premier code.
 * - `account.totp_last_step` : dernier pas de temps accepté, pour refuser le rejeu d'un code.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    alter table player add column rename_required boolean not null default false;
    alter table account add column totp_pending text;
    alter table account add column totp_last_step integer;
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    alter table account drop column totp_last_step;
    alter table account drop column totp_pending;
    alter table player drop column rename_required;
  `.execute(db);
}
