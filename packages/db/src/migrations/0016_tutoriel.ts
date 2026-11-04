import { sql, type Kysely } from 'kysely';

/**
 * Tutoriel des nouveaux joueurs : les étapes se déduisent de ce que le joueur a fait (combats, mouvements de biens,
 * grand livre) ; on ne garde ici que ce qui ne se déduit pas : les étapes lues (« J'ai compris ») et le tutoriel masqué.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`alter table player add column tutorial jsonb not null default '{}'`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`alter table player drop column tutorial`.execute(db);
}
