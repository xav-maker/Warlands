/**
 * Liens cités dans le chat et les messages privés (README 25, guide 12) : un objet, une troupe ou une annonce de
 * boutique, choisis dans une liste (jamais saisis à la main). Le message stocke des références
 * `{ kind, id, label }` ; le serveur en rend une fiche consultable, relue en base à chaque ouverture.
 *
 * - On ne peut citer que ce qu'on possède : un exemplaire d'équipement (sac, banque ou porté), une troupe
 *   (escouade ou caserne), une annonce active dont on est le vendeur.
 * - Une fiche n'est consultable que si un message visible du lecteur la cite : message de chat non supprimé d'un
 *   joueur qu'il n'a pas bloqué, ou message privé dont il est l'expéditeur ou le destinataire. Ce n'est donc pas un
 *   moyen de parcourir les biens des autres joueurs.
 */
import { z } from 'zod';
import { GameError } from '@cr/shared';
import { sql } from '@cr/db';
import type { Database, Db, MessageLink, MessageLinkKind, Transaction } from '@cr/db';
import { learned } from '@cr/gen';
import type { GameContent } from '../game/content.ts';
import { loadTroops, statsOf } from '../game/troops.ts';

type Tx = Transaction<Database>;

/** Nombre maximal de liens par message. */
export const MAX_LINKS = 3;

export const LINK_KINDS = ['item', 'troop', 'listing'] as const;
export const LinkRef = z.object({ kind: z.enum(LINK_KINDS), id: z.number().int().positive() });
export type LinkRef = z.infer<typeof LinkRef>;
export const LinkRefs = z.array(LinkRef).max(MAX_LINKS).optional();

export const LINK_KIND_FR: Record<MessageLinkKind, string> = { item: 'Objet', troop: 'Troupe', listing: 'Annonce' };

/** « item:12 » → référence ; `null` si le texte n'a pas cette forme (champ vide, ou valeur trafiquée). */
export function parseLink(text: unknown): LinkRef | null {
  const m = /^(item|troop|listing):(\d{1,12})$/.exec(typeof text === 'string' ? text : '');
  return m ? { kind: m[1] as MessageLinkKind, id: Number(m[2]) } : null;
}

const troopLabel = (c: GameContent, type: string, form: string, level: number): string => {
  const def = c.pack.troops[type]!;
  return `${def.forms.find((f) => f.id === form)?.name ?? def.name} niv. ${level}`;
};

/**
 * Références validées d'un message : chacune doit désigner un bien du joueur. Sans doublon ; `LINK_INVALID` si un
 * bien n'existe pas ou n'est pas à lui, `INVALID_INPUT` s'il y en a trop.
 */
export async function resolveLinks(tx: Tx, c: GameContent, playerId: number, refs: readonly LinkRef[] | undefined): Promise<MessageLink[]> {
  const uniq = [...new Map((refs ?? []).map((r) => [`${r.kind}:${r.id}`, r])).values()];
  if (uniq.length > MAX_LINKS) throw new GameError('INVALID_INPUT');
  const out: MessageLink[] = [];
  for (const r of uniq) {
    let label: string | null = null;
    if (r.kind === 'item') {
      const i = await tx
        .selectFrom('item_instance')
        .select('base')
        .where('id', '=', r.id)
        .where('player_id', '=', playerId)
        .where('container', 'in', ['BAG', 'BANK', 'EQUIPPED'])
        .executeTakeFirst();
      if (i) label = c.pack.equip[i.base]?.name ?? i.base;
    } else if (r.kind === 'troop') {
      const t = await tx
        .selectFrom('troop')
        .select(['type', 'form', 'level'])
        .where('id', '=', r.id)
        .where('player_id', '=', playerId)
        .where('container', 'in', ['SQUAD', 'BARRACKS'])
        .executeTakeFirst();
      if (t) label = troopLabel(c, t.type, t.form, t.level);
    } else {
      const l = await tx
        .selectFrom('shop_listing')
        .select(['name', 'qty', 'price'])
        .where('id', '=', r.id)
        .where('seller_id', '=', playerId)
        .where('status', '=', 'active')
        .executeTakeFirst();
      if (l) label = `${l.name}${l.qty > 1 ? ` × ${l.qty}` : ''} · ${l.price} or`;
    }
    if (label === null) throw new GameError('LINK_INVALID');
    out.push({ kind: r.kind, id: r.id, label });
  }
  return out;
}

export interface Citable {
  value: string;
  label: string;
}

/** Ce que le joueur peut citer, pour le sélecteur du chat : objets, troupes et annonces actives. */
export async function citables(db: Db, c: GameContent, playerId: number): Promise<Record<'items' | 'troops' | 'listings', Citable[]>> {
  const items = await db
    .selectFrom('item_instance')
    .select(['id', 'base'])
    .where('player_id', '=', playerId)
    .where('container', 'in', ['BAG', 'BANK', 'EQUIPPED'])
    .orderBy('id')
    .limit(200)
    .execute();
  const troops = await db
    .selectFrom('troop')
    .select(['id', 'type', 'form', 'level'])
    .where('player_id', '=', playerId)
    .where('container', 'in', ['SQUAD', 'BARRACKS'])
    .orderBy('id')
    .execute();
  const listings = await db
    .selectFrom('shop_listing')
    .select(['id', 'name', 'qty', 'price'])
    .where('seller_id', '=', playerId)
    .where('status', '=', 'active')
    .orderBy('id')
    .execute();
  return {
    items: items.map((i) => ({ value: `item:${i.id}`, label: c.pack.equip[i.base]?.name ?? i.base })),
    troops: troops.map((t) => ({ value: `troop:${t.id}`, label: troopLabel(c, t.type, t.form, t.level) })),
    listings: listings.map((l) => ({ value: `listing:${l.id}`, label: `${l.name}${l.qty > 1 ? ` × ${l.qty}` : ''} · ${l.price} or` })),
  };
}

/** Le lecteur a-t-il le droit de voir cette fiche ? Voir l'en-tête du fichier. */
export async function canOpenLink(db: Db, viewerId: number, kind: MessageLinkKind, id: number): Promise<boolean> {
  const ref = JSON.stringify([{ kind, id }]);
  const r = await sql<{ ok: number }>`
    select 1 as ok where
      exists (
        select 1 from chat_message m
        where m.links @> ${ref}::jsonb and m.deleted_at is null
          and not exists (select 1 from block b where b.blocker_id = ${viewerId} and b.blocked_id = m.author_id)
      )
      or exists (
        select 1 from direct_message d
        where d.links @> ${ref}::jsonb and (d.sender_id = ${viewerId} or d.recipient_id = ${viewerId})
      )`.execute(db);
  return r.rows.length > 0;
}

export interface FicheStat {
  k: string;
  v: number;
  type?: string;
}

export type Fiche =
  | { kind: 'item'; base: string; name: string; slot: string; tier: number; roll: number; stats: FicheStat[]; owner: string | null }
  | {
      kind: 'troop';
      name: string;
      level: number;
      pop: number;
      owner: string;
      skills: string[];
      units: { n: number; hpMax: number; manaMax: number; equip: { slot: string; base: string; name: string; roll: number }[] }[];
    }
  | {
      kind: 'listing';
      name: string;
      qty: number;
      price: number;
      region: string;
      status: string;
      seller: string;
      expiresAt: Date;
      goods: Fiche | null;
    };

async function itemFiche(db: Db, c: GameContent, id: number): Promise<Extract<Fiche, { kind: 'item' }> | null> {
  const i = await db
    .selectFrom('item_instance')
    .leftJoin('player', 'player.id', 'item_instance.player_id')
    .select(['item_instance.base', 'item_instance.roll', 'item_instance.stats', 'player.pseudo'])
    .where('item_instance.id', '=', id)
    .executeTakeFirst();
  const b = i && c.pack.equip[i.base];
  if (!i || !b) return null;
  return { kind: 'item', base: i.base, name: b.name, slot: b.slot, tier: b.tier, roll: i.roll, stats: i.stats, owner: i.pseudo };
}

async function troopFiche(db: Db, c: GameContent, id: number): Promise<Extract<Fiche, { kind: 'troop' }> | null> {
  const row = await db
    .selectFrom('troop')
    .innerJoin('player', 'player.id', 'troop.player_id')
    .select(['troop.player_id', 'player.pseudo'])
    .where('troop.id', '=', id)
    .executeTakeFirst();
  if (!row) return null;
  return db.transaction().execute(async (tx) => {
    const t = (await loadTroops(tx, row.player_id, ['SQUAD', 'BARRACKS', 'ESCROW'])).find((x) => x.id === id);
    if (!t) return null;
    const def = c.pack.troops[t.type]!;
    return {
      kind: 'troop' as const,
      name: def.forms.find((f) => f.id === t.form)?.name ?? def.name,
      level: t.level,
      pop: def.pop,
      owner: row.pseudo,
      skills: learned(def, t.form, t.level).map((s) => c.pack.skills[s]?.name ?? s),
      units: t.units.map((u) => {
        const s = statsOf(c, t, u);
        return {
          n: u.n,
          hpMax: s.hpMax,
          manaMax: s.manaMax,
          equip: Object.entries(u.equip).map(([slot, e]) => ({
            slot,
            base: e.base,
            name: c.pack.equip[e.base]?.name ?? e.base,
            roll: e.roll,
          })),
        };
      }),
    };
  });
}

/** Fiche d'un lien, ou `null` si le bien n'existe plus. Le droit de la voir se vérifie avant, avec `canOpenLink`. */
export async function ficheOf(db: Db, c: GameContent, kind: MessageLinkKind, id: number): Promise<Fiche | null> {
  if (kind === 'item') return itemFiche(db, c, id);
  if (kind === 'troop') return troopFiche(db, c, id);
  const l = await db
    .selectFrom('shop_listing')
    .innerJoin('player', 'player.id', 'shop_listing.seller_id')
    .select([
      'shop_listing.name',
      'shop_listing.qty',
      'shop_listing.price',
      'shop_listing.region',
      'shop_listing.status',
      'shop_listing.kind',
      'shop_listing.instance_id',
      'shop_listing.troop_id',
      'shop_listing.expires_at',
      'player.pseudo',
    ])
    .where('shop_listing.id', '=', id)
    .executeTakeFirst();
  if (!l) return null;
  const goods =
    l.kind === 'instance' && l.instance_id
      ? await itemFiche(db, c, l.instance_id)
      : l.kind === 'troop' && l.troop_id
        ? await troopFiche(db, c, l.troop_id)
        : null;
  return {
    kind: 'listing',
    name: l.name,
    qty: l.qty,
    price: l.price,
    region: l.region,
    status: l.status,
    seller: l.pseudo,
    expiresAt: l.expires_at,
    goods,
  };
}
