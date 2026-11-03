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
import { ENGINE_VERSIONS, simuler } from '../src/index.ts';
import type { BattleInput, BattleResult, LogEvent, UnitInput } from '../src/index.ts';
import { loadInputs, logHash, play } from '../scripts/golden.ts';

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
    expect(ENGINE_VERSIONS).toContain(content.engineVersion);
    expect(files.length).toBeGreaterThanOrEqual(200);
  });

  it.each(files)('%s', (file) => {
    const g = load(file);
    const out = asJson(
      simuler({ engineVersion: content.engineVersion, params: content.params, skills: content.skills, units: g.units }, g.seed),
    );
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
    simuler({ engineVersion: content.engineVersion, params: content.params, skills: content.skills, units }, g.seed);
    expect(units).toEqual(g.units);
  });
});

/**
 * Versions corrigées (guide 4.2, étape 3) : mêmes entrées que v0.4, plus les combats ciblés de
 * golden/extra. Chaque journal doit avoir l'empreinte relevée à la génération, relue lors de la revue
 * (scripts/golden.ts ; les journaux qui ont changé sont gardés en entier dans <version>/changed/).
 */
interface Manifest {
  engineVersion: string;
  previous: string;
  fights: Record<string, { log: string; events: number; winner: number | null; reason: string; time: number }>;
}

const inputs = loadInputs();

describe.each(ENGINE_VERSIONS.slice(1))('combats de référence %s', (version) => {
  const manifest = JSON.parse(readFileSync(join(DIR, '..', version, 'manifest.json'), 'utf8')) as Manifest;

  it('couvrent toutes les entrées', () => {
    expect(manifest.engineVersion).toBe(version);
    expect(Object.keys(manifest.fights).sort()).toEqual(inputs.map((g) => g.file).sort());
  });

  it.each(inputs.map((g) => [g.file, g] as const))('%s', (file, g) => {
    const out = play(version, g);
    const m = manifest.fights[file]!;
    expect({ winner: out.result.winner, reason: out.result.reason, time: out.result.time, events: out.log.length }).toEqual({
      winner: m.winner,
      reason: m.reason,
      time: m.time,
      events: m.events,
    });
    expect(logHash(out)).toBe(m.log);
  });
});
