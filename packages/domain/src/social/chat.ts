/**
 * Chat de région (README 25, guide 12). Un message est du texte brut de 300 caractères au plus, publié dans la
 * région où se trouve le joueur (ville ou route). Limites : 1 message par seconde (en base, partagée avec les
 * messages privés) et 20 par minute (cadre de commande). Un joueur réduit au silence ne peut ni écrire ici ni
 * envoyer de message privé. Le filtre de mots masque les mots du pack et compte l'infraction.
 *
 * L'événement `chat.message` ne porte que l'identifiant : chaque client relit l'historique de sa région, dont
 * les messages des joueurs qu'il a bloqués sont retirés côté serveur.
 */
import { z } from 'zod';
import { GameError } from '@cr/shared';
import type { Database, Db, Transaction } from '@cr/db';
import { sql } from '@cr/db';
import { command } from '../command.ts';
import { online } from '../game/content.ts';
import { assertNotMuted } from './sanctions.ts';
import { cleanText, filterWords } from './text.ts';

/** Écart minimal entre deux envois d'un même joueur (README 25). */
export const MIN_GAP_MS = 1000;
/** Fenêtre de présence : « en ligne » = vu il y a moins de 2 minutes (guide 11). */
export const ONLINE_MS = 2 * 60_000;
export const CHAT_HISTORY = 50;

type Tx = Transaction<Database>;

/** Refuse un envoi trop proche du précédent (chat ou message privé) : `RATE_LIMITED`. */
export async function assertSendSpacing(tx: Tx, playerId: number, now: Date): Promise<void> {
  const r = await sql<{ last: Date | null }>`
    select greatest(
      (select max(created_at) from chat_message where author_id = ${playerId}),
      (select max(created_at) from direct_message where sender_id = ${playerId})
    ) as last`.execute(tx);
  const last = r.rows[0]?.last;
  if (last && now.getTime() - last.getTime() < MIN_GAP_MS) throw new GameError('RATE_LIMITED');
}

/** Texte prêt à publier : nettoyé, filtré. `INVALID_INPUT` s'il est vide ou trop long. */
export function prepareText(raw: string, rules: { maxLength: number; bannedWords: string[] }): { text: string; hits: number } {
  const clean = cleanText(raw, rules.maxLength);
  if (!clean) throw new GameError('INVALID_INPUT');
  return filterWords(clean, rules.bannedWords);
}

export const sayInRegion = command({
  name: 'chat.say',
  input: z.object({ text: z.string().max(5000) }),
  rate: { perMinute: 20 },
  allowedDuringWatch: true,
  async run(ctx, input) {
    const { text, hits } = prepareText(input.text, online(ctx.content).chat);
    await assertNotMuted(ctx.tx, ctx.player.id, ctx.now);
    await assertSendSpacing(ctx.tx, ctx.player.id, ctx.now);
    const row = await ctx.tx
      .insertInto('chat_message')
      .values({ region: ctx.player.pos_region, author_id: ctx.player.id, body: text, filtered: hits, created_at: ctx.now })
      .returning('id')
      .executeTakeFirstOrThrow();
    ctx.emit({ topic: `region:${ctx.player.pos_region}`, type: 'chat.message', data: { id: row.id } });
    return { id: row.id, filtered: hits };
  },
});

export interface ChatLine {
  id: number;
  authorId: number;
  pseudo: string;
  text: string;
  at: Date;
  mine: boolean;
}

/** Derniers messages d'une région, du plus ancien au plus récent, sans ceux des joueurs que `viewerId` a bloqués. */
export async function chatHistory(db: Db, viewerId: number, region: string, limit = CHAT_HISTORY): Promise<ChatLine[]> {
  const rows = await db
    .selectFrom('chat_message')
    .innerJoin('player', 'player.id', 'chat_message.author_id')
    .select(['chat_message.id', 'chat_message.author_id', 'player.pseudo', 'chat_message.body', 'chat_message.created_at'])
    .where('chat_message.region', '=', region)
    .where('chat_message.deleted_at', 'is', null)
    .where((eb) =>
      eb.not(
        eb.exists(
          eb
            .selectFrom('block')
            .select('block.blocker_id')
            .where('block.blocker_id', '=', viewerId)
            .whereRef('block.blocked_id', '=', 'chat_message.author_id'),
        ),
      ),
    )
    .orderBy('chat_message.id', 'desc')
    .limit(limit)
    .execute();
  return rows.reverse().map((r) => ({
    id: r.id,
    authorId: r.author_id,
    pseudo: r.pseudo,
    text: r.body,
    at: r.created_at,
    mine: r.author_id === viewerId,
  }));
}

/** Joueurs vus en ligne dans une région (présence : dernière activité il y a moins de 2 minutes). */
export async function onlineInRegion(db: Db, region: string, now = new Date()): Promise<number> {
  const r = await db
    .selectFrom('player')
    .select((eb) => eb.fn.countAll<number>().as('n'))
    .where('pos_region', '=', region)
    .where('last_seen_at', '>', new Date(now.getTime() - ONLINE_MS))
    .executeTakeFirstOrThrow();
  return Number(r.n);
}
