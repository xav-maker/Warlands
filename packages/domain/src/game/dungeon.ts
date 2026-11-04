/**
 * Donjons (README 23, guide 9) : la porte d'une étape devient une partie de donjon ; chaque salle est un combat ;
 * le butin va dans le coffre du donjon (conteneur DUNGEON_CHEST, or dans `chest_gold`), livré en banque à la sortie
 * et perdu en cas de défaite. Les PV persistent de salle en salle, sans soin automatique ; les consommables du sac
 * restent utilisables entre deux salles.
 *
 * Incrément solo : ouvrir seul, combattre la salle suivante, quitter. Le duo (invitations, votes) s'appuie sur les
 * mêmes tables : un membre par joueur, au plus une participation active (contrainte de la base).
 */
import { gzipSync } from 'node:zlib';
import { z } from 'zod';
import { GameError } from '@cr/shared';
import { simuler } from '@cr/engine';
import { battleUnits, dungeonById, genMonsters, room as roomOf, rollRoomLoot } from '@cr/gen';
import type { Database, Db, DungeonMember, DungeonRun, Transaction } from '@cr/db';
import { command } from '../command.ts';
import type { CommandContext } from '../command.ts';
import { settleSquad, unitIds } from './battle.ts';
import type { BattleRewards } from './battle.ts';
import { online } from './content.ts';
import type { GameContent } from './content.ts';
import { enterCity, freshSeed } from './expedition.ts';
import { transferGold } from './gold.ts';
import { addInstance, addStack, contents, emptyContainer } from './inventory.ts';
import type { Contents } from './inventory.ts';
import { asPlayerTroop, loadTroops } from './troops.ts';

type Tx = Transaction<Database>;

const emitMoved = (ctx: CommandContext): void => ctx.emit({ topic: `user:${ctx.player.id}`, type: 'player.moved' });

/** Participation active du joueur et sa partie, verrouillées. */
async function current(ctx: CommandContext): Promise<{ run: DungeonRun; member: DungeonMember }> {
  const member = await ctx.tx
    .selectFrom('dungeon_member')
    .selectAll()
    .where('player_id', '=', ctx.player.id)
    .where('status', '=', 'active')
    .forUpdate()
    .executeTakeFirst();
  if (!member) throw new GameError('NOT_IN_DUNGEON');
  const run = await ctx.tx.selectFrom('dungeon_run').selectAll().where('id', '=', member.run_id).forUpdate().executeTakeFirstOrThrow();
  return { run, member };
}

/** Refuse une action envoyée sur un état périmé de la partie (guide 9.2). */
function checkVersion(run: DungeonRun, version: number | undefined): void {
  if (version !== undefined && version !== run.lock_version) throw new GameError('DUNGEON_STALE');
}

async function touchRun(tx: Tx, run: DungeonRun, now: Date, set: Partial<{ room: number; status: 'closed' | 'between_rooms' }> = {}) {
  await tx
    .updateTable('dungeon_run')
    .set({
      ...set,
      ...(set.status === 'closed' ? { closed_at: now } : {}),
      lock_version: run.lock_version + 1,
      updated_at: now,
    })
    .where('id', '=', run.id)
    .execute();
}

/** Ferme la partie s'il n'y reste aucun membre actif. */
async function closeIfEmpty(tx: Tx, runId: number, now: Date): Promise<void> {
  const left = await tx
    .selectFrom('dungeon_member')
    .select('player_id')
    .where('run_id', '=', runId)
    .where('status', '=', 'active')
    .executeTakeFirst();
  if (!left)
    await tx
      .updateTable('dungeon_run')
      .set({ status: 'closed', closed_at: now, updated_at: now, lock_version: (eb) => eb('lock_version', '+', 1) })
      .where('id', '=', runId)
      .where('status', '<>', 'closed')
      .execute();
}

export const openDungeon = command({
  name: 'dungeon.open',
  input: z.object({ mode: z.literal('solo') }),
  rate: { perMinute: 20 },
  where: ['route'],
  async run(ctx) {
    const pid = ctx.player.id;
    const door = await ctx.tx
      .selectFrom('dungeon_door')
      .selectAll()
      .where('player_id', '=', pid)
      .where('status', '=', 'visible')
      .forUpdate()
      .executeTakeFirst();
    if (!door || door.route !== ctx.player.pos_route || door.step !== ctx.player.pos_step) throw new GameError('DOOR_NOT_FOUND');
    const squad = await loadTroops(ctx.tx, pid, ['SQUAD']);
    if (!squad.some((t) => t.units.length)) throw new GameError('SQUAD_EMPTY');
    const run = await ctx.tx
      .insertInto('dungeon_run')
      .values({ dungeon: door.dungeon, route: door.route, step: door.step, opener_id: pid, mode: 'solo', status: 'between_rooms' })
      .returning('id')
      .executeTakeFirstOrThrow();
    await ctx.tx
      .insertInto('dungeon_member')
      .values({ run_id: run.id, player_id: pid, role: 'opener', back_kind: 'route', status: 'active', last_active_at: ctx.now })
      .execute();
    await ctx.tx.updateTable('dungeon_door').set({ status: 'opened' }).where('id', '=', door.id).execute();
    await ctx.tx
      .updateTable('player')
      .set({ pos_kind: 'dungeon', pos_dungeon_run: run.id, lock_version: ctx.player.lock_version + 1, updated_at: ctx.now })
      .where('id', '=', pid)
      .execute();
    emitMoved(ctx);
    return { run: run.id };
  },
});

/** Défaite d'un membre : coffre perdu, retour dans la ville de sa région, troupes soignées (README 23.6). */
async function defeat(ctx: CommandContext, run: DungeonRun): Promise<void> {
  await emptyContainer(ctx.tx, ctx.player.id, 'DUNGEON_CHEST', 'SYSTEM', 'défaite en donjon');
  await ctx.tx
    .updateTable('dungeon_member')
    .set({ status: 'defeated', chest_gold: 0, left_at: ctx.now })
    .where('run_id', '=', run.id)
    .where('player_id', '=', ctx.player.id)
    .execute();
  await closeIfEmpty(ctx.tx, run.id, ctx.now);
  await enterCity(ctx, ctx.player.pos_region, 'défaite en donjon');
}

export interface RoomRewards extends BattleRewards {
  room: number;
}

export const fightRoom = command({
  name: 'dungeon.fight',
  input: z.object({ version: z.number().int().optional() }),
  rate: { perMinute: 20 },
  where: ['dungeon'],
  async run(ctx, input) {
    const c = ctx.content;
    const o = online(c);
    const pid = ctx.player.id;
    const { run, member } = await current(ctx);
    checkVersion(run, input.version);
    if (run.status !== 'between_rooms') throw new GameError('DUNGEON_STALE');
    const d = dungeonById(c.pack, run.dungeon);
    const n = run.room + 1;
    const rm = roomOf(c.pack, d, n, false);
    const squad = (await loadTroops(ctx.tx, pid, ['SQUAD'])).filter((t) => t.units.length);
    if (!squad.length) throw new GameError('SQUAD_EMPTY');

    // Groupe de la salle et combat, tirés maintenant (graines fraîches, guide 8.1).
    const side = genMonsters(c.pack, rm.spec, freshSeed(ctx));
    const units = battleUnits(c.pack, squad.map(asPlayerTroop), side, rm.options);
    const seed = freshSeed(ctx);
    const { log, result } = simuler({ engineVersion: o.engineVersion, params: c.pack.params, skills: c.pack.skills, units }, seed);
    const won = result.winner === 0;
    const r: RoomRewards = { won, gold: 0, xp: 0, xpBy: [], levelUps: [], deaths: [], loot: [], left: [], retreat: false, room: n };
    Object.assign(r, await settleSquad(ctx.tx, c, ctx.now, squad, unitIds(squad, 0), result.units, won, side));

    if (won) {
      // Butin de la salle : dans le coffre du donjon, à part du sac ; l'or attend la sortie.
      const loot = rollRoomLoot(c.pack, d, n, seed);
      r.gold = loot.gold;
      await ctx.tx
        .updateTable('dungeon_member')
        .set({ chest_gold: member.chest_gold + loot.gold, last_active_at: ctx.now })
        .where('run_id', '=', run.id)
        .where('player_id', '=', pid)
        .execute();
      for (const it of loot.items) {
        if ('id' in it) {
          await addStack(ctx.tx, c, pid, 'DUNGEON_CHEST', it.id, it.qty, 'SYSTEM', `donjon ${d.id}, salle ${n}`);
          r.loot.push({ item: it.id, qty: it.qty });
        } else {
          await addInstance(ctx.tx, c, pid, 'DUNGEON_CHEST', it.equip, 'dungeon', `donjon ${d.id}, salle ${n}`);
          r.loot.push({ base: it.equip.base, roll: it.equip.roll });
        }
      }
      await touchRun(ctx.tx, run, ctx.now, { room: n });
    } else await touchRun(ctx.tx, run, ctx.now);

    const watchMs = Math.ceil((result.time * 1000) / o.watch.instantsPerSecond);
    await ctx.tx
      .updateTable('player')
      .set((eb) => ({
        stat_fights: eb('stat_fights', '+', 1),
        stat_wins: eb('stat_wins', '+', won ? 1 : 0),
        stat_deaths: eb('stat_deaths', '+', r.deaths.length),
        watch_until: new Date(ctx.now.getTime() + watchMs),
        updated_at: ctx.now,
      }))
      .where('id', '=', pid)
      .execute();
    r.retreat = !won || !squad.some((t) => t.units.length);
    const battle = await ctx.tx
      .insertInto('battle')
      .values({
        player_id: pid,
        kind: 'dungeon',
        route: run.route,
        step: run.step,
        encounter_id: null,
        seed,
        engine_version: o.engineVersion,
        content_version: c.hash,
        input: JSON.stringify({ units, dungeon: { run: run.id, id: d.id, room: n } }),
        result: JSON.stringify(result),
        log: gzipSync(JSON.stringify(log)),
        duration: result.time,
        won,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    await ctx.tx
      .insertInto('battle_participant')
      .values({ battle_id: battle.id, player_id: pid, rewards: JSON.stringify(r) })
      .execute();
    if (r.retreat) await defeat(ctx, run);
    ctx.emit({ topic: `user:${pid}`, type: 'battle.done', data: { battle: battle.id } });
    return { battle: battle.id, won, watchMs, rewards: r };
  },
});

export const leaveDungeon = command({
  name: 'dungeon.leave',
  input: z.object({ version: z.number().int().optional() }),
  rate: { perMinute: 20 },
  where: ['dungeon'],
  async run(ctx, input) {
    const pid = ctx.player.id;
    const { run, member } = await current(ctx);
    checkVersion(run, input.version);
    // Le coffre est livré en banque, même pleine ; l'or gagné entre au grand livre maintenant.
    await emptyContainer(ctx.tx, pid, 'DUNGEON_CHEST', 'BANK', 'sortie du donjon');
    if (member.chest_gold > 0)
      await transferGold(ctx.tx, { system: 'SOURCE_DUNGEON' }, { player: pid }, member.chest_gold, `donjon ${run.dungeon}`);
    await ctx.tx
      .updateTable('dungeon_member')
      .set({ status: 'left', left_at: ctx.now })
      .where('run_id', '=', run.id)
      .where('player_id', '=', pid)
      .execute();
    await touchRun(ctx.tx, run, ctx.now);
    await closeIfEmpty(ctx.tx, run.id, ctx.now);
    // Retour là où il était : son étape de route (gardée dans player), ou sa ville.
    await ctx.tx
      .updateTable('player')
      .set({ pos_kind: member.back_kind, pos_dungeon_run: null, lock_version: ctx.player.lock_version + 1, updated_at: ctx.now })
      .where('id', '=', pid)
      .execute();
    emitMoved(ctx);
    return { gold: member.chest_gold, room: run.room };
  },
});

// ---------------------------------------------------------------------------------------------------------
// Lecture pour les pages

export interface DungeonView {
  run: number;
  dungeon: string;
  name: string;
  mode: 'solo' | 'duo';
  /** Dernière salle gagnée. */
  room: number;
  version: number;
  next: { n: number; level: number; pop: number; boss: string | null };
  chest: Contents;
  chestGold: number;
}

/** Porte visible sur l'étape du joueur, ou null. */
export async function doorView(db: Db, c: GameContent, playerId: number): Promise<{ dungeon: string; name: string } | null> {
  const p = await db
    .selectFrom('player')
    .select(['pos_kind', 'pos_route', 'pos_step'])
    .where('id', '=', playerId)
    .executeTakeFirstOrThrow();
  if (p.pos_kind !== 'route') return null;
  const door = await db
    .selectFrom('dungeon_door')
    .select(['dungeon', 'route', 'step'])
    .where('player_id', '=', playerId)
    .where('status', '=', 'visible')
    .executeTakeFirst();
  if (!door || door.route !== p.pos_route || door.step !== p.pos_step) return null;
  return { dungeon: door.dungeon, name: dungeonById(c.pack, door.dungeon).name };
}

/** Partie de donjon en cours du joueur, ou null. */
export async function dungeonView(db: Db, c: GameContent, playerId: number): Promise<DungeonView | null> {
  return db.transaction().execute(async (tx) => {
    const m = await tx
      .selectFrom('dungeon_member')
      .innerJoin('dungeon_run', 'dungeon_run.id', 'dungeon_member.run_id')
      .select([
        'dungeon_run.id',
        'dungeon_run.dungeon',
        'dungeon_run.mode',
        'dungeon_run.room',
        'dungeon_run.lock_version',
        'dungeon_member.chest_gold',
      ])
      .where('dungeon_member.player_id', '=', playerId)
      .where('dungeon_member.status', '=', 'active')
      .executeTakeFirst();
    if (!m) return null;
    const d = dungeonById(c.pack, m.dungeon);
    const next = roomOf(c.pack, d, m.room + 1, m.mode === 'duo');
    return {
      run: m.id,
      dungeon: d.id,
      name: d.name,
      mode: m.mode,
      room: m.room,
      version: m.lock_version,
      next: { n: next.n, level: next.level, pop: next.pop, boss: next.boss },
      chest: await contents(tx, playerId, 'DUNGEON_CHEST'),
      chestGold: m.chest_gold,
    };
  });
}
