/**
 * Messages privés (README 25, guide 12). Refusés si l'un des deux joueurs a bloqué l'autre, ou si l'expéditeur
 * est réduit au silence. Un destinataire hors ligne (vu il y a plus de 2 minutes) reçoit en plus une
 * notification persistante, au plus une non lue par expéditeur ; en ligne, il reçoit l'événement `dm.received`.
 * Même limite d'envoi que le chat (1 message par seconde, 20 par minute) ; conservation de 90 jours.
 */
import { z } from 'zod';
import { GameError } from '@cr/shared';
import type { Database, Db, MessageLink, Transaction } from '@cr/db';
import { sql } from '@cr/db';
import { command } from '../command.ts';
import { online } from '../game/content.ts';
import { notify } from '../game/shop.ts';
import { assertSendSpacing, ONLINE_MS, prepareText } from './chat.ts';
import { assertEmailVerified } from './access.ts';
import { LinkRefs, resolveLinks } from './links.ts';
import { assertNotMuted } from './sanctions.ts';

type Tx = Transaction<Database>;
type Q = Db | Tx;

export const Pseudo = z.string().trim().min(1).max(40);

/** Joueur désigné par son pseudo (casse ignorée) : `PLAYER_NOT_FOUND` sinon. */
export async function playerByPseudo(q: Q, pseudo: string): Promise<{ id: number; pseudo: string; last_seen_at: Date | null }> {
  const p = await q
    .selectFrom('player')
    .select(['id', 'pseudo', 'last_seen_at'])
    .where(sql<boolean>`lower(pseudo) = lower(${pseudo})`)
    .executeTakeFirst();
  if (!p) throw new GameError('PLAYER_NOT_FOUND');
  return p;
}

/** Vrai si l'un des deux a bloqué l'autre. */
export async function blockedBetween(q: Q, a: number, b: number): Promise<boolean> {
  const r = await q
    .selectFrom('block')
    .select('blocker_id')
    .where((eb) =>
      eb.or([eb.and([eb('blocker_id', '=', a), eb('blocked_id', '=', b)]), eb.and([eb('blocker_id', '=', b), eb('blocked_id', '=', a)])]),
    )
    .limit(1)
    .executeTakeFirst();
  return !!r;
}

export const sendDirect = command({
  name: 'dm.send',
  input: z.object({ to: Pseudo, text: z.string().max(5000), links: LinkRefs }),
  rate: { perMinute: 20 },
  allowedDuringWatch: true,
  async run(ctx, input) {
    await assertEmailVerified(ctx);
    const { text } = prepareText(input.text, online(ctx.content).chat);
    const to = await playerByPseudo(ctx.tx, input.to);
    if (to.id === ctx.player.id) throw new GameError('SELF_TARGET');
    await assertNotMuted(ctx.tx, ctx.player.id, ctx.now);
    if (await blockedBetween(ctx.tx, ctx.player.id, to.id)) throw new GameError('SOCIAL_REFUSED');
    await assertSendSpacing(ctx.tx, ctx.player.id, ctx.now);
    const links = await resolveLinks(ctx.tx, ctx.content, ctx.player.id, input.links);
    const row = await ctx.tx
      .insertInto('direct_message')
      .values({ sender_id: ctx.player.id, recipient_id: to.id, body: text, links: JSON.stringify(links), created_at: ctx.now })
      .returning('id')
      .executeTakeFirstOrThrow();
    const away = !to.last_seen_at || ctx.now.getTime() - to.last_seen_at.getTime() > ONLINE_MS;
    if (away) {
      const pending = await ctx.tx
        .selectFrom('notification')
        .select('id')
        .where('player_id', '=', to.id)
        .where('type', '=', 'dm.received')
        .where('read_at', 'is', null)
        .where(sql<boolean>`data->>'fromId' = ${String(ctx.player.id)}`)
        .limit(1)
        .executeTakeFirst();
      if (!pending) await notify(ctx.tx, to.id, 'dm.received', { from: ctx.player.pseudo, fromId: ctx.player.id });
    }
    ctx.emit({ topic: `user:${to.id}`, type: 'dm.received', data: { id: row.id, from: ctx.player.pseudo } });
    // Les autres onglets de l'expéditeur relisent la conversation.
    ctx.emit({ topic: `user:${ctx.player.id}`, type: 'dm.sent', data: { id: row.id, to: to.pseudo } });
    return { id: row.id };
  },
});

/** Marque comme lus les messages reçus d'un joueur (ouverture de la conversation). */
export const readDirect = command({
  name: 'dm.read',
  input: z.object({ with: Pseudo }),
  rate: { perMinute: 120 },
  allowedDuringWatch: true,
  async run(ctx, input) {
    const other = await playerByPseudo(ctx.tx, input.with);
    await ctx.tx
      .updateTable('direct_message')
      .set({ read_at: ctx.now })
      .where('recipient_id', '=', ctx.player.id)
      .where('sender_id', '=', other.id)
      .where('read_at', 'is', null)
      .execute();
    // Les notifications « message de X » de cette conversation sont aussi lues.
    await ctx.tx
      .updateTable('notification')
      .set({ read_at: ctx.now })
      .where('player_id', '=', ctx.player.id)
      .where('type', '=', 'dm.received')
      .where('read_at', 'is', null)
      .where(sql<boolean>`data->>'fromId' = ${String(other.id)}`)
      .execute();
    return {};
  },
});

export interface Conversation {
  otherId: number;
  pseudo: string;
  text: string;
  at: Date;
  fromMe: boolean;
  unread: number;
}

/** Conversations du joueur, la plus récente d'abord (hors joueurs qu'il a bloqués). */
export async function directConversations(db: Db, me: number): Promise<Conversation[]> {
  const r = await sql<{
    other: number;
    pseudo: string;
    body: string;
    created_at: Date;
    sender_id: number;
    unread: number;
  }>`
    select l.other, p.pseudo, l.body, l.created_at, l.sender_id,
           (select count(*)::int from direct_message u
             where u.recipient_id = ${me} and u.sender_id = l.other and u.read_at is null) as unread
    from (
      select distinct on (other) other, body, created_at, sender_id
      from (
        select case when sender_id = ${me} then recipient_id else sender_id end as other, id, body, created_at, sender_id
        from direct_message
        where sender_id = ${me} or recipient_id = ${me}
      ) m
      order by other, id desc
    ) l
    join player p on p.id = l.other
    where not exists (select 1 from block b where b.blocker_id = ${me} and b.blocked_id = l.other)
    order by l.created_at desc
    limit 100`.execute(db);
  return r.rows.map((x) => ({
    otherId: x.other,
    pseudo: x.pseudo,
    text: x.body,
    at: x.created_at,
    fromMe: x.sender_id === me,
    unread: x.unread,
  }));
}

export interface DirectLine {
  id: number;
  mine: boolean;
  text: string;
  links: MessageLink[];
  at: Date;
}

/** Derniers messages échangés avec un joueur, du plus ancien au plus récent. */
export async function directThread(db: Db, me: number, other: number, limit = 50): Promise<DirectLine[]> {
  const rows = await db
    .selectFrom('direct_message')
    .select(['id', 'sender_id', 'body', 'links', 'created_at'])
    .where((eb) =>
      eb.or([
        eb.and([eb('sender_id', '=', me), eb('recipient_id', '=', other)]),
        eb.and([eb('sender_id', '=', other), eb('recipient_id', '=', me)]),
      ]),
    )
    .orderBy('id', 'desc')
    .limit(limit)
    .execute();
  return rows.reverse().map((r) => ({ id: r.id, mine: r.sender_id === me, text: r.body, links: r.links, at: r.created_at }));
}

/** Messages privés non lus (pastille du menu). */
export async function directUnread(db: Db, me: number): Promise<number> {
  const r = await db
    .selectFrom('direct_message')
    .select((eb) => eb.fn.countAll<number>().as('n'))
    .where('recipient_id', '=', me)
    .where('read_at', 'is', null)
    .where((eb) =>
      eb.not(
        eb.exists(
          eb
            .selectFrom('block')
            .select('block.blocker_id')
            .where('block.blocker_id', '=', me)
            .whereRef('block.blocked_id', '=', 'direct_message.sender_id'),
        ),
      ),
    )
    .executeTakeFirstOrThrow();
  return Number(r.n);
}
