/** Page Équipement : candidats par emplacement et écarts de statistiques. */
import { describe, expect, it } from 'vitest';
import { genEquip } from '@cr/gen';
import { Rng } from '@cr/rng';
import { loadGameContent } from '../src/content.ts';
import { deltas, slotViews } from '../src/equipment.ts';
import type { PoolItem } from '../src/equipment.ts';
import { sheet } from '../src/stat-sheet.ts';

const { pack } = loadGameContent();
const milicien = { type: 'milicien', form: 'milicien', level: 1 };
const item = (base: string, roll: number, id: number, seed = id): PoolItem => {
  const e = genEquip(pack, base, new Rng(seed), roll);
  return { id, base, roll, stats: e.stats, from: 'sac' };
};

describe('page Équipement', () => {
  it('liste les emplacements de la troupe, vides quand rien n’est porté', () => {
    const slots = slotViews(pack, milicien, { equip: {} }, []);
    expect(slots.map((s) => s.slot)).toEqual(Object.keys(pack.troopSlots.milicien!));
    for (const s of slots) expect(s).toMatchObject({ current: null, candidates: [], locked: [] });
  });

  it('propose les objets du bon emplacement et de la bonne catégorie, avec leur effet', () => {
    const sword = item('lame_1', 1000, 1);
    const slots = slotViews(pack, milicien, { equip: {} }, [sword]);
    const arme = slots.find((s) => s.slot === 'arme')!;
    expect(arme.candidates.map((c) => c.id)).toEqual([1]);
    // L'effet annoncé est exactement ce que la fiche de stats donnerait avec l'objet porté.
    const bare = sheet(pack, { ...milicien, equip: {} });
    const worn = sheet(pack, { ...milicien, equip: { arme: genEquip(pack, 'lame_1', new Rng(1), 1000) } });
    expect(arme.candidates[0]!.deltas).toEqual(deltas(bare, worn));
    expect(arme.candidates[0]!.deltas.length).toBeGreaterThan(0);
    for (const s of slots.filter((x) => x.slot !== 'arme')) expect(s.candidates).toEqual([]);
  });

  it('compare à l’objet porté et signale un progrès ou un recul', () => {
    // Même tirage de statistiques, seule la qualité change.
    const weak = item('lame_1', 700, 1, 7);
    const strong = item('lame_1', 1300, 2, 7);
    const worn = { uid: '1', base: weak.base, roll: weak.roll, stats: weak.stats };
    const arme = slotViews(pack, milicien, { equip: { arme: worn } }, [strong]).find((s) => s.slot === 'arme')!;
    expect(arme.current).toMatchObject({ base: 'lame_1', roll: 700 });
    const up = arme.candidates[0]!.deltas;
    expect(up.length).toBeGreaterThan(0);
    expect(up.every((d) => d.good)).toBe(true);
    // Remplacer l'objet fort par le faible : tout recule.
    const back = slotViews(pack, milicien, { equip: { arme: { uid: '2', ...strong } } }, [weak]).find((s) => s.slot === 'arme')!;
    expect(back.candidates[0]!.deltas.every((d) => !d.good)).toBe(true);
  });

  it('range à part les objets trop hauts pour le niveau', () => {
    const tiers = Object.values(pack.equip).filter((b) => b.slot === 'arme' && b.cat === pack.troopSlots.milicien!.arme![0] && b.tier > 1);
    const high = tiers[0]!;
    const slots = slotViews(pack, milicien, { equip: {} }, [item(high.id, 1000, 3)]);
    const arme = slots.find((s) => s.slot === 'arme')!;
    expect(arme.candidates).toEqual([]);
    expect(arme.locked[0]).toMatchObject({ id: 3, locked: expect.stringContaining('niveau') });
  });

  it('ne plante pour aucune troupe, avec n’importe quel objet du jeu (la ligne de mana n’existe pas toujours)', () => {
    const pool = Object.values(pack.equip).map((b, i) => item(b.id, 1000, i + 1, 99));
    for (const [type, def] of Object.entries(pack.troops)) {
      if (!Object.keys(pack.troopSlots[type] ?? {}).length) continue;
      const slots = slotViews(pack, { type, form: def.forms[0]!.id, level: 30 }, { equip: {} }, pool);
      expect(slots.length).toBeGreaterThan(0);
    }
  });

  it('annonce le mana d’un objet pour une troupe qui n’en a pas', () => {
    const noMana = Object.keys(pack.troopSlots).find((ty) =>
      sheet(pack, { type: ty, form: pack.troops[ty]!.forms[0]!.id, level: 1 }).lines.every(
        (l) => l.label !== (pack.statCost.mana?.label ?? 'Mana max'),
      ),
    );
    const bare = sheet(pack, { type: noMana!, form: pack.troops[noMana!]!.forms[0]!.id, level: 1, equip: {} });
    const withMana = { ...bare, lines: [...bare.lines, { label: 'Mana max', base: 0, bonus: 10, total: 10 }] };
    expect(deltas(bare, withMana)).toContainEqual({ label: 'Mana max', diff: 10, good: true, unit: '' });
    expect(deltas(withMana, bare)).toContainEqual({ label: 'Mana max', diff: -10, good: false, unit: '' });
  });
});
