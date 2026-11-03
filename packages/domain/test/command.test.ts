import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { startTestDb, type TestDb } from '@cr/testing';
import { GameError } from '@cr/shared';
import {
  command,
  executeCommand,
  memoryMailer,
  memoryRateLimiter,
  noRateLimit,
  setDungeonAvailable,
  signup,
  type CommandDeps,
  type DomainEvent,
} from '../src/index.ts';

let t: TestDb;
let playerId: number;
const published: DomainEvent[][] = [];
const deps = (over: Partial<CommandDeps> = {}): CommandDeps => ({
  db: t.db,
  rateLimiter: noRateLimit,
  publish: (e) => published.push(e),
  ...over,
});

beforeAll(async () => {
  t = await startTestDb();
  await signup(
    { db: t.db, mailer: memoryMailer(), appUrl: 'http://test' },
    { email: 'cmd@example.org', pseudo: 'Testeur', password: 'motdepasse-long', acceptTos: true },
  );
  playerId = (await t.db.selectFrom('player').select('id').executeTakeFirstOrThrow()).id;
});
afterAll(async () => t?.stop());

const available = async () =>
  await t.db.selectFrom('player').select(['dungeon_available', 'lock_version']).where('id', '=', playerId).executeTakeFirstOrThrow();

describe('squelette de commande', () => {
  it('applique la commande, incrémente lock_version et diffuse après le commit', async () => {
    published.length = 0;
    const r = await executeCommand(deps(), setDungeonAvailable, { playerId, input: { available: true } });
    expect(r).toEqual({ available: true });
    expect(await available()).toEqual({ dungeon_available: true, lock_version: 1 });
    expect(published).toEqual([[{ topic: `user:${playerId}`, type: 'player.updated' }]]);
  });

  it('refuse une entrée invalide sans toucher la base', async () => {
    await expect(executeCommand(deps(), setDungeonAvailable, { playerId, input: { available: 'oui' } })).rejects.toMatchObject({
      code: 'INVALID_INPUT',
    });
  });

  it('annule tout et ne diffuse rien si la commande échoue', async () => {
    published.length = 0;
    const boom = command({
      name: 'test.boom',
      input: z.object({}),
      rate: { perMinute: 10 },
      async run(ctx) {
        await ctx.tx.updateTable('player').set({ dungeon_available: false }).where('id', '=', ctx.player.id).execute();
        ctx.emit({ topic: 'x', type: 'y' });
        throw new GameError('WRONG_POSITION');
      },
    });
    await expect(executeCommand(deps(), boom, { playerId, input: {} })).rejects.toMatchObject({ code: 'WRONG_POSITION' });
    expect((await available()).dungeon_available).toBe(true);
    expect(published).toEqual([]);
  });

  it('rejoue la même réponse pour une même clé, et refuse une clé réutilisée pour autre chose', async () => {
    published.length = 0;
    const key = 'cle-idem-0001';
    const a = await executeCommand(deps(), setDungeonAvailable, { playerId, input: { available: false }, idempotencyKey: key });
    const before = await available();
    const b = await executeCommand(deps(), setDungeonAvailable, { playerId, input: { available: false }, idempotencyKey: key });
    expect(b).toEqual(a);
    expect(await available()).toEqual(before); // pas réappliquée
    expect(published.length).toBe(1); // pas rediffusée
    await expect(
      executeCommand(deps(), setDungeonAvailable, { playerId, input: { available: true }, idempotencyKey: key }),
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
  });

  it('un double clic simultané avec la même clé ne s’applique qu’une fois', async () => {
    const before = (await available()).lock_version;
    const call = () =>
      executeCommand(deps(), setDungeonAvailable, { playerId, input: { available: true }, idempotencyKey: 'double-clic-01' });
    const [x, y] = await Promise.all([call(), call()]);
    expect(x).toEqual(y);
    expect((await available()).lock_version).toBe(before + 1);
  });

  it('les commandes concurrentes d’un même joueur sont sérialisées par le verrou', async () => {
    const before = (await available()).lock_version;
    await Promise.all(
      Array.from({ length: 8 }, (_, i) => executeCommand(deps(), setDungeonAvailable, { playerId, input: { available: i % 2 === 0 } })),
    );
    expect((await available()).lock_version).toBe(before + 8);
  });

  it('contrôle la position et le blocage de rediffusion', async () => {
    const onRoute = command({ name: 'test.route', input: z.object({}), rate: { perMinute: 10 }, where: ['route'], run: async () => 1 });
    await expect(executeCommand(deps(), onRoute, { playerId, input: {} })).rejects.toMatchObject({ code: 'WRONG_POSITION' });

    await t.db
      .updateTable('player')
      .set({ watch_until: new Date(Date.now() + 60_000) })
      .where('id', '=', playerId)
      .execute();
    const inCity = command({ name: 'test.city', input: z.object({}), rate: { perMinute: 10 }, where: ['city'], run: async () => 1 });
    await expect(executeCommand(deps(), inCity, { playerId, input: {} })).rejects.toMatchObject({ code: 'WATCH_IN_PROGRESS' });
    // Le chat et la consultation restent permis pendant le blocage.
    expect(await executeCommand(deps(), setDungeonAvailable, { playerId, input: { available: true } })).toEqual({ available: true });
    await t.db.updateTable('player').set({ watch_until: null }).where('id', '=', playerId).execute();
  });

  it('limite le débit par joueur et par commande', async () => {
    const rl = memoryRateLimiter();
    const d = deps({ rateLimiter: rl });
    const tiny = command({ name: 'test.tiny', input: z.object({}), rate: { perMinute: 2 }, run: async () => 1 });
    await executeCommand(d, tiny, { playerId, input: {} });
    await executeCommand(d, tiny, { playerId, input: {} });
    await expect(executeCommand(d, tiny, { playerId, input: {} })).rejects.toMatchObject({ code: 'RATE_LIMITED' });
  });
});
