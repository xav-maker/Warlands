/**
 * Schémas des fichiers de content/ (guide 5.1). Objets stricts : un champ inconnu est une faute de
 * frappe, refusée. Les noms et descriptions ne sont pas ici mais dans texts/fr.yaml.
 */
import { z } from 'zod';

const int = z.number().int();
const num = z.number();
const id = z.string().min(1);
const range2 = z.tuple([int, int]);

export const Rule = z.strictObject({
  cond: id,
  v: num.optional(),
  s: z.string().optional(),
  action: id,
  target: id,
});

export const Fx = z.strictObject({
  k: z.enum(['dmg', 'wdmg', 'drain', 'heal', 'will', 'mana', 'energy', 'stun', 'push', 'pull', 'cleanse', 'state', 'unstate', 'hploss']),
  v: num.optional(),
  dur: int.optional(),
  area: z.enum(['target', 'rank', 'allEnemies', 'front', 'self', 'allies', 'allyRank', 'randomEnemy', 'contact']).optional(),
  type: z.string().optional(),
  s: z.string().optional(),
  cap: int.optional(),
  tag: z.string().optional(),
  tagMult: int.optional(),
  /** Plusieurs étiquettes qui donnent le bonus tagMult (l'une suffit). */
  tags: z.array(z.string()).optional(),
  /** Ignore la moitié des résistances positives de la cible (Estoc perforant). */
  ignoreHalf: z.boolean().optional(),
  ifState: z.string().optional(),
});

export const Skill = z.strictObject({
  kind: z.enum(['active', 'passive', 'reaction']),
  target: z.enum(['enemy', 'ally', 'self']),
  range: int,
  minRange: int.optional(),
  energy: int,
  energyW: int.optional(),
  mana: int,
  durBase: z.enum(['unit', 'weapon']),
  durMult: int,
  p: z.record(z.string(), num),
  attack: z.boolean().optional(),
  melee: z.boolean().optional(),
  dtype: z.string().optional(),
  ai: z.string().optional(),
  fx: z.array(Fx).optional(),
  power: z.enum(['for', 'ele', 'esp', 'foi', 'omb']).optional(),
  coef: int.optional(),
});

export const Weapon = z.strictObject({ type: id, dmg: int, speed: int, cost: int });

/** Stats de base et croissance : l'attaque unique (prototype) ou les 5 puissances (moteur v1, README 19.1). */
const Stats = z
  .strictObject({
    hp: num,
    will: num,
    energy: num,
    mana: num,
    atk: num.optional(),
    for: num.optional(),
    ele: num.optional(),
    esp: num.optional(),
    foi: num.optional(),
    omb: num.optional(),
  })
  .refine((s) => (s.atk !== undefined) !== (['for', 'ele', 'esp', 'foi', 'omb'] as const).every((k) => s[k] !== undefined), {
    message: "l'attaque (atk) ou les 5 puissances (for, ele, esp, foi, omb), pas les deux",
  });
const powerBonus = { for: int.optional(), ele: int.optional(), esp: int.optional(), foi: int.optional(), omb: int.optional() };

export const Form = z.strictObject({
  id,
  level: int,
  parent: id.optional(),
  hpMult: int.optional(),
  bonus: z
    .strictObject({ will: int.optional(), energy: int.optional(), mana: int.optional(), atk: int.optional(), ...powerBonus })
    .optional(),
  speed: int,
  res: z.record(z.string(), int),
  tags: z.array(z.string()).optional(),
  skills: z.array(z.tuple([id, int])),
});

/** Troupe recrutable (avec ses emplacements) ou monstre (avec butin, région, gardien, rare). */
export const Troop = z.strictObject({
  units: int.min(1),
  pop: int.min(1),
  tags: z.array(z.string()),
  weapon: id,
  defaultDist: int.min(1).max(3),
  base: Stats,
  growth: Stats,
  forms: z.array(Form).min(1),
  /** v1 : types de dégâts auxquels le monstre est immunisé (au plus 2, README 19.4). */
  immune: z.array(id).max(2).optional(),
  slots: z.record(z.string(), z.array(z.string())).optional(),
  drops: z.array(id).optional(),
  boss: z.boolean().optional(),
  region: int.optional(),
  rare: z.strictObject({ step: id, trophy: id, base: id }).optional(),
});

export const Item = z.strictObject({
  kind: z.enum(['materiau', 'composant', 'consommable', 'trophee']),
  tier: int.min(1),
  value: num,
  tags: z.array(z.string()),
  effect: z.record(z.string(), num).optional(),
});

export const EquipBase = z.strictObject({
  tier: int.min(1),
  slot: id,
  cat: id,
  value: num,
  tags: z.array(z.string()),
  pool: z.array(z.union([z.tuple([id, num]), z.tuple([id, num, z.string()])])),
  weapon: Weapon.optional(),
  nStats: int.optional(),
  workshop: z.boolean().optional(),
  /** Base signature : fabricable dans l'atelier de cette région seulement (contenu-cible-unites.md 9.2). */
  region: id.optional(),
  craft: z.boolean().optional(),
  /** Budget de stats en ‰ de celui du palier (objets uniques de donjon : 1 250, contenu-cible-unites.md 9.3). */
  budget: int.min(1).optional(),
});

export const Step = z.strictObject({
  id,
  pool: z.array(id),
  mats: z.array(id),
  tier: int.min(1),
  gold: int,
  level: range2,
  pop: range2,
  draws: range2,
  guardian: z.boolean().optional(),
  forced: z.array(id).optional(),
  /** Réglage fin de la difficulté de l'étape : PV et attaque des monstres × mult / 1 000 (défaut : 1 000, inchangé). */
  mult: int.min(1).optional(),
});

/** Région : sa ville ; dans le prototype, aussi son territoire (route vers la région suivante) et son gardien. */
export const Region = z.strictObject({
  id,
  tier: int.min(1),
  minLevel: int.min(1),
  firstItem: id.optional(),
  guardianLoot: id.optional(),
  /** troops : troupes vendues par le marchand de la ville, avec leur prix en or. */
  city: z.strictObject({ recruit: z.array(id), shop: z.array(id), troops: z.array(z.tuple([id, int.min(1)])).optional() }),
  territory: z.strictObject({ steps: z.array(Step).min(1) }).optional(),
});

/** Route du monde en graphe (README 18.1) : 5 étapes entre deux régions, gardien au bout. */
export const Route = z.strictObject({
  id,
  from: id,
  to: id,
  tier: int.min(1),
  minLevel: int.min(1),
  firstItem: id,
  guardianLoot: id,
  steps: z.array(Step).min(1),
});

/** Rare : index du territoire (prototype, `region`) ou identifiant de route (graphe, `route`). */
export const Rare = z.strictObject({ id, region: int.optional(), route: id.optional(), step: id, base: id, trophy: id });

/** Donjon d'une route (README 23) : pool des salles, 3 boss qui se succèdent, matériau propre, objets uniques. */
export const Dungeon = z.strictObject({
  id,
  route: id,
  pool: z.array(id).min(1),
  bosses: z.array(id).min(1),
  material: id,
  uniques: z.array(id),
  /** Réglage fin de la difficulté du donjon, en ‰ (défaut 1 000). */
  mult: int.min(1).optional(),
});

const popRule = z.tuple([int.min(1), int.min(0), int.min(1)]);

export const Params = z.strictObject({
  engine: z.record(z.string(), num),
  eco: z.looseObject({
    maxLevel: int,
    monsterHp: z.array(int),
    monsterAtk: z.array(int),
    guardianAdj: z.array(int),
    table: z.record(z.string(), num),
    guardianTable: z.record(z.string(), num),
    craftGoldPerTier: num,
    recruitGoldPerPop: num,
  }),
  // energy : multiplicateur propre à la jauge d'énergie, résultat arrondi à l'entier inférieur (absent : mult).
  gauges: z.strictObject({ mult: int, energy: num.optional() }),
  items: z.strictObject({
    boost: int,
    tierBudget: z.record(z.string(), int),
    tierNStats: z.record(z.string(), int),
    tierLevel: z.record(z.string(), int),
    statCost: z.record(z.string(), z.strictObject({ per: num, unit: z.string().optional() })),
  }),
  recipes: z.strictObject({
    craftConsumables: z.array(id),
    consumableTags: z.record(z.string(), z.array(z.string())),
    consumableValueMult: num,
    recruitValue: z.array(num),
  }),
  rares: z.strictObject({ chance: int, minWins: int }),
  online: z.strictObject({
    engineVersion: id,
    guardianAdjust: z.enum(['all', 'guardian']),
    squad: z.strictObject({ maxUnits: int.min(1), maxPop: int.min(1) }),
    // Réserve (README 29) : troupes qui ne combattent pas mais reçoivent l'XP ; xpShare : part de l'XP d'une troupe qui
    // combat, en ‰.
    reserve: z
      .strictObject({ maxUnits: int.min(1), maxPop: int.min(1), xpShare: int.min(0).max(1000) })
      .default({ maxUnits: 5, maxPop: 8, xpShare: 1000 }),
    encounters: z.strictObject({ popMult: num.positive(), slots: int.min(1) }),
    stack: z.record(z.string(), int.min(1)),
    watch: z.strictObject({ instantsPerSecond: int.min(1) }),
    // Péage d'une route : or payé à chaque départ de ville et à chaque retour à l'étape précédente (0 : gratuit).
    routeToll: int.min(0).default(0),
    // Chat et messages privés (README 25) : longueur maximale et mots masqués par le filtre.
    chat: z.strictObject({ maxLength: int.min(1).max(300), bannedWords: z.array(z.string().min(2)) }),
  }),
  // Donjons (README 23, guide 9) ; facultatif tant que le monde n'a pas de donjon.
  dungeons: z
    .strictObject({
      doorChance: int.min(0).max(1000),
      bossEvery: int.min(1),
      levelBonus: int,
      levelCap: int.min(1),
      overpower: int.min(0),
      pop: z.strictObject({ solo: popRule, duo: popRule }),
      slots: z.strictObject({ solo: int.min(1), duo: int.min(1) }),
      goldBase: int.min(0),
      draws: int.min(0),
      table: z.record(z.string(), num),
      equipRollPerRoom: int.min(0),
      equipRollCap: int.min(600),
      uniqueChance: int.min(0).max(100),
      mult: int.min(1),
      inviteSeconds: int.min(1),
      idleMinutes: int.min(1),
      randomInvites: int.min(1),
    })
    .optional(),
});

export const PackFile = z.strictObject({
  id,
  engineVersion: id,
  files: z.strictObject({
    skills: z.array(z.string()).min(1),
    troops: z.array(z.string()).min(1),
    items: z.array(z.string()).min(1),
    equip: z.array(z.string()).min(1),
  }),
});

/** Fichiers à nom fixe qui peuvent manquer (le prototype n'a pas de routes). */
export const OPTIONAL_FILES = new Set(['world/routes.yaml', 'world/dungeons.yaml']);

/** Schéma de chaque fichier à nom fixe, et des fichiers listés dans pack.yaml par collection. */
export const FIXED = {
  'pack.yaml': PackFile,
  'params.yaml': Params,
  'damage-types.yaml': z.strictObject({ types: z.array(id).min(1) }),
  'weapons.yaml': z.record(id, Weapon),
  'strategies.yaml': z.record(id, z.array(Rule)),
  'world/regions.yaml': z.array(Region).min(1),
  'world/rares.yaml': z.array(Rare),
  'world/routes.yaml': z.array(Route),
  'world/dungeons.yaml': z.array(Dungeon),
  'quests.yaml': z.strictObject({ givers: z.array(z.array(z.string())) }),
  'texts/fr.yaml': z.record(z.string(), z.string()),
} as const;

export const COLLECTION = {
  skills: z.record(id, Skill),
  troops: z.record(id, Troop),
  items: z.record(id, Item),
  equip: z.record(id, EquipBase),
} as const;

export type RuleT = z.infer<typeof Rule>;
export type SkillT = z.infer<typeof Skill>;
export type TroopT = z.infer<typeof Troop>;
export type ItemT = z.infer<typeof Item>;
export type EquipBaseT = z.infer<typeof EquipBase>;
export type RegionT = z.infer<typeof Region>;
export type RareT = z.infer<typeof Rare>;
export type RouteT = z.infer<typeof Route>;
export type DungeonT = z.infer<typeof Dungeon>;
export type ParamsT = z.infer<typeof Params>;
export type PackFileT = z.infer<typeof PackFile>;
