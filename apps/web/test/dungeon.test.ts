/**
 * Donjon en solo par HTTP (J7) : la porte s'affiche sur l'étape, on entre, on combat une salle (rediffusion
 * imposée, retour au donjon), on sort avec le coffre ; une page périmée est refusée avec un message.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { startTestDb, type TestDb } from '@cr/testing';
import { createTestSquad, memoryMailer, noRateLimit } from '@cr/domain';
import { buildApp } from '../src/app.ts';
import { loadGameContent } from '../src/content.ts';

const APP = 'http://localhost:3000';
const content = loadGameContent();
let t: TestDb;
let app: FastifyInstance;

beforeAll(async () => {
  t = await startTestDb();
  // Tirages à 0 : une porte apparaît à chaque étape d'une route à donjon.
  app = await buildApp({
    db: t.db,
    mailer: memoryMailer(),
    appUrl: APP,
    cookieSecure: false,
    logLevel: 'silent',
    rateLimiter: noRateLimit,
    content,
    random: () => 0,
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
const endWatch = () =>
  t.db
    .updateTable('player')
    .set({ watch_until: new Date(Date.now() - 1000) })
    .execute();

describe('donjon en solo', () => {
  it('entre par la porte, combat une salle, sort avec le coffre', async () => {
    await req('GET', '/inscription');
    await req('POST', '/inscription', { email: 'donjon@example.org', pseudo: 'Explorateur', password: 'motdepasse-long', acceptTos: 'on' });
    await req('GET', '/connexion');
    await req('POST', '/connexion', { email: 'donjon@example.org', password: 'motdepasse-long' });
    await req('GET', '/ville');
    const pid = (await t.db.selectFrom('player').select('id').executeTakeFirstOrThrow()).id;
    await t.db.transaction().execute(async (tx) => {
      await tx.updateTable('troop').set({ container: 'BARRACKS' }).where('player_id', '=', pid).execute();
      await createTestSquad(tx, content, pid, 30, 'test');
    });

    expect((await req('POST', '/depart', { direction: '1', route: 'pres_brande' })).headers.location).toBe('/route');
    const route = await req('GET', '/route');
    expect(route.body).toContain('Une porte de donjon');
    expect(route.body).toContain('Terriers du Roi Kobold');

    expect((await req('POST', '/donjon/ouvrir', {})).headers.location).toBe('/donjon');
    expect((await req('GET', '/jeu')).headers.location).toBe('/donjon');
    expect((await req('GET', '/route')).headers.location).toBe('/donjon');
    const page = await req('GET', '/donjon');
    expect(page.statusCode).toBe(200);
    expect(page.body).toContain('Combattre la salle 1');
    expect(page.body).toContain('Coffre du donjon');
    const version = /name="version" value="(\d+)"/.exec(page.body)![1]!;

    // Page périmée : refusée avec un message.
    const stale = await req('POST', '/donjon/combat', { version: String(Number(version) + 5) });
    expect(stale.headers.location).toBe('/donjon?e=DUNGEON_STALE');
    expect((await req('GET', stale.headers.location as string)).body).toContain('Le donjon a changé entre-temps');

    const fought = await req('POST', '/donjon/combat', { version });
    expect(fought.headers.location).toMatch(/^\/combat\/\d+$/);
    const combat = await req('GET', fought.headers.location as string);
    expect(combat.body).toContain('Terriers du Roi Kobold · salle 1');
    expect(combat.body).toContain('dans le coffre');
    await endWatch();
    expect((await req('GET', fought.headers.location as string)).body).toContain('href="/donjon"');

    const after = await req('GET', '/donjon');
    expect(after.body).toContain('Combattre la salle 2');
    expect(after.body).toMatch(/<b>13 or<\/b>/);
    const v2 = /name="version" value="(\d+)"/.exec(after.body)![1]!;
    expect((await req('POST', '/donjon/quitter', { version: v2 })).headers.location).toBe('/jeu');
    expect((await req('GET', '/jeu')).headers.location).toBe('/route');
    expect((await req('GET', '/route')).body).not.toContain('Une porte de donjon');
  });
});
