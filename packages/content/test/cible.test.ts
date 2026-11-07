/** Contenu joué (content/) : les comptes du contenu cible (contenu-cible-monde.md, contenu-cible-unites.md). */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { checkReferences, loadContent, validateContent } from '../src/index.ts';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '../../../content');
const v = validateContent(DIR);
const raw = loadContent(DIR).raw!;
const from = (file: string): string[] => Object.keys(raw.origin).filter((k) => raw.origin[k] === file);

describe('contenu cible', () => {
  it('est valide, moteur v1', () => {
    expect(v.issues.filter((i) => i.level === 'error')).toEqual([]);
    expect(raw.params.online.engineVersion).toBe('v3');
  });

  it('20 régions, 29 routes, 96 + 20 rares', () => {
    expect(raw.regions).toHaveLength(20);
    expect(raw.routes).toHaveLength(29);
    expect(raw.rares).toHaveLength(116);
  });

  it('chaque ville nouvelle recrute 8 types, dont 6 nouveaux ; 90 troupes nouvelles', () => {
    expect(from('troops/cible.yaml')).toHaveLength(90);
    for (const R of raw.regions.slice(5)) expect(R.city.recruit).toHaveLength(8);
  });

  it('chaque troupe recrutable évolue jusqu’à une forme du niveau 20 (README 24)', () => {
    const recruitable = Object.entries(raw.troops).filter(([, t]) => t.region === undefined);
    expect(recruitable).toHaveLength(130);
    for (const [id, t] of recruitable) expect({ id, top: Math.max(...t.forms.map((f) => f.level)) }).toEqual({ id, top: 20 });
  });

  it('120 monstres de bestiaire et 24 gardiens', () => {
    const bestiaries = Object.values(raw.origin).filter((f) => /^monsters\/r(\d+)-/.exec(f) && Number(/r(\d+)-/.exec(f)![1]) >= 6);
    expect(bestiaries).toHaveLength(120);
    expect(from('monsters/gardiens-cible.yaml')).toHaveLength(24);
  });

  it('équipement : orbe, sceptre et talisman sur 5 paliers, 15 bases signatures dans l’atelier de leur ville', () => {
    const ids = from('items/bases/cible.yaml').map((k) => k.split('.')[1]!);
    for (const cat of ['orbe', 'sceptre', 'talisman'])
      expect(ids.filter((id) => raw.equip[id]!.cat === cat && !raw.equip[id]!.region)).toHaveLength(5);
    const sig = ids.filter((id) => raw.equip[id]!.region);
    expect(sig).toHaveLength(15);
    expect(new Set(sig.map((id) => raw.equip[id]!.region)).size).toBe(15);
  });

  it('60 capacités nouvelles : 54 actives et 6 passifs', () => {
    const ids = from('skills/cible.yaml').map((k) => k.split('.')[1]!);
    expect(ids.filter((id) => raw.skills[id]!.kind === 'active')).toHaveLength(54);
    expect(ids.filter((id) => raw.skills[id]!.kind === 'passive')).toHaveLength(6);
  });

  it('12 donjons : 48 monstres spéciaux, 36 boss avec leur trophée, 12 matériaux, 24 objets uniques (README 23)', () => {
    expect(raw.dungeons).toHaveLength(12);
    const ids = from('monsters/donjons.yaml').map((k) => k.split('.')[1]!);
    expect(ids.filter((id) => !raw.troops[id]!.boss)).toHaveLength(48);
    expect(ids.filter((id) => raw.troops[id]!.boss)).toHaveLength(36);
    expect(from('items/donjons.yaml')).toHaveLength(48);
    expect(from('items/bases/donjons.yaml')).toHaveLength(24);
    for (const id of from('items/bases/donjons.yaml').map((k) => k.split('.')[1]!))
      expect(raw.equip[id]).toMatchObject({ craft: false, budget: 1250 });
  });

  it('refuse un donjon mal formé', () => {
    const d = raw.dungeons![0]!;
    const bad = {
      ...raw,
      dungeons: [
        { ...d, pool: ['inconnu', d.bosses[0]!], bosses: [d.pool[0]!], material: 'epee', uniques: ['lame_1'] },
        { ...d, id: 'double', route: d.route },
      ],
    };
    const msgs = checkReferences(bad).map((i) => i.message);
    expect(msgs).toEqual(
      expect.arrayContaining([
        'monstre inconnu inconnu',
        `${d.bosses[0]} est un boss : il va dans bosses`,
        `${d.pool[0]} n'est pas un boss`,
        'matériau inconnu epee',
        "lame_1 : un objet unique n'est pas fabricable (craft: false)",
        `la route ${d.route} a déjà un donjon`,
      ]),
    );
  });
});
