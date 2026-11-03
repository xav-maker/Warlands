import type { TestProject } from 'vitest/node';

/**
 * Un seul Postgres pour toute la suite : celui de TEST_DATABASE_URL, sinon un conteneur
 * Testcontainers démarré ici et partagé avec les fichiers de test par `provide`.
 */
export default async function setup(project: TestProject) {
  let url = process.env.TEST_DATABASE_URL;
  let stop = async () => {};
  if (!url) {
    const { PostgreSqlContainer } = await import('@testcontainers/postgresql');
    const c = await new PostgreSqlContainer('postgres:17').start();
    url = c.getConnectionUri();
    stop = async () => void (await c.stop());
  }
  // ProvidedContext est augmenté dans @cr/testing, que vitest/node ne voit pas : on passe par une signature large.
  (project.provide as (key: string, value: string) => void)('testDatabaseUrl', url);
  return stop;
}
