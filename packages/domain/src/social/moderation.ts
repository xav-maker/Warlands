/**
 * Signalements et modération (guide 12, README 25). Tout joueur peut signaler un message du chat, un message
 * privé qu'il a reçu, une annonce ou un profil ; le signalement copie le contenu visé, qui peut être supprimé
 * ou purgé ensuite. Les modérateurs et administrateurs traitent la file, appliquent des sanctions motivées
 * (sourdine, interdiction de boutique, suspension, bannissement) et lèvent ou suppriment à la main.
 *
 * Rôles [H] : un modérateur applique sourdine et interdiction de boutique (30 jours au plus) et suspend
 * (7 jours au plus) ; le bannissement, les durées plus longues et la sanction d'un modérateur sont réservés
 * aux administrateurs ; personne ne sanctionne un administrateur ni soi-même. Toute action est journalisée dans
 * `admin_action`, et chaque décision est expliquée au joueur sanctionné comme à l'auteur du signalement.
 */
import { z } from 'zod';
import { GameError } from '@cr/shared';
import type { AccountRole, Database, Db, ReportKind, ReportReason, SanctionKind, Transaction } from '@cr/db';
import { sql } from '@cr/db';
import { command, type CommandContext } from '../command.ts';
import { notify } from '../game/shop.ts';
import { checkPseudo } from '../identity.ts';
import { playerByPseudo, Pseudo } from './direct.ts';
import { activeSanctions, untilText, type ActiveSanction } from './sanctions.ts';

type Tx = Transaction<Database>;

export const REPORT_REASONS = ['insulte', 'spam', 'triche', 'illicite', 'autre'] as const satisfies readonly ReportReason[];
export const REPORT_REASON_FR: Record<ReportReason, string> = {
  insulte: 'Insulte ou harcèlement',
  spam: 'Spam ou publicité',
  triche: 'Triche ou escroquerie',
  illicite: 'Contenu illicite',
  autre: 'Autre',
};
export const SANCTION_KIND_FR: Record<SanctionKind, string> = {
  mute: 'Sourdine',
  shop_ban: 'Interdiction de boutique',
  suspend: 'Suspension',
  ban: 'Bannissement',
};
const DAILY_REPORTS = 20;
const HOUR = 3_600_000;
/** Durée maximale (en heures) qu'un modérateur peut infliger, par type. */
const MODERATOR_MAX_HOURS: Record<SanctionKind, number> = { mute: 720, shop_ban: 720, suspend: 168, ban: 0 };

export const isStaff = (role: AccountRole | undefined): boolean => role === 'moderator' || role === 'admin';

// ---------------------------------------------------------------------------------------------------------
// Signalement (tout joueur)

export const createReport = command({
  name: 'report.create',
  input: z.object({
    kind: z.enum(['chat', 'dm', 'player', 'listing']),
    ref: z.number().int().positive().optional(),
    pseudo: Pseudo.optional(),
    reason: z.enum(REPORT_REASONS),
    comment: z.string().trim().max(500).default(''),
  }),
  rate: { perMinute: 10 },
  allowedDuringWatch: true,
  async run(ctx, input) {
    const me = ctx.player.id;
    const day = await ctx.tx
      .selectFrom('report')
      .select((eb) => eb.fn.countAll<number>().as('n'))
      .where('author_id', '=', me)
      .where('created_at', '>', new Date(ctx.now.getTime() - 24 * HOUR))
      .executeTakeFirstOrThrow();
    if (Number(day.n) >= DAILY_REPORTS) throw new GameError('REPORT_LIMIT');

    let target: number;
    let content = '';
    const kind: ReportKind = input.kind;
    if (kind === 'chat') {
      const m = input.ref
        ? await ctx.tx.selectFrom('chat_message').select(['author_id', 'body']).where('id', '=', input.ref).executeTakeFirst()
        : undefined;
      if (!m) throw new GameError('MESSAGE_NOT_FOUND');
      target = m.author_id;
      content = m.body;
    } else if (kind === 'dm') {
      const m = input.ref
        ? await ctx.tx
            .selectFrom('direct_message')
            .select(['sender_id', 'body'])
            .where('id', '=', input.ref)
            .where('recipient_id', '=', me)
            .executeTakeFirst()
        : undefined;
      if (!m) throw new GameError('MESSAGE_NOT_FOUND');
      target = m.sender_id;
      content = m.body;
    } else if (kind === 'listing') {
      const l = input.ref
        ? await ctx.tx
            .selectFrom('shop_listing')
            .select(['seller_id', 'name', 'price', 'qty'])
            .where('id', '=', input.ref)
            .executeTakeFirst()
        : undefined;
      if (!l) throw new GameError('INVALID_INPUT');
      target = l.seller_id;
      content = `${l.name} × ${l.qty}, ${l.price} or`;
    } else {
      if (!input.pseudo) throw new GameError('INVALID_INPUT');
      target = (await playerByPseudo(ctx.tx, input.pseudo)).id;
    }
    if (target === me) throw new GameError('SELF_TARGET');
    if (input.ref !== undefined && kind !== 'player') {
      const dup = await ctx.tx
        .selectFrom('report')
        .select('id')
        .where('author_id', '=', me)
        .where('kind', '=', kind)
        .where('ref_id', '=', input.ref)
        .executeTakeFirst();
      if (dup) throw new GameError('REPORT_DUPLICATE');
    }
    const row = await ctx.tx
      .insertInto('report')
      .values({
        author_id: me,
        target_id: target,
        kind,
        ref_id: kind === 'player' ? null : (input.ref ?? null),
        content,
        reason: input.reason,
        comment: input.comment,
        created_at: ctx.now,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    return { id: row.id };
  },
});

// ---------------------------------------------------------------------------------------------------------
// Outils de modération (modérateurs et administrateurs)

/** Rôle du joueur qui agit ; `NOT_MODERATOR` s'il n'a pas le droit. */
async function staffRole(ctx: CommandContext): Promise<'moderator' | 'admin'> {
  const a = await ctx.tx.selectFrom('account').select('role').where('id', '=', ctx.player.account_id).executeTakeFirstOrThrow();
  if (!isStaff(a.role)) throw new GameError('NOT_MODERATOR');
  return a.role as 'moderator' | 'admin';
}

async function logAction(tx: Tx, actor: number, action: string, target: number | null, data: Record<string, unknown>): Promise<void> {
  await tx
    .insertInto('admin_action')
    .values({ actor_id: actor, action, target_id: target, data: JSON.stringify(data) })
    .execute();
}

/** Clôture un signalement ouvert avec sa décision motivée, et en informe son auteur. */
async function closeReportIn(tx: Tx, reportId: number, actor: number, decision: string, now: Date): Promise<boolean> {
  const r = await tx
    .updateTable('report')
    .set({ status: 'closed', handled_by: actor, decision, handled_at: now })
    .where('id', '=', reportId)
    .where('status', '=', 'open')
    .returning(['author_id', 'kind'])
    .executeTakeFirst();
  if (!r) return false;
  await notify(tx, r.author_id, 'report.closed', { report: reportId, decision });
  return true;
}

export const applySanction = command({
  name: 'mod.sanction',
  input: z.object({
    player: z.number().int().positive(),
    kind: z.enum(['mute', 'shop_ban', 'suspend', 'ban']),
    /** Durée en heures ; absente = sans fin (sourdine ou interdiction de boutique d'un administrateur, bannissement). */
    hours: z
      .number()
      .int()
      .min(1)
      .max(24 * 365)
      .optional(),
    reason: z.string().trim().min(3).max(500),
    report: z.number().int().positive().optional(),
  }),
  rate: { perMinute: 30 },
  allowedDuringWatch: true,
  async run(ctx, input) {
    const role = await staffRole(ctx);
    if (input.player === ctx.player.id) throw new GameError('SANCTION_FORBIDDEN');
    const target = await ctx.tx
      .selectFrom('player')
      .innerJoin('account', 'account.id', 'player.account_id')
      .select(['player.id', 'player.account_id', 'account.role'])
      .where('player.id', '=', input.player)
      .executeTakeFirst();
    if (!target) throw new GameError('PLAYER_NOT_FOUND');
    if (target.role === 'admin' || (target.role === 'moderator' && role !== 'admin')) throw new GameError('SANCTION_FORBIDDEN');

    if (role !== 'admin') {
      const max = MODERATOR_MAX_HOURS[input.kind];
      if (input.kind === 'ban' || !input.hours || input.hours > max) throw new GameError('NOT_ADMIN');
    }
    // Un bannissement n'a pas de terme ; les autres sanctions suivent la durée donnée.
    const until = input.kind === 'ban' || !input.hours ? null : new Date(ctx.now.getTime() + input.hours * HOUR);

    const row = await ctx.tx
      .insertInto('sanction')
      .values({
        player_id: target.id,
        kind: input.kind,
        reason: input.reason,
        from_at: ctx.now,
        until_at: until,
        author_id: ctx.player.id,
        report_id: input.report ?? null,
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    if (input.kind === 'suspend' || input.kind === 'ban') {
      await ctx.tx
        .updateTable('account')
        .set({ status: input.kind === 'ban' ? 'banned' : 'suspended', updated_at: ctx.now })
        .where('id', '=', target.account_id)
        .execute();
      await ctx.tx.deleteFrom('session').where('account_id', '=', target.account_id).execute();
    }
    await logAction(ctx.tx, ctx.player.id, `sanction.${input.kind}`, target.id, {
      sanction: row.id,
      until: until?.toISOString() ?? null,
      reason: input.reason,
      report: input.report ?? null,
    });
    if (input.report)
      await closeReportIn(ctx.tx, input.report, ctx.player.id, `${SANCTION_KIND_FR[input.kind]} : ${input.reason}`, ctx.now);
    // Le joueur sanctionné est prévenu avec le motif (décision motivée, DSA).
    await notify(ctx.tx, target.id, 'sanction.applied', { kind: input.kind, until: until?.toISOString() ?? null, reason: input.reason });
    ctx.emit({
      topic: `user:${target.id}`,
      type: 'sanction.applied',
      data: { text: `${SANCTION_KIND_FR[input.kind]} ${untilText(until)} : ${input.reason}`, kind: input.kind },
    });
    return { id: row.id };
  },
});

/** Lève une sanction ; le compte redevient actif s'il ne reste aucune suspension ni aucun bannissement. */
export const liftSanction = command({
  name: 'mod.lift',
  input: z.object({ sanction: z.number().int().positive() }),
  rate: { perMinute: 30 },
  allowedDuringWatch: true,
  async run(ctx, input) {
    const role = await staffRole(ctx);
    const s = await ctx.tx
      .selectFrom('sanction')
      .innerJoin('player', 'player.id', 'sanction.player_id')
      .select(['sanction.id', 'sanction.kind', 'sanction.player_id', 'sanction.revoked_at', 'player.account_id'])
      .where('sanction.id', '=', input.sanction)
      .executeTakeFirst();
    if (!s) throw new GameError('SANCTION_NOT_FOUND');
    // Lever un bannissement est une décision d'administrateur.
    if (s.kind === 'ban' && role !== 'admin') throw new GameError('NOT_ADMIN');
    if (!s.revoked_at) {
      await ctx.tx.updateTable('sanction').set({ revoked_at: ctx.now, revoked_by: ctx.player.id }).where('id', '=', s.id).execute();
      const left = await ctx.tx
        .selectFrom('sanction')
        .innerJoin('player', 'player.id', 'sanction.player_id')
        .select('sanction.id')
        .where('player.account_id', '=', s.account_id)
        .where('sanction.kind', 'in', ['suspend', 'ban'])
        .where('sanction.revoked_at', 'is', null)
        .where((eb) => eb.or([eb('sanction.until_at', 'is', null), eb('sanction.until_at', '>', ctx.now)]))
        .limit(1)
        .executeTakeFirst();
      if (!left) {
        await ctx.tx
          .updateTable('account')
          .set({ status: 'active', updated_at: ctx.now })
          .where('id', '=', s.account_id)
          .where('status', 'in', ['suspended', 'banned'])
          .execute();
      }
      await logAction(ctx.tx, ctx.player.id, 'sanction.lift', s.player_id, { sanction: s.id, kind: s.kind });
    }
    return {};
  },
});

/** Clôture un signalement sans sanction (ou après une sanction déjà prononcée), avec une décision motivée. */
export const closeReport = command({
  name: 'mod.closeReport',
  input: z.object({ report: z.number().int().positive(), decision: z.string().trim().min(3).max(500) }),
  rate: { perMinute: 60 },
  allowedDuringWatch: true,
  async run(ctx, input) {
    await staffRole(ctx);
    const done = await closeReportIn(ctx.tx, input.report, ctx.player.id, input.decision, ctx.now);
    if (!done) throw new GameError('REPORT_NOT_FOUND');
    await logAction(ctx.tx, ctx.player.id, 'report.close', null, { report: input.report, decision: input.decision });
    return {};
  },
});

/** Supprime un message du chat (il disparaît pour tous ; le signalement en garde la copie). */
export const deleteChatMessage = command({
  name: 'mod.deleteMessage',
  input: z.object({ message: z.number().int().positive() }),
  rate: { perMinute: 60 },
  allowedDuringWatch: true,
  async run(ctx, input) {
    await staffRole(ctx);
    const m = await ctx.tx
      .updateTable('chat_message')
      .set({ deleted_at: ctx.now, deleted_by: ctx.player.id })
      .where('id', '=', input.message)
      .where('deleted_at', 'is', null)
      .returning(['region', 'author_id', 'body'])
      .executeTakeFirst();
    if (!m) throw new GameError('MESSAGE_NOT_FOUND');
    await logAction(ctx.tx, ctx.player.id, 'chat.delete', m.author_id, { message: input.message, text: m.body });
    ctx.emit({ topic: `region:${m.region}`, type: 'chat.deleted', data: { id: input.message } });
    return {};
  },
});

/** Pseudo provisoire donné par un renommage forcé sans pseudo choisi : neutre et unique. */
export const provisionalPseudo = (playerId: number): string => `Aventurier ${playerId}`;

/** Le pseudo est-il libre (casse ignorée), sauf pour `except` ? */
async function pseudoFree(tx: Tx, pseudo: string, except: number): Promise<boolean> {
  const taken = await tx
    .selectFrom('player')
    .select('id')
    .where((eb) => eb(eb.fn('lower', ['pseudo']), '=', pseudo.toLowerCase()))
    .where('id', '<>', except)
    .executeTakeFirst();
  return !taken;
}

/**
 * Renommage forcé (guide 12) : le pseudo d'un joueur est remplacé par un pseudo provisoire (ou celui que donne
 * le modérateur), et le joueur peut en choisir un nouveau une fois. Mêmes règles de rôle que les sanctions.
 */
export const forceRename = command({
  name: 'mod.rename',
  input: z.object({
    player: z.number().int().positive(),
    pseudo: z.string().max(40).optional(),
    reason: z.string().trim().min(3).max(500),
    report: z.number().int().positive().optional(),
  }),
  rate: { perMinute: 30 },
  allowedDuringWatch: true,
  async run(ctx, input) {
    const role = await staffRole(ctx);
    if (input.player === ctx.player.id) throw new GameError('SANCTION_FORBIDDEN');
    const target = await ctx.tx
      .selectFrom('player')
      .innerJoin('account', 'account.id', 'player.account_id')
      .select(['player.id', 'player.pseudo', 'account.role'])
      .where('player.id', '=', input.player)
      .forUpdate('player')
      .executeTakeFirst();
    if (!target) throw new GameError('PLAYER_NOT_FOUND');
    if (target.role === 'admin' || (target.role === 'moderator' && role !== 'admin')) throw new GameError('SANCTION_FORBIDDEN');
    const pseudo = input.pseudo?.trim() ? checkPseudo(input.pseudo) : provisionalPseudo(target.id);
    if (!(await pseudoFree(ctx.tx, pseudo, target.id))) throw new GameError('PSEUDO_TAKEN');

    await ctx.tx.updateTable('player').set({ pseudo, rename_required: true, updated_at: ctx.now }).where('id', '=', target.id).execute();
    await logAction(ctx.tx, ctx.player.id, 'player.rename', target.id, { from: target.pseudo, to: pseudo, reason: input.reason });
    if (input.report) await closeReportIn(ctx.tx, input.report, ctx.player.id, `Pseudo remplacé : ${input.reason}`, ctx.now);
    await notify(ctx.tx, target.id, 'pseudo.renamed', { from: target.pseudo, to: pseudo, reason: input.reason });
    ctx.emit({
      topic: `user:${target.id}`,
      type: 'pseudo.renamed',
      data: {
        text: `Votre pseudo « ${target.pseudo} » a été remplacé par « ${pseudo} » : ${input.reason}. Choisissez-en un nouveau depuis la page Compte.`,
      },
    });
    return { pseudo };
  },
});

/** Choix d'un nouveau pseudo après un renommage forcé (une seule fois). */
export const choosePseudo = command({
  name: 'player.rename',
  input: z.object({ pseudo: z.string().max(40) }),
  rate: { perMinute: 10 },
  allowedDuringWatch: true,
  async run(ctx, input) {
    if (!ctx.player.rename_required) throw new GameError('RENAME_NOT_ALLOWED');
    const pseudo = checkPseudo(input.pseudo);
    if (!(await pseudoFree(ctx.tx, pseudo, ctx.player.id))) throw new GameError('PSEUDO_TAKEN');
    try {
      await ctx.tx
        .updateTable('player')
        .set({ pseudo, rename_required: false, updated_at: ctx.now })
        .where('id', '=', ctx.player.id)
        .execute();
    } catch (e) {
      if ((e as { constraint?: string }).constraint === 'player_pseudo_uq') throw new GameError('PSEUDO_TAKEN');
      throw e;
    }
    await logAction(ctx.tx, ctx.player.id, 'player.rename_chosen', ctx.player.id, { from: ctx.player.pseudo, to: pseudo });
    return { pseudo };
  },
});

// ---------------------------------------------------------------------------------------------------------
// Lectures pour les pages de modération

export interface ReportRow {
  id: number;
  kind: ReportKind;
  reason: ReportReason;
  comment: string;
  content: string;
  status: 'open' | 'closed';
  decision: string | null;
  createdAt: Date;
  handledAt: Date | null;
  authorId: number;
  author: string;
  targetId: number;
  target: string;
  handledBy: string | null;
  /** Signalements ouverts visant la même personne. */
  openOnTarget: number;
}

const reportSelect = (db: Db) =>
  db
    .selectFrom('report')
    .innerJoin('player as pa', 'pa.id', 'report.author_id')
    .innerJoin('player as pt', 'pt.id', 'report.target_id')
    .leftJoin('player as ph', 'ph.id', 'report.handled_by')
    .select([
      'report.id',
      'report.kind',
      'report.reason',
      'report.comment',
      'report.content',
      'report.status',
      'report.decision',
      'report.created_at',
      'report.handled_at',
      'report.author_id',
      'pa.pseudo as author',
      'report.target_id',
      'pt.pseudo as target',
      'ph.pseudo as handled_by',
      (eb) =>
        eb
          .selectFrom('report as r2')
          .select((e2) => e2.fn.countAll<number>().as('n'))
          .whereRef('r2.target_id', '=', 'report.target_id')
          .where('r2.status', '=', 'open')
          .as('open_on_target'),
    ]);

const toRow = (r: Awaited<ReturnType<ReturnType<typeof reportSelect>['execute']>>[number]): ReportRow => ({
  id: r.id,
  kind: r.kind,
  reason: r.reason,
  comment: r.comment,
  content: r.content,
  status: r.status,
  decision: r.decision,
  createdAt: r.created_at,
  handledAt: r.handled_at,
  authorId: r.author_id,
  author: r.author,
  targetId: r.target_id,
  target: r.target,
  handledBy: r.handled_by,
  openOnTarget: Number(r.open_on_target ?? 0),
});

/** File des signalements : les ouverts du plus ancien au plus récent, les traités du plus récent au plus ancien. */
export async function reportQueue(db: Db, status: 'open' | 'closed', limit = 100): Promise<ReportRow[]> {
  const q = reportSelect(db).where('report.status', '=', status).limit(limit);
  return (await (status === 'open' ? q.orderBy('report.id', 'asc') : q.orderBy('report.handled_at', 'desc')).execute()).map(toRow);
}

export async function reportDetail(db: Db, id: number): Promise<ReportRow | null> {
  const r = await reportSelect(db).where('report.id', '=', id).executeTakeFirst();
  return r ? toRow(r) : null;
}

export interface PlayerFile {
  id: number;
  pseudo: string;
  role: AccountRole;
  status: string;
  createdAt: Date;
  lastSeenAt: Date | null;
  active: ActiveSanction[];
  history: {
    id: number;
    kind: SanctionKind;
    reason: string;
    from: Date;
    until: Date | null;
    revoked: Date | null;
    author: string | null;
  }[];
  recentChat: { id: number; region: string; text: string; at: Date; deleted: boolean }[];
  reportsAgainst: number;
  /** Mots masqués par le filtre dans les dernières 24 h. */
  filteredDay: number;
}

/** Dossier d'un joueur pour la modération : sanctions, derniers messages, signalements reçus. */
export async function playerFile(db: Db, id: number, now = new Date()): Promise<PlayerFile | null> {
  const p = await db
    .selectFrom('player')
    .innerJoin('account', 'account.id', 'player.account_id')
    .select(['player.id', 'player.pseudo', 'player.last_seen_at', 'player.created_at', 'account.role', 'account.status'])
    .where('player.id', '=', id)
    .executeTakeFirst();
  if (!p) return null;
  const history = await db
    .selectFrom('sanction')
    .leftJoin('player as pa', 'pa.id', 'sanction.author_id')
    .select([
      'sanction.id',
      'sanction.kind',
      'sanction.reason',
      'sanction.from_at',
      'sanction.until_at',
      'sanction.revoked_at',
      'pa.pseudo as author',
    ])
    .where('sanction.player_id', '=', id)
    .orderBy('sanction.id', 'desc')
    .limit(30)
    .execute();
  const chat = await db
    .selectFrom('chat_message')
    .select(['id', 'region', 'body', 'created_at', 'deleted_at'])
    .where('author_id', '=', id)
    .orderBy('id', 'desc')
    .limit(15)
    .execute();
  const against = await db
    .selectFrom('report')
    .select((eb) => eb.fn.countAll<number>().as('n'))
    .where('target_id', '=', id)
    .executeTakeFirstOrThrow();
  const f = await sql<{ n: number }>`
    select coalesce(sum(filtered), 0)::int as n from chat_message
    where author_id = ${id} and created_at > ${new Date(now.getTime() - 24 * HOUR)}`.execute(db);
  return {
    id: p.id,
    pseudo: p.pseudo,
    role: p.role,
    status: p.status,
    createdAt: p.created_at,
    lastSeenAt: p.last_seen_at,
    active: await activeSanctions(db, id, now),
    history: history.map((h) => ({
      id: h.id,
      kind: h.kind,
      reason: h.reason,
      from: h.from_at,
      until: h.until_at,
      revoked: h.revoked_at,
      author: h.author,
    })),
    recentChat: chat.map((m) => ({ id: m.id, region: m.region, text: m.body, at: m.created_at, deleted: !!m.deleted_at })),
    reportsAgainst: Number(against.n),
    filteredDay: f.rows[0]?.n ?? 0,
  };
}

/** Journal d'administration, du plus récent au plus ancien. */
export async function adminLog(db: Db, limit = 50) {
  return db
    .selectFrom('admin_action')
    .leftJoin('player as pa', 'pa.id', 'admin_action.actor_id')
    .leftJoin('player as pt', 'pt.id', 'admin_action.target_id')
    .select([
      'admin_action.id',
      'admin_action.action',
      'admin_action.data',
      'admin_action.created_at',
      'pa.pseudo as actor',
      'pt.pseudo as target',
    ])
    .orderBy('admin_action.id', 'desc')
    .limit(limit)
    .execute();
}
