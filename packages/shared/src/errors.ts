/**
 * Codes d'erreur métier stables (guide technique 3.3). Le code ne change jamais une fois publié :
 * les templates le traduisent en français via `messages.ts`.
 */
export const ERROR_CODES = [
  // Validation et cadre
  'INVALID_INPUT',
  'RATE_LIMITED',
  'NOT_AUTHENTICATED',
  'CSRF_INVALID',
  'IDEMPOTENCY_CONFLICT',
  'WRONG_POSITION',
  'WATCH_IN_PROGRESS',
  // Identité
  'EMAIL_TAKEN',
  'PSEUDO_TAKEN',
  'PSEUDO_INVALID',
  'PSEUDO_FORBIDDEN',
  'PASSWORD_TOO_SHORT',
  'BAD_CREDENTIALS',
  'ACCOUNT_SUSPENDED',
  'EMAIL_NOT_VERIFIED',
  'VERIFY_TOKEN_INVALID',
  'PLAYER_NOT_FOUND',
  // Jeu (J2)
  'SQUAD_EMPTY',
  'NO_SUCH_ROUTE',
  'STEP_NOT_CLEARED',
  'LAST_STEP',
  'FIRST_STEP',
  'NOT_AT_ROUTE_END',
  'DEAD_END',
  'ENCOUNTER_VISIBLE',
  'NO_ENCOUNTER',
  'BAG_FULL',
  'BANK_FULL',
  'NOT_ENOUGH_GOLD',
  'NOT_ENOUGH_ITEMS',
  'NOT_SOLD_HERE',
  'ITEM_NOT_FOUND',
  'NOT_CONSUMABLE',
  'GAUGE_FULL',
  'UNIT_NOT_FOUND',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

/** Erreur métier : affichée au joueur, jamais journalisée comme une panne. */
export class GameError extends Error {
  readonly code: ErrorCode;
  readonly details: Record<string, string | number> | undefined;

  constructor(code: ErrorCode, details?: Record<string, string | number>) {
    super(code);
    this.name = 'GameError';
    this.code = code;
    this.details = details;
  }
}

export const isGameError = (e: unknown): e is GameError => e instanceof GameError;
