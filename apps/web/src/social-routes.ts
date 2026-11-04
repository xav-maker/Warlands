/**
 * Pages et actions sociales (J6, README 25) : chat de région, messages privés, amis, blocages, signalements
 * et outils de modération. Formulaires classiques (POST puis redirection) : tout marche sans JavaScript ;
 * avec JavaScript, le flux SSE (`/events`) recharge le chat et les conversations à chaque message.
 */
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { GameError, isGameError, messageFr, ERROR_CODES, type ErrorCode } from '@cr/shared';
import type { AccountRole, Db } from '@cr/db';
import {
  CHAT_HISTORY,
  REPORT_REASONS,
  REPORT_REASON_FR,
  SANCTION_KIND_FR,
  acceptFriend,
  adminLog,
  applySanction,
  blockPlayer,
  canOpenLink,
  chatHistory,
  citables,
  closeReport,
  createReport,
  deleteChatMessage,
  directConversations,
  directThread,
  ensureStarted,
  ficheOf,
  friendsView,
  gameView,
  isStaff,
  liftSanction,
  forceRename,
  provisionalPseudo,
  onlineInRegion,
  parseLink,
  playerByPseudo,
  playerFile,
  readDirect,
  region,
  removeFriend,
  reportDetail,
  reportQueue,
  requestFriend,
  sayInRegion,
  sendDirect,
  unblockPlayer,
  untilText,
  type AuthContext,
  type CommandDef,
  type GameContent,
  type GameView,
} from '@cr/domain';
import type { z } from 'zod';
import { labels } from './game-routes.ts';

export interface SocialRouteDeps {
  db: Db;
  content: GameContent;
  page(req: FastifyRequest, reply: FastifyReply, view: string, data?: Record<string, unknown>, status?: number): FastifyReply;
  run<S extends z.ZodType, R>(req: FastifyRequest, def: CommandDef<S, R>, input: unknown): Promise<R>;
  requireAuth(req: FastifyRequest): AuthContext;
  /** Modération réservée aux comptes à double authentification (guide 13.4). */
  requireStaff2fa: boolean;
}

/** Retours autorisés après une action (jamais une URL fournie telle quelle). */
const BACK = new Set(['/chat', '/messages', '/amis', '/boutique']);
const body = (req: FastifyRequest): Record<string, string> => (req.body ?? {}) as Record<string, string>;
const int = (v: string | undefined): number => Number.parseInt(v ?? '', 10);
const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const here = (p: string): string => encodeURIComponent(p);

/** Message d'erreur d'une redirection `?e=CODE&d=…` (les détails, comme la fin d'une sourdine, voyagent avec). */
function errorOf(q: unknown): string | undefined {
  const { e, d } = q as Record<string, string | undefined>;
  if (!e || !(ERROR_CODES as readonly string[]).includes(e)) return undefined;
  let details: Record<string, string | number> | undefined;
  try {
    const parsed: unknown = d ? JSON.parse(d) : undefined;
    if (parsed && typeof parsed === 'object') {
      details = Object.fromEntries(Object.entries(parsed).filter(([, v]) => typeof v === 'string' || typeof v === 'number')) as Record<
        string,
        string | number
      >;
    }
  } catch {
    /* détails illisibles : message sans détails */
  }
  return messageFr(e as ErrorCode, details);
}

export function registerSocialRoutes(app: FastifyInstance, d: SocialRouteDeps): void {
  const L = labels(d.content);
  const regionName = (id: string): string => region(d.content, id).name;

  async function view(req: FastifyRequest): Promise<GameView> {
    const auth = d.requireAuth(req);
    await d.run(req, ensureStarted, {});
    return gameView(d.db, d.content, auth.player.id);
  }

  function staff(req: FastifyRequest): AuthContext {
    const a = d.requireAuth(req);
    if (!isStaff(a.account.role as AccountRole)) throw new GameError('NOT_MODERATOR');
    if (d.requireStaff2fa && !a.account.totp) throw new GameError('STAFF_2FA_REQUIRED');
    return a;
  }

  /** Exécute une action ; une erreur de jeu ramène à `back` avec son message (ou à la zone d'erreur sous htmx). */
  async function act(req: FastifyRequest, reply: FastifyReply, back: string, fn: () => Promise<string | void>): Promise<FastifyReply> {
    try {
      const to = await fn();
      if (req.headers['hx-request']) return reply.status(204).send();
      return reply.redirect(to ?? back, 303);
    } catch (e) {
      if (!isGameError(e) || e.code === 'NOT_AUTHENTICATED' || e.code === 'CSRF_INVALID' || req.headers['hx-request']) throw e;
      const sep = back.includes('?') ? '&' : '?';
      const det = e.details ? `&d=${encodeURIComponent(JSON.stringify(e.details))}` : '';
      return reply.redirect(`${back}${sep}e=${e.code}${det}`, 303);
    }
  }

  // Une action de modération exige la double authentification (le rôle est vérifié par la commande).
  app.addHook('preHandler', async (req) => {
    const a = req.auth;
    if (
      req.method === 'POST' &&
      req.url.startsWith('/moderation/') &&
      a &&
      isStaff(a.account.role as AccountRole) &&
      d.requireStaff2fa &&
      !a.account.totp
    )
      throw new GameError('STAFF_2FA_REQUIRED');
  });

  const backOf = (b: Record<string, string>, fallback: string): string => (BACK.has(b.back ?? '') ? b.back! : fallback);

  // ---------- Chat de région ----------
  app.get('/chat', async (req, reply) => {
    const v = await view(req);
    const me = d.requireAuth(req).player.id;
    const reg = v.region;
    return d.page(req, reply, 'chat', {
      title: 'Discussion',
      tab: 'chat',
      v,
      regionName: regionName(reg),
      log: await chatHistory(d.db, me, reg),
      cite: await citables(d.db, d.content, me),
      online: await onlineInRegion(d.db, reg),
      error: errorOf(req.query),
      historyMax: CHAT_HISTORY,
    });
  });

  /** Historique de la région (fragment rechargé par le flux temps réel). */
  app.get('/chat/messages', async (req, reply) => {
    const auth = d.requireAuth(req);
    const log = await chatHistory(d.db, auth.player.id, auth.player.pos_region);
    return d.page(req, reply, 'partials/chat-log', { log });
  });

  /** Lien choisi dans le sélecteur (« item:12 ») : aucun, ou une référence ; une valeur trafiquée est refusée. */
  const linksOf = (b: Record<string, string>): { kind: 'item' | 'troop' | 'listing'; id: number }[] => {
    if (!str(b.link)) return [];
    const l = parseLink(b.link);
    if (!l) throw new GameError('LINK_INVALID');
    return [l];
  };

  app.post('/chat', (req, reply) =>
    act(req, reply, '/chat', async () => void (await d.run(req, sayInRegion, { text: str(body(req).text), links: linksOf(body(req)) }))),
  );

  /** Fiche d'un bien cité : visible seulement si un message que le lecteur peut voir la cite (voir `canOpenLink`). */
  app.get('/fiche/:kind/:id', async (req, reply) => {
    const me = d.requireAuth(req).player.id;
    const { kind, id } = req.params as Record<string, string>;
    const link = parseLink(`${kind}:${id}`);
    const fiche = link && (await canOpenLink(d.db, me, link.kind, link.id)) ? await ficheOf(d.db, d.content, link.kind, link.id) : null;
    if (!link || !fiche) {
      return d.page(req, reply, 'message', { title: 'Fiche introuvable', text: messageFr('LINK_NOT_FOUND') }, 404);
    }
    const ref = req.headers.referer ?? '';
    const back = /\/messages\//.test(ref) ? '/messages' : '/chat';
    return d.page(req, reply, 'fiche', { title: 'Fiche', fiche, L, id: link.id, back });
  });

  // ---------- Messages privés ----------
  app.get('/messages', async (req, reply) => {
    const avec = str((req.query as Record<string, string | undefined>).avec).trim();
    if (avec) return reply.redirect(`/messages/${here(avec)}`, 303);
    const v = await view(req);
    const me = d.requireAuth(req).player.id;
    return d.page(req, reply, 'messages', {
      title: 'Messages',
      tab: 'messages',
      v,
      list: await directConversations(d.db, me),
      error: errorOf(req.query),
      with: null,
    });
  });

  async function threadData(req: FastifyRequest, pseudo: string) {
    const me = d.requireAuth(req).player.id;
    const other = await playerByPseudo(d.db, pseudo);
    await d.run(req, readDirect, { with: other.pseudo });
    const blocked = !!(await d.db
      .selectFrom('block')
      .select('blocker_id')
      .where('blocker_id', '=', me)
      .where('blocked_id', '=', other.id)
      .executeTakeFirst());
    return { other, blocked, lines: blocked ? [] : await directThread(d.db, me, other.id) };
  }

  app.get('/messages/:pseudo', async (req, reply) => {
    const v = await view(req);
    const me = d.requireAuth(req).player.id;
    let t;
    try {
      t = await threadData(req, str((req.params as Record<string, string>).pseudo));
    } catch (e) {
      if (isGameError(e) && e.code === 'PLAYER_NOT_FOUND') return reply.redirect('/messages?e=PLAYER_NOT_FOUND', 303);
      throw e;
    }
    return d.page(req, reply, 'messages', {
      title: `Messages · ${t.other.pseudo}`,
      tab: 'messages',
      v,
      list: await directConversations(d.db, me),
      error: errorOf(req.query),
      with: t.other,
      blocked: t.blocked,
      lines: t.lines,
      cite: await citables(d.db, d.content, me),
    });
  });

  /** Fil de discussion (fragment rechargé par le flux temps réel). */
  app.get('/messages/:pseudo/fil', async (req, reply) => {
    const t = await threadData(req, str((req.params as Record<string, string>).pseudo));
    return d.page(req, reply, 'partials/dm-log', { lines: t.lines, other: t.other });
  });

  app.post('/messages/envoyer', (req, reply) => {
    const b = body(req);
    return act(req, reply, `/messages/${here(str(b.to))}`, async () => {
      await d.run(req, sendDirect, { to: str(b.to), text: str(b.text), links: linksOf(b) });
    });
  });

  // ---------- Amis et blocages ----------
  app.get('/amis', async (req, reply) => {
    const v = await view(req);
    const me = d.requireAuth(req).player.id;
    return d.page(req, reply, 'amis', {
      title: 'Amis',
      tab: 'amis',
      v,
      f: await friendsView(d.db, me),
      error: errorOf(req.query),
      regionName,
    });
  });
  /** Listes d'amis (fragment rechargé par le flux temps réel). */
  app.get('/amis/liste', async (req, reply) =>
    d.page(req, reply, 'partials/friends-lists', { f: await friendsView(d.db, d.requireAuth(req).player.id), regionName }),
  );
  app.post('/amis/demander', (req, reply) =>
    act(req, reply, '/amis', async () => void (await d.run(req, requestFriend, { pseudo: str(body(req).pseudo) }))),
  );
  app.post('/amis/:id/accepter', (req, reply) =>
    act(req, reply, '/amis', async () => void (await d.run(req, acceptFriend, { player: int((req.params as Record<string, string>).id) }))),
  );
  app.post('/amis/:id/retirer', (req, reply) =>
    act(req, reply, '/amis', async () => void (await d.run(req, removeFriend, { player: int((req.params as Record<string, string>).id) }))),
  );
  app.post('/bloquer', (req, reply) => {
    const b = body(req);
    return act(req, reply, backOf(b, '/amis'), async () => void (await d.run(req, blockPlayer, { pseudo: str(b.pseudo) })));
  });
  app.post('/debloquer/:id', (req, reply) =>
    act(
      req,
      reply,
      '/amis',
      async () => void (await d.run(req, unblockPlayer, { player: int((req.params as Record<string, string>).id) })),
    ),
  );

  // ---------- Signalement ----------
  app.get('/signaler', async (req, reply) => {
    const v = await view(req);
    const q = req.query as Record<string, string | undefined>;
    const kind = q.kind ?? '';
    if (!['chat', 'dm', 'player', 'listing'].includes(kind)) return reply.redirect('/chat', 303);
    // Contenu visé, montré avant l'envoi : on signale ce qu'on a lu.
    const ref = int(q.ref);
    let target = '';
    let content = '';
    if (kind === 'chat' && ref) {
      const m = await d.db
        .selectFrom('chat_message')
        .innerJoin('player', 'player.id', 'chat_message.author_id')
        .select(['player.pseudo', 'chat_message.body'])
        .where('chat_message.id', '=', ref)
        .executeTakeFirst();
      target = m?.pseudo ?? '';
      content = m?.body ?? '';
    } else if (kind === 'dm' && ref) {
      const m = await d.db
        .selectFrom('direct_message')
        .innerJoin('player', 'player.id', 'direct_message.sender_id')
        .select(['player.pseudo', 'direct_message.body'])
        .where('direct_message.id', '=', ref)
        .where('direct_message.recipient_id', '=', d.requireAuth(req).player.id)
        .executeTakeFirst();
      target = m?.pseudo ?? '';
      content = m?.body ?? '';
    } else if (kind === 'listing' && ref) {
      const l = await d.db
        .selectFrom('shop_listing')
        .innerJoin('player', 'player.id', 'shop_listing.seller_id')
        .select(['player.pseudo', 'shop_listing.name', 'shop_listing.price', 'shop_listing.qty'])
        .where('shop_listing.id', '=', ref)
        .executeTakeFirst();
      target = l?.pseudo ?? '';
      content = l ? `${l.name} × ${l.qty}, ${l.price} or` : '';
    } else if (kind === 'player') target = str(q.pseudo);
    return d.page(req, reply, 'signaler', {
      title: 'Signaler',
      v,
      kind,
      ref: ref || '',
      target,
      content,
      reasons: REPORT_REASONS.map((r) => [r, REPORT_REASON_FR[r]]),
      error: errorOf(req.query),
      done: q.ok === '1',
    });
  });

  app.post('/signaler', (req, reply) => {
    const b = body(req);
    const back = `/signaler?kind=${encodeURIComponent(str(b.kind))}&ref=${encodeURIComponent(str(b.ref))}&pseudo=${encodeURIComponent(str(b.pseudo))}`;
    return act(req, reply, back, async () => {
      await d.run(req, createReport, {
        kind: str(b.kind),
        ...(int(b.ref) ? { ref: int(b.ref) } : {}),
        ...(b.pseudo ? { pseudo: b.pseudo } : {}),
        reason: str(b.reason),
        comment: str(b.comment),
      });
      return '/signaler?kind=player&ok=1';
    });
  });

  // ---------- Modération ----------
  app.get('/moderation', async (req, reply) => {
    const auth = staff(req);
    const v = await view(req);
    const closed = (req.query as Record<string, string | undefined>).etat === 'traites';
    return d.page(req, reply, 'moderation', {
      title: 'Modération',
      v,
      closed,
      list: await reportQueue(d.db, closed ? 'closed' : 'open'),
      role: auth.account.role,
      REASON: REPORT_REASON_FR,
      error: errorOf(req.query),
    });
  });

  app.get('/moderation/journal', async (req, reply) => {
    staff(req);
    const v = await view(req);
    return d.page(req, reply, 'moderation-journal', { title: 'Journal d’administration', v, log: await adminLog(d.db, 100) });
  });

  async function dossier(req: FastifyRequest, reply: FastifyReply, playerId: number, report: number | null) {
    const auth = staff(req);
    const v = await view(req);
    const file = await playerFile(d.db, playerId);
    if (!file) throw new GameError('PLAYER_NOT_FOUND');
    return d.page(req, reply, 'moderation-dossier', {
      title: `Dossier · ${file.pseudo}`,
      v,
      file,
      report: report ? await reportDetail(d.db, report) : null,
      role: auth.account.role,
      KIND: SANCTION_KIND_FR,
      REASON: REPORT_REASON_FR,
      untilText,
      provisional: provisionalPseudo(file.id),
      error: errorOf(req.query),
    });
  }

  app.get('/moderation/signalement/:id', async (req, reply) => {
    staff(req);
    const r = await reportDetail(d.db, int((req.params as Record<string, string>).id));
    if (!r) throw new GameError('REPORT_NOT_FOUND');
    return dossier(req, reply, r.targetId, r.id);
  });
  app.get('/moderation/joueur/:id', (req, reply) => {
    staff(req);
    return dossier(req, reply, int((req.params as Record<string, string>).id), null);
  });

  /** Retour des actions de modération : la page d'où l'on vient (jamais une URL libre). */
  const modBack = (b: Record<string, string>): string => {
    const m = /^\/moderation(\/(signalement|joueur)\/\d+)?$/.exec(b.back ?? '');
    return m ? b.back! : '/moderation';
  };

  app.post('/moderation/sanction', (req, reply) => {
    const b = body(req);
    return act(req, reply, modBack(b), async () => {
      await d.run(req, applySanction, {
        player: int(b.player),
        kind: str(b.kind),
        ...(int(b.hours) ? { hours: int(b.hours) } : {}),
        reason: str(b.reason),
        ...(int(b.report) ? { report: int(b.report) } : {}),
      });
      return b.report ? '/moderation' : modBack(b);
    });
  });
  app.post('/moderation/lever', (req, reply) =>
    act(req, reply, modBack(body(req)), async () => void (await d.run(req, liftSanction, { sanction: int(body(req).sanction) }))),
  );
  app.post('/moderation/cloturer', (req, reply) =>
    act(req, reply, modBack(body(req)), async () => {
      await d.run(req, closeReport, { report: int(body(req).report), decision: str(body(req).decision) });
      return '/moderation';
    }),
  );
  app.post('/moderation/renommer', (req, reply) => {
    const b = body(req);
    return act(req, reply, modBack(b), async () => {
      await d.run(req, forceRename, {
        player: int(b.player),
        ...(b.pseudo?.trim() ? { pseudo: b.pseudo } : {}),
        reason: str(b.reason),
        ...(int(b.report) ? { report: int(b.report) } : {}),
      });
      return b.report ? '/moderation' : modBack(b);
    });
  });
  app.post('/moderation/supprimer-message', (req, reply) =>
    act(req, reply, modBack(body(req)), async () => void (await d.run(req, deleteChatMessage, { message: int(body(req).message) }))),
  );
}
