/**
 * Donjon à deux (J7, README 23.2 et 23.3, guide 9) sur une vraie base. Le test du guide 9.4 joue un duo complet :
 * invitation au hasard, 9 salles avec 2 boss, sortie de l'un à la salle 6, défaite de l'autre à la salle 9 ; il
 * vérifie les coffres, les morts, l'or au grand livre et la conservation des biens, et rejoue chaque combat depuis
 * sa ligne `battle`. Puis : invitation d'un ami, refus, expiration, absence, votes simultanés.
 */
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { sql } from '@cr/db';
import { validateContent } from '@cr/content';
import { simuler } from '@cr/engine';
import type { GenContent } from '@cr/gen';
import { startTestDb, type TestDb } from '@cr/testing';
import {
  acceptFriend,
  acceptInvite,
  balance,
  command,
  contents,
  createTestSquad,
  declineInvite,
  depart,
  dungeonView,
  executeCommand,
  fightRoom,
  goSolo,
  invitationsFor,
  inviteDungeon,
  leaveDungeon,
  loadTroops,
  memoryMailer,
  noRateLimit,
  openDungeon,
  requestFriend,
  setUnit,
  signup,
  sweepDungeons,
  type CommandDef,
  type DomainEvent,
  type GameContent,
} from '../src/index.ts';

const compiled = validateContent(join(import.meta.dirname, '../../../content'));
const content: GameContent = { pack: compiled.pack as unknown as GenContent, hash: compiled.hash! };
const o = content.pack.online!;

let t: TestDb;
let now = new Date('2026-11-05T10:00:00Z');
let n = 0;
const events: DomainEvent[] = [];

beforeAll(async () => {
  expect(compiled.ok).toBe(true);
  t = await startTestDb();
});
afterAll(async () => t?.stop());

async function newPlayer(): Promise<number> {
  n++;
  await signup(
    { db: t.db, mailer: memoryMailer(), appUrl: 'http://test' },
    { email: `duo${n}@example.org`, pseudo: `Duo ${n}`, password: 'motdepasse-long', acceptTos: true },
  );
  return (await t.db.selectFrom('player').select('id').where('pseudo', '=', `Duo ${n}`).executeTakeFirstOrThrow()).id;
}
function run<S extends z.ZodType, R>(pid: number, def: CommandDef<S, R>, input: unknown = {}): Promise<R> {
  return executeCommand(
    { db: t.db, rateLimiter: noRateLimit, publish: (e) => events.push(...e), content, clock: () => now, random: () => 0 },
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
const err = (p: Promise<unknown>) => p.then(() => 'ok').catch((e: { code?: string }) => e.code ?? String(e));
const pseudo = async (pid: number) => (await player(pid)).pseudo;
/** Présent : vu il y a un instant, disponible pour un donjon. */
const present = (pid: number, available = true) =>
  t.db.updateTable('player').set({ last_seen_at: now, dungeon_available: available }).where('id', '=', pid).execute();

/** Joueur à Havre-Gris avec une escouade de niveau `level`. */
async function ready(level = 30): Promise<number> {
  const pid = await newPlayer();
  await run(pid, start);
  await t.db.transaction().execute(async (tx) => {
    await tx.updateTable('troop').set({ container: 'BARRACKS' }).where('player_id', '=', pid).where('container', '=', 'SQUAD').execute();
    await createTestSquad(tx, content, pid, level, 'test');
  });
  await present(pid);
  return pid;
}
/** Ouvreur devant la porte des Terriers du Roi Kobold (tirages à 0 : la porte apparaît). */
async function opener(): Promise<number> {
  const pid = await ready();
  await run(pid, depart, { direction: 1, route: 'pres_brande' });
  return pid;
}
const weaken = async (pid: number) => {
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
};
const runOf = async (pid: number) => (await dungeonView(t.db, content, pid, now))!;
/** Quantités par (joueur, objet) dans un conteneur, et exemplaires. */
async function holdings(container: string) {
  const stacks = await sql<{ player_id: number; item: string; qty: number }>`
    select player_id, item, qty from item_stack where container = ${container}`.execute(t.db);
  const inst = await sql<{ id: number }>`select id from item_instance where container = ${container}`.execute(t.db);
  return { stacks: stacks.rows, instances: inst.rows.map((r) => Number(r.id)) };
}

describe('duo complet (guide 9.4)', () => {
  it('invitation au hasard, 9 salles et 2 boss, sortie à la salle 6, défaite à la salle 9', async () => {
    const a = await opener();
    const b = await ready();
    const c = await ready();
    const off = await ready();
    await present(off, false); // pas disponible : jamais sollicité
    const goldA0 = await balance(t.db as never, a);
    const goldB0 = await balance(t.db as never, b);
    const bankB0 = await contents(t.db as never, b, 'BANK');

    // Invitation au hasard : envoyée aux joueurs disponibles de la région, par SSE.
    events.length = 0;
    const { run: runId } = await run(a, openDungeon, { mode: 'random' });
    let v = await runOf(a);
    expect(v).toMatchObject({ status: 'lobby', invite: { kind: 'random', count: 2 } });
    const invited = events.filter((e) => e.type === 'dungeon.invite').map((e) => e.topic);
    expect(invited.sort()).toEqual([`user:${b}`, `user:${c}`].sort());
    expect((await invitationsFor(t.db, content, b, now)).map((x) => x.run)).toEqual([runId]);
    expect(await err(run(off, acceptInvite, { run: runId }))).toBe('INVITE_NOT_FOUND');

    // Le premier qui accepte rejoint ; l'autre voit « déjà pris ».
    expect(await run(b, acceptInvite, { run: runId })).toEqual({ run: runId });
    expect(await err(run(c, acceptInvite, { run: runId }))).toBe('INVITE_TAKEN');
    expect(await player(b)).toMatchObject({ pos_kind: 'dungeon', pos_dungeon_run: runId, pos_region: 'ronces' });
    v = await runOf(a);
    expect(v.members.map((m) => [m.id, m.role])).toEqual([
      [a, 'opener'],
      [b, 'guest'],
    ]);
    expect(v.next).toMatchObject({ n: 1, pop: 8 }); // dimensionné pour deux escouades

    // Salles 1 à 6 à deux : chacun vote, le second vote lance le combat.
    const battles: number[] = [];
    for (let k = 1; k <= 6; k++) {
      later();
      await present(a);
      await present(b);
      expect(await run(a, fightRoom, { version: (await runOf(a)).version })).toEqual({ waiting: true });
      expect((await runOf(b)).members.find((m) => m.id === a)!.ready).toBe(true);
      const r = await run(b, fightRoom, {});
      if (!('battle' in r)) throw new Error('combat attendu');
      expect(r.won, `salle ${k}`).toBe(true);
      battles.push(r.battle);
    }
    // Deux escouades dans le même camp, l'ouvreur d'abord ; monstres dimensionnés pour deux (≤ 22 de population).
    const b4 = await t.db.selectFrom('battle').selectAll().where('id', '=', battles[3]!).executeTakeFirstOrThrow();
    const in4 = b4.input as { units: { side: number; kind: string }[]; dungeon: { owners: { player: number; units: number }[] } };
    expect(in4.dungeon.owners.map((x) => x.player)).toEqual([a, b]);
    expect(in4.units.filter((u) => u.side === 0)).toHaveLength(in4.dungeon.owners.reduce((x, y) => x + y.units, 0));
    expect(in4.units.find((u) => u.side === 1)!.kind).toBe('taupe_reine');
    // Chacun a son bilan et son butin ; les deux ont le trophée du boss de la salle 4 dans leur coffre.
    const parts = await t.db.selectFrom('battle_participant').select(['player_id']).where('battle_id', '=', battles[3]!).execute();
    expect(parts.map((x) => x.player_id).sort()).toEqual([a, b].sort());
    for (const pid of [a, b]) expect((await runOf(pid)).chest.stacks).toContainEqual({ item: 'trophee_taupe_reine', qty: 1 });

    // Salle 6 gagnée : B sort avec son coffre ; A continue seul (salles redimensionnées pour une escouade).
    later();
    const chestB = await runOf(b);
    expect(chestB.room).toBe(6);
    await run(b, leaveDungeon, {});
    expect(await player(b)).toMatchObject({ pos_kind: 'city', pos_region: 'ronces', pos_dungeon_run: null });
    expect(await balance(t.db as never, b)).toBe(goldB0 + chestB.chestGold);
    const bankB = await contents(t.db as never, b, 'BANK');
    for (const s of chestB.chest.stacks)
      expect(bankB.stacks.find((x) => x.item === s.item)?.qty).toBe((bankB0.stacks.find((x) => x.item === s.item)?.qty ?? 0) + s.qty);
    expect(bankB.instances.length).toBe(bankB0.instances.length + chestB.chest.instances.length);
    v = await runOf(a);
    expect(v.members.map((m) => m.id)).toEqual([a]);
    expect(v.next).toMatchObject({ n: 7, pop: 10 });

    // Salles 7 et 8 (boss 2) seul, puis défaite à la salle 9 : le coffre de A est perdu.
    for (let k = 7; k <= 8; k++) {
      later();
      const r = await run(a, fightRoom, {});
      if (!('battle' in r)) throw new Error('combat attendu');
      expect(r.won, `salle ${k}`).toBe(true);
      battles.push(r.battle);
    }
    expect((await runOf(a)).chest.stacks).toContainEqual({ item: 'trophee_chef_gratte_gratte', qty: 1 });
    const deathsBefore = (await player(a)).stat_deaths;
    await weaken(a);
    later();
    const lost = await run(a, fightRoom, {});
    if (!('battle' in lost)) throw new Error('combat attendu');
    battles.push(lost.battle);
    expect(lost.won).toBe(false);
    expect(lost.rewards.deaths.length).toBeGreaterThan(0);
    expect((await player(a)).stat_deaths).toBe(deathsBefore + lost.rewards.deaths.length);
    expect(await player(a)).toMatchObject({ pos_kind: 'city', pos_region: 'ronces', pos_dungeon_run: null });
    expect(await balance(t.db as never, a)).toBe(goldA0);
    expect(await t.db.selectFrom('dungeon_run').select(['status', 'room']).where('id', '=', runId).executeTakeFirstOrThrow()).toEqual({
      status: 'closed',
      room: 8,
    });
    const members = await t.db.selectFrom('dungeon_member').select(['player_id', 'status']).where('run_id', '=', runId).execute();
    expect(Object.fromEntries(members.map((m) => [m.player_id, m.status]))).toEqual({ [a]: 'defeated', [b]: 'left' });

    // Or : seul le coffre de B est entré au grand livre, depuis SOURCE_DUNGEON ; les écritures s'équilibrent.
    const dungeonGold = await sql<{ s: number }>`
      select coalesce(sum(e.amount), 0)::int as s from gold_entry e join gold_account a on a.id = e.account_id
      where a.code = 'SOURCE_DUNGEON' and e.reason = 'donjon terriers_roi_kobold' and e.tx in (
        select tx from gold_entry e2 join gold_account a2 on a2.id = e2.account_id where a2.player_id in (${a}, ${b}))`.execute(t.db);
    expect(dungeonGold.rows[0]!.s).toBe(-chestB.chestGold);
    const unbalanced = await sql`select tx from gold_entry group by tx having sum(amount) <> 0`.execute(t.db);
    expect(unbalanced.rows).toEqual([]);

    // Conservation des biens : tout ce qui est entré dans un coffre en est sorti (banque de B, puits pour A), une fois.
    expect(await holdings('DUNGEON_CHEST')).toEqual({ stacks: [], instances: [] });
    for (const pid of [a, b]) {
      const flows = await sql<{ dir: string; to_container: string; qty: number }>`
        select case when to_container = 'DUNGEON_CHEST' then 'in' else 'out' end as dir, to_container, sum(qty)::int as qty
        from asset_move where player_id = ${pid} and (to_container = 'DUNGEON_CHEST' or from_container = 'DUNGEON_CHEST')
        group by 1, 2`.execute(t.db);
      const by = Object.fromEntries(flows.rows.map((f) => [`${f.dir}:${f.to_container}`, f.qty]));
      expect(by[`in:DUNGEON_CHEST`]).toBeGreaterThan(0);
      expect(by[`in:DUNGEON_CHEST`]).toBe(by[pid === a ? 'out:SYSTEM' : 'out:BANK']);
    }

    // Chaque combat se rejoue depuis sa ligne battle : même journal, même résultat.
    expect(battles).toHaveLength(9);
    for (const id of battles) {
      const row = await t.db.selectFrom('battle').selectAll().where('id', '=', id).executeTakeFirstOrThrow();
      const input = row.input as { units: never };
      const again = simuler(
        { engineVersion: o.engineVersion, params: content.pack.params, skills: content.pack.skills, units: input.units },
        Number(row.seed),
      );
      expect(again.log).toEqual(JSON.parse(gunzipSync(row.log).toString('utf8')));
      expect(again.result).toEqual(row.result);
    }
  });
});

describe('invitations', () => {
  it('invite un ami de la même région, seulement un ami ; un refus rend la main à l’ouvreur', async () => {
    const a = await opener();
    const f = await ready();
    const stranger = await ready();
    expect(await err(run(a, openDungeon, { mode: 'friend', pseudo: await pseudo(f) }))).toBe('NOT_FRIENDS');
    await run(a, requestFriend, { pseudo: await pseudo(f) });
    await run(f, acceptFriend, { player: a });
    // Hors de la région : refusé.
    await t.db.updateTable('player').set({ pos_region: 'marais' }).where('id', '=', f).execute();
    expect(await err(run(a, openDungeon, { mode: 'friend', pseudo: await pseudo(f) }))).toBe('INVITEE_UNAVAILABLE');
    await t.db.updateTable('player').set({ pos_region: 'ronces' }).where('id', '=', f).execute();

    const { run: runId } = await run(a, openDungeon, { mode: 'friend', pseudo: await pseudo(f) });
    expect((await runOf(a)).invite).toMatchObject({ kind: 'friend', to: await pseudo(f) });
    const note = await t.db
      .selectFrom('notification')
      .select('type')
      .where('player_id', '=', f)
      .where('type', '=', 'dungeon.invite')
      .execute();
    expect(note).toHaveLength(1);
    expect(await err(run(stranger, acceptInvite, { run: runId }))).toBe('INVITE_NOT_FOUND');
    expect(await err(run(a, inviteDungeon, { mode: 'random' }))).toBe('INVITE_PENDING');
    await run(f, declineInvite, { run: runId });
    expect((await runOf(a)).invite).toBeNull();
    expect(await err(run(f, acceptInvite, { run: runId }))).toBe('INVITE_NOT_FOUND');

    // Sans partenaire, l'ouvreur continue seul.
    await run(a, goSolo, {});
    expect(await runOf(a)).toMatchObject({ status: 'between_rooms', members: [{ id: a }] });
    const r = await run(a, fightRoom, {});
    expect('battle' in r).toBe(true);
  });

  it('une invitation expire au bout de 60 s ; le worker l’efface et prévient l’ouvreur', async () => {
    const a = await opener();
    const b = await ready();
    const { run: runId } = await run(a, openDungeon, { mode: 'random' });
    expect((await runOf(a)).invite).not.toBeNull();
    now = new Date(now.getTime() + 61_000);
    expect(await err(run(b, acceptInvite, { run: runId }))).toBe('INVITE_EXPIRED');
    const published: unknown[] = [];
    expect(await sweepDungeons(t.db, { now, publish: (e) => published.push(...e) })).toMatchObject({ expired: 1 });
    expect((await runOf(a)).invite).toBeNull();
    expect(published).toContainEqual(expect.objectContaining({ topic: `user:${a}`, type: 'dungeon.update' }));
    const note = await t.db
      .selectFrom('notification')
      .select('type')
      .where('player_id', '=', a)
      .where('type', '=', 'dungeon.invite_expired')
      .execute();
    expect(note).toHaveLength(1);
    // Une nouvelle invitation est possible ; personne de disponible : refusée.
    await t.db.updateTable('player').set({ dungeon_available: false }).where('id', '<>', a).execute();
    expect(await err(run(a, inviteDungeon, { mode: 'random' }))).toBe('NO_PLAYER_AVAILABLE');
    // L'ouvreur peut aussi refermer la partie (il sort, rien dans le coffre).
    await run(a, leaveDungeon, {});
    expect(await t.db.selectFrom('dungeon_run').select('status').where('id', '=', runId).executeTakeFirstOrThrow()).toEqual({
      status: 'closed',
    });
    expect((await player(a)).pos_kind).toBe('route');
  });
});

describe('duo : absence et concurrence', () => {
  async function duo(): Promise<{ a: number; b: number; runId: number }> {
    const a = await opener();
    const b = await ready();
    const { run: runId } = await run(a, openDungeon, { mode: 'random' });
    await run(b, acceptInvite, { run: runId });
    return { a, b, runId };
  }

  it('un membre absent plus de 5 minutes sort avec son coffre, l’autre continue seul', async () => {
    const { a, b, runId } = await duo();
    later();
    await present(a);
    await present(b);
    await run(a, fightRoom, {});
    const r = await run(b, fightRoom, {});
    expect('battle' in r && r.won).toBe(true);
    const chest = await runOf(b);
    // B ne donne plus signe de vie ; A est là.
    now = new Date(now.getTime() + 6 * 60_000);
    await present(a);
    await t.db
      .updateTable('player')
      .set({ last_seen_at: new Date(now.getTime() - 6 * 60_000) })
      .where('id', '=', b)
      .execute();
    const res = await sweepDungeons(t.db, { now });
    expect(res.idle).toBe(1);
    expect(await player(b)).toMatchObject({ pos_kind: 'city', pos_dungeon_run: null });
    expect((await contents(t.db as never, b, 'DUNGEON_CHEST')).stacks).toEqual([]);
    expect((await runOf(a)).members.map((m) => m.id)).toEqual([a]);
    const left = await t.db
      .selectFrom('dungeon_member')
      .select('status')
      .where('run_id', '=', runId)
      .where('player_id', '=', b)
      .executeTakeFirstOrThrow();
    expect(left.status).toBe('left');
    const moved = await t.db
      .selectFrom('asset_move')
      .select('qty')
      .where('player_id', '=', b)
      .where('reason', '=', 'absence en donjon')
      .execute();
    expect(moved.reduce((x, y) => x + y.qty, 0)).toBe(chest.chest.stacks.reduce((x, y) => x + y.qty, 0) + chest.chest.instances.length);
    // Une seconde passe ne change rien.
    expect(await sweepDungeons(t.db, { now })).toEqual({ expired: 0, idle: 0 });
  });

  it('deux votes simultanés ne lancent qu’un combat, sans interblocage ; une sortie et un vote simultanés aussi', async () => {
    const { a, b, runId } = await duo();
    later();
    await present(a);
    await present(b);
    const [ra, rb] = await Promise.all([run(a, fightRoom, {}), run(b, fightRoom, {})]);
    const fights = [ra, rb].filter((r) => 'battle' in r);
    expect(fights).toHaveLength(1);
    const count = await t.db
      .selectFrom('battle')
      .select((eb) => eb.fn.countAll<number>().as('n'))
      .where('kind', '=', 'dungeon')
      .where(sql`input->'dungeon'->>'run'`, '=', String(runId))
      .executeTakeFirstOrThrow();
    expect(Number(count.n)).toBe(1);

    later();
    await present(a);
    await present(b);
    const v = (await runOf(a)).version;
    const out = await Promise.all([err(run(a, leaveDungeon, { version: v })), err(run(b, fightRoom, { version: v }))]);
    // Soit B a voté avant la sortie de A (vote perdu), soit après (version périmée) ; jamais de combat à un.
    expect(out[0]).toBe('ok');
    expect(['ok', 'DUNGEON_STALE']).toContain(out[1]);
    const after = await runOf(b);
    expect(after.members.map((m) => m.id)).toEqual([b]);
    expect(after.room).toBe(1);
  });
});
