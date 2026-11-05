/**
 * Boutiques (J5, guide 11, README 22) : annonces, achat, retrait, expiration, séquestre ; concurrence (deux
 * acheteurs, achats croisés) et conservation de l'or et des objets.
 */
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { z } from 'zod';
import { sql } from '@cr/db';
import { validateContent } from '@cr/content';
import type { GenContent } from '@cr/gen';
import { startTestDb, type TestDb } from '@cr/testing';
import {
  SHOP,
  addStack,
  balance,
  buyListing,
  contents,
  createTroop,
  ensureStarted,
  executeCommand,
  expireListings,
  listGoods,
  memoryMailer,
  noRateLimit,
  signup,
  taxOf,
  transferGold,
  withdrawListing,
  type CommandDef,
  type GameContent,
} from '../src/index.ts';

const compiled = validateContent(join(import.meta.dirname, '../../../content'));
const content: GameContent = { pack: compiled.pack as unknown as GenContent, hash: compiled.hash! };
let t: TestDb;
let n = 0;
function run<S extends z.ZodType, R>(pid: number, def: CommandDef<S, R>, input: unknown = {}, now?: Date): Promise<R> {
  return executeCommand(
    { db: t.db, rateLimiter: noRateLimit, publish: () => {}, content, random: () => 9, ...(now ? { clock: () => now } : {}) },
    def,
    { playerId: pid, input },
  );
}
async function newPlayer(): Promise<number> {
  n++;
  await signup(
    { db: t.db, mailer: memoryMailer(), appUrl: 'http://test' },
    { email: `s${n}@example.org`, pseudo: `Marchand ${n}`, password: 'motdepasse-long', acceptTos: true },
  );
  const pid = (await t.db.selectFrom('player').select('id').where('pseudo', '=', `Marchand ${n}`).executeTakeFirstOrThrow()).id;
  await run(pid, ensureStarted);
  return pid;
}
const gold = (pid: number) => t.db.transaction().execute((x) => balance(x, pid));
const bankQty = async (pid: number, item: string) =>
  (await t.db.transaction().execute((x) => contents(x, pid, 'BANK'))).stacks.find((s) => s.item === item)?.qty ?? 0;
const give = (pid: number, item: string, qty: number) =>
  t.db.transaction().execute((x) => addStack(x, content, pid, 'BANK', item, qty, 'SYSTEM', 'test'));
const fund = (pid: number, g: number) =>
  t.db.transaction().execute((x) => transferGold(x, { system: 'SOURCE_QUEST' }, { player: pid }, g, 'test'));
const listing = (id: number) => t.db.selectFrom('shop_listing').selectAll().where('id', '=', id).executeTakeFirstOrThrow();

beforeAll(async () => {
  expect(compiled.ok).toBe(true);
  t = await startTestDb();
});
afterAll(async () => t?.stop());

describe('annonce et achat d’une pile (README 22)', () => {
  it('met en séquestre, vend avec la taxe de 5 %, notifie le vendeur', async () => {
    const seller = await newPlayer();
    const buyer = await newPlayer();
    const sellerHad = await bankQty(seller, 'croc_loup');
    await give(seller, 'croc_loup', 10);
    const had = await bankQty(buyer, 'croc_loup');
    await expect(run(seller, listGoods, { kind: 'stack', item: 'croc_loup', qty: 4, price: 3 })).rejects.toMatchObject({
      code: 'PRICE_TOO_LOW',
    });
    const { listing: id } = await run(seller, listGoods, { kind: 'stack', item: 'croc_loup', qty: 4, price: 100 });
    expect(await bankQty(seller, 'croc_loup')).toBe(sellerHad + 6); // 4 en séquestre
    await expect(run(seller, buyListing, { listing: id })).rejects.toMatchObject({ code: 'OWN_LISTING' });

    const [gs, gb] = [await gold(seller), await gold(buyer)];
    expect(await run(buyer, buyListing, { listing: id })).toEqual({ bought: id, price: 100 });
    expect(await gold(buyer)).toBe(gb - 100);
    expect(await gold(seller)).toBe(gs + 100 - taxOf(100));
    expect(taxOf(100)).toBe(5);
    expect(await bankQty(buyer, 'croc_loup')).toBe(had + 4);
    expect((await listing(id)).status).toBe('sold');
    const sale = await t.db.selectFrom('shop_sale').selectAll().where('listing_id', '=', id).executeTakeFirstOrThrow();
    expect([sale.price, sale.tax, sale.qty, sale.region]).toEqual([100, 5, 4, 'ronces']);
    const note = await t.db.selectFrom('notification').selectAll().where('player_id', '=', seller).executeTakeFirstOrThrow();
    expect(note.type).toBe('shop.sold');
    await expect(run(buyer, buyListing, { listing: id })).rejects.toMatchObject({ code: 'LISTING_GONE' });
  });

  it('s’achète et se retire depuis n’importe quelle ville (boutique commune) ; 20 annonces au plus', async () => {
    const seller = await newPlayer();
    const buyer = await newPlayer();
    const had = await bankQty(seller, 'bois_tordu');
    await give(seller, 'bois_tordu', 30);
    const { listing: id } = await run(seller, listGoods, { kind: 'stack', item: 'bois_tordu', qty: 1, price: 5 });
    await t.db.updateTable('player').set({ pos_region: 'marais' }).where('id', 'in', [seller, buyer]).execute();
    // Mise en vente à Havre-Gris, achetée depuis Port-Salant.
    await run(buyer, buyListing, { listing: id });
    const { listing: id2 } = await run(seller, listGoods, { kind: 'stack', item: 'bois_tordu', qty: 1, price: 5 }); // depuis Port-Salant
    await t.db.updateTable('player').set({ pos_region: 'ronces' }).where('id', 'in', [seller, buyer]).execute();
    expect(await run(seller, withdrawListing, { listing: id2 })).toEqual({ withdrawn: id2 });
    expect(await bankQty(seller, 'bois_tordu')).toBe(had + 29);
    for (let k = 0; k < SHOP.maxActive; k++) await run(seller, listGoods, { kind: 'stack', item: 'bois_tordu', qty: 1, price: 5 });
    await expect(run(seller, listGoods, { kind: 'stack', item: 'bois_tordu', qty: 1, price: 5 })).rejects.toMatchObject({
      code: 'TOO_MANY_LISTINGS',
    });
  });
});

describe('exemplaires et troupes', () => {
  it('vend un exemplaire d’équipement', async () => {
    const seller = await newPlayer();
    const buyer = await newPlayer();
    const inst = await t.db
      .insertInto('item_instance')
      .values({
        player_id: seller,
        container: 'BANK',
        troop_id: null,
        unit_n: null,
        slot: null,
        base: 'lame_1',
        roll: 1200,
        stats: JSON.stringify([{ k: 'atk', v: 3 }]),
        origin: 'loot',
        content_version: content.hash,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    const { listing: id } = await run(seller, listGoods, { kind: 'instance', instance: inst.id, price: 50 });
    expect((await t.db.selectFrom('item_instance').select('container').where('id', '=', inst.id).executeTakeFirstOrThrow()).container).toBe(
      'ESCROW',
    );
    await run(buyer, buyListing, { listing: id });
    const after = await t.db
      .selectFrom('item_instance')
      .select(['container', 'player_id'])
      .where('id', '=', inst.id)
      .executeTakeFirstOrThrow();
    expect(after).toEqual({ container: 'BANK', player_id: buyer });
  });

  it('vend une troupe de caserne avec son équipement ; refuse un compte trop récent ou une troupe prêtée', async () => {
    const seller = await newPlayer();
    const buyer = await newPlayer();
    const troop = await t.db
      .transaction()
      .execute((x) => createTroop(x, content, seller, { type: 'chasseur', level: 5, container: 'BARRACKS', reason: 'test' }));
    const loaned = await t.db
      .transaction()
      .execute((x) => createTroop(x, content, seller, { type: 'milicien', level: 1, container: 'BARRACKS', reason: 'test', loaned: true }));
    await t.db
      .insertInto('item_instance')
      .values({
        player_id: seller,
        container: 'EQUIPPED',
        troop_id: troop,
        unit_n: 1,
        slot: 'arme',
        base: 'arc_1',
        roll: 1000,
        stats: '[]',
        origin: 'loot',
        content_version: content.hash,
      })
      .execute();
    await expect(run(seller, listGoods, { kind: 'troop', troop, price: 500 })).rejects.toMatchObject({ code: 'ACCOUNT_TOO_NEW' });
    const later = new Date(Date.now() + 2 * 86_400_000);
    await expect(run(seller, listGoods, { kind: 'troop', troop: loaned, price: 500 }, later)).rejects.toMatchObject({
      code: 'TROOP_LOANED',
    });
    await expect(run(seller, listGoods, { kind: 'troop', troop, price: 10 }, later)).rejects.toMatchObject({
      code: 'PRICE_TOO_LOW',
      details: { min: 40 },
    });
    const { listing: id } = await run(seller, listGoods, { kind: 'troop', troop, price: 500 }, later);
    await fund(buyer, 400);
    await run(buyer, buyListing, { listing: id });
    const tr = await t.db.selectFrom('troop').select(['player_id', 'container', 'level']).where('id', '=', troop).executeTakeFirstOrThrow();
    expect(tr).toEqual({ player_id: buyer, container: 'BARRACKS', level: 5 });
    expect(
      (await t.db.selectFrom('item_instance').select('player_id').where('troop_id', '=', troop).executeTakeFirstOrThrow()).player_id,
    ).toBe(buyer);
    const owners = await t.db
      .selectFrom('troop_ownership')
      .select(['player_id', 'to_at'])
      .where('troop_id', '=', troop)
      .orderBy('id')
      .execute();
    expect(owners.map((o) => [o.player_id, o.to_at === null])).toEqual([
      [seller, false],
      [buyer, true],
    ]);
  });
});

describe('expiration (guide 11.1)', () => {
  it('rend le bien au vendeur après 7 jours, même banque pleine, et une seule fois', async () => {
    const seller = await newPlayer();
    const had = await bankQty(seller, 'resine');
    await give(seller, 'resine', 3);
    const { listing: id } = await run(seller, listGoods, { kind: 'stack', item: 'resine', qty: 3, price: 10 });
    expect(await expireListings(t.db, new Date(Date.now() + 86_400_000))).toBe(0);
    expect(await expireListings(t.db, new Date(Date.now() + 8 * 86_400_000))).toBeGreaterThanOrEqual(1);
    expect((await listing(id)).status).toBe('expired');
    expect(await bankQty(seller, 'resine')).toBe(had + 3);
    expect((await t.db.selectFrom('notification').select('type').where('player_id', '=', seller).execute()).map((x) => x.type)).toContain(
      'shop.expired',
    );
    expect(await expireListings(t.db, new Date(Date.now() + 9 * 86_400_000))).toBe(0);
  });
});

describe('concurrence et conservation (guide 16.1)', () => {
  it('deux acheteurs simultanés : un seul achat réussit', async () => {
    const seller = await newPlayer();
    const [a, b] = [await newPlayer(), await newPlayer()];
    await give(seller, 'cuir_brut', 5);
    const had = (await bankQty(a, 'cuir_brut')) + (await bankQty(b, 'cuir_brut'));
    for (let round = 0; round < 5; round++) {
      const { listing: id } = await run(seller, listGoods, { kind: 'stack', item: 'cuir_brut', qty: 1, price: 4 });
      const res = await Promise.allSettled([run(a, buyListing, { listing: id }), run(b, buyListing, { listing: id })]);
      expect(res.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      const failed = res.find((r) => r.status === 'rejected') as PromiseRejectedResult;
      expect(failed.reason).toMatchObject({ code: 'LISTING_GONE' });
    }
    expect((await bankQty(a, 'cuir_brut')) + (await bankQty(b, 'cuir_brut'))).toBe(had + 5);
  });

  it('achats croisés simultanés : aucun interblocage', async () => {
    const [a, b] = [await newPlayer(), await newPlayer()];
    const had = (await bankQty(a, 'pierre_lisse')) + (await bankQty(b, 'pierre_lisse'));
    await give(a, 'pierre_lisse', 10);
    await give(b, 'pierre_lisse', 10);
    for (let round = 0; round < 8; round++) {
      const la = (await run(a, listGoods, { kind: 'stack', item: 'pierre_lisse', qty: 1, price: 4 })).listing;
      const lb = (await run(b, listGoods, { kind: 'stack', item: 'pierre_lisse', qty: 1, price: 4 })).listing;
      const res = await Promise.allSettled([run(a, buyListing, { listing: lb }), run(b, buyListing, { listing: la })]);
      expect(res.map((r) => (r.status === 'rejected' ? String((r.reason as Error).message ?? r.reason) : 'ok'))).toEqual(['ok', 'ok']);
    }
    expect((await bankQty(a, 'pierre_lisse')) + (await bankQty(b, 'pierre_lisse'))).toBe(had + 20);
  });

  it('grand livre équilibré, aucun solde joueur négatif, toute annonce active a son bien en séquestre', async () => {
    const unbalanced = await sql<{
      n: number;
    }>`select count(*)::int as n from (select tx from gold_entry group by tx having sum(amount) <> 0) x`.execute(t.db);
    expect(unbalanced.rows[0]!.n).toBe(0);
    expect((await sql<{ s: number }>`select coalesce(sum(balance), 0)::int as s from gold_account`.execute(t.db)).rows[0]!.s).toBe(0);
    expect(
      (await sql<{ n: number }>`select count(*)::int as n from gold_account where player_id is not null and balance < 0`.execute(t.db))
        .rows[0]!.n,
    ).toBe(0);
    const orphan = await sql<{ n: number }>`
      select count(*)::int as n from shop_listing l
      left join item_instance i on i.id = l.instance_id
      left join troop tr on tr.id = l.troop_id
      where l.status = 'active' and ((l.kind = 'instance' and i.container <> 'ESCROW') or (l.kind = 'troop' and tr.container <> 'ESCROW'))`.execute(
      t.db,
    );
    expect(orphan.rows[0]!.n).toBe(0);
    const escrowWithoutListing = await sql<{ n: number }>`
      select count(*)::int as n from item_instance i where i.container = 'ESCROW'
      and not exists (select 1 from shop_listing l where l.instance_id = i.id and l.status = 'active')`.execute(t.db);
    expect(escrowWithoutListing.rows[0]!.n).toBe(0);
  });
});
