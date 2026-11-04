/**
 * Inventaire : sac, banque, butin au sol (guide 6.2, README 7.2). Seul ce module écrit dans item_stack et
 * item_instance, et chaque mouvement est journalisé dans asset_move.
 *
 * Emplacements comme dans le prototype : une pile de quantité q occupe ceil(q / taille de pile)
 * emplacements, un exemplaire d'équipement un emplacement. Le butin au sol (PENDING_LOOT) est illimité.
 */
import { GameError } from '@cr/shared';
import type { Database, InstanceContainer, StackContainer, Transaction } from '@cr/db';
import type { EquipInstance } from '@cr/gen';
import { online } from './content.ts';
import type { GameContent } from './content.ts';

type Tx = Transaction<Database>;

export function capacity(c: GameContent, container: StackContainer): number {
  if (container === 'BAG') return Number(c.pack.eco.bagSlots);
  if (container === 'BANK') return Number(c.pack.eco.bankSlots);
  // Butin au sol et coffre du donjon : illimités.
  return Infinity;
}

const perStack = (c: GameContent, item: string): number => online(c).stack[c.pack.items[item]!.kind]!;

export interface Contents {
  stacks: { item: string; qty: number }[];
  instances: { id: number; base: string; roll: number; stats: { k: string; v: number; type?: string }[] }[];
}

export async function contents(tx: Tx, playerId: number, container: StackContainer): Promise<Contents> {
  const stacks = await tx
    .selectFrom('item_stack')
    .select(['item', 'qty'])
    .where('player_id', '=', playerId)
    .where('container', '=', container)
    .orderBy('id')
    .execute();
  const instances = await tx
    .selectFrom('item_instance')
    .select(['id', 'base', 'roll', 'stats'])
    .where('player_id', '=', playerId)
    .where('container', '=', container)
    .orderBy('id')
    .execute();
  return { stacks, instances };
}

export function slotsUsed(c: GameContent, x: Contents): number {
  return x.stacks.reduce((a, s) => a + Math.ceil(s.qty / perStack(c, s.item)), 0) + x.instances.length;
}

async function log(
  tx: Tx,
  playerId: number,
  m: { kind: 'stack' | 'instance'; item?: string; instanceId?: number; qty?: number; from: string; to: string; reason: string },
): Promise<void> {
  await tx
    .insertInto('asset_move')
    .values({
      player_id: playerId,
      kind: m.kind,
      item: m.item ?? null,
      instance_id: m.instanceId ?? null,
      troop_id: null,
      qty: m.qty ?? 1,
      from_container: m.from,
      to_container: m.to,
      reason: m.reason,
    })
    .execute();
}

/**
 * Ajoute jusqu'à `qty` objets dans un conteneur, dans la limite de ses emplacements (addStack du
 * prototype). Rend la quantité qui n'a pas tenu.
 */
export async function addStack(
  tx: Tx,
  c: GameContent,
  playerId: number,
  container: StackContainer,
  item: string,
  qty: number,
  from: string,
  reason: string,
): Promise<number> {
  if (qty <= 0) return 0;
  const x = await contents(tx, playerId, container);
  const per = perStack(c, item);
  const cur = x.stacks.find((s) => s.item === item)?.qty ?? 0;
  const otherSlots = slotsUsed(c, x) - Math.ceil(cur / per);
  const maxQty = Math.max(cur, (capacity(c, container) - otherSlots) * per);
  const added = Math.min(qty, Math.max(0, maxQty - cur));
  if (added > 0) {
    await tx
      .insertInto('item_stack')
      .values({ player_id: playerId, container, item, qty: added })
      .onConflict((oc) =>
        oc
          .columns(['player_id', 'container', 'item'])
          .doUpdateSet((eb) => ({ qty: eb('item_stack.qty', '+', added), updated_at: new Date() })),
      )
      .execute();
    await log(tx, playerId, { kind: 'stack', item, qty: added, from, to: container, reason });
  }
  return qty - added;
}

/** Retire `qty` objets d'un conteneur ; refuse s'il n'y en a pas assez. */
export async function takeStack(
  tx: Tx,
  playerId: number,
  container: StackContainer,
  item: string,
  qty: number,
  to: string,
  reason: string,
): Promise<void> {
  const row = await tx
    .selectFrom('item_stack')
    .select(['id', 'qty'])
    .where('player_id', '=', playerId)
    .where('container', '=', container)
    .where('item', '=', item)
    .forUpdate()
    .executeTakeFirst();
  if (!row || row.qty < qty) throw new GameError('NOT_ENOUGH_ITEMS', { objet: item });
  if (row.qty === qty) await tx.deleteFrom('item_stack').where('id', '=', row.id).execute();
  else
    await tx
      .updateTable('item_stack')
      .set({ qty: row.qty - qty, updated_at: new Date() })
      .where('id', '=', row.id)
      .execute();
  await log(tx, playerId, { kind: 'stack', item, qty, from: container, to, reason });
}

export async function stackQty(tx: Tx, playerId: number, container: StackContainer, item: string): Promise<number> {
  const row = await tx
    .selectFrom('item_stack')
    .select('qty')
    .where('player_id', '=', playerId)
    .where('container', '=', container)
    .where('item', '=', item)
    .executeTakeFirst();
  return row?.qty ?? 0;
}

/** Crée un exemplaire dans un conteneur ; rend son id, ou null si le conteneur est plein. */
export async function addInstance(
  tx: Tx,
  c: GameContent,
  playerId: number,
  container: StackContainer,
  it: EquipInstance,
  origin: 'loot' | 'merchant' | 'quest' | 'craft' | 'start' | 'dungeon',
  reason: string,
): Promise<number | null> {
  if (slotsUsed(c, await contents(tx, playerId, container)) >= capacity(c, container)) return null;
  const row = await tx
    .insertInto('item_instance')
    .values({
      player_id: playerId,
      container,
      troop_id: null,
      unit_n: null,
      slot: null,
      base: it.base,
      roll: it.roll,
      stats: JSON.stringify(it.stats),
      origin,
      content_version: c.hash,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  await log(tx, playerId, { kind: 'instance', item: it.base, instanceId: row.id, from: 'SYSTEM', to: container, reason });
  return row.id;
}

/** Déplace un exemplaire d'un conteneur à un autre (place vérifiée à l'arrivée). */
export async function moveInstance(
  tx: Tx,
  c: GameContent,
  playerId: number,
  id: number,
  from: StackContainer,
  to: InstanceContainer,
  reason: string,
): Promise<void> {
  const row = await tx
    .selectFrom('item_instance')
    .select(['id', 'base'])
    .where('id', '=', id)
    .where('player_id', '=', playerId)
    .where('container', '=', from)
    .forUpdate()
    .executeTakeFirst();
  if (!row) throw new GameError('ITEM_NOT_FOUND');
  if ((to === 'BAG' || to === 'BANK') && slotsUsed(c, await contents(tx, playerId, to)) >= capacity(c, to))
    throw new GameError(to === 'BAG' ? 'BAG_FULL' : 'BANK_FULL');
  await tx
    .updateTable('item_instance')
    .set({ container: to, ...(to === 'SYSTEM' || to === 'GRAVE' ? { player_id: null } : {}), updated_at: new Date() })
    .where('id', '=', id)
    .execute();
  await log(tx, playerId, { kind: 'instance', item: row.base, instanceId: id, from, to, reason });
}

/**
 * Vide un conteneur (coffre du donjon) vers la banque, sans limite d'emplacements (README 23.6 [H] : le coffre est
 * livré en banque même pleine), ou vers le puits (défaite : le coffre est perdu).
 */
export async function emptyContainer(tx: Tx, playerId: number, from: StackContainer, to: 'BANK' | 'SYSTEM', reason: string): Promise<void> {
  const stacks = await tx
    .selectFrom('item_stack')
    .select(['id', 'item', 'qty'])
    .where('player_id', '=', playerId)
    .where('container', '=', from)
    .forUpdate()
    .execute();
  for (const s of stacks) {
    await tx.deleteFrom('item_stack').where('id', '=', s.id).execute();
    if (to === 'BANK')
      await tx
        .insertInto('item_stack')
        .values({ player_id: playerId, container: 'BANK', item: s.item, qty: s.qty })
        .onConflict((oc) =>
          oc
            .columns(['player_id', 'container', 'item'])
            .doUpdateSet((eb) => ({ qty: eb('item_stack.qty', '+', s.qty), updated_at: new Date() })),
        )
        .execute();
    await log(tx, playerId, { kind: 'stack', item: s.item, qty: s.qty, from, to, reason });
  }
  const inst = await tx
    .selectFrom('item_instance')
    .select(['id', 'base'])
    .where('player_id', '=', playerId)
    .where('container', '=', from)
    .forUpdate()
    .execute();
  for (const i of inst) {
    await tx
      .updateTable('item_instance')
      .set({ container: to, ...(to === 'SYSTEM' ? { player_id: null } : {}), updated_at: new Date() })
      .where('id', '=', i.id)
      .execute();
    await log(tx, playerId, { kind: 'instance', item: i.base, instanceId: i.id, from, to, reason });
  }
}

/** Le butin au sol est perdu dès qu'on quitte l'étape (README 7.2). */
export async function dropPendingLoot(tx: Tx, playerId: number, reason: string): Promise<void> {
  const stacks = await tx
    .selectFrom('item_stack')
    .select(['item', 'qty'])
    .where('player_id', '=', playerId)
    .where('container', '=', 'PENDING_LOOT')
    .execute();
  for (const s of stacks) await takeStack(tx, playerId, 'PENDING_LOOT', s.item, s.qty, 'SYSTEM', reason);
  const inst = await tx
    .selectFrom('item_instance')
    .select(['id', 'base'])
    .where('player_id', '=', playerId)
    .where('container', '=', 'PENDING_LOOT')
    .execute();
  for (const i of inst) {
    await tx
      .updateTable('item_instance')
      .set({ container: 'SYSTEM', player_id: null, updated_at: new Date() })
      .where('id', '=', i.id)
      .execute();
    await log(tx, playerId, { kind: 'instance', item: i.base, instanceId: i.id, from: 'PENDING_LOOT', to: 'SYSTEM', reason });
  }
}
