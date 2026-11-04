/**
 * Donjons (README 23, guide 9.4) : salles numérotées 1, 2, 3…, un boss toutes les `bossEvery` salles, difficulté
 * croissante, butin de salle. Fonctions pures de (contenu, donjon, salle, graine), comme les autres générateurs.
 *
 *   niveau des monstres   = min(plafond, L + bonus + floor((n − 1) / 2))
 *   surpuissance          = au-delà du plafond : PV et puissances × (1 + 6 % par niveau en plus)
 *   population du groupe  = min(base + pas × n, max) (solo : 3 + n, 11 ; duo : 6 + 2n, 22), boss compris
 *   or d'une salle        = goldBase × T² × (1 + n / 4)
 */
import { Rng, hash } from '@cr/rng';
import type { Dungeon, DungeonParams, GenContent, Route } from './content.ts';
import { routes } from './content.ts';
import type { BattleOptions } from './battle.ts';
import type { MonsterSpec } from './encounters.ts';
import { genEquip } from './equip.ts';
import type { Loot, LootItem } from './loot.ts';
import { mergeLoot, rollConsumable } from './loot.ts';
import { between, weighted } from './random.ts';

export function dungeonParams(c: GenContent): DungeonParams {
  if (!c.dungeonParams) throw new Error('contenu sans paramètres de donjon');
  return c.dungeonParams;
}

/** Donjon d'une route, ou null. */
export const dungeonOfRoute = (c: GenContent, routeId: string): Dungeon | null => c.dungeons?.find((d) => d.route === routeId) ?? null;

export function dungeonById(c: GenContent, id: string): Dungeon {
  const d = c.dungeons?.find((x) => x.id === id);
  if (!d) throw new Error(`donjon inconnu ${id}`);
  return d;
}

export function dungeonRoute(c: GenContent, d: Dungeon): Route {
  const r = routes(c).find((x) => x.id === d.route);
  if (!r) throw new Error(`route inconnue ${d.route}`);
  return r;
}

/** Une porte apparaît-elle ? Tirage frais du serveur (`roll` dans [0, 1000[), sur une route à donjon seulement. */
export const doorAppears = (c: GenContent, routeId: string, roll: number): boolean =>
  !!dungeonOfRoute(c, routeId) && roll < dungeonParams(c).doorChance;

/** Boss de la salle n, ou null : salles bossEvery, 2 × bossEvery…, les boss se succèdent puis recommencent. */
export function roomBoss(c: GenContent, d: Dungeon, n: number): string | null {
  const every = dungeonParams(c).bossEvery;
  if (n % every !== 0) return null;
  return d.bosses[(n / every - 1) % d.bosses.length]!;
}

export interface Room {
  n: number;
  /** Niveau des monstres (plafonné). */
  level: number;
  pop: number;
  boss: string | null;
  spec: MonsterSpec;
  /** Options du moteur : renfort du palier, ajustement du boss, surpuissance et réglage du donjon. */
  options: BattleOptions;
  gold: number;
}

/** Salle n d'un donjon, pour une escouade (solo) ou deux (duo). */
export function room(c: GenContent, d: Dungeon, n: number, duo: boolean): Room {
  if (!Number.isInteger(n) || n < 1) throw new Error(`salle invalide ${n}`);
  const P = dungeonParams(c);
  const R = dungeonRoute(c, d);
  const raw = R.minLevel + P.levelBonus + Math.floor((n - 1) / 2);
  const level = Math.min(P.levelCap, raw);
  const over = Math.max(0, raw - P.levelCap);
  const [base, per, max] = duo ? P.pop.duo : P.pop.solo;
  const pop = Math.min(base + per * n, max);
  const boss = roomBoss(c, d, n);
  // Réglages en ‰, multipliés : global, du donjon, surpuissance.
  const mult = Math.round((((P.mult * (d.mult ?? 1e3)) / 1e3) * (1e3 + P.overpower * over)) / 1e3);
  return {
    n,
    level,
    pop,
    boss,
    spec: { level: [level, level], pop: [pop, pop], pool: d.pool, forced: boss ? [boss] : [], slots: duo ? P.slots.duo : P.slots.solo },
    options: { territory: R.tier - 1, guardianStep: boss !== null, guardianAdjust: 'guardian', mult },
    gold: Math.round(P.goldBase * R.tier * R.tier * (1 + n / 4)),
  };
}

/** Matériaux d'un donjon : le sien, puis ceux des étapes de sa route. */
function dungeonMats(c: GenContent, d: Dungeon): string[] {
  const R = dungeonRoute(c, d);
  return [...new Set([d.material, ...R.steps.flatMap((s) => s.mats)])].filter((id) => c.items[id]?.kind === 'materiau');
}

/** Composants laissés par les monstres de la route (le butin de composant d'une salle). */
function dungeonComponents(c: GenContent, d: Dungeon): string[] {
  const R = dungeonRoute(c, d);
  const monsters = R.steps.flatMap((s) => [...s.pool, ...(s.forced ?? [])]);
  return [...new Set(monsters.flatMap((m) => c.monsters[m]?.drops ?? []))].filter((id) => c.items[id]?.kind === 'composant');
}

/** Trophée d'un boss : le trophée parmi son butin. */
export const bossTrophy = (c: GenContent, boss: string): string | null =>
  (c.monsters[boss]?.drops ?? []).find((id) => c.items[id]?.kind === 'trophee') ?? null;

/**
 * Butin d'une salle gagnée, pour un joueur (chacun tire le sien en duo, README 23.3) : or, `draws` tirages sur la
 * table du donjon (matériaux du donjon et de sa route, composants, consommables, équipement au jet renforcé par
 * salle) ; un boss laisse en plus son trophée et un objet unique (uniqueChance %) ou un composant.
 */
export function rollRoomLoot(c: GenContent, d: Dungeon, n: number, seed: number): Loot {
  const P = dungeonParams(c);
  const R = dungeonRoute(c, d);
  const T = R.tier;
  const rm = room(c, d, n, false);
  const r = new Rng(hash(seed, 'butin-donjon'));
  const items: LootItem[] = [];
  const mats = dungeonMats(c, d);
  const comps = dungeonComponents(c, d);
  const equipRoll = (): number =>
    Math.min(P.equipRollCap, Math.floor((between(r, 600, 1400) + between(r, 600, 1400)) / 2) + P.equipRollPerRoom * n);
  const mat = (): void => {
    const id = weighted(
      r,
      mats.map((x): [string, number] => [x, x === d.material ? 3 : c.items[x]!.tier >= T ? 1 : 0.5]),
    )!;
    items.push({ id, qty: between(r, 1, 2) });
  };
  const comp = (): void => {
    if (comps.length) items.push({ id: comps[r.int(comps.length)]!, qty: 1 });
    else mat();
  };
  const equip = (): void => {
    const id = weighted(
      r,
      Object.values(c.equip)
        .filter((b) => b.craft !== false && !b.region && b.tier <= T && b.tier >= T - 1)
        .map((b): [string, number] => [b.id, b.tier === T ? 2 : 1]),
    )!;
    items.push({ equip: genEquip(c, id, r, equipRoll()) });
  };
  for (let i = 0; i < P.draws; i++) {
    const k = weighted(r, Object.entries(P.table));
    if (k === 'materiau') mat();
    else if (k === 'composant') comp();
    else if (k === 'consommable') items.push({ id: rollConsumable(r, T), qty: 1 });
    else equip();
  }
  if (rm.boss) {
    const trophy = bossTrophy(c, rm.boss);
    if (trophy) items.push({ id: trophy, qty: 1 });
    if (d.uniques.length && r.int(100) < P.uniqueChance)
      items.push({ equip: genEquip(c, d.uniques[r.int(d.uniques.length)]!, r, equipRoll()) });
    else comp();
  }
  return { gold: rm.gold, items: mergeLoot(items) };
}
