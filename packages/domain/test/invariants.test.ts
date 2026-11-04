/**
 * Contrôles d'invariants (guide 19.3) : muets sur une partie jouée normalement (combat, butin, vente en boutique,
 * donjon), ils signalent chaque corruption faite à la main ; les combats enregistrés se rejouent à l'identique.
 */
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { sql } from '@cr/db';
import { validateContent } from '@cr/content';
import type { GenContent } from '@cr/gen';
import { startTestDb, type TestDb } from '@cr/testing';
import {
  addStack,
  battleLog,
  purgeBattleLogs,
  checkInvariants,
  command,
  createTestSquad,
  depart,
  executeCommand,
  fight,
  fightRoom,
  goHome,
  listGoods,
  memoryMailer,
  noRateLimit,
  openDungeon,
  replayBattles,
  signup,
  type CommandDef,
  type GameContent,
} from '../src/index.ts';

const compiled = validateContent(join(import.meta.dirname, '../../../content'));
const content: GameContent = { pack: compiled.pack as unknown as GenContent, hash: compiled.hash! };
let t: TestDb;
let now = new Date('2026-11-06T10:00:00Z');
let n = 0;

beforeAll(async () => {
  expect(compiled.ok).toBe(true);
  t = await startTestDb();
});
afterAll(async () => t?.stop());

function run<S extends z.ZodType, R>(pid: number, def: CommandDef<S, R>, input: unknown = {}): Promise<R> {
  return executeCommand({ db: t.db, rateLimiter: noRateLimit, publish: () => {}, content, clock: () => now, random: () => 0 }, def, {
    playerId: pid,
    input,
  });
}
const later = (): void => void (now = new Date(now.getTime() + 3_600_000));
const start = command({
  name: 'test.start',
  input: z.object({}),
  rate: { perMinute: 1000 },
  allowedDuringWatch: true,
  run: async () => ({}),
});
async function newPlayer(): Promise<number> {
  n++;
  await signup(
    { db: t.db, mailer: memoryMailer(), appUrl: 'http://test' },
    { email: `inv${n}@example.org`, pseudo: `Invariant ${n}`, password: 'motdepasse-long', acceptTos: true },
  );
  const pid = (await t.db.selectFrom('player').select('id').where('pseudo', '=', `Invariant ${n}`).executeTakeFirstOrThrow()).id;
  await run(pid, start);
  await t.db.transaction().execute(async (tx) => {
    await tx.updateTable('troop').set({ container: 'BARRACKS' }).where('player_id', '=', pid).where('container', '=', 'SQUAD').execute();
    await createTestSquad(tx, content, pid, 30, 'test');
  });
  return pid;
}
const checks = async () => (await checkInvariants(t.db, content)).map((v) => v.check);

describe('invariants', () => {
  let a = 0;
  let b = 0;

  it('ne signalent rien après une partie jouée normalement', async () => {
    a = await newPlayer();
    b = await newPlayer();
    // Combats sur la route, retour en ville (soin), vente en boutique, donjon ouvert avec un coffre non vide.
    await run(a, depart, { direction: 1, route: 'ronces' });
    await run(a, fight, {});
    later();
    await run(a, goHome, {});
    await t.db.transaction().execute((tx) => addStack(tx, content, a, 'BANK', 'bois_tordu', 5, 'SYSTEM', 'test'));
    await run(a, listGoods, { kind: 'stack', item: 'bois_tordu', qty: 2, price: 50 });
    await run(b, depart, { direction: 1, route: 'pres_brande' });
    await run(b, openDungeon, { mode: 'solo' });
    await run(b, fightRoom, {});
    later();
    expect(await checks()).toEqual([]);
  });

  it('signalent un solde faux, un coffre orphelin, une escouade trop grande et une troupe blessée en ville', async () => {
    await t.db
      .updateTable('gold_account')
      .set({ balance: sql`balance + 7` })
      .where('player_id', '=', a)
      .execute();
    await t.db.transaction().execute((tx) => addStack(tx, content, a, 'DUNGEON_CHEST', 'bois_tordu', 1, 'SYSTEM', 'test'));
    const extra = await t.db.selectFrom('troop').select('id').where('player_id', '=', a).where('container', '=', 'BARRACKS').execute();
    await t.db
      .updateTable('troop')
      .set({ container: 'SQUAD' })
      .where(
        'id',
        'in',
        extra.map((x) => x.id),
      )
      .execute();
    await sql`update troop_unit set hp = 1 where troop_id = ${extra[0]!.id}`.execute(t.db);
    const found = await checks();
    expect(found).toEqual(
      expect.arrayContaining([
        'ledger.balance_mismatch',
        'ledger.total_not_zero',
        'dungeon.chest_without_run',
        'squad.too_big',
        'squad.not_healed_in_city',
      ]),
    );
  });

  it('rejouent les combats de la journée à l’identique, et voient un combat altéré', async () => {
    const since = new Date(Date.now() - 86_400_000); // created_at : horloge de la base
    const until = new Date(Date.now() + 86_400_000);
    expect(await replayBattles(t.db, content, { since, until })).toEqual([]);
    const one = await t.db.selectFrom('battle').select('id').orderBy('id').executeTakeFirstOrThrow();
    // Résultat enregistré altéré (durée) : le combat rejoué ne correspond plus.
    await sql`update battle set result = jsonb_set(result, '{time}', to_jsonb((result->>'time')::int + 1)) where id = ${one.id}`.execute(
      t.db,
    );
    expect(await replayBattles(t.db, content, { since, until })).toEqual([{ check: 'battle.replay_differs', detail: { battle: one.id } }]);
  });
});

describe('journaux de combat (guide 15.3)', () => {
  it('efface les journaux de plus de 30 jours ; le combat se rejoue à l’identique tant que le contenu est le même', async () => {
    const select = () =>
      t.db.selectFrom('battle').select(['id', 'log', 'input', 'seed', 'engine_version', 'content_version']).orderBy('id');
    const before = await select().execute();
    expect(before.length).toBeGreaterThan(0);
    const logs = before.map((b) => JSON.parse(battleLog(content, b)!));
    // Rien n'a 30 jours : rien n'est effacé ; dans 31 jours, tout l'est.
    expect(await purgeBattleLogs(t.db)).toBe(0);
    expect(await purgeBattleLogs(t.db, new Date(Date.now() + 31 * 86_400_000))).toBe(before.length);
    const after = await select().execute();
    expect(after.every((b) => b.log === null)).toBe(true);
    expect(after.map((b) => JSON.parse(battleLog(content, b)!))).toEqual(logs);
    // Contenu changé depuis : pas de rediffusion possible.
    expect(battleLog({ ...content, hash: 'autre' }, after[0]!)).toBeNull();
  });
});
