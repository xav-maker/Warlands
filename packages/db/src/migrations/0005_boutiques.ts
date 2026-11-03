import { sql, type Kysely } from 'kysely';

/**
 * J5, boutiques des joueurs (guide 6.7, 11 ; README 22) : annonces par ville, ventes (historique des prix),
 * notifications persistantes, historique de propriété des troupes.
 *
 * Séquestre : un exemplaire ou une troupe en vente passe dans le conteneur ESCROW (et n'est nulle part
 * ailleurs) ; une pile d'objets en vente est portée par l'annonce elle-même (item, qty), retirée de la banque.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    create extension if not exists pg_trgm;

    alter table item_instance drop constraint item_instance_container_check;
    alter table item_instance add constraint item_instance_container_check
      check (container in ('BAG', 'BANK', 'PENDING_LOOT', 'EQUIPPED', 'GRAVE', 'SYSTEM', 'ESCROW'));
    alter table troop drop constraint troop_container_check;
    alter table troop add constraint troop_container_check check (container in ('BARRACKS', 'SQUAD', 'GRAVE', 'ESCROW'));

    create table shop_listing (
      id bigint generated always as identity primary key,
      region text not null,
      seller_id bigint not null references player (id) on delete cascade,
      kind text not null check (kind in ('stack', 'instance', 'troop')),
      item text not null,
      qty integer not null default 1 check (qty > 0),
      instance_id bigint references item_instance (id),
      troop_id bigint references troop (id),
      price integer not null check (price > 0),
      status text not null check (status in ('active', 'sold', 'withdrawn', 'expired')),
      expires_at timestamptz not null,
      -- Champs de recherche dénormalisés (guide 6.7).
      name text not null,
      family text not null,
      tier smallint not null,
      slot text,
      level smallint,
      lock_version integer not null default 0,
      created_at timestamptz not null default now(),
      closed_at timestamptz,
      check (kind <> 'instance' or instance_id is not null),
      check (kind <> 'troop' or troop_id is not null),
      check (kind <> 'stack' or (instance_id is null and troop_id is null))
    );
    create index shop_listing_search_idx on shop_listing (region, status, family, price, id);
    create index shop_listing_name_idx on shop_listing using gin (name gin_trgm_ops);
    create index shop_listing_seller_idx on shop_listing (seller_id, status);
    create index shop_listing_expiry_idx on shop_listing (expires_at) where status = 'active';
    create unique index shop_listing_instance_uq on shop_listing (instance_id) where status = 'active';
    create unique index shop_listing_troop_uq on shop_listing (troop_id) where status = 'active';

    create table shop_sale (
      id bigint generated always as identity primary key,
      listing_id bigint not null unique references shop_listing (id),
      region text not null,
      item text not null,
      qty integer not null,
      buyer_id bigint references player (id) on delete set null,
      seller_id bigint references player (id) on delete set null,
      price integer not null,
      tax integer not null,
      created_at timestamptz not null default now()
    );
    create index shop_sale_history_idx on shop_sale (region, item, created_at desc);

    create table notification (
      id bigint generated always as identity primary key,
      player_id bigint not null references player (id) on delete cascade,
      type text not null,
      data jsonb not null,
      read_at timestamptz,
      created_at timestamptz not null default now()
    );
    create index notification_player_idx on notification (player_id, created_at desc);

    create table troop_ownership (
      id bigint generated always as identity primary key,
      troop_id bigint not null references troop (id) on delete cascade,
      player_id bigint references player (id) on delete set null,
      reason text not null,
      from_at timestamptz not null default now(),
      to_at timestamptz
    );
    create index troop_ownership_troop_idx on troop_ownership (troop_id, from_at);
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    drop table troop_ownership;
    drop table notification;
    drop table shop_sale;
    drop table shop_listing;
    alter table troop drop constraint troop_container_check;
    alter table troop add constraint troop_container_check check (container in ('BARRACKS', 'SQUAD', 'GRAVE'));
    alter table item_instance drop constraint item_instance_container_check;
    alter table item_instance add constraint item_instance_container_check
      check (container in ('BAG', 'BANK', 'PENDING_LOOT', 'EQUIPPED', 'GRAVE', 'SYSTEM'));
  `.execute(db);
}
