import { sql, type Kysely } from 'kysely';

/**
 * J0 : comptes, sessions, vérification d'e-mail, joueurs, clés d'idempotence.
 * Règle (guide 17.4) : une migration reste compatible avec la version précédente du code.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    create table account (
      id bigint generated always as identity primary key,
      email text not null check (email = lower(email)),
      password_hash text not null,
      email_verified_at timestamptz,
      role text not null default 'player' check (role in ('player', 'moderator', 'admin')),
      status text not null default 'active' check (status in ('active', 'suspended', 'banned', 'deleted')),
      totp_secret text,
      tos_version text not null,
      tos_accepted_at timestamptz not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
    create unique index account_email_uq on account (email) where status <> 'deleted';

    create table session (
      id text primary key,
      account_id bigint not null references account (id) on delete cascade,
      csrf_token text not null,
      expires_at timestamptz not null,
      last_seen_at timestamptz not null,
      ip_prefix text,
      user_agent text,
      created_at timestamptz not null default now()
    );
    create index session_account_idx on session (account_id);
    create index session_expires_idx on session (expires_at);

    create table email_verification (
      token_hash text primary key,
      account_id bigint not null references account (id) on delete cascade,
      expires_at timestamptz not null,
      used_at timestamptz,
      created_at timestamptz not null default now()
    );

    create table player (
      id bigint generated always as identity primary key,
      account_id bigint not null unique references account (id),
      pseudo text not null check (char_length(pseudo) between 3 and 20),
      seed bigint not null check (seed between 0 and 4294967295),
      pos_kind text not null default 'city' check (pos_kind in ('city', 'route', 'dungeon')),
      pos_region text not null,
      pos_route text,
      pos_direction smallint check (pos_direction in (-1, 1)),
      pos_step smallint check (pos_step between 0 and 4),
      pos_dungeon_run bigint,
      watch_until timestamptz,
      dungeon_available boolean not null default false,
      last_seen_at timestamptz,
      lock_version integer not null default 0,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      check (pos_kind <> 'route' or (pos_route is not null and pos_direction is not null and pos_step is not null)),
      check (pos_kind <> 'dungeon' or pos_dungeon_run is not null)
    );
    create unique index player_pseudo_uq on player (lower(pseudo));

    create table idempotency_key (
      player_id bigint not null references player (id) on delete cascade,
      key text not null check (char_length(key) between 8 and 64),
      command text not null,
      request_hash text not null,
      response jsonb not null,
      created_at timestamptz not null default now(),
      primary key (player_id, key)
    );
    create index idempotency_created_idx on idempotency_key (created_at);
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    drop table idempotency_key;
    drop table player;
    drop table email_verification;
    drop table session;
    drop table account;
  `.execute(db);
}
