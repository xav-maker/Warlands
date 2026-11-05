/**
 * Réglage de la difficulté étape par étape : cherche, pour chaque étape de chaque route, le `mult` (‰ de PV et
 * d'attaque des monstres) qui donne à l'escouade de référence le taux de victoire visé (`stepTarget`), puis réécrit
 * `content/world/routes.yaml` sans toucher au reste du fichier. Mêmes escouades, mêmes graines et mêmes nombres de
 * combats que `simulate` : ce que le réglage trouve est ce que le test d'équilibrage mesure.
 *
 *   pnpm content calibrate [--fights 60] [--tier N] [--dry]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { routes } from '@cr/gen';
import type { GenContent } from '@cr/gen';
import { simulateStep, stepTarget } from './simulate.ts';
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

export function calibrate(
  c: GenContent,
  squads: Record<string, Squad>,
  contentDir: string,
  opt: { fights?: number; tier?: number; dry?: boolean } = {},
): Tuned[] {
  const { fights = 60, tier, dry = false } = opt;
  const out: Tuned[] = [];
  for (const R of routes(c)) {
    if (tier !== undefined && R.tier !== tier) continue;
    for (let si = 0; si < R.steps.length; si++) {
      const t = tuneStep(c, R.id, si, squads, fights);
      out.push(t);
      console.log(`${R.id} ${t.step} : mult ${t.mult}, victoires ${Math.round(t.winRate * 100)} % (cible ${Math.round(t.target * 100)} %)`);
    }
  }
  if (!dry) {
    const file = join(contentDir, 'world/routes.yaml');
    writeFileSync(file, rewriteMults(readFileSync(file, 'utf8'), out));
  }
  return out;
}
