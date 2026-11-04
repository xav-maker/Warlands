/**
 * Validation du contenu (guide 5.2) : références, textes, tables de butin, stratégies, graphe du monde.
 *
 * Monde : les territoires du prototype (en ligne droite, dans les régions) ou le graphe de routes
 * (world/routes.yaml, README 18) : 2 ou 3 routes par région, tout relié à la première région, palier d'une
 * route = le plus petit des paliers de ses deux régions.
 */
import { compile } from './compile.ts';
import type { Compiled } from './compile.ts';
import { loadContent } from './load.ts';
import type { Issue, RawContent } from './load.ts';

const COMMON = new Set(['avancer', 'reculer', 'attendre', 'fuir']);

export function checkReferences(raw: RawContent): Issue[] {
  const issues: Issue[] = [];
  const err = (where: string, message: string): void => void issues.push({ level: 'error', where, message });
  const warn = (where: string, message: string): void => void issues.push({ level: 'warning', where, message });
  const at = (kind: string, id: string): string => raw.origin[`${kind}.${id}`] ?? kind;
  const isItem = (id: string): boolean => id in raw.items;
  const isEquip = (id: string): boolean => id in raw.equip;
  const types = new Set(raw.damageTypes);

  for (const [id, s] of Object.entries(raw.skills)) {
    if (s.dtype && s.dtype !== 'weapon' && !types.has(s.dtype)) err(at('skills', id), `${id} : type de dégâts inconnu ${s.dtype}`);
    for (const f of s.fx ?? []) if (f.type && !types.has(f.type)) err(at('skills', id), `${id} : type de dégâts inconnu ${f.type}`);
  }
  for (const [id, w] of Object.entries(raw.weapons))
    if (!types.has(w.type)) err('weapons.yaml', `${id} : type de dégâts inconnu ${w.type}`);

  for (const [id, t] of Object.entries(raw.troops)) {
    const where = at('troops', id);
    if (!(t.weapon in raw.weapons)) err(where, `${id} : arme inconnue ${t.weapon}`);
    const forms = new Set(t.forms.map((f) => f.id));
    for (const f of t.forms) {
      if (f.parent && !forms.has(f.parent)) err(where, `${id}.${f.id} : forme parente inconnue ${f.parent}`);
      for (const [sk] of f.skills) if (!(sk in raw.skills)) err(where, `${id}.${f.id} : capacité inconnue ${sk}`);
      for (const ty of Object.keys(f.res)) if (!types.has(ty)) err(where, `${id}.${f.id} : résistance d'un type inconnu ${ty}`);
    }
    for (const d of t.drops ?? []) if (!isItem(d)) err(where, `${id} : butin inconnu ${d}`);
    if (t.rare && !(t.rare.base in raw.troops)) err(where, `${id} : modèle de rare inconnu ${t.rare.base}`);
    // README 16, point 5 : une règle qui vise une capacité jamais apprise. Avertissement pour le contenu du
    // prototype, qui en a (les règles sont filtrées au calcul) ; à passer en erreur pour le contenu cible.
    const learnable = new Set(t.forms.flatMap((f) => f.skills.map(([sk]) => sk)));
    for (const r of raw.strategies[id] ?? []) {
      if (COMMON.has(r.action)) continue;
      if (!(r.action in raw.skills)) err('strategies.yaml', `${id} : capacité inconnue ${r.action}`);
      else if (!learnable.has(r.action)) warn('strategies.yaml', `${id} : ${r.action} n'est jamais apprise (README 16, point 5)`);
    }
  }

  const steps = new Set<string>();
  const regionIds = new Set(raw.regions.map((R) => R.id));
  raw.regions.forEach((R, ri) => {
    const where = `world/regions.yaml › ${R.id}`;
    for (const t of R.city.recruit) if (!(t in raw.troops) || raw.troops[t]!.region !== undefined) err(where, `recrue inconnue ${t}`);
    for (const x of R.city.shop) if (!isItem(x) && !isEquip(x)) err(where, `article de marchand inconnu ${x}`);
    if (ri > 0 && !raw.routes && R.minLevel < raw.regions[ri - 1]!.minLevel) err(where, 'niveau minimal inférieur à la région précédente');
    if (raw.routes && R.territory) err(where, 'avec world/routes.yaml, les territoires sont des routes');
    if (!raw.routes && !R.territory) err(where, 'territoire manquant (ou world/routes.yaml)');
  });
  const tierOf = new Map(raw.regions.map((R) => [R.id, R.tier]));
  const worldRoutes = raw.routes
    ? raw.routes.map((x) => ({ where: `world/routes.yaml › ${x.id}`, ...x }))
    : raw.regions.flatMap((R) => (R.territory ? [{ where: `world/regions.yaml › ${R.id}`, ...R, steps: R.territory.steps }] : []));
  if (raw.routes) {
    const ids = new Set<string>();
    const degree = new Map<string, number>();
    for (const x of raw.routes) {
      const where = `world/routes.yaml › ${x.id}`;
      // Une route peut garder l'identifiant de la région dont elle était le territoire (données déjà jouées).
      if (ids.has(x.id)) err(where, `identifiant de route en double ${x.id}`);
      ids.add(x.id);
      for (const end of [x.from, x.to]) {
        if (!regionIds.has(end)) err(where, `région inconnue ${end}`);
        degree.set(end, (degree.get(end) ?? 0) + 1);
      }
      if (x.from === x.to) err(where, 'une route relie deux régions différentes');
      const t = Math.min(tierOf.get(x.from) ?? 0, tierOf.get(x.to) ?? 0);
      if (t && x.tier !== t) err(where, `palier ${x.tier}, ${t} attendu (le plus petit des deux régions)`);
    }
    for (const R of raw.regions) {
      const d = degree.get(R.id) ?? 0;
      if (d < 2 || d > 3) err(`world/regions.yaml › ${R.id}`, `${d} route(s), 2 ou 3 attendues (README 18.1)`);
    }
    // Tout est relié à la région de départ (la première).
    const seen = new Set([raw.regions[0]!.id]);
    for (let grew = true; grew;) {
      grew = false;
      for (const x of raw.routes)
        if (seen.has(x.from) !== seen.has(x.to)) {
          seen.add(x.from);
          seen.add(x.to);
          grew = true;
        }
    }
    for (const R of raw.regions) if (!seen.has(R.id)) err(`world/regions.yaml › ${R.id}`, 'région non reliée à la région de départ');
  }
  for (const R of worldRoutes) {
    const where = R.where;
    if (!R.firstItem || !isItem(R.firstItem)) err(where, `objet de première victoire inconnu ${R.firstItem}`);
    if (!R.guardianLoot || !isEquip(R.guardianLoot)) err(where, `butin de gardien inconnu ${R.guardianLoot}`);
    const guardians = R.steps.filter((s) => s.guardian);
    if (guardians.length !== 1 || !R.steps.at(-1)!.guardian) err(where, 'la route doit finir par une seule étape de gardien');
    for (const s of R.steps) {
      if (steps.has(s.id)) err(where, `étape en double ${s.id}`);
      steps.add(s.id);
      for (const m of [...s.pool, ...(s.forced ?? [])])
        if (!(m in raw.troops) || raw.troops[m]!.region === undefined) err(where, `${s.id} : monstre inconnu ${m}`);
      for (const m of s.mats) if (!isItem(m)) err(where, `${s.id} : matériau inconnu ${m}`);
      for (const k of ['level', 'pop', 'draws'] as const) if (s[k][0] > s[k][1]) err(where, `${s.id} : ${k} min > max`);
    }
  }
  for (const x of raw.rares) {
    if ((x.route === undefined) === (x.region === undefined))
      err('world/rares.yaml', `${x.id} : region (prototype) ou route, l'un des deux`);
    if (x.route !== undefined && !raw.routes?.some((y) => y.id === x.route)) err('world/rares.yaml', `${x.id} : route inconnue ${x.route}`);
    if (!steps.has(x.step)) err('world/rares.yaml', `${x.id} : étape inconnue ${x.step}`);
    if (!(x.id in raw.troops)) err('world/rares.yaml', `${x.id} : monstre absent des troupes`);
    if (!isItem(x.trophy)) err('world/rares.yaml', `${x.id} : trophée inconnu ${x.trophy}`);
  }

  // Tables de butin : chaque table totalise 100 %.
  for (const k of ['table', 'guardianTable'] as const) {
    const sum = Object.values(raw.params.eco[k]).reduce((a, b) => a + b, 0);
    if (Math.abs(sum - 100) > 1e-9) err('params.yaml', `eco.${k} totalise ${sum} %, 100 attendus`);
  }
  for (const [id, b] of Object.entries(raw.equip))
    if (b.region && !regionIds.has(b.region)) err(at('equip', id), `${id} : région inconnue ${b.region}`);
  for (const id of raw.params.recipes.craftConsumables) if (!isItem(id)) err('params.yaml', `consommable fabricable inconnu ${id}`);
  return issues;
}

export interface Validation extends Partial<Compiled> {
  ok: boolean;
  issues: Issue[];
}

/** Charge, contrôle et compile content/. `ok` : aucune erreur (les avertissements n'empêchent rien). */
export function validateContent(dir: string): Validation {
  const { raw, issues } = loadContent(dir);
  if (!raw) return { ok: false, issues };
  const all = [...issues, ...checkReferences(raw)];
  const compiled = compile(raw);
  all.push(...compiled.issues);
  return { ok: !all.some((i) => i.level === 'error'), issues: all, pack: compiled.pack, hash: compiled.hash };
}
