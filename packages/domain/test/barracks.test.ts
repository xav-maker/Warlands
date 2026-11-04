/** Caserne et escouade (J3) : recettes personnelles, recrutement, rachat, escouade, rang, capacités désactivées. */
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { validateContent } from '@cr/content';
import { genRecipes, troopActive } from '@cr/gen';
import type { GenContent } from '@cr/gen';
import { startTestDb, type TestDb } from '@cr/testing';
import {
  addStack,
  asPlayerTroop,
  balance,
  command,
  contents,
  createTroop,
  depart,
  engage,
  executeCommand,
  loadTroops,
  memoryMailer,
  noRateLimit,
  rebuyUnits,
  recipes,
  recruit,
  reservedMaterials,
  setDisabledSkills,
  setRank,
  signup,
  statsOf,
  withdraw,
  type CommandDef,
  type GameContent,
} from '../src/index.ts';

const compiled = validateContent(join(import.meta.dirname, '../../../content'));
const content: GameContent = { pack: compiled.pack as unknown as GenContent, hash: compiled.hash! };
let t: TestDb;
let n = 0;

async function newPlayer(): Promise<number> {
  n++;
  await signup(
    { db: t.db, mailer: memoryMailer(), appUrl: 'http://test' },
    { email: `c${n}@example.org`, pseudo: `Caserne ${n}`, password: 'motdepasse-long', acceptTos: true },
  );
  const pid = (await t.db.selectFrom('player').select('id').where('pseudo', '=', `Caserne ${n}`).executeTakeFirstOrThrow()).id;
  await run(pid, start);
  return pid;
}
const start = command({
  name: 'test.start',
  input: z.object({}),
  rate: { perMinute: 1000 },
  allowedDuringWatch: true,
  run: async () => ({}),
});
function run<S extends z.ZodType, R>(pid: number, def: CommandDef<S, R>, input: unknown = {}): Promise<R> {
  return executeCommand({ db: t.db, rateLimiter: noRateLimit, publish: () => {}, content, random: () => 7 }, def, { playerId: pid, input });
}
const troops = (pid: number) => t.db.transaction().execute((x) => loadTroops(x, pid));
const gold = (pid: number) => t.db.transaction().execute((x) => balance(x, pid));
const seedOf = async (pid: number) => (await t.db.selectFrom('player').select('seed').where('id', '=', pid).executeTakeFirstOrThrow()).seed;

beforeAll(async () => {
  expect(compiled.ok).toBe(true);
  t = await startTestDb();
});
afterAll(async () => t?.stop());

describe('recettes personnelles (README 8.5)', () => {
  it('sont matérialisées une fois, identiques au générateur, avec 7 matériaux réservés', async () => {
    const pid = await newPlayer();
    const seed = await seedOf(pid);
    const a = await t.db.transaction().execute((x) => recipes(x, content, { id: pid, seed }));
    const b = await t.db.transaction().execute((x) => recipes(x, content, { id: pid, seed }));
    const ref = genRecipes(content.pack, seed);
    expect(a.size).toBe(Object.keys(ref).length);
    expect([...b.values()].map((r) => r.out).sort()).toEqual([...a.keys()].sort());
    expect(a.get('acolyte')!.ingredients).toEqual(ref.acolyte!.ingredients);
    const reserved = await t.db.transaction().execute((x) => reservedMaterials(x, pid));
    expect(reserved.size).toBe(7);
    for (const r of a.values()) for (const [id] of r.ingredients) expect(reserved.has(id)).toBe(false);
  });
});

describe('recrutement (README 8.4)', () => {
  it('recrute l’Acolyte avec le kit de départ, puis refuse sans ingrédients ou hors de sa ville', async () => {
    const pid = await newPlayer();
    const r = await run(pid, recruit, { type: 'acolyte' });
    expect(r.container).toBe('SQUAD');
    const acolyte = (await troops(pid)).find((x) => x.type === 'acolyte')!;
    expect(acolyte.level).toBe(1);
    expect(acolyte.units[0]!.hp).toBe(statsOf(content, acolyte, acolyte.units[0]!).hpMax);
    expect(await gold(pid)).toBe(1000 - 40);
    await expect(run(pid, recruit, { type: 'acolyte' })).rejects.toMatchObject({ code: 'NOT_ENOUGH_ITEMS' });
    await expect(run(pid, recruit, { type: 'berserker' })).rejects.toMatchObject({ code: 'NOT_RECRUITED_HERE' });
    const bank = await t.db.transaction().execute((x) => contents(x, pid, 'BANK'));
    expect(bank.stacks.map((s) => s.item)).toEqual(['bandage']); // les ingrédients de la recette ont été consommés
  });
});

describe('escouade (README 20)', () => {
  it('8 unités et 11 de population au plus ; au-delà, la recrue va en caserne', async () => {
    const pid = await newPlayer();
    // Départ : 2 Miliciens, 2 Chasseurs et 2 Herboristes. On met les Chasseurs et les Herboristes en caserne (2 unités, 2 de population restent),
    // puis deux Frondeurs (3 unités chacun) : 8 unités.
    for (const c of (await troops(pid)).filter((x) => x.type === 'chasseur' || x.type === 'herboriste'))
      await run(pid, withdraw, { troop: c.id });
    await t.db.transaction().execute(async (x) => {
      for (let i = 0; i < 2; i++)
        await createTroop(x, content, pid, { type: 'frondeurs', level: 1, container: 'BARRACKS', reason: 'test' });
    });
    const [f1, f2] = (await troops(pid)).filter((x) => x.type === 'frondeurs');
    await run(pid, engage, { troop: f1!.id });
    await run(pid, engage, { troop: f2!.id });
    const extra = await t.db
      .transaction()
      .execute((x) => createTroop(x, content, pid, { type: 'milicien', level: 1, container: 'BARRACKS', reason: 'test' }));
    await expect(run(pid, engage, { troop: extra })).rejects.toMatchObject({ code: 'SQUAD_FULL' });
    // Recruter avec une escouade pleine : la recrue va en caserne.
    expect((await run(pid, recruit, { type: 'acolyte' })).container).toBe('BARRACKS');
    await run(pid, withdraw, { troop: f2!.id });
    await run(pid, engage, { troop: extra });
    expect((await troops(pid)).find((x) => x.id === extra)!.container).toBe('SQUAD');
  });
});

describe('rachat d’unités (README 4.6)', () => {
  it('coûte la recette au prorata des unités manquantes, et rend des unités à pleine vie', async () => {
    const pid = await newPlayer();
    const id = await t.db
      .transaction()
      .execute((x) => createTroop(x, content, pid, { type: 'frondeurs', level: 1, container: 'BARRACKS', reason: 'test' }));
    await expect(run(pid, rebuyUnits, { troop: id })).rejects.toMatchObject({ code: 'TROOP_COMPLETE' });
    await t.db.updateTable('troop_unit').set({ dead: true, hp: 0, mana: 0 }).where('troop_id', '=', id).where('n', '=', 2).execute();
    const rec = (await t.db.transaction().execute(async (x) => recipes(x, content, { id: pid, seed: await seedOf(pid) }))).get(
      'frondeurs',
    )!;
    await t.db.transaction().execute(async (x) => {
      for (const [item, q] of rec.ingredients) await addStack(x, content, pid, 'BANK', item, q, 'SYSTEM', 'test');
    });
    const before = await gold(pid);
    expect(await run(pid, rebuyUnits, { troop: id })).toEqual({ revived: 1 });
    expect(await gold(pid)).toBe(before - Math.ceil(rec.gold / 3));
    const f = (await troops(pid)).find((x) => x.id === id)!;
    expect(f.units.map((u) => u.n)).toEqual([1, 2, 3]);
    expect(f.units[1]!.hp).toBe(statsOf(content, f, f.units[1]!).hpMax);
  });
});

describe('rang et capacités désactivées (README 4.5, 20.1)', () => {
  it('change le rang en expédition, et retire du combat une capacité désactivée', async () => {
    const pid = await newPlayer();
    const id = await t.db
      .transaction()
      .execute((x) => createTroop(x, content, pid, { type: 'milicien', level: 12, container: 'SQUAD', reason: 'test' }));
    await run(pid, depart, { direction: 1 });
    expect(await run(pid, setRank, { troop: id, rank: 2 })).toEqual({ rank: 2 });
    await expect(run(pid, setDisabledSkills, { troop: id, skills: ['emploi'] })).rejects.toMatchObject({ code: 'BASIC_ATTACK_LOCKED' });
    await expect(run(pid, setDisabledSkills, { troop: id, skills: ['boule_feu'] })).rejects.toMatchObject({ code: 'SKILL_UNKNOWN' });
    const m = (await troops(pid)).find((x) => x.id === id)!;
    expect(troopActive(content.pack, asPlayerTroop(m))).toContain('exploit');
    await run(pid, setDisabledSkills, { troop: id, skills: ['exploit'] });
    const m2 = (await troops(pid)).find((x) => x.id === id)!;
    expect(m2.rank).toBe(2);
    expect(m2.disabledSkills).toEqual(['exploit']);
    const active = troopActive(content.pack, asPlayerTroop(m2));
    expect(active).not.toContain('exploit');
    expect(active[0]).toBe('emploi');
  });
});
