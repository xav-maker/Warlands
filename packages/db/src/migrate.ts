import { createDb, migrateToLatest } from './index.ts';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL manquante');
  process.exit(1);
}
const db = createDb(url, { max: 1 });
try {
  const { results } = await migrateToLatest(db);
  for (const r of results ?? []) console.log(`${r.status === 'Success' ? 'ok ' : r.status} ${r.migrationName}`);
  if (!results?.length) console.log('Base à jour.');
} finally {
  await db.destroy();
}
