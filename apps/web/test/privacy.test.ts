/** Données personnelles par HTTP (guide 14) : export téléchargé depuis la page Compte, suppression du compte. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { startTestDb, type TestDb } from '@cr/testing';
import { memoryMailer, noRateLimit } from '@cr/domain';
import { buildApp } from '../src/app.ts';
import { loadGameContent } from '../src/content.ts';

const APP = 'http://localhost:3000';
let t: TestDb;
let app: FastifyInstance;

beforeAll(async () => {
  t = await startTestDb();
  app = await buildApp({
    db: t.db,
    mailer: memoryMailer(),
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
