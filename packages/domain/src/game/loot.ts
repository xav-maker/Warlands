/** Butin au sol et sac (README 7.2) : ramasser ce qui n'a pas tenu, jeter pour faire de la place. */
import { z } from 'zod';
import { GameError } from '@cr/shared';
import { command } from '../command.ts';
import { addStack, moveInstance, stackQty, takeStack } from './inventory.ts';

const target = z.union([
  z.object({ item: z.string().min(1), qty: z.number().int().positive().optional() }),
  z.object({ instance: z.number().int().positive() }),
]);

export const takeLoot = command({
  name: 'loot.take',
  input: target,
  rate: { perMinute: 60 },
  where: ['route'],
  async run(ctx, input) {
    const pid = ctx.player.id;
    if ('instance' in input) {
      await moveInstance(ctx.tx, ctx.content, pid, input.instance, 'PENDING_LOOT', 'BAG', 'ramassé');
      return { taken: 1 };
    }
    const have = await stackQty(ctx.tx, pid, 'PENDING_LOOT', input.item);
    const want = Math.min(have, input.qty ?? have);
    if (!want) throw new GameError('ITEM_NOT_FOUND');
    const left = await addStack(ctx.tx, ctx.content, pid, 'BAG', input.item, want, 'PENDING_LOOT', 'ramassé');
    if (left === want) throw new GameError('BAG_FULL');
    await takeStack(ctx.tx, pid, 'PENDING_LOOT', input.item, want - left, 'BAG', 'ramassé');
    return { taken: want - left };
  },
});

export const discard = command({
  name: 'bag.discard',
  input: target,
  rate: { perMinute: 60 },
  where: ['route', 'city'],
  async run(ctx, input) {
    const pid = ctx.player.id;
    if ('instance' in input) await moveInstance(ctx.tx, ctx.content, pid, input.instance, 'BAG', 'SYSTEM', 'jeté');
    else await takeStack(ctx.tx, pid, 'BAG', input.item, input.qty ?? (await stackQty(ctx.tx, pid, 'BAG', input.item)), 'SYSTEM', 'jeté');
    return { ok: true };
  },
});
