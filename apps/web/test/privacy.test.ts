/** Données personnelles par HTTP (guide 14) : export téléchargé depuis la page Compte, suppression du compte. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { startTestDb, type TestDb } from '@cr/testing';
import { memoryMailer, noRateLimit } from '@cr/domain';
import { buildApp } from '../src/app.ts';
import { loadGameContent } from '../src/content.ts';

const APP = 'http://localhost:3000';
const mailer = memoryMailer();
let t: TestDb;
let app: FastifyInstance;

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

const jar = new Map<string, string>();
let csrf = '';
async function req(method: 'GET' | 'POST', url: string, form?: Record<string, string>) {
  const res = await app.inject({
    method,
    url,
    headers: {
      cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; '),
      origin: APP,
      ...(form ? { 'content-type': 'application/x-www-form-urlencoded' } : {}),
    },
    ...(form ? { payload: new URLSearchParams({ _csrf: csrf, ...form }).toString() } : {}),
  });
  for (const c of res.cookies) jar.set(c.name, c.value);
  const m = /name="_csrf" value="([^"]+)"/.exec(res.body);
  if (m) csrf = m[1]!;
  return res;
}

describe('données personnelles', () => {
  it('télécharge l’export, puis supprime le compte', async () => {
    await req('GET', '/inscription');
    await req('POST', '/inscription', { email: 'rgpd@example.org', pseudo: 'Prudence', password: 'motdepasse-long', acceptTos: 'on' });
    await req('GET', '/connexion');
    await req('POST', '/connexion', { email: 'rgpd@example.org', password: 'motdepasse-long' });
    const page = await req('GET', '/compte');
    expect(page.body).toContain('Télécharger mes données (JSON)');

    const exp = await req('GET', '/compte/donnees.json');
    expect(exp.headers['content-disposition']).toContain('attachment');
    expect(exp.headers['content-type']).toContain('application/json');
    expect(JSON.parse(exp.body)).toMatchObject({ account: { email: 'rgpd@example.org' }, player: { pseudo: 'Prudence' } });

    await req('GET', '/compte');
    const bad = await req('POST', '/compte/supprimer', { password: 'pas-le-bon', confirm: 'SUPPRIMER' });
    expect(bad.headers.location).toBe('/compte?e=BAD_CREDENTIALS');
    const ok = await req('POST', '/compte/supprimer', { password: 'motdepasse-long', confirm: 'SUPPRIMER' });
    expect(ok.headers.location).toBe('/compte/supprime');
    expect((await req('GET', '/compte/supprime')).body).toContain('Votre compte est supprimé');
    expect((await req('GET', '/jeu')).headers.location).toBe('/connexion');
    expect((await req('GET', '/compte/donnees.json')).headers.location).toBe('/connexion');
  });
});

describe('mot de passe oublié', () => {
  it('envoie le lien, accepte un nouveau mot de passe, puis refuse le lien', async () => {
    jar.clear();
    await req('GET', '/inscription');
    await req('POST', '/inscription', { email: 'distrait@example.org', pseudo: 'Distrait', password: 'motdepasse-long', acceptTos: 'on' });
    const conn = await req('GET', '/connexion');
    expect(conn.body).toContain('href="/mot-de-passe-oublie"');
    await req('GET', '/mot-de-passe-oublie');
    const asked = await req('POST', '/mot-de-passe-oublie', { email: 'distrait@example.org' });
    expect(asked.body).toContain('Si cette adresse correspond à un compte');
    const link = /http:\/\/localhost:3000(\/mot-de-passe\/nouveau\?t=[^\s]+)/.exec(mailer.sent.at(-1)!.text)![1]!;
    const form = await req('GET', link);
    expect(form.body).toContain('Nouveau mot de passe');
    const token = decodeURIComponent(link.split('t=')[1]!);
    expect((await req('POST', '/mot-de-passe/nouveau', { t: token, password: 'court' })).body).toContain('10 caractères');
    expect((await req('POST', '/mot-de-passe/nouveau', { t: token, password: 'tout-nouveau-secret' })).body).toContain(
      'Mot de passe changé',
    );
    expect((await req('GET', link)).statusCode).toBe(410);
    await req('GET', '/connexion');
    expect((await req('POST', '/connexion', { email: 'distrait@example.org', password: 'tout-nouveau-secret' })).headers.location).toBe(
      '/jeu',
    );
  });
});
