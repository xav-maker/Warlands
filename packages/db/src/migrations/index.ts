import type { Migration } from 'kysely/migration';
import * as m0001 from './0001_socle.ts';

/**
 * Liste explicite des migrations, dans l'ordre. On évite `FileMigrationProvider`, qui charge
 * des chemins absolus Windows par `import()` et casse une fois l'application empaquetée.
 */
export const migrations: Record<string, Migration> = {
  '0001_socle': m0001,
};
