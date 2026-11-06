/** Fiche de statistiques (troupe, Codex) : mêmes chiffres que le moteur, avec équipement et renfort de monstre. */
import { describe, expect, it } from 'vitest';
import { genEquip } from '@cr/gen';
import { Rng } from '@cr/rng';
import { loadGameContent } from '../src/content.ts';
import { monsterLevel, monsterTier, sheet } from '../src/stat-sheet.ts';

const { pack } = loadGameContent();
const line = (s: ReturnType<typeof sheet>, label: string) => s.lines.find((l) => l.label === label)!;

describe('fiche de statistiques', () => {
  it('donne les chiffres du Milicien de niveau 1 (README 4.2) et le gain du niveau suivant', () => {
    const s = sheet(pack, { type: 'milicien', form: 'milicien', level: 1 });
    expect(line(s, 'PV max')).toMatchObject({ base: 300, total: 300, bonus: 0, next: 18 });
    expect(line(s, 'Volonté max')).toMatchObject({ total: 60, next: 1 });
    expect(line(s, 'Énergie max')).toMatchObject({ total: 150 });
    expect(line(s, 'Force').total).toBe(5);
    expect(line(s, 'Vitesse').total).toBe(20);
    expect(s.res).toMatchObject([{ label: 'tranchant', total: 10 }]);
    expect(s.hasBonus).toBe(false);
  });

  it('ajoute l’équipement, avec le bonus d’objet et la multiplication des jauges', () => {
    const sword = genEquip(pack, 'lame_1', new Rng(1), 1000);
    const bare = sheet(pack, { type: 'milicien', form: 'milicien', level: 1, equip: {} });
    const worn = sheet(pack, { type: 'milicien', form: 'milicien', level: 1, equip: { arme: sword } });
    expect(worn.hasBonus).toBe(true);
    expect(line(bare, 'Force').bonus).toBe(0);
    const gained = sword.stats.map((x) => x.k);
    expect(gained.length).toBeGreaterThan(0);
    for (const st of sword.stats) {
      if (st.k === 'for') expect(line(worn, 'Force').bonus).toBe(st.v * pack.itemBoost);
      if (st.k === 'hp') expect(line(worn, 'PV max').bonus).toBe(st.v * pack.itemBoost * pack.gaugeMult);
    }
    // Le total est celui du moteur : base + bonus d'équipement.
    for (const l of worn.lines) expect(l.total).toBe(l.base + l.bonus);
  });

  it('applique le renfort de la région aux PV, aux puissances et à l’arme d’un monstre', () => {
    const plain = sheet(pack, { type: 'gobelins', form: 'gobelin', level: 5 });
    const strong = sheet(pack, { type: 'gobelins', form: 'gobelin', level: 5, reinforce: 3 });
    const hp = (s: typeof plain) => line(s, 'PV max').total;
    expect(hp(strong)).toBe(Math.round((hp(plain) * pack.eco.monsterHp[3]!) / 1000));
    expect(line(strong, 'Force').total).toBe(Math.round((line(plain, 'Force').total * pack.eco.monsterAtk[3]!) / 1000));
    expect(strong.reinforce).toBe(3);
    // Volonté et énergie ne sont pas renforcées.
    expect(line(strong, 'Volonté max').total).toBe(line(plain, 'Volonté max').total);
  });

  it('s’arrête au niveau maximum et retrouve palier et niveau habituels d’un monstre', () => {
    expect(sheet(pack, { type: 'milicien', form: 'milicien', level: pack.eco.maxLevel }).hasNext).toBe(false);
    expect(monsterTier(pack, 'gobelins')).toBe(0);
    expect(monsterLevel(pack, 'gobelins')).toBeGreaterThanOrEqual(1);
  });

  it('place chaque monstre à un palier de renfort (étapes, gardiens, rares et boss de donjon)', () => {
    const lost = Object.keys(pack.monsters).filter((id) => monsterTier(pack, id) === undefined);
    expect(lost).toEqual([]);
    for (const id of Object.keys(pack.monsters)) expect(monsterTier(pack, id)).toBeLessThan(pack.eco.monsterHp.length);
    // Un boss de donjon prend le palier de la route de son donjon.
    const d = pack.dungeons![0]!;
    const route = pack.routes!.find((r) => r.id === d.route)!;
    expect(monsterTier(pack, d.bosses[0]!)).toBe(route.tier - 1);
  });
});
