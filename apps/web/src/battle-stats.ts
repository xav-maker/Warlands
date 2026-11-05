/**
 * Statistiques d'un combat terminé (page du combat) : dégâts infligés et subis, soins, éliminations, par unité, par
 * camp et par capacité, avec les courbes qui montrent comment le combat s'est joué. Tout est lu dans le journal du
 * moteur (événements `start`, `act`, `hit`, `gauge`, `death`, `tick`), jamais recalculé avec d'autres formules : les
 * dégâts infligés d'une unité sont les mêmes que `dmgDealt` du résultat du moteur.
 */
import type { LogEvent } from '@cr/engine';

export interface InputUnit {
  id: string;
  side: number;
  name: string;
  hpMax: number;
}

export interface UnitStat {
  id: string;
  name: string;
  side: number;
  hpMax: number;
  /** Dégâts infligés aux ennemis (avant le bouclier), et nombre de coups. */
  dealt: number;
  hits: number;
  biggestHit: number;
  /** Dégâts reçus (avant le bouclier), dont la part absorbée par un bouclier. */
  taken: number;
  absorbed: number;
  /** Soins reçus (PV réellement rendus). */
  healedIn: number;
  /** Soins prodigués à un allié ou à soi-même (PV réellement rendus), quand le journal permet de l'attribuer. */
  healedOut: number;
  kills: number;
  /** Instant de la mort, sinon null. */
  diedAt: number | null;
}

export interface SideStat {
  side: number;
  dealt: number;
  taken: number;
  absorbed: number;
  healed: number;
  /** Soins que le journal n'attribue à aucune unité (régénération, effets dans la durée). */
  healedUnattributed: number;
  kills: number;
  deaths: number;
  hpStart: number;
  hpEnd: number;
  hpMax: number;
}

export interface CauseStat {
  side: number;
  cause: string;
  dealt: number;
  hits: number;
  healed: number;
}

export interface Series {
  side: number;
  name: string;
  /** Points (instant, valeur) d'une fonction en escalier. */
  pts: [number, number][];
}

export interface BattleStats {
  duration: number;
  units: UnitStat[];
  sides: [SideStat, SideStat];
  causes: CauseStat[];
  /** PV restants de chaque camp, en % du total maximum du camp. */
  hp: Series[];
  /** Dégâts cumulés infligés par chaque camp. */
  damage: Series[];
  deaths: { t: number; side: number; name: string }[];
}

export function battleStats(units: InputUnit[], log: LogEvent[]): BattleStats {
  const stat = new Map<string, UnitStat>(
    units.map((u) => [
      u.id,
      {
        id: u.id,
        name: u.name,
        side: u.side,
        hpMax: u.hpMax,
        dealt: 0,
        hits: 0,
        biggestHit: 0,
        taken: 0,
        absorbed: 0,
        healedIn: 0,
        healedOut: 0,
        kills: 0,
        diedAt: null,
      },
    ]),
  );
  const hpNow = new Map<string, number>();
  const hpMax = [0, 0];
  for (const u of units) hpMax[u.side] = (hpMax[u.side] ?? 0) + u.hpMax;
  const sideHp = (side: number): number => units.reduce((a, u) => a + (u.side === side ? (hpNow.get(u.id) ?? 0) : 0), 0);

  const causes = new Map<string, CauseStat>();
  const cause = (side: number, name: string): CauseStat => {
    const key = `${side}:${name}`;
    let c = causes.get(key);
    if (!c) causes.set(key, (c = { side, cause: name, dealt: 0, hits: 0, healed: 0 }));
    return c;
  };
  const unattributed = [0, 0];
  const deaths: BattleStats['deaths'] = [];
  const hp: Series[] = [0, 1].map((side) => ({ side, name: side === 0 ? 'Votre escouade' : 'Adversaires', pts: [] }));
  const damage: Series[] = [0, 1].map((side) => ({ side, name: side === 0 ? 'Votre escouade' : 'Adversaires', pts: [[0, 0]] }));
  const cumul = [0, 0];
  const point = (list: Series[], side: number, t: number, v: number): void => {
    const pts = list[side]!.pts;
    const last = pts[pts.length - 1];
    if (last && last[0] === t) last[1] = v;
    else if (!last || last[1] !== v) pts.push([t, v]);
  };
  const pct = (side: number): number => (hpMax[side] ? (100 * sideHp(side)) / hpMax[side]! : 0);
  const hpStart = [0, 0];

  /** Dernière action : ses soins immédiats lui sont attribués, jusqu'au prochain tic des effets dans la durée. */
  let acting: { id: string; side: number } | null = null;
  let duration = 0;

  for (const e of log) {
    const t = e.t ?? 0;
    duration = Math.max(duration, t);
    switch (e.k) {
      case 'start':
        for (const u of e.units as { id: string; hp: number }[]) hpNow.set(u.id, u.hp);
        for (const s of [0, 1]) {
          hpStart[s] = sideHp(s);
          point(hp, s, 0, pct(s));
        }
        break;
      case 'tick':
        acting = null;
        break;
      case 'act': {
        const u = stat.get(e.u as string);
        acting = u ? { id: u.id, side: u.side } : null;
        break;
      }
      case 'hit': {
        const target = stat.get(e.u as string);
        if (!target) break;
        const final = Number(e.final) || 0;
        const absorbed = Number(e.absorbed) || 0;
        target.taken += final;
        target.absorbed += absorbed;
        const src = typeof e.src === 'string' ? stat.get(e.src) : undefined;
        if (src && src.side !== target.side) {
          src.dealt += final;
          src.hits++;
          src.biggestHit = Math.max(src.biggestHit, final);
          cumul[src.side] = (cumul[src.side] ?? 0) + final;
          point(damage, src.side, t, cumul[src.side]!);
          const c = cause(src.side, String(e.cause ?? 'Attaque'));
          c.dealt += final;
          c.hits++;
        }
        break;
      }
      case 'gauge': {
        if (e.g !== 'hp') break;
        const u = stat.get(e.u as string);
        if (!u) break;
        const from = Number(e.from);
        const to = Number(e.to);
        hpNow.set(u.id, to);
        point(hp, u.side, t, pct(u.side));
        if (to > from) {
          const amount = to - from;
          u.healedIn += amount;
          const name = String(e.cause ?? 'Soin');
          cause(u.side, name).healed += amount;
          if (acting && acting.side === u.side) stat.get(acting.id)!.healedOut += amount;
          else unattributed[u.side] = (unattributed[u.side] ?? 0) + amount;
        }
        break;
      }
      case 'death': {
        const u = stat.get(e.u as string);
        if (!u) break;
        u.diedAt = t;
        deaths.push({ t, side: u.side, name: u.name });
        const by = typeof e.by === 'string' ? stat.get(e.by) : undefined;
        if (by && by.side !== u.side) by.kills++;
        break;
      }
    }
  }
  for (const s of [0, 1]) {
    point(hp, s, duration, pct(s));
    point(damage, s, duration, cumul[s] ?? 0);
  }

  const all = [...stat.values()];
  const sides = [0, 1].map((side): SideStat => {
    const us = all.filter((u) => u.side === side);
    const sum = (f: (u: UnitStat) => number): number => us.reduce((a, u) => a + f(u), 0);
    return {
      side,
      dealt: sum((u) => u.dealt),
      taken: sum((u) => u.taken),
      absorbed: sum((u) => u.absorbed),
      healed: sum((u) => u.healedIn),
      healedUnattributed: unattributed[side] ?? 0,
      kills: sum((u) => u.kills),
      deaths: us.filter((u) => u.diedAt !== null).length,
      hpStart: hpStart[side] ?? 0,
      hpEnd: sideHp(side),
      hpMax: hpMax[side] ?? 0,
    };
  }) as [SideStat, SideStat];

  return {
    duration,
    units: all,
    sides,
    causes: [...causes.values()].filter((c) => c.dealt || c.healed).sort((a, b) => b.dealt + b.healed - (a.dealt + a.healed)),
    hp,
    damage,
    deaths,
  };
}

// ---------- Courbes (SVG rendu par le gabarit) ----------

export interface Chart {
  w: number;
  h: number;
  /** Zone de tracé. */
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  xTicks: { x: number; label: string }[];
  yTicks: { y: number; label: string }[];
  lines: { side: number; name: string; d: string; area: string; last: string }[];
  marks: { x: number; y: number; side: number; title: string }[];
}

/** Pas « rond » (1, 2, 5 × puissance de 10) pour couper `max` en 4 à 6 graduations. */
function niceStep(max: number, parts: number): number {
  const raw = max / parts;
  const pow = 10 ** Math.floor(Math.log10(Math.max(raw, 1e-9)));
  const f = raw / pow;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * pow;
}

const r1 = (n: number): number => Math.round(n * 10) / 10;

/** Courbes en escalier (une valeur tient jusqu'au point suivant). `yMax` : si absent, arrondi du plus grand point. */
export function chart(
  series: Series[],
  o: { tMax: number; yMax?: number; yUnit?: string; marks?: { t: number; side: number; title: string }[] },
): Chart {
  const w = 640;
  const h = 230;
  const x0 = 46;
  const x1 = w - 12;
  const y0 = h - 26;
  const y1 = 12;
  const tMax = Math.max(1, o.tMax);
  const peak = Math.max(1, ...series.flatMap((s) => s.pts.map((p) => p[1])));
  const yStep = o.yMax ? o.yMax / 4 : niceStep(peak, 4);
  const yMax = o.yMax ?? Math.ceil(peak / yStep) * yStep;
  const X = (t: number): number => r1(x0 + ((x1 - x0) * Math.min(t, tMax)) / tMax);
  const Y = (v: number): number => r1(y0 - ((y0 - y1) * Math.min(v, yMax)) / yMax);

  const xStep = niceStep(tMax, 5);
  const xTicks: Chart['xTicks'] = [];
  for (let t = 0; t <= tMax; t += xStep) xTicks.push({ x: X(t), label: String(Math.round(t)) });
  const yTicks: Chart['yTicks'] = [];
  for (let v = 0; v <= yMax + 1e-9; v += yStep) yTicks.push({ y: Y(v), label: `${Math.round(v)}${o.yUnit ?? ''}` });

  const lines = series.map((s) => {
    // Un point par pixel au plus (le dernier de chaque colonne) : le tracé reste léger sur un long combat.
    const pts: [number, number][] = [];
    for (const p of s.pts.length ? s.pts : ([[0, 0]] as [number, number][])) {
      const last = pts[pts.length - 1];
      if (last && Math.round(X(last[0])) === Math.round(X(p[0]))) last[1] = p[1];
      else pts.push([p[0], p[1]]);
    }
    // Escalier : horizontale jusqu'à l'instant du changement, puis verticale.
    let d = `M${X(pts[0]![0])} ${Y(pts[0]![1])}`;
    for (let i = 1; i < pts.length; i++) d += `H${X(pts[i]![0])}V${Y(pts[i]![1])}`;
    d += `H${X(tMax)}`;
    return { side: s.side, name: s.name, d, area: `${d}V${y0}H${X(pts[0]![0])}Z`, last: String(Math.round(pts[pts.length - 1]![1])) };
  });

  const at = (side: number, t: number): number => {
    const pts = series.find((s) => s.side === side)?.pts ?? [];
    let v = pts[0]?.[1] ?? 0;
    for (const p of pts) if (p[0] <= t) v = p[1];
    return v;
  };
  const marks = (o.marks ?? []).map((m) => ({ x: X(m.t), y: Y(at(m.side, m.t)), side: m.side, title: m.title }));
  return { w, h, x0, x1, y0, y1, xTicks, yTicks, lines, marks };
}
