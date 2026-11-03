/**
 * Le pack compilé depuis content/ (YAML) doit redonner exactement le contenu du prototype
 * (packages/gen/golden/v0.4/content.json, tiré du prototype par tools/extract-prototype).
 * L'ordre des entrées, qui compte pour les tirages, est vérifié par les vecteurs de packages/gen,
 * rejoués sur ce pack.
 */
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { validateContent } from '../src/index.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const CONTENT = join(ROOT, 'content');
const snapshot = JSON.parse(readFileSync(join(ROOT, 'packages/gen/golden/v0.4/content.json'), 'utf8')) as Record<string, unknown>;

/** JSON aux clés d'objet triées : compare le contenu sans dépendre de l'ordre des champs. */
const canon = (v: unknown): unknown =>
  Array.isArray(v)
    ? v.map(canon)
    : v && typeof v === 'object'
      ? Object.fromEntries(
          Object.keys(v)
            .sort()
            .map((k) => [k, canon((v as Record<string, unknown>)[k])]),
        )
      : v;

describe('pack du prototype', () => {
  const v = validateContent(CONTENT);

  it('est valide', () => {
    expect(v.issues.filter((i) => i.level === 'error')).toEqual([]);
    expect(v.ok).toBe(true);
  });

  it('redonne le contenu du prototype', () => {
    const { id: _id, engineVersion: _ev, ...pack } = v.pack!;
    for (const key of Object.keys(snapshot)) expect({ key, value: canon(pack[key]) }).toEqual({ key, value: canon(snapshot[key]) });
    expect(Object.keys(pack).sort()).toEqual(Object.keys(snapshot).sort());
  });

  it("garde l'ordre des collections", () => {
    for (const key of ['skills', 'troops', 'items', 'equip', 'weapons', 'monsters'])
      expect({ key, order: Object.keys(v.pack![key] as object) }).toEqual({ key, order: Object.keys(snapshot[key] as object) });
  });

  it('a une empreinte stable', () => {
    expect(v.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(validateContent(CONTENT).hash).toBe(v.hash);
  });
});

describe('validation', () => {
  /** Copie de content/ modifiée par `edit`, puis validée. */
  function broken(rel: string, edit: (s: string) => string): string[] {
    const dir = mkdtempSync(join(tmpdir(), 'cr-content-'));
    try {
      cpSync(CONTENT, dir, { recursive: true });
      writeFileSync(join(dir, rel), edit(readFileSync(join(dir, rel), 'utf8')));
      return validateContent(dir)
        .issues.filter((i) => i.level === 'error')
        .map((i) => `${i.where} | ${i.message}`);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  it('refuse un champ inconnu (faute de frappe)', () => {
    expect(broken('weapons.yaml', (s) => s.replace('epee: {', 'epee: { dgats: 3,')).join('\n')).toMatch(/weapons\.yaml › epee/);
  });

  it('refuse une référence cassée', () => {
    expect(broken('troops/recrutables.yaml', (s) => s.replace('weapon: epee', 'weapon: epee_inconnue')).join('\n')).toMatch(
      /arme inconnue epee_inconnue/,
    );
    expect(broken('world/regions.yaml', (s) => s.replace('firstItem: coeur_ronce', 'firstItem: rien')).join('\n')).toMatch(
      /première victoire inconnu rien/,
    );
  });

  it('refuse un texte manquant', () => {
    expect(broken('texts/fr.yaml', (s) => s.replace(/^weapon\.epee\.name:.*\n/m, '')).join('\n')).toMatch(
      /texte manquant : weapon\.epee\.name/,
    );
  });

  it('refuse une table de butin qui ne totalise pas 100 %', () => {
    expect(broken('params.yaml', (s) => s.replace(/materiau: 85/, 'materiau: 80')).join('\n')).toMatch(/eco\.table totalise 95/);
  });

  it('refuse un identifiant défini deux fois', () => {
    const dup = broken('items/components.yaml', (s) => `${s}\nbois_tordu: { kind: materiau, tier: 1, value: 4, tags: [ bois ] }\n`);
    expect(dup.join('\n')).toMatch(/bois_tordu déjà défini/);
  });
});
