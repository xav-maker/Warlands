import { sql, type Kysely } from 'kysely';

/**
 * J3, progression (guide 6.1) : recettes personnelles matérialisées au premier contact, et matériaux
 * réservés à l'échange (README 8.5). Une fois écrites, elles ne changent plus pour ce joueur, même si le
 * contenu évolue (la version de contenu est gardée).
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    create table player_recipe (
      player_id bigint not null references player (id) on delete cascade,
      out text not null,
      kind text not null check (kind in ('equip', 'consommable', 'recrue', 'evolution')),
      ingredients jsonb not null,
      gold integer not null check (gold >= 0),
      budget integer not null,
      content_version text not null,
      created_at timestamptz not null default now(),
      primary key (player_id, out)
    );

    create table player_reserved_material (
      player_id bigint not null references player (id) on delete cascade,
      item text not null,
      primary key (player_id, item)
    );
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    drop table player_reserved_material;
    drop table player_recipe;
  `.execute(db);
}
