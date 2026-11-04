/**
 * Simulation d'équilibrage (guide 5.3) : N combats par étape de chaque route, gardiens compris, contre
 * l'escouade de référence du palier de la route (balance/squads.yaml). Les rencontres sont tirées comme en
 * ligne (population × popMult, emplacements), le combat joué par le moteur de la version en ligne.
 * Rapport : taux de victoire, durée moyenne, unités perdues, or de l'étape et XP de base par combat.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import YAML from 'yaml';
import { simuler } from '@cr/engine';
import { battleUnits, bestForm, computeStats, genMonsters, routes, stepSpec } from '@cr/gen';
import type { GenContent, PlayerTroop } from '@cr/gen';

export interface Squad {
  /** Écart de niveau avec le niveau le plus haut des monstres de l'étape (0 : même niveau). */
  offset: number;
  troops: [string, number][];
}
export interface StepReport {
  route: string;
  routeName: string;
  tier: number;
  step: number;
  stepName: string;
  guardian: boolean;
  level: [number, number];
  fights: number;
  winRate: number;
  avgTime: number;
  avgLosses: number;
  gold: number;
  xp: number;
}

export const loadSquads = (file: string): Record<string, Squad> => YAML.parse(readFileSync(file, 'utf8')) as Record<string, Squad>;
export const SQUADS_FILE = join(import.meta.dirname, '../balance/squads.yaml');

/** Escouade de joueur à pleine santé, meilleure forme du niveau, sans équipement. */
export function squadOf(c: GenContent, s: Squad, level: number): PlayerTroop[] {
  const o = c.online!;
  let units = 0;
  let pop = 0;
  const out = s.troops.map(([type, rank]): PlayerTroop => {
    const t = c.troops[type];
    if (!t) throw new Error(`escouade : troupe inconnue ${type}`);
    units += t.units;
    pop += t.pop;
    const form = bestForm(t, level);
    const st = computeStats(c, t, form, level);
    return {
      type,
      level: level,
      form,
      rank,
      units: Array.from({ length: t.units }, () => ({ hp: st.hpMax, mana: st.manaMax, equip: {} })),
    };
  });
  if (units > o.squad.maxUnits || pop > o.squad.maxPop)
    throw new Error(
      `escouade de niveau ${level} : ${units} unités et ${pop} de population (au plus ${o.squad.maxUnits} et ${o.squad.maxPop})`,
    );
  return out;
}

export function simulate(c: GenContent, squads: Record<string, Squad>, fights = 20): StepReport[] {
  const o = c.online!;
  const eco = c.eco as unknown as { xpPerMonsterLevelPop: number };
  const scale = (v: number): number => Math.max(1, Math.round(v * o.encounters.popMult));
  const out: StepReport[] = [];
  for (const R of routes(c)) {
    const sq = squads[String(R.tier)]!;
    R.steps.forEach((st, si) => {
      const squad = squadOf(c, sq, Math.min(30, Math.max(1, st.level[1] + sq.offset)));
      const spec = stepSpec(st);
      let wins = 0;
      let time = 0;
      let losses = 0;
      let xp = 0;
      for (let k = 0; k < fights; k++) {
        const seed = (si + 1) * 7919 + k * 104729 + R.id.length;
        const side = genMonsters(c, { ...spec, pop: [scale(spec.pop[0]), scale(spec.pop[1])], slots: o.encounters.slots }, seed);
        const units = battleUnits(c, squad, side, { territory: R.tier - 1, guardianStep: !!st.guardian, guardianAdjust: o.guardianAdjust });
        const res = simuler({ engineVersion: o.engineVersion, params: c.params, skills: c.skills, units }, seed).result;
        if (res.winner === 0) wins++;
        time += res.time;
        losses += res.units.filter((u, i) => units[i]!.side === 0 && u.dead).length;
        xp += side.troops.reduce((a, t) => a + t.level * c.troops[t.type]!.pop * eco.xpPerMonsterLevelPop, 0);
      }
      out.push({
        route: R.id,
        routeName: R.name,
        tier: R.tier,
        step: si + 1,
        stepName: st.name,
        guardian: !!st.guardian,
        level: st.level,
        fights,
        winRate: wins / fights,
        avgTime: Math.round(time / fights),
        avgLosses: Math.round((losses / fights) * 10) / 10,
        gold: st.gold,
        xp: Math.round(xp / fights),
      });
    });
  }
  return out;
}

const pct = (x: number): string => `${Math.round(x * 100)} %`;

/** Rapport Markdown : une table par palier, puis les étapes hors de la fourchette visée. */
export function report(rows: StepReport[], squads: Record<string, Squad>, target = { min: 0.5, guardianMin: 0.3 }): string {
  const lines: string[] = ['# Simulation d’équilibrage', ''];
  for (const tier of [...new Set(rows.map((r) => r.tier))].sort()) {
    const s = squads[String(tier)]!;
    lines.push(
      `## Palier ${tier} — escouade au niveau des monstres${s.offset ? ` ${s.offset > 0 ? '+' : ''}${s.offset}` : ''} : ${s.troops.map(([t]) => t).join(', ')}`,
      '',
    );
    lines.push('| Route | Étape | Niveaux | Victoires | Durée | Pertes | Or | XP |', '|---|---|---|---|---|---|---|---|');
    for (const r of rows.filter((x) => x.tier === tier))
      lines.push(
        `| ${r.routeName} | ${r.step}. ${r.stepName}${r.guardian ? ' (gardien)' : ''} | ${r.level[0]}-${r.level[1]} | ${pct(r.winRate)} | ${r.avgTime} | ${r.avgLosses} | ${r.gold} | ${r.xp} |`,
      );
    const all = rows.filter((x) => x.tier === tier);
    lines.push('', `Victoires sur le palier : ${pct(all.reduce((a, r) => a + r.winRate, 0) / all.length)}.`, '');
  }
  const off = rows.filter((r) => r.winRate < (r.guardian ? target.guardianMin : target.min));
  lines.push('## Hors de la fourchette visée', '');
  lines.push(
    off.length
      ? off.map((r) => `- ${r.routeName}, étape ${r.step}${r.guardian ? ' (gardien)' : ''} : ${pct(r.winRate)} de victoires`).join('\n')
      : 'Aucune étape.',
  );
  return lines.join('\n') + '\n';
}
