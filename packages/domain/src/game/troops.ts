/**
 * Troupes du joueur (guide 6.2, README 4) : création, lecture avec unités et équipement, soin complet,
 * kit de départ (README 8.1) et prêt de la garde (README 3.4).
 */
import { genRecipes, unitStats } from '@cr/gen';
import type { EquipInstance, PlayerTroop, PlayerUnit, UnitStats } from '@cr/gen';
import type { Database, Player, Transaction, TroopContainer } from '@cr/db';
import { baseForm } from './rules.ts';
import { addStack } from './inventory.ts';
import { transferGold } from './gold.ts';
import type { GameContent } from './content.ts';

type Tx = Transaction<Database>;

export interface LoadedUnit {
  n: number;
  hp: number;
  mana: number;
  dead: boolean;
  equip: Record<string, EquipInstance>;
}

export interface LoadedTroop {
  id: number;
  type: string;
  form: string;
  level: number;
  xp: number;
  container: TroopContainer;
  rank: number;
  sort: number;
  loaned: boolean;
  disabledSkills: string[];
  units: LoadedUnit[];
}

/** Troupes du joueur (hors tombe), avec leurs unités vivantes et l'équipement porté. */
export async function loadTroops(tx: Tx, playerId: number, containers: TroopContainer[] = ['SQUAD', 'BARRACKS']): Promise<LoadedTroop[]> {
  const troops = await tx
    .selectFrom('troop')
    .selectAll()
    .where('player_id', '=', playerId)
    .where('container', 'in', containers)
    .orderBy('container', 'desc')
    .orderBy('sort')
    .orderBy('id')
    .execute();
  if (!troops.length) return [];
  const ids = troops.map((t) => t.id);
  const units = await tx.selectFrom('troop_unit').selectAll().where('troop_id', 'in', ids).where('dead', '=', false).orderBy('n').execute();
  const equipped = await tx
    .selectFrom('item_instance')
    .select(['id', 'troop_id', 'unit_n', 'slot', 'base', 'roll', 'stats'])
    .where('container', '=', 'EQUIPPED')
    .where('troop_id', 'in', ids)
    .execute();
  return troops.map((t) => ({
    id: t.id,
    type: t.type,
    form: t.form,
    level: t.level,
    xp: t.xp,
    container: t.container,
    rank: t.rank,
    sort: t.sort,
    loaned: t.loaned,
    disabledSkills: t.disabled_skills,
    units: units
      .filter((u) => u.troop_id === t.id)
      .map((u) => ({
        n: u.n,
        hp: u.hp,
        mana: u.mana,
        dead: u.dead,
        equip: Object.fromEntries(
          equipped
            .filter((e) => e.troop_id === t.id && e.unit_n === u.n)
            .map((e) => [e.slot!, { uid: String(e.id), base: e.base, roll: e.roll, stats: e.stats }]),
        ),
      })),
  }));
}

/** Vue « troupe de joueur » attendue par les générateurs (packages/gen). */
export const asPlayerTroop = (t: LoadedTroop): PlayerTroop => ({
  type: t.type,
  level: t.level,
  form: t.form,
  rank: t.rank,
  units: t.units.map((u): PlayerUnit => ({ hp: u.hp, mana: u.mana, equip: u.equip })),
});

export const statsOf = (c: GameContent, t: LoadedTroop, u: LoadedUnit): UnitStats =>
  unitStats(c.pack, asPlayerTroop(t), { hp: u.hp, mana: u.mana, equip: u.equip });

export async function setUnit(tx: Tx, troopId: number, n: number, v: { hp: number; mana: number; dead?: boolean }): Promise<void> {
  await tx
    .updateTable('troop_unit')
    .set({ hp: v.hp, mana: v.mana, ...(v.dead !== undefined ? { dead: v.dead } : {}) })
    .where('troop_id', '=', troopId)
    .where('n', '=', n)
    .execute();
}

/** Toutes les troupes du joueur à PV et mana maximum (entrée en ville, README 21). */
export async function healAll(tx: Tx, c: GameContent, playerId: number): Promise<void> {
  for (const t of await loadTroops(tx, playerId))
    for (const u of t.units) {
      const s = statsOf(c, t, u);
      if (u.hp !== s.hpMax || u.mana !== s.manaMax) await setUnit(tx, t.id, u.n, { hp: s.hpMax, mana: s.manaMax });
    }
}

/** Crée une troupe à pleine vie, dans sa forme de base si `form` n'est pas donnée. */
export async function createTroop(
  tx: Tx,
  c: GameContent,
  playerId: number,
  o: { type: string; level: number; container: TroopContainer; loaned?: boolean; reason: string; form?: string },
): Promise<number> {
  const def = c.pack.troops[o.type]!;
  const form = o.form ?? baseForm(c, o.type);
  const last = await tx
    .selectFrom('troop')
    .select((eb) => eb.fn.max('sort').as('m'))
    .where('player_id', '=', playerId)
    .executeTakeFirst();
  const row = await tx
    .insertInto('troop')
    .values({
      player_id: playerId,
      type: o.type,
      form,
      level: o.level,
      container: o.container,
      rank: def.defaultDist,
      sort: (last?.m ?? -1) + 1,
      loaned: o.loaned ?? false,
      died_at: null,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  const probe: LoadedTroop = {
    id: row.id,
    type: o.type,
    form,
    level: o.level,
    xp: 0,
    container: o.container,
    rank: def.defaultDist,
    sort: 0,
    loaned: false,
    disabledSkills: [],
    units: [],
  };
  const s = statsOf(c, probe, { n: 1, hp: 0, mana: 0, dead: false, equip: {} });
  await tx
    .insertInto('troop_unit')
    .values(Array.from({ length: def.units }, (_, i) => ({ troop_id: row.id, n: i + 1, hp: s.hpMax, mana: s.manaMax })))
    .execute();
  await tx
    .insertInto('asset_move')
    .values({
      player_id: playerId,
      kind: 'troop',
      item: o.type,
      instance_id: null,
      troop_id: row.id,
      from_container: 'SYSTEM',
      to_container: o.container,
      reason: o.reason,
    })
    .execute();
  return row.id;
}

/** Population et unités d'une liste de troupes (contrôle de l'escouade, README 20). */
export function squadUsage(c: GameContent, troops: LoadedTroop[]): { pop: number; units: number } {
  return troops.reduce((a, t) => ({ pop: a.pop + c.pack.troops[t.type]!.pop, units: a.units + t.units.length }), { pop: 0, units: 0 });
}

/**
 * Kit de départ (README 8.1) : 200 or, Milicien et Chasseur niveau 1 engagés, en banque 3 bandages et les
 * ingrédients de sa propre recette d'Acolyte. Remis une fois, à la première commande de jeu.
 */
export async function startPlayer(tx: Tx, c: GameContent, player: Player, now: Date): Promise<void> {
  const eco = c.pack.eco as unknown as {
    startGold: number;
    startTroops: [string, number][];
    startItems: Record<string, number>;
    startRecipe: string;
  };
  await transferGold(tx, { system: 'SOURCE_START' }, { player: player.id }, eco.startGold, 'départ');
  for (const [type, level] of eco.startTroops) await createTroop(tx, c, player.id, { type, level, container: 'SQUAD', reason: 'départ' });
  const items: Record<string, number> = { ...eco.startItems };
  for (const [id, q] of genRecipes(c.pack, player.seed)[eco.startRecipe]!.ingredients) items[id] = (items[id] ?? 0) + q;
  for (const [id, q] of Object.entries(items)) await addStack(tx, c, player.id, 'BANK', id, q, 'SYSTEM', 'départ');
  await tx.updateTable('player').set({ started_at: now, content_version: c.hash }).where('id', '=', player.id).execute();
}

/** Prêt de la garde (README 3.4) : un Milicien niveau 1 si le joueur n'a plus aucune troupe. */
export async function loanIfNoTroops(tx: Tx, c: GameContent, playerId: number): Promise<boolean> {
  if ((await loadTroops(tx, playerId)).some((t) => t.units.length)) return false;
  await createTroop(tx, c, playerId, { type: 'milicien', level: 1, container: 'SQUAD', loaned: true, reason: 'prêt de la garde' });
  return true;
}
