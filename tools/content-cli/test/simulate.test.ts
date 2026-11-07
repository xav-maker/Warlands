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
import { rewriteMults, tuneRoute, tuneStep } from '../src/calibrate.ts';
import { diffPacks } from '../src/diff.ts';
import {
  DUNGEON_TARGET,
  DUNGEON_TOLERANCE,
  dungeonReport,
  simulateDungeons,
  loadSquads,
  report,
  RUN_TIER_TOLERANCE,
  RUN_TOLERANCE,
  RUNS,
  runReport,
  runTarget,
  runVerdicts,
  simulate,
  simulateRun,
  simulateRuns,
  SQUADS_FILE,
  squadForStep,
  squadOf,
  stepTarget,
  tierTarget,
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

  it('cibles : 91 % au palier 1, −7 points par palier, gardiens 75 % puis −7 points (6 novembre 2026)', () => {
    expect([1, 2, 3, 4, 5].map((t) => Math.round(tierTarget(t, false) * 100))).toEqual([91, 78, 71, 64, 57]);
    expect([1, 2, 3, 4, 5].map((t) => Math.round(tierTarget(t, true) * 100))).toEqual([75, 68, 61, 54, 47]);
    // La rampe de chaque palier descend d'étape en étape et garde sa moyenne.
    for (const t of [1, 2, 3, 4, 5]) {
      const ramp = [1, 2, 3, 4].map((s) => stepTarget(t, s, false));
      for (let i = 1; i < 4; i++) expect(ramp[i]!).toBeLessThan(ramp[i - 1]!);
      if (t > 1) expect(ramp.reduce((a, x) => a + x, 0) / 4).toBeCloseTo(tierTarget(t, false), 1);
    }
  });

  it('le rapport des routes complètes signale les routes et les paliers hors cible', () => {
    const one = { ...pack, routes: routes(pack).slice(0, 1) } as GenContent;
    const rows = simulateRuns(one, squads, 2).map((r) => ({ ...r, done: 1 }));
    expect(runReport(rows)).toContain('hors cible');
    expect(runVerdicts(rows)[0]!.ok).toBe(false);
    expect(report(simulate(one, squads, 2), squads)).toContain('| Forme |');
  });

  it('une route complète est déterministe et ne finit jamais plus souvent qu’elle ne gagne sa première étape', () => {
    const R = routes(pack)[0]!;
    const a = simulateRun(pack, R, squads, 4);
    expect(simulateRun(pack, R, squads, 4)).toEqual(a);
    expect(a.reach).toHaveLength(R.steps.length);
    for (let i = 1; i < a.reach.length; i++) expect(a.reach[i]!).toBeLessThanOrEqual(a.reach[i - 1]!);
    expect(a.done).toBe(a.reach.at(-1));
  });

  it('cibles de route : 60 % au palier 1, −6 points par palier [Xavier, 7 novembre 2026]', () => {
    expect([1, 2, 3, 4, 5].map((t) => Math.round(runTarget(t) * 100))).toEqual([60, 54, 48, 42, 36]);
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

  it('chaque route complète est finie la part de fois visée par son palier, et chaque palier en moyenne (README 33)', () => {
    const runs = simulateRuns(pack, squads, RUNS);
    for (const r of runs) {
      expect(near(r.done, runTarget(r.tier), RUN_TOLERANCE), `${r.routeName} : route finie ${r.done}`).toBe(true);
      // Le début de route est facile : la difficulté vient de l'usure, combat après combat.
      expect(r.reach[0], `${r.routeName} : première étape`).toBeGreaterThanOrEqual(0.85);
    }
    for (const t of runVerdicts(runs)) expect(near(t.done, t.target, RUN_TIER_TOLERANCE), `palier ${t.tier} : ${t.done}`).toBe(true);
  }, 300_000);

  it('aucune étape n’est un mur : à pleine vie, chaque combat se gagne au moins 7 fois sur 10, et le tout début est facile', () => {
    // Depuis le réglage de route (README 33), un combat isolé à pleine vie se gagne presque toujours ; la rampe de
    // difficulté se lit sur la route complète (PV et morts reportés), plus combat par combat.
    for (const r of rows) expect(r.winRate, `${r.routeName}, étape ${r.step}`).toBeGreaterThanOrEqual(0.7);
    // Palier 1 : l'escouade de départ (pas pleine, niveau en retard, sans équipement) passe la première étape presque toujours.
    for (const r of rows.filter((x) => x.tier === 1 && x.step === 1)) expect(r.winRate, r.routeName).toBeGreaterThanOrEqual(0.9);
  });

  it('palier 1 : les deux premières étapes visent 98 % et 95 % avec l’escouade de départ, niveau 1 et sans équipement', () => {
    expect(stepTarget(1, 1, false)).toBeCloseTo(0.98);
    expect(stepTarget(1, 2, false)).toBeCloseTo(0.95);
    const second = squadForStep(squads['1']!, 2);
    expect(second.gear).toBe(false);
    expect(second.troops).toEqual(squadForStep(squads['1']!, 1).troops);
    for (const r of rows.filter((x) => x.tier === 1 && x.step === 2)) expect(r.winRate, r.routeName).toBeGreaterThanOrEqual(0.85);
  });

  it('l’escouade de la première étape du palier 1 est celle du départ plus l’Acolyte, sans équipement', () => {
    const eco = pack.eco as unknown as { startTroops: [string, number][] };
    const first = squadForStep(squads['1']!, 1);
    expect(first.troops.map(([t]) => t).sort()).toEqual([...eco.startTroops.map(([t]) => t), 'acolyte'].sort());
    expect(first.gear).toBe(false);
    expect(first.offset).toBeLessThan(0);
  });
});

describe('premiers pas : peu de pertes [Xavier, 6 novembre 2026]', () => {
  it('au palier 1, les trois premières étapes coûtent en moyenne moins de 2 unités par combat (plus de 3 avant le réglage)', () => {
    const rows = simulate(pack, squads, { fights: 60 }).filter((r) => r.tier === 1 && r.step <= 3);
    const avg = rows.reduce((a, r) => a + r.avgLosses, 0) / rows.length;
    expect(avg).toBeLessThan(2);
  }, 300_000);
});

describe('réglage de la difficulté (calibrate)', () => {
  const yaml = [
    '# commentaire',
    '- id: r1',
    '  steps:',
    '    - id: a',
    '      mult: 100',
    '      level: [1, 2]',
    '    - id: b',
    '      mult: 200',
    '- id: r2',
    '  steps:',
    '    - id: a',
    '      mult: 300',
  ].join('\n');

  it('réécrit le mult de chaque étape de chaque route, et rien d’autre', () => {
    const tuned = [
      { route: 'r1', step: 'a', mult: 111, winRate: 0.9, target: 0.9 },
      { route: 'r1', step: 'b', mult: 222, winRate: 0.9, target: 0.9 },
      { route: 'r2', step: 'a', mult: 333, winRate: 0.9, target: 0.9 },
    ];
    const out = rewriteMults(yaml, tuned);
    expect(out).toBe(yaml.replace('100', '111').replace('200', '222').replace('300', '333'));
    expect(rewriteMults(yaml, [])).toBe(yaml);
  });

  it('le réglage de route multiplie toutes les étapes par le même facteur et rapproche la route de sa cible', () => {
    const one = structuredClone({ ...pack, routes: routes(pack).slice(0, 1) }) as GenContent;
    const R = routes(one)[0]!;
    const before = R.steps.map((st) => st.mult ?? 1000);
    const ts = tuneRoute(one, R.id, squads, 10);
    const ratios = ts.map((t, i) => t.mult / before[i]!);
    for (const x of ratios) expect(x).toBeCloseTo(ratios[0]!, 1);
    expect(Math.abs(ts[0]!.winRate - ts[0]!.target)).toBeLessThanOrEqual(0.2);
  });

  it('trouve un mult qui rapproche une étape de sa cible', () => {
    const one = { ...pack, routes: routes(pack).slice(0, 1) } as GenContent;
    const t = tuneStep(one, routes(one)[0]!.id, 2, squads, 20);
    expect(Math.abs(t.winRate - t.target)).toBeLessThanOrEqual(0.15);
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
