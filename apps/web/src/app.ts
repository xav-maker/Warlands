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
import { sql, type Db } from '@cr/db';
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
  type Mailer,
  type RateLimiter,
} from '@cr/domain';
import type { z } from 'zod';

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
}

const here = dirname(fileURLToPath(import.meta.url));
/** En dev, `src/` ; une fois empaqueté, `dist/` : les vues et fichiers publics sont copiés à côté. */
const root = join(here, '..');
const require = createRequire(import.meta.url);
const HTMX = readFileSync(require.resolve('htmx.org/dist/htmx.min.js'));

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
  const app = Fastify({
    logger: { level: deps.logLevel ?? 'info', redact: ['req.headers.cookie', 'req.headers["x-csrf-token"]', 'body.password'] },
    trustProxy: true,
    bodyLimit: 64 * 1024,
    genReqId: () => randomBytes(8).toString('hex'),
  });
  const limiter = deps.rateLimiter ?? memoryRateLimiter();
  const publish = deps.publish ?? (() => {});
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

  function ipLimit(req: FastifyRequest, name: string, perMinute: number) {
    if (!limiter.hit(`${name}:${req.ip}`, perMinute)) throw new GameError('RATE_LIMITED');
  }

  async function run<S extends z.ZodType, R>(req: FastifyRequest, def: CommandDef<S, R>, input: unknown): Promise<R> {
    const auth = requireAuth(req);
    const key = req.headers['idempotency-key'];
    return executeCommand({ db: deps.db, rateLimiter: limiter, publish }, def, {
      playerId: auth.player.id,
      input,
      idempotencyKey: typeof key === 'string' ? key : undefined,
    });
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
      return page(req, reply, 'message', { title: 'Oups', text, bad: true }, status);
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
    return reply.header('cache-control', 'no-store').send({ ok: true, version: deps.version ?? 'dev' });
  });

  // ---------- Pages publiques ----------
  app.get('/', (req, reply) => (req.auth ? reply.redirect('/ville') : page(req, reply, 'accueil')));

  app.get('/inscription', (req, reply) => (req.auth ? reply.redirect('/ville') : page(req, reply, 'inscription', { form: {} })));
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

  app.get('/connexion', (req, reply) => (req.auth ? reply.redirect('/ville') : page(req, reply, 'connexion', { form: {} })));
  app.post('/connexion', async (req, reply) => {
    ipLimit(req, 'login', 10);
    const b = (req.body ?? {}) as Record<string, string>;
    try {
      const s = await login(deps.db, { email: b.email, password: b.password }, { ip: req.ip, userAgent: req.headers['user-agent'] });
      reply.setCookie(SID, s.token, { ...cookieBase, expires: s.expiresAt });
      reply.clearCookie(PRE, { path: '/' });
      return reply.redirect('/ville', 303);
    } catch (e) {
      if (isGameError(e) && (e.code === 'BAD_CREDENTIALS' || e.code === 'ACCOUNT_SUSPENDED')) {
        return page(req, reply, 'connexion', { form: { email: b.email ?? '' }, error: messageFr(e.code) }, 422);
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
      link: { href: '/ville', label: 'Continuer' },
    });
  });
  app.post('/verifier/renvoyer', async (req, reply) => {
    const auth = requireAuth(req);
    ipLimit(req, 'resend', 3);
    await resendVerification(deps, auth.account.id);
    return reply.type('text/html; charset=utf-8').send(eta.render('partials/flash', { text: 'E-mail renvoyé.' }));
  });

  // ---------- Jeu (J0 : page vide de la ville de départ) ----------
  app.get('/ville', async (req, reply) => {
    const auth = requireAuth(req);
    const p = await deps.db.selectFrom('player').select(['dungeon_available']).where('id', '=', auth.player.id).executeTakeFirstOrThrow();
    return page(req, reply, 'ville', { dungeonAvailable: p.dungeon_available });
  });

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
