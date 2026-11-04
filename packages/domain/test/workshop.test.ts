/** Atelier et équipement (J3) : fabriquer, porter, remplacer, retirer ; ville et expédition. */
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { validateContent } from '@cr/content';
import type { GenContent } from '@cr/gen';
import { startTestDb, type TestDb } from '@cr/testing';
import {
  addStack,
  balance,
  command,
  contents,
  craft,
  depart,
  equip,
  executeCommand,
  loadTroops,
  memoryMailer,
  noRateLimit,
  recipes,
  setUnit,
  signup,
  statsOf,
  unequip,
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
  return executeCommand({ db: t.db, rateLimiter: noRateLimit, publish: () => {}, content, random: () => 11 }, def, {
    playerId: pid,
    input,
  });
}
async function newPlayer(): Promise<number> {
  n++;
  await signup(
    { db: t.db, mailer: memoryMailer(), appUrl: 'http://test' },
    { email: `a${n}@example.org`, pseudo: `Atelier ${n}`, password: 'motdepasse-long', acceptTos: true },
  );
  const pid = (await t.db.selectFrom('player').select('id').where('pseudo', '=', `Atelier ${n}`).executeTakeFirstOrThrow()).id;
  await run(pid, start);
  return pid;
}
/** Donne au joueur, en banque, les ingrédients de sa recette pour `out`. */
async function giveIngredients(pid: number, out: string): Promise<void> {
  await t.db.transaction().execute(async (tx) => {
    const seed = (await tx.selectFrom('player').select('seed').where('id', '=', pid).executeTakeFirstOrThrow()).seed;
    const r = (await recipes(tx, content, { id: pid, seed })).get(out)!;
    for (const [item, q] of r.ingredients) await addStack(tx, content, pid, 'BANK', item, q, 'SYSTEM', 'test');
  });
}
const troops = (pid: number) => t.db.transaction().execute((x) => loadTroops(x, pid));
const bank = (pid: number) => t.db.transaction().execute((x) => contents(x, pid, 'BANK'));
const bag = (pid: number) => t.db.transaction().execute((x) => contents(x, pid, 'BAG'));

beforeAll(async () => {
  expect(compiled.ok).toBe(true);
  t = await startTestDb();
});
afterAll(async () => t?.stop());

describe('atelier (README 3.4, 8.5)', () => {
  it('fabrique un consommable et une arme en banque, refuse l’équipement d’un autre atelier', async () => {
    const pid = await newPlayer();
    const bandages = (await bank(pid)).stacks.find((s) => s.item === 'bandage')!.qty;
    await giveIngredients(pid, 'bandage');
    expect(await run(pid, craft, { out: 'bandage' })).toEqual({ item: 'bandage' });
    expect((await bank(pid)).stacks.find((s) => s.item === 'bandage')!.qty).toBe(bandages + 1);

    await giveIngredients(pid, 'lame_1');
    const gold = await t.db.transaction().execute((x) => balance(x, pid));
    const r = await run(pid, craft, { out: 'lame_1' });
    expect(r.roll).toBeGreaterThanOrEqual(600);
    expect(r.roll).toBeLessThanOrEqual(1400);
    expect(await t.db.transaction().execute((x) => balance(x, pid))).toBe(gold - 6); // 6 × palier²
    expect((await bank(pid)).instances.map((i) => i.base)).toContain('lame_1');

    await expect(run(pid, craft, { out: 'legere_4' })).rejects.toMatchObject({
      code: 'WORKSHOP_ELSEWHERE',
      details: { ville: 'Cendrelune' },
    });
    await expect(run(pid, craft, { out: 'acolyte' })).rejects.toMatchObject({ code: 'RECIPE_UNKNOWN' });
    await expect(run(pid, craft, { out: 'lame_1' })).rejects.toMatchObject({ code: 'NOT_ENOUGH_ITEMS' });
  });
});

describe('équipement (README 7.3, 7.4, 21)', () => {
  it('porte, remplace et retire en ville, avec soin ; refuse une catégorie ou un niveau inadaptés', async () => {
    const pid = await newPlayer();
    await giveIngredients(pid, 'lame_1');
    await run(pid, craft, { out: 'lame_1' });
    await giveIngredients(pid, 'lame_1');
    await run(pid, craft, { out: 'lame_1' });
    const [s1, s2] = (await bank(pid)).instances.filter((i) => i.base === 'lame_1');
    const all = await troops(pid);
    const milicien = all.find((x) => x.type === 'milicien');
    const chasseur = all.find((x) => x.type === 'chasseur');
    await expect(run(pid, equip, { troop: chasseur!.id, unit: 1, instance: s1!.id })).rejects.toMatchObject({ code: 'CANNOT_WEAR' });

    await t.db.transaction().execute((x) => setUnit(x, milicien!.id, 1, { hp: 5, mana: 0 }));
    expect(await run(pid, equip, { troop: milicien!.id, unit: 1, instance: s1!.id })).toEqual({ slot: 'arme', replaced: null });
    let m = (await troops(pid)).find((x) => x.id === milicien!.id)!;
    expect(m.units[0]!.equip.arme?.base).toBe('lame_1');
    expect(m.units[0]!.hp).toBe(statsOf(content, m, m.units[0]!).hpMax); // soigné en ville

    expect(await run(pid, equip, { troop: milicien!.id, unit: 1, instance: s2!.id })).toEqual({ slot: 'arme', replaced: s1!.id });
    expect((await bank(pid)).instances.map((i) => i.id)).toContain(s1!.id);
    expect(await run(pid, unequip, { troop: milicien!.id, unit: 1, slot: 'arme' })).toEqual({ to: 'BANK' });
    m = (await troops(pid)).find((x) => x.id === milicien!.id)!;
    expect(m.units[0]!.equip).toEqual({});

    // Palier 2 : niveau 6 requis.
    const id = await t.db.transaction().execute(async (x) => {
      const { addInstance } = await import('../src/index.ts');
      return addInstance(x, content, pid, 'BANK', { uid: '', base: 'lame_2', roll: 1000, stats: [] }, 'loot', 'test');
    });
    await expect(run(pid, equip, { troop: milicien!.id, unit: 1, instance: id! })).rejects.toMatchObject({ code: 'LEVEL_TOO_LOW' });
  });

  it('en expédition : depuis le sac seulement, sans soin, retrait vers le sac', async () => {
    const pid = await newPlayer();
    await giveIngredients(pid, 'lame_1');
    await run(pid, craft, { out: 'lame_1' });
    const sword = (await bank(pid)).instances[0]!;
    const [milicien] = await troops(pid);
    await run(pid, depart, { direction: 1 });
    await expect(run(pid, equip, { troop: milicien!.id, unit: 1, instance: sword.id })).rejects.toMatchObject({ code: 'WRONG_POSITION' });
    // Mettre l'épée dans le sac (directement en base : la banque est fermée en expédition).
    await t.db.updateTable('item_instance').set({ container: 'BAG' }).where('id', '=', sword.id).execute();
    await t.db.transaction().execute((x) => setUnit(x, milicien!.id, 1, { hp: 5, mana: 0 }));
    await run(pid, equip, { troop: milicien!.id, unit: 1, instance: sword.id });
    const m = (await troops(pid)).find((x) => x.id === milicien!.id)!;
    expect(m.units[0]!.hp).toBe(5); // pas de soin en expédition
    expect((await bag(pid)).instances).toEqual([]);
    expect(await run(pid, unequip, { troop: milicien!.id, unit: 1, slot: 'arme' })).toEqual({ to: 'BAG' });
    expect((await bag(pid)).instances.map((i) => i.id)).toEqual([sword.id]);
  });
});
