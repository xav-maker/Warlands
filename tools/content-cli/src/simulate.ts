/**
 * Simulation d'équilibrage (guide 5.3) : N combats par étape de chaque route, gardiens compris, contre
 * l'escouade de référence du palier de la route (balance/squads.yaml). Les rencontres sont tirées comme en
 * ligne (population × popMult, emplacements), le combat joué par le moteur de la version en ligne.
 *
 * Les escouades prennent la meilleure forme de leur niveau (donc les évolutions) et, par défaut, sont équipées
 * au palier de la route (un exemplaire moyen par emplacement). Cibles : voir `tierTarget`.
 * Rapport : taux de victoire, durée moyenne, unités perdues, or de l'étape et XP de base par combat.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { simuler } from '@cr/engine';
import { Rng, hash } from '@cr/rng';
import { battleUnits, bestForm, bestGear, dungeonRoute, genMonsters, room, routes, stepSpec, unitStats } from '@cr/gen';
import type { Dungeon, GenContent, PlayerTroop, PlayerUnit, Route } from '@cr/gen';
import YAML from 'yaml';

export interface StepSquad {
  offset?: number;
  troops?: [string, number][];
  /** false : sans équipement (tout début de partie). */
  gear?: boolean;
}
export interface Squad {
  /** Écart de niveau avec le niveau le plus haut des monstres de l'étape (0 : même niveau). */
  offset: number;
  troops: [string, number][];
  /** Réglages propres à une étape (1 à 5) : au début, l'escouade n'est pas pleine et son niveau est en retard. */
  steps?: Record<string, StepSquad>;
}
export interface StepReport {
  route: string;
  routeName: string;
  tier: number;
  step: number;
  stepName: string;
  guardian: boolean;
  level: [number, number];
  fights: number;
  winRate: number;
  avgTime: number;
  avgLosses: number;
  gold: number;
  xp: number;
}
export interface SimOptions {
  /** Combats par étape. */
  fights?: number;
  /** Escouades équipées au palier de la route (défaut) ; false : sans équipement. */
  gear?: boolean;
}

export const loadSquads = (file: string): Record<string, Squad> => YAML.parse(readFileSync(file, 'utf8')) as Record<string, Squad>;
export const SQUADS_FILE = join(import.meta.dirname, '../balance/squads.yaml');

/**
 * Taux de victoire visé par palier, escouade équipée au palier : 50 % au palier 1, 10 % au palier 5 (−10 points
 * par palier) ; les gardiens 5 points plus bas (45 % au palier 1, 5 % au palier 5).
 */
export const tierTarget = (tier: number, guardian: boolean): number => 0.5 - 0.1 * (tier - 1) - (guardian ? 0.05 : 0);
/** Écart toléré entre la moyenne simulée d'un palier et sa cible, en points de victoire (0,05 = 5 points). */
export const TOLERANCE = 0.05;
/** Écart toléré entre la moyenne d'une route et la cible de son palier (dispersion entre routes), et pour une étape. */
export const ROUTE_TOLERANCE = 0.05;
export const STEP_TOLERANCE = 0.1;

/**
 * Rampe de difficulté dans une route : les 4 premières étapes valent ce multiple de la cible du palier (leur moyenne
 * reste la cible). Palier 1 : départ très facile, car au début l'escouade n'est pas pleine ; les deux premières
 * étapes, les seules que beaucoup de joueurs voient d'abord, visent 90 % et 75 % [Xavier, 5 novembre 2026]. Le gardien
 * vise `tierTarget`.
 */
const RAMP: Record<number, number[]> = { 1: [1.8, 1.5, 0.6, 0.2] };
const DEFAULT_RAMP = [1.6, 1.2, 0.8, 0.4];
/** Taux de victoire visé pour l'étape `step` (1 à 5) d'une route du palier `tier`. */
export const stepTarget = (tier: number, step: number, guardian: boolean): number =>
  guardian ? tierTarget(tier, true) : tierTarget(tier, false) * (RAMP[tier] ?? DEFAULT_RAMP)[step - 1]!;

/** Escouade de joueur à pleine santé, meilleure forme du niveau (évolutions comprises), équipée ou non. */
export function squadOf(c: GenContent, s: Squad, level: number, gearTier?: number): PlayerTroop[] {
  const o = c.online!;
  let units = 0;
  let pop = 0;
  const out = s.troops.map(([type, rank]): PlayerTroop => {
    const t = c.troops[type];
    if (!t) throw new Error(`escouade : troupe inconnue ${type}`);
    units += t.units;
    pop += t.pop;
    const form = bestForm(t, level);
    const rng = new Rng(hash(level, type, gearTier ?? 0));
    const troop: PlayerTroop = {
      type,
      level,
      form,
      rank,
      units: Array.from({ length: t.units }, (): PlayerUnit => ({
        hp: 0,
        mana: 0,
        equip: gearTier ? bestGear(c, type, level, gearTier, rng) : {},
      })),
    };
    for (const u of troop.units) {
      const st = unitStats(c, troop, u);
      u.hp = st.hpMax;
      u.mana = st.manaMax;
    }
    return troop;
  });
  if (units > o.squad.maxUnits || pop > o.squad.maxPop)
    throw new Error(
      `escouade de niveau ${level} : ${units} unités et ${pop} de population (au plus ${o.squad.maxUnits} et ${o.squad.maxPop})`,
    );
  return out;
}

/** Escouade de référence d'une étape (1 à 5) : celle du palier, avec les réglages propres à l'étape s'il y en a. */
export function squadForStep(sq: Squad, step: number): Required<Pick<Squad, 'offset' | 'troops'>> & { gear: boolean } {
  const o = sq.steps?.[String(step)] ?? {};
  return { offset: o.offset ?? sq.offset, troops: o.troops ?? sq.troops, gear: o.gear ?? true };
}

/** Une étape d'une route (`si` : rang de l'étape, à partir de 0) : N combats contre l'escouade de référence. */
export function simulateStep(c: GenContent, R: Route, si: number, squads: Record<string, Squad>, opt: SimOptions = {}): StepReport {
  const { fights = 20, gear = true } = opt;
  const o = c.online!;
  const eco = c.eco as unknown as { xpPerMonsterLevelPop: number };
  const scale = (v: number): number => Math.max(1, Math.round(v * o.encounters.popMult));
  const st = R.steps[si]!;
  const ref = squadForStep(squads[String(R.tier)]!, si + 1);
  const squad = squadOf(c, ref, Math.min(30, Math.max(1, st.level[1] + ref.offset)), gear && ref.gear ? R.tier : undefined);
  const spec = stepSpec(st);
  let wins = 0;
  let time = 0;
  let losses = 0;
  let xp = 0;
  for (let k = 0; k < fights; k++) {
    const seed = (si + 1) * 7919 + k * 104729 + R.id.length;
    const side = genMonsters(c, { ...spec, pop: [scale(spec.pop[0]), scale(spec.pop[1])], slots: o.encounters.slots }, seed);
    const units = battleUnits(c, squad, side, {
      territory: R.tier - 1,
      guardianStep: !!st.guardian,
      guardianAdjust: o.guardianAdjust,
      ...(st.mult ? { mult: st.mult } : {}),
    });
    const res = simuler({ engineVersion: o.engineVersion, params: c.params, skills: c.skills, units }, seed).result;
    if (res.winner === 0) wins++;
    time += res.time;
    losses += res.units.filter((u, i) => units[i]!.side === 0 && u.dead).length;
    xp += side.troops.reduce((a, t) => a + t.level * c.troops[t.type]!.pop * eco.xpPerMonsterLevelPop, 0);
  }
  return {
    route: R.id,
    routeName: R.name,
    tier: R.tier,
    step: si + 1,
    stepName: st.name,
    guardian: !!st.guardian,
    level: st.level,
    fights,
    winRate: wins / fights,
    avgTime: Math.round(time / fights),
    avgLosses: Math.round((losses / fights) * 10) / 10,
    gold: st.gold,
    xp: Math.round(xp / fights),
  };
}

// ---------------------------------------------------------------------------------------------------------
// Donjons (README 23) : profondeur atteinte, PV persistants de salle en salle, sans consommable ni soin.

/** Niveau de l'escouade de référence dans un donjon : niveau minimal de la route + DUNGEON_OFFSET. */
export const DUNGEON_OFFSET = 4;
/** Cible [H] : le premier boss (salle 4) battu une fois sur deux, à DUNGEON_TOLERANCE près. */
export const DUNGEON_TARGET = 0.5;
export const DUNGEON_TOLERANCE = 0.2;

export interface DungeonReport {
  dungeon: string;
  name: string;
  tier: number;
  level: number;
  runs: number;
  /** Part des parties qui ont gagné au moins 1, 4, 8, 12 salles. */
  reach: Record<1 | 4 | 8 | 12, number>;
  median: number;
}

/** `runs` parties en solo contre le donjon, salle après salle jusqu'à la défaite (16 salles au plus). */
export function simulateDungeon(c: GenContent, d: Dungeon, squads: Record<string, Squad>, runs = 20): DungeonReport {
  const o = c.online!;
  const R = dungeonRoute(c, d);
  const level = Math.min(30, R.minLevel + DUNGEON_OFFSET);
  const regen = Number((c.eco as unknown as { manaRegenEnd: number }).manaRegenEnd);
  const depths: number[] = [];
  for (let k = 0; k < runs; k++) {
    let squad = squadOf(c, squads[String(R.tier)]!, level, R.tier);
    let n = 1;
    for (; n <= 16 && squad.length; n++) {
      const rm = room(c, d, n, false);
      const units = battleUnits(c, squad, genMonsters(c, rm.spec, 1000 * k + n), rm.options);
      const res = simuler({ engineVersion: o.engineVersion, params: c.params, skills: c.skills, units }, 7919 * k + n).result;
      if (res.winner !== 0) break;
      let i = 0;
      for (const t of squad)
        t.units = t.units.filter((u) => {
          const ur = res.units[i++]!;
          if (ur.dead) return false;
          const mx = unitStats(c, t, u).manaMax;
          u.hp = Math.max(1, ur.hp);
          u.mana = Math.min(mx, ur.mana + Math.floor((mx * regen) / 100));
          return true;
        });
      squad = squad.filter((t) => t.units.length);
    }
    depths.push(n - 1);
  }
  depths.sort((a, b) => a - b);
  const at = (x: number): number => depths.filter((y) => y >= x).length / runs;
  return {
    dungeon: d.id,
    name: d.name,
    tier: R.tier,
    level,
    runs,
    reach: { 1: at(1), 4: at(4), 8: at(8), 12: at(12) },
    median: depths[Math.floor(runs / 2)]!,
  };
}

export const simulateDungeons = (c: GenContent, squads: Record<string, Squad>, runs = 20): DungeonReport[] =>
  (c.dungeons ?? []).map((d) => simulateDungeon(c, d, squads, runs));

/** Section du rapport : profondeur atteinte dans chaque donjon. */
export function dungeonReport(rows: DungeonReport[]): string {
  const lines = [
    '## Donjons',
    '',
    `Escouade de référence du palier au niveau minimal de la route + ${DUNGEON_OFFSET}, équipée, pleine au départ, sans consommable ; PV persistants. Cible : premier boss (salle 4) battu ${pct(DUNGEON_TARGET)} des fois, à ${Math.round(DUNGEON_TOLERANCE * 100)} points près.`,
    '',
    '| Donjon | Palier | Niveau | ≥ 1 salle | ≥ 4 (boss 1) | ≥ 8 (boss 2) | ≥ 12 | Médiane | Verdict |',
    '|---|---|---|---|---|---|---|---|---|',
  ];
  for (const r of rows)
    lines.push(
      `| ${r.name} | ${r.tier} | ${r.level} | ${pct(r.reach[1])} | ${pct(r.reach[4])} | ${pct(r.reach[8])} | ${pct(r.reach[12])} | ${r.median} | ${Math.abs(r.reach[4] - DUNGEON_TARGET) <= DUNGEON_TOLERANCE ? 'dans la cible' : 'hors cible'} |`,
    );
  return lines.join('\n') + '\n';
}

export function simulate(c: GenContent, squads: Record<string, Squad>, opt: SimOptions | number = {}): StepReport[] {
  const o = typeof opt === 'number' ? { fights: opt } : opt;
  return routes(c).flatMap((R) => R.steps.map((_, si) => simulateStep(c, R, si, squads, o)));
}

const pct = (x: number): string => `${Math.round(x * 100)} %`;
const mean = (rows: StepReport[]): number => (rows.length ? rows.reduce((a, r) => a + r.winRate, 0) / rows.length : NaN);

export interface TierVerdict {
  tier: number;
  /** Moyenne des étapes (gardiens exclus) et des gardiens. */
  steps: number;
  guardians: number;
  stepsTarget: number;
  guardiansTarget: number;
  ok: boolean;
}

/** Moyenne simulée de chaque palier comparée à sa cible, à `TOLERANCE` près. */
export function verdicts(rows: StepReport[]): TierVerdict[] {
  return [...new Set(rows.map((r) => r.tier))]
    .sort((a, b) => a - b)
    .map((tier) => {
      const of = rows.filter((r) => r.tier === tier);
      const steps = mean(of.filter((r) => !r.guardian));
      const guardians = mean(of.filter((r) => r.guardian));
      const stepsTarget = tierTarget(tier, false);
      const guardiansTarget = tierTarget(tier, true);
      const near = (x: number, t: number): boolean => Number.isNaN(x) || Math.abs(x - t) <= TOLERANCE + 1e-9;
      return { tier, steps, guardians, stepsTarget, guardiansTarget, ok: near(steps, stepsTarget) && near(guardians, guardiansTarget) };
    });
}

export interface RouteGap {
  route: string;
  routeName: string;
  tier: number;
  steps: number;
  stepsTarget: number;
  /** Moyenne de la route moins la cible du palier. */
  gap: number;
  guardian: number;
  guardianTarget: number;
}

/** Moyenne des étapes (gardien exclu) de chaque route et écart à la cible du palier. */
export function routeGaps(rows: StepReport[]): RouteGap[] {
  return [...new Set(rows.map((r) => r.route))].map((route) => {
    const of = rows.filter((r) => r.route === route);
    const tier = of[0]!.tier;
    const steps = mean(of.filter((r) => !r.guardian));
    const stepsTarget = tierTarget(tier, false);
    return {
      route,
      routeName: of[0]!.routeName,
      tier,
      steps,
      stepsTarget,
      gap: steps - stepsTarget,
      guardian: mean(of.filter((r) => r.guardian)),
      guardianTarget: tierTarget(tier, true),
    };
  });
}

/** Rapport Markdown : une table par palier, la dispersion par route, puis la comparaison de chaque palier à sa cible. */
export function report(rows: StepReport[], squads: Record<string, Squad>, opt: { gear?: boolean } = {}): string {
  const lines: string[] = [
    '# Simulation d’équilibrage',
    '',
    opt.gear === false ? 'Escouades sans équipement.' : 'Escouades équipées au palier de la route.',
    '',
  ];
  for (const tier of [...new Set(rows.map((r) => r.tier))].sort((a, b) => a - b)) {
    const s = squads[String(tier)]!;
    lines.push(
      `## Palier ${tier} — escouade au niveau des monstres${s.offset ? ` ${s.offset > 0 ? '+' : ''}${s.offset}` : ''} : ${s.troops.map(([t]) => t).join(', ')}`,
      '',
    );
    lines.push('| Route | Étape | Niveaux | Victoires | Cible | Durée | Pertes | Or | XP |', '|---|---|---|---|---|---|---|---|---|');
    for (const r of rows.filter((x) => x.tier === tier))
      lines.push(
        `| ${r.routeName} | ${r.step}. ${r.stepName}${r.guardian ? ' (gardien)' : ''} | ${r.level[0]}-${r.level[1]} | ${pct(r.winRate)} | ${pct(stepTarget(r.tier, r.step, r.guardian))} | ${r.avgTime} | ${r.avgLosses} | ${r.gold} | ${r.xp} |`,
      );
    lines.push('');
  }
  lines.push(
    '## Dispersion par route',
    '',
    `Moyenne des étapes de chaque route contre la cible de son palier (tolérance ${Math.round(ROUTE_TOLERANCE * 100)} points).`,
    '',
    '| Route | Palier | Étapes | Cible | Écart | Gardien | Cible |',
    '|---|---|---|---|---|---|---|',
  );
  for (const g of routeGaps(rows))
    lines.push(
      `| ${g.routeName} | ${g.tier} | ${pct(g.steps)} | ${pct(g.stepsTarget)} | ${g.gap >= 0 ? '+' : '−'}${Math.round(Math.abs(g.gap) * 100)} | ${pct(g.guardian)} | ${pct(g.guardianTarget)} |`,
    );
  lines.push('');
  lines.push(
    '## Moyennes par palier et cibles',
    '',
    `Cible : 50 % au palier 1, −10 points par palier ; gardiens 5 points plus bas ; tolérance ${Math.round(TOLERANCE * 100)} points.`,
    '',
    '| Palier | Étapes | Cible | Gardiens | Cible | Verdict |',
    '|---|---|---|---|---|---|',
  );
  for (const v of verdicts(rows))
    lines.push(
      `| ${v.tier} | ${pct(v.steps)} | ${pct(v.stepsTarget)} | ${pct(v.guardians)} | ${pct(v.guardiansTarget)} | ${v.ok ? 'dans la cible' : 'hors cible'} |`,
    );
  return lines.join('\n') + '\n';
}
