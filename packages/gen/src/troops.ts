/** Troupes : formes, capacités apprises, stats, règles par défaut (prototype content.ts, à l'identique). */
import { POWERS, type Powers, type Rule } from '@cr/engine';
import type { Form, GenContent, TroopDef } from './content.ts';

/** Chaîne d'évolution, de la forme de base à `formId`. */
export function formChain(t: TroopDef, formId: string): Form[] {
  const chain: Form[] = [];
  let f: Form | undefined = t.forms.find((x) => x.id === formId) ?? t.forms[0];
  while (f) {
    chain.unshift(f);
    const parent: string | undefined = f.parent;
    f = parent ? t.forms.find((x) => x.id === parent) : void 0;
  }
  return chain;
}

export const formsAvailable = (t: TroopDef, level: number): Form[] => t.forms.filter((f) => f.level <= level);

export function learned(t: TroopDef, formId: string, level: number): string[] {
  const out: string[] = [];
  for (const f of formChain(t, formId)) for (const [id, lvl] of f.skills) if (lvl <= level && !out.includes(id)) out.push(id);
  return out;
}

export const basicAttack = (t: TroopDef): string => t.forms[0]!.skills[0]![0];

/** Plafond de capacités actives d'une troupe (README 20.1). */
export const MAX_ACTIVE = 6;

/**
 * Choix des capacités actives selon la stratégie (`online.activePick: strategy`, README 34) : parmi `known`, l'attaque de
 * base, puis les passifs et réactions (absents des règles), puis les capacités dans l'ordre de leur première règle dans la stratégie
 * par défaut (l'ordre des règles est leur priorité), puis les autres, les plus récentes d'abord. Renvoyées dans l'ordre
 * d'apprentissage. Le choix « les 5 plus récentes » retirait des capacités clés (Soin mineur du Prêtre dès le niveau 13,
 * Repos, Méditation…).
 */
export function pickActive(c: GenContent, t: TroopDef, known: string[]): string[] {
  if (known.length <= MAX_ACTIVE) return known;
  const order: string[] = [];
  const add = (x: string): void => {
    if (known.includes(x) && !order.includes(x)) order.push(x);
  };
  add(basicAttack(t));
  for (const x of known) if (c.skills[x] && c.skills[x].kind !== 'active') add(x);
  for (const r of t.rules) add(r.action);
  for (const x of [...known].reverse()) add(x);
  const keep = new Set(order.slice(0, MAX_ACTIVE));
  return known.filter((x) => keep.has(x));
}

/** Les 6 capacités actives par défaut : l'attaque de base et les 5 plus récentes (prototype), ou selon la stratégie (`pickActive`). */
export function defaultActive(t: TroopDef, formId: string, level: number, c?: GenContent): string[] {
  const all = learned(t, formId, level);
  if (all.length <= 6) return all;
  if (c?.online?.activePick === 'strategy') return pickActive(c, t, all);
  const picked = [all[0]!];
  for (let i = all.length - 1; i > 0 && picked.length < 6; i--) picked.push(all[i]!);
  return all.filter((x) => picked.includes(x));
}

export function bestForm(t: TroopDef, level: number): string {
  const av = formsAvailable(t, level);
  return av[av.length - 1]!.id;
}

export interface TroopStats {
  name: string;
  hpMax: number;
  willMax: number;
  energyMax: number;
  manaMax: number;
  /** Attaque (prototype) ; en v1, la plus forte des puissances (affichage). */
  atk: number;
  /** v1 : les 5 puissances. */
  pow?: Powers;
  speed: number;
  res: Record<string, number>;
  tags: string[];
}

export function computeStats(c: GenContent, t: TroopDef, formId: string, level: number): TroopStats {
  const chain = formChain(t, formId);
  const f = chain[chain.length - 1]!;
  const g2 = (k: keyof TroopDef['base']): number => (t.base[k] ?? 0) + Math.floor((t.growth[k] ?? 0) * (level - 1));
  const b = (k: keyof NonNullable<typeof f.bonus>): number => f.bonus?.[k] ?? 0;
  const pow = t.base.for !== undefined ? (Object.fromEntries(POWERS.map((k) => [k, g2(k) + b(k)])) as Powers) : undefined;
  const hp = Math.floor((g2('hp') * (f.hpMult ?? 1e3)) / 1e3) * c.gaugeMult;
  const res: Record<string, number> = {};
  for (const ty of c.dmgTypes) res[ty] = (f.res[ty] ?? 0) * 10;
  const tags = [...new Set([...t.tags, ...chain.flatMap((x) => x.tags ?? [])])];
  return {
    name: f.name,
    hpMax: hp,
    willMax: g2('will') + b('will'),
    energyMax: Math.floor((g2('energy') + b('energy')) * (c.energyGaugeMult ?? c.gaugeMult)),
    manaMax: t.base.mana || t.growth.mana ? (g2('mana') + b('mana')) * c.gaugeMult : 0,
    atk: pow ? Math.max(...POWERS.map((k) => pow[k])) : g2('atk') + b('atk'),
    ...(pow ? { pow } : {}),
    speed: f.speed,
    res,
    tags,
  };
}

const COMMON = ['avancer', 'reculer', 'attendre', 'fuir'];

/** Règles par défaut, limitées aux capacités apprises (README 16, point 5). */
export function defaultRules(t: TroopDef, formId: string, level: number): Rule[] {
  const known = learned(t, formId, level);
  // Aller-retour JSON comme le prototype : les champs undefined (v, s) disparaissent.
  return JSON.parse(JSON.stringify(t.rules.filter((r) => COMMON.includes(r.action) || known.includes(r.action)))) as Rule[];
}

export interface MonsterTroop {
  type: string;
  level: number;
  form: string;
  active: string[];
  rules: Rule[];
  units: { dist: number; hpPct: number; manaPct: number }[];
}

/** Troupe de monstres à un niveau : meilleure forme accessible, capacités et règles par défaut. */
export function newTroop(c: GenContent, type: string, level = 10): MonsterTroop {
  const t = c.troops[type]!;
  const form = bestForm(t, level);
  return {
    type,
    level,
    form,
    active: defaultActive(t, form, level, c),
    rules: defaultRules(t, form, level),
    units: Array.from({ length: t.units }, () => ({ dist: t.defaultDist, hpPct: 100, manaPct: 100 })),
  };
}

/** Région où la troupe se recrute (-1 : jamais). */
export const recruitRegion = (c: GenContent, type: string): number => c.regions.findIndex((r) => r.city.recruit.includes(type));
