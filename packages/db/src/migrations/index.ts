import type { Migration } from 'kysely/migration';
import * as m0001 from './0001_socle.ts';
import * as m0002 from './0002_boucle_solo.ts';
import * as m0003 from './0003_progression.ts';
import * as m0004 from './0004_quetes.ts';
import * as m0005 from './0005_boutiques.ts';
import * as m0006 from './0006_remise_a_zero.ts';
import * as m0007 from './0007_social.ts';
import * as m0008 from './0008_liens_chat.ts';
import * as m0009 from './0009_pseudo_2fa.ts';

/**
 * Liste explicite des migrations, dans l'ordre. On évite `FileMigrationProvider`, qui charge
 * des chemins absolus Windows par `import()` et casse une fois l'application empaquetée.
 */
export const migrations: Record<string, Migration> = {
  '0001_socle': m0001,
  '0002_boucle_solo': m0002,
  '0003_progression': m0003,
  '0004_quetes': m0004,
  '0005_boutiques': m0005,
  '0006_remise_a_zero': m0006,
  '0007_social': m0007,
  '0008_liens_chat': m0008,
  '0009_pseudo_2fa': m0009,
};
