/**
 * battle.fight (guide 8.2, README 11.3) : tout dans la même transaction, pour qu'un combat ne puisse pas
 * être relancé pour un meilleur tirage.
 */
import { gunzipSync, gzipSync } from 'node:zlib';
import { z } from 'zod';
import { GameError } from '@cr/shared';
import { simuler } from '@cr/engine';
import { battleUnits, rollLoot } from '@cr/gen';
import type { MonsterGroup } from '@cr/gen';
import { command } from '../command.ts';
import { online, route as routeOf, routeTierIndex, stepOf } from './content.ts';
import { enterCity, freshSeed } from './expedition.ts';
import { transferGold } from './gold.ts';
import { addInstance, addStack } from './inventory.ts';
import { xpFor, xpToNext } from './rules.ts';
import { asPlayerTroop, loadTroops, setUnit, statsOf } from './troops.ts';
import type { LoadedTroop } from './troops.ts';
import type { GameContent } from './content.ts';
import type { Database, Db, Transaction } from '@cr/db';
import type { UnitInput, UnitResult } from '@cr/engine';

type Tx = Transaction<Database>;

export interface BattleRewards {
  won: boolean;
  gold: number;
  /** XP de base de la victoire, avant partage. */
  xp: number;
  xpBy: { troop: number; type: string; gain: number; reserve?: boolean }[];
  levelUps: { troop: number; type: string; level: number }[];
  deaths: { troop: number; type: string; unit: number }[];
  loot: ({ item: string; qty: number } | { base: string; roll: number })[];
  /** Ce qui n'a pas tenu dans le sac : au sol, à ramasser avant de quitter l'étape. */
  left: ({ item: string; qty: number } | { base: string; roll: number })[];
  retreat: boolean;
}

/** Identifiants moteur (A1, A2…) des unités d'une escouade placée à partir de l'emplacement `first`. */
export function unitIds(squad: LoadedTroop[], first: number): string[] {
  let k = first;
  return squad.flatMap((t) => t.units.map(() => `A${++k}`));
}

export type SquadOutcome = Pick<BattleRewards, 'xp' | 'xpBy' | 'levelUps' | 'deaths'>;

/**
 * Applique un combat à l'escouade d'un joueur (guide 8.2, point 4) : unités mortes (équipement détruit), survivantes
 * à au moins 1 PV et + eco.manaRegenEnd % de mana (50), troupes sans unité en tombe ; en cas de victoire, XP partagée entre les troupes
 * qui ont combattu jusqu'au bout, et aussi aux troupes en réserve (README 29.2). En duo, chaque joueur l'applique à sa propre escouade (README 23.3).
 */
export async function settleSquad(
  tx: Tx,
  c: GameContent,
  now: Date,
  squad: LoadedTroop[],
  ids: string[],
  results: UnitResult[],
  won: boolean,
  side: MonsterGroup,
  reserve: LoadedTroop[] = [],
): Promise<SquadOutcome> {
  const eco = c.pack.eco as unknown as { manaRegenEnd: number; xpPerMonsterLevelPop: number; maxLevel: number };
  const reserveShare = online(c).reserve.xpShare;
  const byId = new Map(results.map((u) => [u.id, u]));
  const r: SquadOutcome = { xp: 0, xpBy: [], levelUps: [], deaths: [] };
  const earners = new Set<number>();
  let k = 0;
  for (const t of squad) {
    for (const u of t.units) {
      const ur = byId.get(ids[k++]!)!;
      if (ur.dead) {
        await setUnit(tx, t.id, u.n, { hp: 0, mana: 0, dead: true });
        await tx
          .updateTable('item_instance')
          .set({ container: 'GRAVE', troop_id: null, unit_n: null, slot: null, updated_at: now })
          .where('container', '=', 'EQUIPPED')
          .where('troop_id', '=', t.id)
          .where('unit_n', '=', u.n)
          .execute();
        r.deaths.push({ troop: t.id, type: t.type, unit: u.n });
        continue;
      }
      const mx = statsOf(c, t, u).manaMax;
      u.hp = Math.max(1, ur.hp);
      u.mana = Math.min(mx, ur.mana + Math.floor((mx * eco.manaRegenEnd) / 100));
      await setUnit(tx, t.id, u.n, { hp: u.hp, mana: u.mana });
      if (!ur.fled) earners.add(t.id);
    }
    t.units = t.units.filter((u) => !r.deaths.some((d) => d.troop === t.id && d.unit === u.n));
    if (!t.units.length)
      await tx.updateTable('troop').set({ container: 'GRAVE', died_at: now, updated_at: now }).where('id', '=', t.id).execute();
  }
  if (!won) return r;
  // XP partagée à parts égales entre les troupes gagnantes [Xavier, 3 novembre 2026], puis réduite pour une troupe
  // trop forte (README 4.4).
  r.xp = side.troops.reduce((a, t) => a + t.level * c.pack.troops[t.type]!.pop * eco.xpPerMonsterLevelPop, 0);
  const avg = side.troops.reduce((a, t) => a + t.level, 0) / side.troops.length;
  const winners = squad.filter((t) => earners.has(t.id) && t.units.length);
  const share = winners.length ? Math.floor(r.xp / winners.length) : 0;
  const award = async (t: LoadedTroop, gain: number, inReserve: boolean): Promise<void> => {
    r.xpBy.push({ troop: t.id, type: t.type, gain, ...(inReserve ? { reserve: true } : {}) });
    let xp = t.xp + gain;
    while (t.level < eco.maxLevel && xp >= xpToNext(t.level)) {
      const before = t.units.map((u) => statsOf(c, t, u));
      xp -= xpToNext(t.level);
      t.level++;
      for (const [i, u] of t.units.entries()) {
        const after = statsOf(c, t, u);
        u.hp = Math.max(1, Math.min(after.hpMax, u.hp + after.hpMax - before[i]!.hpMax));
        u.mana = Math.max(0, Math.min(after.manaMax, u.mana + after.manaMax - before[i]!.manaMax));
        await setUnit(tx, t.id, u.n, { hp: u.hp, mana: u.mana });
      }
      r.levelUps.push({ troop: t.id, type: t.type, level: t.level });
    }
    await tx.updateTable('troop').set({ xp, level: t.level, updated_at: now }).where('id', '=', t.id).execute();
  };
  for (const t of winners) await award(t, xpFor(share, t.level, avg), false);
  // La réserve n'a pas combattu mais reçoit la même part qu'une troupe qui a gagné (README 29.2).
  if (winners.length)
    for (const t of reserve) if (t.units.length) await award(t, xpFor(Math.floor((share * reserveShare) / 1000), t.level, avg), true);
  return r;
}

/** Journal complet gardé ce nombre de jours (guide 15.3 [H]). */
export const BATTLE_LOG_DAYS = 30;

/** Efface les journaux de plus de BATTLE_LOG_DAYS jours ; rend le nombre de combats concernés. */
export async function purgeBattleLogs(db: Db, now = new Date(), days = BATTLE_LOG_DAYS): Promise<number> {
  const r = await db
    .updateTable('battle')
    .set({ log: null })
    .where('created_at', '<', new Date(now.getTime() - days * 86_400_000))
    .where('log', 'is not', null)
    .executeTakeFirst();
  return Number(r.numUpdatedRows);
}

/**
 * Journal d'un combat (rediffusion) : celui enregistré, ou, une fois effacé, le même rejoué par le moteur depuis l'entrée
 * et la graine — possible tant que le contenu actif est celui du combat. Null sinon.
 */
export function battleLog(
  c: GameContent,
  b: { log: Buffer | null; input: unknown; seed: number | string; engine_version: string; content_version: string },
): string | null {
  if (b.log) return gunzipSync(b.log).toString('utf8');
  if (b.content_version !== c.hash) return null;
  const units = (b.input as { units: UnitInput[] }).units;
  return JSON.stringify(
    simuler({ engineVersion: b.engine_version, params: c.pack.params, skills: c.pack.skills, units }, Number(b.seed)).log,
  );
}

export const fight = command({
  name: 'battle.fight',
  input: z.object({}),
  rate: { perMinute: 20 },
  where: ['route'],
  async run(ctx) {
    const c = ctx.content;
    const o = online(c);
    const pid = ctx.player.id;
    const route = ctx.player.pos_route!;
    const step = ctx.player.pos_step!;
    const exp = await ctx.tx.selectFrom('expedition').selectAll().where('player_id', '=', pid).forUpdate().executeTakeFirst();
    const enc = await ctx.tx
      .selectFrom('encounter')
      .selectAll()
      .where('player_id', '=', pid)
      .where('status', '=', 'visible')
      .forUpdate()
      .executeTakeFirst();
    if (!exp || !enc) throw new GameError('NO_ENCOUNTER');
    const squad = (await loadTroops(ctx.tx, pid, ['SQUAD'])).filter((t) => t.units.length);
    if (!squad.length) throw new GameError('SQUAD_EMPTY');

    // 1-3. Entrée, graine fraîche, simulation.
    const st = stepOf(c, route, step);
    const side = enc.side as MonsterGroup;
    const units = battleUnits(c.pack, squad.map(asPlayerTroop), side, {
      territory: routeTierIndex(c, route),
      guardianStep: !!st.guardian,
      guardianAdjust: o.guardianAdjust,
      ...(st.mult ? { mult: st.mult } : {}),
    });
    const seed = freshSeed(ctx);
    const input = { engineVersion: o.engineVersion, params: c.pack.params, skills: c.pack.skills, units };
    const { log, result } = simuler(input, seed);
    const won = result.winner === 0;
    const r: BattleRewards = { won, gold: 0, xp: 0, xpBy: [], levelUps: [], deaths: [], loot: [], left: [], retreat: false };

    // 4. Unités (morts, PV, mana) et XP.
    const out = await settleSquad(
      ctx.tx,
      c,
      ctx.now,
      squad,
      unitIds(squad, 0),
      result.units,
      won,
      side,
      await loadTroops(ctx.tx, pid, ['RESERVE']),
    );
    Object.assign(r, out);

    if (won) {
      // Butin (README 8.6) : or, trophée du rare, objets vers le sac puis au sol.
      const R = routeOf(c, route);
      const first = !!st.guardian && !ctx.player.guardians.includes(route);
      const loot = rollLoot(
        c.pack,
        st,
        side.troops.map((t) => t.type),
        seed,
        st.guardian ? { first, firstItem: R.firstItem, loot: R.guardianLoot } : null,
      );
      r.gold = loot.gold;
      if (loot.gold > 0) await transferGold(ctx.tx, { system: 'SOURCE_COMBAT' }, { player: pid }, loot.gold, `combat ${route}/${step}`);
      if (enc.rare) loot.items.unshift({ id: c.pack.monsters[enc.rare]!.rare!.trophy, qty: 1 });
      for (const it of loot.items) {
        if ('id' in it) {
          const left = await addStack(ctx.tx, c, pid, 'BAG', it.id, it.qty, 'SYSTEM', 'butin');
          if (left < it.qty) r.loot.push({ item: it.id, qty: it.qty - left });
          if (left) {
            await addStack(ctx.tx, c, pid, 'PENDING_LOOT', it.id, left, 'SYSTEM', 'butin au sol');
            r.left.push({ item: it.id, qty: left });
          }
        } else if (await addInstance(ctx.tx, c, pid, 'BAG', it.equip, 'loot', 'butin'))
          r.loot.push({ base: it.equip.base, roll: it.equip.roll });
        else {
          await addInstance(ctx.tx, c, pid, 'PENDING_LOOT', it.equip, 'loot', 'butin au sol');
          r.left.push({ base: it.equip.base, roll: it.equip.roll });
        }
      }
      const cleared = [...exp.cleared];
      cleared[step] = true;
      await ctx.tx.updateTable('expedition').set({ cleared }).where('player_id', '=', pid).execute();
      if (first)
        await ctx.tx
          .updateTable('player')
          .set({ guardians: [...ctx.player.guardians, route] })
          .where('id', '=', pid)
          .execute();
    }

    // 5. Rencontre passée, compteurs, blocage de rediffusion, combat enregistré.
    await ctx.tx.updateTable('encounter').set({ status: 'fought' }).where('id', '=', enc.id).execute();
    const watchMs = Math.ceil((result.time * 1000) / o.watch.instantsPerSecond);
    await ctx.tx
      .updateTable('player')
      .set((eb) => ({
        stat_fights: eb('stat_fights', '+', 1),
        stat_wins: eb('stat_wins', '+', won ? 1 : 0),
        stat_deaths: eb('stat_deaths', '+', r.deaths.length),
        watch_until: new Date(ctx.now.getTime() + watchMs),
        updated_at: ctx.now,
      }))
      .where('id', '=', pid)
      .execute();
    r.retreat = !won || !squad.some((t) => t.units.length);
    const battle = await ctx.tx
      .insertInto('battle')
      .values({
        player_id: pid,
        kind: st.guardian ? 'guardian' : 'route',
        route,
        step,
        encounter_id: enc.id,
        seed,
        engine_version: o.engineVersion,
        content_version: c.hash,
        input: JSON.stringify({ units }),
        result: JSON.stringify(result),
        log: gzipSync(JSON.stringify(log)),
        duration: result.time,
        won,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    await ctx.tx
      .insertInto('battle_participant')
      .values({ battle_id: battle.id, player_id: pid, rewards: JSON.stringify(r) })
      .execute();

    // 6. Défaite, ou plus personne dans l'escouade : repli forcé vers la ville de départ (guide 8.4).
    if (r.retreat) await enterCity(ctx, ctx.player.pos_region, 'repli forcé');
    ctx.emit({ topic: `user:${pid}`, type: 'battle.done', data: { battle: battle.id } });
    return { battle: battle.id, won, watchMs, rewards: r };
  },
});
