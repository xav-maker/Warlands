import { sql, type Kysely } from 'kysely';

/**
 * Échecs de connexion (guide 13.1) : garde-fou en base, commun à tous les exemplaires web. Une ligne par échec, sous
 * deux clés : l'adresse (empreinte SHA-256, qu'un compte existe ou non : pas d'énumération) et le préfixe d'IP.
 * Purgées au bout d'un jour.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    create table login_failure (
      id bigint generated always as identity primary key,
      key text not null,
      at timestamptz not null default now()
    );
    create index login_failure_key_idx on login_failure (key, at);
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`drop table login_failure;`.execute(db);
}
