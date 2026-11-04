import { sql, type Kysely } from 'kysely';

/** Mot de passe oublié (guide 1.1) : jeton envoyé par e-mail (seul son hash est gardé), valable une heure, une fois. */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    create table password_reset (
      token_hash text primary key,
      account_id bigint not null references account (id) on delete cascade,
      expires_at timestamptz not null,
      used_at timestamptz,
      created_at timestamptz not null default now()
    );
    create index password_reset_account_idx on password_reset (account_id);
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`drop table password_reset;`.execute(db);
}
