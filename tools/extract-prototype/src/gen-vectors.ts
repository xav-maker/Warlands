/**
 * Vecteurs de référence des générateurs (packages/gen), produits par le prototype proto-0.4-ville.
 *
 *   golden/v0.4/content.json      instantané du contenu du prototype, à la forme GenContent
 *   golden/v0.4/vectors.json.gz   appels (fonction, arguments) et résultat attendu
 *
 *   pnpm golden:gen
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { loadPrototype } from './load.ts';

/* eslint-disable @typescript-eslint/no-explicit-any */
const P = loadPrototype();
const OUT = join(dirname(fileURLToPath(import.meta.url)), '../../../packages/gen/golden/v0.4');
const plain = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

const content = plain({
  params: P.C.params,
  weapons: P.C.weapons,
  skills: P.C.skills,
  troops: P.C.troops,
  monsters: Object.fromEntries(
    Object.entries<any>(P.MONSTERS).map(([id, m]) => [
      id,
      { drops: m.drops, boss: m.boss, region: m.region, ...(m.rare ? { rare: m.rare } : {}) },
    ]),
  ),
  items: P.ITEMS,
  equip: P.EQUIP,
  regions: P.REGIONS,
  rares: P.RARES,
  eco: P.ECO, // xpToNext (une fonction) disparaît au passage en JSON
  statCost: P.STAT_COST,
  tierBudget: P.TIER_BUDGET,
  tierNStats: P.TIER_NSTATS,
  tierLevel: P.TIER_LEVEL,
  troopSlots: P.TROOP_SLOTS,
  craftConsumables: P.CRAFT_CONSUMABLES,
  consumableTags: P.CONSUMABLE_TAGS,
  consumableValueMult: P.CONSUMABLE_VALUE_MULT,
  recruitValue: P.RECRUIT_VALUE,
  itemBoost: P.ITEM_BOOST,
  gaugeMult: P.GAUGE_MULT,
  rareChance: P.RARE_CHANCE,
  rareMinWins: P.RARE_MIN_WINS,
  questGivers: P.GIVERS,
  dmgTypes: P.DMG_TYPES,
});

type Vector = { fn: string; args: unknown[]; out: unknown };
const vectors: Vector[] = [];
const push = (fn: string, args: unknown[], out: unknown): void => void vectors.push({ fn, args: plain(args), out: plain(out) });
const r = new P.Rng(P.hash(0x6e6, 'gen-vectors'));
const pickOf = <T>(l: T[]): T => l[r.int(l.length)]!;
const STEPS: [number, number, any][] = P.REGIONS.flatMap((R: any, ri: number) =>
  R.territory.steps.map((st: any, si: number) => [ri, si, st]),
);

// Troupes : stats et troupe de monstre à plusieurs niveaux, pour chaque forme.
for (const [type, t] of Object.entries<any>(P.C.troops))
  for (const level of [1, 5, 10, 15, 20, 30]) {
    for (const f of t.forms) push('computeStats', [type, f.id, level], P.computeStats(t, f.id, level));
    push('newTroop', [type, level], P.newTroop(P.C, type, level));
  }

// Exemplaires : chaque base, 4 graines, plus une qualité imposée.
for (const base of Object.keys(P.EQUIP).sort())
  for (let k = 0; k < 5; k++) {
    const seed = P.hash(k, 'equip', base);
    const roll = k === 4 ? 1300 : undefined;
    push('genEquip', [base, seed, roll], P.genEquip(base, new P.Rng(seed), roll));
  }

// Groupes de monstres et butin : chaque étape, 10 graines ; le rare de l'étape une fois sur trois.
for (const [ri, si, st] of STEPS)
  for (let k = 0; k < 10; k++) {
    const seed = P.hash(ri * 100 + si, 'rencontre', k);
    const rare = !st.guardian && k % 3 === 0 ? P.rareOfStep(st.id)?.id : undefined;
    const spec = { level: st.level, pop: st.pop, pool: st.pool, forced: [...(st.forced ?? []), ...(rare ? [rare] : [])] };
    const group = P.genMonsters(P.C, spec, seed);
    push('genMonsters', [spec, seed], group);
    const types = group.troops.map((t: any) => t.type);
    const R = P.REGIONS[ri];
    const guardian = st.guardian ? { first: k % 2 === 0, firstItem: R.firstItem, loot: R.guardianLoot } : null;
    push('rollLoot', [ri, si, types, P.hash(seed, 'combat'), guardian], P.rollLoot(st, types, P.hash(seed, 'combat'), guardian));
  }

// Recettes personnelles et matériaux d'échange.
for (let k = 0; k < 6; k++) push('genRecipes', [P.hash(k, 'joueur')], P.genRecipes(P.C, P.hash(k, 'joueur')));
for (let k = 0; k < 30; k++) push('tradeOnly', [P.hash(k, 'joueur')], P.tradeOnly(P.hash(k, 'joueur')));

// Quêtes : chaque ville, 12 quêtes, 3 graines.
for (let region = 0; region < P.REGIONS.length; region++)
  for (let k = 0; k < 3; k++)
    for (let n = 0; n < 12; n++) push('genQuest', [P.hash(k, 'joueur'), region, n], P.genQuest(P.hash(k, 'joueur'), region, n));

// Rares présents.
for (let k = 0; k < 300; k++) {
  const [, , st] = pickOf(STEPS);
  const args = [P.hash(k, 'joueur'), `${st.id}|${k % 7}`, k];
  push('rarePresent', args, P.rarePresent(...args));
}

// Port d'équipement.
const types = Object.keys(P.TROOP_SLOTS);
for (let k = 0; k < 300; k++) {
  const args = [pickOf(types), 1 + r.int(30), pickOf(Object.keys(P.EQUIP))];
  push('canWear', args, P.canWear(...args));
}

// Entrée du moteur : escouades tirées au hasard, équipées, contre la rencontre d'une étape.
const recruitable = (ri: number): string[] =>
  Object.keys(P.C.troops).filter((t) => !P.MONSTERS[t] && P.recruitRegion(t) >= 0 && P.recruitRegion(t) <= ri);
for (let k = 0; k < 150; k++) {
  const [ri, si, st] = STEPS[k % STEPS.length]!;
  const g = P.newGame(P.hash(k, 'partie'));
  g.troops = [];
  for (let tries = 0; tries < 10; tries++) {
    const type = pickOf(recruitable(ri));
    const lvl = Math.max(1, Math.min(30, st.level[0] + r.int(7) - 3));
    const t = P.addTroop(g, type, lvl, true);
    if (!t.squad) {
      g.troops.pop();
      continue;
    }
    t.form = pickOf<any>(P.formsAvailable(P.C.troops[type], lvl)).id;
    t.units = t.units.map(() => P.freshUnit(t));
    if (r.int(4) === 0) t.rank = 1 + r.int(3);
    for (const u of t.units) {
      for (const [slot, cats] of Object.entries<any>(P.TROOP_SLOTS[type] ?? {})) {
        if (r.int(2)) continue;
        const bases = Object.values<any>(P.EQUIP).filter(
          (b) => b.slot === slot && cats.includes(b.cat) && P.canWear(type, lvl, b.id) === null,
        );
        if (bases.length) u.equip[slot] = P.genEquip(pickOf(bases).id, new P.Rng(P.hash(k, 'porte', slot, tries)));
      }
      if (r.int(5) === 0) u.hp = Math.max(1, Math.floor(u.hp / 2));
    }
  }
  g.where = 'territoire';
  g.terr = ri;
  g.step = si;
  g.outings = 1;
  g.cleared = P.REGIONS[ri].territory.steps.map(() => false);
  P.newEncounter(g);
  const squad = g.troops
    .filter((t: any) => t.squad)
    .map((t: any) => ({ type: t.type, level: t.level, form: t.form, rank: t.rank, units: t.units }));
  push(
    'battleUnits',
    [squad, g.encounter.side, { territory: ri, guardianStep: !!st.guardian, guardianAdjust: 'all' }],
    P.buildInput(g).units,
  );
}

mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'content.json'), JSON.stringify(content) + '\n');
writeFileSync(join(OUT, 'vectors.json.gz'), gzipSync(JSON.stringify(vectors), { level: 9 }));
const byFn: Record<string, number> = {};
for (const v of vectors) byFn[v.fn] = (byFn[v.fn] ?? 0) + 1;
console.log(byFn, vectors.length, 'vecteurs');
