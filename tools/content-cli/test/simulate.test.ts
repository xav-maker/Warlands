/**
 * Simulation d'équilibrage et différence de packs (guide 5.3) : la simulation est déterministe, couvre chaque
 * étape de chaque route, les escouades de référence sont équilibrées (soigneur, évolutions, équipement) et
 * le contenu publié respecte les taux de victoire visés par palier.
 */
import { join } from 'node:path';
import { validateContent } from '@cr/content';
import type { GenContent } from '@cr/gen';
import { routes } from '@cr/gen';
import { describe, expect, it } from 'vitest';
import { diffPacks } from '../src/diff.ts';
import { loadSquads, report, simulate, SQUADS_FILE, squadOf, tierTarget, TOLERANCE, verdicts } from '../src/simulate.ts';

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

  it('le contenu publié atteint les taux visés à chaque palier (escouades équipées)', () => {
    const rows = simulate(pack, squads, { fights: 20 });
    for (const v of verdicts(rows)) {
      expect(v.steps, `palier ${v.tier} : étapes`).toBeGreaterThanOrEqual(v.stepsTarget - TOLERANCE - 1e-9);
      expect(v.steps, `palier ${v.tier} : étapes`).toBeLessThanOrEqual(v.stepsTarget + TOLERANCE + 1e-9);
      expect(v.guardians, `palier ${v.tier} : gardiens`).toBeGreaterThanOrEqual(v.guardiansTarget - TOLERANCE - 1e-9);
      expect(v.guardians, `palier ${v.tier} : gardiens`).toBeLessThanOrEqual(v.guardiansTarget + TOLERANCE + 1e-9);
      expect(v.ok).toBe(true);
    }
  }, 180_000);
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
