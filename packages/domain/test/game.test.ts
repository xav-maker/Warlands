/**
 * Boucle solo (J2) sur une vraie base : kit de départ, déplacements, rencontres, combat, butin, défaite,
 * entrée en ville, grand livre. Aléa à graine fixe et horloge pilotée : les combats sont reproductibles.
 */
import { join } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { sql } from '@cr/db';
import { validateContent } from '@cr/content';
import type { GenContent } from '@cr/gen';
import { Rng } from '@cr/rng';
import { startTestDb, type TestDb } from '@cr/testing';
import {
  addStack,
  advance,
  arrive,
  back,
  balance,
  bankMove,
  command,
  merchantBuy,
  merchantBuyTroop,
  transferGold,
  merchantSell,
  setUnit,
  useConsumable,
  contents,
  createTestSquad,
  depart,
  discard,
  executeCommand,
  fight,
  goHome,
  loadTroops,
  memoryMailer,
  noRateLimit,
  searchEncounter,
  signup,
  statsOf,
  takeLoot,
  type CommandDef,
  type GameContent,
} from '../src/index.ts';
import { z } from 'zod';

const compiled = validateContent(join(import.meta.dirname, '../../../content'));
const content: GameContent = { pack: compiled.pack as unknown as GenContent, hash: compiled.hash! };

let t: TestDb;
let now = new Date('2026-11-04T10:00:00Z');
let rng = new Rng(1);
let random: (max: number) => number = (max) => rng.next() % max;
let n = 0;

async function newPlayer(): Promise<number> {
  n++;
  await signup(
    { db: t.db, mailer: memoryMailer(), appUrl: 'http://test' },
    { email: `j${n}@example.org`, pseudo: `Joueur ${n}`, password: 'motdepasse-long', acceptTos: true },
  );
  return (await t.db.selectFrom('player').select('id').where('pseudo', '=', `Joueur ${n}`).executeTakeFirstOrThrow()).id;
}

function run<S extends z.ZodType, R>(pid: number, def: CommandDef<S, R>, input: unknown = {}): Promise<R> {
  return executeCommand(
    { db: t.db, rateLimiter: noRateLimit, publish: () => {}, content, clock: () => now, random: (m) => random(m) },
    def,
    { playerId: pid, input },
  );
}
/** Laisse passer le blocage de rediffusion. */
const later = (): void => void (now = new Date(now.getTime() + 3_600_000));
const player = (pid: number) => t.db.selectFrom('player').selectAll().where('id', '=', pid).executeTakeFirstOrThrow();
const visible = (pid: number) =>
  t.db.selectFrom('encounter').selectAll().where('player_id', '=', pid).where('status', '=', 'visible').execute();

/** Remplace l'escouade de départ par une escouade pleine de haut niveau (8 unités, 10 de population). */
async function strongSquad(pid: number, level = 30): Promise<void> {
  await run(pid, searchOrStart); // remet le kit de départ
  await t.db.transaction().execute(async (tx) => {
    await tx.updateTable('troop').set({ container: 'BARRACKS' }).where('player_id', '=', pid).execute();
    await createTestSquad(tx, content, pid, level, 'test');
  });
}
/** Commande neutre : déclenche seulement le kit de départ. */
const searchOrStart = command({
  name: 'test.start',
  input: z.object({}),
  rate: { perMinute: 1000 },
  allowedDuringWatch: true,
  run: async () => ({}),
});

beforeAll(async () => {
  expect(compiled.ok).toBe(true);
  t = await startTestDb();
});
afterAll(async () => t?.stop());
beforeEach(() => {
  rng = new Rng(1);
  random = (max) => rng.next() % max;
});

describe('kit de départ (README 8.1)', () => {
  it('est remis une fois, à la première commande de jeu', async () => {
    const pid = await newPlayer();
    expect((await player(pid)).started_at).toBeNull();
    await run(pid, searchOrStart);
    await run(pid, searchOrStart);
    const p = await player(pid);
    expect(p.started_at).not.toBeNull();
    expect(p.content_version).toBe(content.hash);
    const bank = await t.db.transaction().execute((tx) => contents(tx, pid, 'BANK'));
    expect(bank.stacks.find((s) => s.item === 'bandage')?.qty).toBe(3);
    expect(bank.stacks.length).toBeGreaterThan(1); // + ingrédients de sa recette d'Acolyte
    const troops = await t.db.transaction().execute((tx) => loadTroops(tx, pid));
    expect(troops.map((x) => [x.type, x.level, x.container])).toEqual([
      ['milicien', 1, 'SQUAD'],
      ['milicien', 1, 'SQUAD'],
      ['chasseur', 1, 'SQUAD'],
      ['chasseur', 1, 'SQUAD'],
      ['herboriste', 1, 'SQUAD'],
      ['herboriste', 1, 'SQUAD'],
    ]);
    for (const x of troops) for (const u of x.units) expect(u.hp).toBe(statsOf(content, x, u).hpMax);
    expect(await t.db.transaction().execute((tx) => balance(tx, pid))).toBe(1000);
  });
});

describe('déplacements (README 3.3)', () => {
  it('part vers l’avant, refuse à rebours depuis Havre-Gris, puis applique les règles d’étape', async () => {
    const pid = await newPlayer();
    await expect(run(pid, depart, { direction: -1 })).rejects.toMatchObject({ code: 'NO_SUCH_ROUTE' });
    expect(await run(pid, depart, { direction: 1 })).toEqual({ route: 'ronces', to: 'marais' });
    const p = await player(pid);
    expect([p.pos_kind, p.pos_region, p.pos_route, p.pos_direction, p.pos_step]).toEqual(['route', 'ronces', 'ronces', 1, 0]);
    expect(await visible(pid)).toHaveLength(1);
    await expect(run(pid, depart, { direction: 1 })).rejects.toMatchObject({ code: 'WRONG_POSITION' });
    await expect(run(pid, searchEncounter)).rejects.toMatchObject({ code: 'ENCOUNTER_VISIBLE' });
    await expect(run(pid, advance)).rejects.toMatchObject({ code: 'STEP_NOT_CLEARED' });
    await expect(run(pid, back)).rejects.toMatchObject({ code: 'FIRST_STEP' });
    await expect(run(pid, arrive)).rejects.toMatchObject({ code: 'NOT_AT_ROUTE_END' });
    await run(pid, goHome);
    expect((await player(pid)).pos_kind).toBe('city');
    expect(await visible(pid)).toHaveLength(0);
  });

  it('dimensionne les groupes pour une escouade de 8 (population ×2, 8 emplacements)', async () => {
    const pid = await newPlayer();
    await run(pid, depart, { direction: 1 });
    const [e] = await visible(pid);
    const side = e!.side as { troops: { type: string; units: unknown[] }[] };
    const pop = side.troops.reduce((a, x) => a + content.pack.troops[x.type]!.pop, 0);
    expect(pop).toBeGreaterThanOrEqual(2); // lisière : 1-2 dans le prototype, 2-4 en ligne
    expect(side.troops.reduce((a, x) => a + x.units.length, 0)).toBeLessThanOrEqual(8);
  });
});

describe('péage des routes (5 or par départ et par retour à l’étape précédente)', () => {
  const gold = (pid: number) => t.db.transaction().execute((tx) => balance(tx, pid));
  /** Ramène le solde du joueur à `to` or, par le grand livre. */
  const drainTo = async (pid: number, to: number) => {
    const g = await gold(pid);
    if (g > to) await t.db.transaction().execute((tx) => transferGold(tx, { player: pid }, { system: 'SINK_RESET' }, g - to, 'test'));
  };
  /** Écritures du compte système du péage, de la plus ancienne à la plus récente. */
  const tollEntries = () =>
    t.db
      .selectFrom('gold_entry')
      .innerJoin('gold_account', 'gold_account.id', 'gold_entry.account_id')
      .select(['gold_entry.amount', 'gold_entry.reason'])
      .where('gold_account.code', '=', 'SINK_ROUTE_TOLL')
      .orderBy('gold_entry.id')
      .execute();

  it('le contenu fixe le péage à 5 or', () => expect(content.pack.online?.routeToll).toBe(5));

  it('partir coûte 5 or, versés au compte système du péage', async () => {
    const pid = await newPlayer();
    await run(pid, searchOrStart);
    const before = await gold(pid);
    const sink = await tollEntries();
    await run(pid, depart, { direction: 1 });
    expect(await gold(pid)).toBe(before - 5);
    const after = await tollEntries();
    expect(after.length).toBe(sink.length + 1);
    expect(after.at(-1)).toMatchObject({ amount: 5, reason: 'péage départ ronces' });
  });

  it('refuse le départ, sans rien changer, quand l’or manque', async () => {
    const pid = await newPlayer();
    await run(pid, searchOrStart);
    await drainTo(pid, 4);
    await expect(run(pid, depart, { direction: 1 })).rejects.toMatchObject({ code: 'NOT_ENOUGH_GOLD' });
    expect(await gold(pid)).toBe(4);
    expect((await player(pid)).pos_kind).toBe('city');
    expect(await visible(pid)).toHaveLength(0);
    await t.db.transaction().execute((tx) => transferGold(tx, { system: 'SOURCE_ADMIN' }, { player: pid }, 1, 'test'));
    await run(pid, depart, { direction: 1 });
    expect(await gold(pid)).toBe(0);
  });

  it('rebrousser coûte 5 or ; avancer, combattre, chercher et rentrer sont gratuits', async () => {
    const pid = await newPlayer();
    await strongSquad(pid);
    await run(pid, depart, { direction: 1 });
    await run(pid, fight);
    later();
    const g0 = await gold(pid);
    await run(pid, advance);
    expect(await gold(pid)).toBe(g0);
    await run(pid, back);
    expect(await gold(pid)).toBe(g0 - 5);
    expect((await player(pid)).pos_step).toBe(0);
    await run(pid, goHome);
    expect(await gold(pid)).toBe(g0 - 5);
  });

  it('refuse de rebrousser sans or, et reste sur l’étape avec son groupe', async () => {
    const pid = await newPlayer();
    await strongSquad(pid);
    await run(pid, depart, { direction: 1 });
    await run(pid, fight);
    later();
    await run(pid, advance);
    const [seen] = await visible(pid);
    await drainTo(pid, 3);
    await expect(run(pid, back)).rejects.toMatchObject({ code: 'NOT_ENOUGH_GOLD' });
    const p = await player(pid);
    expect(p.pos_step).toBe(1);
    const [still] = await visible(pid);
    expect(still!.id).toBe(seen!.id);
    expect(await gold(pid)).toBe(3);
  });
});

describe('traversée complète (critère de J2, côté serveur)', () => {
  it('de Havre-Gris au gardien des Ronces, puis à Port-Salant', async () => {
    const pid = await newPlayer();
    await strongSquad(pid);
    await run(pid, depart, { direction: 1 });
    const gold0 = await t.db.transaction().execute((tx) => balance(tx, pid));
    for (let step = 0; step < 5; step++) {
      const r = await run(pid, fight);
      expect({ step, won: r.won, deaths: r.rewards.deaths.length }).toEqual({ step, won: true, deaths: r.rewards.deaths.length });
      expect(r.watchMs).toBeGreaterThan(0);
      // Rediffusion obligatoire : rien d'autre tant qu'elle n'est pas finie.
      await expect(step < 4 ? run(pid, advance) : run(pid, arrive)).rejects.toMatchObject({ code: 'WATCH_IN_PROGRESS' });
      later();
      if (step < 4) await run(pid, advance);
    }
    const p0 = await player(pid);
    expect(p0.guardians).toEqual(['ronces']);
    expect(await run(pid, arrive)).toEqual({ region: 'marais' });
    const p = await player(pid);
    expect([p.pos_kind, p.pos_region, p.unlocked, p.stat_fights, p.stat_wins]).toEqual(['city', 'marais', 1, 5, 5]);
    expect(await t.db.transaction().execute((tx) => balance(tx, pid))).toBeGreaterThan(gold0);
    // Objet de première victoire sur le gardien.
    const bag = await t.db.transaction().execute((tx) => contents(tx, pid, 'BAG'));
    const pending = await t.db.transaction().execute((tx) => contents(tx, pid, 'PENDING_LOOT'));
    expect(bag.stacks.some((s) => s.item === 'coeur_ronce')).toBe(true);
    expect(pending.stacks).toEqual([]);
    // Entrée en ville : tout le monde à pleine vie.
    for (const x of await t.db.transaction().execute((tx) => loadTroops(tx, pid)))
      for (const u of x.units) expect([u.hp, u.mana]).toEqual([statsOf(content, x, u).hpMax, statsOf(content, x, u).manaMax]);
    // Combats enregistrés, journal compressé.
    const battles = await t.db
      .selectFrom('battle')
      .select(['kind', 'won', 'engine_version', 'content_version'])
      .where('player_id', '=', pid)
      .orderBy('id')
      .execute();
    expect(battles.map((b) => b.kind)).toEqual(['route', 'route', 'route', 'route', 'guardian']);
    expect(new Set(battles.map((b) => `${b.engine_version} ${b.content_version}`))).toEqual(new Set([`v2 ${content.hash}`]));
  });
});

describe('défaite (guide 8.4)', () => {
  it('replie vers la ville, soigne, et la garde prête un Milicien si tout est mort', async () => {
    const pid = await newPlayer();
    await run(pid, searchOrStart);
    // Un Milicien seul, à 1 PV, face au gardien.
    await t.db.deleteFrom('troop').where('player_id', '=', pid).where('type', '=', 'chasseur').execute();
    await run(pid, depart, { direction: 1 });
    await t.db.transaction().execute(async (tx) => {
      const m = await tx.selectFrom('troop').select('id').where('player_id', '=', pid).executeTakeFirstOrThrow();
      await tx.updateTable('troop_unit').set({ hp: 1 }).where('troop_id', '=', m.id).execute();
      await tx
        .updateTable('expedition')
        .set({ cleared: [true, true, true, true, false] })
        .where('player_id', '=', pid)
        .execute();
      await tx.updateTable('player').set({ pos_step: 4 }).where('id', '=', pid).execute();
      await tx.updateTable('encounter').set({ status: 'gone' }).where('player_id', '=', pid).execute();
    });
    await run(pid, searchEncounter);
    await addPending(pid);
    const r = await run(pid, fight);
    expect(r.won).toBe(false);
    expect(r.rewards.retreat).toBe(true);
    const p = await player(pid);
    expect([p.pos_kind, p.pos_region]).toEqual(['city', 'ronces']);
    expect(await t.db.transaction().execute((tx) => contents(tx, pid, 'PENDING_LOOT'))).toEqual({ stacks: [], instances: [] });
    const troops = await t.db.transaction().execute((tx) => loadTroops(tx, pid));
    expect(troops.some((x) => x.units.length)).toBe(true);
    if (r.rewards.deaths.length) expect(troops.find((x) => x.loaned)?.type).toBe('milicien');
  });
});

/** Met un objet au sol, pour vérifier qu'il est perdu en quittant l'étape. */
const addPending = (pid: number) =>
  t.db.transaction().execute((tx) => addStack(tx, content, pid, 'PENDING_LOOT', 'bois_tordu', 2, 'SYSTEM', 'test'));

describe('sac plein et butin au sol (README 7.2)', () => {
  it('laisse au sol ce qui ne tient pas, se ramasse après avoir jeté, et se perd en avançant', async () => {
    const pid = await newPlayer();
    await strongSquad(pid);
    // 20 emplacements occupés par 20 objets différents.
    const fillers = Object.values(content.pack.items)
      .filter((i) => i.kind === 'trophee')
      .slice(0, 20);
    await t.db.transaction().execute(async (tx) => {
      for (const i of fillers) await addStack(tx, content, pid, 'BAG', i.id, 1, 'SYSTEM', 'test');
    });
    await run(pid, depart, { direction: 1 });
    const r = await run(pid, fight);
    expect(r.won).toBe(true);
    expect(r.rewards.left.length).toBeGreaterThan(0);
    later();
    const first = r.rewards.left[0]!;
    const what = 'item' in first ? { item: first.item } : undefined;
    if (what) {
      await expect(run(pid, takeLoot, what)).rejects.toMatchObject({ code: 'BAG_FULL' });
      await run(pid, discard, { item: fillers[0]!.id });
      expect((await run(pid, takeLoot, what)).taken).toBeGreaterThan(0);
    }
    await addPending(pid);
    await run(pid, advance);
    expect((await t.db.transaction().execute((tx) => contents(tx, pid, 'PENDING_LOOT'))).stacks).toEqual([]);
  });
});

describe('monstre rare (README 9.1)', () => {
  it('apparaît après 10 victoires et laisse son trophée', async () => {
    const pid = await newPlayer();
    await strongSquad(pid);
    await t.db.updateTable('player').set({ stat_wins: 10 }).where('id', '=', pid).execute();
    random = () => 0; // le tirage de présence (0 < 15 %) réussit
    await run(pid, depart, { direction: 1 });
    const [e] = await visible(pid);
    expect(e!.rare).toBe('rare_lisiere');
    random = (max) => rng.next() % max;
    const r = await run(pid, fight);
    expect(r.won).toBe(true);
    expect([...r.rewards.loot, ...r.rewards.left].some((x) => 'item' in x && x.item === 'fourrure_givre')).toBe(true);
  });
});

describe('services de ville (README 7.2, 7.5, 8.3)', () => {
  it('marchand : achat en banque au prix ×1,5, revente à 20 %, refus hors catalogue', async () => {
    const pid = await newPlayer();
    await run(pid, searchOrStart);
    const gold = () => t.db.transaction().execute((tx) => balance(tx, pid));
    expect(await run(pid, merchantBuy, { id: 'bandage' })).toEqual({ price: Math.ceil(6 * 1.5) });
    expect(await gold()).toBe(1000 - 9);
    await expect(run(pid, merchantBuy, { id: 'lame_5' })).rejects.toMatchObject({ code: 'NOT_SOLD_HERE' });
    await run(pid, merchantBuy, { id: 'lame_1' });
    const bank = await t.db.transaction().execute((tx) => contents(tx, pid, 'BANK'));
    expect(bank.stacks.find((x) => x.item === 'bandage')?.qty).toBe(4);
    const sword = bank.instances.find((i) => i.base === 'lame_1')!;
    expect(sword.roll).toBe(800); // jet fixe du marchand
    const g = await gold();
    expect(await run(pid, merchantSell, { from: 'BANK', instance: sword.id })).toEqual({
      gold: Math.max(1, Math.floor(Math.round((30 * 800) / 1000) * 0.2)),
    });
    expect(await run(pid, merchantSell, { from: 'BANK', item: 'bandage', qty: 2 })).toEqual({ gold: 2 });
    expect(await gold()).toBe(g + 4 + 2);
  });

  it('banque : transferts en ville seulement', async () => {
    const pid = await newPlayer();
    await run(pid, searchOrStart);
    expect(await run(pid, bankMove, { from: 'BANK', item: 'bandage', qty: 2 })).toEqual({ moved: 2 });
    await expect(run(pid, bankMove, { from: 'BANK', item: 'bandage', qty: 5 })).rejects.toMatchObject({ code: 'NOT_ENOUGH_ITEMS' });
    await run(pid, depart, { direction: 1 });
    await expect(run(pid, bankMove, { from: 'BAG', item: 'bandage', qty: 1 })).rejects.toMatchObject({ code: 'WRONG_POSITION' });
  });

  it('consommable : soigne une unité blessée, refuse une jauge pleine', async () => {
    const pid = await newPlayer();
    await run(pid, searchOrStart);
    await run(pid, bankMove, { from: 'BANK', item: 'bandage', qty: 2 });
    await run(pid, depart, { direction: 1 });
    const [m] = await t.db.transaction().execute((tx) => loadTroops(tx, pid, ['SQUAD']));
    const max = statsOf(content, m!, m!.units[0]!).hpMax;
    await expect(run(pid, useConsumable, { item: 'bandage', troop: m!.id, unit: 1 })).rejects.toMatchObject({ code: 'GAUGE_FULL' });
    await t.db.transaction().execute((tx) => setUnit(tx, m!.id, 1, { hp: 10, mana: 0 }));
    expect((await run(pid, useConsumable, { item: 'bandage', troop: m!.id, unit: 1 })).hp).toBe(Math.min(max, 10 + 50)); // bandage : +50 PV fixes (README 19.5)
    await expect(run(pid, useConsumable, { item: 'bois_tordu', troop: m!.id, unit: 1 })).rejects.toMatchObject({ code: 'NOT_CONSUMABLE' });
  });
});

describe('grand livre (guide 6.3)', () => {
  it('chaque mouvement est équilibré et la somme des soldes est nulle', async () => {
    const tx = await sql<{
      n: number;
    }>`select count(*)::int as n from (select tx from gold_entry group by tx having sum(amount) <> 0) x`.execute(t.db);
    expect(tx.rows[0]!.n).toBe(0);
    const s = await sql<{ s: number }>`select coalesce(sum(balance), 0)::int as s from gold_account`.execute(t.db);
    expect(s.rows[0]!.s).toBe(0);
    const neg = await sql<{ n: number }>`select count(*)::int as n from gold_account where player_id is not null and balance < 0`.execute(
      t.db,
    );
    expect(neg.rows[0]!.n).toBe(0);
  });
});

describe('troupes vendues par le marchand', () => {
  it('Havre-Gris vend un Milicien 300 or : or au grand livre, troupe en escouade ou en caserne', async () => {
    const pid = await newPlayer();
    await run(pid, searchOrStart);
    const gold0 = await t.db.transaction().execute((tx) => balance(tx, pid));
    const before = (await loadTroops(t.db as never, pid, ['SQUAD', 'BARRACKS'])).length;
    const r = await run(pid, merchantBuyTroop, { type: 'milicien' });
    expect(r).toMatchObject({ price: 300 });
    expect(await t.db.transaction().execute((tx) => balance(tx, pid))).toBe(gold0 - 300);
    const troops = await loadTroops(t.db as never, pid, ['SQUAD', 'BARRACKS']);
    expect(troops.length).toBe(before + 1);
    const bought = troops.find((x) => x.id === r.troop)!;
    expect(bought).toMatchObject({ type: 'milicien', level: 1, container: r.container });
    // Pas une troupe d'un autre type, ni sans assez d'or.
    await expect(run(pid, merchantBuyTroop, { type: 'chasseur' })).rejects.toMatchObject({ code: 'NOT_SOLD_HERE' });
    await t.db.transaction().execute((tx) => transferGold(tx, { player: pid }, { system: 'SINK_RESET' }, gold0 - 300, 'test'));
    await expect(run(pid, merchantBuyTroop, { type: 'milicien' })).rejects.toMatchObject({ code: 'NOT_ENOUGH_GOLD' });
  });
});
