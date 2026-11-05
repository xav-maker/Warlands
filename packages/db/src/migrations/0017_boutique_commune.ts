import { sql, type Kysely } from 'kysely';

/** Boutique commune à tout le jeu [Xavier, 5 novembre 2026] : la recherche ne passe plus par la ville. */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    create index shop_listing_active_price_idx on shop_listing (price, id) where status = 'active';
    create index shop_listing_active_family_idx on shop_listing (family, price, id) where status = 'active';
    create index shop_sale_item_idx on shop_sale (item, created_at desc);
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    drop index shop_sale_item_idx;
    drop index shop_listing_active_family_idx;
    drop index shop_listing_active_price_idx;
  `.execute(db);
}
