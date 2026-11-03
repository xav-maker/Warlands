/**
 * Expédition (README 3.3, guide 7.2 et 8.4) : départ, avancer, rebrousser, rentrer, arriver, chercher un
 * combat. Une seule rencontre visible par joueur (contrainte de la base) : la faille searchFight du
 * prototype (README 16, point 6) est fermée.
 */
import { z } from 'zod';
import { GameError } from '@cr/shared';
import { hash } from '@cr/rng';
import { genMonsters, stepSpec } from '@cr/gen';
import { command } from '../command.ts';
import type { CommandContext } from '../command.ts';
import { departures, destination, online, regionIndex, stepCount, stepOf } from './content.ts';
import { dropPendingLoot } from './inventory.ts';
import { healAll, loadTroops, loanIfNoTroops } from './troops.ts';

/** Graine 32 bits tirée par le serveur (guide 8.1). */
export const freshSeed = (ctx: CommandContext): number => hash(ctx.random(2 ** 31), ctx.random(2 ** 31));

/** Tire la rencontre de l'étape courante (remplace celle qui était en vue). */
export async function newEncounter(ctx: CommandContext, route: string, step: number): Promise<void> {
  const c = ctx.content;
  const p = c.pack;
  const st = stepOf(c, route, step);
  const o = online(c);
  await ctx.tx
    .updateTable('encounter')
    .set({ status: 'gone' })
    .where('player_id', '=', ctx.player.id)
    .where('status', '=', 'visible')
    .execute();
  // Monstre rare : après rareMinWins victoires, rareChance % des rencontres hors gardien (README 9.1).
  const rareDef = !st.guardian ? p.rares.find((r) => r.step === st.id) : undefined;
  const rare = rareDef && ctx.player.stat_wins >= p.rareMinWins && ctx.random(100) < p.rareChance ? rareDef.id : undefined;
  const spec = stepSpec(st, rare);
  // README 20 [H] : population ×popMult (arrondie), 8 emplacements, pour une escouade de 8 / 11.
  const scale = (v: number): number => Math.max(1, Math.round(v * o.encounters.popMult));
  const seed = freshSeed(ctx);
  const side = genMonsters(p, { ...spec, pop: [scale(spec.pop[0]), scale(spec.pop[1])], slots: o.encounters.slots }, seed);
  await ctx.tx
    .insertInto('encounter')
    .values({
      player_id: ctx.player.id,
      route,
      step,
      side: JSON.stringify(side),
      rare: rare ?? null,
      guardian: !!st.guardian,
      seed,
      status: 'visible',
    })
    .execute();
}

async function setPosition(
  ctx: CommandContext,
  pos: { kind: 'city'; region: string } | { kind: 'route'; route: string; direction: number; step: number },
): Promise<void> {
  await ctx.tx
    .updateTable('player')
    .set(
      pos.kind === 'city'
        ? {
            pos_kind: 'city',
            pos_region: pos.region,
            pos_route: null,
            pos_direction: null,
            pos_step: null,
            lock_version: ctx.player.lock_version + 1,
            updated_at: ctx.now,
          }
        : {
            pos_kind: 'route',
            pos_route: pos.route,
            pos_direction: pos.direction,
            pos_step: pos.step,
            lock_version: ctx.player.lock_version + 1,
            updated_at: ctx.now,
          },
    )
    .where('id', '=', ctx.player.id)
    .execute();
}

/**
 * Entrée en ville (guide 8.4, README 21) : position, soin complet de toutes les troupes, butin au sol perdu,
 * rencontre et expédition effacées, prêt de la garde si le joueur n'a plus de troupe.
 */
export async function enterCity(ctx: CommandContext, regionId: string, reason: string): Promise<void> {
  await ctx.tx
    .updateTable('encounter')
    .set({ status: 'gone' })
    .where('player_id', '=', ctx.player.id)
    .where('status', '=', 'visible')
    .execute();
  await ctx.tx.deleteFrom('expedition').where('player_id', '=', ctx.player.id).execute();
  await dropPendingLoot(ctx.tx, ctx.player.id, reason);
  await setPosition(ctx, { kind: 'city', region: regionId });
  await loanIfNoTroops(ctx.tx, ctx.content, ctx.player.id);
  await healAll(ctx.tx, ctx.content, ctx.player.id);
}

async function expedition(ctx: CommandContext) {
  const e = await ctx.tx.selectFrom('expedition').selectAll().where('player_id', '=', ctx.player.id).forUpdate().executeTakeFirst();
  if (!e || ctx.player.pos_route === null || ctx.player.pos_step === null) throw new GameError('WRONG_POSITION');
  return { ...e, step: ctx.player.pos_step };
}

const emitMoved = (ctx: CommandContext): void => ctx.emit({ topic: `user:${ctx.player.id}`, type: 'player.moved' });

export const depart = command({
  name: 'route.depart',
  input: z.object({ direction: z.union([z.literal(1), z.literal(-1)]) }),
  rate: { perMinute: 10 },
  where: ['city'],
  async run(ctx, input) {
    const c = ctx.content;
    const d = departures(c, ctx.player.pos_region).find((x) => x.direction === input.direction);
    if (!d) throw new GameError('NO_SUCH_ROUTE');
    const squad = await loadTroops(ctx.tx, ctx.player.id, ['SQUAD']);
    if (!squad.some((t) => t.units.length)) throw new GameError('SQUAD_EMPTY');
    await ctx.tx.deleteFrom('expedition').where('player_id', '=', ctx.player.id).execute();
    await ctx.tx
      .insertInto('expedition')
      .values({
        player_id: ctx.player.id,
        route: d.route,
        direction: d.direction,
        cleared: Array(stepCount(c, d.route)).fill(false),
        started_at: ctx.now,
      })
      .execute();
    await setPosition(ctx, { kind: 'route', route: d.route, direction: d.direction, step: 0 });
    await newEncounter(ctx, d.route, 0);
    emitMoved(ctx);
    return { route: d.route, to: d.to };
  },
});

export const advance = command({
  name: 'route.advance',
  input: z.object({}),
  rate: { perMinute: 30 },
  where: ['route'],
  async run(ctx) {
    const e = await expedition(ctx);
    if (!e.cleared[e.step]) throw new GameError('STEP_NOT_CLEARED');
    if (e.step >= e.cleared.length - 1) throw new GameError('LAST_STEP');
    await dropPendingLoot(ctx.tx, ctx.player.id, 'avance');
    await setPosition(ctx, { kind: 'route', route: e.route, direction: e.direction, step: e.step + 1 });
    await newEncounter(ctx, e.route, e.step + 1);
    emitMoved(ctx);
    return { step: e.step + 1 };
  },
});

export const back = command({
  name: 'route.back',
  input: z.object({}),
  rate: { perMinute: 30 },
  where: ['route'],
  async run(ctx) {
    const e = await expedition(ctx);
    if (e.step === 0) throw new GameError('FIRST_STEP');
    await dropPendingLoot(ctx.tx, ctx.player.id, 'rebrousse');
    await setPosition(ctx, { kind: 'route', route: e.route, direction: e.direction, step: e.step - 1 });
    await newEncounter(ctx, e.route, e.step - 1);
    emitMoved(ctx);
    return { step: e.step - 1 };
  },
});

export const goHome = command({
  name: 'route.home',
  input: z.object({}),
  rate: { perMinute: 30 },
  where: ['route'],
  async run(ctx) {
    await enterCity(ctx, ctx.player.pos_region, 'retour en ville');
    emitMoved(ctx);
    return { region: ctx.player.pos_region };
  },
});

export const arrive = command({
  name: 'route.arrive',
  input: z.object({}),
  rate: { perMinute: 30 },
  where: ['route'],
  async run(ctx) {
    const c = ctx.content;
    const e = await expedition(ctx);
    const to = destination(c, e.route, e.direction);
    if (!to) throw new GameError('DEAD_END');
    if (e.step !== e.cleared.length - 1 || !e.cleared[e.step]) throw new GameError('NOT_AT_ROUTE_END');
    await enterCity(ctx, to, 'arrivée');
    const reached = regionIndex(c, to);
    if (reached > ctx.player.unlocked)
      await ctx.tx.updateTable('player').set({ unlocked: reached }).where('id', '=', ctx.player.id).execute();
    emitMoved(ctx);
    return { region: to };
  },
});

export const searchEncounter = command({
  name: 'encounter.search',
  input: z.object({}),
  rate: { perMinute: 30 },
  where: ['route'],
  async run(ctx) {
    const e = await expedition(ctx);
    const visible = await ctx.tx
      .selectFrom('encounter')
      .select('id')
      .where('player_id', '=', ctx.player.id)
      .where('status', '=', 'visible')
      .executeTakeFirst();
    if (visible) throw new GameError('ENCOUNTER_VISIBLE');
    await newEncounter(ctx, e.route, e.step);
    return { step: e.step };
  },
});
