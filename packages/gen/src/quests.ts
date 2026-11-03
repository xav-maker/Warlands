/** Quêtes de ville : rapporter des trophées de rares (prototype quetes.ts, à l'identique). */
import { Rng, hash } from '@cr/rng';
import type { GenContent } from './content.ts';
import { rareOfTrophy } from './encounters.ts';
import { between, weighted } from './random.ts';

export type QuestReward =
  | { kind: 'equip'; base: string; roll: number }
  | { kind: 'troop'; type: string; level: number }
  | { kind: 'items'; items: [string, number][] };

export interface Quest {
  id: string;
  region: number;
  giver: string;
  title: string;
  text: string;
  needs: [string, number][];
  reward: QuestReward;
  gold: number;
}

/** Points d'un trophée : 2 + rang de l'étape de son rare. */
export function points(c: GenContent, trophy: string): number {
  const r = rareOfTrophy(c, trophy)!;
  return 2 + c.regions[r.region]!.territory.steps.findIndex((s) => s.id === r.step);
}

export function genQuest(c: GenContent, seed: number, region: number, n: number): Quest {
  const R = c.regions;
  const r = new Rng(hash(seed, 'quete', region, n));
  const terr = region > 0 && r.int(10) < 3 ? region - 1 : region;
  const T = R[terr]!.tier;
  const kind = weighted<'equip' | 'troop' | 'items'>(r, [
    ['equip', 40],
    ['troop', 25],
    ['items', 35],
  ])!;
  const pool = c.rares.filter((x) => x.region === terr).map((x) => x.trophy);
  const types: string[] = [];
  const nTypes = r.int(10) < 6 ? 1 : 2;
  while (types.length < nTypes) {
    const t = pool[r.int(pool.length)]!;
    if (!types.includes(t)) types.push(t);
  }
  const target = kind === 'items' ? between(r, 4, 6) : kind === 'equip' ? between(r, 6, 9) : between(r, 9, 12);
  const count: Record<string, number> = Object.fromEntries(types.map((t) => [t, 1]));
  let pts = types.reduce((a, t) => a + points(c, t), 0);
  for (let guard = 0; pts < target && guard < 20; guard++) {
    const t = types[r.int(types.length)]!;
    if (count[t]! >= 4) continue;
    count[t]!++;
    pts += points(c, t);
  }
  const needs = types.map((t): [string, number] => [t, count[t]!]);
  const gold = Math.round(pts * 5 * T * T);
  let reward: QuestReward;
  if (kind === 'equip') {
    const bases = Object.values(c.equip)
      .filter((b) => b.tier === T && b.craft !== false)
      .map((b): [string, number] => [b.id, 1]);
    reward = { kind: 'equip', base: weighted(r, bases)!, roll: between(r, 1250, 1400) };
  } else if (kind === 'troop') {
    const types2 = R.slice(0, terr + 1).flatMap((rg, i) => rg.city.recruit.map((t): [string, number] => [t, i === region ? 1 : 2]));
    reward = { kind: 'troop', type: weighted(r, types2)!, level: R[terr]!.minLevel + 3 };
  } else {
    const all = Object.values(c.items);
    const comps = all.filter((i) => i.kind === 'composant' && i.tier >= Math.min(T + 1, 5) && i.tier <= Math.min(T + 2, 5));
    const cons = all.filter((i) => i.kind === 'consommable' && i.tier <= T + 1 && i.tier >= Math.min(T, 3) - 1 && i.id !== 'onguent');
    const items: [string, number][] = [];
    if (comps.length) items.push([comps[r.int(comps.length)]!.id, between(r, 1, 2)]);
    const c1 = cons[r.int(cons.length)]!.id;
    items.push([c1, between(r, 3, 5)]);
    if (r.int(2)) {
      const c2 = cons[r.int(cons.length)]!.id;
      if (c2 !== c1) items.push([c2, between(r, 2, 4)]);
    }
    if (T >= 4 && r.int(3) === 0) items.push(['onguent', 1]);
    reward = { kind: 'items', items };
  }
  const givers = c.questGivers[region]!;
  const giver = givers[r.int(givers.length)]!;
  const rares = needs.map(([t]) => rareOfTrophy(c, t)!);
  const terrName = R[terr]!.territory.name;
  const title =
    rares.length === 1
      ? [`La traque de ${rares[0]!.name}`, `Prime : ${rares[0]!.name}`, `Le trophée de ${rares[0]!.name}`][r.int(3)]!
      : [`Double prime : ${rares[0]!.name} et ${rares[1]!.name}`, `Chasse en ${terrName}`][r.int(2)]!;
  const pitch = {
    equip: [
      'Rapportez-moi ces trophées et je vous remettrai une pièce comme on n’en forge plus.',
      'J’ai gardé une pièce d’exception pour qui me prouvera sa valeur.',
      'Ces trophées valent bien ce que j’ai de meilleur en réserve.',
    ],
    troop: [
      'Mes meilleurs combattants suivront celui qui aura abattu ces bêtes.',
      'Prouvez votre valeur, et une troupe aguerrie se joindra à vous.',
      'Ceux que je commande ne servent que les plus braves.',
    ],
    items: [
      'Ma réserve est à vous en échange de ces trophées.',
      'J’en ai besoin pour mes préparations : je paierai en nature.',
      'Rapportez-les et vous ne repartirez pas les mains vides.',
    ],
  }[kind];
  const where = [...new Set(rares.map((x) => `${R[x.region]!.territory.steps.find((s) => s.id === x.step)!.name}`))].join(' et ');
  const text = `« ${pitch[r.int(pitch.length)]} » On les croise parfois : ${where}, ${terrName}.`;
  return { id: `q${region}-${n}`, region, giver, title, text, needs, reward, gold };
}
