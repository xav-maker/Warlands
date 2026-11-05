/** Statistiques de fin de combat : elles doivent retomber sur les chiffres du moteur. */
import { describe, expect, it } from 'vitest';
import { simuler } from '@cr/engine';
import type { BattleOutput, UnitInput } from '@cr/engine';
import { battleUnits, genMonsters, routes, stepSpec, unitStats } from '@cr/gen';
import type { PlayerTroop } from '@cr/gen';
import { battleStats, chart } from '../src/battle-stats.ts';
import { loadGameContent } from '../src/content.ts';

const { pack } = loadGameContent();
const o = pack.online!;

function fight(level: number, seed: number, step = 0): { units: UnitInput[]; out: BattleOutput } {
  const troop = (type: string, rank: number): PlayerTroop => {
    const t: PlayerTroop = { type, level, form: pack.troops[type]!.forms[0]!.id, rank, units: [{ hp: 0, mana: 0, equip: {} }] };
    const s = unitStats(pack, t, t.units[0]!);
    t.units[0]!.hp = s.hpMax;
    t.units[0]!.mana = s.manaMax;
    return t;
  };
  const squad = [troop('milicien', 1), troop('milicien', 1), troop('acolyte', 3)];
  const R = routes(pack)[0]!;
  const spec = stepSpec(R.steps[step]!);
  const side = genMonsters(pack, { ...spec, slots: o.encounters.slots }, seed);
  const units = battleUnits(pack, squad, side, { territory: 0, guardianStep: false, guardianAdjust: o.guardianAdjust });
  const out = simuler({ engineVersion: o.engineVersion, params: pack.params, skills: pack.skills, units }, seed);
  return { units, out };
}

describe('statistiques de combat', () => {
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    it(`graine ${seed} : retombe sur les chiffres du moteur`, () => {
      const { units, out } = fight(5, seed, seed % 3);
      const s = battleStats(units, out.log);
      for (const u of s.units) {
        const r = out.result.units.find((x) => x.id === u.id)!;
        expect(u.dealt, `${u.name} : dégâts infligés`).toBe(r.dmgDealt);
        expect(u.kills, `${u.name} : éliminations`).toBe(r.kills);
        expect(u.diedAt !== null, `${u.name} : mort`).toBe(r.dead);
      }
      // Les dégâts d'un camp ne dépassent pas ceux que l'autre camp a subis (le reste vient de sources sans auteur)...
      expect(s.sides[0].dealt).toBeLessThanOrEqual(s.sides[1].taken);
      expect(s.sides[1].dealt).toBeLessThanOrEqual(s.sides[0].taken);
      // ... et les PV de fin sont ceux du résultat.
      for (const side of [0, 1]) {
        const end = out.result.units.filter((r) => units.find((u) => u.id === r.id)!.side === side).reduce((a, r) => a + r.hp, 0);
        expect(s.sides[side]!.hpEnd, `camp ${side} : PV restants`).toBe(end);
      }
      expect(s.duration).toBeGreaterThan(0);
    });
  }

  it('compte les soins et attribue ceux de l’Acolyte', () => {
    let healed = 0;
    let credited = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const { units, out } = fight(5, seed, 2);
      const s = battleStats(units, out.log);
      const acolyte = s.units.find((u) => u.name.toLowerCase().includes('acolyte'))!;
      healed += s.sides[0].healed;
      credited += acolyte.healedOut;
      // Chaque PV rendu est compté une fois à celui qui le reçoit, et au plus une fois à celui qui le donne.
      expect(s.units.filter((u) => u.side === 0).reduce((a, u) => a + u.healedOut, 0) + s.sides[0].healedUnattributed).toBe(
        s.sides[0].healed,
      );
    }
    expect(healed).toBeGreaterThan(0);
    expect(credited).toBeGreaterThan(0);
  });

  it('les courbes vont de 100 % à la fin du combat, par camp', () => {
    const { units, out } = fight(5, 3, 1);
    const s = battleStats(units, out.log);
    for (const side of [0, 1]) {
      expect(s.hp[side]!.pts[0]).toEqual([0, expect.any(Number)]);
      expect(s.hp[side]!.pts.at(-1)![1]).toBeCloseTo((100 * s.sides[side]!.hpEnd) / s.sides[side]!.hpMax, 5);
      expect(s.damage[side]!.pts.at(-1)![1]).toBe(s.sides[side]!.dealt);
    }
    const c = chart(s.hp, {
      tMax: s.duration,
      yMax: 100,
      yUnit: ' %',
      marks: s.deaths.map((d) => ({ t: d.t, side: d.side, title: d.name })),
    });
    expect(c.lines).toHaveLength(2);
    expect(c.yTicks.map((y) => y.label)).toEqual(['0 %', '25 %', '50 %', '75 %', '100 %']);
    expect(c.marks).toHaveLength(s.deaths.length);
    for (const l of c.lines) expect(l.d).toMatch(/^M[\d. ]+(H[\d.]+V[\d.]+)*H[\d.]+$/);
  });
});
