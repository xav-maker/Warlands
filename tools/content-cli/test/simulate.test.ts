/**
 * Simulation d'équilibrage et différence de packs (guide 5.3) : la simulation est déterministe, couvre chaque
 * étape de chaque route, les escouades de référence sont équilibrées (soigneur, évolutions, équipement) et
 * le contenu publié respecte les taux de victoire visés par palier.
 */
import { join } from 'node:path';
import { validateContent } from '@cr/content';
import type { GenContent } from '@cr/gen';
import { battleUnits, genMonsters, routes, stepSpec } from '@cr/gen';
import { beforeAll, describe, expect, it } from 'vitest';
import { diffPacks } from '../src/diff.ts';
import {
  DUNGEON_TARGET,
  DUNGEON_TOLERANCE,
  dungeonReport,
  simulateDungeons,
  loadSquads,
  report,
  ROUTE_TOLERANCE,
  routeGaps,
  simulate,
  SQUADS_FILE,
  squadForStep,
  squadOf,
  STEP_TOLERANCE,
  stepTarget,
  tierTarget,
  TOLERANCE,
  verdicts,
} from '../src/simulate.ts';

const v = validateContent(join(import.meta.dirname, '../../../content'));
const pack = v.pack as unknown as GenContent;
const squads = loadSquads(SQUADS_FILE);
const tiers = [...new Set(routes(pack).map((r) => r.tier))].sort((a, b) => a - b);

describe('escouades de référence', () => {
  it('le contenu est valide', () => expect(v.ok).toBe(true));

  it('respectent les limites d’escouade du contenu à plusieurs niveaux, équipées ou non', () => {
    for (const tier of tiers)
      for (const level of [1, 10, 20, 30])
        for (const gearTier of [undefined, tier])
          expect(() => squadOf(pack, squads[String(tier)]!, level, gearTier), `palier ${tier}, niveau ${level}`).not.toThrow();
  });

  it('comptent chacune un soigneur et un tank', () => {
    for (const tier of tiers) {
      const roles = squads[String(tier)]!.troops.map(([t]) => pack.troops[t]!.role ?? '');
      expect(
        roles.some((r) => r.includes('soin')),
        `palier ${tier} : soigneur`,
      ).toBe(true);
      expect(
        roles.some((r) => /tank|protection/.test(r)),
        `palier ${tier} : tank`,
      ).toBe(true);
    }
  });

  it('prennent la forme évoluée quand le niveau la permet', () => {
    for (const tier of tiers)
      for (const level of [9, 10, 19, 20, 30])
        for (const t of squadOf(pack, squads[String(tier)]!, level)) {
          const forms = pack.troops[t.type]!.forms.filter((f) => f.level <= level);
          expect(t.form, `${t.type} au niveau ${level}`).toBe(forms[forms.length - 1]!.id);
          if (level >= 20 && pack.troops[t.type]!.forms.some((f) => f.level === 20))
            expect(t.form).not.toBe(pack.troops[t.type]!.forms[0]!.id);
        }
  });

  it('sont équipées dans chaque emplacement que la troupe accepte, à pleine vie', () => {
    for (const tier of tiers) {
      const level = routes(pack).find((r) => r.tier === tier)!.steps[0]!.level[1];
      for (const t of squadOf(pack, squads[String(tier)]!, level, tier))
        for (const u of t.units) {
          for (const slot of Object.keys(pack.troopSlots[t.type]!)) expect(u.equip[slot], `${t.type} : ${slot}`).toBeTruthy();
          expect(u.hp).toBeGreaterThan(0);
        }
    }
  });

  it('l’équipement augmente la vie et le mana de départ', () => {
    const level = 15;
    const nu = squadOf(pack, squads['3']!, level);
    const stuffe = squadOf(pack, squads['3']!, level, 3);
    expect(stuffe.flatMap((t) => t.units).reduce((a, u) => a + u.hp, 0)).toBeGreaterThan(
      nu.flatMap((t) => t.units).reduce((a, u) => a + u.hp, 0),
    );
  });
});

describe('simulation', () => {
  it('couvre chaque étape de chaque route, de façon déterministe', () => {
    const one = { ...pack, routes: routes(pack).slice(0, 1) } as GenContent;
    const a = simulate(one, squads, 3);
    expect(a).toHaveLength(routes(one)[0]!.steps.length);
    expect(a.filter((r) => r.guardian)).toHaveLength(1);
    for (const r of a) {
      expect(r.winRate).toBeGreaterThanOrEqual(0);
      expect(r.winRate).toBeLessThanOrEqual(1);
      expect(r.avgTime).toBeGreaterThan(0);
    }
    expect(simulate(one, squads, 3)).toEqual(a);
  });

  it('une escouade équipée gagne au moins autant qu’une escouade nue', () => {
    const one = {
      ...pack,
      routes: routes(pack)
        .filter((r) => r.tier === 3)
        .slice(0, 2),
    } as GenContent;
    const total = (gear: boolean): number => simulate(one, squads, { fights: 6, gear }).reduce((a, r) => a + r.winRate, 0);
    expect(total(true)).toBeGreaterThan(total(false));
  });

  it('cibles : 50 % au palier 1, −10 points par palier, gardiens 5 points plus bas', () => {
    expect([1, 2, 3, 4, 5].map((t) => Math.round(tierTarget(t, false) * 100))).toEqual([50, 40, 30, 20, 10]);
    expect([1, 2, 3, 4, 5].map((t) => Math.round(tierTarget(t, true) * 100))).toEqual([45, 35, 25, 15, 5]);
  });

  it('le rapport signale les paliers hors cible', () => {
    const one = { ...pack, routes: routes(pack).slice(0, 1) } as GenContent;
    const rows = simulate(one, squads, 2).map((r) => ({ ...r, winRate: 1 }));
    expect(report(rows, squads)).toContain('hors cible');
    expect(verdicts(rows)[0]!.ok).toBe(false);
  });

  it('le multiplicateur d’étape (mult) renforce les PV et l’attaque des monstres', () => {
    const R = routes(pack)[0]!;
    const st = R.steps[1]!;
    const squad = squadOf(pack, squads['1']!, 5);
    const group = genMonsters(pack, stepSpec(st), 1);
    const o = { territory: 0, guardianStep: false, guardianAdjust: pack.online!.guardianAdjust };
    const foes = (mult?: number) => battleUnits(pack, squad, group, { ...o, ...(mult ? { mult } : {}) }).filter((u) => u.side === 1);
    const [plain, same, double] = [foes(), foes(1000), foes(2000)];
    expect(same.map((u) => u.hpMax)).toEqual(plain.map((u) => u.hpMax));
    plain.forEach((u, i) => expect(double[i]!.hpMax).toBeGreaterThanOrEqual(u.hpMax * 2 - 1));
    expect(double.some((u, i) => u.hpMax > plain[i]!.hpMax)).toBe(true);
  });
});

describe('équilibrage du contenu publié (60 combats par étape, escouades équipées)', () => {
  let rows: ReturnType<typeof simulate> = [];
  beforeAll(() => {
    rows = simulate(pack, squads, { fights: 60 });
  }, 300_000);
  const near = (x: number, target: number, tol: number): boolean => Math.abs(x - target) <= tol + 1e-9;

  it('chaque palier atteint ses taux visés', () => {
    for (const v of verdicts(rows)) {
      expect(near(v.steps, v.stepsTarget, TOLERANCE), `palier ${v.tier} : étapes ${v.steps}`).toBe(true);
      expect(near(v.guardians, v.guardiansTarget, TOLERANCE), `palier ${v.tier} : gardiens ${v.guardians}`).toBe(true);
      expect(v.ok).toBe(true);
    }
  });

  it('les routes d’un même palier ont la même difficulté', () => {
    for (const g of routeGaps(rows)) {
      expect(near(g.steps, g.stepsTarget, ROUTE_TOLERANCE), `${g.routeName} : étapes ${g.steps}`).toBe(true);
      expect(near(g.guardian, g.guardianTarget, STEP_TOLERANCE), `${g.routeName} : gardien ${g.guardian}`).toBe(true);
    }
  });

  it('chaque étape suit la rampe de son palier', () => {
    for (const r of rows)
      expect(
        near(r.winRate, stepTarget(r.tier, r.step, r.guardian), STEP_TOLERANCE),
        `${r.routeName}, étape ${r.step} : ${r.winRate}`,
      ).toBe(true);
  });

  it('chaque route monte en difficulté, et le tout début est facile', () => {
    for (const R of routes(pack)) {
      const of = rows.filter((r) => r.route === R.id && !r.guardian);
      for (let i = 1; i < of.length; i++)
        expect(of[i]!.winRate, `${R.name} : étape ${i + 1} contre ${i}`).toBeLessThanOrEqual(of[i - 1]!.winRate + 0.05);
      expect(of[0]!.winRate, `${R.name} : première étape`).toBeGreaterThan(of.at(-1)!.winRate);
    }
    // Palier 1 : l'escouade de départ (pas pleine, niveau en retard, sans équipement) passe la première étape presque toujours.
    for (const r of rows.filter((x) => x.tier === 1 && x.step === 1)) expect(r.winRate, r.routeName).toBeGreaterThanOrEqual(0.8);
  });

  it('l’escouade de la première étape du palier 1 est celle du départ plus l’Acolyte, sans équipement', () => {
    const eco = pack.eco as unknown as { startTroops: [string, number][] };
    const first = squadForStep(squads['1']!, 1);
    expect(first.troops.map(([t]) => t).sort()).toEqual([...eco.startTroops.map(([t]) => t), 'acolyte'].sort());
    expect(first.gear).toBe(false);
    expect(first.offset).toBeLessThan(0);
  });
});

describe('différence de packs', () => {
  const base = { id: 'a', skills: { x: { n: 1 }, y: { n: 2 } }, params: { p: 1 }, regions: [{ id: 'r1', v: 1 }] };

  it('ne signale rien entre deux packs identiques', () => {
    expect(diffPacks(base, structuredClone(base))).toContain('Aucune différence.');
  });

  it('liste les entrées ajoutées, retirées, modifiées et les règles changées', () => {
    const next = { id: 'b', skills: { x: { n: 5 }, z: { n: 3 } }, params: { p: 2 }, regions: [{ id: 'r1', v: 2 }] };
    const text = diffPacks(base, next);
    expect(text).toContain('## skills : +1 −1 ~1');
    expect(text).toContain('Ajoutés : z.');
    expect(text).toContain('Retirés : y.');
    expect(text).toContain('n : 1 → 5');
    expect(text).toContain('## regions : +0 −0 ~1');
    expect(text).toContain('params.p : 1 → 2');
  });
});

describe('équilibrage des donjons (README 23)', () => {
  it('chaque donjon : la première salle presque toujours gagnée, le premier boss battu une fois sur deux', () => {
    const rows = simulateDungeons(pack, squads, 20);
    expect(rows).toHaveLength(12);
    for (const r of rows) {
      expect(r.reach[1], `${r.name} : salle 1`).toBeGreaterThanOrEqual(0.9);
      expect(Math.abs(r.reach[4] - DUNGEON_TARGET), `${r.name} : premier boss ${r.reach[4]}`).toBeLessThanOrEqual(DUNGEON_TOLERANCE + 1e-9);
      expect(r.reach[8]).toBeLessThanOrEqual(r.reach[4]);
    }
    const md = dungeonReport(rows);
    expect(md).toContain('| Terriers du Roi Kobold | 1 | 5 |');
    expect(md).not.toContain('hors cible');
  });
});
