/**
 * Simulation d'équilibrage et différence de packs (guide 5.3) : la simulation est déterministe, couvre chaque
 * étape de chaque route, et les escouades de référence respectent les limites d'escouade du contenu.
 */
import { join } from 'node:path';
import { validateContent } from '@cr/content';
import type { GenContent } from '@cr/gen';
import { routes } from '@cr/gen';
import { describe, expect, it } from 'vitest';
import { diffPacks } from '../src/diff.ts';
import { loadSquads, report, simulate, SQUADS_FILE, squadOf } from '../src/simulate.ts';

const v = validateContent(join(import.meta.dirname, '../../../content'));
const pack = v.pack as unknown as GenContent;
const squads = loadSquads(SQUADS_FILE);

describe('simulation', () => {
  it('définit une escouade de référence valide pour chaque palier, à plusieurs niveaux', () => {
    expect(v.ok).toBe(true);
    for (const tier of new Set(routes(pack).map((r) => r.tier)))
      for (const level of [1, 10, 20, 30])
        expect(() => squadOf(pack, squads[String(tier)]!, level), `palier ${tier}, niveau ${level}`).not.toThrow();
  });

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

  it('le rapport liste chaque palier simulé et les étapes hors fourchette', () => {
    const one = { ...pack, routes: routes(pack).slice(0, 1) } as GenContent;
    const rows = simulate(one, squads, 2);
    const text = report(rows, squads, { min: 1.1, guardianMin: 1.1 });
    expect(text).toContain(`## Palier ${rows[0]!.tier}`);
    expect(text).toContain('## Hors de la fourchette visée');
    expect(text).not.toContain('Aucune étape.');
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
