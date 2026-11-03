/**
 * Vecteurs du prototype proto-0.4-ville (tools/extract-prototype/src/gen-vectors.ts) : chaque générateur
 * porté doit rendre exactement ce que rendait le prototype, sur le contenu du prototype.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { Rng } from '@cr/rng';
import { describe, expect, it } from 'vitest';
import {
  battleUnits,
  canWear,
  computeStats,
  genEquip,
  genMonsters,
  genQuest,
  genRecipes,
  newTroop,
  rarePresent,
  rollLoot,
  tradeOnly,
} from '../src/index.ts';
import type { BattleOptions, GenContent, GuardianLoot, MonsterGroup, MonsterSpec, PlayerTroop } from '../src/index.ts';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '../golden/v0.4');
const c = JSON.parse(readFileSync(join(DIR, 'content.json'), 'utf8')) as GenContent;
const vectors = JSON.parse(gunzipSync(readFileSync(join(DIR, 'vectors.json.gz'))).toString('utf8')) as {
  fn: string;
  args: unknown[];
  out: unknown;
}[];
const asJson = (v: unknown): unknown => JSON.parse(JSON.stringify(v));

/* eslint-disable @typescript-eslint/no-explicit-any */
const CALL: Record<string, (...a: any[]) => unknown> = {
  computeStats: (type: string, form: string, level: number) => computeStats(c, c.troops[type]!, form, level),
  newTroop: (type: string, level: number) => newTroop(c, type, level),
  genEquip: (base: string, seed: number, roll: number | null) => genEquip(c, base, new Rng(seed), roll ?? undefined),
  genMonsters: (spec: MonsterSpec, seed: number) => genMonsters(c, spec, seed),
  rollLoot: (ri: number, si: number, types: string[], seed: number, g: GuardianLoot | null) =>
    rollLoot(c, c.regions[ri]!.territory.steps[si]!, types, seed, g),
  genRecipes: (seed: number) => genRecipes(c, seed),
  tradeOnly: (seed: number) => tradeOnly(c, seed),
  genQuest: (seed: number, region: number, n: number) => genQuest(c, seed, region, n),
  rarePresent: (seed: number, key: string, fights: number) => rarePresent(c, seed, key, fights),
  canWear: (type: string, level: number, base: string) => canWear(c, type, level, base),
  battleUnits: (squad: PlayerTroop[], group: MonsterGroup, o: BattleOptions) => battleUnits(c, squad, group, o),
};

type Vector = (typeof vectors)[number];
const byFn = new Map<string, Vector[]>();
for (const v of vectors) byFn.set(v.fn, [...(byFn.get(v.fn) ?? []), v]);
const groups = [...byFn.entries()];

describe('générateurs : vecteurs du prototype', () => {
  it('couvrent chaque générateur', () => {
    expect(groups.map(([fn]) => fn).sort()).toEqual(Object.keys(CALL).sort());
  });

  describe.each(groups)('%s', (fn, list) => {
    it(`${list.length} vecteurs identiques`, () => {
      for (const [i, v] of list.entries()) {
        const got = asJson(CALL[fn]!(...v.args));
        if (JSON.stringify(got) !== JSON.stringify(v.out)) expect({ i, args: v.args, got }).toEqual({ i, args: v.args, got: v.out });
      }
    });
  });
});

describe('ajustement du gardien (README 16, point 2)', () => {
  // Route 4 (désert) : le Dragon de cendre est à ×0,48 ; son escorte ne doit plus l'être.
  const cases = vectors.filter((v) => v.fn === 'battleUnits' && (v.args[2] as BattleOptions).guardianStep);
  it('existe dans les vecteurs', () => expect(cases.length).toBeGreaterThan(0));

  it('ne touche plus que le gardien, plus son escorte', () => {
    let escorts = 0;
    for (const v of cases) {
      const [squad, group, o] = v.args as [PlayerTroop[], MonsterGroup, BattleOptions];
      const all = battleUnits(c, squad, group, { ...o, guardianAdjust: 'all' });
      const fixed = battleUnits(c, squad, group, { ...o, guardianAdjust: 'guardian' });
      const plain = battleUnits(c, squad, group, { ...o, guardianStep: false });
      const monsters = fixed.filter((u) => u.side === 1);
      monsters.forEach((u) => {
        const troop = group.troops[Number(u.troop.split('-')[1])]!;
        const twin = (c.monsters[troop.type]?.boss ? all : plain).find((x) => x.id === u.id)!;
        expect({ hp: u.hpMax, atk: u.atk, dmg: u.weapon.dmg }).toEqual({ hp: twin.hpMax, atk: twin.atk, dmg: twin.weapon.dmg });
        if (!c.monsters[troop.type]?.boss) escorts++;
      });
      expect(fixed.filter((u) => u.side === 0)).toEqual(all.filter((u) => u.side === 0));
    }
    expect(escorts).toBeGreaterThan(0);
  });
});
