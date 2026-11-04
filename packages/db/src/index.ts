import { Kysely, PostgresDialect } from 'kysely';
import { Migrator, type MigrationResultSet } from 'kysely/migration';
import pg from 'pg';
import { migrations } from './migrations/index.ts';
import type { Database } from './schema.ts';

export * from './schema.ts';
export type { Transaction } from 'kysely';
export { sql } from 'kysely';

// bigint (int8) → number : nos identifiants et la graine restent bien en dessous de 2^53.
pg.types.setTypeParser(20, (v) => {
  const n = Number(v);
  if (!Number.isSafeInteger(n)) throw new Error(`int8 hors limites : ${v}`);
  return n;
});

export type Db = Kysely<Database>;

export function createDb(connectionString: string, opts: { max?: number } = {}): Db {
  const pool = new pg.Pool({ connectionString, max: opts.max ?? 10 });
  // Une connexion inactive coupée par le serveur (redémarrage, base supprimée en test) émet « error » sur le
  // pool : sans écouteur, Node arrête le processus. Le pool la remplace à la demande suivante.
  pool.on('error', (e) => console.error(`postgres : connexion inactive perdue (${e.message})`));
  return new Kysely<Database>({ dialect: new PostgresDialect({ pool }) });
}

export async function migrateToLatest(db: Db): Promise<MigrationResultSet> {
  const migrator = new Migrator({ db, provider: { getMigrations: async () => migrations } });
  const result = await migrator.migrateToLatest();
  if (result.error) throw result.error;
  return result;
}
