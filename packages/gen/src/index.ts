/**
 * Générateurs déterministes du jeu (guide 3.1, 4.1) : rencontres, butin, exemplaires, recettes, quêtes et
 * entrée du moteur. Fonctions pures de (contenu, graine, paramètres), portées à l'identique du prototype
 * proto-0.4-ville et figées par des vecteurs qu'il a produits (golden/v0.4).
 */
export type * from './content.ts';
export { between, weighted, uid } from './random.ts';
export * from './troops.ts';
export * from './equip.ts';
export * from './encounters.ts';
export * from './loot.ts';
export * from './recipes.ts';
export * from './quests.ts';
export * from './battle.ts';
