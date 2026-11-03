/**
 * Extraction du contenu du prototype en YAML (guide 4.3, 5.1). Script ponctuel : une fois content/ écrit,
 * c'est le YAML qui fait foi. Le relancer écrase content/ (refusé si le dossier existe, sauf --force).
 *
 *   pnpm --filter @cr/extract-prototype to-yaml [--force]
 *
 * Découpage : les noms, rôles et descriptions vont dans texts/fr.yaml, les règles dans strategies.yaml.
 * Les collections sont réparties en fichiers contigus, listés dans l'ordre dans pack.yaml : l'ordre des
 * entrées fait partie du contenu (les générateurs tirent dans cet ordre).
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { loadPrototype } from './load.ts';

/* eslint-disable @typescript-eslint/no-explicit-any */
const P = loadPrototype();
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../../content');
if (existsSync(ROOT) && !process.argv.includes('--force')) {
  console.error(`${ROOT} existe déjà : c'est la source du contenu. --force pour l'écraser.`);
  process.exit(1);
}
const plain = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

const texts: Record<string, string> = {};
/** Retire les champs de texte d'un objet et les range dans texts sous `prefix.champ`. */
function takeTexts<T extends Record<string, any>>(o: T, prefix: string, fields: string[]): T {
  const out: Record<string, any> = { ...o };
  for (const f of fields)
    if (f in out) {
      texts[`${prefix}.${f}`] = out[f];
      delete out[f];
    }
  return out as T;
}

/** Un fichier YAML lisible : listes de scalaires et petites tables de scalaires sur une ligne. */
function write(rel: string, data: unknown, header: string): void {
  const doc = new YAML.Document(data);
  YAML.visit(doc, {
    Seq(_, node) {
      if (node.items.every((i) => YAML.isScalar(i) || (YAML.isSeq(i) && i.items.every(YAML.isScalar)))) node.flow = true;
    },
    Map(_, node) {
      if (node.items.length <= 8 && node.items.every((p) => YAML.isScalar(p.value))) node.flow = true;
    },
  });
  doc.commentBefore = ` ${header}`;
  const path = join(ROOT, rel);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, doc.toString({ lineWidth: 0 }));
}

/** Découpe une table en fichiers contigus selon une étiquette ; refuse un découpage qui changerait l'ordre. */
function split<T>(entries: [string, T][], label: (id: string, v: T) => string): Map<string, [string, T][]> {
  const out = new Map<string, [string, T][]>();
  let last = '';
  for (const [id, v] of entries) {
    const l = label(id, v);
    if (l !== last && out.has(l)) throw new Error(`découpage non contigu : ${l} (${id})`);
    last = l;
    out.set(l, [...(out.get(l) ?? []), [id, v]]);
  }
  return out;
}

const files: Record<string, string[]> = {};
const C = plain(P.C);

// --- paramètres
write(
  'params.yaml',
  {
    engine: C.params,
    eco: plain(P.ECO),
    gauges: { mult: P.GAUGE_MULT },
    items: {
      boost: P.ITEM_BOOST,
      tierBudget: P.TIER_BUDGET,
      tierNStats: P.TIER_NSTATS,
      tierLevel: P.TIER_LEVEL,
      statCost: Object.fromEntries(Object.entries<any>(P.STAT_COST).map(([k, v]) => [k, takeTexts(v, `stat.${k}`, ['label'])])),
    },
    recipes: {
      craftConsumables: P.CRAFT_CONSUMABLES,
      consumableTags: P.CONSUMABLE_TAGS,
      consumableValueMult: P.CONSUMABLE_VALUE_MULT,
      recruitValue: P.RECRUIT_VALUE,
    },
    rares: { chance: P.RARE_CHANCE, minWins: P.RARE_MIN_WINS },
  },
  'Paramètres du moteur (engine), de l’économie (eco) et des générateurs.',
);
write('damage-types.yaml', { types: P.DMG_TYPES }, 'Types de dégâts, dans l’ordre du moteur.');
write(
  'weapons.yaml',
  Object.fromEntries(Object.entries<any>(C.weapons).map(([id, w]) => [id, takeTexts(w, `weapon.${id}`, ['name'])])),
  'Armes naturelles (sans équipement). Noms : texts/fr.yaml.',
);

// --- capacités : celles du moteur d'origine, puis les sorts ajoutés
const baseSkills = new Set(Object.keys(P.DEFAULT_SKILLS));
for (const [file, list] of split(Object.entries<any>(C.skills), (id) => (baseSkills.has(id) ? 'base' : 'sorts'))) {
  write(
    `skills/${file}.yaml`,
    Object.fromEntries(list.map(([id, s]) => [id, takeTexts(s, `skill.${id}`, ['name', 'desc'])])),
    file === 'base' ? 'Capacités du moteur d’origine (codées dans engine.ts ou décrites par fx).' : 'Sorts ajoutés (effets génériques fx).',
  );
  (files.skills ??= []).push(`skills/${file}.yaml`);
}

// --- troupes et monstres
const strategies: Record<string, unknown> = {};
const troopEntry = (id: string, t: any): any => {
  strategies[id] = t.rules;
  const { rules: _rules, ...rest } = takeTexts(t, `troop.${id}`, ['name', 'role']);
  rest.forms = t.forms.map((f: any) => takeTexts(f, `troop.${id}.forms.${f.id}`, ['name']));
  return rest;
};
const REGION_FILE = P.REGIONS.map((R: any, i: number) => `r${i + 1}-${R.id}`);
const troopGroups = split(Object.entries<any>(C.troops), (id) => {
  const m = P.MONSTERS[id];
  if (!m) return 'troops/recrutables';
  return m.rare ? 'monsters/rares' : `monsters/${REGION_FILE[m.region]}`;
});
for (const [file, list] of troopGroups) {
  const isMonster = file.startsWith('monsters/');
  const data = Object.fromEntries(
    list.map(([id, t]) => {
      const e = troopEntry(id, t);
      if (!isMonster) return [id, P.TROOP_SLOTS[id] ? { ...e, slots: P.TROOP_SLOTS[id] } : e];
      const m = P.MONSTERS[id];
      return [id, { ...e, drops: m.drops, boss: m.boss, region: m.region, ...(m.rare ? { rare: m.rare } : {}) }];
    }),
  );
  write(
    `${file}.yaml`,
    data,
    isMonster
      ? 'Monstres : définition de troupe, butin (drops), gardien (boss), région.'
      : 'Troupes recrutables et leurs emplacements d’équipement.',
  );
  (files.troops ??= []).push(`${file}.yaml`);
}
const slotTypes = Object.keys(P.TROOP_SLOTS).filter((t) => !(t in C.troops) || P.MONSTERS[t]);
if (slotTypes.length) throw new Error(`emplacements hors des troupes recrutables : ${slotTypes.join(', ')}`);
write(
  'strategies.yaml',
  strategies,
  'Stratégies par défaut : règles si/alors de chaque troupe, dans l’ordre (le joueur ne les édite pas).',
);

// --- objets et bases d'équipement
const ITEM_FILE: Record<string, string> = {
  materiau: 'materials',
  composant: 'components',
  consommable: 'consumables',
  trophee: 'trophies',
};
for (const [file, list] of split(Object.entries<any>(plain(P.ITEMS)), (_id, i) => `items/${ITEM_FILE[i.kind]}`)) {
  write(
    `${file}.yaml`,
    Object.fromEntries(
      list.map(([id, i]) => {
        const { id: _x, ...rest } = takeTexts(i, `item.${id}`, ['name', 'desc']);
        return [id, rest];
      }),
    ),
    'Objets non équipables. Noms et descriptions : texts/fr.yaml.',
  );
  (files.items ??= []).push(`${file}.yaml`);
}
const SLOT_FILE: Record<string, string> = { arme: 'armes', armure: 'armures', accessoire: 'accessoires' };
for (const [file, list] of split(
  Object.entries<any>(plain(P.EQUIP)),
  (_id, b) => `items/bases/${b.craft === false ? 'gardiens' : SLOT_FILE[b.slot]}`,
)) {
  write(
    `${file}.yaml`,
    Object.fromEntries(
      list.map(([id, b]) => {
        const { id: _x, ...rest } = takeTexts(b, `equip.${id}`, ['name']);
        return [id, rest];
      }),
    ),
    file.endsWith('gardiens')
      ? 'Bases réservées au butin des gardiens (non fabricables).'
      : 'Bases d’équipement : pool de stats (poids), arme le cas échéant.',
  );
  (files.equip ??= []).push(`${file}.yaml`);
}

// --- monde
write(
  'world/regions.yaml',
  plain(P.REGIONS).map((R: any) => {
    const r = takeTexts(R, `region.${R.id}`, ['name']);
    r.city = takeTexts(R.city, `region.${R.id}.city`, ['name', 'desc']);
    r.territory = takeTexts(R.territory, `region.${R.id}.territory`, ['name', 'desc']);
    r.territory.steps = R.territory.steps.map((s: any) => takeTexts(s, `region.${R.id}.steps.${s.id}`, ['name', 'desc']));
    return r;
  }),
  'Régions, dans l’ordre du voyage : ville (recrutement, marchand) et territoire (étapes, gardien en dernier).',
);
write(
  'world/rares.yaml',
  plain(P.RARES).map((x: any) => takeTexts(x, `rare.${x.id}`, ['name'])),
  'Monstres rares : un par étape hors gardien.',
);
write('quests.yaml', { givers: P.GIVERS }, 'Quêtes de ville : donneurs par région.');
write('texts/fr.yaml', texts, 'Textes affichés, en français. Clé : <genre>.<id>[.<sous-partie>].<champ>.');
write(
  'pack.yaml',
  { id: 'prototype-0.4', engineVersion: P.ENGINE_VERSION, files },
  'Pack de contenu. files : fichiers de chaque collection, dans l’ordre (l’ordre des entrées compte pour les tirages).',
);
console.log('content/ écrit :', Object.values(files).flat().length + 9, 'fichiers,', Object.keys(texts).length, 'textes');
