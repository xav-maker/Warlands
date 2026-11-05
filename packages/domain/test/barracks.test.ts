/** Caserne et escouade (J3) : recettes personnelles, recrutement, rachat, escouade, rang, capacités désactivées. */
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { validateContent } from '@cr/content';
import { genRecipes, newTroop, troopActive } from '@cr/gen';
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
  reserveAdd,
  reserveSwap,
  reservedMaterials,
  setDisabledSkills,
  setHold,
  setRank,
  settleSquad,
  signup,
  statsOf,
  unitIds,
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

describe('réserve (README 29.2)', () => {
  const only = async (pid: number, type: string) => (await troops(pid)).find((x) => x.type === type)!;
  const at = async (pid: number, id: number) => (await troops(pid)).find((x) => x.id === id)!;

  it('met en réserve, sans dépasser 5 unités et 8 de population, et en sort vers la caserne ou l’escouade', async () => {
    const pid = await newPlayer();
    const c = await only(pid, 'chasseur');
    expect(await run(pid, reserveAdd, { troop: c.id })).toEqual({ container: 'RESERVE' });
    expect((await at(pid, c.id)).container).toBe('RESERVE');
    // Deux Frondeurs (3 unités chacun) : le second dépasse les 5 unités de la réserve.
    const ids = await t.db
      .transaction()
      .execute(async (x) => [
        await createTroop(x, content, pid, { type: 'frondeurs', level: 1, container: 'BARRACKS', reason: 'test' }),
        await createTroop(x, content, pid, { type: 'frondeurs', level: 1, container: 'BARRACKS', reason: 'test' }),
      ]);
    await run(pid, reserveAdd, { troop: ids[0]! });
    await expect(run(pid, reserveAdd, { troop: ids[1]! })).rejects.toMatchObject({ code: 'RESERVE_FULL' });
    await run(pid, withdraw, { troop: ids[0]! });
    expect((await troops(pid)).find((x) => x.id === ids[0])!.container).toBe('BARRACKS');
    await run(pid, engage, { troop: c.id });
    expect((await at(pid, c.id)).container).toBe('SQUAD');
  });

  it('échange une troupe de l’escouade avec une troupe de la réserve, en ville comme en route', async () => {
    const pid = await newPlayer();
    const m = await only(pid, 'milicien');
    const c = await only(pid, 'chasseur');
    await run(pid, reserveAdd, { troop: c.id });
    await expect(run(pid, reserveSwap, { troop: c.id, with: m.id })).rejects.toMatchObject({ code: 'SWAP_INVALID' });
    await run(pid, reserveSwap, { troop: m.id, with: c.id });
    expect((await at(pid, m.id)).container).toBe('RESERVE');
    expect((await at(pid, c.id)).container).toBe('SQUAD');
    await run(pid, depart, { direction: 1 });
    await run(pid, reserveSwap, { troop: c.id, with: m.id });
    expect((await at(pid, m.id)).container).toBe('SQUAD');
    expect((await at(pid, c.id)).container).toBe('RESERVE');
    // Pas d'engagement ni de mise en réserve depuis la route.
    await expect(run(pid, reserveAdd, { troop: m.id })).rejects.toBeTruthy();
  });

  it('gagne la même part d’expérience qu’une troupe qui a combattu', async () => {
    const pid = await newPlayer();
    const c = await only(pid, 'chasseur');
    await run(pid, reserveAdd, { troop: c.id });
    const before = await at(pid, c.id);
    const out = await t.db.transaction().execute(async (x) => {
      const squad = (await loadTroops(x, pid, ['SQUAD'])).filter((q) => q.units.length);
      const reserve = await loadTroops(x, pid, ['RESERVE']);
      const results = squad.flatMap((q) =>
        q.units.map((u, i) => ({ id: `A${i}`, hp: u.hp, mana: u.mana, dead: false, fled: false, dmgDealt: 0, kills: 0 })),
      );
      const ids = unitIds(squad, 0);
      const res = results.map((r, i) => ({ ...r, id: ids[i]! }));
      const side = { troops: [newTroop(content.pack, 'milicien', 10)] };
      return settleSquad(x, content, new Date(), squad, ids, res, true, side, reserve);
    });
    const fighters = out.xpBy.filter((e) => !e.reserve);
    const idle = out.xpBy.filter((e) => e.reserve);
    expect(idle).toHaveLength(1);
    expect(fighters.length).toBeGreaterThan(0);
    expect(idle[0]!.troop).toBe(c.id);
    expect(idle[0]!.gain).toBe(fighters[0]!.gain);
    const after = await at(pid, c.id);
    expect(after.level > before.level || after.xp > before.xp).toBe(true);
    expect(after.container).toBe('RESERVE');
  });
});

describe('troupe immobile (README 29.1)', () => {
  it('se règle en ville et en route, et part dans le combat', async () => {
    const pid = await newPlayer();
    const m = (await troops(pid)).find((x) => x.type === 'milicien')!;
    expect(m.hold).toBe(false);
    expect(asPlayerTroop(m).hold).toBeUndefined();
    expect(await run(pid, setHold, { troop: m.id, hold: true })).toEqual({ hold: true });
    const held = (await troops(pid)).find((x) => x.id === m.id)!;
    expect(held.hold).toBe(true);
    expect(asPlayerTroop(held).hold).toBe(true);
    await run(pid, depart, { direction: 1 });
    await run(pid, setHold, { troop: m.id, hold: false });
    expect((await troops(pid)).find((x) => x.id === m.id)!.hold).toBe(false);
  });
});
