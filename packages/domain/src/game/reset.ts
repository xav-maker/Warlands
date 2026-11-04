/**
 * Recommencer la partie : le compte repart de zéro (comme « Nouvelle partie » dans le prototype), avec une
 * nouvelle graine, donc de nouvelles recettes. Le kit de départ est redonné à la commande suivante.
 *
 * Rien ne disparaît hors du journal : l'or retourne au grand livre (SINK_RESET), les biens partent vers le
 * puits (SYSTEM, troupes en tombe) avec une ligne d'asset_move chacun ; l'historique des combats est gardé.
 */
import { randomInt } from 'node:crypto';
import { z } from 'zod';
import { bestForm, bestGear } from '@cr/gen';
import { Rng, hash } from '@cr/rng';
import type { Database, Transaction } from '@cr/db';
import { command } from '../command.ts';
import type { CommandContext } from '../command.ts';
import { START_REGION } from '../identity.ts';
import type { GameContent } from './content.ts';
import { balance, transferGold } from './gold.ts';
import { createTroop, loadTroops, setUnit, statsOf } from './troops.ts';

type Tx = Transaction<Database>;

export const RESET_WORD = 'RECOMMENCER';

export const resetGame = command({
  name: 'account.resetGame',
  input: z.object({ confirm: z.literal(RESET_WORD) }),
  rate: { perMinute: 3 },
  allowedDuringWatch: true,
  run: (ctx) => wipeGame(ctx),
});

/**
 * Remet la partie du joueur à zéro (commande de remise à zéro, suppression du compte) : or au puits, biens au puits,
 * troupes en tombe, annonces retirées, donjon quitté, position à Havre-Gris. Tout reste journalisé.
 */
export async function wipeGame(ctx: CommandContext): Promise<{ gold: number }> {
  const tx = ctx.tx;
  const pid = ctx.player.id;
  const log = (
    kind: 'stack' | 'instance' | 'troop',
    item: string,
    from: string,
    to: string,
    o: { qty?: number; instance?: number; troop?: number } = {},
  ) =>
    tx
      .insertInto('asset_move')
      .values({
        player_id: pid,
        kind,
        item,
        instance_id: o.instance ?? null,
        troop_id: o.troop ?? null,
        qty: o.qty ?? 1,
        from_container: from,
        to_container: to,
        reason: 'remise à zéro',
      })
      .execute();

  // Annonces en cours : retirées (leurs biens partent avec le reste).
  await tx
    .updateTable('shop_listing')
    .set({ status: 'withdrawn', closed_at: ctx.now })
    .where('seller_id', '=', pid)
    .where('status', '=', 'active')
    .execute();
  // Objets empilés : supprimés.
  for (const s of await tx.selectFrom('item_stack').select(['item', 'qty', 'container']).where('player_id', '=', pid).execute())
    await log('stack', s.item, s.container, 'SYSTEM', { qty: s.qty });
  await tx.deleteFrom('item_stack').where('player_id', '=', pid).execute();
  // Exemplaires (portés compris) : vers le puits.
  for (const i of await tx
    .selectFrom('item_instance')
    .select(['id', 'base', 'container'])
    .where('player_id', '=', pid)
    .where('container', 'not in', ['SYSTEM', 'GRAVE'])
    .execute())
    await log('instance', i.base, i.container, 'SYSTEM', { instance: i.id });
  await tx
    .updateTable('item_instance')
    .set({ container: 'SYSTEM', player_id: null, troop_id: null, unit_n: null, slot: null, updated_at: ctx.now })
    .where('player_id', '=', pid)
    .where('container', 'not in', ['SYSTEM', 'GRAVE'])
    .execute();
  // Troupes : en tombe (les lignes restent pour l'historique des combats et des ventes).
  for (const t of await tx
    .selectFrom('troop')
    .select(['id', 'type', 'container'])
    .where('player_id', '=', pid)
    .where('container', '<>', 'GRAVE')
    .execute())
    await log('troop', t.type, t.container, 'GRAVE', { troop: t.id });
  await tx
    .updateTable('troop')
    .set({ container: 'GRAVE', died_at: ctx.now, updated_at: ctx.now })
    .where('player_id', '=', pid)
    .where('container', '<>', 'GRAVE')
    .execute();
  // Or : rendu au grand livre.
  const gold = await balance(tx, pid);
  if (gold > 0) await transferGold(tx, { player: pid }, { system: 'SINK_RESET' }, gold, 'remise à zéro');
  // Expédition, rencontres, quêtes, recettes personnelles.
  await tx.deleteFrom('expedition').where('player_id', '=', pid).execute();
  await tx.updateTable('encounter').set({ status: 'gone' }).where('player_id', '=', pid).where('status', '=', 'visible').execute();
  // Donjon : porte effacée, participation close (le coffre est parti avec les autres biens), partie close si vide.
  await tx.updateTable('dungeon_door').set({ status: 'gone' }).where('player_id', '=', pid).where('status', '=', 'visible').execute();
  const runs = await tx
    .updateTable('dungeon_member')
    .set({ status: 'left', chest_gold: 0, left_at: ctx.now })
    .where('player_id', '=', pid)
    .where('status', '=', 'active')
    .returning('run_id')
    .execute();
  for (const { run_id } of runs)
    await tx
      .updateTable('dungeon_run')
      .set({ status: 'closed', closed_at: ctx.now, updated_at: ctx.now, lock_version: (eb) => eb('lock_version', '+', 1) })
      .where('id', '=', run_id)
      .where((eb) =>
        eb.not(
          eb.exists(
            eb.selectFrom('dungeon_member').select('player_id').whereRef('run_id', '=', 'dungeon_run.id').where('status', '=', 'active'),
          ),
        ),
      )
      .execute();
  await tx.deleteFrom('quest').where('player_id', '=', pid).execute();
  await tx.deleteFrom('player_recipe').where('player_id', '=', pid).execute();
  await tx.deleteFrom('player_reserved_material').where('player_id', '=', pid).execute();
  // Joueur : retour à Havre-Gris, nouvelle graine, compteurs à zéro ; le kit sera remis à la prochaine commande.
  await tx
    .updateTable('player')
    .set({
      seed: randomInt(0, 2 ** 32 - 1) >>> 0,
      pos_kind: 'city',
      pos_region: START_REGION,
      pos_route: null,
      pos_direction: null,
      pos_step: null,
      pos_dungeon_run: null,
      watch_until: null,
      started_at: null,
      content_version: null,
      stat_fights: 0,
      stat_wins: 0,
      stat_deaths: 0,
      guardians: [],
      unlocked: 0,
      lock_version: ctx.player.lock_version + 1,
      updated_at: ctx.now,
    })
    .where('id', '=', pid)
    .execute();
  return { gold };
}

/**
 * Outil de test (préproduction seulement, ENABLE_TEST_TOOLS) : escouade pleine de niveau 30, comme
 * tools/seed-dev ; les troupes engagées vont en caserne. Jamais exposé en production.
 */
export const giveTestSquad = command({
  name: 'dev.giveTestSquad',
  input: z.object({}),
  rate: { perMinute: 3 },
  where: ['city'],
  async run(ctx) {
    await ctx.tx
      .updateTable('troop')
      .set({ container: 'BARRACKS', updated_at: ctx.now })
      .where('player_id', '=', ctx.player.id)
      .where('container', '=', 'SQUAD')
      .execute();
    await createTestSquad(ctx.tx, ctx.content, ctx.player.id, 30, 'outil de test');
    return { level: 30 };
  },
});

export const TEST_SQUAD = ['briseur', 'acolyte', 'chasseur', 'milicien', 'frondeurs', 'pyromancien'];

/**
 * Escouade de test (8 unités, 10 de population) : chaque troupe au niveau donné, dans la forme évoluée de ce niveau,
 * équipée au plus haut palier que le niveau permet (exemplaires moyens) et à pleine vie. Les combats d'une route se
 * suivent sans soin et les monstres sont réglés pour des escouades de leur niveau : sans équipement, même le niveau 30
 * ne passe pas les cinq étapes de la première route.
 */
export async function createTestSquad(tx: Tx, c: GameContent, playerId: number, level: number, reason: string): Promise<void> {
  const rng = new Rng(hash(level, playerId));
  for (const type of TEST_SQUAD) {
    const def = c.pack.troops[type]!;
    const id = await createTroop(tx, c, playerId, { type, level, container: 'SQUAD', reason, form: bestForm(def, level) });
    const units = (await loadTroops(tx, playerId, ['SQUAD'])).find((t) => t.id === id)!.units;
    for (const u of units)
      for (const [slot, it] of Object.entries(bestGear(c.pack, type, level, 5, rng))) {
        const row = await tx
          .insertInto('item_instance')
          .values({
            player_id: playerId,
            container: 'EQUIPPED',
            troop_id: id,
            unit_n: u.n,
            slot,
            base: it.base,
            roll: it.roll,
            stats: JSON.stringify(it.stats),
            origin: 'start',
            content_version: c.hash,
          })
          .returning('id')
          .executeTakeFirstOrThrow();
        await tx
          .insertInto('asset_move')
          .values({
            player_id: playerId,
            kind: 'instance',
            item: it.base,
            instance_id: row.id,
            troop_id: null,
            from_container: 'SYSTEM',
            to_container: 'EQUIPPED',
            reason,
          })
          .execute();
      }
    // Pleine vie et plein mana avec l'équipement.
    const t = (await loadTroops(tx, playerId, ['SQUAD'])).find((x) => x.id === id)!;
    for (const u of t.units) {
      const s = statsOf(c, t, u);
      await setUnit(tx, id, u.n, { hp: s.hpMax, mana: s.manaMax });
    }
  }
}
