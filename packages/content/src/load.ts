/**
 * Chargement de content/ : lecture des fichiers YAML, contrôle de chaque fichier par son schéma.
 * Les données gardées sont celles du YAML tel quel (pas la sortie de Zod, qui réordonnerait les clés) :
 * l'ordre des entrées fait partie du contenu.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import YAML from 'yaml';
import type { z } from 'zod';
import { COLLECTION, FIXED } from './schema.ts';
import type { EquipBaseT, ItemT, PackFileT, ParamsT, RareT, RegionT, RuleT, SkillT, TroopT } from './schema.ts';

export interface Issue {
  level: 'error' | 'warning';
  where: string;
  message: string;
}

export interface RawContent {
  pack: PackFileT;
  params: ParamsT;
  damageTypes: string[];
  weapons: Record<string, { type: string; dmg: number; speed: number; cost: number }>;
  strategies: Record<string, RuleT[]>;
  regions: RegionT[];
  rares: RareT[];
  givers: string[][];
  texts: Record<string, string>;
  skills: Record<string, SkillT>;
  troops: Record<string, TroopT>;
  items: Record<string, ItemT>;
  equip: Record<string, EquipBaseT>;
  /** Fichier d'origine de chaque entrée de collection, pour les messages. */
  origin: Record<string, string>;
}

function parse(dir: string, rel: string, issues: Issue[]): unknown {
  try {
    const doc = YAML.parseDocument(readFileSync(join(dir, rel), 'utf8'), { uniqueKeys: true });
    for (const e of doc.errors) issues.push({ level: 'error', where: rel, message: e.message });
    return doc.toJS();
  } catch (e) {
    issues.push({ level: 'error', where: rel, message: (e as Error).message });
    return undefined;
  }
}

function check(schema: z.ZodType, data: unknown, rel: string, issues: Issue[]): boolean {
  const r = schema.safeParse(data);
  if (r.success) return true;
  for (const i of r.error.issues) issues.push({ level: 'error', where: `${rel} › ${i.path.join('.') || '(racine)'}`, message: i.message });
  return false;
}

/** Lit et contrôle content/. Les erreurs sont rendues, jamais levées : le validateur les affiche toutes. */
export function loadContent(dir: string): { raw: RawContent | null; issues: Issue[] } {
  const issues: Issue[] = [];
  const fixed: Record<string, unknown> = {};
  for (const [rel, schema] of Object.entries(FIXED)) {
    const data = parse(dir, rel, issues);
    if (data !== undefined && check(schema, data, rel, issues)) fixed[rel] = data;
  }
  const pack = fixed['pack.yaml'] as PackFileT | undefined;
  const collections: Record<string, Record<string, unknown>> = { skills: {}, troops: {}, items: {}, equip: {} };
  const origin: Record<string, string> = {};
  if (pack)
    for (const [name, list] of Object.entries(pack.files) as [keyof typeof COLLECTION, string[]][])
      for (const rel of list) {
        const data = parse(dir, rel, issues);
        if (data === undefined || !check(COLLECTION[name], data, rel, issues)) continue;
        for (const [key, v] of Object.entries(data as Record<string, unknown>)) {
          const where = `${name}.${key}`;
          if (where in origin) issues.push({ level: 'error', where: rel, message: `${key} déjà défini dans ${origin[where]}` });
          origin[where] = rel;
          collections[name]![key] = v;
        }
      }
  if (issues.some((i) => i.level === 'error')) return { raw: null, issues };
  return {
    raw: {
      pack: pack!,
      params: fixed['params.yaml'] as ParamsT,
      damageTypes: (fixed['damage-types.yaml'] as { types: string[] }).types,
      weapons: fixed['weapons.yaml'] as RawContent['weapons'],
      strategies: fixed['strategies.yaml'] as RawContent['strategies'],
      regions: fixed['world/regions.yaml'] as RegionT[],
      rares: fixed['world/rares.yaml'] as RareT[],
      givers: (fixed['quests.yaml'] as { givers: string[][] }).givers,
      texts: fixed['texts/fr.yaml'] as Record<string, string>,
      skills: collections.skills as RawContent['skills'],
      troops: collections.troops as RawContent['troops'],
      items: collections.items as RawContent['items'],
      equip: collections.equip as RawContent['equip'],
      origin,
    },
    issues,
  };
}
