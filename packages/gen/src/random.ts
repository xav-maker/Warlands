/** Tirages de base du prototype (gen.ts), à l'identique. */
import type { Rng } from '@cr/rng';

/** Entier dans [a, b]. */
export const between = (r: Rng, a: number, b: number): number => a + r.int(b - a + 1);

/** Tirage pondéré ; les poids peuvent être fractionnaires (précision du millième). */
export function weighted<T>(r: Rng, list: [T, number][]): T | undefined {
  const tot = list.reduce((a, [, w]) => a + w, 0);
  if (tot <= 0) return void 0;
  let x = r.int(Math.max(1, Math.round(tot * 1e3))) / 1e3;
  for (const [v, w] of list) {
    if (x < w) return v;
    x -= w;
  }
  return list[list.length - 1]![0];
}

/** Identifiant d'exemplaire tiré de l'aléa (unique en pratique, pas garanti). */
export const uid = (r: Rng, p = 'i'): string => p + r.next().toString(36) + r.int(1296).toString(36);
