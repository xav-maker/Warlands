/**
 * Droits des joueurs sur leurs données (guide 14) : export (JSON) et suppression du compte.
 *
 * La suppression anonymise le compte : l'e-mail et le mot de passe sont effacés, le pseudo remplacé, les messages privés,
 * les messages du chat, les amitiés, les blocages, les notifications et les sessions supprimés ; la partie est remise à
 * zéro comme « recommencer » (biens et or vers les puits, journalisés). Restent, sans donnée personnelle : les lignes du
 * grand livre et des mouvements de biens (intégrité de l'économie), l'historique des combats, et les signalements et
 * sanctions (décisions de modération, DSA).
 */
import { verify } from '@node-rs/argon2';
import { z } from 'zod';
import { GameError } from '@cr/shared';
import type { Db } from '@cr/db';
import { command } from './command.ts';
import { wipeGame } from './game/reset.ts';

export const DELETE_WORD = 'SUPPRIMER';

/** Toutes les données d'un compte, lisibles (guide 14, droit d'accès et de portabilité). */
export async function exportData(db: Db, accountId: number): Promise<Record<string, unknown>> {
  return db.transaction().execute(async (tx) => {
    const account = await tx
      .selectFrom('account')
      .select(['id', 'email', 'email_verified_at', 'role', 'status', 'tos_version', 'tos_accepted_at', 'created_at', 'totp_secret'])
      .where('id', '=', accountId)
      .executeTakeFirstOrThrow();
    const p = await tx.selectFrom('player').selectAll().where('account_id', '=', accountId).executeTakeFirstOrThrow();
    const pid = p.id;
    const all = <T>(q: Promise<T[]>) => q;
    return {
      exportedAt: new Date().toISOString(),
      account: {
        id: account.id,
        email: account.email,
        emailVerifiedAt: account.email_verified_at,
        role: account.role,
        status: account.status,
        termsVersion: account.tos_version,
        termsAcceptedAt: account.tos_accepted_at,
        createdAt: account.created_at,
        twoFactor: account.totp_secret !== null,
      },
      sessions: await all(
        tx
          .selectFrom('session')
          .select(['created_at', 'last_seen_at', 'expires_at', 'ip_prefix', 'user_agent'])
          .where('account_id', '=', accountId)
          .execute(),
      ),
      player: {
        id: pid,
        pseudo: p.pseudo,
        createdAt: p.created_at,
        lastSeenAt: p.last_seen_at,
        position: { kind: p.pos_kind, region: p.pos_region, route: p.pos_route, step: p.pos_step },
        stats: { fights: p.stat_fights, wins: p.stat_wins, deaths: p.stat_deaths },
        guardians: p.guardians,
        dungeonAvailable: p.dungeon_available,
      },
      gold: {
        balance: (await tx.selectFrom('gold_account').select('balance').where('player_id', '=', pid).executeTakeFirst())?.balance ?? 0,
        entries: await all(
          tx
            .selectFrom('gold_entry')
            .innerJoin('gold_account', 'gold_account.id', 'gold_entry.account_id')
            .select(['gold_entry.amount', 'gold_entry.reason', 'gold_entry.created_at'])
            .where('gold_account.player_id', '=', pid)
            .orderBy('gold_entry.id')
            .execute(),
        ),
      },
      troops: await all(
        tx
          .selectFrom('troop')
          .select(['id', 'type', 'form', 'level', 'xp', 'container', 'rank', 'disabled_skills', 'created_at', 'died_at'])
          .where('player_id', '=', pid)
          .orderBy('id')
          .execute(),
      ),
      items: await all(
        tx.selectFrom('item_stack').select(['container', 'item', 'qty']).where('player_id', '=', pid).orderBy('id').execute(),
      ),
      equipment: await all(
        tx
          .selectFrom('item_instance')
          .select(['id', 'base', 'roll', 'stats', 'container', 'troop_id', 'slot', 'origin', 'created_at'])
          .where('player_id', '=', pid)
          .orderBy('id')
          .execute(),
      ),
      quests: await all(
        tx.selectFrom('quest').select(['region', 'status', 'data', 'created_at']).where('player_id', '=', pid).orderBy('id').execute(),
      ),
      listings: await all(
        tx
          .selectFrom('shop_listing')
          .select(['id', 'region', 'name', 'qty', 'price', 'status', 'created_at', 'closed_at'])
          .where('seller_id', '=', pid)
          .execute(),
      ),
      purchases: await all(
        tx.selectFrom('shop_sale').select(['listing_id', 'price', 'tax', 'created_at']).where('buyer_id', '=', pid).execute(),
      ),
      battles: await all(
        tx
          .selectFrom('battle_participant')
          .innerJoin('battle', 'battle.id', 'battle_participant.battle_id')
          .select(['battle.id', 'battle.kind', 'battle.route', 'battle.won', 'battle.created_at'])
          .where('battle_participant.player_id', '=', pid)
          .orderBy('battle.id')
          .execute(),
      ),
      chat: await all(
        tx.selectFrom('chat_message').select(['region', 'body', 'created_at']).where('author_id', '=', pid).orderBy('id').execute(),
      ),
      directMessages: await all(
        tx
          .selectFrom('direct_message')
          .innerJoin('player as s', 's.id', 'direct_message.sender_id')
          .innerJoin('player as r', 'r.id', 'direct_message.recipient_id')
          .select(['s.pseudo as from', 'r.pseudo as to', 'direct_message.body', 'direct_message.created_at', 'direct_message.read_at'])
          .where((eb) => eb.or([eb('direct_message.sender_id', '=', pid), eb('direct_message.recipient_id', '=', pid)]))
          .orderBy('direct_message.id')
          .execute(),
      ),
      friends: await all(
        tx
          .selectFrom('friendship')
          .innerJoin('player as pa', 'pa.id', 'friendship.a_id')
          .innerJoin('player as pb', 'pb.id', 'friendship.b_id')
          .select(['pa.pseudo as a', 'pb.pseudo as b', 'friendship.status', 'friendship.created_at'])
          .where((eb) => eb.or([eb('friendship.a_id', '=', pid), eb('friendship.b_id', '=', pid)]))
          .execute(),
      ),
      blocked: await all(
        tx
          .selectFrom('block')
          .innerJoin('player', 'player.id', 'block.blocked_id')
          .select(['player.pseudo'])
          .where('block.blocker_id', '=', pid)
          .execute(),
      ),
      reportsMade: await all(
        tx
          .selectFrom('report')
          .select(['kind', 'reason', 'comment', 'status', 'decision', 'created_at'])
          .where('author_id', '=', pid)
          .execute(),
      ),
      sanctions: await all(
        tx.selectFrom('sanction').select(['kind', 'reason', 'from_at', 'until_at', 'revoked_at']).where('player_id', '=', pid).execute(),
      ),
      notifications: await all(
        tx
          .selectFrom('notification')
          .select(['type', 'data', 'created_at', 'read_at'])
          .where('player_id', '=', pid)
          .orderBy('id')
          .execute(),
      ),
    };
  });
}

/** Pseudo d'un compte supprimé : neutre et unique. */
export const deletedPseudo = (playerId: number): string => `Ancien joueur ${playerId}`;

/** Supprime le compte (guide 14) : mot de passe et mot de confirmation exigés. Irréversible. */
export const deleteAccount = command({
  name: 'account.delete',
  input: z.object({ password: z.string().max(200), confirm: z.literal(DELETE_WORD) }),
  rate: { perMinute: 3 },
  allowedDuringWatch: true,
  async run(ctx, input) {
    const pid = ctx.player.id;
    const acc = await ctx.tx
      .selectFrom('account')
      .select(['id', 'password_hash'])
      .where('id', '=', ctx.player.account_id)
      .forUpdate()
      .executeTakeFirstOrThrow();
    if (!(await verify(acc.password_hash, input.password))) throw new GameError('BAD_CREDENTIALS');
    // La partie : comme « recommencer » (biens et or aux puits, annonces retirées, donjon quitté), tout journalisé.
    const { gold } = await wipeGame(ctx);
    const tx = ctx.tx;
    await tx
      .deleteFrom('direct_message')
      .where((eb) => eb.or([eb('sender_id', '=', pid), eb('recipient_id', '=', pid)]))
      .execute();
    await tx.deleteFrom('chat_message').where('author_id', '=', pid).execute();
    await tx
      .deleteFrom('friendship')
      .where((eb) => eb.or([eb('a_id', '=', pid), eb('b_id', '=', pid)]))
      .execute();
    await tx
      .deleteFrom('block')
      .where((eb) => eb.or([eb('blocker_id', '=', pid), eb('blocked_id', '=', pid)]))
      .execute();
    await tx.deleteFrom('notification').where('player_id', '=', pid).execute();
    await tx.deleteFrom('idempotency_key').where('player_id', '=', pid).execute();
    await tx.deleteFrom('session').where('account_id', '=', acc.id).execute();
    await tx.deleteFrom('email_verification').where('account_id', '=', acc.id).execute();
    await tx
      .updateTable('player')
      .set({ pseudo: deletedPseudo(pid), dungeon_available: false, rename_required: false, last_seen_at: null, updated_at: ctx.now })
      .where('id', '=', pid)
      .execute();
    await tx
      .updateTable('account')
      .set({
        status: 'deleted',
        email: `supprime-${acc.id}@invalid`,
        password_hash: '!',
        email_verified_at: null,
        totp_secret: null,
        totp_pending: null,
        totp_last_step: null,
        updated_at: ctx.now,
      })
      .where('id', '=', acc.id)
      .execute();
    await tx
      .insertInto('admin_action')
      .values({ actor_id: pid, action: 'account.delete', target_id: pid, data: JSON.stringify({ gold }) })
      .execute();
    return { deleted: true };
  },
});
