/**
 * Caserne et escouade (README 4.3 à 4.6, 8.4, 20, 20.1) : recruter, racheter des unités, engager ou retirer
 * une troupe, changer son rang, désactiver des capacités.
 */
import { z } from 'zod';
import { GameError } from '@cr/shared';
import { basicAttack, learned } from '@cr/gen';
import { command } from '../command.ts';
import type { CommandContext } from '../command.ts';
import { online, region } from './content.ts';
import { payRecipe, recipes } from './recipes.ts';
import { createTroop, loadTroops, setUnit, squadUsage, statsOf } from './troops.ts';
import type { LoadedTroop } from './troops.ts';

const troopId = z.number().int().positive();

/** La ville actuelle recrute-t-elle ce type ? On y rachète et on y fait évoluer la troupe (README 18.3). */
export const recruitedIn = (ctx: CommandContext, type: string): boolean =>
  region(ctx.content, ctx.player.pos_region).city.recruit.includes(type);

export async function troopOf(ctx: CommandContext, id: number): Promise<LoadedTroop> {
  const t = (await loadTroops(ctx.tx, ctx.player.id)).find((x) => x.id === id);
  if (!t || !t.units.length) throw new GameError('TROOP_NOT_FOUND');
  return t;
}

/** Une troupe de plus tient-elle dans l'escouade (8 unités, 11 de population, README 20) ? */
async function fits(ctx: CommandContext, add: { pop: number; units: number }): Promise<boolean> {
  const o = online(ctx.content);
  const u = squadUsage(
    ctx.content,
    (await loadTroops(ctx.tx, ctx.player.id, ['SQUAD'])).filter((t) => t.units.length),
  );
  return u.pop + add.pop <= o.squad.maxPop && u.units + add.units <= o.squad.maxUnits;
}

export const recruit = command({
  name: 'recruit',
  input: z.object({ type: z.string().min(1) }),
  rate: { perMinute: 20 },
  where: ['city'],
  async run(ctx, input) {
    const c = ctx.content;
    if (!recruitedIn(ctx, input.type)) throw new GameError('NOT_RECRUITED_HERE');
    const rec = (await recipes(ctx.tx, c, ctx.player)).get(input.type)!;
    await payRecipe(ctx.tx, ctx.player.id, rec, 1, 'SINK_RECRUIT', `recrutement ${input.type}`);
    // Une recrue arrive au niveau minimal de la région de sa ville (README 8.4) ; en escouade si elle tient.
    const home = c.pack.regions.find((r) => r.city.recruit.includes(input.type))!;
    const def = c.pack.troops[input.type]!;
    const container = (await fits(ctx, { pop: def.pop, units: def.units })) ? 'SQUAD' : 'BARRACKS';
    const id = await createTroop(ctx.tx, c, ctx.player.id, { type: input.type, level: home.minLevel, container, reason: 'recrutement' });
    return { troop: id, container };
  },
});

export const rebuyUnits = command({
  name: 'unit.rebuy',
  input: z.object({ troop: troopId }),
  rate: { perMinute: 20 },
  where: ['city'],
  async run(ctx, input) {
    const c = ctx.content;
    const t = await troopOf(ctx, input.troop);
    const def = c.pack.troops[t.type]!;
    const missing = def.units - t.units.length;
    if (missing <= 0) throw new GameError('TROOP_COMPLETE');
    if (!recruitedIn(ctx, t.type)) throw new GameError('NOT_RECRUITED_HERE');
    if (t.container === 'SQUAD' && !(await fits(ctx, { pop: 0, units: missing }))) throw new GameError('SQUAD_FULL');
    // Coût : recette de recrutement × (unités manquantes ÷ unités du type), arrondi au supérieur (README 4.6).
    const rec = (await recipes(ctx.tx, c, ctx.player)).get(t.type)!;
    await payRecipe(ctx.tx, ctx.player.id, rec, missing / def.units, 'SINK_REBUY_UNIT', `rachat ${t.type}`);
    // Les unités rachetées arrivent à pleine vie, sans équipement.
    const s = statsOf(c, t, { n: 1, hp: 0, mana: 0, dead: false, equip: {} });
    const alive = new Set(t.units.map((u) => u.n));
    for (let n = 1; n <= def.units; n++) {
      if (alive.has(n)) continue;
      const exists = await ctx.tx.selectFrom('troop_unit').select('n').where('troop_id', '=', t.id).where('n', '=', n).executeTakeFirst();
      if (exists) await setUnit(ctx.tx, t.id, n, { hp: s.hpMax, mana: s.manaMax, dead: false });
      else await ctx.tx.insertInto('troop_unit').values({ troop_id: t.id, n, hp: s.hpMax, mana: s.manaMax }).execute();
    }
    return { revived: missing };
  },
});

export const engage = command({
  name: 'squad.engage',
  input: z.object({ troop: troopId }),
  rate: { perMinute: 60 },
  where: ['city'],
  async run(ctx, input) {
    const t = await troopOf(ctx, input.troop);
    if (t.container === 'SQUAD') return { container: 'SQUAD' as const };
    if (!(await fits(ctx, { pop: ctx.content.pack.troops[t.type]!.pop, units: t.units.length }))) throw new GameError('SQUAD_FULL');
    await ctx.tx.updateTable('troop').set({ container: 'SQUAD', updated_at: ctx.now }).where('id', '=', t.id).execute();
    return { container: 'SQUAD' as const };
  },
});

export const withdraw = command({
  name: 'squad.withdraw',
  input: z.object({ troop: troopId }),
  rate: { perMinute: 60 },
  where: ['city'],
  async run(ctx, input) {
    const t = await troopOf(ctx, input.troop);
    await ctx.tx.updateTable('troop').set({ container: 'BARRACKS', updated_at: ctx.now }).where('id', '=', t.id).execute();
    return { container: 'BARRACKS' as const };
  },
});

/** Rang de départ de la troupe : modifiable partout, entre deux combats (README 4.5). */
export const setRank = command({
  name: 'squad.setRank',
  input: z.object({ troop: troopId, rank: z.number().int().min(1).max(3) }),
  rate: { perMinute: 60 },
  where: ['city', 'route'],
  async run(ctx, input) {
    const t = await troopOf(ctx, input.troop);
    await ctx.tx.updateTable('troop').set({ rank: input.rank, updated_at: ctx.now }).where('id', '=', t.id).execute();
    return { rank: input.rank };
  },
});

/** Capacités désactivées (README 20.1) : capacités connues seulement, jamais l'attaque de base. */
export const setDisabledSkills = command({
  name: 'troop.setDisabledSkills',
  input: z.object({ troop: troopId, skills: z.array(z.string().min(1)).max(40) }),
  rate: { perMinute: 30 },
  where: ['city', 'route'],
  async run(ctx, input) {
    const t = await troopOf(ctx, input.troop);
    const def = ctx.content.pack.troops[t.type]!;
    const known = new Set(learned(def, t.form, t.level));
    if (input.skills.includes(basicAttack(def))) throw new GameError('BASIC_ATTACK_LOCKED');
    if (input.skills.some((s) => !known.has(s))) throw new GameError('SKILL_UNKNOWN');
    const skills = [...new Set(input.skills)];
    await ctx.tx.updateTable('troop').set({ disabled_skills: skills, updated_at: ctx.now }).where('id', '=', t.id).execute();
    return { disabled: skills };
  },
});
