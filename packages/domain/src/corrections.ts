/**
 * Corrections d'administration (guide 19.5, procédure 4) : rendre ou retirer de l'or ou des objets à un joueur après un
 * incident. Jamais par un UPDATE à la main : l'or passe par le grand livre (SOURCE_ADMIN, SINK_ADMIN), les objets par
 * l'inventaire (asset_move), et chaque correction est journalisée dans admin_action avec son motif.
 */
import { GameError } from '@cr/shared';
import type { Db } from '@cr/db';
import type { GameContent } from './game/content.ts';
import { transferGold } from './game/gold.ts';
import { addStack, stackQty, takeStack } from './game/inventory.ts';

export interface Correction {
  /** Adresse e-mail du compte (en minuscules). */
  email: string;
  /** Motif, obligatoire : il est gardé au journal d'administration. */
  reason: string;
  /** Auteur de la correction (id de joueur d'un administrateur), ou null pour l'outil en ligne de commande. */
  actor?: number | null;
}

async function target(db: Db, email: string): Promise<{ id: number; pseudo: string }> {
  const p = await db
    .selectFrom('player')
    .innerJoin('account', 'account.id', 'player.account_id')
    .select(['player.id', 'player.pseudo'])
    .where('account.email', '=', email.trim().toLowerCase())
    .executeTakeFirst();
  if (!p) throw new GameError('PLAYER_NOT_FOUND');
  return p;
}

const checkReason = (r: string): string => {
  const reason = r.trim();
  if (reason.length < 5) throw new GameError('INVALID_INPUT');
  return reason;
};

/** Rend (amount > 0) ou retire (amount < 0) de l'or. Refuse de rendre un solde négatif. */
export async function correctGold(db: Db, c: Correction & { amount: number }): Promise<{ player: string; amount: number }> {
  const reason = checkReason(c.reason);
  if (!Number.isInteger(c.amount) || c.amount === 0) throw new GameError('INVALID_INPUT');
  const p = await target(db, c.email);
  await db.transaction().execute(async (tx) => {
    await tx.selectFrom('player').select('id').where('id', '=', p.id).forNoKeyUpdate().execute();
    const why = `correction : ${reason}`;
    if (c.amount > 0) await transferGold(tx, { system: 'SOURCE_ADMIN' }, { player: p.id }, c.amount, why);
    else await transferGold(tx, { player: p.id }, { system: 'SINK_ADMIN' }, -c.amount, why);
    await tx
      .insertInto('admin_action')
      .values({
        actor_id: c.actor ?? null,
        action: 'correction.gold',
        target_id: p.id,
        data: JSON.stringify({ amount: c.amount, reason, by: c.actor ? 'admin' : 'cli' }),
      })
      .execute();
  });
  return { player: p.pseudo, amount: c.amount };
}

/** Rend (qty > 0, en banque, même pleine) ou retire (qty < 0, de la banque) des objets empilables. */
export async function correctItem(
  db: Db,
  content: GameContent,
  c: Correction & { item: string; qty: number },
): Promise<{ player: string; item: string; qty: number }> {
  const reason = checkReason(c.reason);
  if (!Number.isInteger(c.qty) || c.qty === 0) throw new GameError('INVALID_INPUT');
  if (!content.pack.items[c.item]) throw new GameError('ITEM_NOT_FOUND');
  const p = await target(db, c.email);
  await db.transaction().execute(async (tx) => {
    await tx.selectFrom('player').select('id').where('id', '=', p.id).forNoKeyUpdate().execute();
    const why = `correction : ${reason}`;
    if (c.qty > 0) {
      const left = await addStack(tx, content, p.id, 'BANK', c.item, c.qty, 'SYSTEM', why);
      // Banque pleine : le reste va tout de même en banque (comme le coffre d'un donjon), journalisé.
      if (left > 0) {
        await tx
          .insertInto('item_stack')
          .values({ player_id: p.id, container: 'BANK', item: c.item, qty: left })
          .onConflict((oc) =>
            oc.columns(['player_id', 'container', 'item']).doUpdateSet((eb) => ({ qty: eb('item_stack.qty', '+', left) })),
          )
          .execute();
        await tx
          .insertInto('asset_move')
          .values({
            player_id: p.id,
            kind: 'stack',
            item: c.item,
            instance_id: null,
            troop_id: null,
            qty: left,
            from_container: 'SYSTEM',
            to_container: 'BANK',
            reason: why,
          })
          .execute();
      }
    } else {
      if ((await stackQty(tx, p.id, 'BANK', c.item)) < -c.qty) throw new GameError('NOT_ENOUGH_ITEMS', { objet: c.item });
      await takeStack(tx, p.id, 'BANK', c.item, -c.qty, 'SYSTEM', why);
    }
    await tx
      .insertInto('admin_action')
      .values({
        actor_id: c.actor ?? null,
        action: 'correction.item',
        target_id: p.id,
        data: JSON.stringify({ item: c.item, qty: c.qty, reason, by: c.actor ? 'admin' : 'cli' }),
      })
      .execute();
  });
  return { player: p.pseudo, item: c.item, qty: c.qty };
}
