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
import * as m0010 from './0010_donjons.ts';
import * as m0011 from './0011_donjon_invitations.ts';
import * as m0012 from './0012_echecs_connexion.ts';
import * as m0013 from './0013_journaux_combat.ts';
import * as m0014 from './0014_corrections.ts';
import * as m0015 from './0015_mot_de_passe_oublie.ts';
import * as m0016 from './0016_tutoriel.ts';
import * as m0017 from './0017_boutique_commune.ts';
import * as m0018 from './0018_peage_routes.ts';
import * as m0019 from './0019_reserve_immobile.ts';

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
  '0010_donjons': m0010,
  '0011_donjon_invitations': m0011,
  '0012_echecs_connexion': m0012,
  '0013_journaux_combat': m0013,
  '0014_corrections': m0014,
  '0015_mot_de_passe_oublie': m0015,
  '0016_tutoriel': m0016,
  '0017_boutique_commune': m0017,
  '0018_peage_routes': m0018,
  '0019_reserve_immobile': m0019,
};
