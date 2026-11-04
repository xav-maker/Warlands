/**
 * Donjons (README 23, guide 9.4) : salles, boss, difficulté croissante, butin ; contenu des 12 donjons joué par le
 * moteur (chaque salle de boss se termine).
 */
import { join } from 'node:path';
import { validateContent } from '@cr/content';
import { simuler } from '@cr/engine';
import { Rng } from '@cr/rng';
import { describe, expect, it } from 'vitest';
import {
  battleUnits,
  bestForm,
  bossTrophy,
  doorAppears,
  dungeonById,
  dungeonOfRoute,
  genEquip,
  genMonsters,
  room,
  roomBoss,
  rollRoomLoot,
  unitStats,
  type GenContent,
  type PlayerTroop,
  type PlayerUnit,
} from '../src/index.ts';

const compiled = validateContent(join(import.meta.dirname, '../../../content'));
const c = compiled.pack as unknown as GenContent;
const kobold = dungeonById(c, 'terriers_roi_kobold');

describe('contenu des donjons', () => {
  it('compte 12 donjons sur 12 routes différentes, 4 monstres et 3 boss chacun', () => {
    expect(compiled.ok).toBe(true);
    expect(c.dungeons).toHaveLength(12);
    expect(new Set(c.dungeons!.map((d) => d.route)).size).toBe(12);
    for (const d of c.dungeons!) {
      expect(d.pool).toHaveLength(4);
      expect(d.bosses).toHaveLength(3);
      for (const b of d.bosses) expect(bossTrophy(c, b), b).toBeTruthy();
      expect(d.name).toBeTruthy();
    }
    expect(dungeonOfRoute(c, 'pres_brande')?.id).toBe('terriers_roi_kobold');
    expect(dungeonOfRoute(c, 'ronces')).toBeNull();
  });

  it('ouvre une porte à 2 % sur une route à donjon seulement', () => {
    expect(doorAppears(c, 'pres_brande', 19)).toBe(true);
    expect(doorAppears(c, 'pres_brande', 20)).toBe(false);
    expect(doorAppears(c, 'ronces', 0)).toBe(false);
  });
});

describe('salles', () => {
  it('suit les formules du README 23.5 (route de niveau minimal 1)', () => {
    const r1 = room(c, kobold, 1, false);
    expect(r1).toMatchObject({ level: 3, pop: 4, boss: null, gold: 13 });
    expect(r1.spec).toMatchObject({ level: [3, 3], pop: [4, 4], forced: [], slots: 8 });
    expect(r1.options).toMatchObject({ territory: 0, guardianStep: false, guardianAdjust: 'guardian', mult: 1000 });
    expect(room(c, kobold, 3, false)).toMatchObject({ level: 4, pop: 6 });
    expect(room(c, kobold, 8, false)).toMatchObject({ level: 6, pop: 11, boss: 'chef_gratte_gratte' });
    expect(room(c, kobold, 20, false).pop).toBe(11);
    expect(room(c, kobold, 1, true)).toMatchObject({ pop: 8, spec: { slots: 16 } });
    expect(room(c, kobold, 9, true).pop).toBe(22);
  });

  it('fait se succéder les 3 boss toutes les 4 salles, puis recommence', () => {
    expect([1, 2, 3, 4, 8, 12, 16, 20].map((n) => roomBoss(c, kobold, n))).toEqual([
      null,
      null,
      null,
      'taupe_reine',
      'chef_gratte_gratte',
      'roi_kobold',
      'taupe_reine',
      'chef_gratte_gratte',
    ]);
    expect(room(c, kobold, 4, false).options.guardianStep).toBe(true);
  });

  it('plafonne le niveau à 30 puis renforce les monstres de 6 % par niveau', () => {
    const top = dungeonById(c, 'abime_obsidienne'); // palier 5, niveau minimal 21
    expect(room(c, top, 13, false)).toMatchObject({ level: 29 });
    expect(room(c, top, 15, false)).toMatchObject({ level: 30, options: { mult: 1000 } });
    expect(room(c, top, 17, false)).toMatchObject({ level: 30, options: { mult: 1060 } });
    expect(room(c, top, 21, false).options.mult).toBe(1180);
  });

  it('tire des groupes déterministes qui tiennent dans la population et les emplacements, boss compris', () => {
    for (const d of c.dungeons!)
      for (const n of [1, 4, 7, 12]) {
        const rm = room(c, d, n, n % 2 === 0);
        const g = genMonsters(c, rm.spec, 1234 + n);
        expect(genMonsters(c, rm.spec, 1234 + n)).toEqual(g);
        const pop = g.troops.reduce((a, t) => a + c.troops[t.type]!.pop, 0);
        const units = g.troops.reduce((a, t) => a + t.units.length, 0);
        expect(pop, `${d.id} salle ${n}`).toBeLessThanOrEqual(rm.pop);
        expect(units).toBeLessThanOrEqual(rm.spec.slots ?? 8);
        if (rm.boss) expect(g.troops[0]!.type).toBe(rm.boss);
        for (const t of g.troops) expect([...d.pool, ...d.bosses]).toContain(t.type);
      }
  });
});

describe('butin de salle', () => {
  it('donne l’or de la salle et 2 tirages, du matériau du donjon surtout', () => {
    const counts = new Map<string, number>();
    for (let s = 0; s < 300; s++) {
      const l = rollRoomLoot(c, kobold, 2, s);
      expect(l.gold).toBe(15);
      for (const it of l.items) if ('id' in it) counts.set(c.items[it.id]!.kind, (counts.get(c.items[it.id]!.kind) ?? 0) + 1);
    }
    expect(counts.get('materiau')!).toBeGreaterThan(300); // 70 % de 600 tirages, 1 ou 2 par tirage fusionnés
    expect(counts.get('trophee')).toBeUndefined();
    expect(rollRoomLoot(c, kobold, 2, 7)).toEqual(rollRoomLoot(c, kobold, 2, 7));
  });

  it('laisse le trophée du boss, et parfois un objet unique plus fort que sa base', () => {
    let uniques = 0;
    for (let s = 0; s < 200; s++) {
      const l = rollRoomLoot(c, kobold, 4, s);
      expect(l.items).toContainEqual({ id: 'trophee_taupe_reine', qty: 1 });
      uniques += l.items.filter((it) => 'equip' in it && kobold.uniques.includes(it.equip.base)).length;
    }
    expect(uniques).toBeGreaterThan(25);
    expect(uniques).toBeLessThan(80);
    // Budget × 1,25 et une stat de plus que la base du palier.
    const u = genEquip(c, 'pioche_roi_kobold', new Rng(3), 1000);
    const b = genEquip(c, 'deuxmains_1', new Rng(3), 1000);
    expect(u.stats.length).toBeGreaterThanOrEqual(b.stats.length);
    expect(c.equip.pioche_roi_kobold!.nStats).toBe(3);
  });

  it('renforce le jet de l’équipement avec la salle, plafonné', () => {
    const rolls = (n: number) =>
      Array.from({ length: 200 }, (_, s) => rollRoomLoot(c, kobold, n, s).items)
        .flat()
        .flatMap((it) => ('equip' in it ? [it.equip.roll] : []));
    const avg = (xs: number[]) => xs.reduce((a, x) => a + x, 0) / xs.length;
    expect(avg(rolls(40))).toBeGreaterThan(avg(rolls(1)) + 200);
    expect(Math.max(...rolls(80))).toBeLessThanOrEqual(1400);
  });
});

describe('combats de salle joués par le moteur', () => {
  /** Escouade de test : trois troupes du niveau de la salle, sans équipement, à pleins PV. */
  const squad = (level: number): PlayerTroop[] =>
    (['milicien', 'acolyte', 'chasseur'] as const).map((type, i) => {
      const t = c.troops[type]!;
      const troop: PlayerTroop = {
        type,
        level,
        form: bestForm(t, level),
        rank: i === 0 ? 1 : 3,
        units: Array.from({ length: t.units }, (): PlayerUnit => ({ hp: 0, mana: 0, equip: {} })),
      };
      for (const u of troop.units) {
        const st = unitStats(c, troop, u);
        u.hp = st.hpMax;
        u.mana = st.manaMax;
      }
      return troop;
    });

  it('chaque salle de boss des 12 donjons se joue jusqu’au bout', () => {
    const o = c.online!;
    for (const d of c.dungeons!)
      for (const n of [4, 8, 12]) {
        const rm = room(c, d, n, false);
        const units = battleUnits(c, squad(rm.level), genMonsters(c, rm.spec, n), rm.options);
        expect(units.filter((u) => u.side === 1)[0]!.kind).toBe(rm.boss);
        const res = simuler({ engineVersion: o.engineVersion, params: c.params, skills: c.skills, units }, 99).result;
        expect(res.time, `${d.id} salle ${n}`).toBeGreaterThan(0);
      }
  });
});
