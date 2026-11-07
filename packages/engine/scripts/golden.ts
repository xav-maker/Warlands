/**
 * Références des versions corrigées du moteur (guide 4.2, étape 3).
 *
 * golden/v0.4 reste la vérité absolue : journaux joués par le prototype. Pour chaque version suivante,
 * ce script rejoue les mêmes entrées (plus des combats ciblés, golden/extra) et écrit :
 *   golden/<version>/manifest.json   empreinte SHA-256 et résultat de chaque journal
 *   golden/<version>/changed/        journaux complets des combats qui diffèrent de la version précédente
 * Le rapport dit, pour chaque combat changé, s'il fait intervenir la règle corrigée : un changement
 * inattendu se voit à la relecture.
 *
 *   pnpm --filter @cr/engine golden
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync, gzipSync } from 'node:zlib';
import { Rng, hash } from '@cr/rng';
import { ENGINE_VERSIONS, simuler } from '../src/index.ts';
import type { BattleInput, BattleOutput, Rule, UnitInput } from '../src/index.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../golden');
const content = JSON.parse(readFileSync(join(ROOT, 'v0.4/content.json'), 'utf8')) as Pick<BattleInput, 'params' | 'skills'>;

export interface GoldenInput {
  file: string;
  seed: number;
  units: UnitInput[];
}

const readGz = <T>(path: string): T => JSON.parse(gunzipSync(readFileSync(path)).toString('utf8')) as T;
const asJson = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
export const logHash = (out: BattleOutput): string =>
  createHash('sha256')
    .update(JSON.stringify(asJson(out.log)))
    .digest('hex');

/** Combats ciblés : l'unité A1 pose des brûlures puis lance Embrasement (2 combats seulement en v0.4). */
function extraInputs(base: GoldenInput[]): GoldenInput[] {
  const r = new Rng(hash(0x0e17, 'golden-extra'));
  const pool = base.filter((g) => !g.file.includes('couverture'));
  const out: GoldenInput[] = [];
  for (let k = 0; k < 24; k++) {
    const src = pool[r.int(pool.length)]!;
    const units = asJson(src.units);
    const u = units[0]!;
    const fire: Rule[] = [
      { cond: 'targetHasState', s: 'brulure', action: 'embrasement', target: 'nearestEnemy' },
      { cond: 'always', action: k % 2 ? 'mur_flammes' : 'boule_feu', target: 'nearestEnemy' },
      { cond: 'always', action: 'trait_flammes', target: 'nearestEnemy' },
    ];
    u.skills = [...u.skills, 'embrasement', 'mur_flammes', 'boule_feu', 'trait_flammes'];
    u.rules = [...fire, ...u.rules];
    u.manaMax = u.mana = Math.max(u.manaMax, 120);
    u.dist = 1 + r.int(3);
    // Les brûlures durent 12 instants (60 ramenés à la période de 4) : un lanceur rapide peut les embraser.
    u.speed = 4 + r.int(3);
    out.push({
      file: `x${String(k + 1).padStart(2, '0')}-embrasement-${src.file.replace(/\.json\.gz$/, '')}`,
      seed: hash(src.seed, 'extra', k),
      units,
    });
  }
  return out;
}

export function loadInputs(): GoldenInput[] {
  const dir = join(ROOT, 'v0.4/fights');
  const base = readdirSync(dir)
    .sort()
    .map((file) => ({ file, ...readGz<{ seed: number; units: UnitInput[] }>(join(dir, file)) }))
    .map(({ file, seed, units }) => ({ file, seed, units }));
  return [...base, ...readGz<GoldenInput[]>(join(ROOT, 'extra/inputs.json.gz'))];
}

/**
 * Migration neutre vers le moteur v1 (README 19.3, guide 4.2 étape 4) : les 5 puissances valent l'ancienne
 * attaque, les coefficients restent à 1 000. Seuls les soins et boucliers doivent alors changer.
 */
export const toV1 = (units: UnitInput[]): UnitInput[] =>
  units.map(({ atk, ...u }) => ({ ...u, pow: { for: atk!, ele: atk!, esp: atk!, foi: atk!, omb: atk! } }));

/** Versions qui lisent les puissances (entrées migrées par toV1). */
const V1_PLUS = new Set(['v1', 'v2', 'v3']);

export const play = (version: string, g: GoldenInput): BattleOutput =>
  simuler({ ...content, engineVersion: version, units: V1_PLUS.has(version) ? toV1(g.units) : g.units }, g.seed);

/** Empreinte du déroulé, sans l'événement de départ (qui recopie l'entrée, migrée en v1). */
const bodyHash = (out: BattleOutput): string => logHash({ ...out, log: out.log.slice(1) });

/** Un combat fait-il intervenir un soin, une régénération ou un bouclier ? */
const healsOrShields = (out: BattleOutput): boolean =>
  out.log.some(
    (e) =>
      (e.k === 'gauge' && e.g === 'hp' && (e.to as number) > (e.from as number)) ||
      (e.k === 'state' && (e.s === 'bouclier' || e.s === 'regeneration')) ||
      (e.k === 'passive' && typeof e.text === 'string' && e.text.includes('recharge')),
  );

/** Ce qui, dans un combat, relève de chaque correction : sert au rapport de relecture. */
const touches: Record<string, (g: GoldenInput, out: BattleOutput) => boolean> = {
  'proto-0.4.1': (_g, out) => out.log.some((e) => e.k === 'act' && e.skill === 'embrasement'),
  'proto-0.4.2': (g) => g.units.some((u) => u.rules.some((r) => r.cond === 'allyHpBelow')),
  v1: (_g, out) => healsOrShields(out),
  // Le contenu de référence n'a pas les paramètres d'épuisement : seule la volonté en points peut changer un combat.
  v2: (_g, out) => out.log.some((e) => e.k === 'gauge' && e.g === 'will'),
  v3: (g, out) => g.units.some((u) => u.rules.some((r) => r.cond === 'allyHpBelow')) || out.log.some((e) => e.k === 'nomana'),
};

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const v04 = readdirSync(join(ROOT, 'v0.4/fights')).sort();
  const base = v04.map((file) => ({ file, ...readGz<{ seed: number; units: UnitInput[] }>(join(ROOT, 'v0.4/fights', file)) }));
  mkdirSync(join(ROOT, 'extra'), { recursive: true });
  writeFileSync(join(ROOT, 'extra/inputs.json.gz'), gzipSync(JSON.stringify(extraInputs(base)), { level: 9 }));

  const inputs = loadInputs();
  for (let i = 1; i < ENGINE_VERSIONS.length; i++) {
    const version = ENGINE_VERSIONS[i]!;
    const previous = ENGINE_VERSIONS[i - 1]!;
    const dir = join(ROOT, version);
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(join(dir, 'changed'), { recursive: true });
    const manifest: Record<string, { log: string; events: number; winner: number | null; reason: string; time: number }> = {};
    const changed: { file: string; related: boolean; winner: string }[] = [];
    for (const g of inputs) {
      const out = play(version, g);
      const before = play(previous, g);
      manifest[g.file] = {
        log: logHash(out),
        events: out.log.length,
        winner: out.result.winner,
        reason: out.result.reason,
        time: out.result.time,
      };
      if (bodyHash(before) !== bodyHash(out)) {
        const related = touches[version]?.(g, out) || touches[version]?.(g, before) || false;
        changed.push({ file: g.file, related, winner: `${before.result.winner} → ${out.result.winner}` });
        writeFileSync(
          join(dir, 'changed', g.file.endsWith('.gz') ? g.file : `${g.file}.json.gz`),
          gzipSync(JSON.stringify(asJson(out)), { level: 9 }),
        );
      }
    }
    writeFileSync(join(dir, 'manifest.json'), JSON.stringify({ engineVersion: version, previous, fights: manifest }, null, 1) + '\n');
    const unrelated = changed.filter((c) => !c.related);
    const flips = changed.filter((c) => c.winner.split(' → ')[0] !== c.winner.split(' → ')[1]);
    console.log(
      `${version} (depuis ${previous}) : ${changed.length}/${inputs.length} combats changés, ${flips.length} changent de vainqueur, ${unrelated.length} sans lien avec la correction`,
    );
    for (const c of unrelated) console.log(`  sans lien : ${c.file}`);
  }
}
