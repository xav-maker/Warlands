/** Contenu actif (pack compilé) et lecture du monde : régions, routes, étapes. */
import { routes } from '@cr/gen';
import type { GenContent, OnlineRules, Region, Route, Step } from '@cr/gen';

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

/** Route par identifiant : route du graphe, ou territoire du prototype (identifiant de sa région). */
export function route(c: GameContent, id: string): Route {
  const x = routes(c.pack).find((y) => y.id === id);
  if (!x) throw new Error(`route inconnue : ${id}`);
  return x;
}

/**
 * Départs d'une ville (README 3.3 et 18.1) : chaque route qui la touche, vers l'avant (de `from` à `to`) ou à
 * rebours. Prototype : le territoire de la région i relie la ville i à la ville i+1 (cul-de-sac pour la
 * dernière) et porte l'identifiant de sa région. Les étapes se font toujours dans le même ordre, gardien au bout.
 */
export interface Departure {
  direction: 1 | -1;
  route: string;
  /** Région d'arrivée ; null pour un cul-de-sac. */
  to: string | null;
}

export function departures(c: GameContent, from: string): Departure[] {
  regionIndex(c, from);
  const all = routes(c.pack);
  return [
    ...all.filter((x) => x.from === from).map((x): Departure => ({ direction: 1, route: x.id, to: x.to })),
    ...all.filter((x) => x.to === from).map((x): Departure => ({ direction: -1, route: x.id, to: x.from })),
  ];
}

/** Région d'arrivée d'une route parcourue dans un sens. */
export function destination(c: GameContent, id: string, direction: number): string | null {
  const x = route(c, id);
  return direction > 0 ? x.to : x.from;
}

/** Palier d'une route, en index (0 à 4) : renfort des monstres (README 18.2). */
export const routeTierIndex = (c: GameContent, id: string): number => route(c, id).tier - 1;

export const stepOf = (c: GameContent, id: string, step: number): Step => route(c, id).steps[step]!;
export const stepCount = (c: GameContent, id: string): number => route(c, id).steps.length;
