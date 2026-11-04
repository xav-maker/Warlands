/**
 * Quêtes de ville : rapporter des trophées de rares (prototype quetes.ts, à l'identique), et, dans les villes reliées
 * à une route à donjon, des trophées de boss de donjon (README 23.7).
 */
import { Rng, hash } from '@cr/rng';
import { routes } from './content.ts';
import type { GenContent } from './content.ts';
import { rareOfTrophy } from './encounters.ts';
import { between, weighted } from './random.ts';
import { bossTrophy } from './dungeon.ts';

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
  /** Quête de donjon : le donjon dont un boss laisse le trophée demandé. */
  dungeon?: string;
}

/** Points d'un trophée : 2 + rang de l'étape de son rare. */
export function points(c: GenContent, trophy: string): number {
  const r = rareOfTrophy(c, trophy)!;
  return 2 + routes(c)[r.region]!.steps.findIndex((s) => s.id === r.step);
}

/** Récompense d'une quête « équipement » ou « troupe », pour une route `terr` (prototype quetes.ts). */
function rewardOf(c: GenContent, r: Rng, kind: 'equip' | 'troop', terr: number, region: number): QuestReward {
  const R = c.regions;
  const RT = routes(c);
  const T = RT[terr]!.tier;
  if (kind === 'equip') {
    const bases = Object.values(c.equip)
      .filter((b) => b.tier === T && b.craft !== false)
      .map((b): [string, number] => [b.id, 1]);
    return { kind: 'equip', base: weighted(r, bases)!, roll: between(r, 1250, 1400) };
  }
  // Villes 1 à T (prototype : jusqu'à la région du territoire ; graphe : les villes de palier ≤ T).
  const cities = c.routes ? R.filter((rg) => rg.tier <= T) : R.slice(0, terr + 1);
  const types2 = cities.flatMap((rg) => rg.city.recruit.map((t): [string, number] => [t, rg === R[region] ? 1 : 2]));
  return { kind: 'troop', type: weighted(r, types2)!, level: RT[terr]!.minLevel + 3 };
}

/** Part des quêtes des villes reliées à une route à donjon qui demandent un trophée de boss (README 23.7 [H]). */
export const DUNGEON_QUEST_PERCENT = 20;

/**
 * Quête de donjon (README 23.7) : 1 trophée d'un boss tiré parmi les 3 du donjon d'une route de la ville ; récompense
 * tirée comme une quête « troupe » ou « équipement », prime d'or × 2. Tirage à part (`quete-donjon`) : les autres
 * quêtes restent celles du prototype. Null si la ville n'est reliée à aucune route à donjon, ou pour 80 % des quêtes.
 */
export function genDungeonQuest(c: GenContent, seed: number, region: number, n: number): Quest | null {
  if (!c.dungeons?.length || !c.routes) return null;
  const R = c.regions;
  const RT = routes(c);
  const id = R[region]!.id;
  const near = RT.flatMap((x, i) => {
    const d = (x.from === id || x.to === id) && c.dungeons!.find((y) => y.route === x.id);
    return d ? [{ terr: i, d }] : [];
  });
  if (!near.length) return null;
  const r = new Rng(hash(seed, 'quete-donjon', region, n));
  if (r.int(100) >= DUNGEON_QUEST_PERCENT) return null;
  const { terr, d } = near[r.int(near.length)]!;
  const T = RT[terr]!.tier;
  const boss = d.bosses[r.int(d.bosses.length)]!;
  const trophy = bossTrophy(c, boss)!;
  const kind = r.int(2) ? 'equip' : 'troop';
  const pts = kind === 'equip' ? between(r, 6, 9) : between(r, 9, 12);
  const reward = rewardOf(c, r, kind, terr, region);
  const givers = c.questGivers[region]!;
  const giver = givers[r.int(givers.length)]!;
  const bossName = c.troops[boss]!.name;
  const title = [`Le trophée de ${bossName}`, `Défi du donjon : ${d.name}`, `Prime : ${bossName}`][r.int(3)]!;
  const pitch = [
    'On dit que personne n’en revient. Prouvez le contraire.',
    'Rapportez-moi la preuve de sa chute, et je saurai vous remercier.',
    'Ce trophée-là, je le paierai le double.',
  ][r.int(3)]!;
  const text = `« ${pitch} » ${bossName} garde le donjon ${d.name}, sur la route ${RT[terr]!.name} (salles 4, 8, 12…).`;
  return {
    id: `q${region}-${n}`,
    region,
    giver,
    title,
    text,
    needs: [[trophy, 1]],
    reward,
    gold: Math.round(pts * 5 * T * T * 2),
    dungeon: d.id,
  };
}

export function genQuest(c: GenContent, seed: number, region: number, n: number): Quest {
  const dq = genDungeonQuest(c, seed, region, n);
  if (dq) return dq;
  const R = c.regions;
  const RT = routes(c);
  const r = new Rng(hash(seed, 'quete', region, n));
  // Route des trophées : celle qui part de la ville (70 %) ou celle qui y arrive (30 %) dans le prototype ;
  // dans le graphe, l'une des routes de la ville, au hasard.
  let terr: number;
  if (c.routes) {
    const id = R[region]!.id;
    const adj = RT.flatMap((x, i) => (x.from === id || x.to === id ? [i] : []));
    terr = adj[r.int(adj.length)]!;
  } else terr = region > 0 && r.int(10) < 3 ? region - 1 : region;
  const T = RT[terr]!.tier;
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
  if (kind === 'equip' || kind === 'troop') reward = rewardOf(c, r, kind, terr, region);
  else {
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
  const terrName = RT[terr]!.name;
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
  const where = [...new Set(rares.map((x) => `${RT[x.region]!.steps.find((s) => s.id === x.step)!.name}`))].join(' et ');
  const text = `« ${pitch[r.int(pitch.length)]} » On les croise parfois : ${where}, ${terrName}.`;
  return { id: `q${region}-${n}`, region, giver, title, text, needs, reward, gold };
}
