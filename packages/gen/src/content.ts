/**
 * Contenu lu par les générateurs. C'est la forme du contenu du prototype proto-0.4-ville (ses globales
 * C, ITEMS, EQUIP, MONSTERS, REGIONS, ECO…), réunies en un seul objet passé explicitement : les
 * générateurs ne lisent plus aucun état global. Le pack compilé depuis le YAML aura cette forme (guide 5).
 */
import type { Params, Power, Rule, Skill, Weapon } from '@cr/engine';

export interface Form {
  id: string;
  name: string;
  level: number;
  parent?: string;
  hpMult?: number;
  bonus?: Partial<Record<'will' | 'energy' | 'mana' | 'atk' | Power, number>>;
  speed: number;
  res: Record<string, number>;
  tags?: string[];
  /** [capacité, niveau d'apprentissage] */
  skills: [string, number][];
}

/** Attaque unique (prototype) ou 5 puissances (moteur v1). */
export interface StatBlock extends Partial<Record<Power, number>> {
  hp: number;
  will: number;
  energy: number;
  mana: number;
  atk?: number;
}

export interface TroopDef {
  name: string;
  units: number;
  pop: number;
  tags: string[];
  role?: string;
  weapon: string;
  defaultDist: number;
  base: StatBlock;
  growth: StatBlock;
  forms: Form[];
  rules: Rule[];
  /** v1 : immunités (monstres). */
  immune?: string[];
}

export interface MonsterMeta {
  drops?: string[];
  boss?: boolean;
  region?: number;
  rare?: { step: string; trophy: string; base: string };
}

export interface Item {
  id: string;
  name: string;
  kind: 'materiau' | 'composant' | 'consommable' | 'trophee';
  tier: number;
  value: number;
  tags: string[];
}

/** [stat, poids, type de résistance imposé] */
export type PoolEntry = [string, number, string?];

export interface EquipBase {
  id: string;
  name: string;
  tier: number;
  slot: string;
  cat: string;
  value: number;
  tags: string[];
  pool: PoolEntry[];
  nStats?: number;
  craft?: boolean;
  workshop?: boolean;
  /** Base signature : atelier de cette région seulement. */
  region?: string;
  /** Budget de stats en ‰ de celui du palier (objets uniques de donjon : 1 250). */
  budget?: number;
  weapon?: Weapon;
}

export interface Step {
  id: string;
  name: string;
  pool: string[];
  mats: string[];
  tier: number;
  gold: number;
  level: [number, number];
  pop: [number, number];
  draws: [number, number];
  guardian?: boolean;
  forced?: string[];
  /** Réglage fin de la difficulté : PV et attaque des monstres de l'étape × mult / 1 000 (défaut 1 000). */
  mult?: number;
}

export interface Region {
  id: string;
  name: string;
  tier: number;
  minLevel: number;
  /** Prototype : la région porte son territoire et son gardien. Monde en graphe : dans les routes. */
  firstItem?: string;
  guardianLoot?: string;
  city: { name: string; desc?: string; recruit: string[]; shop: string[]; troops?: [string, number][] };
  territory?: { name: string; desc?: string; steps: Step[] };
}

/**
 * Route : 5 étapes entre deux régions, gardien au bout (README 18.1). Dans le prototype, le territoire de la
 * région i relie la ville i à la ville i+1 (cul-de-sac pour la dernière) : voir `routes`.
 */
export interface Route {
  id: string;
  name: string;
  desc?: string;
  /** Palier : le plus petit des paliers des deux régions (README 18.2). */
  tier: number;
  minLevel: number;
  from: string;
  /** null : cul-de-sac (dernier territoire du prototype). */
  to: string | null;
  firstItem: string;
  guardianLoot: string;
  steps: Step[];
}

export interface Rare {
  id: string;
  /** Index de la route (du territoire, dans le prototype) où il apparaît. */
  region: number;
  step: string;
  base: string;
  name: string;
  trophy: string;
}

/** Donjon d'une route (README 23). */
export interface Dungeon {
  id: string;
  name: string;
  desc?: string;
  route: string;
  /** Monstres spéciaux des salles. */
  pool: string[];
  /** Boss des salles 4, 8, 12, puis de nouveau dans l'ordre. */
  bosses: string[];
  material: string;
  /** Bases d'équipement non fabricables, butin de boss. */
  uniques: string[];
  /** Réglage fin de la difficulté, en ‰. */
  mult?: number;
}

/** Paramètres des donjons (params.yaml › dungeons). */
export interface DungeonParams {
  /** ‰ à chaque changement d'étape d'une route à donjon. */
  doorChance: number;
  bossEvery: number;
  levelBonus: number;
  levelCap: number;
  /** ‰ de PV et puissances par niveau au-delà du plafond. */
  overpower: number;
  /** [base, pas par salle, plafond] de la population du groupe. */
  pop: { solo: [number, number, number]; duo: [number, number, number] };
  slots: { solo: number; duo: number };
  goldBase: number;
  draws: number;
  table: Record<string, number>;
  equipRollPerRoom: number;
  equipRollCap: number;
  uniqueChance: number;
  mult: number;
  inviteSeconds: number;
  idleMinutes: number;
  randomInvites: number;
}

export interface Eco {
  maxLevel: number;
  monsterHp: number[];
  monsterAtk: number[];
  guardianAdj: number[];
  table: Record<string, number>;
  guardianTable: Record<string, number>;
  craftGoldPerTier: number;
  recruitGoldPerPop: number;
  [key: string]: unknown;
}

export interface GenContent {
  params: Params;
  weapons: Record<string, Weapon>;
  skills: Record<string, Skill>;
  troops: Record<string, TroopDef>;
  monsters: Record<string, MonsterMeta>;
  items: Record<string, Item>;
  equip: Record<string, EquipBase>;
  regions: Region[];
  /** Monde en graphe (README 18) ; absent du prototype, dont les territoires sont dans les régions. */
  routes?: Route[];
  rares: Rare[];
  /** Donjons (README 23) ; absents du prototype. */
  dungeons?: Dungeon[];
  dungeonParams?: DungeonParams;
  eco: Eco;
  statCost: Record<string, { per: number; label: string; unit?: string }>;
  tierBudget: Record<number, number>;
  tierNStats: Record<number, number>;
  tierLevel: Record<number, number>;
  troopSlots: Record<string, Record<string, string[]>>;
  craftConsumables: string[];
  consumableTags: Record<string, string[]>;
  consumableValueMult: number;
  /** Valeur de recrutement par palier de région (index 0 inutilisé). */
  recruitValue: number[];
  itemBoost: number;
  gaugeMult: number;
  rareChance: number;
  rareMinWins: number;
  questGivers: string[][];
  dmgTypes: string[];
  /** Règles du jeu en ligne (params.yaml › online) ; absentes du contenu du prototype. */
  online?: OnlineRules;
}

export interface OnlineRules {
  engineVersion: string;
  guardianAdjust: 'all' | 'guardian';
  squad: { maxUnits: number; maxPop: number };
  encounters: { popMult: number; slots: number };
  stack: Record<string, number>;
  watch: { instantsPerSecond: number };
  /** Or payé à chaque départ de ville et à chaque retour à l'étape précédente (0 : gratuit). */
  routeToll: number;
  chat: { maxLength: number; bannedWords: string[] };
}

const derived = new WeakMap<GenContent, Route[]>();

/** Routes du contenu : celles du graphe, ou les territoires du prototype, en ligne droite. */
export function routes(c: GenContent): Route[] {
  if (c.routes) return c.routes;
  let r = derived.get(c);
  if (!r) {
    r = c.regions.map((R, i) => ({
      id: R.id,
      name: R.territory!.name,
      ...(R.territory!.desc !== undefined ? { desc: R.territory!.desc } : {}),
      tier: R.tier,
      minLevel: R.minLevel,
      from: R.id,
      to: c.regions[i + 1]?.id ?? null,
      firstItem: R.firstItem!,
      guardianLoot: R.guardianLoot!,
      steps: R.territory!.steps,
    }));
    derived.set(c, r);
  }
  return r;
}
