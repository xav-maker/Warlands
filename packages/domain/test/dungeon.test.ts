/**
 * Donjons en solo (J7, README 23, guide 9) sur une vraie base : porte tirée à chaque changement d'étape d'une route à
 * donjon, ouverture, salles successives (PV qui persistent, boss et trophée), coffre à part du sac, sortie (coffre en
 * banque, or au grand livre), défaite (coffre perdu, retour en ville soigné), état périmé, rediffusion.
 */
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { validateContent } from '@cr/content';
import { simuler } from '@cr/engine';
import type { GenContent } from '@cr/gen';
import { startTestDb, type TestDb } from '@cr/testing';
import {
  advance,
  balance,
  command,
  contents,
  createTestSquad,
  depart,
  doorView,
  dungeonView,
  executeCommand,
  fightRoom,
  goHome,
  leaveDungeon,
  loadTroops,
  memoryMailer,
  noRateLimit,
  openDungeon,
  spawnTestDoor,
  setUnit,
  signup,
  statsOf,
  useConsumable,
  addStack,
  type CommandDef,
  type GameContent,
} from '../src/index.ts';

const compiled = validateContent(join(import.meta.dirname, '../../../content'));
const content: GameContent = { pack: compiled.pack as unknown as GenContent, hash: compiled.hash! };

let t: TestDb;
let now = new Date('2026-11-04T10:00:00Z');
/** Tirages : `roll` pour tout (0 : la porte apparaît à chaque étape ; 999 : jamais). */
let roll = 0;
let n = 0;

beforeAll(async () => {
  expect(compiled.ok).toBe(true);
  t = await startTestDb();
});
afterAll(async () => t?.stop());

async function newPlayer(): Promise<number> {
  n++;
  await signup(
    { db: t.db, mailer: memoryMailer(), appUrl: 'http://test' },
    { email: `don${n}@example.org`, pseudo: `Donjon ${n}`, password: 'motdepasse-long', acceptTos: true },
  );
  return (await t.db.selectFrom('player').select('id').where('pseudo', '=', `Donjon ${n}`).executeTakeFirstOrThrow()).id;
}
function run<S extends z.ZodType, R>(pid: number, def: CommandDef<S, R>, input: unknown = {}): Promise<R> {
  return executeCommand(
    { db: t.db, rateLimiter: noRateLimit, publish: () => {}, content, clock: () => now, random: (m) => Math.min(roll, m - 1) },
    def,
    { playerId: pid, input },
  );
}
const later = (): void => void (now = new Date(now.getTime() + 3_600_000));
const player = (pid: number) => t.db.selectFrom('player').selectAll().where('id', '=', pid).executeTakeFirstOrThrow();
const start = command({
  name: 'test.start',
  input: z.object({}),
  rate: { perMinute: 1000 },
  allowedDuringWatch: true,
  run: async () => ({}),
});
/** Salle suivante, qui doit donner un combat (seul, ou au second vote). */
async function fought(pid: number, input: unknown = {}) {
  const r = await run(pid, fightRoom, input);
  if (!('battle' in r)) throw new Error('combat attendu');
  return r;
}
const err = (p: Promise<unknown>) => p.then(() => 'ok').catch((e: { code?: string }) => e.code ?? String(e));

/** Escouade de niveau `level` engagée, troupes de départ en caserne. */
async function squad(pid: number, level: number): Promise<void> {
  await run(pid, start);
  await t.db.transaction().execute(async (tx) => {
    await tx.updateTable('troop').set({ container: 'BARRACKS' }).where('player_id', '=', pid).where('container', '=', 'SQUAD').execute();
    await createTestSquad(tx, content, pid, level, 'test');
  });
}

/** Joueur sur la première étape des Prés de Brande (route des Terriers du Roi Kobold), porte en vue. */
async function atDoor(level = 30): Promise<number> {
  const pid = await newPlayer();
  await squad(pid, level);
  roll = 0;
  await run(pid, depart, { direction: 1, route: 'pres_brande' });
  return pid;
}

describe('portes de donjon', () => {
  it('apparaissent à 2 % sur une route à donjon, disparaissent quand on quitte l’étape', async () => {
    const pid = await atDoor();
    expect(await doorView(t.db, content, pid)).toEqual({ dungeon: 'terriers_roi_kobold', name: 'Terriers du Roi Kobold' });

    // Étape suivante, tirage raté : plus de porte.
    roll = 999;
    await t.db
      .updateTable('expedition')
      .set({ cleared: [true, false, false, false, false] })
      .where('player_id', '=', pid)
      .execute();
    await run(pid, advance);
    expect(await doorView(t.db, content, pid)).toBeNull();
    const doors = await t.db.selectFrom('dungeon_door').select(['status', 'step']).where('player_id', '=', pid).orderBy('id').execute();
    expect(doors).toEqual([{ status: 'gone', step: 0 }]);

    // Route sans donjon : jamais de porte.
    roll = 0;
    await run(pid, goHome);
    await run(pid, depart, { direction: 1, route: 'ronces' });
    expect(await doorView(t.db, content, pid)).toBeNull();
    expect(await err(run(pid, openDungeon, { mode: 'solo' }))).toBe('DOOR_NOT_FOUND');
  });
});

describe('donjon en solo', () => {
  it('ouvre la porte, enchaîne les salles jusqu’au boss, puis sort avec le coffre', async () => {
    const pid = await atDoor();
    const gold0 = await balance(t.db as never, pid);
    const bag0 = await contents(t.db as never, pid, 'BAG');
    const { run: runId } = await run(pid, openDungeon, { mode: 'solo' });
    const p = await player(pid);
    expect(p).toMatchObject({ pos_kind: 'dungeon', pos_dungeon_run: runId, pos_route: 'pres_brande', pos_step: 0 });
    expect(await doorView(t.db, content, pid)).toBeNull();
    let v = (await dungeonView(t.db, content, pid))!;
    expect(v).toMatchObject({
      dungeon: 'terriers_roi_kobold',
      room: 0,
      status: 'between_rooms',
      members: [{ id: pid, role: 'opener', ready: false }],
      next: { n: 1, level: 3, pop: 4, boss: null },
    });

    // La version de la page doit être la bonne ; pendant la rediffusion, on attend.
    expect(await err(run(pid, fightRoom, { version: v.version + 1 }))).toBe('DUNGEON_STALE');
    const r1 = await fought(pid, { version: v.version });
    expect(r1.won).toBe(true);
    expect(r1.rewards.room).toBe(1);
    expect(await err(run(pid, fightRoom, {}))).toBe('WATCH_IN_PROGRESS');
    for (let k = 2; k <= 4; k++) {
      later();
      const r = await fought(pid);
      expect(r.won, `salle ${k}`).toBe(true);
    }
    v = (await dungeonView(t.db, content, pid))!;
    expect(v).toMatchObject({ room: 4, next: { n: 5 } });
    // Le butin est dans le coffre, à part du sac ; le boss de la salle 4 a laissé son trophée ; l'or attend la sortie.
    expect(v.chest.stacks).toContainEqual({ item: 'trophee_taupe_reine', qty: 1 });
    expect(v.chestGold).toBe(13 + 15 + 18 + 20);
    expect(await contents(t.db as never, pid, 'BAG')).toEqual(bag0);
    expect(await balance(t.db as never, pid)).toBe(gold0);

    // Les PV ne remontent pas entre deux salles ; un consommable du sac s'utilise entre deux salles.
    const troops = await loadTroops(t.db as never, pid, ['SQUAD']);
    const hurt = troops.flatMap((tr) => tr.units.map((u) => ({ tr, u }))).find(({ tr, u }) => u.hp < statsOf(content, tr, u).hpMax);
    expect(hurt).toBeDefined();
    await t.db.transaction().execute((tx) => addStack(tx, content, pid, 'BAG', 'potion_mineure', 1, 'SYSTEM', 'test'));
    later();
    await run(pid, useConsumable, { item: 'potion_mineure', troop: hurt!.tr.id, unit: hurt!.u.n });

    // Combat enregistré et rejouable depuis son entrée et sa graine.
    const b = await t.db.selectFrom('battle').selectAll().where('id', '=', r1.battle).executeTakeFirstOrThrow();
    expect(b).toMatchObject({ kind: 'dungeon', route: 'pres_brande', step: 0, encounter_id: null, won: true });
    const input = b.input as { units: never; dungeon: unknown };
    expect(input.dungeon).toEqual({ run: runId, id: 'terriers_roi_kobold', room: 1, owners: [{ player: pid, units: 8 }] });
    const o = content.pack.online!;
    const again = simuler(
      { engineVersion: o.engineVersion, params: content.pack.params, skills: content.pack.skills, units: input.units },
      Number(b.seed),
    );
    // (jsonb réordonne les clés de l'entrée : on compare les valeurs, pas le texte)
    expect(again.log).toEqual(JSON.parse(gunzipSync(b.log!).toString('utf8')));

    // Sortie : le coffre part en banque, l'or entre au grand livre, retour sur l'étape de la route.
    const chest = v.chest;
    const bank0 = await contents(t.db as never, pid, 'BANK');
    const out = await run(pid, leaveDungeon, {});
    expect(out).toEqual({ gold: v.chestGold, room: 4 });
    expect(await balance(t.db as never, pid)).toBe(gold0 + v.chestGold);
    const bank = await contents(t.db as never, pid, 'BANK');
    for (const s of chest.stacks)
      expect(bank.stacks.find((x) => x.item === s.item)?.qty).toBe((bank0.stacks.find((x) => x.item === s.item)?.qty ?? 0) + s.qty);
    expect(bank.instances.length).toBe(bank0.instances.length + chest.instances.length);
    expect(await contents(t.db as never, pid, 'DUNGEON_CHEST')).toEqual({ stacks: [], instances: [] });
    expect(await player(pid)).toMatchObject({ pos_kind: 'route', pos_dungeon_run: null, pos_route: 'pres_brande', pos_step: 0 });
    const runRow = await t.db.selectFrom('dungeon_run').selectAll().where('id', '=', runId).executeTakeFirstOrThrow();
    expect(runRow).toMatchObject({ status: 'closed', room: 4 });
    const entry = await t.db
      .selectFrom('gold_entry')
      .innerJoin('gold_account', 'gold_account.id', 'gold_entry.account_id')
      .select(['gold_entry.amount', 'gold_account.code'])
      .where('gold_entry.reason', '=', 'donjon terriers_roi_kobold')
      .execute();
    expect(entry).toEqual(expect.arrayContaining([{ amount: -v.chestGold, code: 'SOURCE_DUNGEON' }]));
    expect(await err(run(pid, leaveDungeon, {}))).toBe('WRONG_POSITION');
  });

  it('défaite : le coffre est perdu, le joueur rentre dans sa ville et ses troupes sont soignées', async () => {
    const pid = await atDoor();
    await run(pid, openDungeon, { mode: 'solo' });
    expect((await fought(pid)).won).toBe(true);
    const chest = (await dungeonView(t.db, content, pid))!.chest;
    expect(chest.stacks.length + chest.instances.length).toBeGreaterThan(0);
    const gold0 = await balance(t.db as never, pid);

    // Une seule troupe, à 1 PV : la salle suivante est perdue.
    const [keep, ...rest] = await loadTroops(t.db as never, pid, ['SQUAD']);
    await t.db.transaction().execute(async (tx) => {
      await tx
        .updateTable('troop')
        .set({ container: 'BARRACKS' })
        .where(
          'id',
          'in',
          rest.map((x) => x.id),
        )
        .execute();
      for (const u of keep!.units) await setUnit(tx, keep!.id, u.n, { hp: 1, mana: 0 });
    });
    later();
    const r = await fought(pid);
    expect(r.won).toBe(false);
    expect(r.rewards.retreat).toBe(true);
    expect(await dungeonView(t.db, content, pid)).toBeNull();
    expect(await contents(t.db as never, pid, 'DUNGEON_CHEST')).toEqual({ stacks: [], instances: [] });
    expect(await balance(t.db as never, pid)).toBe(gold0);
    const p = await player(pid);
    expect(p).toMatchObject({ pos_kind: 'city', pos_region: 'ronces', pos_dungeon_run: null });
    const member = await t.db.selectFrom('dungeon_member').selectAll().where('player_id', '=', pid).executeTakeFirstOrThrow();
    expect(member).toMatchObject({ status: 'defeated', chest_gold: 0 });
    // Ce qui reste de l'escouade est soigné en ville.
    for (const tr of await loadTroops(t.db as never, pid, ['SQUAD', 'BARRACKS']))
      for (const u of tr.units) expect(u.hp).toBe(statsOf(content, tr, u).hpMax);
    // Le coffre est parti au puits, journalisé.
    const moves = await t.db
      .selectFrom('asset_move')
      .select(['from_container', 'to_container'])
      .where('player_id', '=', pid)
      .where('reason', '=', 'défaite en donjon')
      .execute();
    expect(moves.length).toBe(chest.stacks.length + chest.instances.length);
    expect(moves.every((m) => m.from_container === 'DUNGEON_CHEST' && m.to_container === 'SYSTEM')).toBe(true);
  });

  it('refuse d’ouvrir sans escouade, et de quitter ou combattre hors d’un donjon', async () => {
    const pid = await atDoor();
    await t.db.updateTable('troop').set({ container: 'BARRACKS' }).where('player_id', '=', pid).where('container', '=', 'SQUAD').execute();
    expect(await err(run(pid, openDungeon, { mode: 'solo' }))).toBe('SQUAD_EMPTY');
    expect(await err(run(pid, fightRoom, {}))).toBe('WRONG_POSITION');
    expect(await err(run(pid, openDungeon, { mode: 'duo' }))).toBe('INVALID_INPUT');
  });
});

describe('outil de test : porte de donjon', () => {
  it('fait apparaître la porte de la route sur l’étape, seulement sur une route à donjon', async () => {
    const pid = await newPlayer();
    await squad(pid, 30);
    roll = 999; // aucune porte tirée
    await run(pid, depart, { direction: 1, route: 'ronces' });
    expect(await err(run(pid, spawnTestDoor, {}))).toBe('NO_DUNGEON_HERE');
    await run(pid, goHome);
    await run(pid, depart, { direction: 1, route: 'pres_brande' });
    expect(await doorView(t.db, content, pid)).toBeNull();
    expect(await run(pid, spawnTestDoor, {})).toEqual({ dungeon: 'terriers_roi_kobold' });
    expect(await doorView(t.db, content, pid)).toMatchObject({ dungeon: 'terriers_roi_kobold' });
    expect(await err(run(pid, spawnTestDoor, {}))).toBe('ok'); // la porte visible est remplacée, jamais doublée
    const visible = await t.db
      .selectFrom('dungeon_door')
      .select('id')
      .where('player_id', '=', pid)
      .where('status', '=', 'visible')
      .execute();
    expect(visible).toHaveLength(1);
  });
});
