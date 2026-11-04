import { sql, type Kysely } from 'kysely';

/**
 * Liens cités dans le chat et les messages privés (README 25, guide 12) : un message peut citer un objet, une
 * troupe ou une annonce de boutique. On stocke des références `[{ kind, id, label }]` ; le libellé est celui du
 * moment de l'envoi, la fiche consultable est relue en base à chaque ouverture.
 * L'index GIN retrouve les messages qui citent un bien donné (droit de consulter une fiche).
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    alter table chat_message add column links jsonb not null default '[]';
    alter table direct_message add column links jsonb not null default '[]';
    create index chat_message_links_idx on chat_message using gin (links jsonb_path_ops);
    create index direct_message_links_idx on direct_message using gin (links jsonb_path_ops);
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    drop index direct_message_links_idx;
    drop index chat_message_links_idx;
    alter table direct_message drop column links;
    alter table chat_message drop column links;
  `.execute(db);
}
