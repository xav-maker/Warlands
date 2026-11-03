/**
 * Recettes personnelles (README 8.5) et matériaux réservés à l'échange (prototype gen.ts, à l'identique).
 * Chaque joueur a ses propres recettes, tirées de sa graine : ce qui pousse aux échanges entre joueurs.
 */
import { Rng, hash } from '@cr/rng';
import type { GenContent, Item } from './content.ts';
import { between, weighted } from './random.ts';
import { recruitRegion } from './troops.ts';

export interface RecipeSpec {
  out: string;
  kind: 'equip' | 'consommable' | 'recrue';
  tier: number;
  tags: string[];
  /** Valeur visée des ingrédients. */
  target: number;
  /** Nombre d'ingrédients distincts [min, max]. */
  n: [number, number];
  gold: number;
  /** Un composant fait partie de la recette (équipement de palier 3 et plus). */
  comp?: boolean;
}

export interface Recipe {
  out: string;
  kind: RecipeSpec['kind'];
  ingredients: [string, number][];
  gold: number;
  budget: number;
}

export function recipeSpecs(c: GenContent): RecipeSpec[] {
  const specs: RecipeSpec[] = [];
  for (const b of Object.values(c.equip)) {
    if (b.craft === false) continue;
    specs.push({
      out: b.id,
      kind: 'equip',
      tier: b.tier,
      tags: b.tags,
      target: Math.round(b.value * 0.7),
      n: b.tier === 1 ? [2, 3] : [3, 4],
      gold: c.eco.craftGoldPerTier * b.tier * b.tier,
      comp: b.tier >= 3,
    });
  }
  for (const id of c.craftConsumables) {
    const it = c.items[id]!;
    specs.push({
      out: id,
      kind: 'consommable',
      tier: it.tier,
      tags: c.consumableTags[id] ?? [],
      target: Math.max(4, Math.round(it.value * c.consumableValueMult)),
      n: [2, 2],
      gold: 0,
    });
  }
  for (const [id, t] of Object.entries(c.troops)) {
    if (c.monsters[id]) continue;
    const reg = recruitRegion(c, id);
    if (reg < 0) continue;
    const tier = Math.max(reg + 1, t.pop >= 3 && reg === 0 ? 2 : 1);
    specs.push({
      out: id,
      kind: 'recrue',
      tier,
      tags: t.tags,
      target: Math.round(14 * t.pop * c.recruitValue[reg + 1]!),
      n: tier === 1 ? [2, 3] : [3, 4],
      gold: c.eco.recruitGoldPerPop * t.pop * (reg + 1),
    });
  }
  return specs;
}

export function genRecipes(c: GenContent, playerSeed: number): Record<string, Recipe> {
  const out: Record<string, Recipe> = {};
  const usage: Record<string, number> = {};
  const banned = tradeOnly(c, playerSeed);
  const items = Object.values(c.items);
  for (const sp of recipeSpecs(c)) {
    const r = new Rng(hash(playerSeed, 'recette', sp.out));
    const pool = items.filter((i) => i.kind === 'materiau' && i.tier <= sp.tier && !banned.includes(i.id));
    const comps = items.filter((i) => i.kind === 'composant' && i.tier <= sp.tier && i.tier >= sp.tier - 1 && i.value <= sp.target * 0.4);
    const comp: Item | null = sp.comp && comps.length ? comps[r.int(comps.length)]! : null;
    const target = sp.target - (comp?.value ?? 0);
    const lo = Math.floor(target * 0.9),
      hi = Math.ceil(target * 1.1);
    let best: { picked: string[]; qty: number[]; val: number } | null = null;
    for (let attempt = 0; attempt < 12; attempt++) {
      const n = between(r, sp.n[0], sp.n[1]);
      const picked: string[] = [];
      const top = (id: string): boolean => c.items[id]!.tier >= sp.tier;
      while (picked.length < n) {
        const cand = pool.filter((i) => !picked.includes(i.id) && (sp.tier < 2 || picked.length < n - 1 || picked.some(top) || top(i.id)));
        const id = weighted(
          r,
          cand.map((i): [string, number] => [i.id, (i.tags.some((t) => sp.tags.includes(t)) ? 3 : 1) / (1 + 1.5 * (usage[i.id] ?? 0))]),
        );
        if (!id) break;
        picked.push(id);
      }
      const qty = picked.map(() => 1);
      const val = (): number => picked.reduce((a, id, i) => a + c.items[id]!.value * qty[i]!, 0);
      for (let guard = 0; val() < lo && guard < 200; guard++) {
        const fits = picked.map((_, i) => i).filter((i) => val() + c.items[picked[i]!]!.value <= hi);
        if (!fits.length) break;
        qty[fits[r.int(fits.length)]!]!++;
      }
      const v = val();
      if (!best || Math.abs(v - target) < Math.abs(best.val - target)) best = { picked, qty, val: v };
      if (v >= lo && v <= hi) break;
    }
    const b = best!;
    b.picked.forEach((id) => (usage[id] = (usage[id] ?? 0) + 1));
    const ings: [string, number][] = b.picked.map((id, i) => [id, b.qty[i]!]);
    if (comp) ings.push([comp.id, 1]);
    out[sp.out] = { out: sp.out, kind: sp.kind, ingredients: ings, gold: sp.gold, budget: b.val + (comp?.value ?? 0) };
  }
  return out;
}

/** Matériaux qu'un joueur ne trouve jamais lui-même : 3 de palier 1, puis 1 par palier. */
export function tradeOnly(c: GenContent, playerSeed: number): string[] {
  const r = new Rng(hash(playerSeed, 'echange'));
  const out: string[] = [];
  for (const [tier, n] of [
    [1, 3],
    [2, 1],
    [3, 1],
    [4, 1],
    [5, 1],
  ] as const) {
    const list = Object.values(c.items)
      .filter((i) => i.kind === 'materiau' && i.tier === tier)
      .map((i) => i.id);
    for (let k = 0; k < n; k++) {
      const left = list.filter((x) => !out.includes(x));
      out.push(left[r.int(left.length)]!);
    }
  }
  return out;
}
