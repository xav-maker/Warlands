/** Corrections d'administration (guide 19.5, procédure 4) : par le grand livre et l'inventaire, motivées, journalisées. */
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { validateContent } from '@cr/content';
import type { GenContent } from '@cr/gen';
import { startTestDb, type TestDb } from '@cr/testing';
import {
  balance,
  checkInvariants,
  correctGold,
  correctItem,
  ensureStarted,
  executeCommand,
  memoryMailer,
  noRateLimit,
  signup,
  stackQty,
  type GameContent,
} from '../src/index.ts';

const compiled = validateContent(join(import.meta.dirname, '../../../content'));
const content: GameContent = { pack: compiled.pack as unknown as GenContent, hash: compiled.hash! };
let t: TestDb;
let pid = 0;
const email = 'corrige@example.org';

beforeAll(async () => {
  t = await startTestDb();
  await signup(
    { db: t.db, mailer: memoryMailer(), appUrl: 'http://test' },
    { email, pseudo: 'Lese', password: 'motdepasse-long', acceptTos: true },
  );
  pid = (await t.db.selectFrom('player').select('id').where('pseudo', '=', 'Lese').executeTakeFirstOrThrow()).id;
  await executeCommand({ db: t.db, rateLimiter: noRateLimit, publish: () => {}, content }, ensureStarted, { playerId: pid, input: {} });
});
afterAll(async () => t?.stop());

const err = (p: Promise<unknown>) => p.then(() => 'ok').catch((e: { code?: string }) => e.code ?? String(e));
const gold = () => t.db.transaction().execute((tx) => balance(tx, pid));

describe('corrections d’administration', () => {
  it('rend et retire de l’or par le grand livre, jamais sous zéro', async () => {
    const g0 = await gold();
    expect(await correctGold(t.db, { email: ' CORRIGE@example.org ', amount: 150, reason: 'achat perdu (incident 12)' })).toEqual({
      player: 'Lese',
      amount: 150,
    });
    expect(await gold()).toBe(g0 + 150);
    await correctGold(t.db, { email, amount: -50, reason: 'doublon de remboursement' });
    expect(await gold()).toBe(g0 + 100);
    expect(await err(correctGold(t.db, { email, amount: -1_000_000, reason: 'retrait trop grand' }))).toBe('NOT_ENOUGH_GOLD');
    expect(await err(correctGold(t.db, { email, amount: 10, reason: 'x' }))).toBe('INVALID_INPUT'); // motif exigé
    expect(await err(correctGold(t.db, { email: 'personne@example.org', amount: 10, reason: 'motif valable' }))).toBe('PLAYER_NOT_FOUND');
    const entries = await t.db.selectFrom('gold_entry').select('reason').where('reason', 'like', 'correction : %').execute();
    expect(entries.length).toBe(4); // deux corrections, deux lignes chacune
  });

  it('rend et retire des objets en banque, journalisé', async () => {
    const q0 = await t.db.transaction().execute((tx) => stackQty(tx, pid, 'BANK', 'bois_tordu'));
    await correctItem(t.db, content, { email, item: 'bois_tordu', qty: 7, reason: 'butin perdu (incident 13)' });
    expect(await t.db.transaction().execute((tx) => stackQty(tx, pid, 'BANK', 'bois_tordu'))).toBe(q0 + 7);
    await correctItem(t.db, content, { email, item: 'bois_tordu', qty: -3, reason: 'doublon' });
    expect(await t.db.transaction().execute((tx) => stackQty(tx, pid, 'BANK', 'bois_tordu'))).toBe(q0 + 4);
    expect(await err(correctItem(t.db, content, { email, item: 'bois_tordu', qty: -1000, reason: 'trop retiré' }))).toBe(
      'NOT_ENOUGH_ITEMS',
    );
    expect(await err(correctItem(t.db, content, { email, item: 'inconnu', qty: 1, reason: 'objet inconnu' }))).toBe('ITEM_NOT_FOUND');
    const log = await t.db.selectFrom('admin_action').select(['action', 'data']).where('target_id', '=', pid).orderBy('id').execute();
    expect(log.map((l) => l.action)).toEqual(['correction.gold', 'correction.gold', 'correction.item', 'correction.item']);
    expect(log[2]!.data).toMatchObject({ item: 'bois_tordu', qty: 7, reason: 'butin perdu (incident 13)', by: 'cli' });
    expect(await checkInvariants(t.db, content)).toEqual([]);
  });
});
