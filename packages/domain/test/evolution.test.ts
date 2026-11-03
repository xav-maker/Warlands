/** Évolutions (J3, README 24) : coût, niveau, forme, branches, ville qui recrute. */
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { validateContent } from '@cr/content';
import { learned } from '@cr/gen';
import type { GenContent } from '@cr/gen';
import { startTestDb, type TestDb } from '@cr/testing';
import {
  addStack,
  balance,
  command,
  createTroop,
  evolutionRecipe,
  evolve,
  executeCommand,
  loadTroops,
  memoryMailer,
  nextForms,
  noRateLimit,
  signup,
  statsOf,
  transferGold,
  type CommandDef,
  type GameContent,
} from '../src/index.ts';

const compiled = validateContent(join(import.meta.dirname, '../../../content'));
const content: GameContent = { pack: compiled.pack as unknown as GenContent, hash: compiled.hash! };
let t: TestDb;
let n = 0;
const start = command({
  name: 'test.start',
  input: z.object({}),
  rate: { perMinute: 1000 },
  allowedDuringWatch: true,
  run: async () => ({}),
});
function run<S extends z.ZodType, R>(pid: number, def: CommandDef<S, R>, input: unknown = {}): Promise<R> {
  return executeCommand({ db: t.db, rateLimiter: noRateLimit, publish: () => {}, content, random: () => 3 }, def, { playerId: pid, input });
}
async function newPlayer(): Promise<{ pid: number; seed: number }> {
  n++;
  await signup(
    { db: t.db, mailer: memoryMailer(), appUrl: 'http://test' },
    { email: `e${n}@example.org`, pseudo: `Evolution ${n}`, password: 'motdepasse-long', acceptTos: true },
  );
  const p = await t.db.selectFrom('player').select(['id', 'seed']).where('pseudo', '=', `Evolution ${n}`).executeTakeFirstOrThrow();
  await run(p.id, start);
  return { pid: p.id, seed: p.seed };
}
/** Donne ce que demande la recette d'évolution, or compris. */
async function provide(pid: number, seed: number, type: string, formId: string): Promise<{ gold: number }> {
  return t.db.transaction().execute(async (tx) => {
    const form = content.pack.troops[type]!.forms.find((f) => f.id === formId)!;
    const r = await evolutionRecipe(tx, content, { id: pid, seed }, type, form);
    for (const [item, q] of r.ingredients) await addStack(tx, content, pid, 'BANK', item, q, 'SYSTEM', 'test');
    await transferGold(tx, { system: 'SOURCE_QUEST' }, { player: pid }, r.gold, 'test');
    return { gold: r.gold };
  });
}

beforeAll(async () => {
  expect(compiled.ok).toBe(true);
  t = await startTestDb();
});
afterAll(async () => t?.stop());

describe('évolutions (README 24)', () => {
  it('niveau 10 : coût de la recette, nouvelle forme, nouvelles capacités, soin', async () => {
    const { pid, seed } = await newPlayer();
    const m = (await t.db.transaction().execute((x) => loadTroops(x, pid))).find((x) => x.type === 'milicien')!;
    expect(nextForms(content, 'milicien', 'milicien').map((f) => f.id)).toEqual(['fantassin']);
    await expect(run(pid, evolve, { troop: m.id, form: 'fantassin' })).rejects.toMatchObject({ code: 'LEVEL_TOO_LOW' });
    await t.db.updateTable('troop').set({ level: 14 }).where('id', '=', m.id).execute();
    await expect(run(pid, evolve, { troop: m.id, form: 'garde' })).rejects.toMatchObject({ code: 'FORM_UNAVAILABLE' });

    const { gold } = await provide(pid, seed, 'milicien', 'fantassin');
    expect(gold).toBe(60 * 1 * 1); // 60 × population × palier
    const before = await t.db.transaction().execute((x) => balance(x, pid));
    expect(await run(pid, evolve, { troop: m.id, form: 'fantassin' })).toEqual({ form: 'fantassin' });
    expect(await t.db.transaction().execute((x) => balance(x, pid))).toBe(before - gold);
    const f = (await t.db.transaction().execute((x) => loadTroops(x, pid))).find((x) => x.id === m.id)!;
    expect([f.form, f.level]).toEqual(['fantassin', 14]);
    expect(learned(content.pack.troops.milicien!, f.form, f.level)).toContain('riposte');
    expect(f.units[0]!.hp).toBe(statsOf(content, f, f.units[0]!).hpMax);
  });

  it('niveau 20 : une branche au choix, un composant de palier 3 ou plus, 200 × population × palier', async () => {
    const { pid, seed } = await newPlayer();
    const id = await t.db
      .transaction()
      .execute((x) =>
        createTroop(x, content, pid, { type: 'milicien', level: 22, container: 'BARRACKS', reason: 'test', form: 'fantassin' }),
      );
    expect(
      nextForms(content, 'milicien', 'fantassin')
        .map((f) => f.id)
        .sort(),
    ).toEqual(['garde', 'lame']);
    const rec = await t.db.transaction().execute((x) =>
      evolutionRecipe(
        x,
        content,
        { id: pid, seed },
        'milicien',
        content.pack.troops.milicien!.forms.find((f) => f.id === 'lame')!,
      ),
    );
    const comp = rec.ingredients.at(-1)!;
    expect(content.pack.items[comp[0]]!.kind).toBe('composant');
    expect(content.pack.items[comp[0]]!.tier).toBeGreaterThanOrEqual(3);
    expect(rec.gold).toBe(200);
    // La recette est enregistrée : la relire redonne la même.
    expect(
      await t.db.transaction().execute((x) =>
        evolutionRecipe(
          x,
          content,
          { id: pid, seed },
          'milicien',
          content.pack.troops.milicien!.forms.find((f) => f.id === 'lame')!,
        ),
      ),
    ).toEqual(rec);
    await provide(pid, seed, 'milicien', 'lame');
    await run(pid, evolve, { troop: id, form: 'lame' });
    expect((await t.db.selectFrom('troop').select('form').where('id', '=', id).executeTakeFirstOrThrow()).form).toBe('lame');
    // Choix définitif : plus d'évolution depuis une forme finale.
    expect(nextForms(content, 'milicien', 'lame')).toEqual([]);
  });

  it('se fait dans une ville qui recrute le type', async () => {
    const { pid, seed } = await newPlayer();
    // Le Berserker se recrute à Port-Salant, pas à Havre-Gris.
    const id = await t.db
      .transaction()
      .execute((x) => createTroop(x, content, pid, { type: 'berserker', level: 16, container: 'BARRACKS', reason: 'test' }));
    const form = nextForms(content, 'berserker', content.pack.troops.berserker!.forms[0]!.id)[0]!;
    await provide(pid, seed, 'berserker', form.id);
    await expect(run(pid, evolve, { troop: id, form: form.id })).rejects.toMatchObject({ code: 'NOT_RECRUITED_HERE' });
  });
});
