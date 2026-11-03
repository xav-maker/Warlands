/**
 * Recettes personnelles (README 8.5, guide 6.1) : tirées de la graine du joueur par genRecipes et
 * matérialisées en base au premier besoin, avec les matériaux réservés à l'échange (tradeOnly).
 * Payer une recette puise l'or puis les ingrédients, d'abord dans la banque, puis dans le sac (README 7.2).
 */
import { GameError } from '@cr/shared';
import type { Database, Player, Transaction } from '@cr/db';
import { genRecipes, tradeOnly } from '@cr/gen';
import type { GameContent } from './content.ts';
import { transferGold } from './gold.ts';
import type { SystemAccount } from './gold.ts';
import { stackQty, takeStack } from './inventory.ts';

type Tx = Transaction<Database>;

export interface PlayerRecipe {
  out: string;
  kind: 'equip' | 'consommable' | 'recrue' | 'evolution';
  ingredients: [string, number][];
  gold: number;
}

/** Recettes du joueur, matérialisées si ce n'est pas encore fait. */
export async function recipes(tx: Tx, c: GameContent, player: Pick<Player, 'id' | 'seed'>): Promise<Map<string, PlayerRecipe>> {
  let rows = await tx
    .selectFrom('player_recipe')
    .select(['out', 'kind', 'ingredients', 'gold'])
    .where('player_id', '=', player.id)
    .execute();
  if (!rows.length) {
    const all = Object.values(genRecipes(c.pack, player.seed));
    await tx
      .insertInto('player_recipe')
      .values(
        all.map((r) => ({
          player_id: player.id,
          out: r.out,
          kind: r.kind,
          ingredients: JSON.stringify(r.ingredients),
          gold: r.gold,
          budget: r.budget,
          content_version: c.hash,
        })),
      )
      .onConflict((oc) => oc.doNothing())
      .execute();
    const reserved = tradeOnly(c.pack, player.seed);
    await tx
      .insertInto('player_reserved_material')
      .values(reserved.map((item) => ({ player_id: player.id, item })))
      .onConflict((oc) => oc.doNothing())
      .execute();
    rows = await tx.selectFrom('player_recipe').select(['out', 'kind', 'ingredients', 'gold']).where('player_id', '=', player.id).execute();
  }
  return new Map(rows.map((r) => [r.out, r]));
}

export async function reservedMaterials(tx: Tx, playerId: number): Promise<Set<string>> {
  const rows = await tx.selectFrom('player_reserved_material').select('item').where('player_id', '=', playerId).execute();
  return new Set(rows.map((r) => r.item));
}

/** Ce que coûte une recette × mult (arrondi au supérieur, comme le prototype). */
export function scaled(r: PlayerRecipe, mult = 1): { gold: number; ingredients: [string, number][] } {
  return { gold: Math.ceil(r.gold * mult), ingredients: r.ingredients.map(([id, q]): [string, number] => [id, Math.ceil(q * mult)]) };
}

/** Quantité possédée en banque et dans le sac. */
export async function owned(tx: Tx, playerId: number, item: string): Promise<number> {
  return (await stackQty(tx, playerId, 'BANK', item)) + (await stackQty(tx, playerId, 'BAG', item));
}

/** Paie une recette : or vers le puits, ingrédients consommés (banque puis sac). Refuse s'il manque quoi que ce soit. */
export async function payRecipe(
  tx: Tx,
  playerId: number,
  r: PlayerRecipe,
  mult: number,
  sink: SystemAccount,
  reason: string,
): Promise<void> {
  const cost = scaled(r, mult);
  for (const [id, q] of cost.ingredients) if ((await owned(tx, playerId, id)) < q) throw new GameError('NOT_ENOUGH_ITEMS', { objet: id });
  if (cost.gold > 0) await transferGold(tx, { player: playerId }, { system: sink }, cost.gold, reason);
  for (const [id, q] of cost.ingredients) {
    const fromBank = Math.min(q, await stackQty(tx, playerId, 'BANK', id));
    if (fromBank) await takeStack(tx, playerId, 'BANK', id, fromBank, 'SYSTEM', reason);
    if (q - fromBank) await takeStack(tx, playerId, 'BAG', id, q - fromBank, 'SYSTEM', reason);
  }
}
