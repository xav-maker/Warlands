/**
 * Fiche de statistiques d'une unité pour les pages (troupe, Codex) : mêmes calculs que le combat
 * (computeStats et unitStats de @cr/gen), présentés ligne par ligne avec base, équipement et gain au niveau suivant.
 */
import { POWERS } from '@cr/engine';
import { computeStats, routes, unitStats } from '@cr/gen';
import type { GenContent, PlayerUnit, TroopStats } from '@cr/gen';

/** Types de dégâts en clair (le pack les garde sans accent). */
const DMG_LABEL: Record<string, string> = { tenebres: 'ténèbres', sacre: 'sacré' };
export const dmgLabel = (t: string): string => DMG_LABEL[t] ?? t;

export interface StatLine {
  label: string;
  base: number;
  /** Apport de l'équipement (négatif pour la vitesse et le coût d'une arme, qui baissent). */
  bonus: number;
  total: number;
  /** Gain de la base au niveau suivant ; absent au niveau maximum. */
  next?: number;
  /** Suffixe de l'unité de mesure (« % »). */
  unit?: string;
  hint?: string;
  /** Une valeur plus petite est meilleure (vitesse, coût en énergie). */
  lowerBetter?: boolean;
}

export interface Sheet {
  level: number;
  form: string;
  formName: string;
  lines: StatLine[];
  weapon: { name: string; type: string };
  /** Résistances non nulles (en %), immunités à part. */
  res: StatLine[];
  immune: string[];
  hasBonus: boolean;
  hasNext: boolean;
  /** Renfort de monstre appliqué (index de palier), s'il y en a un. */
  reinforce: number | null;
}

export interface SheetOptions {
  type: string;
  form: string;
  level: number;
  /** Équipement porté : active la colonne « Équipement ». */
  equip?: PlayerUnit['equip'];
  /** Palier (0 à 4) dont le renfort de monstre est appliqué aux PV et à l'attaque. */
  reinforce?: number | undefined;
}

export function sheet(c: GenContent, o: SheetOptions): Sheet {
  const def = c.troops[o.type]!;
  const r = o.reinforce !== undefined && c.eco.monsterHp[o.reinforce] !== undefined ? o.reinforce : null;
  const hpK = r === null ? 1000 : c.eco.monsterHp[r]!;
  const atkK = r === null ? 1000 : c.eco.monsterAtk[r]!;
  const scaleHp = (v: number): number => (r === null ? v : Math.round((v * hpK) / 1000));
  const scaleAtk = (v: number): number => (r === null ? v : Math.round((v * atkK) / 1000));

  /** Statistiques sans équipement à un niveau, avec le renfort de monstre. */
  const baseAt = (level: number): TroopStats & { weapon: { name?: string; type: string; dmg: number; speed: number; cost: number } } => {
    const s = computeStats(c, def, o.form, level);
    const w = c.weapons[def.weapon]!;
    return {
      ...s,
      hpMax: scaleHp(s.hpMax),
      ...(s.pow ? { pow: Object.fromEntries(POWERS.map((k) => [k, scaleAtk(s.pow![k])])) as NonNullable<typeof s.pow> } : {}),
      weapon: { ...w, dmg: scaleAtk(w.dmg) },
    };
  };
  const base = baseAt(o.level);
  const nextBase = o.level < c.eco.maxLevel ? baseAt(o.level + 1) : null;

  // Avec équipement : les calculs du combat, puis le renfort (les monstres n'en portent pas).
  const total =
    o.equip !== undefined
      ? unitStats(c, { type: o.type, level: o.level, form: o.form, rank: 1, units: [] }, { hp: 0, mana: 0, equip: o.equip })
      : base;

  const label = (k: string, fallback: string): string => c.statCost[k]?.label ?? fallback;
  const line = (l: string, b: number, t: number, n: number | undefined, extra: Partial<StatLine> = {}): StatLine => ({
    label: l,
    base: b,
    bonus: t - b,
    total: t,
    ...(n !== undefined ? { next: n } : {}),
    ...extra,
  });
  const gain = (pick: (s: typeof base) => number): number | undefined => (nextBase ? pick(nextBase) - pick(base) : undefined);

  const lines: StatLine[] = [
    line(
      label('hp', 'PV max'),
      base.hpMax,
      total.hpMax,
      gain((s) => s.hpMax),
    ),
    line(
      label('will', 'Volonté max'),
      base.willMax,
      total.willMax,
      gain((s) => s.willMax),
    ),
    line(
      label('energy', 'Énergie max'),
      base.energyMax,
      total.energyMax,
      gain((s) => s.energyMax),
    ),
  ];
  if (base.manaMax || total.manaMax)
    lines.push(
      line(
        label('mana', 'Mana max'),
        base.manaMax,
        total.manaMax,
        gain((s) => s.manaMax),
      ),
    );
  for (const k of POWERS)
    lines.push(
      line(
        label(k, k),
        base.pow?.[k] ?? 0,
        total.pow?.[k] ?? 0,
        gain((s) => s.pow?.[k] ?? 0),
      ),
    );
  lines.push(line('Vitesse', base.speed, total.speed, undefined, { hint: 'plus petit = plus rapide', lowerBetter: true }));
  lines.push(line(label('wdmg', 'Dégâts de l’arme'), base.weapon.dmg, total.weapon.dmg, undefined));
  lines.push(
    line(label('wspeed', 'Vitesse de l’arme'), base.weapon.speed, total.weapon.speed, undefined, {
      hint: 'plus petit = plus rapide',
      lowerBetter: true,
    }),
  );
  lines.push(line(label('wcost', 'Coût en énergie de l’arme'), base.weapon.cost, total.weapon.cost, undefined, { lowerBetter: true }));

  const res: StatLine[] = [];
  for (const t of c.dmgTypes) {
    const b = (base.res[t] ?? 0) / 10;
    const v = (total.res[t] ?? 0) / 10;
    if (b || v) res.push(line(dmgLabel(t), b, v, undefined, { unit: ' %' }));
  }

  const form = def.forms.find((f) => f.id === o.form) ?? def.forms[0]!;
  return {
    level: o.level,
    form: form.id,
    formName: form.name,
    lines,
    weapon: { name: total.weapon.name ?? def.weapon, type: dmgLabel(total.weapon.type) },
    res,
    immune: (def.immune ?? []).map(dmgLabel),
    hasBonus: o.equip !== undefined,
    hasNext: nextBase !== null,
    reinforce: r,
  };
}

/** Où on rencontre un monstre : palier (0 à 4, celui de la route) et niveaux des étapes, rares et donjons compris. */
function appearances(c: GenContent, id: string): { tier: number; levels: number[] }[] {
  const out: { tier: number; levels: number[] }[] = [];
  const all = routes(c);
  for (const route of all)
    for (const s of route.steps)
      if (s.pool.includes(id) || s.forced?.includes(id)) out.push({ tier: route.tier - 1, levels: [...s.level] });
  const rare = c.rares.find((x) => x.id === id);
  const rareRoute = rare ? all[rare.region] : undefined;
  const rareStep = rareRoute?.steps.find((s) => s.id === rare!.step);
  if (rareRoute && rareStep) out.push({ tier: rareRoute.tier - 1, levels: [...rareStep.level] });
  for (const d of c.dungeons ?? []) {
    const route = d.pool.includes(id) || d.bosses.includes(id) ? all.find((x) => x.id === d.route) : undefined;
    if (route) out.push({ tier: route.tier - 1, levels: [route.minLevel + (c.dungeonParams?.levelBonus ?? 0)] });
  }
  return out;
}

/** Palier (0 à 4) du renfort d'un monstre : celui de la route où il apparaît (le plus bas s'il en a plusieurs). */
export function monsterTier(c: GenContent, id: string): number | undefined {
  const tiers = appearances(c, id).map((a) => a.tier);
  return tiers.length ? Math.min(...tiers) : undefined;
}

/** Niveau auquel on le rencontre d'ordinaire : le milieu des niveaux des étapes qui le comptent, sinon 10. */
export function monsterLevel(c: GenContent, id: string): number {
  const tier = monsterTier(c, id);
  const levels = appearances(c, id)
    .filter((a) => a.tier === tier)
    .flatMap((a) => a.levels);
  if (!levels.length) return 10;
  return Math.max(1, Math.min(c.eco.maxLevel, Math.round(levels.reduce((a, x) => a + x, 0) / levels.length)));
}
