/**
 * Moteur v3 (README 36) : une règle « allyHpBelow v » sur une capacité qui vise un allié ne vise que des alliés sous
 * v % de leurs PV ; une règle sautée faute de mana est signalée dans le journal. Combats minimaux, comparés à la v2.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { simuler } from '../src/index.ts';
import type { BattleOutput, Powers, Rule, Skill, UnitInput } from '../src/index.ts';

const golden = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../golden/v0.4/content.json'), 'utf8')) as {
  params: Parameters<typeof simuler>[0]['params'];
  skills: Record<string, Skill>;
};
const POW: Powers = { for: 0, ele: 0, esp: 0, foi: 0, omb: 0 };
const NO_RES = { contondant: 0, tranchant: 0, maladie: 0, psychique: 0, feu: 0, glace: 0, tenebres: 0, sacre: 0 };

const unit = (id: string, side: 0 | 1, slot: number, o: Partial<UnitInput> = {}): UnitInput => ({
  id,
  side,
  slot,
  troop: `${side}-${slot}`,
  kind: 'test',
  name: id,
  tags: [],
  hpMax: 1000,
  willMax: 100,
  energyMax: 300,
  manaMax: 0,
  pow: POW,
  speed: 20,
  res: { ...NO_RES },
  weapon: { name: 'Bâton', type: 'contondant', dmg: 1, speed: 20, cost: 1 },
  hp: 1000,
  mana: 0,
  dist: 1,
  skills: [],
  rules: [],
  ...o,
});
// Soigneur A1 (Régénération si un allié est sous 50 %), A2 blessé (30 %), A3 presque plein (95 %) ; un ennemi qui attend.
const healer = (rules: Rule[], mana = 200): UnitInput =>
  unit('A1', 0, 0, {
    manaMax: 200,
    mana,
    dist: 3,
    skills: ['regeneration'],
    rules: [...rules, { cond: 'always', action: 'attendre', target: 'self' }],
  });
const squad = (rules: Rule[], mana?: number): UnitInput[] => [
  healer(rules, mana),
  unit('A2', 0, 1, { hp: 300 }),
  unit('A3', 0, 2, { hp: 950 }),
  unit('B1', 1, 0, { rules: [{ cond: 'always', action: 'attendre', target: 'self' }] }),
];
const fight = (version: 'v2' | 'v3', units: UnitInput[]): BattleOutput =>
  simuler({ engineVersion: version, params: { ...golden.params, timeLimit: 300 }, skills: golden.skills, units }, 1);
const targets = (out: BattleOutput): string[] =>
  out.log.filter((e) => e.k === 'act' && e.u === 'A1' && e.skill === 'regeneration').map((e) => e.target as string);

describe('moteur v3 : soins réservés aux alliés sous le seuil de la règle', () => {
  const rule: Rule[] = [{ cond: 'allyHpBelow', v: 50, action: 'regeneration', target: 'mostWoundedAlly' }];

  it('en v2, A2 en recharge de Régénération, le soin part sur A3, presque plein', () => {
    const t = targets(fight('v2', squad(rule)));
    expect(t[0]).toBe('A2');
    expect(t).toContain('A3');
  });

  it('en v3, il ne vise que A2, le seul sous 50 %', () => {
    const t = targets(fight('v3', squad(rule)));
    expect(t.length).toBeGreaterThan(0);
    expect(new Set(t)).toEqual(new Set(['A2']));
  });
});

describe('moteur v3 : règle sautée faute de mana signalée', () => {
  const rule: Rule[] = [{ cond: 'allyHpBelow', v: 50, action: 'regeneration', target: 'mostWoundedAlly' }];

  it('avec 5 de mana pour un sort à 10, le journal dit pourquoi le soigneur attend', () => {
    const out = fight('v3', squad(rule, 5));
    const e = out.log.find((x) => x.k === 'nomana' && x.u === 'A1');
    expect(e).toMatchObject({ skill: 'regeneration', mana: 5, cost: 10 });
    // Signalé juste avant la décision prise à la place (ici attendre), une fois par décision.
    const i = out.log.indexOf(e!);
    expect(out.log[i + 1]).toMatchObject({ u: 'A1' });
    expect(out.log.filter((x) => x.k === 'nomana' && x.t === e!.t && x.u === 'A1')).toHaveLength(1);
  });

  it('pas d’événement en v2, ni quand le mana suffit', () => {
    expect(fight('v2', squad(rule, 5)).log.some((x) => x.k === 'nomana')).toBe(false);
    const out = fight('v3', squad(rule, 200));
    const first = out.log.findIndex((x) => x.k === 'act' && x.u === 'A1');
    expect(out.log.slice(0, first).some((x) => x.k === 'nomana')).toBe(false);
  });
});
