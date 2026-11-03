import { sql, type Kysely } from 'kysely';

/**
 * J2, boucle solo (guide 6.2 à 6.4) : troupes et unités, objets (piles et exemplaires) et journal des
 * mouvements, or en partie double, expédition, rencontres, combats.
 * Compatible avec le code de J0 (tables nouvelles, colonnes ajoutées avec une valeur par défaut).
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    -- Région de départ : identifiant du contenu (J0 écrivait un identifiant provisoire).
    update player set pos_region = 'ronces' where pos_region = 'region.havre_gris';

    alter table player
      add column started_at timestamptz,
      add column content_version text,
      add column stat_fights integer not null default 0,
      add column stat_wins integer not null default 0,
      add column stat_deaths integer not null default 0,
      add column guardians text[] not null default '{}',
      add column unlocked smallint not null default 0;

    -- Troupes (guide 6.2) : BARRACKS (caserne), SQUAD (escouade), GRAVE (morte).
    create table troop (
      id bigint generated always as identity primary key,
      player_id bigint not null references player (id) on delete cascade,
      type text not null,
      form text not null,
      level smallint not null check (level between 1 and 30),
      xp integer not null default 0 check (xp >= 0),
      container text not null check (container in ('BARRACKS', 'SQUAD', 'GRAVE')),
      rank smallint not null check (rank between 1 and 3),
      sort smallint not null default 0,
      disabled_skills text[] not null default '{}',
      loaned boolean not null default false,
      died_at timestamptz,
      lock_version integer not null default 0,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
    create index troop_player_idx on troop (player_id, container, sort);

    create table troop_unit (
      troop_id bigint not null references troop (id) on delete cascade,
      n smallint not null check (n between 1 and 3),
      hp integer not null check (hp >= 0),
      mana integer not null check (mana >= 0),
      dead boolean not null default false,
      primary key (troop_id, n),
      check (dead or hp >= 1)
    );

    -- Piles d'objets : une ligne par (conteneur, objet), quantité > 0.
    create table item_stack (
      id bigint generated always as identity primary key,
      player_id bigint not null references player (id) on delete cascade,
      container text not null check (container in ('BAG', 'BANK', 'PENDING_LOOT')),
      item text not null,
      qty integer not null check (qty > 0),
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique (player_id, container, item)
    );

    -- Exemplaires d'équipement : stats tirées une fois, figées.
    create table item_instance (
      id bigint generated always as identity primary key,
      player_id bigint references player (id) on delete set null,
      container text not null check (container in ('BAG', 'BANK', 'PENDING_LOOT', 'EQUIPPED', 'GRAVE', 'SYSTEM')),
      troop_id bigint references troop (id),
      unit_n smallint,
      slot text,
      base text not null,
      roll smallint not null check (roll between 1 and 2000),
      stats jsonb not null,
      origin text not null check (origin in ('loot', 'craft', 'merchant', 'quest', 'dungeon', 'start')),
      content_version text not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      check ((container = 'EQUIPPED') = (troop_id is not null and unit_n is not null and slot is not null))
    );
    create index item_instance_owner_idx on item_instance (player_id, container);
    create unique index item_instance_slot_uq on item_instance (troop_id, unit_n, slot) where container = 'EQUIPPED';

    -- Journal de chaque mouvement de bien (guide 6.2, [A, 5.5]).
    create table asset_move (
      id bigint generated always as identity primary key,
      player_id bigint references player (id) on delete set null,
      kind text not null check (kind in ('stack', 'instance', 'troop')),
      item text,
      instance_id bigint,
      troop_id bigint,
      qty integer not null default 1 check (qty > 0),
      from_container text not null,
      to_container text not null,
      reason text not null,
      created_at timestamptz not null default now()
    );
    create index asset_move_player_idx on asset_move (player_id, created_at);

    -- Or en partie double (guide 6.3) : la somme des soldes est nulle ; un compte joueur ne descend jamais sous 0.
    create table gold_account (
      id bigint generated always as identity primary key,
      player_id bigint unique references player (id) on delete cascade,
      code text unique,
      balance bigint not null default 0,
      created_at timestamptz not null default now(),
      check ((player_id is null) <> (code is null)),
      check (player_id is null or balance >= 0)
    );
    insert into gold_account (code) values
      ('SOURCE_START'), ('SOURCE_COMBAT'), ('SOURCE_QUEST'), ('SOURCE_DUNGEON'), ('SOURCE_MERCHANT_BUY'),
      ('SINK_MERCHANT_SELL'), ('SINK_RECRUIT'), ('SINK_EVOLUTION'), ('SINK_REBUY_UNIT'), ('SINK_CRAFT'), ('SINK_SHOP_TAX');

    create table gold_entry (
      id bigint generated always as identity primary key,
      tx uuid not null,
      account_id bigint not null references gold_account (id),
      amount bigint not null check (amount <> 0),
      reason text not null,
      created_at timestamptz not null default now()
    );
    create index gold_entry_tx_idx on gold_entry (tx);
    create index gold_entry_account_idx on gold_entry (account_id, created_at);

    -- Expédition en cours : étapes dégagées de la route (une par joueur).
    create table expedition (
      player_id bigint primary key references player (id) on delete cascade,
      route text not null,
      direction smallint not null check (direction in (-1, 1)),
      cleared boolean[] not null,
      started_at timestamptz not null
    );

    -- Rencontres : une seule visible par joueur (ferme la faille searchFight, README 13.2 et 16.6).
    create table encounter (
      id bigint generated always as identity primary key,
      player_id bigint not null references player (id) on delete cascade,
      route text not null,
      step smallint not null check (step between 0 and 4),
      side jsonb not null,
      rare text,
      guardian boolean not null,
      seed bigint not null check (seed between 0 and 4294967295),
      status text not null check (status in ('visible', 'fought', 'gone')),
      created_at timestamptz not null default now()
    );
    create unique index encounter_visible_uq on encounter (player_id) where status = 'visible';

    -- Combats : entrée figée, graine, versions, journal compressé (guide 6.4).
    create table battle (
      id bigint generated always as identity primary key,
      player_id bigint not null references player (id) on delete cascade,
      kind text not null check (kind in ('route', 'guardian', 'dungeon')),
      route text not null,
      step smallint not null,
      encounter_id bigint references encounter (id),
      seed bigint not null check (seed between 0 and 4294967295),
      engine_version text not null,
      content_version text not null,
      input jsonb not null,
      result jsonb not null,
      log bytea not null,
      duration integer not null,
      won boolean not null,
      created_at timestamptz not null default now()
    );
    create index battle_player_idx on battle (player_id, created_at desc);

    create table battle_participant (
      battle_id bigint not null references battle (id) on delete cascade,
      player_id bigint not null references player (id) on delete cascade,
      rewards jsonb not null,
      primary key (battle_id, player_id)
    );
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    drop table battle_participant;
    drop table battle;
    drop table encounter;
    drop table expedition;
    drop table gold_entry;
    drop table gold_account;
    drop table asset_move;
    drop table item_instance;
    drop table item_stack;
    drop table troop_unit;
    drop table troop;
    alter table player
      drop column started_at, drop column content_version, drop column stat_fights, drop column stat_wins,
      drop column stat_deaths, drop column guardians, drop column unlocked;
    update player set pos_region = 'region.havre_gris' where pos_region = 'ronces';
  `.execute(db);
}
