/**
 * Premiers pas (tutoriel) : un nouveau joueur fait les six étapes pour de vrai — combat, butin, achat, fabrication,
 * recrutement — et chacune se coche d'elle-même ; « la mort » se coche à la lecture ou à la première unité perdue.
 */
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { z } from 'zod';
import { validateContent } from '@cr/content';
import type { GenContent } from '@cr/gen';
import { Rng } from '@cr/rng';
import { startTestDb, type TestDb } from '@cr/testing';
import {
  addStack,
  craft,
  createTestSquad,
  depart,
  ensureStarted,
  executeCommand,
  fight,
  goHome,
  memoryMailer,
  merchantBuy,
  noRateLimit,
  recruit,
  signup,
  tutorialView,
  updateTutorial,
  type CommandDef,
  type GameContent,
} from '../src/index.ts';

const compiled = validateContent(join(import.meta.dirname, '../../../content'));
const content: GameContent = { pack: compiled.pack as unknown as GenContent, hash: compiled.hash! };
let t: TestDb;
let now = new Date('2026-11-07T10:00:00Z');
const rng = new Rng(11);

beforeAll(async () => {
  t = await startTestDb();
});
afterAll(async () => t?.stop());

function run<S extends z.ZodType, R>(pid: number, def: CommandDef<S, R>, input: unknown = {}): Promise<R> {
  return executeCommand(
    { db: t.db, rateLimiter: noRateLimit, publish: () => {}, content, clock: () => now, random: (m) => rng.next() % m },
    def,
    { playerId: pid, input },
  );
}
const later = (): void => void (now = new Date(now.getTime() + 3_600_000));
const done = async (pid: number) => Object.fromEntries((await tutorialView(t.db, pid)).steps.map((s) => [s.id, s.done]));
/** Donne en banque les ingrédients d'une recette personnelle. */
async function ingredients(pid: number, out: string): Promise<void> {
  const r = await t.db
    .selectFrom('player_recipe')
    .select('ingredients')
    .where('player_id', '=', pid)
    .where('out', '=', out)
    .executeTakeFirstOrThrow();
  await t.db.transaction().execute(async (tx) => {
    for (const [item, qty] of r.ingredients) await addStack(tx, content, pid, 'BANK', item, qty, 'SYSTEM', 'test');
  });
}

describe('premiers pas', () => {
  it('se cochent au fil de la vraie partie, puis le tutoriel se retire', async () => {
    await signup(
      { db: t.db, mailer: memoryMailer(), appUrl: 'http://test' },
      { email: 'debutant@example.org', pseudo: 'Debutant', password: 'motdepasse-long', acceptTos: true },
    );
    const pid = (await t.db.selectFrom('player').select('id').where('pseudo', '=', 'Debutant').executeTakeFirstOrThrow()).id;
    await run(pid, ensureStarted);
    expect(await tutorialView(t.db, pid)).toMatchObject({ done: 0, next: 'combat', hidden: false, finished: false });

    // Combat gagné (escouade solide) et butin dans le sac.
    await t.db.transaction().execute(async (tx) => {
      await tx.updateTable('troop').set({ container: 'BARRACKS' }).where('player_id', '=', pid).execute();
      await createTestSquad(tx, content, pid, 30, 'test');
    });
    await run(pid, depart, { direction: 1, route: 'ronces' });
    const r = await run(pid, fight, {});
    expect(r.won).toBe(true);
    later();
    await run(pid, goHome, {});
    expect(await done(pid)).toMatchObject({ combat: true, butin: true, acheter: false });
    expect((await tutorialView(t.db, pid)).next).toBe('acheter');

    // Achat au marchand, fabrication, recrutement.
    await run(pid, merchantBuy, { id: 'bandage' });
    expect((await done(pid)).acheter).toBe(true);
    const consumable = await t.db
      .selectFrom('player_recipe')
      .select('out')
      .where('player_id', '=', pid)
      .where('kind', '=', 'consommable')
      .executeTakeFirstOrThrow();
    await ingredients(pid, consumable.out);
    await run(pid, craft, { out: consumable.out });
    expect((await done(pid)).fabriquer).toBe(true);
    await ingredients(pid, 'acolyte');
    await run(pid, recruit, { type: 'acolyte' });
    expect((await done(pid)).recruter).toBe(true);

    // La mort : se lit.
    expect(await tutorialView(t.db, pid)).toMatchObject({ done: 5, next: 'mort', finished: false });
    await run(pid, updateTutorial, { read: 'mort' });
    expect(await tutorialView(t.db, pid)).toMatchObject({ done: 6, next: null, finished: true });
  });

  it('se masque et se réaffiche ; la mort se coche aussi à la première unité perdue', async () => {
    await signup(
      { db: t.db, mailer: memoryMailer(), appUrl: 'http://test' },
      { email: 'presse@example.org', pseudo: 'Presse', password: 'motdepasse-long', acceptTos: true },
    );
    const pid = (await t.db.selectFrom('player').select('id').where('pseudo', '=', 'Presse').executeTakeFirstOrThrow()).id;
    await run(pid, ensureStarted);
    await run(pid, updateTutorial, { hidden: true });
    expect((await tutorialView(t.db, pid)).hidden).toBe(true);
    await run(pid, updateTutorial, { hidden: false });
    expect((await tutorialView(t.db, pid)).hidden).toBe(false);
    await t.db.updateTable('player').set({ stat_deaths: 1 }).where('id', '=', pid).execute();
    expect((await done(pid)).mort).toBe(true);
    await expect(run(pid, updateTutorial, { read: 'combat' })).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  });
});
