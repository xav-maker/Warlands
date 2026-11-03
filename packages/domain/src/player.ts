import { z } from 'zod';
import { command } from './command.ts';

/**
 * Première commande réelle : « disponible pour un donjon » (README 23.2). Elle sert surtout à
 * éprouver le squelette (verrou, idempotence, événements) avant les commandes de jeu de J2.
 */
export const setDungeonAvailable = command({
  name: 'player.setDungeonAvailable',
  input: z.object({ available: z.boolean() }),
  rate: { perMinute: 30 },
  allowedDuringWatch: true,
  async run(ctx, input) {
    await ctx.tx
      .updateTable('player')
      .set({ dungeon_available: input.available, lock_version: ctx.player.lock_version + 1, updated_at: ctx.now })
      .where('id', '=', ctx.player.id)
      .execute();
    ctx.emit({ topic: `user:${ctx.player.id}`, type: 'player.updated' });
    return { available: input.available };
  },
});
