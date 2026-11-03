/**
 * Services de ville et consommables (README 3.4, 7.2, 7.5, 8.3) : banque, marchand, consommables.
 * Le temple n'existe plus : le soin est automatique à l'entrée en ville (README 21).
 */
import { z } from 'zod';
import { GameError } from '@cr/shared';
import { Rng } from '@cr/rng';
import { genEquip, itemValue } from '@cr/gen';
import type { StackContainer } from '@cr/db';
import { command } from '../command.ts';
import { region } from './content.ts';
import type { GameContent } from './content.ts';
import { freshSeed } from './expedition.ts';
import { transferGold } from './gold.ts';
import { addInstance, addStack, moveInstance, stackQty, takeStack } from './inventory.ts';
import { loadTroops, setUnit, statsOf } from './troops.ts';
import { recipes } from './recipes.ts';

/**
 * Commande neutre appelée avant chaque page : remet le kit de départ si besoin et matérialise les recettes
 * personnelles, pour que la page les lise ensuite sans rien écrire.
 */
export const ensureStarted = command({
  name: 'game.start',
  input: z.object({}),
  rate: { perMinute: 600 },
  allowedDuringWatch: true,
  async run(ctx) {
    await recipes(ctx.tx, ctx.content, ctx.player);
    return {};
  },
});

const goods = z.union([
  z.object({ item: z.string().min(1), qty: z.number().int().positive() }),
  z.object({ instance: z.number().int().positive() }),
]);
const where = z.enum(['BAG', 'BANK']);

/** Banque (README 7.2) : en ville seulement ; ce qui ne tient pas reste à sa place. */
export const bankMove = command({
  name: 'bank.move',
  input: z.intersection(goods, z.object({ from: where })),
  rate: { perMinute: 120 },
  where: ['city'],
  async run(ctx, input) {
    const pid = ctx.player.id;
    const to: StackContainer = input.from === 'BAG' ? 'BANK' : 'BAG';
    if ('instance' in input) {
      await moveInstance(ctx.tx, ctx.content, pid, input.instance, input.from, to, 'banque');
      return { moved: 1 };
    }
    if ((await stackQty(ctx.tx, pid, input.from, input.item)) < input.qty) throw new GameError('NOT_ENOUGH_ITEMS');
    const left = await addStack(ctx.tx, ctx.content, pid, to, input.item, input.qty, input.from, 'banque');
    if (left === input.qty) throw new GameError(to === 'BAG' ? 'BAG_FULL' : 'BANK_FULL');
    await takeStack(ctx.tx, pid, input.from, input.item, input.qty - left, to, 'banque');
    return { moved: input.qty - left };
  },
});

/** Prix d'achat au marchand : ceil(valeur × 1,5) (README 8.3). */
export function buyPrice(c: GameContent, id: string): number {
  return Math.ceil((c.pack.equip[id]?.value ?? c.pack.items[id]!.value) * Number(c.pack.eco.sellMarkup));
}

/** Prix de rachat d'un objet empilable : max(1, floor(valeur × 0,2)) l'unité (README 8.3). */
export const sellPrice = (c: GameContent, item: string): number =>
  Math.max(1, Math.floor(c.pack.items[item]!.value * Number(c.pack.eco.buyBack)));

export const merchantBuy = command({
  name: 'merchant.buy',
  input: z.object({ id: z.string().min(1) }),
  rate: { perMinute: 60 },
  where: ['city'],
  async run(ctx, input) {
    const c = ctx.content;
    const pid = ctx.player.id;
    if (!region(c, ctx.player.pos_region).city.shop.includes(input.id)) throw new GameError('NOT_SOLD_HERE');
    const price = buyPrice(c, input.id);
    await transferGold(ctx.tx, { player: pid }, { system: 'SINK_MERCHANT_SELL' }, price, `achat ${input.id}`);
    // Ce qui est acheté arrive en banque (README 7.2) ; l'équipement a un jet fixe (« médiocre », README 8.3).
    if (c.pack.equip[input.id]) {
      const it = genEquip(c.pack, input.id, new Rng(freshSeed(ctx)), Number(c.pack.eco.shopRoll));
      if (!(await addInstance(ctx.tx, c, pid, 'BANK', it, 'merchant', 'achat'))) throw new GameError('BANK_FULL');
    } else if (await addStack(ctx.tx, c, pid, 'BANK', input.id, 1, 'SYSTEM', 'achat')) throw new GameError('BANK_FULL');
    return { price };
  },
});

export const merchantSell = command({
  name: 'merchant.sell',
  input: z.intersection(goods, z.object({ from: where })),
  rate: { perMinute: 60 },
  where: ['city'],
  async run(ctx, input) {
    const c = ctx.content;
    const pid = ctx.player.id;
    const buyBack = Number(c.pack.eco.buyBack);
    let gold: number;
    if ('instance' in input) {
      const it = await ctx.tx
        .selectFrom('item_instance')
        .select(['base', 'roll'])
        .where('id', '=', input.instance)
        .where('player_id', '=', pid)
        .where('container', '=', input.from)
        .executeTakeFirst();
      if (!it) throw new GameError('ITEM_NOT_FOUND');
      gold = Math.max(1, Math.floor(itemValue(c.pack, { uid: '', base: it.base, roll: it.roll, stats: [] }) * buyBack));
      await moveInstance(ctx.tx, c, pid, input.instance, input.from, 'SYSTEM', 'vente');
    } else {
      await takeStack(ctx.tx, pid, input.from, input.item, input.qty, 'SYSTEM', 'vente');
      gold = sellPrice(c, input.item) * input.qty;
    }
    await transferGold(ctx.tx, { system: 'SOURCE_MERCHANT_BUY' }, { player: pid }, gold, 'vente');
    return { gold };
  },
});

/**
 * Consommable sur une unité (README 7.5) : partout entre deux combats ; en ville le sac puis la banque,
 * en expédition le sac seulement. Effet : +ceil(max × % / 100) (contenu du prototype). Refusé si plein.
 */
export const useConsumable = command({
  name: 'consumable.use',
  input: z.object({ item: z.string().min(1), troop: z.number().int().positive(), unit: z.number().int().min(1).max(3) }),
  rate: { perMinute: 60 },
  where: ['city', 'route'],
  async run(ctx, input) {
    const c = ctx.content;
    const pid = ctx.player.id;
    const it = c.pack.items[input.item] as { kind: string; effect?: { hp?: number; mana?: number } } | undefined;
    if (it?.kind !== 'consommable') throw new GameError('NOT_CONSUMABLE');
    const t = (await loadTroops(ctx.tx, pid)).find((x) => x.id === input.troop);
    const u = t?.units.find((x) => x.n === input.unit);
    if (!t || !u) throw new GameError('UNIT_NOT_FOUND');
    const s = statsOf(c, t, u);
    const e = it.effect ?? {};
    const hpFull = !e.hp || u.hp >= s.hpMax;
    const manaFull = !e.mana || s.manaMax === 0 || u.mana >= s.manaMax;
    if (hpFull && manaFull) throw new GameError('GAUGE_FULL');
    const from: StackContainer = (await stackQty(ctx.tx, pid, 'BAG', input.item)) > 0 || ctx.player.pos_kind !== 'city' ? 'BAG' : 'BANK';
    await takeStack(ctx.tx, pid, from, input.item, 1, 'SYSTEM', 'consommé');
    const hp = e.hp ? Math.min(s.hpMax, u.hp + Math.ceil((s.hpMax * e.hp) / 100)) : u.hp;
    const mana = e.mana ? Math.min(s.manaMax, u.mana + Math.ceil((s.manaMax * e.mana) / 100)) : u.mana;
    await setUnit(ctx.tx, t.id, u.n, { hp, mana });
    return { hp, mana };
  },
});
