import { sql, type Kysely } from 'kysely';

/**
 * J6, social et modération (guide 6.8, 12 ; README 25) : chat de région, messages privés, amis, blocages,
 * signalements, sanctions et journal d'administration.
 *
 * Rétention : le chat de région se purge à 7 jours et les messages privés à 90 jours (tâches du worker) ;
 * un signalement copie le contenu signalé, qui survit donc à la purge ou à la suppression du message.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    create table chat_message (
      id bigint generated always as identity primary key,
      region text not null,
      author_id bigint not null references player (id) on delete cascade,
      body text not null check (char_length(body) between 1 and 300),
      -- Mots masqués par le filtre dans ce message (0 = message intact).
      filtered integer not null default 0,
      deleted_at timestamptz,
      deleted_by bigint references player (id) on delete set null,
      created_at timestamptz not null default now()
    );
    create index chat_message_region_idx on chat_message (region, id desc);
    create index chat_message_author_idx on chat_message (author_id, id desc);
    create index chat_message_created_idx on chat_message (created_at);

    create table direct_message (
      id bigint generated always as identity primary key,
      sender_id bigint not null references player (id) on delete cascade,
      recipient_id bigint not null references player (id) on delete cascade,
      body text not null check (char_length(body) between 1 and 300),
      read_at timestamptz,
      created_at timestamptz not null default now(),
      check (sender_id <> recipient_id)
    );
    create index direct_message_recipient_idx on direct_message (recipient_id, id desc);
    create index direct_message_sender_idx on direct_message (sender_id, id desc);
    create index direct_message_created_idx on direct_message (created_at);

    -- Une ligne par couple, a < b ; pending_a = demande envoyée par a, en attente de b.
    create table friendship (
      a_id bigint not null references player (id) on delete cascade,
      b_id bigint not null references player (id) on delete cascade,
      status text not null check (status in ('pending_a', 'pending_b', 'accepted')),
      created_at timestamptz not null default now(),
      primary key (a_id, b_id),
      check (a_id < b_id)
    );
    create index friendship_b_idx on friendship (b_id);

    create table block (
      blocker_id bigint not null references player (id) on delete cascade,
      blocked_id bigint not null references player (id) on delete cascade,
      created_at timestamptz not null default now(),
      primary key (blocker_id, blocked_id),
      check (blocker_id <> blocked_id)
    );
    create index block_blocked_idx on block (blocked_id);

    create table report (
      id bigint generated always as identity primary key,
      author_id bigint not null references player (id) on delete cascade,
      target_id bigint not null references player (id) on delete cascade,
      kind text not null check (kind in ('chat', 'dm', 'player', 'listing')),
      -- Message, message privé ou annonce visé ; vide pour un profil.
      ref_id bigint,
      -- Copie du contenu signalé (le message d'origine peut être purgé ou supprimé).
      content text not null default '',
      reason text not null check (reason in ('insulte', 'spam', 'triche', 'illicite', 'autre')),
      comment text not null default '' check (char_length(comment) <= 500),
      status text not null default 'open' check (status in ('open', 'closed')),
      handled_by bigint references player (id) on delete set null,
      decision text,
      handled_at timestamptz,
      created_at timestamptz not null default now()
    );
    create index report_queue_idx on report (status, id);
    create index report_target_idx on report (target_id, id desc);
    create unique index report_once_uq on report (author_id, kind, ref_id) where ref_id is not null;

    create table sanction (
      id bigint generated always as identity primary key,
      player_id bigint not null references player (id) on delete cascade,
      kind text not null check (kind in ('mute', 'shop_ban', 'suspend', 'ban')),
      reason text not null check (char_length(reason) between 1 and 500),
      from_at timestamptz not null default now(),
      -- Vide : sans fin (bannissement, ou sanction à durée indéterminée).
      until_at timestamptz,
      author_id bigint references player (id) on delete set null,
      report_id bigint references report (id) on delete set null,
      revoked_at timestamptz,
      revoked_by bigint references player (id) on delete set null
    );
    create index sanction_player_idx on sanction (player_id, kind);
    create index sanction_until_idx on sanction (until_at) where revoked_at is null;

    create table admin_action (
      id bigint generated always as identity primary key,
      actor_id bigint references player (id) on delete set null,
      action text not null,
      target_id bigint references player (id) on delete set null,
      data jsonb not null default '{}',
      created_at timestamptz not null default now()
    );
    create index admin_action_target_idx on admin_action (target_id, id desc);
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    drop table admin_action;
    drop table sanction;
    drop table report;
    drop table block;
    drop table friendship;
    drop table direct_message;
    drop table chat_message;
  `.execute(db);
}
