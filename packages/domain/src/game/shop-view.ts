/** Lecture des boutiques (guide 11.2) : recherche paginée, mes annonces, historique des prix, notifications. */
import { sql } from '@cr/db';
import type { Db } from '@cr/db';

export interface ShopFilters {
  q?: string | undefined;
  family?: string | undefined;
  tier?: number | undefined;
  slot?: string | undefined;
  /** Curseur « prix:id » de la dernière ligne de la page précédente. */
  after?: string | undefined;
}

export const SHOP_PAGE = 30;

/**
 * Annonces actives de la boutique, commune à tout le jeu [Xavier, 5 novembre 2026], triées par prix puis id
 * (pagination par curseur sur l'index de recherche). Chaque annonce garde la ville où elle a été mise en vente.
 */
export async function searchListings(db: Db, f: ShopFilters) {
  let q = db
    .selectFrom('shop_listing as l')
    .innerJoin('player as p', 'p.id', 'l.seller_id')
    .leftJoin('item_instance as i', 'i.id', 'l.instance_id')
    .select([
      'l.id',
      'l.kind',
      'l.item',
      'l.qty',
      'l.price',
      'l.name',
      'l.family',
      'l.tier',
      'l.slot',
      'l.level',
      'l.seller_id',
      'l.expires_at',
      'l.region',
      'p.pseudo as seller',
      'i.roll',
      'i.stats',
    ])
    .where('l.status', '=', 'active');
  if (f.q?.trim()) q = q.where('l.name', 'ilike', `%${f.q.trim().replace(/[\\%_]/g, (m) => `\\${m}`)}%`);
  if (f.family) q = q.where('l.family', '=', f.family);
  if (f.tier) q = q.where('l.tier', '=', f.tier);
  if (f.slot) q = q.where('l.slot', '=', f.slot);
  const m = /^(\d+):(\d+)$/.exec(f.after ?? '');
  if (m) q = q.where(sql<boolean>`(l.price, l.id) > (${Number(m[1])}, ${Number(m[2])})`);
  const rows = await q
    .orderBy('l.price')
    .orderBy('l.id')
    .limit(SHOP_PAGE + 1)
    .execute();
  const page = rows.slice(0, SHOP_PAGE);
  const last = page.at(-1);
  return { rows: page, next: rows.length > SHOP_PAGE && last ? `${last.price}:${last.id}` : null };
}

/** Les annonces actives d'un joueur, dans toutes les villes. */
export async function myListings(db: Db, playerId: number) {
  return db
    .selectFrom('shop_listing')
    .select(['id', 'region', 'kind', 'item', 'qty', 'price', 'name', 'expires_at'])
    .where('seller_id', '=', playerId)
    .where('status', '=', 'active')
    .orderBy('expires_at')
    .execute();
}

/** Les 20 dernières ventes d'un objet dans la boutique, et le prix moyen à l'unité. */
export async function priceHistory(db: Db, item: string) {
  const rows = await db
    .selectFrom('shop_sale')
    .select(['price', 'qty', 'created_at'])
    .where('item', '=', item)
    .orderBy('created_at', 'desc')
    .limit(20)
    .execute();
  const units = rows.reduce((a, r) => a + r.qty, 0);
  const total = rows.reduce((a, r) => a + r.price, 0);
  return { rows, average: units ? Math.round(total / units) : null };
}

export async function notifications(db: Db, playerId: number, limit = 50) {
  return db
    .selectFrom('notification')
    .select(['id', 'type', 'data', 'read_at', 'created_at'])
    .where('player_id', '=', playerId)
    .orderBy('id', 'desc')
    .limit(limit)
    .execute();
}

export async function unreadCount(db: Db, playerId: number): Promise<number> {
  const r = await db
    .selectFrom('notification')
    .select((eb) => eb.fn.countAll<number>().as('n'))
    .where('player_id', '=', playerId)
    .where('read_at', 'is', null)
    .executeTakeFirstOrThrow();
  return Number(r.n);
}
