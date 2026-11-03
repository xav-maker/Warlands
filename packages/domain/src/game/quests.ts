/**
 * Quêtes de ville (README 9.2, 9.3) : 5 par ville, visibles partout dès le début, tirées de la graine du
 * joueur. Rendre : dans la ville de la quête, avec tous les trophées (banque puis sac) ; or et récompense
 * versés, quête remplacée par la suivante. Renoncer : 10 × palier de la ville en or, quête remplacée.
 */
import { z } from 'zod';
import { GameError } from '@cr/shared';
import { Rng } from '@cr/rng';
import { genEquip, genQuest } from '@cr/gen';
import type { Quest } from '@cr/gen';
import type { Database, Player, Transaction } from '@cr/db';
import { command } from '../command.ts';
import type { CommandContext } from '../command.ts';
import { online, region, regionIndex } from './content.ts';
import type { GameContent } from './content.ts';
import { freshSeed } from './expedition.ts';
import { transferGold } from './gold.ts';
import { addInstance, addStack, capacity, contents, slotsUsed, stackQty, takeStack } from './inventory.ts';
import { owned } from './recipes.ts';
import { createTroop, loadTroops, squadUsage } from './troops.ts';

type Tx = Transaction<Database>;
export const QUESTS_PER_CITY = 5;

/** Complète à 5 les quêtes proposées de chaque ville (génération à la première visite, puis remplacement). */
export async function ensureQuests(tx: Tx, c: GameContent, player: Pick<Player, 'id' | 'seed'>): Promise<void> {
  const rows = await tx.selectFrom('quest').select(['region', 'n', 'status']).where('player_id', '=', player.id).execute();
  for (const R of c.pack.regions) {
    const mine = rows.filter((q) => q.region === R.id);
    let offered = mine.filter((q) => q.status === 'offered').length;
    let next = mine.reduce((m, q) => Math.max(m, q.n + 1), 0);
    const ri = regionIndex(c, R.id);
    while (offered < QUESTS_PER_CITY) {
      const q = genQuest(c.pack, player.seed, ri, next);
      await tx
        .insertInto('quest')
        .values({ player_id: player.id, region: R.id, n: next, data: JSON.stringify(q), status: 'offered', content_version: c.hash })
        .execute();
      next++;
      offered++;
    }
  }
}

async function offered(ctx: CommandContext, id: number): Promise<{ id: number; region: string; data: Quest }> {
  const q = await ctx.tx
    .selectFrom('quest')
    .select(['id', 'region', 'data'])
    .where('id', '=', id)
    .where('player_id', '=', ctx.player.id)
    .where('status', '=', 'offered')
    .forUpdate()
    .executeTakeFirst();
  if (!q) throw new GameError('QUEST_NOT_FOUND');
  if (q.region !== ctx.player.pos_region) throw new GameError('QUEST_ELSEWHERE', { ville: region(ctx.content, q.region).city.name });
  return { id: q.id, region: q.region, data: q.data as Quest };
}

const close = async (ctx: CommandContext, id: number, status: 'done' | 'abandoned'): Promise<void> => {
  await ctx.tx.updateTable('quest').set({ status, closed_at: ctx.now }).where('id', '=', id).execute();
  await ensureQuests(ctx.tx, ctx.content, ctx.player);
};

/** Emplacements libres en banque et dans le sac. */
async function freeSlots(ctx: CommandContext): Promise<{ bank: number; bag: number }> {
  const c = ctx.content;
  const bank = capacity(c, 'BANK') - slotsUsed(c, await contents(ctx.tx, ctx.player.id, 'BANK'));
  const bag = capacity(c, 'BAG') - slotsUsed(c, await contents(ctx.tx, ctx.player.id, 'BAG'));
  return { bank, bag };
}

export const turnInQuest = command({
  name: 'quest.turnIn',
  input: z.object({ quest: z.number().int().positive() }),
  rate: { perMinute: 20 },
  where: ['city'],
  async run(ctx, input) {
    const c = ctx.content;
    const pid = ctx.player.id;
    const q = await offered(ctx, input.quest);
    const { needs, reward, gold } = q.data;
    for (const [id, k] of needs) if ((await owned(ctx.tx, pid, id)) < k) throw new GameError('NOT_ENOUGH_ITEMS', { objet: id });
    // Place pour la récompense, vérifiée avant de rien consommer (README 9.3).
    const free = await freeSlots(ctx);
    if (reward.kind === 'equip' && free.bank + free.bag < 1) throw new GameError('BANK_FULL');
    if (reward.kind === 'items' && free.bank + free.bag < reward.items.length)
      throw new GameError('NOT_ENOUGH_SLOTS', { n: reward.items.length });
    // Trophées : banque d'abord, puis sac.
    for (const [id, k] of needs) {
      const fromBank = Math.min(k, await stackQty(ctx.tx, pid, 'BANK', id));
      if (fromBank) await takeStack(ctx.tx, pid, 'BANK', id, fromBank, 'SYSTEM', 'quête rendue');
      if (k - fromBank) await takeStack(ctx.tx, pid, 'BAG', id, k - fromBank, 'SYSTEM', 'quête rendue');
    }
    await transferGold(ctx.tx, { system: 'SOURCE_QUEST' }, { player: pid }, gold, `quête ${q.data.id}`);
    let got: Record<string, unknown>;
    if (reward.kind === 'equip') {
      const it = genEquip(c.pack, reward.base, new Rng(freshSeed(ctx)), reward.roll);
      const inst =
        (await addInstance(ctx.tx, c, pid, 'BANK', it, 'quest', 'quête')) ??
        (await addInstance(ctx.tx, c, pid, 'BAG', it, 'quest', 'quête'));
      got = { instance: inst, base: reward.base, roll: reward.roll };
    } else if (reward.kind === 'items') {
      for (const [id, k] of reward.items) {
        const left = await addStack(ctx.tx, c, pid, 'BANK', id, k, 'SYSTEM', 'quête');
        if (left) await addStack(ctx.tx, c, pid, 'BAG', id, left, 'SYSTEM', 'quête');
      }
      got = { items: reward.items };
    } else {
      // Troupe : en escouade si elle tient, sinon en caserne.
      const def = c.pack.troops[reward.type]!;
      const o = online(c);
      const u = squadUsage(
        c,
        (await loadTroops(ctx.tx, pid, ['SQUAD'])).filter((t) => t.units.length),
      );
      const fits = u.pop + def.pop <= o.squad.maxPop && u.units + def.units <= o.squad.maxUnits;
      const troop = await createTroop(ctx.tx, c, pid, {
        type: reward.type,
        level: reward.level,
        container: fits ? 'SQUAD' : 'BARRACKS',
        reason: 'quête',
      });
      got = { troop, type: reward.type, level: reward.level };
    }
    await close(ctx, q.id, 'done');
    return { gold, reward: got };
  },
});

export const abandonQuest = command({
  name: 'quest.abandon',
  input: z.object({ quest: z.number().int().positive() }),
  rate: { perMinute: 20 },
  where: ['city'],
  async run(ctx, input) {
    const q = await offered(ctx, input.quest);
    const cost = 10 * region(ctx.content, q.region).tier;
    await transferGold(ctx.tx, { player: ctx.player.id }, { system: 'SINK_QUEST_ABANDON' }, cost, `renoncement ${q.data.id}`);
    await close(ctx, q.id, 'abandoned');
    return { cost };
  },
});
