/**
 * Temps réel (J6) : bus Postgres LISTEN/NOTIFY entre deux instances, et flux SSE `/events` de bout en bout
 * (authentification, abonnements par joueur et par région, changement de région, présence, fermeture).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createBus, type Bus, type BusEvent } from '@cr/db';
import { startTestDb, type TestDb } from '@cr/testing';
import { memoryMailer, noRateLimit } from '@cr/domain';
import { buildApp } from '../src/app.ts';
import { loadGameContent } from '../src/content.ts';

const APP = 'http://localhost:3000';
let t: TestDb;
let app: FastifyInstance;
let bus: Bus;
let base = '';
const buses: Bus[] = [];

beforeAll(async () => {
  t = await startTestDb();
  bus = createBus({ db: t.db, connectionString: t.url, log: () => {} });
  buses.push(bus);
  app = await buildApp({
    db: t.db,
    mailer: memoryMailer(),
    appUrl: APP,
    cookieSecure: false,
    logLevel: 'silent',
    rateLimiter: noRateLimit,
    content: loadGameContent(),
    bus,
    heartbeatMs: 150,
  });
  base = await app.listen({ port: 0, host: '127.0.0.1' });
});
afterAll(async () => {
  await app?.close();
  for (const b of buses) await b.close();
  await t?.stop();
});

const until = async (cond: () => boolean | Promise<boolean>, ms = 5000): Promise<void> => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await cond()) return;
    await new Promise((r) => setTimeout(r, 25));
  }
  throw new Error('délai dépassé');
};

describe('bus LISTEN/NOTIFY', () => {
  it('relaie un événement publié par une instance à toutes les autres', async () => {
    const a = createBus({ db: t.db, connectionString: t.url, log: () => {} });
    const b = createBus({ db: t.db, connectionString: t.url, log: () => {} });
    buses.push(a, b);
    await until(() => a.listening && b.listening);
    const gotA: BusEvent[] = [];
    const gotB: BusEvent[] = [];
    a.subscribe((e) => gotA.push(e));
    b.subscribe((e) => gotB.push(e));
    a.publish([{ topic: 'region:x', type: 'chat.message', data: { id: 1, text: 'é"\n' } }]);
    await until(() => gotA.length === 1 && gotB.length === 1);
    expect(gotB[0]).toEqual({ topic: 'region:x', type: 'chat.message', data: { id: 1, text: 'é"\n' } });
    expect(gotA).toHaveLength(1); // pas de doublon pour l'émetteur
  });

  it('retire les données d’un événement trop gros, sans le perdre', async () => {
    const a = createBus({ db: t.db, connectionString: t.url, log: () => {} });
    buses.push(a);
    await until(() => a.listening);
    const got: BusEvent[] = [];
    a.subscribe((e) => got.push(e));
    a.publish([{ topic: 'region:x', type: 'chat.message', data: { big: 'x'.repeat(9000) } }]);
    await until(() => got.length === 1);
    expect(got[0]).toEqual({ topic: 'region:x', type: 'chat.message' });
  });

  it('diffuse localement sans connexion d’écoute', () => {
    const local = createBus({ db: t.db });
    const got: BusEvent[] = [];
    const off = local.subscribe((e) => got.push(e));
    local.publish([{ topic: 'user:1', type: 'notify' }]);
    off();
    local.publish([{ topic: 'user:1', type: 'notify' }]);
    expect(got).toHaveLength(1);
  });
});

/** Compte actif, avec son cookie de session. */
async function player(n: string): Promise<{ id: number; cookie: string }> {
  const email = `${n}@example.org`;
  const form = (b: Record<string, string>) => new URLSearchParams(b).toString();
  const headers = { origin: APP, 'content-type': 'application/x-www-form-urlencoded' };
  const pre = await app.inject({ method: 'GET', url: '/inscription' });
  const csrf = /name="_csrf" value="([^"]+)"/.exec(pre.body)![1]!;
  const cookie0 = pre.cookies.map((c) => `${c.name}=${c.value}`).join('; ');
  await app.inject({
    method: 'POST',
    url: '/inscription',
    headers: { ...headers, cookie: cookie0 },
    payload: form({ _csrf: csrf, email, pseudo: n, password: 'motdepasse-long', acceptTos: 'on' }),
  });
  const res = await app.inject({
    method: 'POST',
    url: '/connexion',
    headers: { ...headers, cookie: cookie0 },
    payload: form({ _csrf: csrf, email, password: 'motdepasse-long' }),
  });
  const sid = res.cookies.find((c) => c.name === 'sid')!;
  const row = await t.db.selectFrom('player').select('id').where('pseudo', '=', n).executeTakeFirstOrThrow();
  return { id: row.id, cookie: `sid=${sid.value}` };
}

/** Lecteur de flux SSE : accumule le texte reçu. */
async function open(cookie: string) {
  const ctl = new AbortController();
  const res = await fetch(`${base}/events`, { headers: { cookie }, signal: ctl.signal });
  let text = '';
  void (async () => {
    const reader = res.body!.getReader();
    const dec = new TextDecoder();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        text += dec.decode(value);
      }
    } catch {
      /* annulé */
    }
    text += '\n[fermé]';
  })();
  return {
    res,
    text: () => text,
    waitFor: (s: string) => until(() => text.includes(s)),
    close: () => ctl.abort(),
  };
}

describe('flux SSE /events', () => {
  it('refuse l’accès sans session', async () => {
    const res = await fetch(`${base}/events`);
    expect(res.status).toBe(401);
  });

  it('annonce la région, puis relaie les événements du joueur et de sa région seulement', async () => {
    const a = await player('alice');
    const b = await player('bob');
    const sa = await open(a.cookie);
    const sb = await open(b.cookie);
    expect(sa.res.headers.get('content-type')).toContain('text/event-stream');
    await sa.waitFor('event: ready');
    await sb.waitFor('event: ready');
    const region = (await t.db.selectFrom('player').select('pos_region').where('id', '=', a.id).executeTakeFirstOrThrow()).pos_region;
    expect(sa.text()).toContain(`"region":"${region}"`);

    bus.publish([
      { topic: `user:${a.id}`, type: 'shop.sold', data: { listing: 7 } },
      { topic: `region:${region}`, type: 'chat.message', data: { id: 1, pseudo: 'alice', text: 'bonjour' } },
      { topic: 'region:ailleurs', type: 'chat.message', data: { id: 2, text: 'invisible' } },
      { topic: `user:${a.id}`, type: 'battle.done', data: { battle: 1 } }, // interne : non relayé
    ]);
    await sa.waitFor('"text":"bonjour"');
    expect(sa.text()).toContain('event: notify');
    expect(sa.text()).toContain('vendue');
    expect(sa.text()).not.toContain('invisible');
    expect(sa.text()).not.toContain('battle.done');
    // Bob est dans la même région : il reçoit le chat, pas la notification d'Alice.
    await sb.waitFor('"text":"bonjour"');
    expect(sb.text()).not.toContain('vendue');
    sa.close();
    sb.close();
  });

  it('change d’abonnement quand le joueur se déplace', async () => {
    const c = await player('carole');
    const s = await open(c.cookie);
    await s.waitFor('event: ready');
    await t.db.updateTable('player').set({ pos_region: 'autre' }).where('id', '=', c.id).execute();
    bus.publish([{ topic: `user:${c.id}`, type: 'player.moved' }]);
    await s.waitFor('event: resubscribe');
    expect(s.text()).toContain('"region":"autre"');
    bus.publish([
      { topic: 'region:autre', type: 'chat.message', data: { text: 'nouvelle région' } },
      { topic: 'region:ancienne', type: 'chat.message', data: { text: 'ancienne région' } },
    ]);
    await s.waitFor('nouvelle région');
    expect(s.text()).not.toContain('ancienne région');
    s.close();
  });

  it('envoie des battements et prolonge la présence du joueur', async () => {
    const d = await player('didier');
    const old = new Date(Date.now() - 5 * 60_000);
    await t.db.updateTable('session').set({ last_seen_at: old }).execute();
    await t.db.updateTable('player').set({ last_seen_at: old }).where('id', '=', d.id).execute();
    const s = await open(d.cookie);
    await s.waitFor(': ping');
    await until(async () => {
      const p = await t.db.selectFrom('player').select('last_seen_at').where('id', '=', d.id).executeTakeFirstOrThrow();
      return p.last_seen_at !== null && p.last_seen_at.getTime() > Date.now() - 10_000;
    });
    s.close();
  });

  it('se ferme quand la session prend fin', async () => {
    const e = await player('emma');
    const s = await open(e.cookie);
    await s.waitFor('event: ready');
    await t.db.deleteFrom('session').execute();
    await s.waitFor('[fermé]');
  });
});
