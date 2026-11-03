import { randomBytes } from 'node:crypto';
import pg from 'pg';
import { inject } from 'vitest';
import { createDb, migrateToLatest, type Db } from '@cr/db';

/**
 * Base de test réelle (guide 16.2 : jamais de faux en mémoire).
 * Le serveur est démarré une fois par vitest.global-setup.ts ; chaque fichier de test y crée sa propre base.
 */
export interface TestDb {
  db: Db;
  url: string;
  stop(): Promise<void>;
}

export async function startTestDb(): Promise<TestDb> {
  const adminUrl = inject('testDatabaseUrl');
  const name = `t_${randomBytes(6).toString('hex')}`;
  const admin = new pg.Client({ connectionString: adminUrl });
  await admin.connect();
  await admin.query(`create database ${name}`);
  await admin.end();

  const u = new URL(adminUrl);
  u.pathname = `/${name}`;
  const url = u.toString();
  const db = createDb(url, { max: 10 });
  await migrateToLatest(db);
  return {
    db,
    url,
    async stop() {
      await db.destroy();
      const a = new pg.Client({ connectionString: adminUrl });
      await a.connect();
      await a.query(`drop database if exists ${name} with (force)`);
      await a.end();
    },
  };
}

declare module 'vitest' {
  export interface ProvidedContext {
    testDatabaseUrl: string;
  }
}
