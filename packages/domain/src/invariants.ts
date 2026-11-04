/**
 * Contrôles d'invariants (guide 19.3), lancés par le worker toutes les 10 minutes, et la nuit avec un échantillon de
 * combats rejoués. Une violation est une alerte critique (guide 19.2) : enquête immédiate, gel des boutiques si l'or ou
 * des biens sont concernés. Lecture seule : rien n'est corrigé ici (correction : toujours par une commande
 * d'administration tracée, guide 19.5).
 */
import { gunzipSync } from 'node:zlib';
import { sql, type Db } from '@cr/db';
import { simuler } from '@cr/engine';
import type { UnitInput } from '@cr/engine';
import { online } from './game/content.ts';
import type { GameContent } from './game/content.ts';
import { loadTroops, statsOf } from './game/troops.ts';

export interface Violation {
  check: string;
  detail: Record<string, unknown>;
}

const LIMIT = 50;

/** Grand livre (guide 6.3) : chaque écriture s'équilibre, chaque solde est la somme de ses lignes, le tout est nul. */
async function ledger(db: Db): Promise<Violation[]> {
  const out: Violation[] = [];
  const tx = await sql<{ tx: string; s: number }>`
    select tx::text as tx, sum(amount)::bigint as s from gold_entry group by tx having sum(amount) <> 0 limit ${LIMIT}`.execute(db);
  for (const r of tx.rows) out.push({ check: 'ledger.unbalanced_tx', detail: { tx: r.tx, sum: Number(r.s) } });
  const acc = await sql<{ id: number; balance: number; s: number }>`
    select a.id, a.balance, coalesce(sum(e.amount), 0)::bigint as s
    from gold_account a left join gold_entry e on e.account_id = a.id
    group by a.id having a.balance <> coalesce(sum(e.amount), 0) limit ${LIMIT}`.execute(db);
  for (const r of acc.rows)
    out.push({ check: 'ledger.balance_mismatch', detail: { account: r.id, balance: Number(r.balance), entries: Number(r.s) } });
  const total = await sql<{ s: number }>`select coalesce(sum(balance), 0)::bigint as s from gold_account`.execute(db);
  if (Number(total.rows[0]!.s) !== 0) out.push({ check: 'ledger.total_not_zero', detail: { sum: Number(total.rows[0]!.s) } });
  const neg = await sql<{ id: number; player_id: number }>`
    select id, player_id from gold_account where player_id is not null and balance < 0 limit ${LIMIT}`.execute(db);
  for (const r of neg.rows) out.push({ check: 'ledger.negative_player', detail: { account: r.id, player: r.player_id } });
  return out;
}

/** Biens (guide 6.2) : un seul endroit, pas de pile vide, propriétaire cohérent avec le conteneur. */
async function goods(db: Db): Promise<Violation[]> {
  const out: Violation[] = [];
  const stacks = await sql<{ id: number }>`select id from item_stack where qty <= 0 limit ${LIMIT}`.execute(db);
  for (const r of stacks.rows) out.push({ check: 'goods.empty_stack', detail: { stack: Number(r.id) } });
  const owner = await sql<{ id: number; container: string }>`
    select id, container from item_instance
    where (player_id is null) <> (container in ('SYSTEM', 'GRAVE')) limit ${LIMIT}`.execute(db);
  for (const r of owner.rows) out.push({ check: 'goods.instance_owner', detail: { instance: Number(r.id), container: r.container } });
  // Un exemplaire porté l'est par une troupe vivante (ou en vente) du même joueur.
  const worn = await sql<{ id: number }>`
    select i.id from item_instance i join troop t on t.id = i.troop_id
    where i.container = 'EQUIPPED' and (t.player_id <> i.player_id or t.container = 'GRAVE') limit ${LIMIT}`.execute(db);
  for (const r of worn.rows) out.push({ check: 'goods.equipped_on_wrong_troop', detail: { instance: Number(r.id) } });
  // Séquestre (guide 11) : toute annonce active tient son bien en ESCROW, et rien n'est en ESCROW sans annonce active.
  const listing = await sql<{ id: number; kind: string }>`
    select l.id, l.kind from shop_listing l
    where l.status = 'active' and not (
      (l.kind = 'instance' and exists (select 1 from item_instance i where i.id = l.instance_id and i.container = 'ESCROW'))
      or (l.kind = 'troop' and exists (select 1 from troop t where t.id = l.troop_id and t.container = 'ESCROW'))
      or (l.kind = 'stack'))
    limit ${LIMIT}`.execute(db);
  for (const r of listing.rows) out.push({ check: 'shop.listing_without_escrow', detail: { listing: Number(r.id), kind: r.kind } });
  const orphan = await sql<{ kind: string; id: number }>`
    select 'instance' as kind, i.id from item_instance i
    where i.container = 'ESCROW' and not exists (select 1 from shop_listing l where l.instance_id = i.id and l.status = 'active')
    union all
    select 'troop' as kind, t.id from troop t
    where t.container = 'ESCROW' and not exists (select 1 from shop_listing l where l.troop_id = t.id and l.status = 'active')
    limit ${LIMIT}`.execute(db);
  for (const r of orphan.rows) out.push({ check: 'shop.orphan_escrow', detail: { kind: r.kind, id: Number(r.id) } });
  // Donjons : aucun coffre non vide hors d'une participation active.
  const chest = await sql<{ player_id: number }>`
    select distinct player_id from (
      select player_id from item_stack where container = 'DUNGEON_CHEST'
      union all select player_id from item_instance where container = 'DUNGEON_CHEST') x
    where not exists (select 1 from dungeon_member m where m.player_id = x.player_id and m.status = 'active')
    limit ${LIMIT}`.execute(db);
  for (const r of chest.rows) out.push({ check: 'dungeon.chest_without_run', detail: { player: Number(r.player_id) } });
  const gold = await sql<{ player_id: number }>`
    select player_id from dungeon_member where status <> 'active' and chest_gold > 0 limit ${LIMIT}`.execute(db);
  for (const r of gold.rows) out.push({ check: 'dungeon.gold_left_in_closed_chest', detail: { player: Number(r.player_id) } });
  return out;
}

/** Positions : au plus une rencontre visible, une porte visible, une participation active ; position de donjon cohérente. */
async function positions(db: Db): Promise<Violation[]> {
  const out: Violation[] = [];
  const many = await sql<{ check: string; player_id: number }>`
    select 'position.encounters' as check, player_id from encounter where status = 'visible' group by player_id having count(*) > 1
    union all
    select 'position.dungeons' as check, player_id from dungeon_member where status = 'active' group by player_id having count(*) > 1
    limit ${LIMIT}`.execute(db);
  for (const r of many.rows) out.push({ check: r.check, detail: { player: Number(r.player_id) } });
  const pos = await sql<{ id: number; pos_kind: string }>`
    select p.id, p.pos_kind from player p
    left join dungeon_member m on m.player_id = p.id and m.status = 'active'
    where (p.pos_kind = 'dungeon') <> (m.run_id is not null) or (p.pos_kind = 'dungeon' and p.pos_dungeon_run is distinct from m.run_id)
    limit ${LIMIT}`.execute(db);
  for (const r of pos.rows) out.push({ check: 'position.dungeon_mismatch', detail: { player: Number(r.id), kind: r.pos_kind } });
  return out;
}

/** Escouades (README 20) : au plus 8 unités et 11 de population ; en ville, toutes les troupes à pleins PV et mana. */
async function squads(db: Db, c: GameContent): Promise<Violation[]> {
  const out: Violation[] = [];
  const o = online(c);
  const players = await db.selectFrom('player').select(['id', 'pos_kind']).where('started_at', 'is not', null).execute();
  for (const p of players) {
    const troops = await db.transaction().execute((tx) => loadTroops(tx, p.id, ['SQUAD', 'BARRACKS']));
    const squad = troops.filter((t) => t.container === 'SQUAD');
    const units = squad.reduce((a, t) => a + t.units.length, 0);
    const pop = squad.filter((t) => t.units.length).reduce((a, t) => a + (c.pack.troops[t.type]?.pop ?? 0), 0);
    if (units > o.squad.maxUnits || pop > o.squad.maxPop) out.push({ check: 'squad.too_big', detail: { player: p.id, units, pop } });
    if (p.pos_kind === 'city')
      for (const t of troops)
        for (const u of t.units) {
          const s = statsOf(c, t, u);
          if (u.hp !== s.hpMax || u.mana !== s.manaMax)
            out.push({ check: 'squad.not_healed_in_city', detail: { player: p.id, troop: t.id, unit: u.n, hp: u.hp, hpMax: s.hpMax } });
        }
    if (out.length >= LIMIT) break;
  }
  return out;
}

/** Contrôles rapides (toutes les 10 minutes). */
export async function checkInvariants(db: Db, c: GameContent): Promise<Violation[]> {
  return [...(await ledger(db)), ...(await goods(db)), ...(await positions(db)), ...(await squads(db, c))];
}

/**
 * Échantillon de combats de la veille rejoués (guide 19.3, la nuit) : même moteur, même entrée, même graine, donc même
 * journal et même résultat. Seuls les combats de la version de moteur active sont rejoués.
 */
export async function replayBattles(db: Db, c: GameContent, opts: { since: Date; until: Date; sample?: number }): Promise<Violation[]> {
  const o = online(c);
  const rows = await db
    .selectFrom('battle')
    .select(['id', 'seed', 'input', 'result', 'log', 'engine_version'])
    .where('created_at', '>=', opts.since)
    .where('created_at', '<', opts.until)
    .where('engine_version', '=', o.engineVersion)
    .orderBy(sql`random()`)
    .limit(opts.sample ?? 100)
    .execute();
  const out: Violation[] = [];
  for (const b of rows) {
    const units = (b.input as { units: UnitInput[] }).units;
    const again = simuler({ engineVersion: b.engine_version, params: c.pack.params, skills: c.pack.skills, units }, Number(b.seed));
    const same =
      JSON.stringify(canon(again.log)) === JSON.stringify(canon(JSON.parse(gunzipSync(b.log).toString('utf8')))) &&
      JSON.stringify(canon(again.result)) === JSON.stringify(canon(b.result));
    if (!same) out.push({ check: 'battle.replay_differs', detail: { battle: b.id } });
  }
  return out;
}

/** Forme canonique (clés triées) : jsonb réordonne les clés de l'entrée enregistrée. */
function canon(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(canon);
  if (v && typeof v === 'object')
    return Object.fromEntries(
      Object.keys(v as Record<string, unknown>)
        .sort()
        .map((k) => [k, canon((v as Record<string, unknown>)[k])]),
    );
  return v;
}
