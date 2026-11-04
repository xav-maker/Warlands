/**
 * Port du générateur de stratégies du prototype (ia.ts) : sur le contenu du prototype, il redonne chaque
 * stratégie générée ; seules diffèrent celles écrites à la main (README 5.6 : les 10 troupes du banc d'essai,
 * les 7 monstres d'origine et les rares qui en dérivent).
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateContent } from '@cr/content';
import type { GenContent } from '@cr/gen';
import { describe, expect, it } from 'vitest';
import { genRules } from '../src/strategies.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const HAND_WRITTEN = [
  ...['milicien', 'frondeurs', 'acolyte', 'pyromancien', 'chasseur', 'berserker', 'loups', 'adepte', 'moine', 'briseur'],
  ...['gobelins', 'frondeurs_gob', 'loup_gris', 'araignee', 'chaman', 'troll', 'sylvain'],
  ...['rare_lisiere', 'rare_sentier', 'rare_nids', 'rare_camp'],
];

describe('stratégies par défaut (ia.ts)', () => {
  it('redonnent les stratégies générées du prototype', () => {
    const p = validateContent(join(ROOT, 'packages/content/fixtures/prototype-0.4')).pack as unknown as GenContent;
    const differ: string[] = [];
    for (const [id, t] of Object.entries(p.troops)) {
      const skills = [...new Set(t.forms.flatMap((f) => f.skills.map(([s]) => s)))];
      if (JSON.stringify(genRules(skills, p.skills)) !== JSON.stringify(t.rules)) differ.push(id);
    }
    expect(differ.sort()).toEqual([...HAND_WRITTEN].sort());
  });
});
