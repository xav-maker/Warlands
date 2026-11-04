/**
 * Critère de J1 (guide 20) : l'annexe regénérée depuis le YAML est identique à docs/annexe-contenu.md,
 * générée à l'époque depuis le code du prototype. Seules la source et la date de l'en-tête sont des paramètres.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateContent } from '@cr/content';
import { describe, expect, it } from 'vitest';
import { annexe } from '../src/annexe.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');

describe('annexe de contenu', () => {
  it('regénérée depuis le pack du prototype (fixtures), elle est identique à docs/annexe-contenu.md', () => {
    const v = validateContent(join(ROOT, 'packages/content/fixtures/prototype-0.4'));
    expect(v.ok).toBe(true);
    const got = annexe(v.pack as never, { source: 'le code (`/mnt/project-files/prototype-ville/src/`)', date: '3 novembre 2026' });
    const want = readFileSync(join(ROOT, 'docs/annexe-contenu.md'), 'utf8');
    const g = got.split('\n');
    const first = want.split('\n').findIndex((l, i) => l !== g[i]);
    expect({ ligne: first + 1, texte: g[first] }).toEqual({ ligne: 0, texte: undefined });
    expect(got).toBe(want);
  });
});
