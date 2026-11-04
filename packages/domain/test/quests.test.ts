/** Quêtes (J3, README 9.2 et 9.3) : génération, rendu, récompenses, renoncement, ville de la quête. */
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { z } from 'zod';
import { validateContent } from '@cr/content';
import { genQuest } from '@cr/gen';
import type { GenContent, Quest } from '@cr/gen';
import { startTestDb, type TestDb } from '@cr/testing';
import {
  abandonQuest,
  addStack,
  balance,
  ensureStarted,
  executeCommand,
  loadTroops,
  memoryMailer,
  noRateLimit,
  signup,
  turnInQuest,
  type CommandDef,
  type GameContent,
} from '../src/index.ts';

const compiled = validateContent(join(import.meta.dirname, '../../../content'));
const content: GameContent = { pack: compiled.pack as unknown as GenContent, hash: compiled.hash! };
let t: TestDb;
let n = 0;
function run<S extends z.ZodType, R>(pid: number, def: CommandDef<S, R>, input: unknown = {}): Promise<R> {
  return executeCommand({ db: t.db, rateLimiter: noRateLimit, publish: () => {}, content, random: () => 5 }, def, { playerId: pid, input });
}
async function newPlayer(): Promise<{ pid: number; seed: number }> {
  n++;
  await signup(
    { db: t.db, mailer: memoryMailer(), appUrl: 'http://test' },
    { email: `q${n}@example.org`, pseudo: `Quete ${n}`, password: 'motdepasse-long', acceptTos: true },
  );
  const p = await t.db.selectFrom('player').select(['id', 'seed']).where('pseudo', '=', `Quete ${n}`).executeTakeFirstOrThrow();
  await run(p.id, ensureStarted);
  return { pid: p.id, seed: p.seed };
}
const offered = (pid: number, region?: string) =>
  t.db
    .selectFrom('quest')
    .select(['id', 'region', 'n', 'data'])
    .where('player_id', '=', pid)
    .where('status', '=', 'offered')
    .$if(!!region, (qb) => qb.where('region', '=', region!))
    .orderBy('n')
    .execute();
const gold = (pid: number) => t.db.transaction().execute((x) => balance(x, pid));
async function give(pid: number, items: [string, number][]): Promise<void> {
  await t.db.transaction().execute(async (tx) => {
    for (const [id, k] of items) await addStack(tx, content, pid, 'BANK', id, k, 'SYSTEM', 'test');
  });
}

beforeAll(async () => {
  expect(compiled.ok).toBe(true);
  t = await startTestDb();
});
afterAll(async () => t?.stop());

describe('quêtes (README 9.2, 9.3)', () => {
  it('5 par ville dès le début, tirées de la graine du joueur', async () => {
    const { pid, seed } = await newPlayer();
    for (const [i, R] of content.pack.regions.entries()) {
      const qs = await offered(pid, R.id);
      expect(qs.map((q) => q.n)).toEqual([0, 1, 2, 3, 4]);
      expect(qs[0]!.data).toEqual(JSON.parse(JSON.stringify(genQuest(content.pack, seed, i, 0))));
    }
    await run(pid, ensureStarted); // idempotent
    expect(await offered(pid)).toHaveLength(5 * content.pack.regions.length);
  });

  it('se rend avec les trophées, verse or et récompense, et laisse place à la suivante', async () => {
    const { pid } = await newPlayer();
    const [q] = await offered(pid, 'ronces');
    const data = q!.data as Quest;
    await expect(run(pid, turnInQuest, { quest: q!.id })).rejects.toMatchObject({ code: 'NOT_ENOUGH_ITEMS' });
    await give(pid, data.needs);
    const before = await gold(pid);
    const r = await run(pid, turnInQuest, { quest: q!.id });
    expect(r.gold).toBe(data.gold);
    expect(await gold(pid)).toBe(before + data.gold);
    const rows = await offered(pid, 'ronces');
    expect(rows.map((x) => x.n)).toEqual([1, 2, 3, 4, 5]);
    expect((await t.db.selectFrom('quest').select('status').where('id', '=', q!.id).executeTakeFirstOrThrow()).status).toBe('done');
    // Récompense versée selon sa sorte.
    if (data.reward.kind === 'troop')
      expect(
        (await t.db.transaction().execute((x) => loadTroops(x, pid))).some((x) => x.type === (data.reward as { type: string }).type),
      ).toBe(true);
    if (data.reward.kind === 'equip')
      expect(
        (
          await t.db
            .selectFrom('item_instance')
            .select('roll')
            .where('player_id', '=', pid)
            .where('origin', '=', 'quest')
            .executeTakeFirstOrThrow()
        ).roll,
      ).toBe(data.reward.roll);
  });

  it('chaque sorte de récompense est versée', async () => {
    const seen = new Set<string>();
    for (let k = 0; k < 6 && seen.size < 3; k++) {
      const { pid } = await newPlayer();
      for (const q of await offered(pid, 'ronces')) {
        const data = q.data as Quest;
        if (seen.has(data.reward.kind)) continue;
        await give(pid, data.needs);
        await run(pid, turnInQuest, { quest: q.id });
        seen.add(data.reward.kind);
      }
    }
    expect([...seen].sort()).toEqual(['equip', 'items', 'troop']);
  });

  it('se rend dans sa ville, et renoncer coûte 10 or × palier', async () => {
    const { pid } = await newPlayer();
    const [far] = await offered(pid, 'marais');
    await give(pid, (far!.data as Quest).needs);
    await expect(run(pid, turnInQuest, { quest: far!.id })).rejects.toMatchObject({
      code: 'QUEST_ELSEWHERE',
      details: { ville: 'Port-Salant' },
    });
    const [q] = await offered(pid, 'ronces');
    const before = await gold(pid);
    expect(await run(pid, abandonQuest, { quest: q!.id })).toEqual({ cost: 10 });
    expect(await gold(pid)).toBe(before - 10);
    expect(await offered(pid, 'ronces')).toHaveLength(5);
  });
});

describe('quêtes de donjon (README 23.7)', () => {
  it('une quête de Havre-Gris demande un trophée de boss, et se rend comme les autres, prime doublée', async () => {
    const { pid, seed } = await newPlayer();
    const qs = await offered(pid, 'ronces');
    // Havre-Gris touche les Prés de Brande (Terriers du Roi Kobold) : on cherche une quête de donjon parmi les suivantes.
    let found = qs.map((x) => ({ id: x.id, q: x.data as Quest })).find((x) => x.q.dungeon);
    for (let k = qs.length; !found && k < 200; k++) {
      const g = genQuest(content.pack, seed, 0, k);
      if (g.dungeon) {
        // Remplace la première quête proposée par celle-ci, comme si elle venait d'être tirée.
        await t.db
          .updateTable('quest')
          .set({ data: JSON.stringify(g) })
          .where('id', '=', qs[0]!.id)
          .execute();
        found = { id: qs[0]!.id, q: g };
      }
    }
    expect(found).toBeDefined();
    const dq = found!.q;
    expect(dq.dungeon).toBe('terriers_roi_kobold');
    expect(dq.needs).toHaveLength(1);
    expect(['trophee_taupe_reine', 'trophee_chef_gratte_gratte', 'trophee_roi_kobold']).toContain(dq.needs[0]![0]);
    expect(['equip', 'troop']).toContain(dq.reward.kind);
    expect(await run(pid, turnInQuest, { quest: found!.id }).catch((e: { code: string }) => e.code)).toBe('NOT_ENOUGH_ITEMS');
    await give(pid, [[dq.needs[0]![0], 1]]);
    const before = await gold(pid);
    await run(pid, turnInQuest, { quest: found!.id });
    expect(await gold(pid)).toBe(before + dq.gold);
    const row = await t.db.selectFrom('quest').select('status').where('id', '=', found!.id).executeTakeFirstOrThrow();
    expect(row.status).toBe('done');
  });
});
