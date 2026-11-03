/**
 * Évolutions des troupes (README 24) : facultatives, en ville, dans une ville qui recrute le type, quand la
 * troupe atteint le niveau de la forme (10 ou 20). Au niveau 20, deux branches parfois : choix définitif.
 *
 * Recette personnelle [H, README 24] :
 *   niveau 10 : ingrédients de la recette de recrutement × 2, or = 60 × population × palier ;
 *   niveau 20 : ingrédients × 4 + 1 composant de palier ≥ 3, or = 200 × population × palier.
 * Le composant est tiré de la graine du joueur ; la recette est enregistrée au premier usage, puis ne change plus.
 * La troupe garde niveau, XP, unités et capacités désactivées ; en ville, elle est remise au nouveau maximum.
 */
import { z } from 'zod';
import { GameError } from '@cr/shared';
import { Rng, hash } from '@cr/rng';
import type { Database, Db, Player, Transaction } from '@cr/db';
import type { Form } from '@cr/gen';
import { command } from '../command.ts';
import { recruitedIn, troopOf } from './barracks.ts';
import type { GameContent } from './content.ts';
import { payRecipe, recipes } from './recipes.ts';
import type { PlayerRecipe } from './recipes.ts';
import { loadTroops, setUnit, statsOf } from './troops.ts';

type Tx = Transaction<Database>;

/** Formes accessibles depuis la forme actuelle d'une troupe (enfants directs). */
export function nextForms(c: GameContent, type: string, form: string): Form[] {
  return c.pack.troops[type]!.forms.filter((f) => f.parent === form);
}

/** Palier d'une troupe : celui de la région qui la recrute. */
const tierOf = (c: GameContent, type: string): number => c.pack.regions.find((r) => r.city.recruit.includes(type))?.tier ?? 1;

/** Recette d'évolution vers `form`, créée au premier usage à partir de la recette de recrutement du joueur. */
export async function evolutionRecipe(
  tx: Tx,
  c: GameContent,
  player: Pick<Player, 'id' | 'seed'>,
  type: string,
  form: Form,
): Promise<PlayerRecipe> {
  const out = `evolution:${type}:${form.id}`;
  const mine = await recipes(tx, c, player);
  const existing = mine.get(out);
  if (existing) return existing;
  const base = mine.get(type)!;
  const high = form.level >= 20;
  const def = c.pack.troops[type]!;
  const ingredients = base.ingredients.map(([id, q]): [string, number] => [id, q * (high ? 4 : 2)]);
  if (high) {
    const comps = Object.values(c.pack.items)
      .filter((i) => i.kind === 'composant' && i.tier >= 3)
      .map((i) => i.id)
      .sort();
    const r = new Rng(hash(player.seed, 'evolution', type, form.id));
    ingredients.push([comps[r.int(comps.length)]!, 1]);
  }
  const gold = (high ? 200 : 60) * def.pop * tierOf(c, type);
  const row = {
    player_id: player.id,
    out,
    kind: 'evolution' as const,
    ingredients: JSON.stringify(ingredients),
    gold,
    budget: 0,
    content_version: c.hash,
  };
  await tx
    .insertInto('player_recipe')
    .values(row)
    .onConflict((oc) => oc.doNothing())
    .execute();
  return { out, kind: 'evolution', ingredients, gold };
}

export const evolve = command({
  name: 'evolve',
  input: z.object({ troop: z.number().int().positive(), form: z.string().min(1) }),
  rate: { perMinute: 10 },
  where: ['city'],
  async run(ctx, input) {
    const c = ctx.content;
    const t = await troopOf(ctx, input.troop);
    const form = nextForms(c, t.type, t.form).find((f) => f.id === input.form);
    if (!form) throw new GameError('FORM_UNAVAILABLE');
    if (t.level < form.level) throw new GameError('LEVEL_TOO_LOW');
    if (!recruitedIn(ctx, t.type)) throw new GameError('NOT_RECRUITED_HERE');
    const rec = await evolutionRecipe(ctx.tx, c, ctx.player, t.type, form);
    await payRecipe(ctx.tx, ctx.player.id, rec, 1, 'SINK_EVOLUTION', `évolution ${t.type} → ${form.id}`);
    await ctx.tx.updateTable('troop').set({ form: form.id, updated_at: ctx.now }).where('id', '=', t.id).execute();
    const after = (await loadTroops(ctx.tx, ctx.player.id)).find((x) => x.id === t.id)!;
    for (const u of after.units) {
      const s = statsOf(c, after, u);
      await setUnit(ctx.tx, t.id, u.n, { hp: s.hpMax, mana: s.manaMax });
    }
    return { form: form.id };
  },
});

/** Évolutions affichées sur la page de troupe : forme, niveau requis, coût et possessions (crée les recettes au besoin). */
export async function evolutionPreview(db: Db, c: GameContent, playerId: number, t: { type: string; form: string }) {
  return db.transaction().execute(async (tx) => {
    const player = await tx.selectFrom('player').select(['id', 'seed']).where('id', '=', playerId).executeTakeFirstOrThrow();
    const out = [];
    for (const f of nextForms(c, t.type, t.form)) {
      const r = await evolutionRecipe(tx, c, player, t.type, f);
      const owned: Record<string, number> = {};
      for (const [id] of r.ingredients) {
        const rows = await tx
          .selectFrom('item_stack')
          .select('qty')
          .where('player_id', '=', playerId)
          .where('item', '=', id)
          .where('container', 'in', ['BANK', 'BAG'])
          .execute();
        owned[id] = rows.reduce((a, x) => a + x.qty, 0);
      }
      out.push({ form: f, recipe: r, owned });
    }
    return out;
  });
}
