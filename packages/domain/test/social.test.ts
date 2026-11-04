/**
 * Social et modération (J6, README 25, guide 12) : texte et filtre de mots, chat de région (limites, silence,
 * blocage), messages privés, amis, signalements, sanctions et leurs effets, rétention.
 */
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { z } from 'zod';
import { validateContent } from '@cr/content';
import type { GenContent } from '@cr/gen';
import type { AccountRole } from '@cr/db';
import { startTestDb, type TestDb } from '@cr/testing';
import {
  acceptFriend,
  addInstance,
  addStack,
  applySanction,
  blockPlayer,
  canOpenLink,
  choosePseudo,
  chatHistory,
  cleanText,
  closeReport,
  createReport,
  deleteChatMessage,
  directConversations,
  directThread,
  directUnread,
  ensureStarted,
  executeCommand,
  ficheOf,
  filterWords,
  forceRename,
  friendsView,
  liftExpiredSuspensions,
  liftSanction,
  listGoods,
  login,
  memoryMailer,
  memoryRateLimiter,
  noRateLimit,
  normalizeText,
  onlineInRegion,
  parseLink,
  playerFile,
  purgeSocial,
  readDirect,
  removeFriend,
  reportQueue,
  requestFriend,
  sayInRegion,
  sendDirect,
  signup,
  unblockPlayer,
  type CommandDef,
  type DomainEvent,
  type GameContent,
} from '../src/index.ts';

const compiled = validateContent(join(import.meta.dirname, '../../../content'));
const content: GameContent = { pack: compiled.pack as unknown as GenContent, hash: compiled.hash! };
const WORDS = content.pack.online!.chat.bannedWords;
let t: TestDb;
let n = 0;
const events: DomainEvent[] = [];
const T0 = new Date('2026-11-04T12:00:00Z');
const at = (s: number): Date => new Date(T0.getTime() + s * 1000);

function run<S extends z.ZodType, R>(
  pid: number,
  def: CommandDef<S, R>,
  input: unknown = {},
  now: Date = T0,
  limiter = noRateLimit,
): Promise<R> {
  return executeCommand(
    { db: t.db, rateLimiter: limiter, publish: (e) => events.push(...e), content, random: () => 9, clock: () => now },
    def,
    {
      playerId: pid,
      input,
    },
  );
}

interface P {
  id: number;
  pseudo: string;
  email: string;
}
async function newPlayer(role: AccountRole = 'player'): Promise<P> {
  n++;
  const pseudo = `Joueur ${n}`;
  const email = `soc${n}@example.org`;
  await signup(
    { db: t.db, mailer: memoryMailer(), appUrl: 'http://test' },
    { email, pseudo, password: 'motdepasse-long', acceptTos: true },
  );
  const row = await t.db.selectFrom('player').select(['id', 'account_id']).where('pseudo', '=', pseudo).executeTakeFirstOrThrow();
  if (role !== 'player') await t.db.updateTable('account').set({ role }).where('id', '=', row.account_id).execute();
  return { id: row.id, pseudo, email };
}
const setRegion = (p: P, region: string) => t.db.updateTable('player').set({ pos_region: region }).where('id', '=', p.id).execute();
const seen = (p: P, d: Date | null) => t.db.updateTable('player').set({ last_seen_at: d }).where('id', '=', p.id).execute();
const notifs = (p: P, type: string) =>
  t.db.selectFrom('notification').selectAll().where('player_id', '=', p.id).where('type', '=', type).execute();
const accountStatus = async (p: P) =>
  (await t.db.selectFrom('account').select('status').where('email', '=', p.email).executeTakeFirstOrThrow()).status;

beforeAll(async () => {
  expect(compiled.ok).toBe(true);
  t = await startTestDb();
});
afterAll(async () => t?.stop());

describe('texte des joueurs', () => {
  it('nettoie : espaces, retours à la ligne, caractères de contrôle et invisibles', () => {
    expect(normalizeText('  bonjour \n\n  le\tmonde \u0007\u200b ')).toBe('bonjour le monde');
    expect(cleanText('   ', 300)).toBeNull();
    expect(cleanText('a'.repeat(300), 300)).toHaveLength(300);
    expect(cleanText('a'.repeat(301), 300)).toBeNull();
    expect(cleanText('😀'.repeat(300), 300)).not.toBeNull(); // la longueur compte les caractères, pas les octets
    expect(cleanText('<b>gras</b>', 300)).toBe('<b>gras</b>'); // brut : l'échappement se fait au rendu
  });

  it('masque les mots interdits, accents, casse, séparateurs et chiffres d’argot ignorés', () => {
    expect(filterWords('Quel CONNARD !', WORDS)).toEqual({ text: 'Quel ******* !', hits: 1 });
    expect(filterWords('enculé et p.u.t.e', WORDS).hits).toBe(2);
    expect(filterWords('c0nnard', WORDS)).toEqual({ text: '*******', hits: 1 });
    expect(filterWords('enculé 😀 connard', WORDS)).toEqual({ text: '****** 😀 *******', hits: 2 });
  });

  it('ne masque pas un mot légitime qui en contient un autre', () => {
    expect(filterWords('Je vais réputer ce computeur et saluer la putée', WORDS).hits).toBe(0);
    expect(filterWords('bonjour tout le monde', WORDS)).toEqual({ text: 'bonjour tout le monde', hits: 0 });
    expect(filterWords('texte', [])).toEqual({ text: 'texte', hits: 0 });
  });
});

describe('chat de région', () => {
  it('publie dans la région du joueur et diffuse un événement léger', async () => {
    const a = await newPlayer();
    events.length = 0;
    const r = await run(a.id, sayInRegion, { text: '  Bonjour   à tous ' });
    expect(events).toContainEqual({ topic: 'region:ronces', type: 'chat.message', data: { id: r.id } });
    const log = await chatHistory(t.db, a.id, 'ronces');
    expect(log.at(-1)).toMatchObject({ id: r.id, pseudo: a.pseudo, text: 'Bonjour à tous', mine: true });
  });

  it('suit la position : un message part dans la région où l’on se trouve', async () => {
    const a = await newPlayer();
    await setRegion(a, 'ailleurs');
    const r = await run(a.id, sayInRegion, { text: 'ici' });
    expect((await chatHistory(t.db, a.id, 'ailleurs')).map((m) => m.id)).toContain(r.id);
    expect((await chatHistory(t.db, a.id, 'ronces')).map((m) => m.id)).not.toContain(r.id);
  });

  it('refuse un message vide, trop long ou un second message en moins d’une seconde', async () => {
    const a = await newPlayer();
    await expect(run(a.id, sayInRegion, { text: ' \n ' })).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    await expect(run(a.id, sayInRegion, { text: 'x'.repeat(301) })).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    await run(a.id, sayInRegion, { text: 'un' }, at(0));
    await expect(run(a.id, sayInRegion, { text: 'deux' }, at(0.5))).rejects.toMatchObject({ code: 'RATE_LIMITED' });
    await run(a.id, sayInRegion, { text: 'deux' }, at(1.01));
  });

  it('limite à 20 messages par minute', async () => {
    const a = await newPlayer();
    let clock = at(1000);
    const limiter = memoryRateLimiter(() => clock.getTime());
    for (let i = 0; i < 20; i++) {
      clock = new Date(clock.getTime() + 2000);
      await run(a.id, sayInRegion, { text: `m${i}` }, clock, limiter);
    }
    clock = new Date(clock.getTime() + 2000);
    await expect(run(a.id, sayInRegion, { text: 'trop' }, clock, limiter)).rejects.toMatchObject({ code: 'RATE_LIMITED' });
    clock = new Date(clock.getTime() + 60_000);
    await run(a.id, sayInRegion, { text: 'ça repart' }, clock, limiter);
  });

  it('masque les mots interdits et compte l’infraction', async () => {
    const a = await newPlayer();
    const r = await run(a.id, sayInRegion, { text: 'espèce de connard' });
    expect(r.filtered).toBe(1);
    const row = await t.db.selectFrom('chat_message').select(['body', 'filtered']).where('id', '=', r.id).executeTakeFirstOrThrow();
    expect(row).toEqual({ body: 'espèce de *******', filtered: 1 });
  });

  it('retire de l’historique les messages d’un joueur bloqué, sans toucher aux autres lecteurs', async () => {
    const [a, b, c] = [await newPlayer(), await newPlayer(), await newPlayer()];
    await setRegion(a, 'zone_blocage');
    await setRegion(b, 'zone_blocage');
    await setRegion(c, 'zone_blocage');
    const mb = await run(b.id, sayInRegion, { text: 'message de b' }, at(0));
    const mc = await run(c.id, sayInRegion, { text: 'message de c' }, at(2));
    await run(a.id, blockPlayer, { pseudo: b.pseudo });
    expect((await chatHistory(t.db, a.id, 'zone_blocage')).map((m) => m.id)).toEqual([mc.id]);
    expect((await chatHistory(t.db, c.id, 'zone_blocage')).map((m) => m.id)).toEqual([mb.id, mc.id]);
    await run(a.id, unblockPlayer, { player: b.id });
    expect((await chatHistory(t.db, a.id, 'zone_blocage')).map((m) => m.id)).toEqual([mb.id, mc.id]);
  });

  it('garde les 50 derniers messages, du plus ancien au plus récent', async () => {
    const a = await newPlayer();
    await setRegion(a, 'zone_longue');
    const ids: number[] = [];
    for (let i = 0; i < 55; i++) ids.push((await run(a.id, sayInRegion, { text: `m${i}` }, at(i * 2))).id);
    const log = await chatHistory(t.db, a.id, 'zone_longue');
    expect(log.map((m) => m.id)).toEqual(ids.slice(5));
  });

  it('compte les joueurs en ligne par région (vu il y a moins de 2 minutes)', async () => {
    const [a, b, c] = [await newPlayer(), await newPlayer(), await newPlayer()];
    for (const p of [a, b, c]) await setRegion(p, 'zone_presence');
    await seen(a, at(-30));
    await seen(b, at(-119));
    await seen(c, at(-121));
    expect(await onlineInRegion(t.db, 'zone_presence', T0)).toBe(2);
  });
});

describe('messages privés', () => {
  it('délivre, notifie un destinataire absent une seule fois, et prévient un destinataire en ligne', async () => {
    const [a, b] = [await newPlayer(), await newPlayer()];
    await seen(b, at(-600));
    events.length = 0;
    await run(a.id, sendDirect, { to: b.pseudo.toUpperCase(), text: 'salut' }, at(0));
    await run(a.id, sendDirect, { to: b.pseudo, text: 'encore' }, at(2));
    expect(events.filter((e) => e.type === 'dm.received' && e.topic === `user:${b.id}`)).toHaveLength(2);
    const ns = await notifs(b, 'dm.received');
    expect(ns).toHaveLength(1);
    expect(ns[0]!.data).toEqual({ from: a.pseudo, fromId: a.id });

    const c = await newPlayer();
    await seen(c, at(-10));
    await run(a.id, sendDirect, { to: c.pseudo, text: 'toi, en ligne' }, at(4));
    expect(await notifs(c, 'dm.received')).toHaveLength(0);
  });

  it('classe les conversations, compte les non lus et marque comme lu', async () => {
    const [a, b, c] = [await newPlayer(), await newPlayer(), await newPlayer()];
    await run(b.id, sendDirect, { to: a.pseudo, text: 'de b 1' }, at(0));
    await run(b.id, sendDirect, { to: a.pseudo, text: 'de b 2' }, at(2));
    await run(a.id, sendDirect, { to: c.pseudo, text: 'vers c' }, at(4));
    const conv = await directConversations(t.db, a.id);
    expect(conv.map((x) => [x.pseudo, x.text, x.unread, x.fromMe])).toEqual([
      [c.pseudo, 'vers c', 0, true],
      [b.pseudo, 'de b 2', 2, false],
    ]);
    expect(await directUnread(t.db, a.id)).toBe(2);
    expect((await directThread(t.db, a.id, b.id)).map((m) => m.text)).toEqual(['de b 1', 'de b 2']);

    await run(a.id, readDirect, { with: b.pseudo });
    expect(await directUnread(t.db, a.id)).toBe(0);
    expect((await notifs(a, 'dm.received')).every((x) => x.read_at)).toBe(true);
  });

  it('refuse un message à soi-même, à un inconnu, ou entre deux joueurs dont l’un a bloqué l’autre', async () => {
    const [a, b] = [await newPlayer(), await newPlayer()];
    await expect(run(a.id, sendDirect, { to: a.pseudo, text: 'moi' })).rejects.toMatchObject({ code: 'SELF_TARGET' });
    await expect(run(a.id, sendDirect, { to: 'Personne', text: 'x' })).rejects.toMatchObject({ code: 'PLAYER_NOT_FOUND' });
    await run(b.id, blockPlayer, { pseudo: a.pseudo });
    await expect(run(a.id, sendDirect, { to: b.pseudo, text: 'bloqué' }, at(10))).rejects.toMatchObject({ code: 'SOCIAL_REFUSED' });
    await expect(run(b.id, sendDirect, { to: a.pseudo, text: 'à mon tour' }, at(12))).rejects.toMatchObject({ code: 'SOCIAL_REFUSED' });
    expect(await t.db.selectFrom('direct_message').select('id').where('sender_id', 'in', [a.id, b.id]).execute()).toHaveLength(0);
  });

  it('cache une conversation avec un joueur bloqué', async () => {
    const [a, b] = [await newPlayer(), await newPlayer()];
    await run(b.id, sendDirect, { to: a.pseudo, text: 'avant le blocage' });
    await run(a.id, blockPlayer, { pseudo: b.pseudo });
    expect(await directConversations(t.db, a.id)).toEqual([]);
    expect(await directUnread(t.db, a.id)).toBe(0);
  });
});

describe('amis et blocage', () => {
  it('demande, acceptation, statut en ligne et région visibles', async () => {
    const [a, b] = [await newPlayer(), await newPlayer()];
    await setRegion(b, 'zone_amis');
    await seen(b, at(-20));
    events.length = 0;
    expect(await run(a.id, requestFriend, { pseudo: b.pseudo })).toEqual({ status: 'pending' });
    expect(events).toContainEqual({ topic: `user:${b.id}`, type: 'friend.request', data: { from: a.pseudo } });
    expect(await run(a.id, requestFriend, { pseudo: b.pseudo })).toEqual({ status: 'pending' }); // idempotent
    let va = await friendsView(t.db, a.id, T0);
    let vb = await friendsView(t.db, b.id, T0);
    expect(va.outgoing.map((x) => x.pseudo)).toEqual([b.pseudo]);
    expect(vb.incoming.map((x) => x.pseudo)).toEqual([a.pseudo]);
    await expect(run(a.id, acceptFriend, { player: b.id })).rejects.toMatchObject({ code: 'NO_SUCH_REQUEST' }); // sa propre demande

    await run(b.id, acceptFriend, { player: a.id });
    va = await friendsView(t.db, a.id, T0);
    vb = await friendsView(t.db, b.id, T0);
    expect(va.friends).toEqual([{ id: b.id, pseudo: b.pseudo, online: true, region: 'zone_amis' }]);
    expect(vb.friends.map((f) => f.id)).toEqual([a.id]);
    expect(va.outgoing).toEqual([]);
    await expect(run(a.id, requestFriend, { pseudo: b.pseudo })).rejects.toMatchObject({ code: 'ALREADY_FRIENDS' });
    expect((await friendsView(t.db, a.id, at(300))).friends[0]!.online).toBe(false); // plus vu depuis 2 minutes
  });

  it('une demande croisée vaut acceptation, même simultanée', async () => {
    const [a, b, c, d] = [await newPlayer(), await newPlayer(), await newPlayer(), await newPlayer()];
    await run(a.id, requestFriend, { pseudo: b.pseudo });
    expect(await run(b.id, requestFriend, { pseudo: a.pseudo })).toEqual({ status: 'accepted' });
    expect((await friendsView(t.db, a.id)).friends.map((f) => f.id)).toEqual([b.id]);

    const both = await Promise.all([run(c.id, requestFriend, { pseudo: d.pseudo }), run(d.id, requestFriend, { pseudo: c.pseudo })]);
    expect(both.map((r) => r.status).sort()).toContain('accepted');
    expect((await friendsView(t.db, c.id)).friends.map((f) => f.id)).toEqual([d.id]);
  });

  it('refuse, annule, retire', async () => {
    const [a, b, c] = [await newPlayer(), await newPlayer(), await newPlayer()];
    await run(a.id, requestFriend, { pseudo: b.pseudo });
    await run(b.id, removeFriend, { player: a.id }); // refus
    expect((await friendsView(t.db, a.id)).outgoing).toEqual([]);
    await run(a.id, requestFriend, { pseudo: c.pseudo });
    await run(a.id, removeFriend, { player: c.id }); // annulation
    expect((await friendsView(t.db, c.id)).incoming).toEqual([]);
    await run(a.id, requestFriend, { pseudo: b.pseudo });
    await run(b.id, acceptFriend, { player: a.id });
    await run(a.id, removeFriend, { player: b.id }); // fin d'amitié
    expect((await friendsView(t.db, b.id)).friends).toEqual([]);
    await expect(run(a.id, requestFriend, { pseudo: a.pseudo })).rejects.toMatchObject({ code: 'SELF_TARGET' });
  });

  it('bloquer retire l’amitié et ferme les demandes dans les deux sens', async () => {
    const [a, b] = [await newPlayer(), await newPlayer()];
    await run(a.id, requestFriend, { pseudo: b.pseudo });
    await run(b.id, acceptFriend, { player: a.id });
    await run(a.id, blockPlayer, { pseudo: b.pseudo });
    await run(a.id, blockPlayer, { pseudo: b.pseudo }); // idempotent
    expect((await friendsView(t.db, a.id)).friends).toEqual([]);
    expect((await friendsView(t.db, a.id)).blocked.map((x) => x.id)).toEqual([b.id]);
    await expect(run(b.id, requestFriend, { pseudo: a.pseudo })).rejects.toMatchObject({ code: 'SOCIAL_REFUSED' });
    await expect(run(a.id, requestFriend, { pseudo: b.pseudo })).rejects.toMatchObject({ code: 'SOCIAL_REFUSED' });
    await run(a.id, unblockPlayer, { player: b.id });
    expect(await run(a.id, requestFriend, { pseudo: b.pseudo })).toEqual({ status: 'pending' });
  });

  it('notifie la demande et l’acceptation', async () => {
    const [a, b] = [await newPlayer(), await newPlayer()];
    await run(a.id, requestFriend, { pseudo: b.pseudo });
    expect((await notifs(b, 'friend.request'))[0]!.data).toEqual({ from: a.pseudo, fromId: a.id });
    await run(b.id, acceptFriend, { player: a.id });
    expect((await notifs(a, 'friend.accepted'))[0]!.data).toEqual({ from: b.pseudo, fromId: b.id });
  });
});

describe('signalements', () => {
  it('copie le contenu signalé, qui survit à sa suppression et à la purge', async () => {
    const [a, b] = [await newPlayer(), await newPlayer()];
    const m = await run(b.id, sayInRegion, { text: 'propos litigieux' });
    const r = await run(a.id, createReport, { kind: 'chat', ref: m.id, reason: 'insulte', comment: 'vu en direct' });
    await t.db.deleteFrom('chat_message').where('id', '=', m.id).execute();
    const q = await reportQueue(t.db, 'open');
    expect(q.find((x) => x.id === r.id)).toMatchObject({
      kind: 'chat',
      content: 'propos litigieux',
      author: a.pseudo,
      target: b.pseudo,
      reason: 'insulte',
      comment: 'vu en direct',
      status: 'open',
    });
  });

  it('refuse un doublon, son propre contenu, un message inconnu ou un message privé qu’on n’a pas reçu', async () => {
    const [a, b, c] = [await newPlayer(), await newPlayer(), await newPlayer()];
    const m = await run(b.id, sayInRegion, { text: 'un message' });
    await run(a.id, createReport, { kind: 'chat', ref: m.id, reason: 'spam' });
    await expect(run(a.id, createReport, { kind: 'chat', ref: m.id, reason: 'spam' })).rejects.toMatchObject({ code: 'REPORT_DUPLICATE' });
    await expect(run(b.id, createReport, { kind: 'chat', ref: m.id, reason: 'spam' })).rejects.toMatchObject({ code: 'SELF_TARGET' });
    await expect(run(a.id, createReport, { kind: 'chat', ref: 999_999_999, reason: 'spam' })).rejects.toMatchObject({
      code: 'MESSAGE_NOT_FOUND',
    });

    const dm = await run(b.id, sendDirect, { to: a.pseudo, text: 'en privé' }, at(5));
    await expect(run(c.id, createReport, { kind: 'dm', ref: dm.id, reason: 'insulte' })).rejects.toMatchObject({
      code: 'MESSAGE_NOT_FOUND',
    });
    const r = await run(a.id, createReport, { kind: 'dm', ref: dm.id, reason: 'insulte' });
    expect((await reportQueue(t.db, 'open')).find((x) => x.id === r.id)).toMatchObject({
      kind: 'dm',
      content: 'en privé',
      target: b.pseudo,
    });
  });

  it('signale un profil par son pseudo, et limite à 20 signalements par jour', async () => {
    const a = await newPlayer();
    const targets = [];
    for (let i = 0; i < 21; i++) targets.push(await newPlayer());
    const r = await run(a.id, createReport, { kind: 'player', pseudo: targets[0]!.pseudo, reason: 'triche' });
    expect((await reportQueue(t.db, 'open')).find((x) => x.id === r.id)).toMatchObject({
      kind: 'player',
      target: targets[0]!.pseudo,
      content: '',
    });
    for (let i = 1; i < 20; i++) await run(a.id, createReport, { kind: 'player', pseudo: targets[i]!.pseudo, reason: 'spam' });
    await expect(run(a.id, createReport, { kind: 'player', pseudo: targets[20]!.pseudo, reason: 'spam' })).rejects.toMatchObject({
      code: 'REPORT_LIMIT',
    });
  });
});

describe('sanctions', () => {
  it('réserve les outils au personnel de modération', async () => {
    const [a, b] = [await newPlayer(), await newPlayer()];
    await expect(run(a.id, applySanction, { player: b.id, kind: 'mute', hours: 1, reason: 'test' })).rejects.toMatchObject({
      code: 'NOT_MODERATOR',
    });
    await expect(run(a.id, closeReport, { report: 1, decision: 'ok ok' })).rejects.toMatchObject({ code: 'NOT_MODERATOR' });
    await expect(run(a.id, deleteChatMessage, { message: 1 })).rejects.toMatchObject({ code: 'NOT_MODERATOR' });
    await expect(run(a.id, liftSanction, { sanction: 1 })).rejects.toMatchObject({ code: 'NOT_MODERATOR' });
  });

  it('sourdine : interdit le chat et les messages privés jusqu’au terme, puis rend la parole', async () => {
    const [mod, b, c] = [await newPlayer('moderator'), await newPlayer(), await newPlayer()];
    const s = await run(mod.id, applySanction, { player: b.id, kind: 'mute', hours: 2, reason: 'insultes répétées' }, at(0));
    await expect(run(b.id, sayInRegion, { text: 'bonjour' }, at(10))).rejects.toMatchObject({ code: 'MUTED' });
    await expect(run(b.id, sendDirect, { to: c.pseudo, text: 'bonjour' }, at(10))).rejects.toMatchObject({ code: 'MUTED' });
    await expect(run(b.id, sayInRegion, { text: 'bonjour' }, at(10))).rejects.toMatchObject({
      details: { fin: expect.stringContaining('jusqu’au') as unknown },
    });
    await run(b.id, sayInRegion, { text: 'de retour' }, at(2 * 3600 + 5));

    const s2 = await run(mod.id, applySanction, { player: c.id, kind: 'mute', hours: 5, reason: 'spam' }, at(0));
    await run(mod.id, liftSanction, { sanction: s2.id }, at(60));
    await run(c.id, sayInRegion, { text: 'levée à la main' }, at(120));
    expect(s.id).toBeGreaterThan(0);
  });

  it('interdiction de boutique : bloque la mise en vente seulement', async () => {
    const [mod, b] = [await newPlayer('moderator'), await newPlayer()];
    await t.db.transaction().execute((x) => addStack(x, content, b.id, 'BANK', 'croc_loup', 5, 'SYSTEM', 'test'));
    await run(mod.id, applySanction, { player: b.id, kind: 'shop_ban', hours: 24, reason: 'arnaque' }, at(0));
    await expect(run(b.id, listGoods, { kind: 'stack', item: 'croc_loup', qty: 1, price: 100 }, at(10))).rejects.toMatchObject({
      code: 'SHOP_BANNED',
    });
    await run(b.id, sayInRegion, { text: 'je peux parler' }, at(10));
    await run(b.id, listGoods, { kind: 'stack', item: 'croc_loup', qty: 1, price: 100 }, at(25 * 3600));
  });

  it('applique les limites de rôle : un modérateur ne bannit pas et ne sanctionne ni personnel ni lui-même', async () => {
    const [mod, admin, mod2, b] = [await newPlayer('moderator'), await newPlayer('admin'), await newPlayer('moderator'), await newPlayer()];
    const base = { reason: 'motif valable' };
    await expect(run(mod.id, applySanction, { player: b.id, kind: 'ban', ...base })).rejects.toMatchObject({ code: 'NOT_ADMIN' });
    await expect(run(mod.id, applySanction, { player: b.id, kind: 'suspend', hours: 24 * 8, ...base })).rejects.toMatchObject({
      code: 'NOT_ADMIN',
    });
    await expect(run(mod.id, applySanction, { player: b.id, kind: 'mute', hours: 721, ...base })).rejects.toMatchObject({
      code: 'NOT_ADMIN',
    });
    await expect(run(mod.id, applySanction, { player: b.id, kind: 'mute', ...base })).rejects.toMatchObject({ code: 'NOT_ADMIN' }); // sans fin
    await expect(run(mod.id, applySanction, { player: admin.id, kind: 'mute', hours: 1, ...base })).rejects.toMatchObject({
      code: 'SANCTION_FORBIDDEN',
    });
    await expect(run(mod.id, applySanction, { player: mod2.id, kind: 'mute', hours: 1, ...base })).rejects.toMatchObject({
      code: 'SANCTION_FORBIDDEN',
    });
    await expect(run(mod.id, applySanction, { player: mod.id, kind: 'mute', hours: 1, ...base })).rejects.toMatchObject({
      code: 'SANCTION_FORBIDDEN',
    });
    await expect(run(admin.id, applySanction, { player: admin.id, kind: 'mute', hours: 1, ...base })).rejects.toMatchObject({
      code: 'SANCTION_FORBIDDEN',
    });
    await run(admin.id, applySanction, { player: mod2.id, kind: 'mute', hours: 1, ...base }); // un administrateur peut sanctionner un modérateur
    await expect(run(mod.id, applySanction, { player: b.id, kind: 'mute', hours: 1, reason: 'x' })).rejects.toMatchObject({
      code: 'INVALID_INPUT',
    });
  });

  it('suspension : coupe les sessions, interdit la connexion, se lève à son terme', async () => {
    const [mod, b] = [await newPlayer('moderator'), await newPlayer()];
    await login(t.db, { email: b.email, password: 'motdepasse-long' }, {});
    expect(
      await t.db
        .selectFrom('session')
        .select('session.id')
        .innerJoin('account', 'account.id', 'session.account_id')
        .where('email', '=', b.email)
        .execute(),
    ).toHaveLength(1);
    const until = Date.now() + 3 * 3600_000;
    // La suspension est jugée sur l'horloge réelle : on la place dans le futur proche.
    await executeCommand({ db: t.db, rateLimiter: noRateLimit, publish: () => {}, content, clock: () => new Date() }, applySanction, {
      playerId: mod.id,
      input: { player: b.id, kind: 'suspend', hours: 3, reason: 'comportement' },
    });
    expect(await accountStatus(b)).toBe('suspended');
    expect(
      await t.db
        .selectFrom('session')
        .select('session.id')
        .innerJoin('account', 'account.id', 'session.account_id')
        .where('email', '=', b.email)
        .execute(),
    ).toHaveLength(0);
    await expect(login(t.db, { email: b.email, password: 'motdepasse-long' }, {})).rejects.toMatchObject({ code: 'ACCOUNT_SUSPENDED' });
    expect(await liftExpiredSuspensions(t.db)).toBe(0); // pas encore terminée

    // Terme atteint : le worker (ou la connexion) lève la suspension.
    await t.db
      .updateTable('sanction')
      .set({ until_at: new Date(Date.now() - 1000) })
      .where('player_id', '=', b.id)
      .execute();
    await login(t.db, { email: b.email, password: 'motdepasse-long' }, {}); // levée à la connexion
    expect(await accountStatus(b)).toBe('active');
    expect(until).toBeGreaterThan(Date.now());

    // Via le worker.
    await executeCommand({ db: t.db, rateLimiter: noRateLimit, publish: () => {}, content, clock: () => new Date() }, applySanction, {
      playerId: mod.id,
      input: { player: b.id, kind: 'suspend', hours: 1, reason: 'récidive' },
    });
    await t.db
      .updateTable('sanction')
      .set({ until_at: new Date(Date.now() - 1000) })
      .where('player_id', '=', b.id)
      .execute();
    expect(await liftExpiredSuspensions(t.db)).toBeGreaterThanOrEqual(1);
    expect(await accountStatus(b)).toBe('active');
  });

  it('bannissement : réservé aux administrateurs, sans terme, levé seulement par eux', async () => {
    const [mod, admin, b] = [await newPlayer('moderator'), await newPlayer('admin'), await newPlayer()];
    const s = await run(admin.id, applySanction, { player: b.id, kind: 'ban', hours: 1, reason: 'triche avérée' });
    const row = await t.db.selectFrom('sanction').selectAll().where('id', '=', s.id).executeTakeFirstOrThrow();
    expect(row.until_at).toBeNull(); // la durée est ignorée : un bannissement n'a pas de terme
    expect(await accountStatus(b)).toBe('banned');
    await expect(login(t.db, { email: b.email, password: 'motdepasse-long' }, {})).rejects.toMatchObject({ code: 'ACCOUNT_SUSPENDED' });
    expect(await liftExpiredSuspensions(t.db)).toBe(0);
    await expect(run(mod.id, liftSanction, { sanction: s.id })).rejects.toMatchObject({ code: 'NOT_ADMIN' });
    await run(admin.id, liftSanction, { sanction: s.id });
    expect(await accountStatus(b)).toBe('active');
    await login(t.db, { email: b.email, password: 'motdepasse-long' }, {});
  });

  it('traite un signalement : sanction motivée, décision visible des deux côtés, journal d’administration', async () => {
    const [mod, a, b] = [await newPlayer('moderator'), await newPlayer(), await newPlayer()];
    const m = await run(b.id, sayInRegion, { text: 'message abusif' });
    const r = await run(a.id, createReport, { kind: 'chat', ref: m.id, reason: 'insulte' });
    events.length = 0;
    const s = await run(mod.id, applySanction, { player: b.id, kind: 'mute', hours: 24, reason: 'insulte caractérisée', report: r.id });

    const closed = (await reportQueue(t.db, 'closed')).find((x) => x.id === r.id)!;
    expect(closed).toMatchObject({ status: 'closed', handledBy: mod.pseudo });
    expect(closed.decision).toContain('insulte caractérisée');
    expect((await notifs(a, 'report.closed'))[0]!.data).toMatchObject({ report: r.id });
    expect((await notifs(b, 'sanction.applied'))[0]!.data).toMatchObject({ kind: 'mute', reason: 'insulte caractérisée' });
    expect(events.find((e) => e.type === 'sanction.applied')).toMatchObject({ topic: `user:${b.id}` });

    await run(mod.id, deleteChatMessage, { message: m.id });
    expect((await chatHistory(t.db, a.id, 'ronces')).map((x) => x.id)).not.toContain(m.id);
    await expect(run(mod.id, deleteChatMessage, { message: m.id })).rejects.toMatchObject({ code: 'MESSAGE_NOT_FOUND' });

    const log = await t.db.selectFrom('admin_action').selectAll().where('actor_id', '=', mod.id).orderBy('id').execute();
    expect(log.map((x) => x.action)).toEqual(['sanction.mute', 'chat.delete']);
    expect(log[0]!.target_id).toBe(b.id);
    expect(log[0]!.data).toMatchObject({ sanction: s.id, report: r.id });

    const file = (await playerFile(t.db, b.id, T0))!;
    expect(file.reportsAgainst).toBe(1);
    expect(file.recentChat[0]).toMatchObject({ id: m.id, deleted: true });
  });

  it('clôture un signalement sans sanction, avec décision motivée', async () => {
    const [mod, a, b] = [await newPlayer('moderator'), await newPlayer(), await newPlayer()];
    const r = await run(a.id, createReport, { kind: 'player', pseudo: b.pseudo, reason: 'autre' });
    await expect(run(mod.id, closeReport, { report: r.id, decision: 'x' })).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    await run(mod.id, closeReport, { report: r.id, decision: 'Aucun manquement constaté.' });
    expect((await notifs(a, 'report.closed'))[0]!.data).toEqual({ report: r.id, decision: 'Aucun manquement constaté.' });
    await expect(run(mod.id, closeReport, { report: r.id, decision: 'Déjà traité.' })).rejects.toMatchObject({ code: 'REPORT_NOT_FOUND' });
  });
});

describe('rétention', () => {
  it('purge le chat après 7 jours et les messages privés après 90 jours', async () => {
    const [a, b] = [await newPlayer(), await newPlayer()];
    const day = 86_400_000;
    const mk = (age: number) => new Date(T0.getTime() - age * day);
    const chat = async (ageDays: number) =>
      (
        await t.db
          .insertInto('chat_message')
          .values({ region: 'zone_purge', author_id: a.id, body: `âge ${ageDays}`, created_at: mk(ageDays) })
          .returning('id')
          .executeTakeFirstOrThrow()
      ).id;
    const dm = async (ageDays: number) =>
      (
        await t.db
          .insertInto('direct_message')
          .values({ sender_id: a.id, recipient_id: b.id, body: `âge ${ageDays}`, created_at: mk(ageDays) })
          .returning('id')
          .executeTakeFirstOrThrow()
      ).id;
    const [c6, c8, d80, d100] = [await chat(6), await chat(8), await dm(80), await dm(100)];
    const r = await purgeSocial(t.db, T0);
    expect(r.chat).toBeGreaterThanOrEqual(1);
    expect(r.direct).toBeGreaterThanOrEqual(1);
    const left = async (table: 'chat_message' | 'direct_message', ids: number[]) =>
      (await t.db.selectFrom(table).select('id').where('id', 'in', ids).execute()).map((x) => x.id);
    expect(await left('chat_message', [c6, c8])).toEqual([c6]);
    expect(await left('direct_message', [d80, d100])).toEqual([d80]);
  });
});

/** Comme `run`, mais en exigeant une adresse e-mail vérifiée (réglage de production). */
function runStrict<S extends z.ZodType, R>(pid: number, def: CommandDef<S, R>, input: unknown = {}, now: Date = T0): Promise<R> {
  return executeCommand(
    { db: t.db, rateLimiter: noRateLimit, publish: () => {}, content, random: () => 9, clock: () => now, requireVerifiedEmail: true },
    def,
    { playerId: pid, input },
  );
}
const verify = (p: P) => t.db.updateTable('account').set({ email_verified_at: new Date() }).where('email', '=', p.email).execute();

describe('adresse e-mail vérifiée (guide 13.1)', () => {
  it('ferme le chat, les messages privés, les demandes d’amis et la mise en vente tant que l’adresse n’est pas vérifiée', async () => {
    const [a, b] = [await newPlayer(), await newPlayer()];
    await t.db.transaction().execute((x) => addStack(x, content, a.id, 'BANK', 'croc_loup', 5, 'SYSTEM', 'test'));
    const refused = { code: 'EMAIL_NOT_VERIFIED' };
    await expect(runStrict(a.id, sayInRegion, { text: 'bonjour' })).rejects.toMatchObject(refused);
    await expect(runStrict(a.id, sendDirect, { to: b.pseudo, text: 'bonjour' })).rejects.toMatchObject(refused);
    await expect(runStrict(a.id, requestFriend, { pseudo: b.pseudo })).rejects.toMatchObject(refused);
    await expect(runStrict(a.id, listGoods, { kind: 'stack', item: 'croc_loup', qty: 1, price: 100 })).rejects.toMatchObject(refused);
    // Sans l'exigence (réglage du serveur), rien n'est fermé.
    await run(a.id, sayInRegion, { text: 'bonjour' });
  });

  it('ouvre tout dès que l’adresse est vérifiée', async () => {
    const [a, b] = [await newPlayer(), await newPlayer()];
    await t.db.transaction().execute((x) => addStack(x, content, a.id, 'BANK', 'croc_loup', 5, 'SYSTEM', 'test'));
    await verify(a);
    await runStrict(a.id, sayInRegion, { text: 'bonjour' });
    await runStrict(a.id, sendDirect, { to: b.pseudo, text: 'bonjour' }, at(5));
    await runStrict(a.id, requestFriend, { pseudo: b.pseudo });
    await runStrict(a.id, listGoods, { kind: 'stack', item: 'croc_loup', qty: 1, price: 100 });
  });
});

describe('liens dans le chat (README 25)', () => {
  const equipBase = Object.keys(content.pack.equip)[0]!;
  async function owner() {
    const p = await newPlayer();
    await run(p.id, ensureStarted);
    const item = await t.db
      .transaction()
      .execute((x) => addInstance(x, content, p.id, 'BANK', { uid: '', base: equipBase, roll: 70, stats: [] }, 'start', 'test'));
    const troop = await t.db
      .selectFrom('troop')
      .select(['id', 'type'])
      .where('player_id', '=', p.id)
      .orderBy('id')
      .executeTakeFirstOrThrow();
    return { p, item: item!, troop };
  }

  it('cite un objet, une troupe et une annonce : références gardées, libellés fixés à l’envoi', async () => {
    const { p, item, troop } = await owner();
    await t.db.transaction().execute((x) => addStack(x, content, p.id, 'BANK', 'croc_loup', 5, 'SYSTEM', 'test'));
    const listing = await run(p.id, listGoods, { kind: 'stack', item: 'croc_loup', qty: 2, price: 100 });
    const links = [
      { kind: 'item', id: item },
      { kind: 'troop', id: troop.id },
      { kind: 'listing', id: listing.listing },
    ];
    const r = await run(p.id, sayInRegion, { text: 'Regardez ça', links }, at(100));
    const line = (await chatHistory(t.db, p.id, 'ronces')).find((l) => l.id === r.id)!;
    expect(line.links.map(({ kind, id }) => ({ kind, id }))).toEqual(links);
    expect(line.links[0]!.label).toBe(content.pack.equip[equipBase]!.name);
    expect(line.links[1]!.label).toMatch(/niv\. 1$/);
    expect(line.links[2]!.label).toMatch(/× 2 · 100 or$/);
    // Dans un message privé aussi ; un doublon n'est gardé qu'une fois.
    const q = await newPlayer();
    await run(p.id, sendDirect, { to: q.pseudo, text: 'Pour toi', links: [links[0], links[0]] }, at(200));
    const thread = await directThread(t.db, q.id, p.id);
    expect(thread.at(-1)!.links.map((l) => l.id)).toEqual([item]);
  });

  it('refuse de citer le bien d’un autre, un bien inexistant, une annonce close ou trop de liens', async () => {
    const [a, b] = [await owner(), await owner()];
    const bad = { code: 'LINK_INVALID' };
    await expect(run(a.p.id, sayInRegion, { text: 'x', links: [{ kind: 'item', id: b.item }] }, at(300))).rejects.toMatchObject(bad);
    await expect(run(a.p.id, sayInRegion, { text: 'x', links: [{ kind: 'troop', id: b.troop.id }] }, at(301))).rejects.toMatchObject(bad);
    await expect(run(a.p.id, sayInRegion, { text: 'x', links: [{ kind: 'listing', id: 999999 }] }, at(302))).rejects.toMatchObject(bad);
    await expect(run(a.p.id, sayInRegion, { text: 'x', links: [{ kind: 'item', id: 999999 }] }, at(303))).rejects.toMatchObject(bad);
    const four = [1, 2, 3, 4].map((id) => ({ kind: 'item', id }));
    await expect(run(a.p.id, sayInRegion, { text: 'x', links: four }, at(304))).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    // Un refus ne publie rien.
    expect((await chatHistory(t.db, a.p.id, 'ronces')).some((l) => l.text === 'x')).toBe(false);
  });

  it('n’ouvre la fiche qu’à qui voit un message qui la cite', async () => {
    const [a, b, c] = [await owner(), await newPlayer(), await newPlayer()];
    const ref = { kind: 'item' as const, id: a.item };
    expect(await canOpenLink(t.db, b.id, ref.kind, ref.id)).toBe(false); // jamais cité : rien à voir
    const said = await run(a.p.id, sayInRegion, { text: 'Mon objet', links: [ref] }, at(400));
    expect(await canOpenLink(t.db, b.id, ref.kind, ref.id)).toBe(true);
    await run(b.id, blockPlayer, { pseudo: a.p.pseudo });
    expect(await canOpenLink(t.db, b.id, ref.kind, ref.id)).toBe(false); // l'auteur est bloqué : message masqué
    expect(await canOpenLink(t.db, c.id, ref.kind, ref.id)).toBe(true);
    const mod = await newPlayer('moderator');
    await run(mod.id, deleteChatMessage, { message: said.id });
    expect(await canOpenLink(t.db, c.id, ref.kind, ref.id)).toBe(false); // message supprimé
    // Message privé : seuls l'expéditeur et le destinataire.
    const troop = { kind: 'troop' as const, id: a.troop.id };
    await run(a.p.id, sendDirect, { to: c.pseudo, text: 'Entre nous', links: [troop] }, at(500));
    expect(await canOpenLink(t.db, c.id, troop.kind, troop.id)).toBe(true);
    expect(await canOpenLink(t.db, a.p.id, troop.kind, troop.id)).toBe(true);
    expect(await canOpenLink(t.db, b.id, troop.kind, troop.id)).toBe(false);
  });

  it('rend les fiches lues en base : objet, troupe, annonce, et bien disparu', async () => {
    const { p, item, troop } = await owner();
    const objet = await ficheOf(t.db, content, 'item', item);
    expect(objet).toMatchObject({ kind: 'item', name: content.pack.equip[equipBase]!.name, roll: 70, owner: p.pseudo });
    const unite = await ficheOf(t.db, content, 'troop', troop.id);
    expect(unite).toMatchObject({ kind: 'troop', level: 1, owner: p.pseudo });
    expect(unite!.kind === 'troop' && unite!.units.length).toBeGreaterThan(0);
    expect(unite!.kind === 'troop' && unite!.skills.length).toBeGreaterThan(0);
    await t.db.transaction().execute((x) => addStack(x, content, p.id, 'BANK', 'croc_loup', 5, 'SYSTEM', 'test'));
    const l = await run(p.id, listGoods, { kind: 'stack', item: 'croc_loup', qty: 1, price: 100 });
    expect(await ficheOf(t.db, content, 'listing', l.listing)).toMatchObject({
      kind: 'listing',
      price: 100,
      status: 'active',
      seller: p.pseudo,
    });
    expect(await ficheOf(t.db, content, 'item', 999999)).toBeNull();
    expect(await ficheOf(t.db, content, 'troop', 999999)).toBeNull();
    expect(await ficheOf(t.db, content, 'listing', 999999)).toBeNull();
  });

  it('lit « type:id » sans se laisser tromper', () => {
    expect(parseLink('item:12')).toEqual({ kind: 'item', id: 12 });
    for (const bad of ['', 'item', 'item:', 'item:-1', 'item:1.5', 'autre:3', 'item:1;drop', ' item:1', undefined, 12])
      expect(parseLink(bad)).toBeNull();
  });
});

describe('renommage forcé (guide 12)', () => {
  it('remplace le pseudo, prévient le joueur, qui en choisit un nouveau une seule fois', async () => {
    const [mod, a, b] = [await newPlayer('moderator'), await newPlayer(), await newPlayer()];
    const old = b.pseudo;
    const provisional = `Aventurier ${b.id}`;
    await expect(run(a.id, forceRename, { player: b.id, reason: 'pseudo injurieux' })).rejects.toMatchObject({ code: 'NOT_MODERATOR' });
    await expect(run(b.id, choosePseudo, { pseudo: 'Libre Choix' })).rejects.toMatchObject({ code: 'RENAME_NOT_ALLOWED' });
    const r = await run(a.id, createReport, { kind: 'player', pseudo: old, reason: 'insulte' });
    events.length = 0;

    expect(await run(mod.id, forceRename, { player: b.id, reason: 'pseudo injurieux', report: r.id })).toEqual({ pseudo: provisional });
    const row = await t.db.selectFrom('player').select(['pseudo', 'rename_required']).where('id', '=', b.id).executeTakeFirstOrThrow();
    expect(row).toEqual({ pseudo: provisional, rename_required: true });
    expect((await notifs(b, 'pseudo.renamed'))[0]!.data).toMatchObject({ from: old, to: provisional, reason: 'pseudo injurieux' });
    expect(events.find((e) => e.type === 'pseudo.renamed')).toMatchObject({ topic: `user:${b.id}` });
    expect((await reportQueue(t.db, 'closed')).find((x) => x.id === r.id)?.decision).toContain('Pseudo remplacé');
    const log = await t.db.selectFrom('admin_action').select(['action', 'data']).where('actor_id', '=', mod.id).execute();
    expect(log[0]).toMatchObject({ action: 'player.rename', data: { from: old, to: provisional } });

    // Le choix suit les règles des pseudos, et un pseudo pris (casse ignorée) est refusé.
    await expect(run(b.id, choosePseudo, { pseudo: 'Admin du jeu' })).rejects.toMatchObject({ code: 'PSEUDO_FORBIDDEN' });
    await expect(run(b.id, choosePseudo, { pseudo: a.pseudo.toUpperCase() })).rejects.toMatchObject({ code: 'PSEUDO_TAKEN' });
    expect(await run(b.id, choosePseudo, { pseudo: '  Nouveau  Nom ' })).toEqual({ pseudo: 'Nouveau Nom' });
    await expect(run(b.id, choosePseudo, { pseudo: 'Encore Un' })).rejects.toMatchObject({ code: 'RENAME_NOT_ALLOWED' });
  });

  it('accepte un pseudo provisoire choisi, avec les règles de rôle des sanctions', async () => {
    const [mod, mod2, admin, b] = [await newPlayer('moderator'), await newPlayer('moderator'), await newPlayer('admin'), await newPlayer()];
    await expect(run(mod.id, forceRename, { player: b.id, pseudo: mod2.pseudo, reason: 'test' })).rejects.toMatchObject({
      code: 'PSEUDO_TAKEN',
    });
    await expect(run(mod.id, forceRename, { player: b.id, pseudo: 'a<b', reason: 'test' })).rejects.toMatchObject({
      code: 'PSEUDO_INVALID',
    });
    expect(await run(mod.id, forceRename, { player: b.id, pseudo: 'Voyageur Calme', reason: 'pseudo trompeur' })).toEqual({
      pseudo: 'Voyageur Calme',
    });
    await expect(run(mod.id, forceRename, { player: mod2.id, reason: 'test' })).rejects.toMatchObject({ code: 'SANCTION_FORBIDDEN' });
    await expect(run(mod.id, forceRename, { player: admin.id, reason: 'test' })).rejects.toMatchObject({ code: 'SANCTION_FORBIDDEN' });
    await expect(run(mod.id, forceRename, { player: mod.id, reason: 'test' })).rejects.toMatchObject({ code: 'SANCTION_FORBIDDEN' });
    await run(admin.id, forceRename, { player: mod2.id, reason: 'pseudo trompeur' });
  });
});
