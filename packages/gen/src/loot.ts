/** Butin d'un combat gagné (prototype gen.ts, à l'identique). */
import { Rng, hash } from '@cr/rng';
import type { GenContent, Step } from './content.ts';
import { genEquip } from './equip.ts';
import type { EquipInstance } from './equip.ts';
import { between, weighted } from './random.ts';

export interface GuardianLoot {
  /** Première victoire contre ce gardien : l'objet de première victoire s'ajoute. */
  first: boolean;
  firstItem: string;
  /** Base d'équipement propre au gardien. */
  loot: string;
}

export type LootItem = { id: string; qty: number } | { equip: EquipInstance };

export interface Loot {
  gold: number;
  items: LootItem[];
}

/** Consommable du butin d'un combat de palier T (prototype gen.ts). */
export function rollConsumable(r: Rng, T: number): string {
  return weighted<string>(r, [
    ['bandage', T <= 2 ? 3 : 1],
    ['potion_mineure', T <= 2 ? 3 : 1],
    ['potion_mana', 2],
    ['potion_soin', T >= 2 ? 2 : 0.5],
    ['potion_mana_normale', T >= 2 ? 1.5 : 0],
    ['potion_majeure', T >= 3 ? 2 : 0],
    ['tonique', T >= 3 ? 1.5 : 0],
    ['onguent', T >= 5 ? 0.5 : 0],
  ])!;
}

/** Fusionne les piles d'un même objet. */
export function mergeLoot(items: LootItem[]): LootItem[] {
  const merged: LootItem[] = [];
  for (const it of items) {
    if ('id' in it) {
      const m = merged.find((x): x is { id: string; qty: number } => 'id' in x && x.id === it.id);
      if (m) {
        m.qty += it.qty;
        continue;
      }
    }
    merged.push(it);
  }
  return merged;
}

export function rollLoot(c: GenContent, step: Step, monsterTypes: string[], seed: number, guardian: GuardianLoot | null): Loot {
  const r = new Rng(hash(seed, 'butin'));
  const gold = Math.round((step.gold * (80 + r.int(41))) / 100);
  const items: LootItem[] = [];
  const drops = (m: string): string[] => c.monsters[m]?.drops ?? [];
  const dropMats = [...new Set([...step.mats, ...monsterTypes.flatMap(drops)])].filter((id) => c.items[id]?.kind === 'materiau');
  const comps = [...new Set(monsterTypes.flatMap(drops))].filter((id) => c.items[id]?.kind === 'composant');
  const T = step.tier;
  const mat2 = (rare = false): void => {
    const list = dropMats.filter((id2) => !rare || c.items[id2]!.tier >= T);
    const src = list.length ? list : dropMats;
    const id = weighted(
      r,
      src.map((x): [string, number] => [x, c.items[x]!.tier > T ? 0.3 : c.items[x]!.tier < T ? 0.5 : 1]),
    )!;
    items.push({ id, qty: c.items[id]!.tier >= T ? between(r, 1, 2) : between(r, 1, 3) });
  };
  const equip2 = (fromGuardian = false): void => {
    const id =
      fromGuardian && guardian && r.int(2) === 0
        ? guardian.loot
        : weighted(
            r,
            Object.values(c.equip)
              .filter((b) => b.craft !== false && b.tier <= T && b.tier >= T - 1)
              .map((b): [string, number] => [b.id, b.tier === T ? 2 : 1]),
          )!;
    items.push({ equip: genEquip(c, id, r) });
  };
  const comp = (): void => {
    if (comps.length) items.push({ id: comps[r.int(comps.length)]!, qty: 1 });
    else mat2(true);
  };
  const cons = (): void => void items.push({ id: rollConsumable(r, T), qty: 1 });
  const draws = between(r, step.draws[0], step.draws[1]);
  for (let i = 0; i < draws; i++) {
    const k = weighted(r, Object.entries(c.eco.table));
    if (k === 'materiau') mat2();
    else if (k === 'composant') comp();
    else if (k === 'consommable') cons();
    else equip2();
  }
  if (step.guardian && guardian) {
    const k = weighted(r, Object.entries(c.eco.guardianTable));
    if (k === 'composant') comp();
    else if (k === 'equipement') equip2(true);
    else mat2(true);
    if (guardian.first) items.push({ id: guardian.firstItem, qty: 1 });
  }
  return { gold, items: mergeLoot(items) };
}
