/**
 * Donjons (README 23, guide 9) : la porte d'une étape devient une partie de donjon ; chaque salle est un combat ;
 * le butin va dans le coffre du donjon (conteneur DUNGEON_CHEST, or dans `chest_gold`), livré en banque à la sortie
 * et perdu en cas de défaite. Les PV persistent de salle en salle, sans soin automatique ; les consommables du sac
 * restent utilisables entre deux salles.
 *
 * Seul, ou à deux (README 23.2 et 23.3) : l'ouvreur invite un ami de la même région, ou jusqu'à 20 joueurs disponibles
 * de la région au hasard ; le premier qui accepte rejoint avec son escouade dans l'état où elle est. À deux, chacun
 * vote « salle suivante » et le combat se lance au second vote, les deux escouades dans le même camp (16 emplacements,
 * 22 de population, l'ouvreur d'abord) ; chacun garde ses troupes, ses morts et son butin. Qui sort part avec son coffre ;
 * l'autre continue seul, les salles suivantes redeviennent dimensionnées pour une escouade.
 *
 * Concurrence (guide 9.2) : toute commande de donjon verrouille les joueurs de la partie par id croissant (coLock),
 * puis la partie. `lock_version` change à chaque changement de structure (salle jouée, arrivée, départ), pas à un vote :
 * une action envoyée sur un état périmé est refusée (DUNGEON_STALE).
 */
import { gzipSync } from 'node:zlib';
import { z } from 'zod';
import { GameError } from '@cr/shared';
import { simuler } from '@cr/engine';
import { hash } from '@cr/rng';
import { battleUnits, dungeonById, dungeonOfRoute, dungeonParams, genMonsters, room as roomOf, rollRoomLoot } from '@cr/gen';
import type { Database, Db, DungeonMember, DungeonRun, Player, Transaction } from '@cr/db';
import { command } from '../command.ts';
import type { CommandContext } from '../command.ts';
import { ONLINE_MS } from '../social/chat.ts';
import { blockedBetween, playerByPseudo, Pseudo } from '../social/direct.ts';
import { pair } from '../social/friends.ts';
import { settleSquad, unitIds } from './battle.ts';
import type { BattleRewards } from './battle.ts';
import { online } from './content.ts';
import type { GameContent } from './content.ts';
import { clearDoor, enterCity, freshSeed } from './expedition.ts';
import { transferGold } from './gold.ts';
import { addInstance, addStack, contents, emptyContainer } from './inventory.ts';
import type { Contents } from './inventory.ts';
import { notify } from './shop.ts';
import { asPlayerTroop, loadTroops } from './troops.ts';
import type { LoadedTroop } from './troops.ts';

type Tx = Transaction<Database>;

const emitMoved = (ctx: CommandContext, pid = ctx.player.id): void => ctx.emit({ topic: `user:${pid}`, type: 'player.moved' });
/** Prévient les membres d'une partie que son état a changé (leur page se recharge). */
const emitUpdate = (ctx: CommandContext, to: number[], text?: string): void => {
  for (const pid of to) ctx.emit({ topic: `user:${pid}`, type: 'dungeon.update', data: text ? { text } : {} });
};

/** Le même contexte, pour un autre joueur de la partie (verrouillé par coLock). */
const asOther = (ctx: CommandContext, player: Player): CommandContext => ({
  tx: ctx.tx,
  player,
  now: ctx.now,
  emit: ctx.emit,
  content: ctx.content,
  random: ctx.random,
  requireVerifiedEmail: ctx.requireVerifiedEmail,
});

/** Membres actifs de la partie active d'un joueur (lecture sans verrou, pour coLock). */
async function coMembers(tx: Tx, playerId: number): Promise<number[]> {
  const rows = await tx
    .selectFrom('dungeon_member as me')
    .innerJoin('dungeon_member as m', 'm.run_id', 'me.run_id')
    .select('m.player_id')
    .where('me.player_id', '=', playerId)
    .where('me.status', '=', 'active')
    .where('m.status', '=', 'active')
    .execute();
  return rows.map((r) => r.player_id);
}

interface Current {
  run: DungeonRun;
  me: DungeonMember;
  /** Membres actifs, l'ouvreur d'abord. */
  members: DungeonMember[];
}

/** Participation active du joueur et sa partie (verrouillée), avec les membres actifs. */
async function current(ctx: CommandContext): Promise<Current> {
  const me = await ctx.tx
    .selectFrom('dungeon_member')
    .selectAll()
    .where('player_id', '=', ctx.player.id)
    .where('status', '=', 'active')
    .executeTakeFirst();
  if (!me) throw new GameError('NOT_IN_DUNGEON');
  const run = await ctx.tx.selectFrom('dungeon_run').selectAll().where('id', '=', me.run_id).forUpdate().executeTakeFirstOrThrow();
  const members = await ctx.tx
    .selectFrom('dungeon_member')
    .selectAll()
    .where('run_id', '=', run.id)
    .where('status', '=', 'active')
    .forUpdate()
    .execute();
  members.sort((a, b) => (a.role === b.role ? a.player_id - b.player_id : a.role === 'opener' ? -1 : 1));
  return { run, me: members.find((m) => m.player_id === ctx.player.id)!, members };
}

/** Refuse une action envoyée sur un état périmé de la partie (guide 9.2). */
function checkVersion(run: DungeonRun, version: number | undefined): void {
  if (version !== undefined && version !== run.lock_version) throw new GameError('DUNGEON_STALE');
}

type RunPatch = Partial<{
  room: number;
  status: 'closed' | 'between_rooms' | 'lobby';
  mode: 'solo' | 'duo';
  votes: number[];
  invite: null | { kind: 'friend' | 'random'; to: number | null; invited: number[]; expires: Date };
}>;

/** Change la partie ; `bump` (par défaut) : changement de structure, la version avance. */
async function patchRun(tx: Tx, run: DungeonRun, now: Date, p: RunPatch, bump = true): Promise<void> {
  await tx
    .updateTable('dungeon_run')
    .set({
      ...(p.room !== undefined ? { room: p.room } : {}),
      ...(p.status ? { status: p.status, ...(p.status === 'closed' ? { closed_at: now } : {}) } : {}),
      ...(p.mode ? { mode: p.mode } : {}),
      ...(p.votes ? { votes: JSON.stringify(p.votes) } : {}),
      ...(p.invite !== undefined
        ? p.invite
          ? {
              invite_kind: p.invite.kind,
              invite_to: p.invite.to,
              invited: JSON.stringify(p.invite.invited),
              invite_expires_at: p.invite.expires,
            }
          : { invite_kind: null, invite_to: null, invited: '[]', invite_expires_at: null }
        : {}),
      lock_version: run.lock_version + (bump ? 1 : 0),
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
      .set({
        status: 'closed',
        closed_at: now,
        updated_at: now,
        invite_kind: null,
        invite_to: null,
        invited: '[]',
        invite_expires_at: null,
      })
      .set((eb) => ({ lock_version: eb('lock_version', '+', 1) }))
      .where('id', '=', runId)
      .where('status', '<>', 'closed')
      .execute();
}

// ---------------------------------------------------------------------------------------------------------
// Invitations

const InviteTarget = z.union([
  z.object({ mode: z.literal('solo') }),
  z.object({ mode: z.literal('friend'), pseudo: Pseudo }),
  z.object({ mode: z.literal('random') }),
]);

/** Un joueur peut-il rejoindre maintenant ? Même région, en ville ou sur une route, hors combat (README 23.2). */
function canJoin(p: Pick<Player, 'pos_kind' | 'pos_region' | 'watch_until'>, region: string, now: Date): boolean {
  return (p.pos_kind === 'city' || p.pos_kind === 'route') && p.pos_region === region && (!p.watch_until || p.watch_until <= now);
}

/** Envoie l'invitation d'une partie en attente (lobby) : à un ami de la région, ou au hasard (guide 9.1). */
async function sendInvite(ctx: CommandContext, run: DungeonRun, target: z.output<typeof InviteTarget>): Promise<{ invited: number }> {
  const P = dungeonParams(ctx.content.pack);
  const me = ctx.player;
  const name = dungeonById(ctx.content.pack, run.dungeon).name;
  let invited: number[];
  let to: number | null = null;
  if (target.mode === 'friend') {
    const f = await playerByPseudo(ctx.tx, target.pseudo);
    if (f.id === me.id) throw new GameError('SELF_TARGET');
    const { a, b } = pair(me.id, f.id);
    const friends = await ctx.tx
      .selectFrom('friendship')
      .select('status')
      .where('a_id', '=', a)
      .where('b_id', '=', b)
      .where('status', '=', 'accepted')
      .executeTakeFirst();
    if (!friends) throw new GameError('NOT_FRIENDS');
    if (await blockedBetween(ctx.tx, me.id, f.id)) throw new GameError('SOCIAL_REFUSED');
    const fp = await ctx.tx.selectFrom('player').selectAll().where('id', '=', f.id).executeTakeFirstOrThrow();
    if (!canJoin(fp, me.pos_region, ctx.now)) throw new GameError('INVITEE_UNAVAILABLE');
    invited = [f.id];
    to = f.id;
  } else if (target.mode === 'random') {
    // Joueurs de la région « disponibles pour un donjon », en ligne, hors combat et hors donjon ; 20 au plus, au hasard.
    const rows = await ctx.tx
      .selectFrom('player')
      .select('id')
      .where('pos_region', '=', me.pos_region)
      .where('pos_kind', 'in', ['city', 'route'])
      .where('dungeon_available', '=', true)
      .where('id', '<>', me.id)
      .where('last_seen_at', '>', new Date(ctx.now.getTime() - ONLINE_MS))
      .where((eb) => eb.or([eb('watch_until', 'is', null), eb('watch_until', '<=', ctx.now)]))
      .where((eb) =>
        eb.not(
          eb.exists(
            eb
              .selectFrom('block')
              .select('blocker_id')
              .where((x) =>
                x.or([
                  x.and([x('block.blocker_id', '=', me.id), x('block.blocked_id', '=', x.ref('player.id'))]),
                  x.and([x('block.blocked_id', '=', me.id), x('block.blocker_id', '=', x.ref('player.id'))]),
                ]),
              ),
          ),
        ),
      )
      .orderBy('id')
      .execute();
    const pool = rows.map((r) => r.id);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = ctx.random(i + 1);
      [pool[i], pool[j]] = [pool[j]!, pool[i]!];
    }
    invited = pool.slice(0, P.randomInvites);
    if (!invited.length) throw new GameError('NO_PLAYER_AVAILABLE');
  } else throw new GameError('INVALID_INPUT');
  const expires = new Date(ctx.now.getTime() + P.inviteSeconds * 1000);
  await patchRun(ctx.tx, run, ctx.now, { invite: { kind: target.mode, to, invited, expires } });
  for (const pid of invited) {
    if (target.mode === 'friend') await notify(ctx.tx, pid, 'dungeon.invite', { run: run.id, from: me.pseudo, dungeon: run.dungeon });
    ctx.emit({
      topic: `user:${pid}`,
      type: 'dungeon.invite',
      data: {
        run: run.id,
        from: me.pseudo,
        name,
        expires: expires.toISOString(),
        text: `${me.pseudo} vous invite dans le donjon ${name}.`,
      },
    });
  }
  return { invited: invited.length };
}

export const openDungeon = command({
  name: 'dungeon.open',
  input: InviteTarget,
  rate: { perMinute: 20 },
  where: ['route'],
  async run(ctx, input) {
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
    const solo = input.mode === 'solo';
    const row = await ctx.tx
      .insertInto('dungeon_run')
      .values({
        dungeon: door.dungeon,
        route: door.route,
        step: door.step,
        opener_id: pid,
        mode: 'solo',
        status: solo ? 'between_rooms' : 'lobby',
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    await ctx.tx
      .insertInto('dungeon_member')
      .values({ run_id: row.id, player_id: pid, role: 'opener', back_kind: 'route', status: 'active', last_active_at: ctx.now })
      .execute();
    await ctx.tx.updateTable('dungeon_door').set({ status: 'opened' }).where('id', '=', door.id).execute();
    await ctx.tx
      .updateTable('player')
      .set({ pos_kind: 'dungeon', pos_dungeon_run: row.id, lock_version: ctx.player.lock_version + 1, updated_at: ctx.now })
      .where('id', '=', pid)
      .execute();
    if (!solo) {
      const run = await ctx.tx.selectFrom('dungeon_run').selectAll().where('id', '=', row.id).forUpdate().executeTakeFirstOrThrow();
      await sendInvite(ctx, run, input);
    }
    emitMoved(ctx);
    return { run: row.id };
  },
});

/** Nouvelle invitation depuis l'attente (la précédente a été refusée ou a expiré). */
export const inviteDungeon = command({
  name: 'dungeon.invite',
  input: z.union([z.object({ mode: z.literal('friend'), pseudo: Pseudo }), z.object({ mode: z.literal('random') })]),
  rate: { perMinute: 10 },
  where: ['dungeon'],
  async run(ctx, input) {
    const { run, me } = await current(ctx);
    if (run.status !== 'lobby' || me.role !== 'opener') throw new GameError('DUNGEON_STALE');
    if (run.invite_expires_at && run.invite_expires_at > ctx.now) throw new GameError('INVITE_PENDING');
    return sendInvite(ctx, run, input);
  },
});

/** Sans partenaire : l'ouvreur continue seul. */
export const goSolo = command({
  name: 'dungeon.solo',
  input: z.object({}),
  rate: { perMinute: 20 },
  where: ['dungeon'],
  async run(ctx) {
    const { run, me } = await current(ctx);
    if (run.status !== 'lobby' || me.role !== 'opener') throw new GameError('DUNGEON_STALE');
    await patchRun(ctx.tx, run, ctx.now, { status: 'between_rooms', mode: 'solo', invite: null });
    return {};
  },
});

/** Le premier qui accepte rejoint (guide 9.1) ; les autres voient « déjà pris ». */
export const acceptInvite = command({
  name: 'dungeon.accept',
  input: z.object({ run: z.number().int().positive() }),
  rate: { perMinute: 20 },
  where: ['city', 'route'],
  coLock: async (tx, _pid, input) => {
    const r = await tx.selectFrom('dungeon_run').select('opener_id').where('id', '=', input.run).executeTakeFirst();
    return r ? [r.opener_id] : [];
  },
  async run(ctx, input) {
    const pid = ctx.player.id;
    const run = await ctx.tx.selectFrom('dungeon_run').selectAll().where('id', '=', input.run).forUpdate().executeTakeFirst();
    if (!run || !run.invited.includes(pid)) throw new GameError('INVITE_NOT_FOUND');
    if (run.status !== 'lobby') throw new GameError(run.status === 'closed' ? 'INVITE_EXPIRED' : 'INVITE_TAKEN');
    if (!run.invite_expires_at || run.invite_expires_at <= ctx.now) throw new GameError('INVITE_EXPIRED');
    const opener = await ctx.tx.selectFrom('player').selectAll().where('id', '=', run.opener_id).executeTakeFirstOrThrow();
    if (!canJoin(ctx.player, opener.pos_region, ctx.now)) throw new GameError('INVITEE_UNAVAILABLE');
    const squad = await loadTroops(ctx.tx, pid, ['SQUAD']);
    if (!squad.some((t) => t.units.length)) throw new GameError('SQUAD_EMPTY');
    await ctx.tx
      .insertInto('dungeon_member')
      .values({
        run_id: run.id,
        player_id: pid,
        role: 'guest',
        back_kind: ctx.player.pos_kind === 'route' ? 'route' : 'city',
        status: 'active',
        last_active_at: ctx.now,
      })
      .execute();
    await ctx.tx
      .updateTable('player')
      .set({ pos_kind: 'dungeon', pos_dungeon_run: run.id, lock_version: ctx.player.lock_version + 1, updated_at: ctx.now })
      .where('id', '=', pid)
      .execute();
    await patchRun(ctx.tx, run, ctx.now, { status: 'between_rooms', mode: 'duo', invite: null, votes: [] });
    // Les autres joueurs sollicités restent connus de la partie : ils verront « déjà pris ».
    await ctx.tx
      .updateTable('dungeon_run')
      .set({ invited: JSON.stringify(run.invited) })
      .where('id', '=', run.id)
      .execute();
    emitMoved(ctx);
    emitUpdate(ctx, [run.opener_id], `${ctx.player.pseudo} vous rejoint dans le donjon.`);
    return { run: run.id };
  },
});

export const declineInvite = command({
  name: 'dungeon.decline',
  input: z.object({ run: z.number().int().positive() }),
  rate: { perMinute: 20 },
  allowedDuringWatch: true,
  async run(ctx, input) {
    const pid = ctx.player.id;
    const run = await ctx.tx.selectFrom('dungeon_run').selectAll().where('id', '=', input.run).forUpdate().executeTakeFirst();
    if (!run || run.status !== 'lobby' || !run.invited.includes(pid)) throw new GameError('INVITE_NOT_FOUND');
    const invited = run.invited.filter((x) => x !== pid);
    // Un ami refuse, ou le dernier joueur sollicité : l'ouvreur choisit de continuer seul ou d'inviter quelqu'un d'autre.
    if (run.invite_kind === 'friend' || !invited.length) {
      await patchRun(ctx.tx, run, ctx.now, { invite: null });
      await notify(ctx.tx, run.opener_id, 'dungeon.declined', { run: run.id, from: ctx.player.pseudo });
      emitUpdate(ctx, [run.opener_id], `${ctx.player.pseudo} a décliné l’invitation.`);
    } else
      await patchRun(
        ctx.tx,
        run,
        ctx.now,
        { invite: { kind: run.invite_kind!, to: run.invite_to, invited, expires: run.invite_expires_at! } },
        false,
      );
    return {};
  },
});

// ---------------------------------------------------------------------------------------------------------
// Salles

export interface RoomRewards extends BattleRewards {
  room: number;
}

/** Sortie d'un membre avec son coffre : banque, or au grand livre, retour là où il était. */
async function leaveMember(tx: Tx, run: DungeonRun, m: DungeonMember, p: Player, now: Date, reason: string): Promise<void> {
  await emptyContainer(tx, p.id, 'DUNGEON_CHEST', 'BANK', reason);
  if (m.chest_gold > 0) await transferGold(tx, { system: 'SOURCE_DUNGEON' }, { player: p.id }, m.chest_gold, `donjon ${run.dungeon}`);
  await tx
    .updateTable('dungeon_member')
    .set({ status: 'left', left_at: now })
    .where('run_id', '=', run.id)
    .where('player_id', '=', p.id)
    .execute();
  await tx
    .updateTable('player')
    .set({ pos_kind: m.back_kind, pos_dungeon_run: null, lock_version: p.lock_version + 1, updated_at: now })
    .where('id', '=', p.id)
    .execute();
}

/** Défaite d'un membre : coffre perdu, retour dans la ville de sa région, troupes soignées (README 23.6). */
async function defeatMember(ctx: CommandContext, run: DungeonRun): Promise<void> {
  await emptyContainer(ctx.tx, ctx.player.id, 'DUNGEON_CHEST', 'SYSTEM', 'défaite en donjon');
  await ctx.tx
    .updateTable('dungeon_member')
    .set({ status: 'defeated', chest_gold: 0, left_at: ctx.now })
    .where('run_id', '=', run.id)
    .where('player_id', '=', ctx.player.id)
    .execute();
  await enterCity(ctx, ctx.player.pos_region, 'défaite en donjon');
}

/** Joue la salle suivante pour les membres actifs (un ou deux), dans un seul combat. */
async function playRoom(
  ctx: CommandContext,
  cur: Current,
): Promise<{ battle: number; won: boolean; watchMs: number; rewards: RoomRewards }> {
  const c = ctx.content;
  const o = online(c);
  const { run } = cur;
  const d = dungeonById(c.pack, run.dungeon);
  const n = run.room + 1;
  const duo = cur.members.length > 1;
  const rm = roomOf(c.pack, d, n, duo);
  // Les escouades, l'ouvreur d'abord (README 23.3).
  const parts: { m: DungeonMember; ctx: CommandContext; squad: LoadedTroop[] }[] = [];
  for (const m of cur.members) {
    const p =
      m.player_id === ctx.player.id
        ? ctx.player
        : await ctx.tx.selectFrom('player').selectAll().where('id', '=', m.player_id).executeTakeFirstOrThrow();
    const squad = (await loadTroops(ctx.tx, m.player_id, ['SQUAD'])).filter((t) => t.units.length);
    if (!squad.length) {
      if (m.player_id === ctx.player.id) throw new GameError('SQUAD_EMPTY');
      continue;
    }
    parts.push({ m, ctx: m.player_id === ctx.player.id ? ctx : asOther(ctx, p), squad });
  }
  // Unités de chaque joueur dans le camp, dans l'ordre (avant les morts du combat).
  const owners = parts.map((x) => ({ player: x.m.player_id, units: x.squad.reduce((a, t) => a + t.units.length, 0) }));
  const side = genMonsters(c.pack, rm.spec, freshSeed(ctx));
  const units = battleUnits(
    c.pack,
    parts.flatMap((x) => x.squad.map(asPlayerTroop)),
    side,
    rm.options,
  );
  const seed = freshSeed(ctx);
  const { log, result } = simuler({ engineVersion: o.engineVersion, params: c.pack.params, skills: c.pack.skills, units }, seed);
  const won = result.winner === 0;
  const watchMs = Math.ceil((result.time * 1000) / o.watch.instantsPerSecond);
  const outcomes: { part: (typeof parts)[number]; r: RoomRewards }[] = [];
  let first = 0;
  for (const [i, part] of parts.entries()) {
    const r: RoomRewards = { won, gold: 0, xp: 0, xpBy: [], levelUps: [], deaths: [], loot: [], left: [], retreat: false, room: n };
    Object.assign(
      r,
      await settleSquad(
        ctx.tx,
        c,
        ctx.now,
        part.squad,
        unitIds(part.squad, first),
        result.units,
        won,
        side,
        await loadTroops(ctx.tx, part.m.player_id, ['RESERVE']),
      ),
    );
    first += owners[i]!.units;
    if (won) {
      // Chacun tire son butin, avec sa propre graine (README 23.3), dans son coffre ; l'or attend la sortie.
      const pid = part.m.player_id;
      const loot = rollRoomLoot(c.pack, d, n, duo ? hash(seed, pid) : seed);
      r.gold = loot.gold;
      await ctx.tx
        .updateTable('dungeon_member')
        .set({ chest_gold: part.m.chest_gold + loot.gold, last_active_at: ctx.now })
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
    }
    r.retreat = !won || !part.squad.some((t) => t.units.length);
    await ctx.tx
      .updateTable('player')
      .set((eb) => ({
        stat_fights: eb('stat_fights', '+', 1),
        stat_wins: eb('stat_wins', '+', won ? 1 : 0),
        stat_deaths: eb('stat_deaths', '+', r.deaths.length),
        watch_until: new Date(ctx.now.getTime() + watchMs),
        updated_at: ctx.now,
      }))
      .where('id', '=', part.m.player_id)
      .execute();
    outcomes.push({ part, r });
  }
  await patchRun(ctx.tx, run, ctx.now, { ...(won ? { room: n } : {}), votes: [] });
  const battle = await ctx.tx
    .insertInto('battle')
    .values({
      player_id: run.opener_id,
      kind: 'dungeon',
      route: run.route,
      step: run.step,
      encounter_id: null,
      seed,
      engine_version: o.engineVersion,
      content_version: c.hash,
      input: JSON.stringify({
        units,
        dungeon: { run: run.id, id: d.id, room: n, owners },
      }),
      result: JSON.stringify(result),
      log: gzipSync(JSON.stringify(log)),
      duration: result.time,
      won,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  for (const { part, r } of outcomes)
    await ctx.tx
      .insertInto('battle_participant')
      .values({ battle_id: battle.id, player_id: part.m.player_id, rewards: JSON.stringify(r) })
      .execute();
  // Défaite : chacun perd son coffre et rentre ; victoire sans plus personne dans une escouade : son joueur sort
  // avec son coffre (il a gagné la salle) [H].
  for (const { part, r } of outcomes) {
    if (!won) await defeatMember(part.ctx, run);
    else if (r.retreat) {
      const p = await ctx.tx.selectFrom('player').selectAll().where('id', '=', part.m.player_id).executeTakeFirstOrThrow();
      await leaveMember(
        ctx.tx,
        run,
        { ...part.m, chest_gold: part.m.chest_gold + r.gold },
        p,
        ctx.now,
        'sortie du donjon (escouade décimée)',
      );
      emitMoved(ctx, p.id);
    }
    ctx.emit({ topic: `user:${part.m.player_id}`, type: 'battle.done', data: { battle: battle.id } });
    ctx.emit({ topic: `user:${part.m.player_id}`, type: 'dungeon.fight', data: { battle: battle.id } });
  }
  await closeIfEmpty(ctx.tx, run.id, ctx.now);
  const mine = outcomes.find((x) => x.part.m.player_id === ctx.player.id)!;
  return { battle: battle.id, won, watchMs, rewards: mine.r };
}

/**
 * Salle suivante : seul, le combat se lance ; à deux, c'est un vote, et le combat se lance au second (guide 9.2).
 * Rend `battle` quand un combat a eu lieu, sinon `waiting`.
 */
export const fightRoom = command({
  name: 'dungeon.fight',
  input: z.object({ version: z.number().int().optional() }),
  rate: { perMinute: 20 },
  where: ['dungeon'],
  coLock: (tx, pid) => coMembers(tx, pid),
  async run(ctx, input): Promise<{ battle: number; won: boolean; watchMs: number; rewards: RoomRewards } | { waiting: true }> {
    const cur = await current(ctx);
    checkVersion(cur.run, input.version);
    if (cur.run.status !== 'between_rooms') throw new GameError('DUNGEON_STALE');
    await ctx.tx
      .updateTable('dungeon_member')
      .set({ last_active_at: ctx.now })
      .where('run_id', '=', cur.run.id)
      .where('player_id', '=', ctx.player.id)
      .execute();
    if (cur.members.length > 1) {
      const votes = [...new Set([...cur.run.votes, ctx.player.id])].filter((v) => cur.members.some((m) => m.player_id === v));
      if (votes.length < cur.members.length) {
        // Tous les membres doivent être prêts : pas de combat pendant la rediffusion de l'autre.
        await patchRun(ctx.tx, cur.run, ctx.now, { votes }, false);
        emitUpdate(
          ctx,
          cur.members.filter((m) => m.player_id !== ctx.player.id).map((m) => m.player_id),
          `${ctx.player.pseudo} est prêt pour la salle ${cur.run.room + 1}.`,
        );
        return { waiting: true as const };
      }
      for (const m of cur.members) {
        if (m.player_id === ctx.player.id) continue;
        const p = await ctx.tx.selectFrom('player').select('watch_until').where('id', '=', m.player_id).executeTakeFirstOrThrow();
        if (p.watch_until && p.watch_until > ctx.now)
          throw new GameError('WATCH_IN_PROGRESS', { secondes: Math.ceil((p.watch_until.getTime() - ctx.now.getTime()) / 1000) });
      }
    }
    return playRoom(ctx, cur);
  },
});

export const leaveDungeon = command({
  name: 'dungeon.leave',
  input: z.object({ version: z.number().int().optional() }),
  rate: { perMinute: 20 },
  where: ['dungeon'],
  coLock: (tx, pid) => coMembers(tx, pid),
  async run(ctx, input) {
    const { run, me, members } = await current(ctx);
    checkVersion(run, input.version);
    await leaveMember(ctx.tx, run, me, ctx.player, ctx.now, 'sortie du donjon');
    const others = members.filter((m) => m.player_id !== ctx.player.id).map((m) => m.player_id);
    // L'autre continue seul ; une invitation en attente est annulée avec la partie.
    await patchRun(ctx.tx, run, ctx.now, { votes: [], ...(run.status === 'lobby' ? { invite: null } : {}) });
    await closeIfEmpty(ctx.tx, run.id, ctx.now);
    for (const pid of others) await notify(ctx.tx, pid, 'dungeon.partner_left', { run: run.id, from: ctx.player.pseudo });
    emitUpdate(ctx, others, `${ctx.player.pseudo} a quitté le donjon : vous continuez seul.`);
    emitMoved(ctx);
    return { gold: me.chest_gold, room: run.room };
  },
});

/** Outil de test (préproduction, ENABLE_TEST_TOOLS) : fait apparaître la porte du donjon de la route sur l'étape. */
export const spawnTestDoor = command({
  name: 'dev.spawnDoor',
  input: z.object({}),
  rate: { perMinute: 10 },
  where: ['route'],
  async run(ctx) {
    const route = ctx.player.pos_route!;
    const d = dungeonOfRoute(ctx.content.pack, route);
    if (!d) throw new GameError('NO_DUNGEON_HERE');
    await clearDoor(ctx);
    await ctx.tx
      .insertInto('dungeon_door')
      .values({ player_id: ctx.player.id, dungeon: d.id, route, step: ctx.player.pos_step!, status: 'visible' })
      .execute();
    return { dungeon: d.id };
  },
});

// ---------------------------------------------------------------------------------------------------------
// Tâche du worker : invitations expirées, absences en duo (guide 9.1, README 26)

export interface SweepResult {
  expired: number;
  idle: number;
}

/**
 * Passe sur les donjons ouverts : une invitation expirée est effacée (l'ouvreur choisit de continuer seul ou d'inviter
 * à nouveau) ; en duo, un membre absent depuis plus de `idleMinutes` sort avec son coffre et l'autre continue seul.
 * Chaque partie est traitée dans sa transaction, joueurs verrouillés par id croissant puis partie.
 */
export async function sweepDungeons(
  db: Db,
  opts: {
    now?: Date;
    idleMinutes?: number;
    publish?: (events: { topic: string; type: string; data?: Record<string, unknown> }[]) => void;
  } = {},
): Promise<SweepResult> {
  const now = opts.now ?? new Date();
  const idleMs = (opts.idleMinutes ?? 5) * 60_000;
  const out: SweepResult = { expired: 0, idle: 0 };
  const events: { topic: string; type: string; data?: Record<string, unknown> }[] = [];

  const expired = await db
    .selectFrom('dungeon_run')
    .select('id')
    .where('status', '=', 'lobby')
    .where('invite_expires_at', '<=', now)
    .execute();
  for (const { id } of expired)
    await db.transaction().execute(async (tx) => {
      const run = await tx.selectFrom('dungeon_run').selectAll().where('id', '=', id).executeTakeFirstOrThrow();
      await tx.selectFrom('player').select('id').where('id', '=', run.opener_id).forNoKeyUpdate().execute();
      const r = await tx
        .updateTable('dungeon_run')
        .set({
          invite_kind: null,
          invite_to: null,
          invited: '[]',
          invite_expires_at: null,
          lock_version: run.lock_version + 1,
          updated_at: now,
        })
        .where('id', '=', id)
        .where('status', '=', 'lobby')
        .where('invite_expires_at', '<=', now)
        .executeTakeFirst();
      if (!Number(r.numUpdatedRows)) return;
      out.expired++;
      await notify(tx, run.opener_id, 'dungeon.invite_expired', { run: id });
      events.push({ topic: `user:${run.opener_id}`, type: 'dungeon.update', data: { text: 'Personne n’a accepté l’invitation à temps.' } });
    });

  const idle = await db
    .selectFrom('dungeon_member')
    .innerJoin('player', 'player.id', 'dungeon_member.player_id')
    .innerJoin('dungeon_run', 'dungeon_run.id', 'dungeon_member.run_id')
    .select(['dungeon_member.run_id', 'dungeon_member.player_id'])
    .where('dungeon_member.status', '=', 'active')
    .where('dungeon_run.mode', '=', 'duo')
    .where('dungeon_run.status', '=', 'between_rooms')
    .where((eb) => eb.or([eb('player.last_seen_at', 'is', null), eb('player.last_seen_at', '<', new Date(now.getTime() - idleMs))]))
    .where('dungeon_member.last_active_at', '<', new Date(now.getTime() - idleMs))
    .execute();
  for (const { run_id, player_id } of idle)
    await db.transaction().execute(async (tx) => {
      const ids = (
        await tx.selectFrom('dungeon_member').select('player_id').where('run_id', '=', run_id).where('status', '=', 'active').execute()
      )
        .map((x) => x.player_id)
        .sort((a, b) => a - b);
      const players = new Map<number, Player>();
      for (const pid of ids)
        players.set(pid, await tx.selectFrom('player').selectAll().where('id', '=', pid).forNoKeyUpdate().executeTakeFirstOrThrow());
      const run = await tx.selectFrom('dungeon_run').selectAll().where('id', '=', run_id).forUpdate().executeTakeFirstOrThrow();
      const m = await tx
        .selectFrom('dungeon_member')
        .selectAll()
        .where('run_id', '=', run_id)
        .where('player_id', '=', player_id)
        .where('status', '=', 'active')
        .executeTakeFirst();
      const p = players.get(player_id);
      // Revérifié sous verrou : il est peut-être revenu, ou déjà sorti.
      if (!m || !p || run.status !== 'between_rooms' || ids.length < 2) return;
      if ((p.last_seen_at && p.last_seen_at.getTime() >= now.getTime() - idleMs) || m.last_active_at.getTime() >= now.getTime() - idleMs)
        return;
      await leaveMember(tx, run, m, p, now, 'absence en donjon');
      await tx
        .updateTable('dungeon_run')
        .set({ votes: '[]', lock_version: run.lock_version + 1, updated_at: now })
        .where('id', '=', run_id)
        .execute();
      out.idle++;
      for (const other of ids.filter((x) => x !== player_id)) {
        await notify(tx, other, 'dungeon.partner_left', { run: run_id, from: p.pseudo, idle: true });
        events.push({
          topic: `user:${other}`,
          type: 'dungeon.update',
          data: { text: `${p.pseudo} est absent : il sort du donjon, vous continuez seul.` },
        });
      }
      events.push({ topic: `user:${player_id}`, type: 'player.moved' });
    });
  if (events.length) opts.publish?.(events);
  return out;
}

// ---------------------------------------------------------------------------------------------------------
// Lecture pour les pages

export interface DungeonMemberView {
  id: number;
  pseudo: string;
  role: 'opener' | 'guest';
  ready: boolean;
}

export interface DungeonView {
  run: number;
  dungeon: string;
  name: string;
  status: 'lobby' | 'between_rooms';
  /** Membres actifs, l'ouvreur d'abord. */
  members: DungeonMemberView[];
  me: { role: 'opener' | 'guest'; ready: boolean };
  /** Dernière salle gagnée. */
  room: number;
  version: number;
  next: { n: number; level: number; pop: number; boss: string | null };
  invite: null | { kind: 'friend' | 'random'; to: string | null; count: number; expiresAt: Date };
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
export async function dungeonView(db: Db, c: GameContent, playerId: number, now = new Date()): Promise<DungeonView | null> {
  return db.transaction().execute(async (tx) => {
    const me = await tx
      .selectFrom('dungeon_member')
      .selectAll()
      .where('player_id', '=', playerId)
      .where('status', '=', 'active')
      .executeTakeFirst();
    if (!me) return null;
    const run = await tx.selectFrom('dungeon_run').selectAll().where('id', '=', me.run_id).executeTakeFirstOrThrow();
    if (run.status === 'closed') return null;
    const members = await tx
      .selectFrom('dungeon_member')
      .innerJoin('player', 'player.id', 'dungeon_member.player_id')
      .select(['player.id', 'player.pseudo', 'dungeon_member.role'])
      .where('dungeon_member.run_id', '=', run.id)
      .where('dungeon_member.status', '=', 'active')
      .execute();
    members.sort((a, b) => (a.role === b.role ? a.id - b.id : a.role === 'opener' ? -1 : 1));
    const d = dungeonById(c.pack, run.dungeon);
    const next = roomOf(c.pack, d, run.room + 1, members.length > 1);
    const to = run.invite_to
      ? await tx.selectFrom('player').select('pseudo').where('id', '=', run.invite_to).executeTakeFirst()
      : undefined;
    const pending = run.invite_kind && run.invite_expires_at && run.invite_expires_at > now;
    return {
      run: run.id,
      dungeon: d.id,
      name: d.name,
      status: run.status,
      members: members.map((m) => ({ id: m.id, pseudo: m.pseudo, role: m.role, ready: run.votes.includes(m.id) })),
      me: { role: me.role, ready: run.votes.includes(playerId) },
      room: run.room,
      version: run.lock_version,
      next: { n: next.n, level: next.level, pop: next.pop, boss: next.boss },
      invite: pending
        ? { kind: run.invite_kind!, to: to?.pseudo ?? null, count: run.invited.length, expiresAt: run.invite_expires_at! }
        : null,
      chest: await contents(tx, playerId, 'DUNGEON_CHEST'),
      chestGold: me.chest_gold,
    };
  });
}

/** Invitations en cours adressées au joueur (page d'invitation). */
export async function invitationsFor(db: Db, c: GameContent, playerId: number, now = new Date()) {
  const rows = await db
    .selectFrom('dungeon_run')
    .innerJoin('player', 'player.id', 'dungeon_run.opener_id')
    .select(['dungeon_run.id', 'dungeon_run.dungeon', 'dungeon_run.invited', 'dungeon_run.invite_expires_at', 'player.pseudo'])
    .where('dungeon_run.status', '=', 'lobby')
    .where('dungeon_run.invite_expires_at', '>', now)
    .execute();
  return rows
    .filter((r) => r.invited.includes(playerId))
    .map((r) => ({
      run: r.id,
      from: r.pseudo,
      dungeon: r.dungeon,
      name: dungeonById(c.pack, r.dungeon).name,
      expiresAt: r.invite_expires_at!,
    }));
}
