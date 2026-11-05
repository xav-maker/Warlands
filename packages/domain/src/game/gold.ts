/**
 * Or en partie double (guide 6.3) : chaque mouvement écrit deux lignes de gold_entry de même `tx`, dont
 * la somme est nulle, et met à jour les deux soldes. Un compte joueur ne descend jamais sous 0 (contrainte).
 */
import { randomUUID } from 'node:crypto';
import { GameError } from '@cr/shared';
import type { Database, Transaction } from '@cr/db';

type Tx = Transaction<Database>;
export type SystemAccount =
  | 'SOURCE_START'
  | 'SOURCE_COMBAT'
  | 'SOURCE_QUEST'
  | 'SOURCE_DUNGEON'
  | 'SOURCE_MERCHANT_BUY'
  | 'SINK_MERCHANT_SELL'
  | 'SINK_RECRUIT'
  | 'SINK_EVOLUTION'
  | 'SINK_REBUY_UNIT'
  | 'SINK_CRAFT'
  | 'SINK_SHOP_TAX'
  | 'SINK_QUEST_ABANDON'
  | 'SINK_ROUTE_TOLL'
  | 'SINK_RESET'
  | 'SOURCE_ADMIN'
  | 'SINK_ADMIN';
export type GoldParty = { player: number } | { system: SystemAccount };

async function accountId(tx: Tx, p: GoldParty): Promise<number> {
  if ('system' in p) return (await tx.selectFrom('gold_account').select('id').where('code', '=', p.system).executeTakeFirstOrThrow()).id;
  const row = await tx.selectFrom('gold_account').select('id').where('player_id', '=', p.player).executeTakeFirst();
  if (row) return row.id;
  return (await tx.insertInto('gold_account').values({ player_id: p.player }).returning('id').executeTakeFirstOrThrow()).id;
}

export async function balance(tx: Tx, playerId: number): Promise<number> {
  return (await tx.selectFrom('gold_account').select('balance').where('player_id', '=', playerId).executeTakeFirst())?.balance ?? 0;
}

/** Transfère `amount` (> 0) de `from` vers `to`. Refuse si un joueur n'a pas assez d'or. */
export async function transferGold(tx: Tx, from: GoldParty, to: GoldParty, amount: number, reason: string): Promise<void> {
  if (!Number.isInteger(amount) || amount <= 0) throw new Error(`montant invalide : ${amount}`);
  const a = await accountId(tx, from);
  const b = await accountId(tx, to);
  // Verrou des deux comptes dans l'ordre de leurs ids : deux transferts croisés (A paie B pendant que B paie A)
  // ne peuvent pas s'interbloquer.
  const locked = await tx
    .selectFrom('gold_account')
    .select(['id', 'balance'])
    .where('id', 'in', [a, b])
    .orderBy('id')
    .forUpdate()
    .execute();
  if ('player' in from && locked.find((x) => x.id === a)!.balance < amount) throw new GameError('NOT_ENOUGH_GOLD', { prix: amount });
  const id = randomUUID();
  await tx
    .insertInto('gold_entry')
    .values([
      { tx: id, account_id: a, amount: -amount, reason },
      { tx: id, account_id: b, amount, reason },
    ])
    .execute();
  await tx
    .updateTable('gold_account')
    .set((eb) => ({ balance: eb('balance', '-', amount) }))
    .where('id', '=', a)
    .execute();
  await tx
    .updateTable('gold_account')
    .set((eb) => ({ balance: eb('balance', '+', amount) }))
    .where('id', '=', b)
    .execute();
}
