/** Types de l'entrée et du journal du moteur (proto-0.4-ville). Toutes les valeurs sont entières ; les taux sont en ‰. */

export type Side = 0 | 1;

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
  dtype?: string;
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
  atk: number;
  speed: number;
  res: Record<string, number>;
  weapon: Weapon;
  hp: number;
  mana: number;
  dist: number;
  skills: string[];
  rules: Rule[];
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
