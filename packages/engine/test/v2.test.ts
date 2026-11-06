/**
 * Moteur v2 (README 30) : volonté en points de la volonté de référence du combat, et épuisement. Chaque règle
 * sur un combat minimal, valeur attendue calculée à la main, comparée à la v1.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { simuler } from '../src/index.ts';
import type { BattleOutput, Powers, Skill, UnitInput } from '../src/index.ts';

const golden = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../golden/v0.4/content.json'), 'utf8')) as {
  params: Parameters<typeof simuler>[0]['params'];
  skills: Record<string, Skill>;
};
const SKILLS: Record<string, Skill> = {
  ...golden.skills,
  // Aucun dégât : seule la perte de volonté de l'effet compte.
  vision: {
    kind: 'active',
    target: 'enemy',
    range: 5,
    energy: 0,
    mana: 0,
    durBase: 'unit',
    durMult: 1000,
    p: {},
    name: 'Vision',
    fx: [{ k: 'will', v: -300 }],
  },
};
const POW: Powers = { for: 0, ele: 0, esp: 0, foi: 0, omb: 0 };
const NO_RES = { contondant: 0, tranchant: 0, maladie: 0, psychique: 0, feu: 0, glace: 0, tenebres: 0, sacre: 0 };

const unit = (side: 0 | 1, o: Partial<UnitInput> & { act?: string } = {}): UnitInput => {
  const { act, ...rest } = o;
  return {
    id: side ? 'B1' : 'A1',
    side,
    slot: 0,
    troop: `${side}-0`,
    kind: 'test',
    name: side ? 'B1' : 'A1',
    tags: [],
    hpMax: 100000,
    willMax: 100,
    energyMax: 300,
    manaMax: 0,
    pow: POW,
    speed: 20,
    res: { ...NO_RES },
    weapon: { name: 'Épée', type: 'tranchant', dmg: 12, speed: 20, cost: 10 },
    hp: 100000,
    mana: 0,
    dist: 1,
    skills: act ? [act] : [],
    rules: act ? [{ cond: 'always', action: act, target: 'nearestEnemy' }] : [],
    ...rest,
  };
};
const fight = (version: 'v1' | 'v2', units: UnitInput[], params: Record<string, number> = {}): BattleOutput =>
  simuler({ engineVersion: version, params: { ...golden.params, timeLimit: 400, ...params }, skills: SKILLS, units }, 1);

describe('moteur v2 : volonté en points', () => {
  // A1 : 100 de volonté max ; B1 : 300. Référence du combat : (100 + 300) / 2 = 200.
  const units = (): UnitInput[] => [unit(0, { willMax: 100 }), unit(1, { willMax: 300, speed: 10, act: 'vision' })];
  const firstLoss = (out: BattleOutput): number => {
    const e = out.log.find((x) => x.k === 'gauge' && x.g === 'will' && x.u === 'A1' && x.cause === 'Vision')!;
    return (e.from as number) - (e.to as number);
  };

  it('une perte de 30 % vaut 30 % de la volonté de référence, pas de la volonté max de la cible', () => {
    expect(firstLoss(fight('v1', units()))).toBe(30);
    expect(firstLoss(fight('v2', units()))).toBe(60);
  });

  it('une volonté max plus haute tient plus longtemps', () => {
    const big = [unit(0, { willMax: 300 }), unit(1, { willMax: 100, speed: 10, act: 'vision' })];
    expect(firstLoss(fight('v2', big))).toBe(60); // 20 % de 300, contre 30 % en v1
    expect(firstLoss(fight('v1', big))).toBe(90);
  });

  it('les blessures se mesurent aussi à la référence', () => {
    // B1 frappe A1 à l'épée : 12 dégâts sur 1 000 PV. woundWill 1 000 : 12 × 200 × 1 000 / (1 000 × 1 000) = 2 points.
    const make = (): UnitInput[] => [unit(0, { willMax: 100, hpMax: 1000, hp: 1000 }), unit(1, { willMax: 300, speed: 10, act: 'emploi' })];
    const loss = (v: 'v1' | 'v2'): number => {
      const e = fight(v, make(), { woundWill: 1000 }).log.find((x) => x.k === 'gauge' && x.g === 'will' && x.u === 'A1')!;
      return (e.from as number) - (e.to as number);
    };
    expect(loss('v1')).toBe(1);
    expect(loss('v2')).toBe(2);
  });
});

describe('moteur v2 : épuisement', () => {
  // A1 frappe à l'épée (coût 10, durée 20) avec 100 d'énergie : épuisé dès qu'il lui reste moins de 30.
  const make = (): UnitInput[] => [unit(0, { energyMax: 100, act: 'emploi' }), unit(1)];
  const gaps = (out: BattleOutput): number[] => {
    const t = out.log.filter((e) => e.k === 'act' && e.u === 'A1').map((e) => e.t!);
    return t.slice(1, 10).map((x, i) => x - t[i]!);
  };

  it('une capacité lancée sous le seuil dure exhaustMod ‰ de sa durée', () => {
    // Énergie avant chaque action : 100, 90, …, 30 (normal), puis 20 et 10 (épuisé : 20 × 1,4 = 28).
    expect(gaps(fight('v2', make(), { exhaustAt: 300, exhaustMod: 1400 }))).toEqual([20, 20, 20, 20, 20, 20, 20, 20, 28]);
  });

  it("sans paramètre, ou en v1, pas d'épuisement", () => {
    expect(gaps(fight('v2', make()))).toEqual(Array(9).fill(20));
    expect(gaps(fight('v1', make(), { exhaustAt: 300, exhaustMod: 1400 }))).toEqual(Array(9).fill(20));
  });
});
