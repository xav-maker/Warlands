/** Premiers pas par HTTP : les étapes dans la ville, le guide, masquer. */
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

describe('premiers pas', () => {
  it('montre les étapes dans la ville, le guide complet, et se masque', async () => {
    jar.clear();
    await req('GET', '/inscription');
    await req('POST', '/inscription', { email: 'novice@example.org', pseudo: 'Novice', password: 'motdepasse-long', acceptTos: 'on' });
    await req('GET', '/connexion');
    await req('POST', '/connexion', { email: 'novice@example.org', password: 'motdepasse-long' });
    const city = await req('GET', '/ville');
    expect(city.body).toContain('Premiers pas');
    expect(city.body).toContain('0 / 6');
    expect(city.body).toContain('Gagner un premier combat');
    expect(city.body).toContain('href="/tutoriel"');
    const guide = await req('GET', '/tutoriel');
    for (const id of ['combat', 'butin', 'acheter', 'fabriquer', 'recruter', 'mort']) expect(guide.body).toContain(`id="${id}"`);
    expect(guide.body).toContain('La mort est définitive.');
    expect((await req('POST', '/tutoriel', { read: 'mort' })).headers.location).toBe('/tutoriel#mort');
    expect((await req('GET', '/ville')).body).toContain('1 / 6');
    expect((await req('POST', '/tutoriel', { hidden: 'true' })).headers.location).toBe('/ville');
    expect((await req('GET', '/ville')).body).not.toContain('Premiers pas');
    expect((await req('GET', '/tutoriel')).body).toContain('Réafficher le résumé dans la ville');
  });
});
