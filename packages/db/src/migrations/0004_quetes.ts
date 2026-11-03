import { sql, type Kysely } from 'kysely';

/**
 * J3, quêtes (guide 6.5, README 9.2 et 9.3) : 5 quêtes par ville et par joueur, tirées de sa graine
 * (genQuest(graine, ville, n)) et gardées en base ; rendue ou abandonnée, une quête est remplacée par la
 * suivante (n + 1). Compte d'or du renoncement.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    create table quest (
      id bigint generated always as identity primary key,
      player_id bigint not null references player (id) on delete cascade,
      region text not null,
      n integer not null check (n >= 0),
      data jsonb not null,
      status text not null check (status in ('offered', 'done', 'abandoned')),
      content_version text not null,
      created_at timestamptz not null default now(),
      closed_at timestamptz,
      unique (player_id, region, n)
    );
    create index quest_offered_idx on quest (player_id, region) where status = 'offered';

    insert into gold_account (code) values ('SINK_QUEST_ABANDON');
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    drop table quest;
    delete from gold_account where code = 'SINK_QUEST_ABANDON';
  `.execute(db);
}
