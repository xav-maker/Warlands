/** Petites règles de jeu partagées (README 4.4, 8.6), hors du contenu. */
import type { GameContent } from './content.ts';

/** Forme d'une recrue : la forme de base (les évolutions viennent avec J3, README 24). */
export const baseForm = (c: GameContent, type: string): string => c.pack.troops[type]!.forms[0]!.id;

/** XP pour passer du niveau n au suivant (README 4.4) : round(50 × n × (1 + n/10)). */
export const xpToNext = (level: number): number => Math.round(50 * level * (1 + level / 10));

/** XP d'une troupe trop forte : divisée par 2 par niveau d'écart au-delà de 2 (prototype xpFor). */
export function xpFor(base: number, troopLevel: number, monsterLevel: number): number {
  const over = troopLevel - Math.floor(monsterLevel) - 2;
  return over <= 0 ? base : Math.floor(base / 2 ** over);
}
