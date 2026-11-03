/**
 * Contenu lu par les générateurs. C'est la forme du contenu du prototype proto-0.4-ville (ses globales
 * C, ITEMS, EQUIP, MONSTERS, REGIONS, ECO…), réunies en un seul objet passé explicitement : les
 * générateurs ne lisent plus aucun état global. Le pack compilé depuis le YAML aura cette forme (guide 5).
 */
import type { Params, Rule, Skill, Weapon } from '@cr/engine';

export interface Form {
  id: string;
  name: string;
  level: number;
  parent?: string;
  hpMult?: number;
  bonus?: Partial<Record<'will' | 'energy' | 'mana' | 'atk', number>>;
  speed: number;
  res: Record<string, number>;
  tags?: string[];
  /** [capacité, niveau d'apprentissage] */
  skills: [string, number][];
}

export interface StatBlock {
  hp: number;
  will: number;
  energy: number;
  mana: number;
  atk: number;
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
}

export interface Region {
  id: string;
  name: string;
  tier: number;
  minLevel: number;
  firstItem: string;
  guardianLoot: string;
  city: { name: string; recruit: string[]; shop: string[] };
  territory: { name: string; steps: Step[] };
}

export interface Rare {
  id: string;
  region: number;
  step: string;
  base: string;
  name: string;
  trophy: string;
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
  rares: Rare[];
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
}
