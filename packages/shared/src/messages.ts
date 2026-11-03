import type { ErrorCode } from './errors.ts';

/** Textes français des erreurs métier. `{x}` est remplacé par `details.x`. */
const FR: Record<ErrorCode, string> = {
  INVALID_INPUT: 'Saisie invalide.',
  RATE_LIMITED: 'Trop de demandes. Patientez un instant.',
  NOT_AUTHENTICATED: 'Vous devez être connecté.',
  CSRF_INVALID: 'La page a expiré. Rechargez-la et recommencez.',
  IDEMPOTENCY_CONFLICT: 'Cette action a déjà été envoyée avec un contenu différent.',
  WRONG_POSITION: "Impossible d'ici.",
  WATCH_IN_PROGRESS: 'Regardez le combat jusqu’au bout avant de continuer.',
  EMAIL_TAKEN: 'Impossible de créer ce compte avec ces informations.',
  PSEUDO_TAKEN: 'Ce pseudo est déjà pris.',
  PSEUDO_INVALID: 'Pseudo : 3 à 20 caractères, lettres, chiffres, tiret ou espace.',
  PSEUDO_FORBIDDEN: 'Ce pseudo n’est pas autorisé.',
  PASSWORD_TOO_SHORT: 'Mot de passe : {min} caractères au moins.',
  BAD_CREDENTIALS: 'E-mail ou mot de passe incorrect.',
  ACCOUNT_SUSPENDED: 'Ce compte est suspendu.',
  EMAIL_NOT_VERIFIED: 'Vérifiez d’abord votre adresse e-mail.',
  VERIFY_TOKEN_INVALID: 'Ce lien de vérification est invalide ou a expiré.',
  PLAYER_NOT_FOUND: 'Joueur introuvable.',
  SQUAD_EMPTY: 'L’escouade n’a aucune unité en état de combattre.',
  NO_SUCH_ROUTE: 'Aucune route dans ce sens.',
  STEP_NOT_CLEARED: 'Il faut d’abord vaincre les monstres de cette étape.',
  LAST_STEP: 'C’est la dernière étape.',
  FIRST_STEP: 'C’est la première étape.',
  NOT_AT_ROUTE_END: 'Il faut d’abord franchir tout le territoire.',
  DEAD_END: 'Ce territoire ne mène à aucune ville.',
  ENCOUNTER_VISIBLE: 'Un groupe est déjà en vue.',
  NO_ENCOUNTER: 'Aucun groupe en vue.',
  BAG_FULL: 'Le sac est plein.',
  BANK_FULL: 'La banque est pleine.',
  NOT_ENOUGH_GOLD: 'Pas assez d’or ({prix} demandés).',
  NOT_ENOUGH_ITEMS: 'Pas assez d’objets.',
  NOT_SOLD_HERE: 'Le marchand ne vend pas cet objet.',
  ITEM_NOT_FOUND: 'Objet introuvable.',
  NOT_CONSUMABLE: 'Ce n’est pas un consommable.',
  GAUGE_FULL: 'Déjà au maximum.',
  UNIT_NOT_FOUND: 'Unité introuvable.',
};

export function messageFr(code: ErrorCode, details?: Record<string, string | number>): string {
  let text = FR[code];
  if (details) for (const [k, v] of Object.entries(details)) text = text.replaceAll(`{${k}}`, String(v));
  return text;
}
