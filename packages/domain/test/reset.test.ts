/** Recommencer la partie : tout repart de zéro, rien ne sort du journal ; escouade de test. */
import { join } from 'node:path';
import { sql } from 'kysely';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { z } from 'zod';
import { validateContent } from '@cr/content';
import type { GenContent } from '@cr/gen';
import { startTestDb, type TestDb } from '@cr/testing';
import {
  RESET_WORD,
  addStack,
  balance,
  ensureStarted,
  executeCommand,
  giveTestSquad,
  listGoods,
  memoryMailer,
  noRateLimit,
  resetGame,
  signup,
  type CommandDef,
  type GameContent,
} from '../src/index.ts';

const compiled = validateContent(join(import.meta.dirname, '../../../content'));
const content: GameContent = { pack: compiled.pack as unknown as GenContent, hash: compiled.hash! };
let t: TestDb;
function run<S extends z.ZodType, R>(pid: number, def: CommandDef<S, R>, input: unknown = {}): Promise<R> {
  return executeCommand({ db: t.db, rateLimiter: noRateLimit, publish: () => {}, content, random: () => 5 }, def, { playerId: pid, input });
}
const count = async (table: 'item_stack' | 'quest' | 'player_recipe', pid: number) =>
  Number(
    (
      await t.db
        .selectFrom(table)
        .select((eb) => eb.fn.countAll<number>().as('n'))
        .where('player_id', '=', pid)
        .executeTakeFirstOrThrow()
    ).n,
  );
const alive = (pid: number) =>
  t.db.selectFrom('troop').select(['type', 'level', 'container']).where('player_id', '=', pid).where('container', '<>', 'GRAVE').execute();

beforeAll(async () => {
  expect(compiled.ok).toBe(true);
  t = await startTestDb();
});
afterAll(async () => {
  await t?.stop();
});

describe('recommencer la partie', () => {
  it('efface la partie, garde le journal équilibré, puis redonne le kit avec une nouvelle graine', async () => {
    await signup(
      { db: t.db, mailer: memoryMailer(), appUrl: 'http://test' },
      { email: 'reset@example.org', pseudo: 'Recommence', password: 'motdepasse-long', acceptTos: true },
    );
    const before = await t.db.selectFrom('player').select(['id', 'seed']).where('pseudo', '=', 'Recommence').executeTakeFirstOrThrow();
    const pid = before.id;
    await run(pid, ensureStarted);
    await t.db.transaction().execute((tx) => addStack(tx, content, pid, 'BANK', 'bandage', 3, 'SYSTEM', 'test'));
    await run(pid, listGoods, { kind: 'stack', item: 'bandage', qty: 1, price: 50 });
    expect(await count('quest', pid)).toBeGreaterThan(0);
    expect(await count('player_recipe', pid)).toBeGreaterThan(0);

    await expect(run(pid, resetGame, { confirm: 'oui' })).rejects.toBeTruthy();
    expect(await run(pid, resetGame, { confirm: RESET_WORD })).toEqual({ gold: 200 });

    const p = await t.db.selectFrom('player').selectAll().where('id', '=', pid).executeTakeFirstOrThrow();
    expect(p.started_at).toBeNull();
    expect(p.seed).not.toBe(before.seed);
    expect([p.pos_kind, p.pos_region]).toEqual(['city', 'ronces']);
    expect(await t.db.transaction().execute((tx) => balance(tx, pid))).toBe(0);
    expect(await alive(pid)).toEqual([]);
    expect(await count('item_stack', pid)).toBe(0);
    expect(await count('quest', pid)).toBe(0);
    expect(await count('player_recipe', pid)).toBe(0);
    expect((await t.db.selectFrom('shop_listing').select('status').where('seller_id', '=', pid).executeTakeFirstOrThrow()).status).toBe(
      'withdrawn',
    );

    // Conservation : grand livre équilibré, rien de négatif.
    const unbalanced = await sql<{
      n: number;
    }>`select count(*)::int as n from (select tx from gold_entry group by tx having sum(amount) <> 0) x`.execute(t.db);
    expect(unbalanced.rows[0]!.n).toBe(0);
    expect((await sql<{ s: number }>`select coalesce(sum(balance), 0)::int as s from gold_account`.execute(t.db)).rows[0]!.s).toBe(0);

    // La commande suivante redonne le kit de départ, de nouvelles quêtes et recettes.
    await run(pid, ensureStarted);
    expect(await t.db.transaction().execute((tx) => balance(tx, pid))).toBe(200);
    expect((await alive(pid)).length).toBeGreaterThan(0);
    expect(await count('quest', pid)).toBeGreaterThan(0);
    expect(await count('player_recipe', pid)).toBeGreaterThan(0);

    // Escouade de test : six troupes de niveau 30 engagées, les précédentes en caserne.
    const kit = (await alive(pid)).length;
    await run(pid, giveTestSquad);
    const troops = await alive(pid);
    expect(troops.filter((x) => x.container === 'SQUAD').map((x) => x.level)).toEqual([30, 30, 30, 30, 30, 30]);
    expect(troops.filter((x) => x.container === 'BARRACKS')).toHaveLength(kit);
  });
});
