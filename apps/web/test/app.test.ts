import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { startTestDb, type TestDb } from '@cr/testing';
import { memoryMailer, noRateLimit } from '@cr/domain';
import { buildApp } from '../src/app.ts';
import { loadGameContent } from '../src/content.ts';

const APP = 'http://localhost:3000';
let t: TestDb;
let app: FastifyInstance;
const mailer = memoryMailer();

beforeAll(async () => {
  t = await startTestDb();
  app = await buildApp({
    db: t.db,
    mailer,
    appUrl: APP,
    cookieSecure: false,
    logLevel: 'silent',
    rateLimiter: noRateLimit,
    content: loadGameContent(),
  });
});
afterAll(async () => {
  await app?.close();
  await t?.stop();
});

/** Petit navigateur : garde les cookies et lit le jeton CSRF de la dernière page. */
function browser() {
  const jar = new Map<string, string>();
  let csrf = '';
  const cookieHeader = () => [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
  async function req(method: 'GET' | 'POST', url: string, form?: Record<string, string>, headers: Record<string, string> = {}) {
    const res = await app.inject({
      method,
      url,
      headers: {
        cookie: cookieHeader(),
        origin: APP,
        ...(form ? { 'content-type': 'application/x-www-form-urlencoded' } : {}),
        ...headers,
      },
      ...(form ? { payload: new URLSearchParams(form).toString() } : {}),
    });
    for (const c of res.cookies) {
      if (c.value === '' || (c.expires && new Date(c.expires) < new Date())) jar.delete(c.name);
      else jar.set(c.name, c.value);
    }
    const m = /name="_csrf" value="([^"]+)"/.exec(res.body) ?? /x-csrf-token&quot;:&quot;([^&]+)&quot;/.exec(res.body);
    if (m) csrf = m[1]!;
    return res;
  }
  return {
    req,
    jar,
    get csrf() {
      return csrf;
    },
  };
}

describe('parcours J0', () => {
  const b = browser();

  it('affiche l’accueil et les en-têtes de sécurité', async () => {
    const r = await b.req('GET', '/');
    expect(r.statusCode).toBe(200);
    expect(r.body).toContain('Les Cinq Régions');
    expect(r.headers['content-security-policy']).toContain("default-src 'self'");
    expect(r.headers['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(r.headers['x-content-type-options']).toBe('nosniff');
  });

  it('refuse un formulaire sans jeton CSRF ou venant d’un autre site', async () => {
    await b.req('GET', '/inscription');
    const noToken = await b.req('POST', '/inscription', {
      email: 'x@example.org',
      pseudo: 'Xavier',
      password: 'motdepasse-long',
      acceptTos: 'on',
    });
    expect(noToken.statusCode).toBe(403);
    const foreign = await b.req(
      'POST',
      '/inscription',
      { _csrf: b.csrf, email: 'x@example.org', pseudo: 'Xavier', password: 'motdepasse-long', acceptTos: 'on' },
      { origin: 'https://evil.example' },
    );
    expect(foreign.statusCode).toBe(403);
  });

  it('inscrit, affiche une erreur lisible, puis réussit', async () => {
    await b.req('GET', '/inscription');
    const bad = await b.req('POST', '/inscription', {
      _csrf: b.csrf,
      email: 'x@example.org',
      pseudo: 'X',
      password: 'motdepasse-long',
      acceptTos: 'on',
    });
    expect(bad.statusCode).toBe(422);
    expect(bad.body).toContain('3 à 20 caractères');
    expect(bad.body).toContain('value="x@example.org"'); // le formulaire garde la saisie

    const ok = await b.req('POST', '/inscription', {
      _csrf: b.csrf,
      email: 'x@example.org',
      pseudo: 'Xavier',
      password: 'motdepasse-long',
      acceptTos: 'on',
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.body).toContain('Vérifiez votre boîte mail');
    expect(mailer.sent.at(-1)?.to).toBe('x@example.org');
  });

  it('échappe le HTML venant du joueur', async () => {
    await b.req('GET', '/inscription');
    const r = await b.req('POST', '/inscription', {
      _csrf: b.csrf,
      email: '<script>@x',
      pseudo: 'Zed',
      password: 'motdepasse-long',
      acceptTos: 'on',
    });
    expect(r.body).not.toContain('<script>@x');
    expect(r.body).toContain('&lt;script&gt;@x');
  });

  it('protège /ville, connecte, puis montre la ville', async () => {
    const anon = await b.req('GET', '/ville');
    expect(anon.statusCode).toBe(302);
    expect(anon.headers.location).toBe('/connexion');

    await b.req('GET', '/connexion');
    const wrong = await b.req('POST', '/connexion', { _csrf: b.csrf, email: 'x@example.org', password: 'pas-le-bon' });
    expect(wrong.statusCode).toBe(422);
    expect(wrong.body).toContain('E-mail ou mot de passe incorrect.');

    const ok = await b.req('POST', '/connexion', { _csrf: b.csrf, email: 'x@example.org', password: 'motdepasse-long' });
    expect(ok.statusCode).toBe(303);
    expect(ok.headers.location).toBe('/jeu');
    const cookie = ok.cookies.find((c) => c.name === 'sid')!;
    expect(cookie.httpOnly).toBe(true);
    expect(cookie.sameSite).toBe('Lax');

    const city = await b.req('GET', '/ville');
    expect(city.statusCode).toBe(200);
    expect(city.body).toContain('Havre-Gris');
    expect(city.body).toContain('Xavier');
    expect(city.body).toContain('pas encore vérifiée');
  });

  it('exécute une commande htmx avec le jeton de session', async () => {
    const refused = await b.req('POST', '/joueur/donjon-disponible', { available: 'true' }, { 'hx-request': 'true' });
    expect(refused.headers['hx-retarget']).toBe('#flash');
    expect(refused.body).toContain('La page a expiré');

    const r = await b.req('POST', '/joueur/donjon-disponible', { available: 'true' }, { 'hx-request': 'true', 'x-csrf-token': b.csrf });
    expect(r.statusCode).toBe(200);
    expect(r.body).toContain('<b>oui</b>');
  });

  it('vérifie l’adresse par le lien reçu', async () => {
    const link = mailer.sent.find((m) => m.to === 'x@example.org' && m.subject.includes('vérifiez'))!.text;
    const path = /http:\/\/localhost:3000(\/verifier\?t=\S+)/.exec(link)![1]!;
    expect((await b.req('GET', path)).body).toContain('Adresse vérifiée');
    expect((await b.req('GET', '/ville')).body).not.toContain('pas encore vérifiée');
    expect((await b.req('GET', path)).statusCode).toBe(422);
  });

  it('déconnecte', async () => {
    const r = await b.req('POST', '/deconnexion', { _csrf: b.csrf });
    expect(r.statusCode).toBe(303);
    expect((await b.req('GET', '/ville')).statusCode).toBe(302);
  });

  it('répond à /health et sert htmx', async () => {
    expect((await app.inject('/health')).json()).toMatchObject({ ok: true, version: 'dev', maintenance: false });
    const js = await app.inject('/static/htmx.min.js');
    expect(js.statusCode).toBe(200);
    expect(js.headers['content-type']).toContain('javascript');
  });
});

describe('mode maintenance (guide 17.5)', () => {
  it('répond une page d’attente partout, sauf la sonde de santé et les fichiers statiques', async () => {
    const m = await buildApp({
      db: t.db,
      mailer,
      appUrl: APP,
      cookieSecure: false,
      logLevel: 'silent',
      rateLimiter: noRateLimit,
      maintenance: true,
    });
    try {
      for (const url of ['/', '/connexion', '/jeu', '/moderation']) {
        const r = await m.inject(url);
        expect(r.statusCode, url).toBe(503);
        expect(r.headers['retry-after']).toBe('600');
        expect(r.body).toContain('en maintenance');
      }
      expect((await m.inject({ method: 'POST', url: '/connexion', payload: 'email=a' })).statusCode).toBe(503);
      expect((await m.inject('/health')).json()).toMatchObject({ ok: true, maintenance: true });
      expect((await m.inject('/static/htmx.min.js')).statusCode).toBe(200);
    } finally {
      await m.close();
    }
  });
});

describe('connexion bloquée après des échecs (guide 13.1)', () => {
  it('affiche le blocage sur la page de connexion, en 429', async () => {
    const b = browser();
    await b.req('GET', '/connexion');
    for (let i = 0; i < 5; i++) await b.req('POST', '/connexion', { _csrf: b.csrf, email: 'bloque@example.org', password: 'mauvais' });
    const r = await b.req('POST', '/connexion', { _csrf: b.csrf, email: 'bloque@example.org', password: 'mauvais' });
    expect(r.statusCode).toBe(429);
    expect(r.body).toContain('Trop de tentatives de connexion : réessayez dans 15 minutes.');
  });
});

describe('adresse IP du client (guide 13.1)', () => {
  it('prend l’adresse ajoutée par le proxy de confiance, pas celle qu’envoie le client', async () => {
    const seen: string[] = [];
    const m = await buildApp({ db: t.db, mailer, appUrl: APP, cookieSecure: false, logLevel: 'silent', rateLimiter: noRateLimit });
    m.get('/__ip', (req) => (seen.push(req.ip), ''));
    try {
      // Le client se dit 1.2.3.4 ; le répartiteur ajoute la vraie adresse, 198.51.100.20.
      await m.inject({ url: '/__ip', headers: { 'x-forwarded-for': '1.2.3.4, 198.51.100.20' }, remoteAddress: '10.0.0.1' });
      expect(seen).toEqual(['198.51.100.20']);
    } finally {
      await m.close();
    }
  });

  it('lit d’abord l’en-tête du proxy de bord (Cloudflare devant Render) pour les limites par IP', async () => {
    const { memoryRateLimiter } = await import('@cr/domain');
    const m = await buildApp({ db: t.db, mailer, appUrl: APP, cookieSecure: false, logLevel: 'silent', rateLimiter: memoryRateLimiter() });
    try {
      // Jeton CSRF de pré-session (formulaires anonymes).
      const form = await m.inject('/inscription');
      const token = /name="_csrf" value="([^"]+)"/.exec(form.body)![1]!;
      const cookie = form.cookies.map((c) => `${c.name}=${c.value}`).join('; ');
      const signup = (ip: string, spoof: string) =>
        m.inject({
          method: 'POST',
          url: '/inscription',
          headers: {
            'cf-connecting-ip': ip,
            'x-forwarded-for': spoof,
            origin: APP,
            cookie,
            'content-type': 'application/x-www-form-urlencoded',
          },
          payload: new URLSearchParams({ _csrf: token }).toString(),
        });
      // Le même client qui change de X-Forwarded-For reste limité (5 inscriptions par minute et par IP)…
      const codes = [];
      for (let i = 0; i < 6; i++) codes.push((await signup('203.0.113.50', `10.0.0.${i}`)).statusCode);
      expect(codes.at(-1)).toBe(429);
      // … et un autre client ne l'est pas.
      expect((await signup('203.0.113.51', '10.0.0.1')).statusCode).not.toBe(429);
    } finally {
      await m.close();
    }
  });
});
