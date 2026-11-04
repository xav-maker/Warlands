/**
 * Pages sociales par HTTP (J6) : chat de région, messages privés, amis, blocage, signalement et outils de
 * modération. Le texte des joueurs est toujours échappé ; la modération est réservée à son personnel.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createBus, sql } from '@cr/db';
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
    bus: createBus({ db: t.db }),
  });
});
afterAll(async () => {
  await app?.close();
  await t?.stop();
});

/** Recule d'une poignée de secondes les messages existants, pour passer la limite d'un message par seconde. */
const rewind = () =>
  sql`update chat_message set created_at = created_at - interval '5 seconds'; update direct_message set created_at = created_at - interval '5 seconds'`.execute(
    t.db,
  );

/** Navigateur d'un joueur : cookies, jeton CSRF. */
class Browser {
  jar = new Map<string, string>();
  csrf = '';
  constructor(readonly pseudo: string) {}

  async req(method: 'GET' | 'POST', url: string, form?: Record<string, string>, headers: Record<string, string> = {}) {
    const res = await app.inject({
      method,
      url,
      headers: {
        cookie: [...this.jar].map(([k, v]) => `${k}=${v}`).join('; '),
        origin: APP,
        ...(form ? { 'content-type': 'application/x-www-form-urlencoded' } : {}),
        ...headers,
      },
      ...(form ? { payload: new URLSearchParams({ _csrf: this.csrf, ...form }).toString() } : {}),
    });
    for (const c of res.cookies) this.jar.set(c.name, c.value);
    const m = /name="_csrf" value="([^"]+)"/.exec(res.body);
    if (m) this.csrf = m[1]!;
    return res;
  }

  async join(): Promise<this> {
    const email = `${this.pseudo.toLowerCase().replace(/\W/g, '')}@example.org`;
    await this.req('GET', '/inscription');
    await this.req('POST', '/inscription', { email, pseudo: this.pseudo, password: 'motdepasse-long', acceptTos: 'on' });
    await this.req('GET', '/connexion');
    await this.req('POST', '/connexion', { email, password: 'motdepasse-long' });
    await this.req('GET', '/chat'); // démarre la partie et lit le jeton CSRF de la session
    return this;
  }
  /** Envoie un message de chat ; l'horodatage des précédents est reculé pour passer la limite d'une seconde. */
  async say(text: string) {
    await rewind();
    return this.req('POST', '/chat', { text });
  }
  id = async () => (await t.db.selectFrom('player').select('id').where('pseudo', '=', this.pseudo).executeTakeFirstOrThrow()).id;
}

const player = (name: string) => new Browser(name).join();

describe('chat de région', () => {
  it('publie un message, l’échappe, et le montre aux joueurs de la région', async () => {
    const [a, b] = [await player('Alice'), await player('Bastien')];
    const sent = await a.say('<script>alert(1)</script> & salut');
    expect(sent.statusCode).toBe(303);
    expect(sent.headers.location).toBe('/chat');

    const page = await b.req('GET', '/chat');
    expect(page.statusCode).toBe(200);
    expect(page.body).toContain('&lt;script&gt;alert(1)&lt;/script&gt; &amp; salut');
    expect(page.body).not.toContain('<script>alert(1)');
    expect(page.body).toContain('Alice');
    expect(page.body).toMatch(/\d+ joueurs? en ligne dans la région/);

    const frag = await b.req('GET', '/chat/messages', undefined, { 'hx-request': 'true' });
    expect(frag.body).toContain('Alice');
    expect(frag.body).not.toContain('<html');
  });

  it('renvoie l’erreur de jeu sur la page, avec la fin d’une sourdine', async () => {
    const b = await player('Didier');
    const staff = await player('Moderatrice');
    await t.db.updateTable('account').set({ role: 'moderator' }).where('email', '=', 'moderatrice@example.org').execute();
    await staff.req('GET', '/moderation');
    const bid = await b.id();
    const r = await staff.req('POST', '/moderation/sanction', {
      player: String(bid),
      kind: 'mute',
      hours: '2',
      reason: 'insultes',
      back: `/moderation/joueur/${bid}`,
    });
    expect(r.statusCode).toBe(303);
    const res = await b.say('bonjour');
    expect(res.statusCode).toBe(303);
    const page = await b.req('GET', res.headers.location as string);
    expect(page.body).toMatch(/réduit au silence jusqu’au/);
    expect(page.body).not.toContain('{fin}');
  });

  it('refuse un message vide, et les erreurs passent par la zone d’alerte sous htmx', async () => {
    const a = await player('Elise');
    const res = await a.req('POST', '/chat', { text: '   ' }, { 'hx-request': 'true' });
    expect(res.headers['hx-retarget']).toBe('#flash');
    expect(res.body).toContain('Saisie invalide');
    await rewind();
    const ok = await a.req('POST', '/chat', { text: 'envoyé en direct' }, { 'hx-request': 'true' });
    expect(ok.statusCode).toBe(204);
  });

  it('exige d’être connecté', async () => {
    const anon = await app.inject({ method: 'GET', url: '/chat' });
    expect(anon.statusCode).toBe(302);
    expect(anon.headers.location).toBe('/connexion');
    const frag = await app.inject({ method: 'GET', url: '/chat/messages' });
    expect(frag.headers.location).toBe('/connexion');
  });

  it('bloquer un joueur masque ses messages, débloquer les rend', async () => {
    const [a, b] = [await player('Fabrice'), await player('Gaelle')];
    await b.say('message de Gaelle');
    expect((await a.req('GET', '/chat')).body).toContain('message de Gaelle');
    await a.req('POST', '/bloquer', { pseudo: 'Gaelle', back: '/chat' });
    expect((await a.req('GET', '/chat')).body).not.toContain('message de Gaelle');
    expect((await b.req('GET', '/chat')).body).toContain('message de Gaelle');
    const amis = await a.req('GET', '/amis');
    expect(amis.body).toContain('Joueurs bloqués');
    await a.req('POST', `/debloquer/${await b.id()}`, {});
    expect((await a.req('GET', '/chat')).body).toContain('message de Gaelle');
  });
});

describe('messages privés', () => {
  it('envoie, affiche le fil échappé, compte les non lus puis les marque lus', async () => {
    const [a, b] = [await player('Hugo'), await player('Ines')];
    await t.db
      .updateTable('player')
      .set({ last_seen_at: new Date(Date.now() - 3_600_000) })
      .where('pseudo', '=', 'Ines')
      .execute();
    const send = await a.req('POST', '/messages/envoyer', { to: 'Ines', text: 'psst <b>toi</b>' });
    expect(send.statusCode).toBe(303);
    expect(send.headers.location).toBe('/messages/Ines');

    const list = await b.req('GET', '/messages');
    expect(list.body).toContain('Hugo');
    expect(list.body).toContain('class="badge"');
    const nav = await b.req('GET', '/ville');
    expect(nav.body).toContain('✉ 1'); // notification persistante : destinataire hors ligne

    const thread = await b.req('GET', '/messages/Hugo');
    expect(thread.statusCode).toBe(200);
    expect(thread.body).toContain('psst &lt;b&gt;toi&lt;/b&gt;');
    expect((await b.req('GET', '/messages')).body).not.toContain('class="badge"');
    expect((await b.req('GET', '/ville')).body).not.toContain('✉');

    const fil = await b.req('GET', '/messages/Hugo/fil', undefined, { 'hx-request': 'true' });
    expect(fil.body).toContain('psst');
    expect(fil.body).not.toContain('<html');
  });

  it('refuse un message à un joueur qui a bloqué l’expéditeur, et signale un inconnu', async () => {
    const [a, b] = [await player('Jade'), await player('Kevin')];
    await b.req('POST', '/bloquer', { pseudo: 'Jade', back: '/messages' });
    const r = await a.req('POST', '/messages/envoyer', { to: 'Kevin', text: 'bonjour ?' });
    expect(r.headers.location).toContain('e=SOCIAL_REFUSED');
    expect((await a.req('GET', r.headers.location as string)).body).toContain('n’accepte pas vos messages');
    expect((await a.req('GET', '/messages/Inconnu')).headers.location).toBe('/messages?e=PLAYER_NOT_FOUND');
    expect((await a.req('GET', '/messages?avec=Kevin')).headers.location).toBe('/messages/Kevin');
  });
});

describe('amis', () => {
  it('demande, acceptation, liste avec statut', async () => {
    const [a, b] = [await player('Lucas'), await player('Manon')];
    expect((await a.req('POST', '/amis/demander', { pseudo: 'Manon' })).headers.location).toBe('/amis');
    expect((await a.req('GET', '/amis')).body).toContain('Demandes envoyées');
    const incoming = await b.req('GET', '/amis');
    expect(incoming.body).toContain('Demandes reçues');
    expect(incoming.body).toContain('Lucas');
    await b.req('POST', `/amis/${await a.id()}/accepter`, {});
    const mine = await a.req('GET', '/amis');
    expect(mine.body).toContain('Manon');
    expect(mine.body).toContain('en ligne');
    const frag = await a.req('GET', '/amis/liste', undefined, { 'hx-request': 'true' });
    expect(frag.body).toContain('Manon');
    await a.req('POST', `/amis/${await b.id()}/retirer`, {});
    expect((await a.req('GET', '/amis')).body).toContain('Pas encore d’ami');
    expect((await a.req('POST', '/amis/demander', { pseudo: 'Personne' })).headers.location).toContain('e=PLAYER_NOT_FOUND');
  });
});

describe('signalement et modération', () => {
  it('signale un message, la modération le traite avec décision motivée, le signaleur est prévenu', async () => {
    const [a, b] = [await player('Nina'), await player('Oscar')];
    const mod = await player('Paulette');
    await t.db.updateTable('account').set({ role: 'moderator' }).where('email', '=', 'paulette@example.org').execute();
    await b.say('propos déplacés');
    const mid = (await t.db.selectFrom('chat_message').select('id').where('body', '=', 'propos déplacés').executeTakeFirstOrThrow()).id;

    const form = await a.req('GET', `/signaler?kind=chat&ref=${mid}`);
    expect(form.body).toContain('propos déplacés');
    expect(form.body).toContain('Oscar');
    const sent = await a.req('POST', '/signaler', { kind: 'chat', ref: String(mid), pseudo: '', reason: 'insulte', comment: 'vu' });
    expect(sent.headers.location).toContain('ok=1');
    const dup = await a.req('POST', '/signaler', { kind: 'chat', ref: String(mid), pseudo: '', reason: 'insulte', comment: '' });
    expect(dup.headers.location).toContain('e=REPORT_DUPLICATE');

    const queue = await mod.req('GET', '/moderation');
    expect(queue.statusCode).toBe(200);
    expect(queue.body).toContain('Oscar');
    const rid = (await t.db.selectFrom('report').select('id').executeTakeFirstOrThrow()).id;
    const detail = await mod.req('GET', `/moderation/signalement/${rid}`);
    expect(detail.body).toContain('propos déplacés');
    expect(detail.body).toContain('Sanctionner');

    const bid = await b.id();
    const done = await mod.req('POST', '/moderation/sanction', {
      player: String(bid),
      kind: 'mute',
      hours: '24',
      reason: 'Insulte caractérisée',
      report: String(rid),
      back: `/moderation/signalement/${rid}`,
    });
    expect(done.headers.location).toBe('/moderation');
    expect((await mod.req('GET', '/moderation?etat=traites')).body).toContain('Insulte caractérisée');
    const notes = await a.req('GET', '/notifications');
    expect(notes.body).toContain(`Votre signalement #${rid} est traité`);
    const sanctioned = await b.req('GET', '/notifications');
    expect(sanctioned.body).toContain('Sourdine');
    expect(sanctioned.body).toContain('Insulte caractérisée');

    await mod.req('POST', '/moderation/supprimer-message', { message: String(mid), back: `/moderation/joueur/${bid}` });
    expect((await a.req('GET', '/chat')).body).not.toContain('propos déplacés');
    expect((await mod.req('GET', '/moderation/journal')).body).toContain('sanction.mute');
  });

  it('réserve la modération à son personnel et n’accepte aucun retour libre', async () => {
    const [a, mod] = [await player('Quentin'), await player('Rosalie')];
    await t.db.updateTable('account').set({ role: 'admin' }).where('email', '=', 'rosalie@example.org').execute();
    for (const url of ['/moderation', '/moderation/journal', '/moderation/joueur/1']) {
      const r = await a.req('GET', url);
      expect(r.statusCode).toBe(422);
      expect(r.body).toContain('Réservé à la modération');
    }
    const forbidden = await a.req('POST', '/moderation/sanction', { player: '1', kind: 'mute', hours: '1', reason: 'abus' });
    expect(forbidden.headers.location).toContain('e=NOT_MODERATOR');
    expect((await a.req('GET', '/ville')).body).not.toContain('Modération');

    const bid = await a.id();
    const r = await mod.req('POST', '/moderation/lever', { sanction: '999999', back: 'https://exemple.org/piege' });
    expect(r.headers.location).toMatch(/^\/moderation\?e=SANCTION_NOT_FOUND/);
    expect((await mod.req('GET', '/ville')).body).toContain('Modération');
    expect((await mod.req('GET', `/moderation/joueur/${bid}`)).statusCode).toBe(200);
  });

  it('bannir coupe la session du joueur', async () => {
    const [a, admin] = [await player('Sylvain'), await player('Thea')];
    await t.db.updateTable('account').set({ role: 'admin' }).where('email', '=', 'thea@example.org').execute();
    await admin.req('GET', '/moderation');
    await admin.req('POST', '/moderation/sanction', {
      player: String(await a.id()),
      kind: 'ban',
      reason: 'triche avérée',
      back: '/moderation',
    });
    const r = await a.req('GET', '/chat');
    expect(r.headers.location).toBe('/connexion');
    const login = await new Browser('Sylvain').req('POST', '/connexion', { email: 'sylvain@example.org', password: 'motdepasse-long' });
    expect(login.statusCode).not.toBe(303);
  });
});
