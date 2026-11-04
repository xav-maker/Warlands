/**
 * Atelier et équipement (README 3.4, 7.3, 7.4, 21, guide 7.2).
 *
 * - Fabriquer : en ville, recette personnelle ; l'équipement de palier 4 ou 5 ne se fabrique qu'à l'atelier
 *   de sa ville (Cendrelune, Sanctuaire de l'Aube). Ce qui est fabriqué arrive en banque.
 * - Équiper : depuis la banque (en ville) ou le sac ; l'objet remplacé retourne d'où vient le nouveau.
 * - Retirer : vers la banque en ville, vers le sac en expédition (il faut de la place).
 * - En ville, un changement d'équipement remet l'unité à pleine vie (README 21) ; en expédition, PV et mana
 *   sont seulement bornés au nouveau maximum (au moins 1 PV).
 */
import { z } from 'zod';
import { GameError } from '@cr/shared';
import { Rng } from '@cr/rng';
import { canWear, genEquip } from '@cr/gen';
import type { StackContainer } from '@cr/db';
import { command } from '../command.ts';
import type { CommandContext } from '../command.ts';
import { troopOf } from './barracks.ts';
import { region } from './content.ts';
import type { GameContent } from './content.ts';
import { freshSeed } from './expedition.ts';
import { addInstance, addStack, capacity, contents, slotsUsed } from './inventory.ts';
import { payRecipe, recipes } from './recipes.ts';
import { loadTroops, setUnit, statsOf } from './troops.ts';

/** Ville dont l'atelier seul sait fabriquer cette base (README 3.4, bases signatures 9.2) ; null : partout. */
export function workshopOf(c: GameContent, out: string): string | null {
  const b = c.pack.equip[out];
  if (b?.region) return b.region;
  return b?.workshop ? (c.pack.regions[b.tier - 1]?.id ?? null) : null;
}

export const craft = command({
  name: 'craft',
  input: z.object({ out: z.string().min(1) }),
  rate: { perMinute: 30 },
  where: ['city'],
  async run(ctx, input) {
    const c = ctx.content;
    const pid = ctx.player.id;
    const rec = (await recipes(ctx.tx, c, ctx.player)).get(input.out);
    if (!rec || (rec.kind !== 'equip' && rec.kind !== 'consommable')) throw new GameError('RECIPE_UNKNOWN');
    const ws = workshopOf(c, input.out);
    if (ws && ws !== ctx.player.pos_region) throw new GameError('WORKSHOP_ELSEWHERE', { ville: region(c, ws).city.name });
    await payRecipe(ctx.tx, pid, rec, 1, 'SINK_CRAFT', `atelier ${input.out}`);
    if (rec.kind === 'equip') {
      const it = genEquip(c.pack, input.out, new Rng(freshSeed(ctx)));
      const id = await addInstance(ctx.tx, c, pid, 'BANK', it, 'craft', 'atelier');
      if (!id) throw new GameError('BANK_FULL');
      return { instance: id, roll: it.roll };
    }
    if (await addStack(ctx.tx, c, pid, 'BANK', input.out, 1, 'SYSTEM', 'atelier')) throw new GameError('BANK_FULL');
    return { item: input.out };
  },
});

/** Après un changement d'équipement : soin complet en ville, bornage en expédition. */
async function refit(ctx: CommandContext, troopId: number, n: number): Promise<void> {
  const t = (await loadTroops(ctx.tx, ctx.player.id)).find((x) => x.id === troopId)!;
  const u = t.units.find((x) => x.n === n)!;
  const s = statsOf(ctx.content, t, u);
  if (ctx.player.pos_kind === 'city') await setUnit(ctx.tx, t.id, n, { hp: s.hpMax, mana: s.manaMax });
  else await setUnit(ctx.tx, t.id, n, { hp: Math.max(1, Math.min(u.hp, s.hpMax)), mana: Math.max(0, Math.min(u.mana, s.manaMax)) });
}

async function logMove(ctx: CommandContext, instance: number, base: string, from: string, to: string, reason: string): Promise<void> {
  await ctx.tx
    .insertInto('asset_move')
    .values({
      player_id: ctx.player.id,
      kind: 'instance',
      item: base,
      instance_id: instance,
      troop_id: null,
      from_container: from,
      to_container: to,
      reason,
    })
    .execute();
}

const unitRef = { troop: z.number().int().positive(), unit: z.number().int().min(1).max(3) };

export const equip = command({
  name: 'equip',
  input: z.object({ ...unitRef, instance: z.number().int().positive() }),
  rate: { perMinute: 60 },
  where: ['city', 'route'],
  async run(ctx, input) {
    const c = ctx.content;
    const pid = ctx.player.id;
    const t = await troopOf(ctx, input.troop);
    if (!t.units.some((u) => u.n === input.unit)) throw new GameError('UNIT_NOT_FOUND');
    const it = await ctx.tx
      .selectFrom('item_instance')
      .select(['id', 'base', 'container'])
      .where('id', '=', input.instance)
      .where('player_id', '=', pid)
      .where('container', 'in', ['BAG', 'BANK'])
      .forUpdate()
      .executeTakeFirst();
    if (!it) throw new GameError('ITEM_NOT_FOUND');
    const from = it.container as StackContainer;
    if (from === 'BANK' && ctx.player.pos_kind !== 'city') throw new GameError('WRONG_POSITION');
    const why = canWear(c.pack, t.type, t.level, it.base);
    if (why) throw new GameError(why.startsWith('niveau') ? 'LEVEL_TOO_LOW' : 'CANNOT_WEAR', { detail: why });
    const slot = c.pack.equip[it.base]!.slot;
    // L'objet porté dans cet emplacement retourne d'où vient le nouveau (la place se libère d'abord).
    const old = await ctx.tx
      .selectFrom('item_instance')
      .select(['id', 'base'])
      .where('container', '=', 'EQUIPPED')
      .where('troop_id', '=', t.id)
      .where('unit_n', '=', input.unit)
      .where('slot', '=', slot)
      .forUpdate()
      .executeTakeFirst();
    // L'ancien sort d'abord : un seul objet par emplacement (contrainte de la base).
    if (old) {
      await ctx.tx
        .updateTable('item_instance')
        .set({ container: from, troop_id: null, unit_n: null, slot: null, updated_at: ctx.now })
        .where('id', '=', old.id)
        .execute();
      await logMove(ctx, old.id, old.base, 'EQUIPPED', from, 'remplacé');
    }
    await ctx.tx
      .updateTable('item_instance')
      .set({ container: 'EQUIPPED', troop_id: t.id, unit_n: input.unit, slot, updated_at: ctx.now })
      .where('id', '=', it.id)
      .execute();
    await logMove(ctx, it.id, it.base, from, 'EQUIPPED', 'équipé');
    await refit(ctx, t.id, input.unit);
    return { slot, replaced: old?.id ?? null };
  },
});

export const unequip = command({
  name: 'unequip',
  input: z.object({ ...unitRef, slot: z.string().min(1) }),
  rate: { perMinute: 60 },
  where: ['city', 'route'],
  async run(ctx, input) {
    const c = ctx.content;
    const pid = ctx.player.id;
    const t = await troopOf(ctx, input.troop);
    const it = await ctx.tx
      .selectFrom('item_instance')
      .select(['id', 'base'])
      .where('container', '=', 'EQUIPPED')
      .where('troop_id', '=', t.id)
      .where('unit_n', '=', input.unit)
      .where('slot', '=', input.slot)
      .forUpdate()
      .executeTakeFirst();
    if (!it) throw new GameError('ITEM_NOT_FOUND');
    const to: StackContainer = ctx.player.pos_kind === 'city' ? 'BANK' : 'BAG';
    if (slotsUsed(c, await contents(ctx.tx, pid, to)) >= capacity(c, to)) throw new GameError(to === 'BAG' ? 'BAG_FULL' : 'BANK_FULL');
    await ctx.tx
      .updateTable('item_instance')
      .set({ container: to, player_id: pid, troop_id: null, unit_n: null, slot: null, updated_at: ctx.now })
      .where('id', '=', it.id)
      .execute();
    await logMove(ctx, it.id, it.base, 'EQUIPPED', to, 'retiré');
    await refit(ctx, t.id, input.unit);
    return { to };
  },
});
