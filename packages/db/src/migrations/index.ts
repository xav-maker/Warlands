import type { Migration } from 'kysely/migration';
import * as m0001 from './0001_socle.ts';
import * as m0002 from './0002_boucle_solo.ts';
import * as m0003 from './0003_progression.ts';

/**
 * Liste explicite des migrations, dans l'ordre. On évite `FileMigrationProvider`, qui charge
 * des chemins absolus Windows par `import()` et casse une fois l'application empaquetée.
 */
export const migrations: Record<string, Migration> = {
  '0001_socle': m0001,
  '0002_boucle_solo': m0002,
  '0003_progression': m0003,
};
