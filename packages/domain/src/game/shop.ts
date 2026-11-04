/**
 * Boutiques des joueurs (README 22, guide 11). Une annonce n'existe que dans la ville où elle est posée.
 *
 * - Poser (en ville) : le bien vient de la banque (pile, exemplaire) ou de la caserne (troupe non engagée,
 *   non prêtée par la garde, compte de plus de 24 h) et passe en séquestre. Prix ≥ rachat du marchand ;
 *   20 annonces actives au plus ; expiration à 7 jours.
 * - Acheter (dans la ville de l'annonce) : verrou de l'annonce, contrôles, or acheteur → vendeur moins la taxe
 *   de 5 % (puits), bien vers la banque (ou la caserne) de l'acheteur, vente enregistrée, notification.
 *   Deux achats simultanés : le second attend le verrou, puis voit l'annonce vendue.
 * - Retirer (dans la ville de l'annonce) ; expirer (worker, idempotent) : le bien retourne au vendeur.
 */
import { z } from 'zod';
import { GameError } from '@cr/shared';
import { itemValue } from '@cr/gen';
import type { Database, Db, Transaction } from '@cr/db';
import { command } from '../command.ts';
import type { CommandContext } from '../command.ts';
import { region } from './content.ts';
import type { GameContent } from './content.ts';
import { sellPrice } from './city.ts';
import { transferGold } from './gold.ts';
import { addStack, capacity, contents, slotsUsed, takeStack } from './inventory.ts';
import { loadTroops } from './troops.ts';

type Tx = Transaction<Database>;

export const SHOP = {
  maxActive: 20,
  days: 7,
  /** Taxe en ‰ du prix, prélevée sur le vendeur (README 22.2). */
  taxPermille: 50,
  /** Ancienneté minimale du compte pour vendre une troupe (anti multi-comptes). */
  troopAccountAgeMs: 24 * 3600 * 1000,
};

interface ListingFields {
  kind: 'stack' | 'instance' | 'troop';
  item: string;
  qty: number;
  instance_id: number | null;
  troop_id: number | null;
  name: string;
  family: string;
  tier: number;
  slot: string | null;
  level: number | null;
}
type ListingGoods = Pick<ListingFields, 'kind' | 'item' | 'qty' | 'instance_id' | 'troop_id'> & { seller_id: number };

export const taxOf = (price: number): number => Math.round((price * SHOP.taxPermille) / 1000);

export async function notify(tx: Tx, playerId: number, type: string, data: Record<string, unknown>): Promise<void> {
  await tx
    .insertInto('notification')
    .values({ player_id: playerId, type, data: JSON.stringify(data) })
    .execute();
}

/** Prix minimal d'une troupe [H] : l'or de recrutement de son type, 40 × population × palier de sa ville. */
export function troopMinPrice(c: GameContent, type: string): number {
  const tier = c.pack.regions.find((r) => r.city.recruit.includes(type))?.tier ?? 1;
  return 40 * c.pack.troops[type]!.pop * tier;
}

const goods = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('stack'), item: z.string().min(1), qty: z.number().int().positive() }),
  z.object({ kind: z.literal('instance'), instance: z.number().int().positive() }),
  z.object({ kind: z.literal('troop'), troop: z.number().int().positive() }),
]);

async function moveLog(
  tx: Tx,
  playerId: number,
  m: {
    kind: 'stack' | 'instance' | 'troop';
    item: string;
    qty?: number;
    instance?: number;
    troop?: number;
    from: string;
    to: string;
    reason: string;
  },
) {
  await tx
    .insertInto('asset_move')
    .values({
      player_id: playerId,
      kind: m.kind,
      item: m.item,
      instance_id: m.instance ?? null,
      troop_id: m.troop ?? null,
      qty: m.qty ?? 1,
      from_container: m.from,
      to_container: m.to,
      reason: m.reason,
    })
    .execute();
}

export const listGoods = command({
  name: 'shop.list',
  input: z.intersection(goods, z.object({ price: z.number().int().positive().max(10_000_000) })),
  rate: { perMinute: 20 },
  where: ['city'],
  async run(ctx, input) {
    const c = ctx.content;
    const p = c.pack;
    const pid = ctx.player.id;
    const active = await ctx.tx
      .selectFrom('shop_listing')
      .select((eb) => eb.fn.countAll<number>().as('n'))
      .where('seller_id', '=', pid)
      .where('status', '=', 'active')
      .executeTakeFirstOrThrow();
    if (Number(active.n) >= SHOP.maxActive) throw new GameError('TOO_MANY_LISTINGS', { max: SHOP.maxActive });
    const expires = new Date(ctx.now.getTime() + SHOP.days * 86_400_000);
    const base = { region: ctx.player.pos_region, seller_id: pid, price: input.price, status: 'active' as const, expires_at: expires };
    let min: number;
    let row: ListingFields;
    if (input.kind === 'stack') {
      const it = p.items[input.item];
      if (!it) throw new GameError('ITEM_NOT_FOUND');
      min = sellPrice(c, input.item) * input.qty;
      if (input.price < min) throw new GameError('PRICE_TOO_LOW', { min });
      await takeStack(ctx.tx, pid, 'BANK', input.item, input.qty, 'ESCROW', 'mise en vente');
      row = {
        kind: 'stack',
        item: input.item,
        qty: input.qty,
        instance_id: null,
        troop_id: null,
        name: it.name,
        family: it.kind,
        tier: it.tier,
        slot: null,
        level: null,
      };
    } else if (input.kind === 'instance') {
      const inst = await ctx.tx
        .selectFrom('item_instance')
        .select(['id', 'base', 'roll'])
        .where('id', '=', input.instance)
        .where('player_id', '=', pid)
        .where('container', '=', 'BANK')
        .forUpdate()
        .executeTakeFirst();
      if (!inst) throw new GameError('ITEM_NOT_FOUND');
      const b = p.equip[inst.base]!;
      min = Math.max(1, Math.floor(itemValue(p, { uid: '', base: inst.base, roll: inst.roll, stats: [] }) * Number(p.eco.buyBack)));
      if (input.price < min) throw new GameError('PRICE_TOO_LOW', { min });
      await ctx.tx.updateTable('item_instance').set({ container: 'ESCROW', updated_at: ctx.now }).where('id', '=', inst.id).execute();
      await moveLog(ctx.tx, pid, {
        kind: 'instance',
        item: inst.base,
        instance: inst.id,
        from: 'BANK',
        to: 'ESCROW',
        reason: 'mise en vente',
      });
      row = {
        kind: 'instance',
        item: inst.base,
        qty: 1,
        instance_id: inst.id,
        troop_id: null,
        name: b.name,
        family: 'equipement',
        tier: b.tier,
        slot: b.slot,
        level: null,
      };
    } else {
      const t = (await loadTroops(ctx.tx, pid, ['BARRACKS'])).find((x) => x.id === input.troop);
      if (!t || !t.units.length) throw new GameError('TROOP_NOT_FOUND');
      if (t.loaned) throw new GameError('TROOP_LOANED');
      const acc = await ctx.tx.selectFrom('account').select('created_at').where('id', '=', ctx.player.account_id).executeTakeFirstOrThrow();
      if (ctx.now.getTime() - acc.created_at.getTime() < SHOP.troopAccountAgeMs) throw new GameError('ACCOUNT_TOO_NEW');
      min = troopMinPrice(c, t.type);
      if (input.price < min) throw new GameError('PRICE_TOO_LOW', { min });
      await ctx.tx.updateTable('troop').set({ container: 'ESCROW', updated_at: ctx.now }).where('id', '=', t.id).execute();
      await moveLog(ctx.tx, pid, { kind: 'troop', item: t.type, troop: t.id, from: 'BARRACKS', to: 'ESCROW', reason: 'mise en vente' });
      const def = p.troops[t.type]!;
      const tier = p.regions.find((r) => r.city.recruit.includes(t.type))?.tier ?? 1;
      const name = def.forms.find((f) => f.id === t.form)?.name ?? def.name;
      row = {
        kind: 'troop',
        item: t.type,
        qty: 1,
        instance_id: null,
        troop_id: t.id,
        name,
        family: 'troupe',
        tier,
        slot: null,
        level: t.level,
      };
    }
    const l = await ctx.tx
      .insertInto('shop_listing')
      .values({ ...base, ...row })
      .returning('id')
      .executeTakeFirstOrThrow();
    return { listing: l.id, expires };
  },
});

async function activeListing(tx: Tx, id: number) {
  const l = await tx.selectFrom('shop_listing').selectAll().where('id', '=', id).forUpdate().executeTakeFirst();
  if (!l) throw new GameError('LISTING_NOT_FOUND');
  if (l.status !== 'active') throw new GameError('LISTING_GONE');
  return l;
}

/** Rend le bien d'une annonce au vendeur (retrait ou expiration). `force` : la banque peut déborder (expiration). */
async function giveBack(tx: Tx, c: GameContent | null, l: ListingGoods, reason: string, force: boolean): Promise<void> {
  if (l.kind === 'stack') {
    if (force || !c) {
      await tx
        .insertInto('item_stack')
        .values({ player_id: l.seller_id, container: 'BANK', item: l.item, qty: l.qty })
        .onConflict((oc) => oc.columns(['player_id', 'container', 'item']).doUpdateSet((eb) => ({ qty: eb('item_stack.qty', '+', l.qty) })))
        .execute();
      await moveLog(tx, l.seller_id, { kind: 'stack', item: l.item, qty: l.qty, from: 'ESCROW', to: 'BANK', reason });
    } else if (await addStack(tx, c, l.seller_id, 'BANK', l.item, l.qty, 'ESCROW', reason)) throw new GameError('BANK_FULL');
  } else if (l.kind === 'instance') {
    if (!force && c && slotsUsed(c, await contents(tx, l.seller_id, 'BANK')) >= capacity(c, 'BANK')) throw new GameError('BANK_FULL');
    await tx.updateTable('item_instance').set({ container: 'BANK', updated_at: new Date() }).where('id', '=', l.instance_id!).execute();
    await moveLog(tx, l.seller_id, { kind: 'instance', item: l.item, instance: l.instance_id!, from: 'ESCROW', to: 'BANK', reason });
  } else {
    await tx.updateTable('troop').set({ container: 'BARRACKS', updated_at: new Date() }).where('id', '=', l.troop_id!).execute();
    await moveLog(tx, l.seller_id, { kind: 'troop', item: l.item, troop: l.troop_id!, from: 'ESCROW', to: 'BARRACKS', reason });
  }
}

export const withdrawListing = command({
  name: 'shop.withdraw',
  input: z.object({ listing: z.number().int().positive() }),
  rate: { perMinute: 20 },
  where: ['city'],
  async run(ctx, input) {
    const l = await activeListing(ctx.tx, input.listing);
    if (l.seller_id !== ctx.player.id) throw new GameError('LISTING_NOT_FOUND');
    if (l.region !== ctx.player.pos_region) throw new GameError('LISTING_ELSEWHERE', { ville: region(ctx.content, l.region).city.name });
    await giveBack(ctx.tx, ctx.content, l, 'retrait d’annonce', false);
    await ctx.tx.updateTable('shop_listing').set({ status: 'withdrawn', closed_at: ctx.now }).where('id', '=', l.id).execute();
    return { withdrawn: l.id };
  },
});

export const buyListing = command({
  name: 'shop.buy',
  input: z.object({ listing: z.number().int().positive() }),
  rate: { perMinute: 30 },
  where: ['city'],
  async run(ctx: CommandContext, input) {
    const c = ctx.content;
    const pid = ctx.player.id;
    const l = await activeListing(ctx.tx, input.listing);
    if (l.region !== ctx.player.pos_region) throw new GameError('LISTING_ELSEWHERE', { ville: region(c, l.region).city.name });
    if (l.seller_id === pid) throw new GameError('OWN_LISTING');
    const tax = taxOf(l.price);
    // Or : acheteur → vendeur, puis la taxe du vendeur vers le puits (comptes verrouillés dans l'ordre des ids).
    await transferGold(ctx.tx, { player: pid }, { player: l.seller_id }, l.price, `achat boutique ${l.id}`);
    if (tax > 0) await transferGold(ctx.tx, { player: l.seller_id }, { system: 'SINK_SHOP_TAX' }, tax, `taxe boutique ${l.id}`);
    if (l.kind === 'stack') {
      if (await addStack(ctx.tx, c, pid, 'BANK', l.item, l.qty, 'ESCROW', 'achat boutique')) throw new GameError('BANK_FULL');
    } else if (l.kind === 'instance') {
      if (slotsUsed(c, await contents(ctx.tx, pid, 'BANK')) >= capacity(c, 'BANK')) throw new GameError('BANK_FULL');
      await ctx.tx
        .updateTable('item_instance')
        .set({ container: 'BANK', player_id: pid, updated_at: ctx.now })
        .where('id', '=', l.instance_id!)
        .execute();
      await moveLog(ctx.tx, pid, {
        kind: 'instance',
        item: l.item,
        instance: l.instance_id!,
        from: 'ESCROW',
        to: 'BANK',
        reason: 'achat boutique',
      });
    } else {
      // La troupe arrive en caserne, avec l'équipement de ses unités.
      await ctx.tx
        .updateTable('troop')
        .set({ container: 'BARRACKS', player_id: pid, updated_at: ctx.now })
        .where('id', '=', l.troop_id!)
        .execute();
      await ctx.tx
        .updateTable('item_instance')
        .set({ player_id: pid, updated_at: ctx.now })
        .where('container', '=', 'EQUIPPED')
        .where('troop_id', '=', l.troop_id!)
        .execute();
      await ctx.tx
        .updateTable('troop_ownership')
        .set({ to_at: ctx.now })
        .where('troop_id', '=', l.troop_id!)
        .where('to_at', 'is', null)
        .execute();
      await ctx.tx.insertInto('troop_ownership').values({ troop_id: l.troop_id!, player_id: pid, reason: 'boutique' }).execute();
      await moveLog(ctx.tx, pid, {
        kind: 'troop',
        item: l.item,
        troop: l.troop_id!,
        from: 'ESCROW',
        to: 'BARRACKS',
        reason: 'achat boutique',
      });
    }
    await ctx.tx
      .insertInto('shop_sale')
      .values({ listing_id: l.id, region: l.region, item: l.item, qty: l.qty, buyer_id: pid, seller_id: l.seller_id, price: l.price, tax })
      .execute();
    await ctx.tx.updateTable('shop_listing').set({ status: 'sold', closed_at: ctx.now }).where('id', '=', l.id).execute();
    await notify(ctx.tx, l.seller_id, 'shop.sold', { listing: l.id, name: l.name, qty: l.qty, price: l.price, tax, ville: l.region });
    ctx.emit({ topic: `user:${l.seller_id}`, type: 'shop.sold', data: { listing: l.id } });
    return { bought: l.id, price: l.price };
  },
});

/** Expiration des annonces (worker) : idempotente ; une annonce déjà vendue ou retirée est ignorée. */
export async function expireListings(db: Db, now = new Date(), limit = 200): Promise<number> {
  return db.transaction().execute(async (tx) => {
    const due = await tx
      .selectFrom('shop_listing')
      .selectAll()
      .where('status', '=', 'active')
      .where('expires_at', '<=', now)
      .orderBy('id')
      .limit(limit)
      .forUpdate()
      .skipLocked()
      .execute();
    for (const l of due) {
      // La banque peut déborder : un bien ne se perd jamais à l'expiration.
      await giveBack(tx, null, l, 'annonce expirée', true);
      await tx.updateTable('shop_listing').set({ status: 'expired', closed_at: now }).where('id', '=', l.id).execute();
      await notify(tx, l.seller_id, 'shop.expired', { listing: l.id, name: l.name, qty: l.qty, ville: l.region });
    }
    return due.length;
  });
}

/** Marque toutes les notifications du joueur comme lues. */
export const markNotificationsRead = command({
  name: 'notifications.markRead',
  input: z.object({}),
  rate: { perMinute: 60 },
  allowedDuringWatch: true,
  async run(ctx) {
    await ctx.tx
      .updateTable('notification')
      .set({ read_at: ctx.now })
      .where('player_id', '=', ctx.player.id)
      .where('read_at', 'is', null)
      .execute();
    return {};
  },
});
