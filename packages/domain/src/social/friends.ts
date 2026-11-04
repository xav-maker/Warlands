/**
 * Amis et blocages (README 25, guide 12). Une ligne `friendship` par couple (a < b) : `pending_a` = demande de a
 * en attente de b, `pending_b` l'inverse, `accepted`. Une demande croisée vaut acceptation. Bloquer retire
 * l'amitié, masque les messages de la personne bloquée et lui ferme les messages privés et les demandes.
 * Les amis voient mutuellement le statut en ligne (vu il y a moins de 2 minutes) et la région.
 */
import { z } from 'zod';
import { GameError } from '@cr/shared';
import type { Database, Db, FriendshipStatus, Transaction } from '@cr/db';
import { command } from '../command.ts';
import { assertEmailVerified } from './access.ts';
import { notify } from '../game/shop.ts';
import { ONLINE_MS } from './chat.ts';
import { blockedBetween, playerByPseudo, Pseudo } from './direct.ts';

type Tx = Transaction<Database>;

export const FRIEND_MAX = 100;
export const PENDING_MAX = 50;

export const pair = (x: number, y: number): { a: number; b: number } => (x < y ? { a: x, b: y } : { a: y, b: x });
const mineStatus = (me: number, other: number): FriendshipStatus => (me < other ? 'pending_a' : 'pending_b');

async function relation(tx: Tx, me: number, other: number) {
  const { a, b } = pair(me, other);
  return tx.selectFrom('friendship').select('status').where('a_id', '=', a).where('b_id', '=', b).forUpdate().executeTakeFirst();
}

async function countFriends(tx: Tx, id: number): Promise<number> {
  const r = await tx
    .selectFrom('friendship')
    .select((eb) => eb.fn.countAll<number>().as('n'))
    .where('status', '=', 'accepted')
    .where((eb) => eb.or([eb('a_id', '=', id), eb('b_id', '=', id)]))
    .executeTakeFirstOrThrow();
  return Number(r.n);
}

export const requestFriend = command({
  name: 'friend.request',
  input: z.object({ pseudo: Pseudo }),
  rate: { perMinute: 20 },
  allowedDuringWatch: true,
  async run(ctx, input) {
    await assertEmailVerified(ctx);
    const me = ctx.player.id;
    const other = await playerByPseudo(ctx.tx, input.pseudo);
    if (other.id === me) throw new GameError('SELF_TARGET');
    if (await blockedBetween(ctx.tx, me, other.id)) throw new GameError('SOCIAL_REFUSED');
    const { a, b } = pair(me, other.id);
    const cur = await relation(ctx.tx, me, other.id);
    if (cur?.status === 'accepted') throw new GameError('ALREADY_FRIENDS');
    if (cur?.status === mineStatus(me, other.id)) return { status: 'pending' as const }; // déjà demandée
    if ((await countFriends(ctx.tx, me)) >= FRIEND_MAX) throw new GameError('FRIEND_LIMIT', { max: FRIEND_MAX });
    if (cur) {
      // L'autre avait déjà demandé : la demande croisée vaut acceptation.
      await ctx.tx.updateTable('friendship').set({ status: 'accepted' }).where('a_id', '=', a).where('b_id', '=', b).execute();
      await notify(ctx.tx, other.id, 'friend.accepted', { from: ctx.player.pseudo, fromId: me });
      ctx.emit({ topic: `user:${other.id}`, type: 'friend.update', data: { from: ctx.player.pseudo } });
      return { status: 'accepted' as const };
    }
    const sent = await ctx.tx
      .selectFrom('friendship')
      .select((eb) => eb.fn.countAll<number>().as('n'))
      .where((eb) =>
        eb.or([
          eb.and([eb('a_id', '=', me), eb('status', '=', 'pending_a')]),
          eb.and([eb('b_id', '=', me), eb('status', '=', 'pending_b')]),
        ]),
      )
      .executeTakeFirstOrThrow();
    if (Number(sent.n) >= PENDING_MAX) throw new GameError('FRIEND_LIMIT', { max: PENDING_MAX });
    // Deux demandes croisées au même instant : la seconde trouve la ligne de la première et vaut acceptation.
    await ctx.tx
      .insertInto('friendship')
      .values({ a_id: a, b_id: b, status: mineStatus(me, other.id) })
      .onConflict((oc) =>
        oc.columns(['a_id', 'b_id']).doUpdateSet({ status: 'accepted' }).where('friendship.status', '<>', mineStatus(me, other.id)),
      )
      .execute();
    await notify(ctx.tx, other.id, 'friend.request', { from: ctx.player.pseudo, fromId: me });
    ctx.emit({ topic: `user:${other.id}`, type: 'friend.request', data: { from: ctx.player.pseudo } });
    return { status: 'pending' as const };
  },
});

export const acceptFriend = command({
  name: 'friend.accept',
  input: z.object({ player: z.number().int().positive() }),
  rate: { perMinute: 30 },
  allowedDuringWatch: true,
  async run(ctx, input) {
    const me = ctx.player.id;
    const cur = await relation(ctx.tx, me, input.player);
    // Seule une demande reçue (en attente de moi) s'accepte.
    if (!cur || cur.status === 'accepted' || cur.status === mineStatus(me, input.player)) throw new GameError('NO_SUCH_REQUEST');
    if (await blockedBetween(ctx.tx, me, input.player)) throw new GameError('SOCIAL_REFUSED');
    if ((await countFriends(ctx.tx, me)) >= FRIEND_MAX) throw new GameError('FRIEND_LIMIT', { max: FRIEND_MAX });
    const { a, b } = pair(me, input.player);
    await ctx.tx.updateTable('friendship').set({ status: 'accepted' }).where('a_id', '=', a).where('b_id', '=', b).execute();
    await notify(ctx.tx, input.player, 'friend.accepted', { from: ctx.player.pseudo, fromId: me });
    ctx.emit({ topic: `user:${input.player}`, type: 'friend.update', data: { from: ctx.player.pseudo } });
    return {};
  },
});

/** Retire un ami, refuse une demande reçue ou annule une demande envoyée. */
export const removeFriend = command({
  name: 'friend.remove',
  input: z.object({ player: z.number().int().positive() }),
  rate: { perMinute: 30 },
  allowedDuringWatch: true,
  async run(ctx, input) {
    const { a, b } = pair(ctx.player.id, input.player);
    await ctx.tx.deleteFrom('friendship').where('a_id', '=', a).where('b_id', '=', b).execute();
    ctx.emit({ topic: `user:${input.player}`, type: 'friend.update' });
    return {};
  },
});

export const blockPlayer = command({
  name: 'block.add',
  input: z.object({ pseudo: Pseudo }),
  rate: { perMinute: 30 },
  allowedDuringWatch: true,
  async run(ctx, input) {
    const other = await playerByPseudo(ctx.tx, input.pseudo);
    if (other.id === ctx.player.id) throw new GameError('SELF_TARGET');
    await ctx.tx
      .insertInto('block')
      .values({ blocker_id: ctx.player.id, blocked_id: other.id })
      .onConflict((oc) => oc.doNothing())
      .execute();
    const { a, b } = pair(ctx.player.id, other.id);
    await ctx.tx.deleteFrom('friendship').where('a_id', '=', a).where('b_id', '=', b).execute();
    return {};
  },
});

export const unblockPlayer = command({
  name: 'block.remove',
  input: z.object({ player: z.number().int().positive() }),
  rate: { perMinute: 30 },
  allowedDuringWatch: true,
  async run(ctx, input) {
    await ctx.tx.deleteFrom('block').where('blocker_id', '=', ctx.player.id).where('blocked_id', '=', input.player).execute();
    return {};
  },
});

export interface Friend {
  id: number;
  pseudo: string;
  online: boolean;
  region: string;
}

export interface FriendsView {
  friends: Friend[];
  incoming: { id: number; pseudo: string }[];
  outgoing: { id: number; pseudo: string }[];
  blocked: { id: number; pseudo: string }[];
}

/** Liste d'amis, demandes en attente dans les deux sens, et joueurs bloqués. */
export async function friendsView(db: Db, me: number, now = new Date()): Promise<FriendsView> {
  const rows = await db
    .selectFrom('friendship')
    .innerJoin('player as pa', 'pa.id', 'friendship.a_id')
    .innerJoin('player as pb', 'pb.id', 'friendship.b_id')
    .select([
      'friendship.a_id',
      'friendship.b_id',
      'friendship.status',
      'pa.pseudo as a_pseudo',
      'pb.pseudo as b_pseudo',
      'pa.last_seen_at as a_seen',
      'pb.last_seen_at as b_seen',
      'pa.pos_region as a_region',
      'pb.pos_region as b_region',
    ])
    .where((eb) => eb.or([eb('friendship.a_id', '=', me), eb('friendship.b_id', '=', me)]))
    .execute();
  const v: FriendsView = { friends: [], incoming: [], outgoing: [], blocked: [] };
  const since = now.getTime() - ONLINE_MS;
  for (const r of rows) {
    const meIsA = r.a_id === me;
    const id = meIsA ? r.b_id : r.a_id;
    const pseudo = meIsA ? r.b_pseudo : r.a_pseudo;
    if (r.status === 'accepted') {
      const seen = meIsA ? r.b_seen : r.a_seen;
      v.friends.push({ id, pseudo, online: !!seen && seen.getTime() > since, region: meIsA ? r.b_region : r.a_region });
    } else if (r.status === mineStatus(me, id)) v.outgoing.push({ id, pseudo });
    else v.incoming.push({ id, pseudo });
  }
  v.friends.sort((x, y) => Number(y.online) - Number(x.online) || x.pseudo.localeCompare(y.pseudo, 'fr'));
  v.blocked = (
    await db
      .selectFrom('block')
      .innerJoin('player', 'player.id', 'block.blocked_id')
      .select(['player.id', 'player.pseudo'])
      .where('block.blocker_id', '=', me)
      .orderBy('player.pseudo')
      .execute()
  ).map((b) => ({ id: b.id, pseudo: b.pseudo }));
  return v;
}
