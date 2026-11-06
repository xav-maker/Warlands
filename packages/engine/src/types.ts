/** Types de l'entrée et du journal du moteur (proto-0.4-ville). Toutes les valeurs sont entières ; les taux sont en ‰. */

export type Side = 0 | 1;

/** Les 5 puissances du moteur v1 (README 19.1). */
export type Power = 'for' | 'ele' | 'esp' | 'foi' | 'omb';
export const POWERS: readonly Power[] = ['for', 'ele', 'esp', 'foi', 'omb'];
export type Powers = Record<Power, number>;

export interface Weapon {
  name?: string;
  type: string;
  dmg: number;
  speed: number;
  cost: number;
}

/** Règle « si condition, alors action sur cible » (README 7). */
export interface Rule {
  cond: string;
  v?: number;
  s?: string;
  action: string;
  target: string;
}

/** Effet déclaratif d'une capacité sans code dédié. */
export interface Fx {
  k: string;
  v?: number;
  dur?: number;
  area?: string;
  type?: string;
  s?: string;
  cap?: number;
  tag?: string;
  tagMult?: number;
  /** Étiquettes donnant le bonus tagMult (l'une suffit). */
  tags?: string[];
  /** Ignore la moitié des résistances positives (Estoc perforant). */
  ignoreHalf?: boolean;
  ifState?: string;
}

export interface Skill {
  name: string;
  kind: string;
  target: string;
  range: number;
  minRange?: number;
  energy: number;
  energyW?: number;
  mana: number;
  durBase: string;
  durMult: number;
  p: Record<string, number>;
  attack?: boolean;
  melee?: boolean;
  /** Type de dégâts ; `weapon` (ou absent pour une capacité d'arme) : celui de l'arme. */
  dtype?: string;
  /** v1 : puissance utilisée (README 19.1). Absente : déduite du type de dégâts (voir `powerOf`). */
  power?: Power;
  /** v1 : coefficient de la puissance, en ‰ (défaut 1 000). */
  coef?: number;
  ai?: string;
  fx?: Fx[];
  desc?: string;
}

export interface Params {
  timeLimit: number;
  tick: number;
  waitRegen: number;
  waitManaRegen?: number;
  woundWill: number;
  allyDeathWill: number;
  sameTroopDeathWill: number;
  killWill: number;
  hasteMod: number;
  slowMod: number;
  resCap: number;
  resFloor: number;
  moveMult: number;
  fleeMult: number;
  manaSkipsRule?: number;
  stallTime: number;
  dotTick?: number;
  healMult?: number;
  healCooldown?: number;
  hotCooldown?: number;
  /** v2 : seuil d'épuisement, en ‰ de l'énergie max (absent ou 0 : pas d'épuisement). */
  exhaustAt?: number;
  /** v2 : durée d'une capacité lancée épuisé, en ‰ de sa durée normale. */
  exhaustMod?: number;
}

export interface UnitInput {
  id: string;
  side: Side;
  slot: number;
  troop: string;
  kind: string;
  name: string;
  tags: string[];
  hpMax: number;
  willMax: number;
  energyMax: number;
  manaMax: number;
  /** Attaque unique, jusqu'à proto-0.4.2. */
  atk?: number;
  /** v1 : les 5 puissances (remplacent `atk`). */
  pow?: Powers;
  /** v1 : types de dégâts auxquels l'unité est immunisée (monstres seulement, au plus 2 ; README 19.4). */
  immune?: string[];
  /** Joueur qui possède l'unité (camp de 16 en duo). Rendu tel quel dans le résultat. */
  owner?: string;
  speed: number;
  res: Record<string, number>;
  weapon: Weapon;
  hp: number;
  mana: number;
  dist: number;
  skills: string[];
  rules: Rule[];
  /**
   * Unité immobile (README 29.1) : elle ne se déplace jamais d'elle-même (ni Avancer, ni Reculer, ni approche
   * automatique, ni capacité qui la déplace) ; seuls les effets d'autrui (repousser, grappin…) la bougent.
   */
  hold?: boolean;
}

export interface BattleInput {
  engineVersion?: string;
  params: Params;
  skills: Record<string, Skill>;
  units: UnitInput[];
}

/** Événement du journal. `k` donne la sorte ; `t` l'instant. La forme exacte est celle du prototype. */
export interface LogEvent {
  k: string;
  t?: number;
  [field: string]: unknown;
}

export interface UnitResult {
  id: string;
  owner?: string;
  hp: number;
  mana: number;
  dead: boolean;
  fled: boolean;
  dmgDealt: number;
  kills: number;
}

export interface BattleResult {
  winner: Side | null;
  reason: 'wipe' | 'timeout';
  time: number;
  units: UnitResult[];
}

export interface BattleOutput {
  log: LogEvent[];
  result: BattleResult;
}
