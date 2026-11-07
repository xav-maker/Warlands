/**
 * Propriétés du moteur (guide 16.1) sur des combats tirés au hasard : unités, puissances, capacités du
 * prototype, règles, immunités, positions et graines. 1 000 cas à chaque push ; FC_RUNS=100000 la nuit.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { ENGINE_VERSIONS, simuler } from '../src/index.ts';
import type { BattleInput, Rule, Skill, UnitInput } from '../src/index.ts';

const content = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../golden/v0.4/content.json'), 'utf8')) as {
  params: BattleInput['params'];
  skills: Record<string, Skill>;
};
const RUNS = Number(process.env.FC_RUNS ?? 1000);
const SKILL_IDS = Object.keys(content.skills).sort();
const TYPES = ['contondant', 'tranchant', 'maladie', 'psychique', 'feu', 'glace', 'tenebres', 'sacre'];
const CONDS = [
  'always',
  'selfHpBelow',
  'allyHpBelow',
  'selfEnergyAbove',
  'enemyInRange',
  'noEnemyInRange',
  'targetNotImmune',
  'targetImmune',
];
const TARGETS = ['nearestEnemy', 'weakestEnemy', 'strongestEnemy', 'randomEnemy', 'mostWoundedAlly', 'self'];

const rule = fc.record({
  cond: fc.constantFrom(...CONDS),
  v: fc.integer({ min: 0, max: 100 }),
  action: fc.constantFrom(...SKILL_IDS, 'avancer', 'reculer', 'attendre'),
  target: fc.constantFrom(...TARGETS),
});

/** Au plus 2 immunités, jamais les deux types physiques à la fois (README 19.4). */
const immunities = fc
  .uniqueArray(fc.constantFrom(...TYPES), { maxLength: 2 })
  .filter((l) => !(l.includes('contondant') && l.includes('tranchant')));

const unitArb = fc.record({
  hpMax: fc.integer({ min: 30, max: 3000 }),
  hpPct: fc.integer({ min: 1, max: 100 }),
  willMax: fc.integer({ min: 20, max: 120 }),
  energyMax: fc.integer({ min: 0, max: 400 }),
  manaMax: fc.integer({ min: 0, max: 300 }),
  pow: fc.record({
    for: fc.nat({ max: 60 }),
    ele: fc.nat({ max: 60 }),
    esp: fc.nat({ max: 60 }),
    foi: fc.nat({ max: 60 }),
    omb: fc.nat({ max: 60 }),
  }),
  speed: fc.integer({ min: 8, max: 30 }),
  res: fc.dictionary(fc.constantFrom(...TYPES), fc.integer({ min: -500, max: 900 })),
  weapon: fc.record({
    type: fc.constantFrom('tranchant', 'contondant'),
    dmg: fc.integer({ min: 1, max: 30 }),
    speed: fc.integer({ min: 8, max: 30 }),
    cost: fc.integer({ min: 1, max: 15 }),
  }),
  dist: fc.integer({ min: 1, max: 3 }),
  skills: fc.uniqueArray(fc.constantFrom(...SKILL_IDS), { minLength: 1, maxLength: 6 }),
  rules: fc.array(rule, { maxLength: 5 }),
  immune: immunities,
  troop: fc.integer({ min: 0, max: 3 }),
});

const battleArb = fc.record({
  version: fc.constantFrom(...ENGINE_VERSIONS),
  a: fc.array(unitArb, { minLength: 1, maxLength: 8 }),
  b: fc.array(unitArb, { minLength: 1, maxLength: 8 }),
  seed: fc.nat(),
});

type Arb = typeof battleArb extends fc.Arbitrary<infer T> ? T : never;

function toInput(b: Arb): BattleInput {
  // v1 et suivantes : puissances et immunités.
  const v1 = b.version === 'v1' || b.version === 'v2' || b.version === 'v3';
  const side = (list: Arb['a'], s: 0 | 1): UnitInput[] =>
    list.map((u, i) => {
      const rules: Rule[] = [...u.rules, { cond: 'always', action: u.skills[0]!, target: 'nearestEnemy' }];
      return {
        id: `${s ? 'B' : 'A'}${i + 1}`,
        side: s,
        slot: i,
        troop: `${s}-${u.troop}`,
        kind: 'test',
        name: `U${s}${i}`,
        tags: [],
        hpMax: u.hpMax,
        willMax: u.willMax,
        energyMax: u.energyMax,
        manaMax: u.manaMax,
        ...(v1 ? { pow: u.pow, ...(s === 1 ? { immune: u.immune } : {}) } : { atk: u.pow.for }),
        speed: u.speed,
        res: u.res,
        weapon: u.weapon,
        hp: Math.max(1, Math.floor((u.hpMax * u.hpPct) / 100)),
        mana: u.manaMax,
        dist: u.dist,
        skills: u.skills,
        rules,
      };
    });
  // v2 : épuisement actif, pour que les propriétés le couvrent aussi.
  const params = b.version === 'v2' || b.version === 'v3' ? { ...content.params, exhaustAt: 300, exhaustMod: 1400 } : content.params;
  return { engineVersion: b.version, params, skills: content.skills, units: [...side(b.a, 0), ...side(b.b, 1)] };
}

describe('propriétés du moteur', () => {
  it('termine, borne les jauges, fait avancer le temps, rejoue à l’identique, respecte les immunités', () => {
    fc.assert(
      fc.property(battleArb, (b) => {
        const input = toInput(b);
        const out = simuler(input, b.seed);
        const byId = new Map(input.units.map((u) => [u.id, u]));
        // Termine : un seul « end », en dernier, avant la durée limite.
        expect(out.log.at(-1)!.k).toBe('end');
        expect(out.log.filter((e) => e.k === 'end')).toHaveLength(1);
        expect(out.result.time).toBeLessThanOrEqual(content.params.timeLimit);
        let t = 0;
        for (const e of out.log) {
          // Temps croissant.
          expect(e.t as number).toBeGreaterThanOrEqual(t);
          t = e.t as number;
          // Jauges dans leurs bornes.
          if (e.k === 'gauge') {
            const u = byId.get(e.u as string)!;
            const max = { hp: u.hpMax, will: u.willMax, energy: u.energyMax, mana: u.manaMax }[e.g as 'hp'];
            expect(e.to as number).toBeGreaterThanOrEqual(0);
            expect(e.to as number).toBeLessThanOrEqual(max);
          }
          // Immunité : 0 dégât.
          if (e.k === 'hit' && byId.get(e.u as string)!.immune?.includes(e.type as string)) expect(e.final).toBe(0);
          if (e.k === 'hit') expect(e.final as number).toBeGreaterThanOrEqual(0);
        }
        for (const r of out.result.units) {
          const u = byId.get(r.id)!;
          expect(r.hp).toBeGreaterThanOrEqual(0);
          expect(r.hp).toBeLessThanOrEqual(u.hpMax);
        }
        // Même graine, même journal.
        expect(JSON.stringify(simuler(input, b.seed))).toBe(JSON.stringify(out));
      }),
      { numRuns: RUNS, seed: process.env.FC_SEED ? Number(process.env.FC_SEED) : 20261103 },
    );
  }, 300_000); // 1 000 combats aléatoires : une quarantaine de secondes sur la CI
});
