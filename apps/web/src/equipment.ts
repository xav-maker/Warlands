/**
 * Page « Équipement » : pour chaque emplacement d'une unité, ce qu'elle porte, ce qu'on pourrait lui mettre (sac et
 * banque) et, pour chaque candidat, ce que ça change aux statistiques du combat (mêmes calculs que la fiche de stats).
 */
import { canWear } from '@cr/gen';
import type { GenContent, PlayerUnit } from '@cr/gen';
import { sheet } from './stat-sheet.ts';
import type { Sheet } from './stat-sheet.ts';

type Instance = NonNullable<PlayerUnit['equip'][string]>;
type Stat = Instance['stats'][number];

/** Un objet du sac ou de la banque. */
export interface PoolItem {
  id: number;
  base: string;
  roll: number;
  stats: Stat[];
  from: string;
}

export interface Delta {
  label: string;
  diff: number;
  /** Une hausse (ou, pour la vitesse et les coûts, une baisse) est un progrès. */
  good: boolean;
  unit: string;
}

export interface Candidate extends PoolItem {
  /** Palier et catégorie de l'objet. */
  tier: number;
  cat: string;
  /** Raison pour laquelle il n'est pas portable maintenant (niveau requis), sinon absente. */
  locked?: string;
  /** Écarts de statistiques si on l'équipait à la place de l'objet porté. */
  deltas: Delta[];
  /** Arme qui remplacerait l'arme actuelle, quand elle change. */
  weapon: string | null;
}

export interface SlotView {
  slot: string;
  cats: string[];
  current: (Instance & { tier: number; cat: string }) | null;
  candidates: Candidate[];
  locked: Candidate[];
}

/** Écarts de statistiques entre deux fiches (positifs si `to` est plus haut), sans les lignes qui ne bougent pas. */
export function deltas(from: Sheet, to: Sheet): Delta[] {
  const out: Delta[] = [];
  const push = (a: number, b: number, label: string, unit: string, lowerBetter: boolean | undefined): void => {
    const diff = Math.round((b - a) * 10) / 10;
    if (diff) out.push({ label, diff, good: lowerBetter ? diff < 0 : diff > 0, unit });
  };
  to.lines.forEach((l, i) => push(from.lines[i]!.total, l.total, l.label, '', l.lowerBetter));
  const labels = new Set([...from.res, ...to.res].map((r) => r.label));
  for (const label of labels)
    push(from.res.find((r) => r.label === label)?.total ?? 0, to.res.find((r) => r.label === label)?.total ?? 0, label, ' %', false);
  return out;
}

/** Les emplacements d'une unité avec leurs candidats, du plus intéressant (palier, qualité) au moins intéressant. */
export function slotViews(
  c: GenContent,
  troop: { type: string; form: string; level: number },
  unit: { equip: PlayerUnit['equip'] },
  pool: PoolItem[],
): SlotView[] {
  const opts = { type: troop.type, form: troop.form, level: troop.level };
  const now = sheet(c, { ...opts, equip: unit.equip });
  const slots = c.troopSlots[troop.type] ?? {};
  return Object.entries(slots).map(([slot, cats]) => {
    const cur = unit.equip[slot];
    const candidates: Candidate[] = [];
    const locked: Candidate[] = [];
    for (const o of pool) {
      const def = c.equip[o.base];
      if (!def || def.slot !== slot || !cats.includes(def.cat)) continue;
      const reason = canWear(c, troop.type, troop.level, o.base);
      const after = sheet(c, {
        ...opts,
        equip: { ...unit.equip, [slot]: { uid: String(o.id), base: o.base, roll: o.roll, stats: o.stats } },
      });
      const weapon =
        after.weapon.name !== now.weapon.name || after.weapon.type !== now.weapon.type
          ? `${after.weapon.name} (${after.weapon.type})`
          : null;
      const cand: Candidate = {
        ...o,
        tier: def.tier,
        cat: def.cat,
        deltas: deltas(now, after),
        weapon,
        ...(reason ? { locked: reason } : {}),
      };
      (reason ? locked : candidates).push(cand);
    }
    const order = (a: Candidate, b: Candidate): number => b.tier - a.tier || b.roll - a.roll;
    const def = cur ? c.equip[cur.base] : undefined;
    return {
      slot,
      cats,
      current: cur ? { ...cur, tier: def?.tier ?? 0, cat: def?.cat ?? '' } : null,
      candidates: candidates.sort(order),
      locked: locked.sort(order),
    };
  });
}
