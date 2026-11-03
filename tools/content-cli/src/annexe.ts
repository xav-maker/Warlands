/**
 * Annexe de contenu (docs/annexe-contenu.md), générée depuis le pack (guide 4.3). Elle remplace l'outil
 * genere-annexe.ts du prototype, qui n'est pas dans le dépôt : à contenu égal, le texte doit être identique
 * au caractère près (test : tools/content-cli/test/annexe.test.ts).
 */
import { STATE_NAMES } from '@cr/engine';
import type { EquipBase, Form, GenContent, Item, TroopDef } from '@cr/gen';
import type { Rule, Skill } from '@cr/engine';

export interface AnnexeOptions {
  /** D'où vient le contenu, tel qu'écrit dans l'en-tête. */
  source: string;
  /** Date de génération, en toutes lettres. */
  date: string;
}

const RES_ABBR: Record<string, string> = {
  tranchant: 'tranch.',
  contondant: 'cont.',
  maladie: 'mal.',
  psychique: 'psy.',
  feu: 'feu',
  glace: 'glace',
  tenebres: 'tén.',
  sacre: 'sacré',
};
const TARGET_FR: Record<string, string> = {
  nearestEnemy: 'plus proche',
  weakestEnemy: 'plus faible',
  strongestEnemy: 'plus fort',
  randomEnemy: 'au hasard',
  lowestWillEnemy: 'moins volontaire',
  mostWoundedAlly: 'allié le plus blessé',
};
const COMMON_FR: Record<string, string> = { avancer: 'Avancer', reculer: 'Reculer', attendre: 'Attendre', fuir: 'Fuir' };

const row = (cells: (string | number)[]): string => `| ${cells.join(' | ')} |`;
const head = (cols: string[]): string[] => [row(cols), `|${cols.map(() => '---').join('|')}|`];
const ratio = (permille: number): string => String(permille / 1000);
const stats = (s: TroopDef['base']): string => [s.hp, s.will, s.energy, s.mana, s.atk].join('/');
const signed = (v: number): string => (v >= 0 ? `+${v}` : String(v));

export function annexe(c: GenContent & { engineVersion: string }, o: AnnexeOptions): string {
  const skill = (id: string): Skill => c.skills[id]!;
  const sName = (id: string): string => COMMON_FR[id] ?? skill(id).name;
  const tName = (id: string): string => c.troops[id]!.name;
  const thing = (id: string): string => c.items[id]?.name ?? c.equip[id]!.name;
  const stateName = (s: string | undefined): string => STATE_NAMES[s ?? ''] ?? s ?? '';
  const resText = (f: Form): string => {
    const parts = Object.entries(f.res).map(([t, v]) => `${RES_ABBR[t] ?? t} ${signed(v)}`);
    return parts.length ? parts.join(', ') : '—';
  };
  const recruitOf = (id: string): number => c.regions.findIndex((r) => r.city.recruit.includes(id));
  const isMonster = (id: string): boolean => !!c.monsters[id];
  const out: string[] = [];
  const blank = (): void => void out.push('');

  out.push('# Annexe : contenu du prototype « Les Cinq Régions »');
  blank();
  out.push(
    `Généré automatiquement depuis ${o.source} le ${o.date}, moteur \`${c.engineVersion}\`. Valeurs **brutes** du contenu : les multiplicateurs (jauges ×3, bonus d’objet ×2, renfort des monstres par région, +2 niveaux) sont appliqués au calcul, voir le README section 4 et 9.`,
  );
  blank();
  out.push(
    'Notation des stats : PV / volonté / énergie / mana / attaque. Croissance = gain par niveau (arrondi à l’entier inférieur sur le cumul : `base + floor(croissance × (niveau − 1))`). Résistances en %.',
  );
  blank();

  // --- A. Armes
  out.push('## A. Armes naturelles (sans équipement)');
  blank();
  out.push(...head(['id', 'Nom', 'Type', 'Dégâts', 'Vitesse', 'Coût énergie']));
  for (const [id, w] of Object.entries(c.weapons)) out.push(row([id, w.name!, w.type, w.dmg, w.speed, w.cost]));
  blank();

  // --- B. Capacités
  const skills = Object.entries(c.skills);
  out.push(`## B. Capacités (${skills.length})`);
  blank();
  out.push(
    '« Moteur » = effet codé en dur dans `engine.ts` (resolve) ; « fx » = effet décrit par des données (liste d’effets génériques). Portée : ennemi = distance d(A,B), allié = écart de rang. Durée = multiplicateur (‰) de la vitesse de l’unité ou de l’arme. Énergie W = ‰ du coût de l’arme.',
  );
  blank();
  out.push(...head(['id', 'Nom', 'Genre', 'Cible', 'Portée', 'Énergie', 'Mana', 'Durée', 'Type', 'Effet', 'Codage']));
  for (const [id, s] of skills) {
    const energy = s.energyW ? (s.energy ? `${s.energy} + W×${ratio(s.energyW)}` : `W×${ratio(s.energyW)}`) : String(s.energy);
    const dur = `${s.durBase === 'weapon' ? 'arme' : 'unité'} ×${ratio(s.durMult)}`;
    const type = [s.dtype ?? '—', ...(s.attack ? ['attaque'] : []), ...(s.melee ? ['contact'] : [])].join(', ');
    const p = Object.entries(s.p);
    const coding = s.fx
      ? `fx: ${s.fx
          .map((f) =>
            [
              f.k,
              f.k === 'state'
                ? [f.v ? String(f.v) : '', f.s, 'dur', f.dur].filter((x) => x !== '').join(' ')
                : f.v !== undefined
                  ? String(f.v)
                  : '',
              f.k === 'state' ? '' : (f.type ?? ''),
              f.cap ? `cap ${f.cap}` : '',
              f.area ? `@${f.area}` : '',
              f.tag ? `×${ratio(f.tagMult ?? 1000)} ${f.tag}` : '',
              f.ifState ? `si ${f.ifState}` : '',
            ]
              .filter(Boolean)
              .join(' '),
          )
          .join(' ; ')}`
      : `moteur${p.length ? ` {${p.map(([k, v]) => `${k}:${v}`).join(',')}}` : ''}`;
    out.push(
      row([
        id,
        s.name,
        s.kind,
        s.target,
        s.minRange ? `${s.minRange}-${s.range}` : s.range,
        energy,
        s.mana,
        dur,
        type,
        s.desc ?? '',
        coding,
      ]),
    );
  }
  blank();

  // --- C. Troupes recrutables
  const recruits = Object.entries(c.troops).filter(([id]) => !isMonster(id));
  out.push(`## C. Troupes recrutables (${recruits.length})`);
  blank();
  out.push(
    ...head([
      'id',
      'Nom',
      'Ville (niv. d’arrivée)',
      'Unités',
      'Pop.',
      'Étiquettes',
      'Rôle',
      'Arme',
      'Rang',
      'Base',
      'Croissance',
      'Vitesse',
      'Résistances',
      'Capacités (niveau)',
      'Emplacements',
    ]),
  );
  // Dans l'ordre des villes, puis de leur liste de recrutement.
  const byCity = c.regions.flatMap((R) => R.city.recruit.map((id): [string, TroopDef] => [id, c.troops[id]!]));
  for (const [id, t] of byCity) {
    const R = c.regions[recruitOf(id)]!;
    const f0 = t.forms[0]!;
    const slots = Object.entries(c.troopSlots[id] ?? {})
      .map(([slot, cats]) => `${slot}: ${cats.join('/')}`)
      .join(' ; ');
    out.push(
      row([
        id,
        t.name,
        `${R.city.name} (${R.minLevel})`,
        t.units,
        t.pop,
        t.tags.join(', '),
        t.role ?? '',
        t.weapon,
        t.defaultDist,
        stats(t.base),
        stats(t.growth),
        f0.speed,
        resText(f0),
        f0.skills.map(([sk, lvl]) => `${sName(sk)} ${lvl}`).join(', '),
        slots,
      ]),
    );
  }
  blank();
  out.push(
    'Les 10 troupes reprises du banc d’essai (milicien, frondeurs, acolyte, pyromancien, chasseur, berserker, loups, adepte, moine, briseur) ont aussi des formes évoluées dans `content.ts`, mais **le prototype ville ne fait jamais évoluer une troupe** : elle reste dans sa forme de départ, et seules les capacités de cette forme s’apprennent. Formes définies (non jouables ici) :',
  );
  blank();
  for (const [, t] of recruits) {
    if (t.forms.length < 2) continue;
    const forms = t.forms.slice(1).map((f) => {
      const parent = t.forms.find((x) => x.id === f.parent)!;
      const sk = f.skills.map(([s, lvl]) => `${sName(s)} ${lvl}`).join(', ');
      return `${f.name} (niv. ${f.level}, depuis ${parent.name}, PV ×${ratio(f.hpMult ?? 1000)}, vitesse ${f.speed}, ${sk})`;
    });
    out.push(`- **${t.name}** : ${forms.join(' ; ')}`);
  }
  blank();

  // --- D. Monstres
  const monsters = Object.entries(c.troops).filter(([id]) => isMonster(id));
  const nBoss = monsters.filter(([id]) => c.monsters[id]!.boss).length;
  const nRare = monsters.filter(([id]) => c.monsters[id]!.rare).length;
  out.push(`## D. Monstres (${monsters.length}, dont ${nBoss} gardiens et ${nRare} rares)`);
  blank();
  out.push(
    'Les monstres connaissent toutes les capacités de leur forme au niveau où ils sont générés (les 7 de la Forêt des Ronces ont des niveaux d’apprentissage ; les 50 du bestiaire les ont toutes au niveau 1). Les rares sont dérivés d’un modèle (voir README 7.4).',
  );
  blank();
  out.push(
    ...head([
      'id',
      'Nom',
      'Région',
      'Unités',
      'Pop.',
      'Étiquettes',
      'Rôle',
      'Arme',
      'Rang',
      'Base',
      'Croissance',
      'Vitesse',
      'Résistances',
      'Capacités',
      'Butin',
    ]),
  );
  for (const [id, t] of monsters) {
    const m = c.monsters[id]!;
    const f0 = t.forms[0]!;
    out.push(
      row([
        id,
        `${t.name}${m.boss ? ' **(gardien)**' : m.rare ? ' *(rare)*' : ''}`,
        (m.region ?? 0) + 1,
        t.units,
        t.pop,
        t.tags.join(', '),
        t.role ?? '',
        t.weapon,
        t.defaultDist,
        stats(t.base),
        stats(t.growth),
        f0.speed,
        resText(f0),
        f0.skills.map(([sk, lvl]) => (lvl > 1 ? `${sName(sk)} ${lvl}` : sName(sk))).join(', '),
        (m.drops ?? []).map(thing).join(', '),
      ]),
    );
  }
  blank();

  // --- E. Stratégies
  out.push('## E. Stratégies par défaut (règles si/alors, dans l’ordre)');
  blank();
  out.push(
    'Les 10 troupes du banc d’essai et les 7 monstres d’origine ont des règles écrites à la main ; les autres sont générées par `ia.ts` (README 5.6). Une règle dont la capacité n’est pas encore apprise est retirée pour une troupe de joueur (`defaultRules`). Liste au niveau 30 (toutes capacités connues).',
  );
  blank();
  const cond = (r: Rule): string => {
    const v = r.v ?? 0;
    switch (r.cond) {
      case 'always':
        return 'toujours';
      case 'selfEnergyBelow':
        return `én.< ${v}%`;
      case 'selfEnergyAbove':
        return `én.≥ ${v}%`;
      case 'selfHpBelow':
        return `PV< ${v}%`;
      case 'allyHpBelow':
        return `PV allié< ${v}%`;
      case 'selfWillBelow':
        return `vol.< ${v}%`;
      case 'selfManaBelow':
        return `mana< ${v}%`;
      case 'enemiesAtLeast':
        return `ennemis≥ ${v}`;
      case 'enemyInRange':
        return 'ennemi à portée';
      case 'noEnemyInRange':
        return 'aucun ennemi à portée';
      case 'selfHasState':
        return `a ${stateName(r.s)}`;
      case 'selfLacksState':
        return `n'a pas ${stateName(r.s)}`;
      case 'targetHasState':
        return `cible a ${stateName(r.s)}`;
      case 'targetLacksState':
        return `cible n'a pas ${stateName(r.s)}`;
      case 'myDist':
        return `rang ${v}`;
      case 'timeAtLeast':
        return `instant≥ ${v}`;
      default:
        return r.cond;
    }
  };
  const ruleText = (r: Rule): string => {
    const target =
      COMMON_FR[r.action] || skill(r.action).target === 'self' || r.target === 'self' ? '' : ` (${TARGET_FR[r.target] ?? r.target})`;
    return `${cond(r)} → ${sName(r.action)}${target}`;
  };
  for (const [id, t] of [...byCity, ...monsters]) {
    if (c.monsters[id]?.rare) continue;
    out.push(`- **${t.name}** (\`${id}\`, attaque de base : ${sName(t.forms[0]!.skills[0]![0])}) : ${t.rules.map(ruleText).join(' · ')}`);
  }
  blank();
  out.push('Les rares reprennent les règles de leur modèle.');
  blank();

  // --- F. Objets
  out.push('## F. Objets non équipables');
  blank();
  out.push(...head(['id', 'Nom', 'Genre', 'Palier', 'Valeur (or)', 'Étiquettes', 'Effet / note']));
  const effect = (i: Item & { effect?: Record<string, number>; desc?: string }): string => {
    const parts = Object.entries(i.effect ?? {}).map(([k, v]) => `${k === 'hp' ? 'PV' : k} +${v} %`);
    return parts.length ? `${i.desc ?? ''} (${parts.join(', ')})` : (i.desc ?? '');
  };
  for (const [id, i] of Object.entries(c.items))
    out.push(row([id, i.name, i.kind, i.tier, i.value, i.tags.length ? i.tags.join(', ') : '—', effect(i)]));
  blank();

  // --- G. Bases d'équipement
  const bases = Object.entries(c.equip);
  const tiers = Object.keys(c.tierBudget);
  out.push(`## G. Bases d’équipement (${bases.length})`);
  blank();
  out.push(
    `Budget par palier : ${tiers.map((t) => `p${t} ${c.tierBudget[Number(t)]}`).join(', ')} points ; nombre de stats : ${tiers.map((t) => `p${t} ${c.tierNStats[Number(t)]}`).join(', ')} ; niveau requis : ${tiers.map((t) => `p${t} ${c.tierLevel[Number(t)]}`).join(', ')}.`,
  );
  out.push(
    `Coût d’un point de budget : ${Object.values(c.statCost)
      .map((s) => `${s.label} ${s.per} par point`)
      .join(', ')}.`,
  );
  blank();
  out.push(
    ...head([
      'id',
      'Nom',
      'Palier',
      'Emplacement',
      'Catégorie',
      'Valeur',
      'Arme (type dégâts/vitesse/coût)',
      'Pool de stats (poids)',
      'Nb stats',
      'Craft',
    ]),
  );
  for (const [id, b] of bases as [string, EquipBase & { workshop?: boolean }][]) {
    const w = b.weapon ? `${b.weapon.type} ${b.weapon.dmg}/${b.weapon.speed}/${b.weapon.cost}` : '—';
    const pool = b.pool.map(([k, wt, ty]) => `${ty ? `${k}:${ty}` : k} ${wt}`).join(', ');
    const craft = b.craft === false ? 'non (butin de gardien)' : b.workshop ? `atelier de ${c.regions[b.tier - 1]!.city.name}` : 'partout';
    out.push(row([id, b.name, b.tier, b.slot, b.cat, b.value, w, pool, b.nStats ?? c.tierNStats[b.tier]!, craft]));
  }
  blank();

  // --- H. Régions
  out.push('## H. Régions, villes, étapes');
  blank();
  c.regions.forEach((R, ri) => {
    const city = R.city as typeof R.city & { desc?: string };
    const terr = R.territory as typeof R.territory & { desc?: string };
    out.push(`### ${ri + 1}. ${R.name} : ${city.name} / ${terr.name}`);
    blank();
    out.push(`Palier ${R.tier}, niveau minimal ${R.minLevel}. Ville : ${city.desc ?? ''}`);
    out.push(`Recrutement : ${city.recruit.map(tName).join(', ')}.`);
    out.push(`Marchand : ${city.shop.map(thing).join(', ')}.`);
    out.push(
      `Objet de première victoire sur le gardien : ${thing(R.firstItem)}. Butin réservé au gardien : ${thing(R.guardianLoot)}. Renfort des monstres : PV ×${ratio(c.eco.monsterHp[ri]!)}, attaque et dégâts d’arme ×${ratio(c.eco.monsterAtk[ri]!)}, gardien ×${ratio(c.eco.guardianAdj[ri]!)} en plus.`,
    );
    out.push(`Territoire : ${terr.desc ?? ''}`);
    blank();
    out.push(
      ...head([
        '#',
        'Étape',
        'Niveaux (bonus +2 inclus)',
        'Pop.',
        'Pool de monstres',
        'Imposé',
        'Tirages de butin',
        'Or de base',
        'Matériaux d’étape',
        'Rare',
      ]),
    );
    terr.steps.forEach((s, si) => {
      const rare = c.rares.find((x) => x.step === s.id);
      out.push(
        row([
          si + 1,
          `${s.name} (\`${s.id}\`)`,
          `${s.level[0]}-${s.level[1]}`,
          `${s.pop[0]}-${s.pop[1]}`,
          s.pool.map(tName).join(', '),
          s.forced?.length ? s.forced.map(tName).join(', ') : '—',
          `${s.draws[0]}-${s.draws[1]}${s.guardian ? ' + 1 garanti' : ''}`,
          s.gold,
          s.mats.map(thing).join(', '),
          rare ? `${rare.name} (modèle ${tName(rare.base)}, trophée ${thing(rare.trophy)})` : '—',
        ]),
      );
    });
    blank();
  });
  return out.join('\n') + '\n';
}
