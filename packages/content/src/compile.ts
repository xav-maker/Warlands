/**
 * Compilation : content/ → pack (guide 5.4). Le pack réunit le contenu en un seul objet JSON, textes
 * remis en place, à la forme que lisent les générateurs (GenContent, packages/gen) et le moteur.
 * Son empreinte SHA-256 l'identifie : un pack publié n'est jamais modifié.
 */
import { createHash } from 'node:crypto';
import type { Issue, RawContent } from './load.ts';

export type Pack = Record<string, unknown> & {
  id: string;
  engineVersion: string;
  troops: Record<string, unknown>;
  skills: Record<string, unknown>;
};

/** Champs de texte de chaque genre : obligatoires (name, label) ou facultatifs (desc, role). */
const OPTIONAL = new Set(['desc', 'role']);

export interface Compiled {
  pack: Pack;
  hash: string;
  issues: Issue[];
}

export function compile(raw: RawContent): Compiled {
  const issues: Issue[] = [];
  const used = new Set<string>();
  /** Ajoute à `o` les textes `prefix.champ` ; signale les textes obligatoires manquants. */
  const withTexts = <T extends object>(o: T, prefix: string, fields: string[]): T => {
    const out: Record<string, unknown> = { ...(o as Record<string, unknown>) };
    for (const f of fields) {
      const key = `${prefix}.${f}`;
      if (key in raw.texts) {
        out[f] = raw.texts[key];
        used.add(key);
      } else if (!OPTIONAL.has(f)) issues.push({ level: 'error', where: 'texts/fr.yaml', message: `texte manquant : ${key}` });
    }
    return out as T;
  };
  const map = <V, R>(o: Record<string, V>, f: (id: string, v: V) => R): Record<string, R> =>
    Object.fromEntries(Object.entries(o).map(([k, v]) => [k, f(k, v)]));

  const troops: Record<string, unknown> = {};
  const monsters: Record<string, unknown> = {};
  const troopSlots: Record<string, unknown> = {};
  for (const [id, t] of Object.entries(raw.troops)) {
    const { slots, drops, boss, region, rare, ...def } = t;
    const rules = raw.strategies[id];
    if (!rules) issues.push({ level: 'error', where: 'strategies.yaml', message: `stratégie manquante : ${id}` });
    troops[id] = {
      ...withTexts(def, `troop.${id}`, ['name', 'role']),
      forms: def.forms.map((f) => withTexts(f, `troop.${id}.forms.${f.id}`, ['name'])),
      rules: rules ?? [],
    };
    if (slots) troopSlots[id] = slots;
    if (region !== undefined || drops || boss !== undefined) monsters[id] = { drops, boss, region, ...(rare ? { rare } : {}) };
  }
  for (const id of Object.keys(raw.strategies))
    if (!(id in raw.troops)) issues.push({ level: 'error', where: 'strategies.yaml', message: `stratégie d'une troupe inconnue : ${id}` });

  const P = raw.params;
  const pack: Pack = {
    id: raw.pack.id,
    engineVersion: raw.pack.engineVersion,
    params: P.engine,
    weapons: map(raw.weapons, (id, w) => withTexts(w, `weapon.${id}`, ['name'])),
    skills: map(raw.skills, (id, s) => withTexts(s, `skill.${id}`, ['name', 'desc'])),
    troops,
    monsters,
    items: map(raw.items, (id, i) => ({ id, ...withTexts(i, `item.${id}`, ['name', 'desc']) })),
    equip: map(raw.equip, (id, b) => ({ id, ...withTexts(b, `equip.${id}`, ['name']) })),
    regions: raw.regions.map((R) => ({
      ...withTexts(R, `region.${R.id}`, ['name']),
      city: withTexts(R.city, `region.${R.id}.city`, ['name', 'desc']),
      ...(R.territory
        ? {
            territory: {
              ...withTexts(R.territory, `region.${R.id}.territory`, ['name', 'desc']),
              steps: R.territory.steps.map((s) => withTexts(s, `region.${R.id}.steps.${s.id}`, ['name', 'desc'])),
            },
          }
        : {}),
    })),
    ...(raw.routes
      ? {
          routes: raw.routes.map((x) => ({
            ...withTexts(x, `route.${x.id}`, ['name', 'desc']),
            steps: x.steps.map((s) => withTexts(s, `route.${x.id}.steps.${s.id}`, ['name', 'desc'])),
          })),
        }
      : {}),
    ...(raw.dungeons ? { dungeons: raw.dungeons.map((d) => withTexts(d, `dungeon.${d.id}`, ['name', 'desc'])) } : {}),
    ...(P.dungeons ? { dungeonParams: P.dungeons } : {}),
    // Graphe : la route d'un rare devient son index, comme le territoire du prototype (Rare.region).
    rares: raw.rares.map(({ route, ...x }) =>
      withTexts(route !== undefined ? { ...x, region: raw.routes?.findIndex((y) => y.id === route) ?? -1 } : x, `rare.${x.id}`, ['name']),
    ),
    eco: P.eco,
    statCost: map(P.items.statCost, (k, c) => withTexts(c, `stat.${k}`, ['label'])),
    tierBudget: P.items.tierBudget,
    tierNStats: P.items.tierNStats,
    tierLevel: P.items.tierLevel,
    troopSlots,
    craftConsumables: P.recipes.craftConsumables,
    consumableTags: P.recipes.consumableTags,
    consumableValueMult: P.recipes.consumableValueMult,
    recruitValue: P.recipes.recruitValue,
    itemBoost: P.items.boost,
    gaugeMult: P.gauges.mult,
    rareChance: P.rares.chance,
    rareMinWins: P.rares.minWins,
    questGivers: raw.givers,
    dmgTypes: raw.damageTypes,
    online: P.online,
  };
  for (const key of Object.keys(raw.texts))
    if (!used.has(key)) issues.push({ level: 'warning', where: 'texts/fr.yaml', message: `texte inutilisé : ${key}` });
  const hash = createHash('sha256').update(JSON.stringify(pack)).digest('hex');
  return { pack, hash, issues };
}
