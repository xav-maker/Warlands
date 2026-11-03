/** Exemplaires d'équipement (prototype gen.ts, à l'identique). */
import type { Rng } from '@cr/rng';
import type { GenContent } from './content.ts';
import { between, uid, weighted } from './random.ts';

export interface ItemStat {
  k: string;
  v: number;
  type?: string;
}

export interface EquipInstance {
  uid: string;
  base: string;
  /** Qualité du tirage, en ‰ (600 à 1 400, moyenne de deux tirages). */
  roll: number;
  stats: ItemStat[];
}

export const quality = (roll: number): string => (roll < 850 ? 'médiocre' : roll < 1050 ? 'correct' : roll < 1200 ? 'bon' : 'excellent');

/** Tire un exemplaire d'une base : stats choisies dans son pool, budget du palier modulé par la qualité. */
export function genEquip(c: GenContent, baseId: string, r: Rng, fixedRoll?: number): EquipInstance {
  const b = c.equip[baseId]!;
  const n = Math.min(b.nStats ?? c.tierNStats[b.tier]!, b.pool.length);
  const roll = fixedRoll ?? Math.floor((between(r, 600, 1400) + between(r, 600, 1400)) / 2);
  const pool = b.pool.map((p, i): [number, number] => [i, p[1]]);
  const chosen: number[] = [];
  while (chosen.length < n) {
    const i = weighted(
      r,
      pool.filter(([j]) => !chosen.includes(j)),
    )!;
    chosen.push(i);
  }
  const budget = Math.max(n, Math.floor((c.tierBudget[b.tier]! * roll) / 1e3));
  const w = chosen.map(() => 1 + r.int(100));
  const wt = w.reduce((a, x) => a + x, 0);
  const free = 1e3 - 150 * n;
  const shares = w.map((x) => 150 + Math.floor((free * x) / wt));
  const usedTypes = new Set<string>();
  const stats = chosen.map((i, j): ItemStat => {
    const [k, , forced] = b.pool[i]!;
    const pts = Math.floor((budget * shares[j]!) / 1e3);
    let v = Math.max(1, Math.floor(pts * c.statCost[k]!.per));
    if (k === 'wspeed') v = Math.min(3, v);
    const s: ItemStat = { k, v };
    if (k === 'res') {
      let ty = forced;
      if (!ty || usedTypes.has(ty)) {
        const left = c.dmgTypes.filter((t) => !usedTypes.has(t));
        ty = left[r.int(left.length)];
      }
      usedTypes.add(ty!);
      s.type = ty!;
    }
    return s;
  });
  const merged: ItemStat[] = [];
  for (const s of stats) {
    const m = merged.find((x) => x.k === s.k && x.type === s.type);
    if (m) m.v += s.v;
    else merged.push(s);
  }
  return { uid: uid(r), base: baseId, roll, stats: merged };
}

export const itemValue = (c: GenContent, i: EquipInstance): number => Math.round((c.equip[i.base]!.value * i.roll) / 1e3);

/** Une troupe peut-elle porter cette base ? null si oui, sinon la raison. */
export function canWear(c: GenContent, type: string, level: number, baseId: string): string | null {
  const b = c.equip[baseId]!;
  const ok = c.troopSlots[type]?.[b.slot];
  if (!ok || !ok.includes(b.cat)) return 'catégorie non acceptée';
  const req = c.tierLevel[b.tier] ?? 1;
  if (level < req) return `niveau ${req} requis`;
  return null;
}
