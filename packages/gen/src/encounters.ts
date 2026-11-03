/** Rencontres : groupes de monstres, monstres rares (prototype gen.ts et quetes.ts, à l'identique). */
import { Rng, hash } from '@cr/rng';
import type { GenContent, Rare, Step } from './content.ts';
import { between, weighted } from './random.ts';
import { newTroop } from './troops.ts';
import type { MonsterTroop } from './troops.ts';

export interface MonsterSpec {
  level: [number, number];
  pop: [number, number];
  pool: string[];
  forced?: string[];
}

export interface MonsterGroup {
  troops: MonsterTroop[];
}

/**
 * Groupe de monstres d'une étape : les troupes imposées (gardien, rare), puis des tirages dans le pool
 * pondérés par la population, dans un budget de population et 5 emplacements. Le reste du budget monte
 * des niveaux ; une unité sur quatre se décale d'un rang.
 */
export function genMonsters(c: GenContent, spec: MonsterSpec, seed: number): MonsterGroup {
  const r = new Rng(hash(seed, 'monstres'));
  const troops: MonsterTroop[] = [];
  let pop = between(r, spec.pop[0], spec.pop[1]),
    slots = 5;
  const add = (type: string): void => {
    const t = c.troops[type]!;
    const lvl = between(r, spec.level[0], spec.level[1]);
    troops.push(newTroop(c, type, Math.max(1, lvl)));
    pop -= t.pop;
    slots -= t.units;
  };
  for (const f of spec.forced ?? []) add(f);
  for (let guard = 0; guard < 10; guard++) {
    const fit = spec.pool.filter((id) => c.troops[id] && c.troops[id].pop <= pop && c.troops[id].units <= slots);
    if (!fit.length) break;
    add(
      weighted(
        r,
        fit.map((id): [string, number] => [id, c.troops[id]!.pop]),
      )!,
    );
  }
  for (; pop > 0 && troops.length; pop--) {
    const tr = troops[r.int(troops.length)]!;
    const nt = newTroop(c, tr.type, Math.min(c.eco.maxLevel, tr.level + 1));
    Object.assign(tr, { ...nt, units: tr.units });
  }
  for (const tr of troops) for (const u of tr.units) if (r.int(4) === 0) u.dist = Math.max(1, Math.min(3, u.dist + (r.int(2) ? 1 : -1)));
  return { troops };
}

/** Puissance indicative d'un groupe : population × niveau. */
export const groupPower = (c: GenContent, side: MonsterGroup): number =>
  side.troops.reduce((a, t) => a + c.troops[t.type]!.pop * t.level, 0);

export const rareOfStep = (c: GenContent, stepId: string): Rare | null => c.rares.find((r) => r.step === stepId) ?? null;
export const rareOfTrophy = (c: GenContent, trophy: string): Rare | null => c.rares.find((r) => r.trophy === trophy) ?? null;

/** Le rare de l'étape est-il là ? Tirage déterministe par (graine du joueur, clé de sortie, nombre de combats). */
export const rarePresent = (c: GenContent, seed: number, key: string, fights: number): boolean =>
  hash(seed, 'rare', key, fights) % 100 < c.rareChance;

/** Spécification du groupe d'une étape, avec le rare s'il est présent. */
export const stepSpec = (st: Step, rare?: string): MonsterSpec => ({
  level: st.level,
  pop: st.pop,
  pool: st.pool,
  forced: [...(st.forced ?? []), ...(rare ? [rare] : [])],
});
