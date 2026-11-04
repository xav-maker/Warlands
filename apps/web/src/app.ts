import { randomBytes, timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import cookie from '@fastify/cookie';
import formbody from '@fastify/formbody';
import helmet from '@fastify/helmet';
import fastifyStatic from '@fastify/static';
import { Eta } from 'eta';
import { isGameError, messageFr, GameError } from '@cr/shared';
import { sql, type Bus, type Db } from '@cr/db';
import {
  executeCommand,
  getAuth,
  login,
  logout,
  memoryRateLimiter,
  resendVerification,
  setDungeonAvailable,
  signup,
  verifyEmail,
  PASSWORD_MIN,
  type AuthContext,
  type CommandDef,
  type DomainEvent,
  type GameContent,
  type Mailer,
  type RateLimiter,
} from '@cr/domain';
import type { z } from 'zod';
import { registerEvents } from './events.ts';
import { registerGameRoutes } from './game-routes.ts';
import { registerSocialRoutes } from './social-routes.ts';

declare module 'fastify' {
  interface FastifyRequest {
    auth: AuthContext | null;
  }
}

export interface AppDeps {
  db: Db;
  mailer: Mailer;
  appUrl: string;
  cookieSecure: boolean;
  logLevel?: string;
  /** Version déployée (SHA du commit), renvoyée par /health pour vérifier un déploiement. */
  version?: string;
  rateLimiter?: RateLimiter;
  publish?: (events: DomainEvent[]) => void;
  /** Bus temps réel (J6) : publication des événements et flux SSE `/events` ; sans lui, pas de temps réel. */
  bus?: Bus;
  /** Intervalle du battement de cœur SSE (25 s ; réduit dans les tests). */
  heartbeatMs?: number;
  /** Contenu actif ; sans lui, les pages de jeu ne sont pas servies (tests du socle). */
  content?: GameContent;
  /** Outils de test sur la page Compte (ENABLE_TEST_TOOLS, préproduction). */
  testTools?: boolean;
  /** Aléa des tirages de jeu (tests) ; par défaut crypto.randomInt. */
  random?: (max: number) => number;
  /** Exiger une adresse e-mail vérifiée pour le chat, les messages, les amis et les boutiques (REQUIRE_VERIFIED_EMAIL). */
  requireVerifiedEmail?: boolean;
  /** Exiger la double authentification du personnel de modération (REQUIRE_STAFF_2FA ; faux par défaut, pour les tests). */
  requireStaff2fa?: boolean;
  /** Mode maintenance (MAINTENANCE, guide 17.5) : une page d'attente pour toutes les routes, sauf /health et /static. */
  maintenance?: boolean;
  /**
   * Proxys de confiance devant l'application (TRUST_PROXY_HOPS ; 1 par défaut : le répartiteur de l'hébergeur). L'IP du
   * client est la dernière adresse ajoutée à X-Forwarded-For par ces proxys : un client ne peut pas en choisir une autre
   * pour contourner les limites par IP.
   */
  trustProxyHops?: number;
  /**
   * En-tête posé par le proxy de bord qui donne l'IP du client (CLIENT_IP_HEADER ; par défaut cf-connecting-ip : Render
   * est derrière Cloudflare, qui écrit cet en-tête et ajoute à X-Forwarded-For au lieu de le remplacer). Chaîne vide :
   * X-Forwarded-For seul, avec trustProxyHops.
   */
  clientIpHeader?: string;
}

const here = dirname(fileURLToPath(import.meta.url));
/** En dev, `src/` ; une fois empaqueté, `dist/` : les vues et fichiers publics sont copiés à côté. */
const root = join(here, '..');
const require = createRequire(import.meta.url);
const HTMX = readFileSync(require.resolve('htmx.org/dist/htmx.min.js'));

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
  // Les `hops` premiers pairs (le répartiteur) sont de confiance : l'IP du client est l'adresse qu'ils ont ajoutée.
  const hops = deps.trustProxyHops ?? 1;
  const app = Fastify({
    logger: { level: deps.logLevel ?? 'info', redact: ['req.headers.cookie', 'req.headers["x-csrf-token"]', 'body.password'] },
    trustProxy: (_addr: string, hop: number) => hop < hops,
    bodyLimit: 64 * 1024,
    genReqId: () => randomBytes(8).toString('hex'),
  });
  const limiter = deps.rateLimiter ?? memoryRateLimiter();
  const publish = deps.publish ?? (deps.bus ? (events: DomainEvent[]) => deps.bus!.publish(events) : () => {});
  const SID = deps.cookieSecure ? '__Host-sid' : 'sid';
  const PRE = deps.cookieSecure ? '__Host-csrf' : 'csrf';
  const cookieBase = { path: '/', httpOnly: true, secure: deps.cookieSecure, sameSite: 'lax' as const };
  const eta = new Eta({ views: join(root, 'views'), cache: process.env.NODE_ENV === 'production', autoEscape: true });

  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        // Attributs style (largeur des jauges) : seuls autorisés en ligne ; feuilles et <style> restent 'self'.
        styleSrcAttr: ["'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
        fontSrc: ["'self'"],
        connectSrc: ["'self'"],
        frameAncestors: ["'none'"],
        formAction: ["'self'"],
        baseUri: ["'none'"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: deps.cookieSecure ? [] : null,
      },
    },
    hsts: deps.cookieSecure ? { maxAge: 31_536_000, includeSubDomains: true } : false,
    referrerPolicy: { policy: 'same-origin' },
  });
  await app.register(cookie);
  await app.register(formbody);
  await app.register(fastifyStatic, { root: join(root, 'public'), prefix: '/static/', maxAge: '1d' });
  app.get('/static/htmx.min.js', (_req, reply) =>
    reply.type('text/javascript').header('cache-control', 'public, max-age=604800').send(HTMX),
  );

  app.decorateRequest('auth', null);

  // Maintenance (guide 17.5) : avant toute session ou commande, une page d'attente ; la sonde de santé répond toujours.
  if (deps.maintenance)
    app.addHook('onRequest', async (req, reply) => {
      if (req.url === '/health' || req.url.startsWith('/static/')) return;
      return reply
        .status(503)
        .header('retry-after', '600')
        .header('cache-control', 'no-store')
        .type('text/html; charset=utf-8')
        .send(
          eta.render('message', {
            title: 'Maintenance',
            text: 'Le jeu est en maintenance pour quelques minutes. Votre partie est en sécurité : revenez bientôt.',
            auth: null,
            csrf: '',
          }),
        );
    });

  // Session, puis protection CSRF : en-tête Origin + jeton (de session, ou cookie de pré-session pour les formulaires anonymes).
  app.addHook('preHandler', async (req, reply) => {
    req.auth = await getAuth(deps.db, req.cookies[SID]);
    if (!MUTATING.has(req.method)) return;
    const origin = req.headers.origin;
    if (origin && origin !== deps.appUrl) throw new GameError('CSRF_INVALID');
    if (!origin && req.headers['sec-fetch-site'] && req.headers['sec-fetch-site'] !== 'same-origin') throw new GameError('CSRF_INVALID');
    const sent = (req.headers['x-csrf-token'] as string | undefined) ?? (req.body as Record<string, unknown> | undefined)?._csrf;
    const expected = req.auth?.session.csrf_token ?? req.cookies[PRE];
    if (typeof sent !== 'string' || !expected || !safeEqual(sent, expected)) throw new GameError('CSRF_INVALID');
    void reply;
  });

  /** Jeton à mettre dans les formulaires : celui de la session, ou un jeton de pré-session posé en cookie. */
  function csrfFor(req: FastifyRequest, reply: FastifyReply): string {
    if (req.auth) return req.auth.session.csrf_token;
    let t = req.cookies[PRE];
    if (!t) {
      t = randomBytes(24).toString('base64url');
      reply.setCookie(PRE, t, { ...cookieBase, maxAge: 3600 * 12 });
    }
    return t;
  }

  function page(req: FastifyRequest, reply: FastifyReply, view: string, data: Record<string, unknown> = {}, status = 200) {
    const html = eta.render(view, { ...data, auth: req.auth, csrf: csrfFor(req, reply), passwordMin: PASSWORD_MIN });
    return reply.status(status).type('text/html; charset=utf-8').header('cache-control', 'no-store').send(html);
  }

  function requireAuth(req: FastifyRequest): AuthContext {
    if (!req.auth) throw new GameError('NOT_AUTHENTICATED');
    return req.auth;
  }

  function limit(key: string, perMinute: number) {
    if (!limiter.hit(key, perMinute)) throw new GameError('RATE_LIMITED');
  }

  /** IP du client (limites, garde-fou des connexions, sessions) : l'en-tête du proxy de bord, sinon X-Forwarded-For. */
  const ipHeader = (deps.clientIpHeader ?? 'cf-connecting-ip').toLowerCase();
  function clientIp(req: FastifyRequest): string {
    const h = ipHeader ? req.headers[ipHeader] : undefined;
    const v = (Array.isArray(h) ? h[0] : h)?.trim();
    return v && v.length <= 45 && /^[0-9a-f.:]+$/i.test(v) ? v : req.ip;
  }

  function ipLimit(req: FastifyRequest, name: string, perMinute: number) {
    if (!limiter.hit(`${name}:${clientIp(req)}`, perMinute)) throw new GameError('RATE_LIMITED');
  }

  async function run<S extends z.ZodType, R>(req: FastifyRequest, def: CommandDef<S, R>, input: unknown): Promise<R> {
    const auth = requireAuth(req);
    const key = req.headers['idempotency-key'];
    return executeCommand(
      {
        db: deps.db,
        rateLimiter: limiter,
        publish,
        ...(deps.content ? { content: deps.content } : {}),
        ...(deps.random ? { random: deps.random } : {}),
        requireVerifiedEmail: !!deps.requireVerifiedEmail,
      },
      def,
      {
        playerId: auth.player.id,
        input,
        idempotencyKey: typeof key === 'string' ? key : undefined,
      },
    );
  }

  app.setErrorHandler((err, req, reply) => {
    if (isGameError(err)) {
      if (err.code === 'NOT_AUTHENTICATED' && !req.headers['hx-request']) return reply.redirect('/connexion');
      const status = err.code === 'RATE_LIMITED' ? 429 : err.code === 'CSRF_INVALID' ? 403 : err.code === 'NOT_AUTHENTICATED' ? 401 : 422;
      const text = messageFr(err.code, err.details);
      if (req.headers['hx-request']) {
        // htmx n'insère pas les réponses en erreur par défaut : on cible la zone d'erreur et on force l'insertion.
        return reply
          .status(200)
          .header('hx-retarget', '#flash')
          .header('hx-reswap', 'innerHTML')
          .type('text/html; charset=utf-8')
          .send(eta.render('partials/flash', { text, bad: true }));
      }
      const link =
        err.code === 'STAFF_2FA_REQUIRED' ? { href: '/compte#deux-facteurs', label: 'Activer la double authentification' } : undefined;
      return page(req, reply, 'message', { title: 'Oups', text, bad: true, ...(link ? { link } : {}) }, status);
    }
    const status = (err as { statusCode?: number }).statusCode;
    if (status && status >= 400 && status < 500) {
      return page(req, reply, 'message', { title: 'Requête invalide', text: 'La demande n’a pas pu être traitée.', bad: true }, status);
    }
    req.log.error({ err }, 'erreur non gérée');
    return page(req, reply, 'message', { title: 'Erreur', text: 'Une erreur est survenue. Réessayez dans un instant.', bad: true }, 500);
  });

  app.setNotFoundHandler((req, reply) => page(req, reply, 'message', { title: 'Page introuvable', text: 'Cette page n’existe pas.' }, 404));

  // ---------- Santé ----------
  app.get('/health', async (_req, reply) => {
    await sql`select 1`.execute(deps.db);
    // Contrôle de santé (guide 17.5) : base joignable et pack de contenu chargé.
    return reply
      .header('cache-control', 'no-store')
      .send({ ok: true, version: deps.version ?? 'dev', content: deps.content?.hash ?? null, maintenance: !!deps.maintenance });
  });

  // ---------- Pages publiques ----------
  app.get('/', (req, reply) => (req.auth ? reply.redirect('/jeu') : page(req, reply, 'accueil')));

  app.get('/inscription', (req, reply) => (req.auth ? reply.redirect('/jeu') : page(req, reply, 'inscription', { form: {} })));
  app.post('/inscription', async (req, reply) => {
    ipLimit(req, 'signup', 5);
    const b = (req.body ?? {}) as Record<string, string>;
    const form = { email: b.email ?? '', pseudo: b.pseudo ?? '' };
    try {
      await signup(deps, { email: b.email, pseudo: b.pseudo, password: b.password, acceptTos: b.acceptTos === 'on' });
    } catch (e) {
      if (isGameError(e) && e.code !== 'RATE_LIMITED')
        return page(req, reply, 'inscription', { form, error: messageFr(e.code, e.details) }, 422);
      throw e;
    }
    return page(req, reply, 'message', {
      title: 'Vérifiez votre boîte mail',
      text: `Si l’adresse ${form.email} peut être utilisée, un e-mail vient d’y être envoyé. Vous pouvez déjà vous connecter.`,
      link: { href: '/connexion', label: 'Se connecter' },
    });
  });

  app.get('/connexion', (req, reply) => (req.auth ? reply.redirect('/jeu') : page(req, reply, 'connexion', { form: {} })));
  app.post('/connexion', async (req, reply) => {
    ipLimit(req, 'login', 10);
    const b = (req.body ?? {}) as Record<string, string>;
    try {
      const s = await login(
        deps.db,
        { email: b.email, password: b.password, code: b.code || undefined },
        { ip: clientIp(req), userAgent: req.headers['user-agent'] },
      );
      reply.setCookie(SID, s.token, { ...cookieBase, expires: s.expiresAt });
      reply.clearCookie(PRE, { path: '/' });
      return reply.redirect('/jeu', 303);
    } catch (e) {
      if (isGameError(e) && ['BAD_CREDENTIALS', 'ACCOUNT_SUSPENDED', 'TOTP_REQUIRED', 'TOTP_INVALID', 'LOGIN_THROTTLED'].includes(e.code)) {
        const totp = e.code === 'TOTP_REQUIRED' || e.code === 'TOTP_INVALID';
        return page(
          req,
          reply,
          'connexion',
          { form: { email: b.email ?? '' }, totp, error: messageFr(e.code, e.details) },
          e.code === 'LOGIN_THROTTLED' ? 429 : 422,
        );
      }
      throw e;
    }
  });

  app.post('/deconnexion', async (req, reply) => {
    await logout(deps.db, req.cookies[SID]);
    reply.clearCookie(SID, { path: '/' });
    return reply.redirect('/', 303);
  });

  app.get('/verifier', async (req, reply) => {
    const t = (req.query as Record<string, string | undefined>).t ?? '';
    await verifyEmail(deps.db, t);
    return page(req, reply, 'message', {
      title: 'Adresse vérifiée',
      text: 'Merci, votre adresse e-mail est confirmée.',
      link: { href: '/jeu', label: 'Continuer' },
    });
  });
  app.post('/verifier/renvoyer', async (req, reply) => {
    const auth = requireAuth(req);
    ipLimit(req, 'resend', 3);
    await resendVerification(deps, auth.account.id);
    return reply.type('text/html; charset=utf-8').send(eta.render('partials/flash', { text: 'E-mail renvoyé.' }));
  });

  // ---------- Temps réel ----------
  if (deps.bus)
    registerEvents(app, {
      db: deps.db,
      bus: deps.bus,
      token: (req) => req.cookies[SID],
      ...(deps.heartbeatMs ? { heartbeatMs: deps.heartbeatMs } : {}),
    });

  // ---------- Jeu ----------
  if (deps.content) {
    registerGameRoutes(app, { db: deps.db, content: deps.content, page, run, requireAuth, testTools: deps.testTools ?? false, limit });
    registerSocialRoutes(app, {
      db: deps.db,
      content: deps.content,
      page,
      run,
      requireAuth,
      requireStaff2fa: deps.requireStaff2fa ?? false,
    });
  }

  app.post('/joueur/donjon-disponible', async (req, reply) => {
    const b = (req.body ?? {}) as Record<string, string>;
    const r = await run(req, setDungeonAvailable, { available: b.available === 'true' });
    return reply
      .type('text/html; charset=utf-8')
      .send(eta.render('partials/dispo', { dungeonAvailable: r.available, csrf: req.auth!.session.csrf_token }));
  });

  return app;
}

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
