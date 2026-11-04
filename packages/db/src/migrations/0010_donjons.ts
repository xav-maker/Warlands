import { sql, type Kysely } from 'kysely';

/**
 * Donjons (README 23, guide 6.6 et 9) : portes, parties de donjon, membres, coffre.
 *
 * - `dungeon_door` : porte apparue sur une étape ; au plus une visible par joueur.
 * - `dungeon_run` : une partie de donjon, solo ou duo ; `room` est la dernière salle gagnée (0 au départ).
 *   `lock_version` est renvoyé aux pages : une action envoyée sur un état périmé est refusée (guide 9.2).
 * - `dungeon_member` : un joueur dans une partie ; au plus une participation active par joueur. `back_kind`
 *   dit où il retourne en sortant (sa ville, ou son étape de route, gardée dans `player`). L'or gagné reste dans
 *   `chest_gold` jusqu'à la sortie (perdu en cas de défaite).
 * - Conteneur `DUNGEON_CHEST` : le butin gagné dans le donjon, à part du sac (guide 6.2), un par joueur.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    create table dungeon_door (
      id bigint generated always as identity primary key,
      player_id bigint not null references player (id) on delete cascade,
      dungeon text not null,
      route text not null,
      step smallint not null,
      status text not null check (status in ('visible', 'opened', 'gone')),
      created_at timestamptz not null default now()
    );
    create unique index dungeon_door_visible_uq on dungeon_door (player_id) where status = 'visible';

    create table dungeon_run (
      id bigint generated always as identity primary key,
      dungeon text not null,
      route text not null,
      step smallint not null,
      opener_id bigint not null references player (id) on delete cascade,
      mode text not null check (mode in ('solo', 'duo')),
      room integer not null default 0 check (room >= 0),
      status text not null check (status in ('lobby', 'between_rooms', 'closed')),
      invite_kind text check (invite_kind in ('friend', 'random')),
      invite_to bigint references player (id) on delete set null,
      invite_expires_at timestamptz,
      votes jsonb not null default '[]',
      lock_version integer not null default 0,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      closed_at timestamptz
    );
    create index dungeon_run_open_idx on dungeon_run (status) where status <> 'closed';

    create table dungeon_member (
      run_id bigint not null references dungeon_run (id) on delete cascade,
      player_id bigint not null references player (id) on delete cascade,
      role text not null check (role in ('opener', 'guest')),
      back_kind text not null check (back_kind in ('city', 'route')),
      status text not null check (status in ('active', 'left', 'defeated')),
      chest_gold integer not null default 0 check (chest_gold >= 0),
      last_active_at timestamptz not null default now(),
      left_at timestamptz,
      primary key (run_id, player_id)
    );
    create unique index dungeon_member_active_uq on dungeon_member (player_id) where status = 'active';

    alter table item_stack drop constraint item_stack_container_check;
    alter table item_stack add constraint item_stack_container_check
      check (container in ('BAG', 'BANK', 'PENDING_LOOT', 'DUNGEON_CHEST'));
    alter table item_instance drop constraint item_instance_container_check;
    alter table item_instance add constraint item_instance_container_check
      check (container in ('BAG', 'BANK', 'PENDING_LOOT', 'EQUIPPED', 'GRAVE', 'SYSTEM', 'ESCROW', 'DUNGEON_CHEST'));
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    update item_stack set container = 'BANK' where container = 'DUNGEON_CHEST';
    update item_instance set container = 'BANK' where container = 'DUNGEON_CHEST';
    alter table item_instance drop constraint item_instance_container_check;
    alter table item_instance add constraint item_instance_container_check
      check (container in ('BAG', 'BANK', 'PENDING_LOOT', 'EQUIPPED', 'GRAVE', 'SYSTEM', 'ESCROW'));
    alter table item_stack drop constraint item_stack_container_check;
    alter table item_stack add constraint item_stack_container_check check (container in ('BAG', 'BANK', 'PENDING_LOOT'));
    update player set pos_kind = 'city', pos_dungeon_run = null where pos_kind = 'dungeon';
    drop table dungeon_member;
    drop table dungeon_run;
    drop table dungeon_door;
  `.execute(db);
}
