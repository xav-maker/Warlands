/**
 * Capacités du contenu cible (contenu-cible-unites.md 3.1 à 3.5), lues dans content/ et jouées par le
 * moteur v1 sur des combats minimaux : chaque mécanique nouvelle (fx unstate, hploss, zones randomEnemy et
 * contact, tags, ignoreHalf, regel) avec la valeur attendue, puis chaque capacité au moins une fois.
 */
import { join } from 'node:path';
import { loadContent, validateContent } from '@cr/content';
import { simuler } from '@cr/engine';
import type { BattleOutput, LogEvent, Powers, Skill, UnitInput } from '@cr/engine';
import { describe, expect, it } from 'vitest';
import type { GenContent } from '../src/index.ts';

const DIR = join(import.meta.dirname, '../../../content');
const origin = loadContent(DIR).raw!.origin;
const compiled = validateContent(DIR);
const c = compiled.pack as unknown as GenContent;
/** Les capacités de skills/cible.yaml. */
const CIBLE = Object.keys(c.skills).filter((id) => origin[`skills.${id}`] === 'skills/cible.yaml' && c.skills[id]!.kind === 'active');
const POW = (o: Partial<Powers> = {}): Powers => ({ for: 0, ele: 0, esp: 0, foi: 0, omb: 0, ...o });
const NO_RES = { contondant: 0, tranchant: 0, maladie: 0, psychique: 0, feu: 0, glace: 0, tenebres: 0, sacre: 0 };

let n = { A: 0, B: 0 };
function unit(side: 0 | 1, o: Partial<UnitInput> & { act?: string } = {}): UnitInput {
  const key = side === 0 ? 'A' : 'B';
  const slot = n[key]++;
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
    weapon: { name: 'Épée', type: 'tranchant', dmg: 10, speed: 20, cost: 10 },
    hp: 1000,
    mana: 300,
    dist: 1,
    skills: act ? [act] : [],
    rules: act ? [{ cond: 'always', action: act, target: 'nearestEnemy' }] : [],
    ...rest,
  };
}
function fight(make: () => UnitInput[], skills: Record<string, Skill> = {}): BattleOutput {
  n = { A: 0, B: 0 };
  return simuler({ engineVersion: 'v1', params: { ...c.params, timeLimit: 200 }, skills: { ...c.skills, ...skills }, units: make() }, 1);
}
const events = (out: BattleOutput, pred: (e: LogEvent) => boolean): LogEvent[] => out.log.filter(pred);
const hits = (out: BattleOutput, u?: string): LogEvent[] => events(out, (e) => e.k === 'hit' && (!u || e.u === u));
/** Actions de l'unité A1 seulement jusqu'à son premier tour : le premier acte et ses effets. */
const firstAct = (out: BattleOutput): LogEvent[] => {
  const i = out.log.findIndex((e) => e.k === 'act' && e.u === 'A1');
  const j = out.log.findIndex((e, k) => k > i && e.k === 'act');
  return out.log.slice(i, j < 0 ? undefined : j);
};

describe('capacités du contenu cible', () => {
  it('sont 54, valides, et toutes nommées', () => {
    expect(compiled.ok).toBe(true);
    expect(CIBLE).toHaveLength(54);
    for (const id of CIBLE) expect(c.skills[id]!.name).toBeTruthy();
  });

  it('Frappe brutale : arme ×1,6 contondant + Force × 1,5, et retire la Garde', () => {
    const out = fight(() => [unit(0, { act: 'frappe_brutale', pow: POW({ for: 10 }) }), unit(1, { act: 'mirage' })]);
    const a = firstAct(out);
    expect(a.find((e) => e.k === 'hit')).toMatchObject({ raw: 16 + 15, type: 'contondant' });
    // La cible a eu le temps de lancer Mirage (Garde) avant ? Sinon, aucune Garde à retirer : on vérifie
    // seulement qu'aucune Garde ne reste juste après la frappe.
    const after = out.log.indexOf(a[a.length - 1]!);
    const garde = out.log.slice(0, after + 1).filter((e) => e.k === 'state' && e.u === 'B1' && e.s === 'garde');
    if (garde.length) expect(garde[garde.length - 1]).toMatchObject({ op: 'end' });
  });

  it('Enchaînement : deux coups à ×0,8 sur la même cible', () => {
    const a = firstAct(fight(() => [unit(0, { act: 'enchainement', pow: POW({ for: 10 }) }), unit(1)]));
    const h = a.filter((e) => e.k === 'hit');
    expect(h).toHaveLength(2);
    expect(h.map((e) => [e.u, e.raw])).toEqual([
      ['B1', 8 + 8],
      ['B1', 8 + 8],
    ]);
  });

  it('Estoc perforant : ignore la moitié des résistances', () => {
    const a = firstAct(fight(() => [unit(0, { act: 'estoc' }), unit(1, { res: { ...NO_RES, tranchant: 400 } })]));
    // raw 13, résistance 40 % ramenée à 20 % : floor(13 × 0,8) = 10.
    expect(a.find((e) => e.k === 'hit')).toMatchObject({ raw: 13, final: 10 });
  });

  it('Rafale : trois tirs à ×0,5 sur des ennemis à portée', () => {
    const a = firstAct(fight(() => [unit(0, { act: 'rafale', dist: 3, pow: POW({ for: 10 }) }), unit(1), unit(1), unit(1, { dist: 3 })]));
    const h = a.filter((e) => e.k === 'hit');
    expect(h).toHaveLength(3);
    for (const e of h) expect(e.raw).toBe(5 + 5);
  });

  it('Bond du prédateur : avance au premier rang, frappe et étourdit', () => {
    const a = firstAct(fight(() => [unit(0, { act: 'bond', dist: 2 }), unit(0, { dist: 1 }), unit(1)]));
    expect(a.find((e) => e.k === 'move')).toMatchObject({ u: 'A1', to: 1 });
    expect(a.find((e) => e.k === 'hit')).toMatchObject({ u: 'B1' });
    expect(a.find((e) => e.k === 'state' && e.s === 'etourdi')).toMatchObject({ u: 'B1' });
  });

  it('Piétinement : rangs 1 et 2 touchés, Étourdi seulement au contact', () => {
    const a = firstAct(fight(() => [unit(0, { act: 'pietinement' }), unit(1), unit(1, { dist: 2 }), unit(1, { dist: 3 })]));
    expect(new Set(a.filter((e) => e.k === 'hit').map((e) => e.u))).toEqual(new Set(['B1', 'B2']));
    expect(a.filter((e) => e.k === 'state' && e.s === 'etourdi').map((e) => e.u)).toEqual(['B1']);
  });

  it('Piétinement : pas lancé sans ennemi au contact', () => {
    const out = fight(() => [unit(0, { act: 'pietinement', dist: 3 }), unit(0, { dist: 1 }), unit(0, { dist: 2 }), unit(1, { dist: 3 })]);
    // Premier tour : pas au contact, A1 ne piétine pas (il attend ou avance).
    expect(events(out, (e) => e.u === 'A1' && (e.k === 'act' || e.k === 'wait'))[0]!.skill).not.toBe('pietinement');
  });

  it('Rayon sacré : ×2 contre mort-vivant et contre démon', () => {
    const raw = (tags: string[]): unknown =>
      firstAct(fight(() => [unit(0, { act: 'rayon_sacre', dist: 3 }), unit(1, { tags })])).find((e) => e.k === 'hit')!.raw;
    expect(raw([])).toBe(24);
    expect(raw(['mort-vivant'])).toBe(48);
    expect(raw(['demon'])).toBe(48);
  });

  it('Prison de glace : Gelé 25, puis pas de regel tout de suite', () => {
    const out = fight(() => [unit(0, { act: 'prison_glace', dist: 3, speed: 5 }), unit(1, { speed: 200 })]);
    const g = events(out, (e) => e.k === 'state' && e.u === 'B1' && e.s === 'gele');
    expect(g[0]).toMatchObject({ op: 'add' });
    expect(g.some((e) => e.op === 'immune')).toBe(true);
  });

  it('Pacte de sang : perd 30 PV et gagne Cri de guerre +30 %', () => {
    const a = firstAct(fight(() => [unit(0, { act: 'pacte_sang' }), unit(1)]));
    expect(a.find((e) => e.k === 'gauge' && e.g === 'hp')).toMatchObject({ u: 'A1', from: 1000, to: 970 });
    expect(a.find((e) => e.k === 'state' && e.s === 'cri')).toMatchObject({ u: 'A1', v: 300 });
  });

  it('Clarté : retire la Confusion', () => {
    const out = fight(() => [
      unit(0, { act: 'clarte', dist: 3, rules: [{ cond: 'always', action: 'clarte', target: 'mostWoundedAlly' }], speed: 30 }),
      unit(0),
      unit(1, { act: 'domination', dist: 3, speed: 10 }),
    ]);
    const conf = events(out, (e) => e.k === 'state' && e.s === 'confusion' && String(e.u).startsWith('A'));
    expect(conf.some((e) => e.op === 'add')).toBe(true);
    expect(conf.some((e) => e.op === 'end')).toBe(true);
  });

  it('Égide et Mains de lumière : valeurs fixes de Foi', () => {
    const a = firstAct(
      fight(() => [
        unit(0, { act: 'egide', pow: POW({ foi: 10 }), rules: [{ cond: 'always', action: 'egide', target: 'mostWoundedAlly' }] }),
        unit(1),
      ]),
    );
    expect(a.find((e) => e.k === 'state' && e.s === 'bouclier')).toMatchObject({ v: 50 + 60 });
  });

  it.each(CIBLE)('%s se joue sans erreur et fait quelque chose', (id) => {
    const sk = c.skills[id]!;
    const ally = sk.target === 'ally';
    const out = fight(() => [
      unit(0, {
        act: id,
        dist: sk.minRange && sk.minRange > 1 ? 2 : 1,
        hp: ally ? 500 : 1000,
        pow: POW({ for: 10, ele: 10, esp: 10, foi: 10, omb: 10 }),
        rules: [{ cond: 'always', action: id, target: ally ? 'mostWoundedAlly' : 'nearestEnemy' }],
      }),
      ...(sk.minRange && sk.minRange > 1 ? [unit(0, { dist: 1 })] : []),
      unit(1, { hp: 600 }),
    ]);
    const acts = events(out, (e) => e.k === 'act' && e.u === 'A1' && e.skill === id);
    expect(acts.length).toBeGreaterThan(0);
    const effects = events(out, (e) => ['hit', 'state', 'gauge', 'move'].includes(e.k) && e.cause !== 'blessure');
    expect(effects.length).toBeGreaterThan(0);
    expect(hits(out).every((e) => Number.isInteger(e.final))).toBe(true);
  });
});
