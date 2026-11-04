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

/** Navigateur d'un joueur : ses cookies et son jeton CSRF. */
class Browser {
  jar = new Map<string, string>();
  csrf = '';
  async req(method: 'GET' | 'POST', url: string, form?: Record<string, string>) {
    const res = await app.inject({
      method,
      url,
      headers: {
        cookie: [...this.jar].map(([k, v]) => `${k}=${v}`).join('; '),
        origin: APP,
        ...(form ? { 'content-type': 'application/x-www-form-urlencoded' } : {}),
      },
      ...(form ? { payload: new URLSearchParams({ _csrf: this.csrf, ...form }).toString() } : {}),
    });
    for (const c of res.cookies) this.jar.set(c.name, c.value);
    const m = /name="_csrf" value="([^"]+)"/.exec(res.body);
    if (m) this.csrf = m[1]!;
    return res;
  }
  async join(name: string): Promise<number> {
    const email = `${name.toLowerCase()}@example.org`;
    await this.req('GET', '/inscription');
    await this.req('POST', '/inscription', { email, pseudo: name, password: 'motdepasse-long', acceptTos: 'on' });
    await this.req('GET', '/connexion');
    await this.req('POST', '/connexion', { email, password: 'motdepasse-long' });
    await this.req('GET', '/ville');
    const pid = (await t.db.selectFrom('player').select('id').where('pseudo', '=', name).executeTakeFirstOrThrow()).id;
    await t.db.transaction().execute(async (tx) => {
      await tx.updateTable('troop').set({ container: 'BARRACKS' }).where('player_id', '=', pid).execute();
      await createTestSquad(tx, content, pid, 30, 'test');
    });
    return pid;
  }
}

describe('donjon à deux', () => {
  it('invite au hasard un joueur disponible, qui rejoint ; le second « prêt » lance le combat', async () => {
    const a = new Browser();
    const b = new Browser();
    await a.join('Ouvreuse');
    await b.join('Renfort');
    // B se déclare disponible depuis la ville.
    expect((await b.req('GET', '/ville')).body).toContain('Me déclarer disponible');
    const dispo = await b.req('POST', '/joueur/donjon-disponible', { available: 'true' });
    expect(dispo.body).toContain('Ne plus être disponible');

    await a.req('POST', '/depart', { direction: '1', route: 'pres_brande' });
    expect((await a.req('GET', '/route')).body).toContain('Inviter un joueur au hasard');
    expect((await a.req('POST', '/donjon/ouvrir', { mode: 'random' })).headers.location).toBe('/donjon');
    const lobby = await a.req('GET', '/donjon');
    expect(lobby.body).toContain('En attente d’un partenaire');
    expect(lobby.body).toContain('Invitation envoyée à 1 joueur de la région');

    const runId = (await t.db.selectFrom('dungeon_run').select('id').where('status', '=', 'lobby').executeTakeFirstOrThrow()).id;
    const inv = await b.req('GET', `/donjon/invitation/${runId}`);
    expect(inv.body).toContain('Ouvreuse</b> vous invite dans le donjon <b>Terriers du Roi Kobold');
    expect((await b.req('POST', `/donjon/invitation/${runId}/accepter`, {})).headers.location).toBe('/donjon');

    const pa = await a.req('GET', '/donjon');
    expect(pa.body).toContain('donjon à deux, avec Renfort');
    expect(pa.body).toContain('Prêt pour la salle 1');
    const version = /name="version" value="(\d+)"/.exec(pa.body)![1]!;
    expect((await a.req('POST', '/donjon/combat', { version })).headers.location).toBe('/donjon');
    expect((await a.req('GET', '/donjon')).body).toContain('le combat commence quand Renfort l’est aussi');
    const fought = await b.req('POST', '/donjon/combat', { version });
    expect(fought.headers.location).toMatch(/^\/combat\/\d+$/);
    // Les deux voient le combat (A y est renvoyé par /jeu pendant la rediffusion).
    expect((await a.req('GET', '/jeu')).headers.location).toBe(fought.headers.location);
    expect((await a.req('GET', fought.headers.location as string)).statusCode).toBe(200);

    // Une invitation passée n'est plus valable.
    expect((await b.req('GET', `/donjon/invitation/${runId}`)).body).toContain('n’est plus valable');
  });
});
