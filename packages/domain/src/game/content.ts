/** Contenu actif (pack compilé) et lecture du monde : régions, routes, étapes. */
import type { GenContent, OnlineRules, Region, Step } from '@cr/gen';

export interface GameContent {
  pack: GenContent;
  /** Empreinte SHA-256 du pack : version de contenu enregistrée avec chaque combat et chaque objet. */
  hash: string;
}

export function online(c: GameContent): OnlineRules {
  if (!c.pack.online) throw new Error('pack sans règles en ligne (params.yaml › online)');
  return c.pack.online;
}

export function regionIndex(c: GameContent, id: string): number {
  const i = c.pack.regions.findIndex((r) => r.id === id);
  if (i < 0) throw new Error(`région inconnue : ${id}`);
  return i;
}

export const region = (c: GameContent, id: string): Region => c.pack.regions[regionIndex(c, id)]!;

/**
 * Routes du prototype (README 3.3) : le territoire de la région i relie la ville i à la ville i+1 ; une
 * route porte l'identifiant de la région dont c'est le territoire. Depuis la ville r : vers l'avant le
 * territoire r (arrivée en r+1, cul-de-sac pour la dernière), à rebours le territoire r−1 (arrivée en r−1).
 * Les étapes se font toujours dans le même ordre, gardien au bout.
 */
export interface Departure {
  direction: 1 | -1;
  route: string;
  /** Région d'arrivée ; null pour un cul-de-sac. */
  to: string | null;
}

export function departures(c: GameContent, from: string): Departure[] {
  const r = regionIndex(c, from);
  const R = c.pack.regions;
  const out: Departure[] = [{ direction: 1, route: R[r]!.id, to: R[r + 1]?.id ?? null }];
  if (r > 0) out.push({ direction: -1, route: R[r - 1]!.id, to: R[r - 1]!.id });
  return out;
}

/** Région d'arrivée d'une route parcourue dans un sens. */
export function destination(c: GameContent, route: string, direction: number): string | null {
  const t = regionIndex(c, route);
  const to = direction > 0 ? t + 1 : t;
  return c.pack.regions[to]?.id ?? null;
}

export const stepOf = (c: GameContent, route: string, step: number): Step => region(c, route).territory.steps[step]!;
export const stepCount = (c: GameContent, route: string): number => region(c, route).territory.steps.length;
