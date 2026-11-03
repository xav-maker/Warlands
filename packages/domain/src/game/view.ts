/** Lecture de l'état d'un joueur pour les pages (aucune écriture). */
import type { Db } from '@cr/db';
import type { MonsterGroup } from '@cr/gen';
import { departures, destination, region } from './content.ts';
import type { Departure, GameContent } from './content.ts';
import { balance } from './gold.ts';
import { capacity, contents, slotsUsed } from './inventory.ts';
import type { Contents } from './inventory.ts';
import { loadTroops, statsOf } from './troops.ts';
import type { LoadedTroop } from './troops.ts';

export interface UnitView {
  n: number;
  hp: number;
  hpMax: number;
  mana: number;
  manaMax: number;
}
export interface TroopView extends Omit<LoadedTroop, 'units'> {
  name: string;
  units: UnitView[];
}

export interface GameView {
  pseudo: string;
  started: boolean;
  gold: number;
  kind: 'city' | 'route' | 'dungeon';
  region: string;
  regionIndex: number;
  watchUntil: Date | null;
  troops: TroopView[];
  bag: Contents & { used: number; cap: number };
  bank: Contents & { used: number; cap: number };
  pending: Contents;
  departures: Departure[];
  route: null | { id: string; direction: number; step: number; cleared: boolean[]; to: string | null };
  encounter: null | { side: MonsterGroup; rare: string | null; guardian: boolean };
  lastBattle: null | { id: number; won: boolean; createdAt: Date };
  stats: { fights: number; wins: number; deaths: number };
}

export async function gameView(db: Db, c: GameContent, playerId: number): Promise<GameView> {
  return db.transaction().execute(async (tx) => {
    const p = await tx.selectFrom('player').selectAll().where('id', '=', playerId).executeTakeFirstOrThrow();
    const troops = (await loadTroops(tx, playerId)).map((t) => ({
      ...t,
      name: c.pack.troops[t.type]!.forms.find((f) => f.id === t.form)?.name ?? c.pack.troops[t.type]!.name,
      units: t.units.map((u) => {
        const s = statsOf(c, t, u);
        return { n: u.n, hp: u.hp, hpMax: s.hpMax, mana: u.mana, manaMax: s.manaMax };
      }),
    }));
    const bag = await contents(tx, playerId, 'BAG');
    const bank = await contents(tx, playerId, 'BANK');
    const exp = await tx.selectFrom('expedition').selectAll().where('player_id', '=', playerId).executeTakeFirst();
    const enc = await tx
      .selectFrom('encounter')
      .selectAll()
      .where('player_id', '=', playerId)
      .where('status', '=', 'visible')
      .executeTakeFirst();
    const last = await tx
      .selectFrom('battle')
      .select(['id', 'won', 'created_at'])
      .where('player_id', '=', playerId)
      .orderBy('id', 'desc')
      .limit(1)
      .executeTakeFirst();
    return {
      pseudo: p.pseudo,
      started: !!p.started_at,
      gold: await balance(tx, playerId),
      kind: p.pos_kind,
      region: p.pos_region,
      regionIndex: c.pack.regions.findIndex((r) => r.id === p.pos_region),
      watchUntil: p.watch_until,
      troops,
      bag: { ...bag, used: slotsUsed(c, bag), cap: capacity(c, 'BAG') },
      bank: { ...bank, used: slotsUsed(c, bank), cap: capacity(c, 'BANK') },
      pending: await contents(tx, playerId, 'PENDING_LOOT'),
      departures: p.pos_kind === 'city' ? departures(c, p.pos_region) : [],
      route:
        p.pos_kind === 'route' && exp
          ? {
              id: exp.route,
              direction: exp.direction,
              step: p.pos_step ?? 0,
              cleared: exp.cleared,
              to: destination(c, exp.route, exp.direction),
            }
          : null,
      encounter: enc ? { side: enc.side as MonsterGroup, rare: enc.rare, guardian: enc.guardian } : null,
      lastBattle: last ? { id: last.id, won: last.won, createdAt: last.created_at } : null,
      stats: { fights: p.stat_fights, wins: p.stat_wins, deaths: p.stat_deaths },
    };
  });
}

/** Bilan d'un combat du joueur, et son journal (pour la rediffusion). */
export async function battleView(db: Db, playerId: number, battleId: number) {
  const b = await db
    .selectFrom('battle')
    .innerJoin('battle_participant', 'battle_participant.battle_id', 'battle.id')
    .select([
      'battle.id',
      'battle.route',
      'battle.step',
      'battle.kind',
      'battle.won',
      'battle.duration',
      'battle.input',
      'battle.result',
      'battle.log',
      'battle.created_at',
      'battle_participant.rewards',
    ])
    .where('battle.id', '=', battleId)
    .where('battle_participant.player_id', '=', playerId)
    .executeTakeFirst();
  return b ?? null;
}

export { region };

/** Recettes et possessions du joueur (lecture seule ; les recettes sont matérialisées par game.start). */
export async function recipeView(db: Db, playerId: number) {
  const rows = await db
    .selectFrom('player_recipe')
    .select(['out', 'kind', 'ingredients', 'gold'])
    .where('player_id', '=', playerId)
    .execute();
  const stacks = await db
    .selectFrom('item_stack')
    .select(['item', 'qty'])
    .where('player_id', '=', playerId)
    .where('container', 'in', ['BANK', 'BAG'])
    .execute();
  const owned = new Map<string, number>();
  for (const s of stacks) owned.set(s.item, (owned.get(s.item) ?? 0) + s.qty);
  const reserved = new Set(
    (await db.selectFrom('player_reserved_material').select('item').where('player_id', '=', playerId).execute()).map((r) => r.item),
  );
  return { recipes: new Map(rows.map((r) => [r.out, r])), owned, reserved };
}
