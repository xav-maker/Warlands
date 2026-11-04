/**
 * Données personnelles (guide 14) : l'export rend les données du joueur (et seulement les siennes) ; la suppression
 * anonymise le compte, efface messages, liens sociaux et sessions, remet la partie à zéro, et garde le grand livre.
 */
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { z } from 'zod';
import { sql } from '@cr/db';
import { validateContent } from '@cr/content';
import type { GenContent } from '@cr/gen';
import { startTestDb, type TestDb } from '@cr/testing';
import {
  acceptFriend,
  checkInvariants,
  deleteAccount,
  ensureStarted,
  executeCommand,
  exportData,
  login,
  memoryMailer,
  noRateLimit,
  requestFriend,
  sayInRegion,
  sendDirect,
  signup,
  type CommandDef,
  type GameContent,
} from '../src/index.ts';

const compiled = validateContent(join(import.meta.dirname, '../../../content'));
const content: GameContent = { pack: compiled.pack as unknown as GenContent, hash: compiled.hash! };
let t: TestDb;
let now = new Date('2026-11-06T10:00:00Z');

beforeAll(async () => {
  t = await startTestDb();
});
afterAll(async () => t?.stop());

function run<S extends z.ZodType, R>(pid: number, def: CommandDef<S, R>, input: unknown = {}): Promise<R> {
  now = new Date(now.getTime() + 5000); // passe la limite d'un message par seconde
  return executeCommand({ db: t.db, rateLimiter: noRateLimit, publish: () => {}, content, clock: () => now, random: () => 3 }, def, {
    playerId: pid,
    input,
  });
}
async function newPlayer(name: string): Promise<{ pid: number; account: number; email: string }> {
  const email = `${name.toLowerCase()}@example.org`;
  await signup(
    { db: t.db, mailer: memoryMailer(), appUrl: 'http://test' },
    { email, pseudo: name, password: 'motdepasse-long', acceptTos: true },
  );
  const p = await t.db.selectFrom('player').select(['id', 'account_id']).where('pseudo', '=', name).executeTakeFirstOrThrow();
  await run(p.id, ensureStarted);
  return { pid: p.id, account: p.account_id, email };
}
const err = (p: Promise<unknown>) => p.then(() => 'ok').catch((e: { code?: string }) => e.code ?? String(e));

describe('données personnelles', () => {
  it('exporte les données du joueur, messages compris, sans celles des autres', async () => {
    const a = await newPlayer('Aurore');
    const b = await newPlayer('Basile');
    const c = await newPlayer('Coline');
    await run(a.pid, sayInRegion, { text: 'bonjour la région' });
    await run(a.pid, sendDirect, { to: 'Basile', text: 'message pour Basile' });
    await run(b.pid, sendDirect, { to: 'Coline', text: 'secret entre Basile et Coline' });
    await run(a.pid, requestFriend, { pseudo: 'Basile' });
    await run(b.pid, acceptFriend, { player: a.pid });

    const data = (await exportData(t.db, a.account)) as unknown as {
      account: Record<string, unknown>;
      player: Record<string, unknown>;
      troops: unknown[];
      gold: { balance: number; entries: unknown[] };
      chat: { body: string }[];
      directMessages: { body: string }[];
      friends: unknown[];
    };
    expect(data.account).toMatchObject({ email: a.email, twoFactor: false });
    expect(data.player).toMatchObject({ pseudo: 'Aurore' });
    expect(data.troops.length).toBeGreaterThan(0);
    expect(data.gold.balance).toBe(1000);
    expect(data.gold.entries.length).toBeGreaterThan(0);
    expect(data.chat.map((m) => m.body)).toEqual(['bonjour la région']);
    expect(data.directMessages.map((m) => m.body)).toEqual(['message pour Basile']);
    expect(JSON.stringify(data)).not.toContain('secret entre Basile et Coline');
    expect(data.friends).toEqual([expect.objectContaining({ status: 'accepted' })]);
    expect(JSON.stringify(data)).not.toContain('password');
    void c;
  });

  it('supprime le compte : mot de passe exigé, données personnelles effacées, comptabilité gardée', async () => {
    const d = await newPlayer('Damien');
    const e = await newPlayer('Edith');
    await run(d.pid, sendDirect, { to: 'Edith', text: 'à effacer' });
    await run(e.pid, sendDirect, { to: 'Damien', text: 'réponse à effacer' });
    await run(d.pid, sayInRegion, { text: 'mon dernier message' });
    const entries0 = await sql<{ n: number }>`select count(*)::int as n from gold_entry`.execute(t.db);

    expect(await err(run(d.pid, deleteAccount, { password: 'mauvais-mot-de-passe', confirm: 'SUPPRIMER' }))).toBe('BAD_CREDENTIALS');
    expect(await err(run(d.pid, deleteAccount, { password: 'motdepasse-long', confirm: 'oui' }))).toBe('INVALID_INPUT');
    expect(await run(d.pid, deleteAccount, { password: 'motdepasse-long', confirm: 'SUPPRIMER' })).toEqual({ deleted: true });

    const acc = await t.db.selectFrom('account').selectAll().where('id', '=', d.account).executeTakeFirstOrThrow();
    expect(acc).toMatchObject({ status: 'deleted', email: `supprime-${d.account}@invalid`, email_verified_at: null, totp_secret: null });
    expect(acc.password_hash).toBe('!');
    expect(await t.db.selectFrom('player').select('pseudo').where('id', '=', d.pid).executeTakeFirstOrThrow()).toEqual({
      pseudo: `Ancien joueur ${d.pid}`,
    });
    expect(await err(login(t.db, { email: d.email, password: 'motdepasse-long' }, {}))).toBe('BAD_CREDENTIALS');
    // Messages, sessions : effacés. Le pseudo et l'adresse sont libres à nouveau.
    const dms = await sql<{
      n: number;
    }>`select count(*)::int as n from direct_message where sender_id = ${d.pid} or recipient_id = ${d.pid}`.execute(t.db);
    expect(dms.rows[0]!.n).toBe(0);
    const chat = await sql<{ n: number }>`select count(*)::int as n from chat_message where author_id = ${d.pid}`.execute(t.db);
    expect(chat.rows[0]!.n).toBe(0);
    expect(await t.db.selectFrom('session').select('id').where('account_id', '=', d.account).execute()).toEqual([]);
    await signup(
      { db: t.db, mailer: memoryMailer(), appUrl: 'http://test' },
      { email: d.email, pseudo: 'Damien', password: 'autre-mot-de-passe', acceptTos: true },
    );
    // Comptabilité : rien d'effacé, l'or est parti au puits par une écriture.
    const entries = await sql<{ n: number }>`select count(*)::int as n from gold_entry`.execute(t.db);
    expect(entries.rows[0]!.n).toBeGreaterThan(entries0.rows[0]!.n);
    const log = await t.db.selectFrom('admin_action').select('action').where('target_id', '=', d.pid).execute();
    expect(log.map((x) => x.action)).toContain('account.delete');
    expect(await checkInvariants(t.db, content)).toEqual([]);
  });
});
