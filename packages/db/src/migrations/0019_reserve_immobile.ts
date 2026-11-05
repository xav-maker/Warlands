import { sql, type Kysely } from 'kysely';

/**
 * Réserve et troupes immobiles (README 29) : un nouveau conteneur RESERVE pour les troupes qui ne combattent pas
 * mais reçoivent l'XP, et un drapeau `hold` par troupe (elle ne se déplace pas d'elle-même au combat).
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    alter table troop drop constraint troop_container_check;
    alter table troop add constraint troop_container_check
      check (container in ('BARRACKS', 'SQUAD', 'RESERVE', 'GRAVE', 'ESCROW'));
    alter table troop add column hold boolean not null default false;
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    update troop set container = 'BARRACKS' where container = 'RESERVE';
    alter table troop drop column hold;
    alter table troop drop constraint troop_container_check;
    alter table troop add constraint troop_container_check check (container in ('BARRACKS', 'SQUAD', 'GRAVE', 'ESCROW'));
  `.execute(db);
}
