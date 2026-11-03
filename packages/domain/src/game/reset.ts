/**
 * Recommencer la partie : le compte repart de zéro (comme « Nouvelle partie » dans le prototype), avec une
 * nouvelle graine, donc de nouvelles recettes. Le kit de départ est redonné à la commande suivante.
 *
 * Rien ne disparaît hors du journal : l'or retourne au grand livre (SINK_RESET), les biens partent vers le
 * puits (SYSTEM, troupes en tombe) avec une ligne d'asset_move chacun ; l'historique des combats est gardé.
 */
import { randomInt } from 'node:crypto';
import { z } from 'zod';
import { command } from '../command.ts';
import { START_REGION } from '../identity.ts';
import { balance, transferGold } from './gold.ts';
import { createTroop } from './troops.ts';

export const RESET_WORD = 'RECOMMENCER';

export const resetGame = command({
  name: 'account.resetGame',
  input: z.object({ confirm: z.literal(RESET_WORD) }),
  rate: { perMinute: 3 },
  allowedDuringWatch: true,
  async run(ctx) {
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
  },
});

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
    for (const type of ['briseur', 'acolyte', 'chasseur', 'milicien', 'frondeurs', 'pyromancien'])
      await createTroop(ctx.tx, ctx.content, ctx.player.id, { type, level: 30, container: 'SQUAD', reason: 'outil de test' });
    return { level: 30 };
  },
});
