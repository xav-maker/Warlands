/**
 * Combats de référence (guide 4.2, étape 2). Chaque combat a été joué par le prototype proto-0.4-ville
 * (tools/extract-prototype/src/golden.ts) ; le moteur porté doit redonner le même journal, événement par
 * événement. Le moindre écart fait échouer la CI, sauf changement de version du moteur.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { ENGINE_VERSION, simuler } from '../src/index.ts';
import type { BattleInput, BattleResult, LogEvent, UnitInput } from '../src/index.ts';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '../golden/v0.4');
const content = JSON.parse(readFileSync(join(DIR, 'content.json'), 'utf8')) as Pick<BattleInput, 'params' | 'skills'> & {
  engineVersion: string;
};

interface Golden {
  id: string;
  label: string;
  seed: number;
  units: UnitInput[];
  log: LogEvent[];
  result: BattleResult;
}

const files = readdirSync(join(DIR, 'fights')).sort();
const load = (f: string): Golden => JSON.parse(gunzipSync(readFileSync(join(DIR, 'fights', f))).toString('utf8')) as Golden;

/** Comme le fichier de référence : passage par JSON (les champs `undefined` disparaissent). */
const asJson = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

describe(`combats de référence ${content.engineVersion}`, () => {
  it('correspondent à la version du moteur', () => {
    expect(ENGINE_VERSION).toBe(content.engineVersion);
    expect(files.length).toBeGreaterThanOrEqual(200);
  });

  it.each(files)('%s', (file) => {
    const g = load(file);
    const out = asJson(simuler({ params: content.params, skills: content.skills, units: g.units }, g.seed));
    expect(out.result).toEqual(g.result);
    // Premier écart en clair, plutôt qu'un différentiel de milliers d'événements.
    const i = out.log.findIndex((e, k) => JSON.stringify(e) !== JSON.stringify(g.log[k]));
    if (i >= 0 || out.log.length !== g.log.length) {
      const at = i >= 0 ? i : Math.min(out.log.length, g.log.length);
      expect({ index: at, event: out.log[at] }).toEqual({ index: at, event: g.log[at] });
    }
  });

  it("n'altère pas son entrée", () => {
    const g = load(files[0]!);
    const units = asJson(g.units);
    simuler({ params: content.params, skills: content.skills, units }, g.seed);
    expect(units).toEqual(g.units);
  });
});
