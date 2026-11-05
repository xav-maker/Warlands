/**
 * Moteur v1 (README 19, contenu-cible-unites 3.6) : chaque règle nouvelle sur un combat minimal, avec la
 * valeur attendue calculée à la main. Les combats de référence ne les exercent pas (migration neutre).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { simuler } from '../src/index.ts';
import type { BattleOutput, LogEvent, Powers, Rule, Skill, UnitInput } from '../src/index.ts';

const golden = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../golden/v0.4/content.json'), 'utf8')) as {
  params: Parameters<typeof simuler>[0]['params'];
  skills: Record<string, Skill>;
};

const spell = (o: Partial<Skill>): Skill => ({
  kind: 'active',
  target: 'enemy',
  range: 5,
  energy: 0,
  mana: 0,
  durBase: 'unit',
  durMult: 1000,
  p: {},
  name: 'Sort',
  ...o,
});
const passiveSkill = (name: string, p: Record<string, number>): Skill => spell({ kind: 'passive', target: 'self', name, p });

const SKILLS: Record<string, Skill> = {
  ...golden.skills,
  lance_feu: spell({ name: 'Lance de feu', attack: true, power: 'ele', coef: 1500, fx: [{ k: 'dmg', v: 28, type: 'feu' }] }),
  brule: spell({ name: 'Brûle', fx: [{ k: 'state', s: 'brulure', v: 5, dur: 40 }] }),
  gel: spell({
    name: 'Gel',
    fx: [
      { k: 'state', s: 'gele', dur: 25 },
      { k: 'state', s: 'ralenti', dur: 40 },
    ],
  }),
  vision: spell({
    name: 'Vision',
    attack: true,
    power: 'esp',
    fx: [
      { k: 'dmg', v: 10, type: 'psychique' },
      { k: 'will', v: -300 },
    ],
  }),
  trouble: spell({ name: 'Trouble', dtype: 'psychique', power: 'esp', fx: [{ k: 'state', s: 'confusion', dur: 40 }] }),
  sommeil: spell({ name: 'Sommeil', dtype: 'psychique', power: 'esp', fx: [{ k: 'stun', v: 40 }] }),
  egide: spell({ name: 'Égide', target: 'ally', range: 3, power: 'foi', coef: 6000, fx: [{ k: 'state', s: 'bouclier', v: 50, dur: 100 }] }),
  soin_mineur: { ...golden.skills.soin_mineur!, coef: 4000, p: { heal: 40, critDmg: 20 } },
  bouclier_foi: { ...golden.skills.bouclier_foi!, coef: 5000, p: { ...golden.skills.bouclier_foi!.p, shield: 30 } },
  regeneration: { ...golden.skills.regeneration!, coef: 600, p: { ...golden.skills.regeneration!.p, perTick: 5 } },
  peau_dure: passiveSkill('Peau dure', { res: 100 }),
  maitrise_elem: passiveSkill('Maîtrise élémentaire', { pow: 150 }),
  ferveur: passiveSkill('Ferveur', { heal: 150 }),
  sang_froid: passiveSkill('Sang-froid', { floor: 300 }),
  predateur: passiveSkill('Prédateur', { bonus: 200, threshold: 500 }),
  aura_protection: passiveSkill('Aura de protection', { res: 80 }),
};

const POW = (o: Partial<Powers> = {}): Powers => ({ for: 0, ele: 0, esp: 0, foi: 0, omb: 0, ...o });
const NO_RES = { contondant: 0, tranchant: 0, maladie: 0, psychique: 0, feu: 0, glace: 0, tenebres: 0, sacre: 0 };

let slots = { A: 0, B: 0 };
function unit(side: 0 | 1, o: Partial<UnitInput> & { act?: string; rules?: Rule[] } = {}): UnitInput {
  const key = side === 0 ? 'A' : 'B';
  const slot = slots[key]++;
  const { act, ...rest } = o;
  return {
    id: `${key}${slot + 1}`,
    side,
    slot,
    troop: `${side}-${slot}`,
    kind: 'test',
    name: `${key}${slot + 1}`,
    tags: [],
    hpMax: 1000,
    willMax: 100,
    energyMax: 300,
    manaMax: 300,
    pow: POW(),
    speed: 20,
    res: { ...NO_RES },
    weapon: { name: 'Épée', type: 'tranchant', dmg: 12, speed: 20, cost: 10 },
    hp: 1000,
    mana: 300,
    dist: 1,
    skills: act ? [act] : [],
    rules: act ? [{ cond: 'always', action: act, target: 'nearestEnemy' }] : [],
    ...rest,
  };
}

function fight(units: UnitInput[], params: Partial<typeof golden.params> = {}): BattleOutput {
  slots = { A: 0, B: 0 };
  return simuler({ engineVersion: 'v1', params: { ...golden.params, ...params }, skills: SKILLS, units }, 1);
}
/** Construit les unités après la remise à zéro des emplacements. */
const battle = (make: () => UnitInput[], params: Partial<typeof golden.params> = {}): BattleOutput => {
  slots = { A: 0, B: 0 };
  return fight(make(), params);
};
const first = (out: BattleOutput, pred: (e: LogEvent) => boolean): LogEvent => {
  const e = out.log.find(pred);
  if (!e) throw new Error('événement absent');
  return e;
};
const hitOn = (out: BattleOutput, u: string): LogEvent => first(out, (e) => e.k === 'hit' && e.u === u);

describe('moteur v1 : puissances (README 19.1, 19.2)', () => {
  it('sort : base + puissance × coefficient', () => {
    const out = battle(() => [unit(0, { act: 'lance_feu', pow: POW({ ele: 10 }) }), unit(1)]);
    expect(hitOn(out, 'B1')).toMatchObject({ raw: 28 + 15, final: 43, type: 'feu' });
  });

  it("capacité d'arme : dégâts de l'arme + Force", () => {
    const out = battle(() => [unit(0, { act: 'emploi', pow: POW({ for: 7, ele: 50 }) }), unit(1)]);
    expect(hitOn(out, 'B1')).toMatchObject({ raw: 12 + 7, type: 'tranchant' });
  });

  it('Rage ne modifie que la Force', () => {
    const rage = (act: string, pow: Partial<Powers>): number =>
      hitOn(
        battle(() => [unit(0, { act, skills: [act, 'rage'], pow: POW(pow), hp: 500 }), unit(1)]),
        'B1',
      ).raw as number;
    const bonus = SKILLS.rage!.p.atkPer10! * 5; // 50 % de PV perdus : 5 dizaines
    expect(rage('emploi', { for: 100 })).toBe(12 + Math.floor((100 * (1000 + bonus)) / 1000));
    expect(rage('lance_feu', { ele: 100 })).toBe(28 + 150);
  });

  it('Maîtrise élémentaire : Élémentaire +15 %', () => {
    const out = battle(() => [unit(0, { act: 'lance_feu', skills: ['lance_feu', 'maitrise_elem'], pow: POW({ ele: 10 }) }), unit(1)]);
    expect(hitOn(out, 'B1').raw).toBe(28 + Math.floor((11 * 1500) / 1000));
  });

  it('refuse une unité sans puissances', () => {
    slots = { A: 0, B: 0 };
    const { pow: _pow, ...bare } = unit(0, { act: 'emploi' });
    expect(() => simuler({ engineVersion: 'v1', params: golden.params, skills: SKILLS, units: [{ ...bare, atk: 5 }, unit(1)] }, 1)).toThrow(
      'sans puissances',
    );
  });

  it('refuse une version inconnue', () => {
    expect(() => simuler({ engineVersion: 'v9', params: golden.params, skills: SKILLS, units: [] }, 1)).toThrow(
      'version du moteur inconnue',
    );
  });
});

describe('moteur v1 : immunités (README 19.4)', () => {
  it('0 dégât, sans le minimum de 1', () => {
    const out = battle(() => [unit(0, { act: 'lance_feu', pow: POW({ ele: 10 }) }), unit(1, { immune: ['feu'] })]);
    expect(hitOn(out, 'B1')).toMatchObject({ final: 0, immune: true });
    expect(out.result.units.find((u) => u.id === 'B1')!.hp).toBe(1000);
  });

  it("une attaque évite l'immunisé s'il existe une autre cible", () => {
    const out = battle(() => [unit(0, { act: 'lance_feu', pow: POW({ ele: 10 }) }), unit(1, { immune: ['feu'] }), unit(1)]);
    expect(first(out, (e) => e.k === 'act' && e.u === 'A1').target).toBe('B2');
  });

  it("targetImmune vise l'immunisé, targetNotImmune l'autre", () => {
    const rule = (cond: string): Rule[] => [{ cond, action: 'lance_feu', target: 'nearestEnemy' }];
    const target = (cond: string): unknown =>
      first(
        battle(() => [unit(0, { skills: ['lance_feu'], rules: rule(cond), pow: POW({ ele: 10 }) }), unit(1), unit(1, { immune: ['feu'] })]),
        (e) => e.k === 'act' && e.u === 'A1',
      ).target;
    expect(target('targetImmune')).toBe('B2');
    expect(target('targetNotImmune')).toBe('B1');
  });

  it("bloque l'état de dégâts sur la durée du type", () => {
    const out = battle(() => [unit(0, { act: 'brule' }), unit(1, { immune: ['feu'] })]);
    expect(first(out, (e) => e.k === 'state' && e.u === 'B1')).toMatchObject({ s: 'brulure', op: 'immune' });
  });

  it('glace : pas de Gel, mais le Ralenti passe', () => {
    const out = battle(() => [unit(0, { act: 'gel' }), unit(1, { immune: ['glace'] })]);
    const states = out.log.filter((e) => e.k === 'state' && e.u === 'B1').slice(0, 2);
    expect(states).toMatchObject([
      { s: 'gele', op: 'immune' },
      { s: 'ralenti', op: 'add' },
    ]);
  });

  it('psychique : ni dégât, ni perte de volonté, ni Confusion, ni Sommeil', () => {
    const v = battle(() => [unit(0, { act: 'vision', pow: POW({ esp: 10 }) }), unit(1, { immune: ['psychique'] })]);
    expect(hitOn(v, 'B1')).toMatchObject({ final: 0, immune: true });
    expect(v.log.some((e) => e.k === 'gauge' && e.u === 'B1' && e.g === 'will')).toBe(false);
    const c = battle(() => [unit(0, { act: 'trouble' }), unit(1, { immune: ['psychique'] })]);
    expect(first(c, (e) => e.k === 'state' && e.u === 'B1')).toMatchObject({ s: 'confusion', op: 'immune' });
    const s = battle(() => [unit(0, { act: 'sommeil' }), unit(1, { immune: ['psychique'] })]);
    expect(first(s, (e) => e.k === 'state' && e.u === 'B1')).toMatchObject({ s: 'etourdi', op: 'immune' });
  });

  it('sans immunité, la volonté baisse (témoin)', () => {
    const v = battle(() => [unit(0, { act: 'vision', pow: POW({ esp: 10 }) }), unit(1)]);
    // La blessure du sort coûte d'abord un peu de volonté (woundWill), puis le sort en retire 30 %.
    const e = first(v, (x) => x.k === 'gauge' && x.u === 'B1' && x.g === 'will' && x.cause === 'Vision');
    expect((e.from as number) - (e.to as number)).toBe(30);
  });

  it('une escouade qui ne peut rien blesser perd à la durée limite', () => {
    const out = battle(() => [unit(0, { act: 'lance_feu', pow: POW({ ele: 10 }), dist: 3 }), unit(1, { immune: ['feu'] })]);
    expect(out.result).toMatchObject({ winner: 1, reason: 'timeout' });
    expect(out.result.units.find((u) => u.id === 'B1')!.hp).toBe(1000);
    expect(out.log.filter((e) => e.k === 'hit' && e.u === 'B1').every((e) => e.final === 0)).toBe(true);
  });
});

describe('moteur v1 : soins et boucliers en valeurs fixes (README 19.5)', () => {
  const wounded = (): UnitInput => unit(0, { hp: 100 });
  const healOf = (out: BattleOutput, u: string, cause: string): number => {
    const e = first(out, (x) => x.k === 'gauge' && x.u === u && x.g === 'hp' && x.cause === cause);
    return (e.to as number) - (e.from as number);
  };

  it('Soin mineur : 40 + 4 × FOI, puis × healMult', () => {
    const out = battle(() => [
      unit(0, {
        skills: ['soin_mineur'],
        rules: [{ cond: 'always', action: 'soin_mineur', target: 'mostWoundedAlly' }],
        pow: POW({ foi: 5 }),
      }),
      wounded(),
      unit(1),
    ]);
    expect(healOf(out, 'A2', 'Soin mineur')).toBe(Math.floor(((40 + 20) * golden.params.healMult!) / 1000));
  });

  it('Ferveur : soins donnés +15 %', () => {
    const out = battle(() => [
      unit(0, {
        skills: ['soin_mineur', 'ferveur'],
        rules: [{ cond: 'always', action: 'soin_mineur', target: 'mostWoundedAlly' }],
        pow: POW({ foi: 5 }),
      }),
      wounded(),
      unit(1),
    ]);
    expect(healOf(out, 'A2', 'Soin mineur')).toBe(Math.floor((Math.floor((60 * 1150) / 1000) * golden.params.healMult!) / 1000));
  });

  it('Bouclier de foi : 30 + 5 × FOI', () => {
    const out = battle(() => [
      unit(0, {
        skills: ['bouclier_foi'],
        rules: [{ cond: 'always', action: 'bouclier_foi', target: 'mostWoundedAlly' }],
        pow: POW({ foi: 4 }),
      }),
      unit(1),
    ]);
    expect(first(out, (e) => e.k === 'state' && e.s === 'bouclier')).toMatchObject({ op: 'add', v: 30 + 20 });
  });

  it('Régénération : 5 + 0,6 × FOI par tic', () => {
    const out = battle(() => [
      unit(0, {
        skills: ['regeneration'],
        rules: [{ cond: 'always', action: 'regeneration', target: 'mostWoundedAlly' }],
        pow: POW({ foi: 10 }),
        hp: 100,
      }),
      unit(1),
    ]);
    expect(first(out, (e) => e.k === 'state' && e.s === 'regeneration').v).toBe(5 + 6);
    expect(healOf(out, 'A1', 'Régénération')).toBe(Math.floor((11 * golden.params.healMult!) / 1000));
  });

  it('effet de bouclier (Égide) : 50 + 6 × FOI', () => {
    const out = battle(() => [
      unit(0, { skills: ['egide'], rules: [{ cond: 'always', action: 'egide', target: 'mostWoundedAlly' }], pow: POW({ foi: 5 }) }),
      unit(1),
    ]);
    expect(first(out, (e) => e.k === 'state' && e.s === 'bouclier').v).toBe(50 + 30);
  });
});

describe('moteur v1 : passifs de stats (contenu-cible-unites 3.6)', () => {
  it('Peau dure : contondant et tranchant +10 %', () => {
    const out = battle(() => [unit(0, { act: 'emploi', pow: POW({ for: 8 }) }), unit(1, { skills: ['peau_dure'] })]);
    expect(hitOn(out, 'B1')).toMatchObject({ raw: 20, final: 18 });
  });

  it('Aura de protection : alliés de son rang, toutes résistances +8 %', () => {
    const out = battle(() => [
      unit(0, { act: 'lance_feu', pow: POW({ ele: 48 }) }),
      unit(1),
      unit(1, { skills: ['aura_protection'], dist: 1 }),
    ]);
    // 28 + 72 = 100 brut, 8 % de résistance au feu.
    expect(hitOn(out, 'B1')).toMatchObject({ raw: 100, final: 92 });
  });

  it('Prédateur : +20 % sur une cible sous 50 % de PV', () => {
    const out = battle(() => [unit(0, { act: 'emploi', skills: ['emploi', 'predateur'], pow: POW({ for: 8 }) }), unit(1, { hp: 400 })]);
    expect(hitOn(out, 'B1').raw).toBe(Math.floor((20 * 1200) / 1000));
  });

  it('Sang-froid : la volonté ne descend pas sous 30 %', () => {
    const big = spell({ name: 'Effroi', fx: [{ k: 'will', v: -900 }] });
    slots = { A: 0, B: 0 };
    const out = simuler(
      {
        engineVersion: 'v1',
        params: golden.params,
        skills: { ...SKILLS, effroi: big },
        units: [unit(0, { act: 'effroi' }), unit(1, { skills: ['sang_froid'] })],
      },
      1,
    );
    expect(first(out, (e) => e.k === 'gauge' && e.u === 'B1' && e.g === 'will')).toMatchObject({ to: 30 });
  });
});

describe('moteur v1 : camp de 16 en duo', () => {
  it('joue 16 contre 16 et rend le propriétaire de chaque unité', () => {
    const out = battle(() => [
      ...Array.from({ length: 16 }, (_, i) =>
        unit(0, { act: 'emploi', pow: POW({ for: 6 }), owner: i < 8 ? 'p1' : 'p2', dist: 1 + (i % 3) }),
      ),
      ...Array.from({ length: 16 }, () => unit(1, { act: 'emploi', pow: POW({ for: 6 }) })),
    ]);
    expect(out.result.units).toHaveLength(32);
    expect(out.result.units.filter((u) => u.owner === 'p1')).toHaveLength(8);
    expect(out.result.units.filter((u) => u.owner === 'p2')).toHaveLength(8);
    expect(out.result.units.filter((u) => u.id.startsWith('B')).every((u) => u.owner === undefined)).toBe(true);
    expect(['wipe', 'timeout']).toContain(out.result.reason);
  });
});

describe('moteur : unité immobile (README 29.1)', () => {
  const moves = (out: BattleOutput, u: string): LogEvent[] => out.log.filter((e) => e.k === 'move' && e.u === u);
  const advance: Rule[] = [{ cond: 'always', action: 'avancer', target: 'self' }];

  it('sans le drapeau, une unité de l’arrière avance ; avec, elle reste en place', () => {
    // Le rang compte les rangées occupées : il faut un allié devant pour qu'« Avancer » ait un sens.
    const free = battle(() => [unit(0, { dist: 1, act: 'emploi' }), unit(0, { dist: 3, skills: ['emploi'], rules: advance }), unit(1)]);
    expect(moves(free, 'A2').length).toBeGreaterThan(0);
    const held = battle(() => [
      unit(0, { dist: 1, act: 'emploi' }),
      unit(0, { dist: 3, skills: ['emploi'], rules: advance, hold: true }),
      unit(1),
    ]);
    expect(moves(held, 'A2')).toEqual([]);
  });

  it('refuse aussi l’approche automatique quand plus personne ne peut frapper', () => {
    // Personne n'a de capacité : le combat est bloqué, les unités de l'arrière s'approchent d'elles-mêmes.
    const free = battle(() => [unit(0, { dist: 1 }), unit(0, { dist: 3 }), unit(1)]);
    expect(moves(free, 'A2').some((e) => e.cause === 'Approche automatique')).toBe(true);
    const held = battle(() => [unit(0, { dist: 1 }), unit(0, { dist: 3, hold: true }), unit(1)]);
    expect(moves(held, 'A2')).toEqual([]);
  });

  it('interdit une capacité qui déplace son lanceur (Charge)', () => {
    const charge = battle(() => [unit(0, { act: 'charge', dist: 3 }), unit(0, { dist: 1 }), unit(1)]);
    expect(moves(charge, 'A1').some((e) => e.cause === 'Charge')).toBe(true);
    const held = battle(() => [unit(0, { act: 'charge', dist: 3, hold: true }), unit(0, { dist: 1 }), unit(1)]);
    expect(moves(held, 'A1').some((e) => e.cause === 'Charge')).toBe(false);
  });

  it('un effet de l’adversaire la déplace quand même (repousser)', () => {
    const out = battle(() => [unit(0, { dist: 1, hold: true }), unit(1, { act: 'repousser' })]);
    expect(moves(out, 'A1').some((e) => e.cause === 'repoussé')).toBe(true);
  });

  it('ne change rien pour les unités sans le drapeau (combat identique)', () => {
    const make = (hold?: boolean) => () => [
      unit(0, { act: 'emploi', pow: POW({ for: 6 }), ...(hold === undefined ? {} : { hold }) }),
      unit(1, { act: 'emploi' }),
    ];
    const noStart = (o: BattleOutput) => o.log.filter((e) => e.k !== 'start');
    expect(noStart(battle(make(false)))).toEqual(noStart(battle(make())));
  });
});
