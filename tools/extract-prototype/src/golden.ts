/**
 * Génère les combats de référence du moteur proto-0.4-ville (guide 4.2, étape 1).
 *
 * Les combats sont joués par le PROTOTYPE lui-même (prototype-extrait/, chargé dans un bac à sable) :
 * ses fonctions composent les escouades, tirent les rencontres (gardiens et rares compris) et
 * construisent l'entrée du moteur. Le journal obtenu est la vérité contre laquelle le moteur porté
 * (packages/engine) est vérifié. Tout est déterministe : relancer le script redonne les mêmes fichiers.
 *
 *   pnpm golden:v0.4        écrit packages/engine/golden/v0.4/
 */
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { loadPrototype } from './load.ts';

/* eslint-disable @typescript-eslint/no-explicit-any */
const P = loadPrototype();
const OUT = join(dirname(fileURLToPath(import.meta.url)), '../../../packages/engine/golden/v0.4');
const C = P.C;
const REGIONS: any[] = P.REGIONS;

interface Fight {
  id: string;
  label: string;
  seed: number;
  units: any[];
  log: any[];
  result: any;
}

const fights: Fight[] = [];
const r = new P.Rng(P.hash(0x0c1d, 'golden-v0.4'));
const pickOf = <T>(list: T[]): T => list[r.int(list.length)]!;

/** Troupes recrutables jusqu'à la région `ri` (comprise). */
const recruitable = (ri: number): string[] =>
  Object.keys(C.troops).filter((t) => !P.MONSTERS[t] && P.recruitRegion(t) >= 0 && P.recruitRegion(t) <= ri);

/** Une partie neuve avec une escouade tirée au hasard, au niveau du palier. */
function squadGame(seed: number, ri: number, level: number): any {
  const g = P.newGame(seed);
  g.troops = [];
  const pool = recruitable(ri);
  for (let tries = 0; tries < 10; tries++) {
    const type = pickOf(pool);
    const lvl = Math.max(1, Math.min(P.ECO.maxLevel, level + r.int(5) - 2));
    const t = P.addTroop(g, type, lvl, true);
    if (!t.squad) {
      g.troops.pop();
      continue;
    }
    // Forme : une évolution accessible au niveau, au hasard (README 9).
    t.form = pickOf<any>(P.formsAvailable(C.troops[type], lvl)).id;
    t.units = t.units.map(() => P.freshUnit(t));
    // Rang : parfois autre que le rang par défaut.
    if (r.int(4) === 0) t.rank = 1 + r.int(3);
    // Blessures : une unité sur six commence entamée.
    for (const u of t.units) if (r.int(6) === 0) u.hp = Math.max(1, Math.floor((u.hp * (20 + r.int(70))) / 100));
  }
  return g;
}

function encounterAt(g: any, ri: number, step: number, rare: boolean): void {
  g.where = 'territoire';
  g.terr = ri;
  g.dir = 1;
  g.step = step;
  g.outings = 1;
  g.cleared = REGIONS[ri].territory.steps.map(() => false);
  if (!rare) return P.newEncounter(g);
  const st = REGIONS[ri].territory.steps[step];
  const rareId = P.rareOfStep(st.id).id;
  const seed = P.hash(g.seed, 'rencontre', st.id, g.counter++);
  const spec = { level: st.level, pop: st.pop, pool: st.pool, forced: [...(st.forced ?? []), rareId] };
  g.encounter = { seed, rare: rareId, side: P.genMonsters(C, spec, seed) };
}

function play(label: string, input: any, seed: number): Fight {
  const { log, result } = P.simuler(input, seed);
  const f = { id: String(fights.length + 1).padStart(3, '0'), label, seed, units: JSON.parse(JSON.stringify(input.units)), log, result };
  fights.push(f);
  return f;
}

// 1. Rencontres de chaque étape de chaque région, gardiens compris : 8 par étape (200 combats).
for (let ri = 0; ri < REGIONS.length; ri++) {
  const steps = REGIONS[ri].territory.steps;
  for (let si = 0; si < steps.length; si++) {
    const st = steps[si];
    for (let k = 0; k < 8; k++) {
      const level = Math.max(REGIONS[ri].minLevel ?? 1, st.level[0] + r.int(3) - 1);
      const g = squadGame(P.hash(ri * 1000 + si * 10 + k, 'golden'), ri, level);
      encounterAt(g, ri, si, false);
      play(`r${ri + 1}-${st.id}${st.guardian ? '-gardien' : ''}`, P.buildInput(g), P.hash(g.encounter.seed, 'combat'));
    }
  }
}

// 2. Monstres rares : un combat par étape qui en a un.
for (let ri = 0; ri < REGIONS.length; ri++) {
  REGIONS[ri].territory.steps.forEach((st: any, si: number) => {
    if (st.guardian || !P.rareOfStep(st.id)) return;
    const g = squadGame(P.hash(ri * 1000 + si, 'rare'), ri, st.level[1] + 1);
    encounterAt(g, ri, si, true);
    play(`r${ri + 1}-${st.id}-rare`, P.buildInput(g), P.hash(g.encounter.seed, 'combat'));
  });
}

// 3. Couverture : chaque capacité active est lancée au moins une fois, chaque passif est présent.
const usedActive = new Set<string>();
const presentPassive = new Set<string>();
const scan = (f: Fight): void => {
  for (const e of f.log) if (e.k === 'act') usedActive.add(e.skill);
  for (const u of f.units) for (const s of u.skills) if (C.skills[s] && C.skills[s].kind !== 'active') presentPassive.add(s);
};
fights.forEach(scan);

const TARGET: Record<string, string> = { enemy: 'nearestEnemy', ally: 'mostWoundedAlly', self: 'self' };
for (const id of Object.keys(C.skills).sort()) {
  const sk = C.skills[id];
  const missing = sk.kind === 'active' ? !usedActive.has(id) : !presentPassive.has(id);
  if (!missing) continue;
  // Un combat de la région 3 où l'unité A1 reçoit la capacité, en tête de ses règles si elle est active.
  for (let attempt = 0; attempt < 6; attempt++) {
    const g = squadGame(P.hash(attempt, 'couverture', id), 2, 12);
    encounterAt(g, 2, attempt % 4, false);
    const input = P.buildInput(g);
    const u = input.units[0];
    u.skills = [...u.skills, id];
    if (sk.kind === 'active') u.rules = [{ cond: 'always', action: id, target: TARGET[sk.target] ?? 'nearestEnemy' }, ...u.rules];
    if (sk.mana > 0 && u.manaMax < sk.mana * 3) u.manaMax = u.mana = sk.mana * 3;
    if (sk.target === 'enemy') u.dist = 1; // au contact, pour avoir une cible à portée
    const f = play(`couverture-${id}`, input, P.hash(attempt, 'combat', id));
    scan(f);
    if (sk.kind !== 'active' || usedActive.has(id)) break;
    fights.pop();
  }
}

const notCovered = Object.keys(C.skills).filter((id) => (C.skills[id].kind === 'active' ? !usedActive.has(id) : !presentPassive.has(id)));

// Écriture : le contenu commun une fois, puis un fichier compressé par combat.
rmSync(OUT, { recursive: true, force: true });
mkdirSync(join(OUT, 'fights'), { recursive: true });
writeFileSync(
  join(OUT, 'content.json'),
  JSON.stringify({ engineVersion: P.ENGINE_VERSION, params: C.params, skills: C.skills }, null, 1) + '\n',
);
for (const f of fights) writeFileSync(join(OUT, 'fights', `${f.id}-${f.label}.json.gz`), gzipSync(JSON.stringify(f), { level: 9 }));

const summary = {
  engineVersion: P.ENGINE_VERSION,
  fights: fights.length,
  wins: fights.filter((f) => f.result.winner === 0).length,
  timeouts: fights.filter((f) => f.result.reason === 'timeout').length,
  events: fights.reduce((a, f) => a + f.log.length, 0),
  activeSkillsUsed: usedActive.size,
  passivesPresent: presentPassive.size,
  skillsTotal: Object.keys(C.skills).length,
  notCovered,
};
writeFileSync(join(OUT, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
console.log(summary, readdirSync(join(OUT, 'fights')).length, 'fichiers');
