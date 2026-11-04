/** Contenu joué (content/) : les comptes du contenu cible (contenu-cible-monde.md, contenu-cible-unites.md). */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadContent, validateContent } from '../src/index.ts';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '../../../content');
const v = validateContent(DIR);
const raw = loadContent(DIR).raw!;
const from = (file: string): string[] => Object.keys(raw.origin).filter((k) => raw.origin[k] === file);

describe('contenu cible', () => {
  it('est valide, moteur v1', () => {
    expect(v.issues.filter((i) => i.level === 'error')).toEqual([]);
    expect(raw.params.online.engineVersion).toBe('v1');
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

  it('120 monstres de bestiaire et 24 gardiens', () => {
    const bestiaries = Object.values(raw.origin).filter((f) => /^monsters\/r(\d+)-/.exec(f) && Number(/r(\d+)-/.exec(f)![1]) >= 6);
    expect(bestiaries).toHaveLength(120);
    expect(from('monsters/gardiens-cible.yaml')).toHaveLength(24);
  });

  it('60 capacités nouvelles : 54 actives et 6 passifs', () => {
    const ids = from('skills/cible.yaml').map((k) => k.split('.')[1]!);
    expect(ids.filter((id) => raw.skills[id]!.kind === 'active')).toHaveLength(54);
    expect(ids.filter((id) => raw.skills[id]!.kind === 'passive')).toHaveLength(6);
  });
});
