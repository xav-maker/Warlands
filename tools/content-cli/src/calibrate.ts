/**
 * Réglage de la difficulté des routes, en deux passes, puis réécriture de `content/world/routes.yaml` sans toucher au
 * reste du fichier :
 * 1. **forme** : pour chaque étape, le `mult` (‰ de PV et d'attaque des monstres) qui donne à l'escouade de référence
 *    le taux de victoire visé en combat isolé (`stepTarget` : début facile, difficulté qui monte, gardien) ;
 * 2. **niveau** (README 33) : un facteur commun à toutes les étapes de la route, qui garde cette forme, pour que la
 *    route complète (5 étapes à la suite, PV, morts et mana reportés) soit finie la part de fois visée (`runTarget`).
 * Mêmes escouades, mêmes graines et mêmes nombres de parties que `simulate` : ce que le réglage trouve est ce que le
 * test d'équilibrage mesure.
 *
 *   pnpm content calibrate [--fights 60] [--runs 40] [--tier N] [--routes-only] [--dry]
 *   (--routes-only : seconde passe seule, à partir des mult actuels)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { routes } from '@cr/gen';
import type { GenContent } from '@cr/gen';
import { RUNS, runTarget, simulateRun, simulateStep, stepTarget } from './simulate.ts';
import type { Squad } from './simulate.ts';

export interface Tuned {
  route: string;
  step: string;
  mult: number;
  winRate: number;
  target: number;
}

/** `mult` dont le taux de victoire est le plus proche de la cible (le taux baisse quand `mult` monte). */
export function tuneStep(c: GenContent, route: string, si: number, squads: Record<string, Squad>, fights: number): Tuned {
  const R = routes(c).find((r) => r.id === route)!;
  const st = R.steps[si]!;
  const target = stepTarget(R.tier, si + 1, !!st.guardian);
  let best = { mult: 1000, winRate: -1, gap: Infinity };
  const rate = (mult: number): number => {
    st.mult = mult;
    const winRate = simulateStep(c, R, si, squads, { fights }).winRate;
    // On garde l'essai le plus proche de la cible, pas forcément le dernier : le taux n'est pas strictement monotone.
    if (Math.abs(winRate - target) < best.gap) best = { mult, winRate, gap: Math.abs(winRate - target) };
    return winRate;
  };
  // Dichotomie sur une échelle logarithmique.
  let lo = 50;
  let hi = 8000;
  for (let i = 0; i < 11; i++) {
    const mid = Math.round(Math.sqrt(lo * hi));
    if (rate(mid) >= target) lo = mid;
    else hi = mid;
  }
  rate(lo);
  st.mult = best.mult;
  return { route, step: st.id, mult: best.mult, winRate: best.winRate, target };
}

/** Remplace les `mult:` du YAML des routes, route par route et étape par étape (le texte et les commentaires restent). */
export function rewriteMults(yaml: string, tuned: Tuned[]): string {
  const by = new Map(tuned.map((t) => [`${t.route}/${t.step}`, t.mult]));
  let route = '';
  let step = '';
  return yaml
    .split('\n')
    .map((line) => {
      const r = /^- id: (\S+)/.exec(line);
      if (r) route = r[1]!;
      const s = /^ {4}- id: (\S+)/.exec(line);
      if (s) step = s[1]!;
      const m = /^( {6}mult: )\d+/.exec(line);
      const v = m ? by.get(`${route}/${step}`) : undefined;
      return m && v !== undefined ? `${m[1]}${v}` : line;
    })
    .join('\n');
}

/**
 * Facteur de route (‰) : multiplie le `mult` de toutes les étapes de la route, ce qui garde sa forme. Dichotomie sur une
 * échelle logarithmique (la part de routes finies baisse quand le facteur monte) ; on garde l'essai le plus proche de la
 * cible. Renvoie le nouveau `mult` de chaque étape, `winRate` étant la part de routes finies.
 */
export function tuneRoute(c: GenContent, route: string, squads: Record<string, Squad>, runs = RUNS): Tuned[] {
  const R = routes(c).find((r) => r.id === route)!;
  const base = R.steps.map((st) => st.mult ?? 1000);
  const target = runTarget(R.tier);
  const apply = (f: number): void => R.steps.forEach((st, i) => (st.mult = Math.max(1, Math.round((base[i]! * f) / 1000))));
  let best = { f: 1000, done: -1, gap: Infinity };
  const rate = (f: number): number => {
    apply(f);
    const done = simulateRun(c, R, squads, runs).done;
    if (Math.abs(done - target) < best.gap) best = { f, done, gap: Math.abs(done - target) };
    return done;
  };
  let lo = 150;
  let hi = 4000;
  for (let i = 0; i < 10 && best.gap > 0.02; i++) {
    const mid = Math.round(Math.sqrt(lo * hi));
    if (rate(mid) >= target) lo = mid;
    else hi = mid;
  }
  apply(best.f);
  return R.steps.map((st) => ({ route, step: st.id, mult: st.mult!, winRate: best.done, target }));
}

export function calibrate(
  c: GenContent,
  squads: Record<string, Squad>,
  contentDir: string,
  opt: { fights?: number; runs?: number; tier?: number; dry?: boolean; routesOnly?: boolean } = {},
): Tuned[] {
  const { fights = 60, runs = RUNS, tier, dry = false, routesOnly = false } = opt;
  const out: Tuned[] = [];
  for (const R of routes(c)) {
    if (tier !== undefined && R.tier !== tier) continue;
    if (!routesOnly)
      for (let si = 0; si < R.steps.length; si++) {
        const t = tuneStep(c, R.id, si, squads, fights);
        console.log(
          `${R.id} ${t.step} : forme, mult ${t.mult}, victoires ${Math.round(t.winRate * 100)} % (cible ${Math.round(t.target * 100)} %)`,
        );
      }
    const ts = tuneRoute(c, R.id, squads, runs);
    out.push(...ts);
    console.log(
      `${R.id} : route finie ${Math.round(ts[0]!.winRate * 100)} % (cible ${Math.round(ts[0]!.target * 100)} %), mult ${ts.map((t) => t.mult).join(' ')}`,
    );
  }
  if (!dry) {
    const file = join(contentDir, 'world/routes.yaml');
    writeFileSync(file, rewriteMults(readFileSync(file, 'utf8'), out));
  }
  return out;
}
