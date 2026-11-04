/**
 * Entrée du moteur pour un combat d'expédition (prototype jeu.ts, buildInput et unitStats).
 * Fonctions pures : l'escouade et la rencontre sont passées en paramètre, rien n'est lu dans un état global.
 */
import { POWERS, type Power, type Powers, type Rule, type UnitInput, type Weapon } from '@cr/engine';
import type { GenContent } from './content.ts';
import type { MonsterGroup } from './encounters.ts';
import type { EquipInstance } from './equip.ts';
import { basicAttack, computeStats, defaultActive, defaultRules, learned } from './troops.ts';
import type { TroopStats } from './troops.ts';

export interface PlayerUnit {
  hp: number;
  mana: number;
  /** Emplacement (arme, armure, accessoire…) → exemplaire porté. */
  equip: Record<string, EquipInstance | null | undefined>;
}

export interface PlayerTroop {
  type: string;
  level: number;
  form: string;
  /** Rang de la troupe (1 à 3) ; le prototype place toutes ses unités au même rang (README 16, point 8). */
  rank: number;
  units: PlayerUnit[];
  /** Capacités désactivées par le joueur (README 20.1) ; l'attaque de base ne l'est jamais. */
  disabled?: string[];
}

/**
 * Capacités actives d'une troupe de joueur : celles par défaut, l'attaque de base toujours comprise.
 * Avec des capacités désactivées (README 20.1) : parmi les capacités connues et non désactivées,
 * l'attaque de base et les 5 plus récemment apprises.
 */
export function troopActive(c: GenContent, t: PlayerTroop): string[] {
  const d = c.troops[t.type]!;
  const base = basicAttack(d);
  if (t.disabled?.length) {
    const off = new Set(t.disabled.filter((x) => x !== base));
    const known = learned(d, t.form, t.level).filter((x) => !off.has(x));
    const rest = known.filter((x) => x !== base);
    return [base, ...rest.slice(-5)].filter((x, i, a) => a.indexOf(x) === i).sort((a, b) => known.indexOf(a) - known.indexOf(b));
  }
  const act = defaultActive(d, t.form, t.level);
  return act.includes(base) ? act : [base, ...act.slice(0, 5)];
}

export const troopRules = (c: GenContent, t: PlayerTroop): Rule[] => defaultRules(c.troops[t.type]!, t.form, t.level);

export type UnitStats = TroopStats & { weapon: Weapon };

/** Stats d'une unité avec son équipement ; les stats d'exemplaire sont multipliées par itemBoost. */
export function unitStats(c: GenContent, t: PlayerTroop, u: PlayerUnit): UnitStats {
  const def = c.troops[t.type]!;
  const s = computeStats(c, def, t.form, t.level);
  const res = { ...s.res };
  const arme = u.equip.arme;
  const weaponBase: Weapon = arme ? { ...c.equip[arme.base]!.weapon!, name: c.equip[arme.base]!.name } : { ...c.weapons[def.weapon]! };
  const out: UnitStats = { ...s, res, weapon: weaponBase, ...(s.pow ? { pow: { ...s.pow } } : {}) };
  for (const it of Object.values(u.equip)) {
    if (!it) continue;
    for (const st0 of it.stats) {
      const v = st0.v * c.itemBoost;
      switch (st0.k) {
        case 'atk':
          // v1 : l'attaque d'un exemplaire d'avant les puissances compte en Force (README 19.6).
          if (out.pow) out.pow.for += v;
          else out.atk += v;
          break;
        case 'for':
        case 'ele':
        case 'esp':
        case 'foi':
        case 'omb':
          if (out.pow) out.pow[st0.k as Power] += v;
          break;
        case 'hp':
          out.hpMax += v * c.gaugeMult;
          break;
        case 'will':
          out.willMax += v;
          break;
        case 'energy':
          out.energyMax += v * c.gaugeMult;
          break;
        case 'mana':
          out.manaMax += v * c.gaugeMult;
          break;
        case 'res':
          res[st0.type!] = (res[st0.type!] ?? 0) + v * 10;
          break;
        case 'wdmg':
          out.weapon.dmg += v;
          break;
        case 'wspeed':
          out.weapon.speed = Math.max(8, out.weapon.speed - v);
          break;
        case 'wcost':
          out.weapon.cost = Math.max(1, out.weapon.cost - v);
          break;
      }
    }
  }
  return out;
}

export interface BattleOptions {
  /** Région du territoire où se joue le combat (multiplicateurs des monstres). */
  territory: number;
  /** Combat de gardien (dernière étape de la route). */
  guardianStep: boolean;
  /**
   * Portée de l'ajustement du gardien (ECO.guardianAdj) : `all` reproduit le prototype, qui l'applique à toute
   * la rencontre, escorte comprise ; `guardian` (correction du README 16, point 2) au seul gardien.
   */
  guardianAdjust: 'all' | 'guardian';
  /** Réglage fin de l'étape (Step.mult, en ‰) : PV et attaque des monstres en plus du renfort de la région. */
  mult?: number;
}

/** Unités des deux camps, dans l'ordre et avec les identifiants du prototype (A1…, B1…). */
export function battleUnits(c: GenContent, squad: PlayerTroop[], group: MonsterGroup, o: BattleOptions): UnitInput[] {
  const units: UnitInput[] = [];
  let slot = 0;
  squad.forEach((t, ti) => {
    const def = c.troops[t.type]!;
    const skills = troopActive(c, t);
    const rules = troopRules(c, t);
    t.units.forEach((u, ui) => {
      const s = unitStats(c, t, u);
      units.push({
        id: `A${slot + 1}`,
        side: 0,
        slot: slot++,
        troop: `0-${ti}`,
        kind: t.type,
        name: def.units > 1 ? `${s.name} ${ui + 1}` : s.name,
        tags: s.tags,
        hpMax: s.hpMax,
        willMax: s.willMax,
        energyMax: s.energyMax,
        manaMax: s.manaMax,
        ...(s.pow ? { pow: s.pow } : { atk: s.atk }),
        speed: s.speed,
        res: s.res,
        weapon: s.weapon,
        hp: Math.min(u.hp, s.hpMax),
        mana: Math.min(u.mana, s.manaMax),
        dist: t.rank,
        skills,
        rules,
      });
    });
  });
  const r = o.territory;
  const adjOf = (type: string): number =>
    o.guardianStep && (o.guardianAdjust === 'all' || c.monsters[type]?.boss) ? c.eco.guardianAdj[r]! : 1e3;
  slot = 0;
  group.troops.forEach((tr, ti) => {
    const def = c.troops[tr.type]!;
    const s = computeStats(c, def, tr.form, tr.level);
    const adj = adjOf(tr.type);
    const step = o.mult && o.mult !== 1e3 ? o.mult / 1e3 : 1;
    const mHp = (v: number): number => Math.round((v * c.eco.monsterHp[r]! * adj * step) / 1e6);
    const mAtk = (v: number): number => Math.round((v * c.eco.monsterAtk[r]! * adj * step) / 1e6);
    const w = c.weapons[def.weapon]!;
    tr.units.forEach((us, ui) =>
      units.push({
        id: `B${slot + 1}`,
        side: 1,
        slot: slot++,
        troop: `1-${ti}`,
        kind: c.monsters[tr.type]?.rare?.base ?? tr.type,
        name: def.units > 1 ? `${s.name} ${ui + 1}` : s.name,
        tags: s.tags,
        hpMax: mHp(s.hpMax),
        willMax: s.willMax,
        energyMax: s.energyMax,
        manaMax: s.manaMax,
        ...(s.pow ? { pow: Object.fromEntries(POWERS.map((k) => [k, mAtk(s.pow![k])])) as Powers } : { atk: mAtk(s.atk) }),
        ...(def.immune?.length ? { immune: def.immune } : {}),
        speed: s.speed,
        res: s.res,
        weapon: { ...w, dmg: mAtk(w.dmg) },
        hp: mHp(s.hpMax),
        mana: s.manaMax,
        dist: us.dist,
        skills: tr.active,
        rules: tr.rules,
      }),
    );
  });
  return units;
}
