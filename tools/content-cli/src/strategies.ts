/**
 * Stratégies par défaut (prototype ia.ts, README 5.6 et 20.1) : règles si / alors tirées des capacités d'une
 * troupe, par famille (`ai`). Sert à écrire strategies.yaml pour les types nouveaux, règles relues ensuite.
 * Même ordre de priorité que le prototype : énergie, volonté, soins, soutiens, finisseurs, affaiblissements,
 * contrôles, zones, attaques, attaque de base, puis avancer ou attendre.
 */
import type { Rule, Skill } from '@cr/engine';

interface AiInfo {
  ai: string;
  s?: string;
  ifState?: string;
  self?: boolean;
}

/** Capacités codées en dur du prototype, sans champ `ai` (prototype ia.ts, OLD_AI). */
const OLD_AI: Record<string, AiInfo> = {
  emploi: { ai: 'basic' },
  tir_fronde: { ai: 'basic' },
  tir_arc: { ai: 'basic' },
  morsure: { ai: 'basic' },
  exploit: { ai: 'attack' },
  meditation: { ai: 'will' },
  repos: { ai: 'energy' },
  hurlement: { ai: 'will' },
  coup_bouclier: { ai: 'control', s: 'etourdi' },
  repousser: { ai: 'control' },
  provocation: { ai: 'buffSelf', s: 'provocation' },
  mur_boucliers: { ai: 'groupHeal' },
  execution: { ai: 'finisher' },
  fracas: { ai: 'attack', ifState: 'gele' },
  brise_armure: { ai: 'debuff', s: 'brise' },
  charge: { ai: 'attack' },
  tir_precis: { ai: 'attack' },
  volee: { ai: 'aoe' },
  marque: { ai: 'debuff', s: 'marque' },
  soin_mineur: { ai: 'heal' },
  regeneration: { ai: 'buffAlly', s: 'regeneration' },
  priere: { ai: 'groupHeal' },
  trait_sacre: { ai: 'attack' },
  bouclier_foi: { ai: 'buffAlly', s: 'bouclier' },
  confusion: { ai: 'debuff', s: 'confusion' },
  confusion_moine: { ai: 'debuff', s: 'confusion' },
  trait_flammes: { ai: 'attack' },
  boule_feu: { ai: 'debuff', s: 'brulure' },
  arme_enflammee: { ai: 'buffAlly', s: 'arme_feu' },
  mur_flammes: { ai: 'aoe' },
  lame_saignante: { ai: 'debuff', s: 'saignement' },
  cri_guerre: { ai: 'buffSelf', s: 'cri' },
  tourbillon: { ai: 'aoe', self: true },
  seisme: { ai: 'aoe', self: true },
  drain: { ai: 'attack' },
  murmure: { ai: 'control' },
  terreur_masse: { ai: 'aoe' },
  malediction: { ai: 'debuff', s: 'malediction' },
  nuage: { ai: 'debuff', s: 'poison' },
  lien_vital: { ai: 'debuff', s: 'lien' },
  hate: { ai: 'buffSelf', s: 'hate' },
  paume_vide: { ai: 'debuff', s: 'confusion' },
  fleche_givre: { ai: 'control', s: 'gele' },
  grappin: { ai: 'control' },
};

function info(id: string, sk: Skill): AiInfo {
  if (OLD_AI[id]) return OLD_AI[id];
  const st = sk.fx?.find((f) => f.k === 'state' && f.s);
  const ifState = sk.fx?.find((f) => f.ifState)?.ifState;
  return { ai: sk.ai ?? 'attack', ...(st?.s ? { s: st.s } : {}), ...(ifState ? { ifState } : {}), self: sk.target === 'self' };
}

const R = (action: string, target: string, cond = 'always', v?: number, s?: string): Rule => ({
  cond,
  ...(v !== undefined ? { v } : {}),
  ...(s !== undefined ? { s } : {}),
  action,
  target,
});

/** Règles par défaut d'une troupe dont `skills` sont les capacités, attaque de base en premier. */
export function genRules(skills: string[], SK: Record<string, Skill>): Rule[] {
  const rules: Rule[] = [];
  const by = (ai: string): string[] => skills.filter((id) => SK[id] && SK[id].kind === 'active' && info(id, SK[id]).ai === ai);
  const basic = skills[0];
  const ranged = (SK[basic ?? '']?.range ?? 1) >= 3;
  for (const id of by('energy')) rules.push(R(id, 'self', 'selfEnergyBelow', 15));
  for (const id of by('restore')) rules.push(R(id, 'self', 'selfEnergyBelow', 20));
  for (const id of by('will')) rules.push(R(id, 'self', 'selfWillBelow', 45));
  for (const id of by('groupHeal')) rules.push(R(id, 'self', 'allyHpBelow', 50));
  for (const id of by('heal')) rules.push(R(id, 'mostWoundedAlly', 'allyHpBelow', 55));
  for (const id of by('buffAlly')) {
    const i = info(id, SK[id]!);
    rules.push(R(id, 'mostWoundedAlly', i.s ? 'targetLacksState' : 'allyHpBelow', i.s ? undefined : 70, i.s));
  }
  for (const id of by('buffGroup')) {
    const i = info(id, SK[id]!);
    rules.push(R(id, 'self', i.s ? 'selfLacksState' : 'always', undefined, i.s));
  }
  for (const id of by('buffSelf')) {
    const i = info(id, SK[id]!);
    rules.push(R(id, 'self', i.s ? 'selfLacksState' : 'always', undefined, i.s));
  }
  for (const id of by('finisher')) rules.push(R(id, 'weakestEnemy'));
  for (const id of by('debuff')) {
    const i = info(id, SK[id]!);
    rules.push(R(id, 'strongestEnemy', i.s ? 'targetLacksState' : 'always', undefined, i.s));
  }
  for (const id of by('control')) {
    const i = info(id, SK[id]!);
    rules.push(i.s ? R(id, 'nearestEnemy', 'targetLacksState', undefined, i.s) : R(id, 'nearestEnemy', 'selfEnergyAbove', 60));
  }
  for (const id of by('aoe')) rules.push(R(id, info(id, SK[id]!).self ? 'self' : 'nearestEnemy', 'enemiesAtLeast', 3));
  for (const id of by('attack')) {
    const i = info(id, SK[id]!);
    if (i.ifState) rules.push(R(id, 'nearestEnemy', 'targetHasState', undefined, i.ifState));
    else
      rules.push(
        R(
          id,
          (SK[id]!.range ?? 1) >= 3 ? 'weakestEnemy' : 'nearestEnemy',
          SK[id]!.mana > 0 ? 'always' : 'selfEnergyAbove',
          SK[id]!.mana > 0 ? undefined : 40,
        ),
      );
  }
  if (basic) rules.push(R(basic, ranged ? 'weakestEnemy' : 'nearestEnemy'));
  rules.push(ranged || (SK[basic ?? '']?.range ?? 1) >= 2 ? R('attendre', 'self') : R('avancer', 'self', 'noEnemyInRange'));
  if (!ranged) rules.push(R('attendre', 'self'));
  return rules;
}
