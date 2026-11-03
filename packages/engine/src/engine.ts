/**
 * Moteur de combat proto-0.4-ville, porté depuis prototype-extrait/engine.js (guide 4.1).
 *
 * Portage fidèle : seuls les types sont ajoutés. Les assertions `!` reprennent les accès directs du
 * prototype et ne changent rien à l'exécution. Le comportement est figé par les combats de référence
 * (golden/v0.4) : toute modification qui change un journal exige une nouvelle version du moteur.
 */
import { Rng } from '@cr/rng';
import type { BattleInput, BattleOutput, Fx, LogEvent, Rule, Side, Skill, UnitInput } from './types.ts';

export const ENGINE_VERSION = 'proto-0.4-ville';
export const DMG_TYPES = ['contondant', 'tranchant', 'maladie', 'psychique', 'feu', 'glace', 'tenebres', 'sacre'];

const DOT: Record<string, string> = { saignement: 'tranchant', poison: 'maladie', brulure: 'feu' };

export const STATE_NAMES: Record<string, string> = {
  saignement: 'Saignement',
  poison: 'Poison',
  brulure: 'Brûlure',
  regeneration: 'Régénération',
  hate: 'Hâte',
  ralenti: 'Ralenti',
  etourdi: 'Étourdi',
  gele: 'Gelé',
  bouclier: 'Bouclier',
  marque: 'Marque',
  provocation: 'Provocation',
  confusion: 'Confusion',
  cri: 'Cri de guerre',
  peau: 'Peau de pierre',
  malediction: 'Malédiction',
  brise: 'Brise-armure',
  arme_feu: 'Arme enflammée',
  lien: 'Lien vital',
  affaibli: 'Affaibli',
  garde: 'Garde',
  silence: 'Silence',
  epines: 'Épines',
};

const NEGATIVE = new Set([
  'saignement',
  'poison',
  'brulure',
  'ralenti',
  'etourdi',
  'gele',
  'marque',
  'confusion',
  'malediction',
  'brise',
  'lien',
  'affaibli',
  'silence',
]);

interface State {
  id: string;
  caster: string;
  end: number;
  charges: number;
  v: number;
  v2: number;
  other: string | undefined;
  order: number;
}

function isNegative(s: State): boolean {
  return NEGATIVE.has(s.id) || (s.id === 'peau' && s.v < 0);
}

const COMMON = new Set(['avancer', 'reculer', 'attendre', 'fuir']);

type Gauge = 'hp' | 'will' | 'energy' | 'mana';
type Outcome = 'ok' | 'half' | 'crit';

interface Unit extends UnitInput {
  will: number;
  energy: number;
  nextAt: number;
  alive: boolean;
  fled: boolean;
  states: State[];
  active: Set<string>;
  used: Set<string>;
  attackers: Set<string>;
  pendingRegen: number;
  pendingMana: number;
  extraDelay: number;
  dmgDealt: number;
  kills: number;
  acting: boolean;
}

interface DamageOpts {
  cause?: string | undefined;
  melee?: boolean | undefined;
  tick?: boolean;
  ignoreHalf?: boolean;
  noLink?: boolean;
}

interface StateOpts {
  cap?: number;
  charges?: number;
  v2?: number;
  other?: string;
}

interface Choice {
  i: number;
  id: string;
  target: Unit;
}

export function simuler(input: BattleInput, seed: number): BattleOutput {
  const P = input.params;
  const SK = input.skills;
  const rng2 = new Rng(seed);
  const log: LogEvent[] = [];
  let now = 0;
  let stateOrder = 0;
  let ended: { winner: Side | null; reason: 'wipe' | 'timeout' } | null = null;
  let inReaction = false;
  let lastWound = 0;
  const units: Unit[] = input.units.map((u2) => ({
    ...u2,
    res: { ...u2.res },
    skills: [...u2.skills],
    rules: u2.rules.map((r) => ({ ...r })),
    hp: clamp(u2.hp, 0, u2.hpMax),
    mana: clamp(u2.mana, 0, u2.manaMax),
    dist: clamp(u2.dist, 1, 3),
    will: u2.willMax,
    energy: u2.energyMax,
    nextAt: Math.max(1, u2.speed),
    alive: u2.hp > 0,
    fled: false,
    states: [],
    active: new Set(u2.skills),
    used: new Set(),
    attackers: new Set(),
    pendingRegen: 0,
    pendingMana: 0,
    extraDelay: 0,
    dmgDealt: 0,
    kills: 0,
    acting: false,
  }));
  const byId = new Map(units.map((u2) => [u2.id, u2]));
  const emit = (e: LogEvent): void => {
    if (ended && e.k !== 'end') return;
    e.t = now;
    log.push(e);
  };
  emit({ k: 'start', units: input.units.map((u2) => ({ ...u2, hp: clamp(u2.hp, 0, u2.hpMax), mana: clamp(u2.mana, 0, u2.manaMax) })) });
  const inPlay = (u2: Unit | undefined): u2 is Unit => !!u2 && u2.alive && !u2.fled;
  const ordered = (): Unit[] => units.filter(inPlay).sort(tieOrder);
  function tieOrder(a: Unit, b: Unit): number {
    return a.nextAt - b.nextAt || a.speed - b.speed || a.side - b.side || a.slot - b.slot;
  }
  const enemiesOf = (u2: Unit): Unit[] => units.filter((e) => inPlay(e) && e.side !== u2.side);
  const alliesOf = (u2: Unit): Unit[] => units.filter((e) => inPlay(e) && e.side === u2.side);
  const rank = (u2: Unit): number => {
    const occ = new Set(units.filter((x) => inPlay(x) && x.side === u2.side).map((x) => x.dist));
    occ.add(u2.dist);
    return [...occ].filter((d) => d <= u2.dist).length;
  };
  const dEnemy = (a: Unit, b: Unit): number => rank(a) + rank(b) - 1;
  const dAlly = (a: Unit, b: Unit): number => Math.abs(rank(a) - rank(b));
  const has = (u2: Unit, s3: string): State | undefined => u2.states.find((x) => x.id === s3);
  const passive = (u2: Unit, id: string): boolean => inPlay(u2) && u2.active.has(id) && SK[id]?.kind !== 'active';
  const pct = (v: number, max: number): number => (max > 0 ? Math.floor((v * 1e3) / max) : 0);
  /** Paramètre d'une capacité nommée (accès direct du prototype). */
  const sp = (id: string, k: string): number => SK[id]!.p[k]!;
  function atk(u2: Unit): number {
    let m2 = 1e3;
    const cri = has(u2, 'cri');
    if (cri) m2 += cri.v;
    const aff = has(u2, 'affaibli');
    if (aff) m2 -= aff.v;
    if (passive(u2, 'rage')) m2 += sp('rage', 'atkPer10') * Math.floor(pct(u2.hpMax - u2.hp, u2.hpMax) / 100);
    return Math.max(0, Math.floor((u2.atk * Math.max(0, m2)) / 1e3));
  }
  function res(u2: Unit, t: string): number {
    let r = u2.res[t] || 0;
    for (const s3 of u2.states) {
      if (s3.id === 'malediction' || s3.id === 'garde') r += s3.v;
      if ((s3.id === 'peau' || s3.id === 'brise') && (t === 'contondant' || t === 'tranchant')) r += s3.v * s3.charges;
    }
    return clamp(r, P.resFloor, P.resCap);
  }
  function durMod(u2: Unit, d: number): number {
    const h2 = has(u2, 'hate'),
      s3 = has(u2, 'ralenti');
    if (h2 && !s3) d = Math.floor((d * P.hasteMod) / 1e3);
    if (s3 && !h2) d = Math.floor((d * P.slowMod) / 1e3);
    return Math.max(1, d);
  }
  function setGauge(u2: Unit, g2: Gauge, to: number, cause: string | undefined): void {
    const max = g2 === 'hp' ? u2.hpMax : g2 === 'will' ? u2.willMax : g2 === 'energy' ? u2.energyMax : u2.manaMax;
    let floor = 0;
    if (g2 === 'will' && passive(u2, 'esprit_inebranlable')) floor = Math.floor(u2.willMax / 2);
    to = clamp(to, Math.min(floor, max), max);
    const from = u2[g2];
    if (to === from || ended) return;
    u2[g2] = to;
    emit({ k: 'gauge', u: u2.id, g: g2, from, to, cause });
  }
  const changeWill = (u2: Unit, permille: number, cause: string): void => {
    if (inPlay(u2)) setGauge(u2, 'will', u2.will + Math.trunc((u2.willMax * permille) / 1e3), cause);
  };
  const healCdUntil = new Map<string, number>();
  const healReady = (x: Unit): boolean => !P.healCooldown || (healCdUntil.get(x.id) ?? -1) <= now;
  const hotCdUntil = new Map<string, number>();
  const hotReady = (x: Unit): boolean => !P.hotCooldown || (hotCdUntil.get(x.id) ?? -1) <= now;
  const heal2 = (u2: Unit, amount: number, cause: string, direct = false): void => {
    if (!inPlay(u2)) return;
    if (direct && P.healCooldown) {
      if (!healReady(u2)) {
        emit({ k: 'passive', u: u2.id, name: cause, text: 'soin sans effet : recharge en cours' });
        return;
      }
      healCdUntil.set(u2.id, now + P.healCooldown);
    }
    setGauge(u2, 'hp', u2.hp + Math.max(0, Math.floor((amount * (P.healMult ?? 1e3)) / 1e3)), cause);
  };
  function loseHp(u2: Unit, amount: number, cause: string | undefined, by?: Unit): number {
    if (!inPlay(u2) || amount <= 0) return 0;
    let to = u2.hp - amount;
    if (to <= 0) {
      const guard = alliesOf(u2)
        .sort((a, b) => a.slot - b.slot)
        .find((g2) => g2.dist === u2.dist && passive(g2, 'dernier_rempart') && !g2.used.has('dernier_rempart'));
      if (guard) {
        guard.used.add('dernier_rempart');
        to = 1;
        emit({ k: 'passive', u: guard.id, name: 'Dernier rempart', text: `retient ${u2.name} à 1 PV` });
        changeWill(guard, -sp('dernier_rempart', 'will'), 'Dernier rempart');
      }
    }
    const lost = u2.hp - Math.max(0, to);
    if (lost > 0) lastWound = now;
    setGauge(u2, 'hp', to, cause);
    if (!passive(u2, 'rage')) {
      const wl = Math.floor((lost * u2.willMax * P.woundWill) / (u2.hpMax * 1e3));
      if (wl > 0 && u2.hp > 0) setGauge(u2, 'will', u2.will - wl, 'blessure');
    }
    if (u2.hp <= 0) kill(u2, by);
    return lost;
  }
  function kill(u2: Unit, by: Unit | undefined): void {
    u2.alive = false;
    emit({ k: 'death', u: u2.id, by: by?.id });
    if (by && by.side !== u2.side && inPlay(by)) {
      by.kills++;
      changeWill(by, P.killWill, 'ennemi tué');
    }
    for (const a of alliesOf(u2)) changeWill(a, -(a.troop === u2.troop ? P.sameTroopDeathWill : P.allyDeathWill), `mort de ${u2.name}`);
    const poison = has(u2, 'poison');
    if (poison) {
      const sorcerer = units.find((x) => x.side !== u2.side && passive(x, 'contagion'));
      const next = alliesOf(u2).sort((a, b) => dAlly(a, u2) - dAlly(b, u2) || a.hp - b.hp || a.slot - b.slot)[0];
      if (sorcerer && next) {
        emit({ k: 'passive', u: sorcerer.id, name: 'Contagion', text: `le poison passe sur ${next.name}` });
        addState(next, 'poison', sorcerer, poison.end - now, poison.v, { cap: sp('contagion', 'cap'), charges: poison.charges });
      }
    }
    u2.states = [];
    checkEnd();
  }
  function checkEnd(): void {
    if (ended) return;
    const a = units.some((u2) => u2.side === 0 && inPlay(u2));
    const b = units.some((u2) => u2.side === 1 && inPlay(u2));
    if (!a || !b) {
      ended = { winner: a ? 0 : b ? 1 : null, reason: 'wipe' };
      emit({ k: 'end', winner: ended.winner, reason: 'wipe' });
    }
  }
  const thawUntil = new Map<string, number>();
  function addState(u2: Unit, id: string, caster: Unit, dur: number, v = 0, o: StateOpts = {}): void {
    if (!inPlay(u2) || dur <= 0) return;
    if (id === 'regeneration' && P.hotCooldown) {
      if (!hotReady(u2)) {
        emit({ k: 'passive', u: u2.id, name: STATE_NAMES[id], text: 'sans effet : recharge en cours' });
        return;
      }
      hotCdUntil.set(u2.id, now + P.hotCooldown);
    }
    if (P.dotTick && (DOT[id] || id === 'regeneration')) dur = Math.max(P.dotTick, Math.round((dur * P.dotTick) / P.tick));
    if ((id === 'poison' || id === 'saignement') && passive(u2, 'non_mort')) {
      emit({ k: 'state', u: u2.id, s: id, op: 'immune' });
      return;
    }
    const end = now + dur;
    const cur = has(u2, id);
    if (cur) {
      if (o.cap) cur.charges = Math.min(o.cap, cur.charges + (o.charges ?? 1));
      cur.end = Math.max(cur.end, end);
      cur.v = id === 'bouclier' ? Math.max(cur.v, v) : v;
      if (o.v2 !== void 0) cur.v2 = o.v2;
      cur.caster = caster.id;
      if (o.other) cur.other = o.other;
      emit({ k: 'state', u: u2.id, s: id, op: 'renew', charges: cur.charges, until: cur.end, v: cur.v });
    } else {
      u2.states.push({
        id,
        caster: caster.id,
        end,
        charges: Math.min(o.cap ?? 1, o.charges ?? 1),
        v,
        v2: o.v2 ?? 0,
        other: o.other,
        order: stateOrder++,
      });
      emit({ k: 'state', u: u2.id, s: id, op: 'add', charges: o.charges ?? 1, until: end, v });
    }
  }
  function removeState(u2: Unit, id: string): void {
    const i = u2.states.findIndex((s3) => s3.id === id);
    if (i < 0) return;
    u2.states.splice(i, 1);
    emit({ k: 'state', u: u2.id, s: id, op: 'end' });
  }
  function expireStates(): void {
    for (const u2 of ordered())
      for (const s3 of [...u2.states].sort((a, b) => a.order - b.order)) if (s3.end <= now) removeState(u2, s3.id);
  }
  function stun(u2: Unit, by: Unit, amount: number): void {
    if (!inPlay(u2)) return;
    if (u2.acting) u2.extraDelay += amount;
    else u2.nextAt += amount;
    addState(u2, 'etourdi', by, amount);
  }
  function setDist(u2: Unit, to: number, cause: string): void {
    to = clamp(to, 1, 3);
    if (!inPlay(u2) || to === u2.dist) return;
    const from = u2.dist;
    u2.dist = to;
    emit({ k: 'move', u: u2.id, from, to, cause });
    if (to === 1 && from > 1 && (cause === 'Avancer' || cause === 'Charge' || cause === 'Approche automatique')) {
      for (const trap of enemiesOf(u2))
        if (passive(trap, 'pieges_glace') && !trap.used.has('pieges_glace')) {
          trap.used.add('pieges_glace');
          emit({ k: 'passive', u: trap.id, name: 'Pièges de glace', text: `${u2.name} est ralenti` });
          addState(u2, 'ralenti', trap, sp('pieges_glace', 'dur'));
          break;
        }
    }
  }
  function damage(src: Unit | undefined, t: Unit, raw: number, type: string, o: DamageOpts): number {
    if (!inPlay(t) || ended) return 0;
    raw = Math.max(0, raw);
    if (src && !o.tick && src.side !== t.side) {
      const m2 = has(t, 'marque');
      if (m2) {
        raw = Math.floor((raw * (1e3 + sp('marque', 'bonus'))) / 1e3);
        if (--m2.v <= 0) removeState(t, 'marque');
      }
      if (passive(src, 'instinct_meute') && [...t.attackers].some((id) => id !== src.id && byId.get(id)!.troop === src.troop))
        raw = Math.floor((raw * (1e3 + sp('instinct_meute', 'bonus'))) / 1e3);
      if (type === 'feu' && passive(src, 'coeur_ardent') && has(t, 'brulure'))
        raw = Math.floor((raw * (1e3 + sp('coeur_ardent', 'bonus'))) / 1e3);
      t.attackers.add(src.id);
    }
    let r = res(t, type);
    if (o.ignoreHalf && r > 0) r = Math.floor(r / 2);
    const final = Math.max(1, Math.floor((raw * (1e3 - r)) / 1e3));
    let absorbed = 0;
    const sh = has(t, 'bouclier');
    if (sh) {
      absorbed = Math.min(sh.v, final);
      sh.v -= absorbed;
      if (sh.v <= 0) removeState(t, 'bouclier');
    }
    emit({ k: 'hit', src: src?.id, u: t.id, type, raw, final, absorbed, cause: o.cause });
    const lost = loseHp(t, final - absorbed, o.cause, src);
    if (src && src.side !== t.side) src.dmgDealt += final;
    const link = has(t, 'lien');
    if (link && !o.noLink && lost > 0 && link.other) {
      const other = byId.get(link.other)!;
      const back2 = Math.floor((lost * sp('lien_vital', 'share')) / 1e3);
      if (back2 > 0 && inPlay(other)) {
        emit({ k: 'passive', u: t.id, name: 'Lien vital', text: `${back2} dégâts renvoyés sur ${other.name}` });
        loseHp(other, back2, 'Lien vital', t);
      }
    }
    if (
      o.melee &&
      src &&
      src.side !== t.side &&
      inPlay(t) &&
      inPlay(src) &&
      !inReaction &&
      passive(t, 'riposte') &&
      t.energy >= SK.riposte!.energy &&
      !has(t, 'etourdi') &&
      !has(t, 'gele')
    ) {
      inReaction = true;
      emit({ k: 'passive', u: t.id, name: 'Riposte', text: `contre-attaque ${src.name}` });
      setGauge(t, 'energy', t.energy - SK.riposte!.energy, 'Riposte');
      damage(t, src, weaponRaw(t, sp('riposte', 'mult')), t.weapon.type, { cause: 'Riposte' });
      inReaction = false;
    }
    const th = has(t, 'epines');
    if (th && o.melee && src && src.side !== t.side && inPlay(src) && !inReaction) {
      inReaction = true;
      damage(t, src, th.v, 'tranchant', { cause: 'Épines' });
      inReaction = false;
    }
    return final;
  }
  const weaponRaw = (u2: Unit, mult: number): number => Math.floor((u2.weapon.dmg * mult) / 1e3) + atk(u2);
  function weaponHit(u2: Unit, t: Unit, mult: number, sk: Skill, cause: string, o: DamageOpts = {}): number {
    const type = !sk.dtype || sk.dtype === 'weapon' ? u2.weapon.type : sk.dtype;
    const dealt = damage(u2, t, weaponRaw(u2, mult), type, { cause, melee: sk.melee, ...o });
    const fire = has(u2, 'arme_feu');
    if (fire && inPlay(t)) {
      damage(u2, t, fire.v, 'feu', { cause: 'Arme enflammée' });
      addState(t, 'brulure', u2, sp('arme_enflammee', 'burnDur'), fire.v2);
    }
    return dealt;
  }
  const spellHit = (u2: Unit, t: Unit, base: number, type: string, cause: string, o: DamageOpts = {}): number =>
    damage(u2, t, base + atk(u2), type, { cause, ...o });
  const pick = <T>(list: T[]): T | undefined => (list.length ? list[rng2.int(list.length)] : void 0);
  function selfValid(u2: Unit, id: string): boolean {
    switch (id) {
      case 'avancer':
        return rank(u2) > 1;
      case 'reculer':
        return u2.dist < 3;
      case 'fuir':
        return u2.dist === 3;
      case 'tourbillon':
      case 'repousser_renforce':
        return enemiesOf(u2).some((e) => dEnemy(u2, e) === 1);
      case 'seisme':
        return enemiesOf(u2).some((e) => rank(e) <= 2);
      default:
        return true;
    }
  }
  function candidates(u2: Unit, id: string): Unit[] {
    const sk = COMMON.has(id) ? null : SK[id];
    if (!sk) return selfValid(u2, id) ? [u2] : [];
    if (sk.target === 'self') return selfValid(u2, id) ? [u2] : [];
    if (sk.target === 'ally') return alliesOf(u2).filter((a) => dAlly(u2, a) <= sk.range);
    let list = enemiesOf(u2).filter((e) => dEnemy(u2, e) <= sk.range && dEnemy(u2, e) >= (sk.minRange ?? 1));
    if (sk.attack) {
      const prov = list.filter((e) => has(e, 'provocation'));
      if (prov.length) list = prov;
    }
    return list;
  }
  function canHit(u2: Unit): boolean {
    return u2.skills.some((id) => {
      const sk = SK[id];
      if (!sk || sk.kind !== 'active' || u2.mana < sk.mana) return false;
      if (sk.target === 'enemy')
        return (!!sk.attack || !!sk.fx?.some((f) => f.k === 'dmg' || f.k === 'wdmg' || f.k === 'drain')) && candidates(u2, id).length > 0;
      return (id === 'tourbillon' || id === 'repousser_renforce' || id === 'seisme') && selfValid(u2, id);
    });
  }
  const blocked = (): boolean => now - lastWound >= P.stallTime || !units.some((x) => inPlay(x) && canHit(x));
  function mainRange(u2: Unit): number {
    for (const id of u2.skills) {
      const sk = SK[id];
      if (sk && sk.kind === 'active' && sk.target === 'enemy') return sk.range;
    }
    return 1;
  }
  function condOk(u2: Unit, r: Rule): boolean {
    const v = r.v ?? 0;
    switch (r.cond) {
      case 'always':
        return true;
      case 'selfHpBelow':
        return u2.hp * 100 < v * u2.hpMax;
      case 'allyHpBelow':
        return alliesOf(u2).some((a) => a.hp * 100 < v * a.hpMax);
      case 'selfWillBelow':
        return u2.will * 100 < v * u2.willMax;
      case 'selfEnergyBelow':
        return u2.energy * 100 < v * u2.energyMax;
      case 'selfEnergyAbove':
        return u2.energy * 100 >= v * u2.energyMax;
      case 'selfManaBelow':
        return u2.manaMax > 0 && u2.mana * 100 < v * u2.manaMax;
      case 'enemyInRange':
        return enemiesOf(u2).some((e) => dEnemy(u2, e) <= mainRange(u2));
      case 'noEnemyInRange':
        return !enemiesOf(u2).some((e) => dEnemy(u2, e) <= mainRange(u2));
      case 'myDist':
        return rank(u2) === v;
      case 'enemiesAtLeast':
        return enemiesOf(u2).length >= v;
      case 'timeAtLeast':
        return now >= v;
      case 'selfHasState':
        return !!has(u2, r.s ?? '');
      case 'selfLacksState':
        return !has(u2, r.s ?? '');
      default:
        return true;
    }
  }
  function select2(u2: Unit, list: Unit[], sel: string, kind: string): Unit | undefined {
    if (!list.length) return void 0;
    if (kind === 'self') return list[0];
    if (kind === 'ally' && sel !== 'mostWoundedAlly' && sel !== 'self') sel = 'mostWoundedAlly';
    if (kind === 'ally' && sel === 'self') return list.find((x) => x === u2) ?? list[0];
    if (kind === 'enemy' && (sel === 'mostWoundedAlly' || sel === 'self')) sel = 'nearestEnemy';
    const d = (e: Unit): number => (kind === 'ally' ? dAlly(u2, e) : dEnemy(u2, e));
    const base = (a: Unit, b: Unit): number => a.hp - b.hp || d(a) - d(b) || a.slot - b.slot;
    const sorted = [...list];
    switch (sel) {
      case 'nearestEnemy':
        sorted.sort((a, b) => d(a) - d(b) || a.hp - b.hp || a.slot - b.slot);
        break;
      case 'weakestEnemy':
        sorted.sort(base);
        break;
      case 'strongestEnemy':
        sorted.sort((a, b) => b.hp - a.hp || d(a) - d(b) || a.slot - b.slot);
        break;
      case 'lowestWillEnemy':
        sorted.sort((a, b) => pct(a.will, a.willMax) - pct(b.will, b.willMax) || base(a, b));
        break;
      case 'mostWoundedAlly':
        sorted.sort((a, b) => pct(a.hp, a.hpMax) - pct(b.hp, b.hpMax) || base(a, b));
        break;
      case 'randomEnemy':
        return pick(sorted.sort(base));
    }
    return sorted[0];
  }
  const isHealSkill = (id: string): boolean =>
    id === 'soin_mineur' || id === 'priere' || (!!SK[id]?.fx && (SK[id]!.ai === 'heal' || SK[id]!.ai === 'groupHeal'));
  const isHotSkill = (id: string): boolean => id === 'regeneration' || !!SK[id]?.fx?.some((f) => f.k === 'state' && f.s === 'regeneration');
  function choose(u2: Unit): Choice | null {
    for (let i = 0; i < u2.rules.length; i++) {
      const r = u2.rules[i]!;
      const id = r.action;
      if (!COMMON.has(id) && (!u2.active.has(id) || !SK[id] || SK[id]!.kind !== 'active')) continue;
      if (!COMMON.has(id) && SK[id]!.mana > 0 && has(u2, 'silence')) continue;
      if (!condOk(u2, r)) continue;
      let list = candidates(u2, id);
      if (P.healCooldown && isHealSkill(id)) {
        const v = r.v ?? 0;
        if (!alliesOf(u2).some((a) => healReady(a) && (r.cond !== 'allyHpBelow' || a.hp * 100 < v * a.hpMax))) continue;
        if (SK[id]!.target === 'ally') list = list.filter(healReady);
      }
      if (P.hotCooldown && isHotSkill(id)) {
        if (SK[id]!.target === 'ally') list = list.filter(hotReady);
        else if (!alliesOf(u2).some(hotReady)) continue;
      }
      if (r.cond === 'targetHasState') list = list.filter((x) => has(x, r.s ?? ''));
      if (r.cond === 'targetLacksState') list = list.filter((x) => !has(x, r.s ?? ''));
      const kind = COMMON.has(id) ? 'self' : SK[id]!.target;
      const target = select2(u2, list, r.target, kind);
      if (!target) continue;
      if (!COMMON.has(id) && P.manaSkipsRule && u2.mana < SK[id]!.mana) continue;
      return { i, id, target };
    }
    return null;
  }
  function wait(u2: Unit, why: string): number {
    emit({ k: 'wait', u: u2.id, why });
    u2.pendingRegen += Math.floor((u2.energyMax * P.waitRegen) / 1e3);
    u2.pendingMana += Math.floor((u2.manaMax * (P.waitManaRegen ?? 0)) / 1e3);
    return durMod(u2, Math.floor((u2.speed * P.moveMult) / 1e3));
  }
  function act2(u2: Unit): void {
    if (u2.pendingRegen) {
      setGauge(u2, 'energy', u2.energy + u2.pendingRegen, 'Attendre');
      u2.pendingRegen = 0;
    }
    if (u2.pendingMana) {
      setGauge(u2, 'mana', u2.mana + u2.pendingMana, 'Attendre');
      u2.pendingMana = 0;
    }
    const g2 = has(u2, 'gele');
    if (g2 && g2.end > now) {
      emit({ k: 'frozen', u: u2.id, until: g2.end });
      u2.nextAt = g2.end;
      return;
    }
    u2.acting = true;
    u2.extraDelay = 0;
    let dur: number;
    const c: Choice | null = blocked() && rank(u2) > 1 ? { i: -1, id: 'avancer', target: u2 } : choose(u2);
    if (!c) dur = wait(u2, 'norule');
    else if (c.id === 'attendre') {
      emit({ k: 'act', u: u2.id, rule: c.i, skill: c.id });
      dur = wait(u2, 'choice');
    } else if (COMMON.has(c.id)) {
      emit({ k: 'act', u: u2.id, rule: c.i, skill: c.id });
      if (c.id === 'avancer')
        setDist(
          u2,
          Math.max(
            1,
            ...alliesOf(u2)
              .map((a) => a.dist)
              .filter((d) => d < u2.dist),
          ),
          c.i < 0 ? 'Approche automatique' : 'Avancer',
        );
      if (c.id === 'reculer') setDist(u2, u2.dist + 1, 'Reculer');
      dur = durMod(u2, Math.floor((u2.speed * (c.id === 'fuir' ? P.fleeMult : P.moveMult)) / 1e3));
      if (c.id === 'fuir') {
        u2.fled = true;
        emit({ k: 'flee', u: u2.id });
        checkEnd();
      }
    } else {
      const sk = SK[c.id]!;
      const energy = sk.energy + Math.floor((u2.weapon.cost * (sk.energyW ?? 0)) / 1e3);
      if (u2.energy < energy || u2.mana < sk.mana) {
        dur = wait(u2, 'energy');
      } else {
        emit({ k: 'act', u: u2.id, rule: c.i, skill: c.id, target: c.target.id });
        let out: Outcome = 'ok';
        const conf = has(u2, 'confusion');
        const wp = pct(u2.will, u2.willMax);
        if (conf) {
          out = 'half';
          removeState(u2, 'confusion');
          emit({ k: 'will', u: u2.id, pct: wp, res: out, forced: true });
        } else {
          if (wp < 500) {
            const roll = rng2.int(2);
            if (roll === 1) out = wp < 200 ? 'crit' : 'half';
          }
          emit({ k: 'will', u: u2.id, pct: wp, res: out });
        }
        if (energy) setGauge(u2, 'energy', u2.energy - energy, sk.name);
        if (sk.mana) setGauge(u2, 'mana', u2.mana - sk.mana, sk.name);
        resolve(u2, c.id, sk, c.target, out);
        const base = sk.durBase === 'weapon' ? u2.weapon.speed : u2.speed;
        dur = durMod(u2, Math.floor((base * sk.durMult) / 1e3));
      }
    }
    u2.nextAt = now + dur + u2.extraDelay;
    u2.acting = false;
    u2.extraDelay = 0;
  }
  function resolve(u2: Unit, id: string, sk: Skill, t: Unit, out: Outcome): void {
    const p = sk.p;
    const lost = (why: string): void => emit({ k: 'lost', u: u2.id, why });
    const otherEnemy = (): Unit | undefined => pick(candidates(u2, id).filter((e) => e !== t));
    const randomAllyInRange = (range = sk.range): Unit | undefined =>
      pick(alliesOf(u2).filter((a) => a !== u2 && dAlly(u2, a) <= Math.max(0, range)));
    const anyAlly = (): Unit | undefined => pick(alliesOf(u2).filter((a) => a !== u2));
    const rankOf = (x: Unit): Unit[] => units.filter((y) => inPlay(y) && y.side === x.side && y.dist === x.dist);
    const n = (k: string): number => p[k]!;
    const name = sk.name;
    switch (id) {
      case 'emploi':
      case 'tir_fronde':
      case 'tir_arc': {
        if (out === 'ok') weaponHit(u2, t, 1e3, sk, name);
        else if (out === 'half') {
          const o = otherEnemy();
          if (o) weaponHit(u2, o, 1e3, sk, name);
          else lost('aucun autre ennemi à portée');
        } else if (id === 'emploi') weaponHit(u2, u2, 1e3, sk, `${name} (sur soi)`, { melee: false });
        else {
          const a = anyAlly();
          if (a) weaponHit(u2, a, 1e3, sk, `${name} (sur un allié)`, { melee: false });
          else lost('aucun allié');
        }
        break;
      }
      case 'exploit': {
        if (out === 'ok') {
          weaponHit(u2, t, n('mult'), sk, name);
          if (u2.weapon.type === 'tranchant') addState(t, 'saignement', u2, n('bleedDur'), n('bleed'));
          else stun(t, u2, n('stun'));
        } else if (out === 'half') lost('rien ne se passe');
        else {
          const a = randomAllyInRange(1);
          if (a) weaponHit(u2, a, n('mult'), sk, `${name} (sur un allié)`, { melee: false });
          else lost('aucun allié à portée');
        }
        break;
      }
      case 'meditation':
        if (out === 'crit') loseHp(u2, Math.floor((u2.hpMax * n('crit')) / 1e3), 'Méditation ratée');
        else changeWill(u2, out === 'ok' ? n('ok') : n('half'), name);
        break;
      case 'repos':
        if (out === 'ok') setGauge(u2, 'energy', u2.energy + Math.floor((u2.energyMax * n('ok')) / 1e3), name);
        else if (out === 'half') lost('rien ne se passe');
        else loseHp(u2, Math.floor((u2.hpMax * n('crit')) / 1e3), 'Repos raté');
        break;
      case 'coup_bouclier':
        if (out === 'crit') stun(u2, u2, n('stun'));
        else {
          weaponHit(u2, t, n('mult'), sk, name);
          if (out === 'ok') stun(t, u2, n('stun'));
        }
        break;
      case 'repousser':
      case 'repousser_renforce': {
        if (out === 'crit') {
          setDist(u2, u2.dist + 1, 'recule');
          break;
        }
        const targets = id === 'repousser' ? [t] : enemiesOf(u2).filter((e) => dEnemy(u2, e) === 1);
        for (const x of targets) {
          weaponHit(u2, x, n('mult'), sk, name);
          if (out === 'ok' && inPlay(x)) {
            if (x.dist === 3) stun(x, u2, n('stun'));
            else setDist(x, x.dist + 1, 'repoussé');
          }
        }
        break;
      }
      case 'provocation':
        if (out === 'crit') changeWill(u2, -n('crit'), 'Provocation ratée');
        else addState(u2, 'provocation', u2, out === 'ok' ? n('dur') : n('halfDur'));
        break;
      case 'mur_boucliers':
        if (out === 'crit') lost('rien ne se passe');
        else for (const a of out === 'ok' ? rankOf(u2) : [u2]) addState(a, 'bouclier', u2, n('dur'), n('shield'));
        break;
      case 'execution':
      case 'fracas': {
        if (out === 'crit') {
          const a = randomAllyInRange(1);
          if (a) weaponHit(u2, a, 1e3, sk, `${name} (sur un allié)`, { melee: false });
          else lost('aucun allié à portée');
          break;
        }
        if (out === 'half') {
          if (id === 'fracas') weaponHit(u2, t, n('half'), sk, name);
          else lost('rien ne se passe');
          break;
        }
        let mult = 1e3;
        if (id === 'execution' && t.hp * 1e3 < t.hpMax * n('threshold')) mult = n('bonusMult');
        if (id === 'fracas' && has(t, 'gele')) {
          mult = n('bonusMult');
          removeState(t, 'gele');
          emit({ k: 'passive', u: u2.id, name, text: 'le gel est brisé' });
        }
        weaponHit(u2, t, mult, sk, name);
        break;
      }
      case 'brise_armure':
        if (out === 'crit') {
          addState(u2, 'brise', u2, n('dur'), -n('res'), { cap: n('cap') });
          break;
        }
        weaponHit(u2, t, n('mult'), sk, name);
        if (out === 'ok') addState(t, 'brise', u2, n('dur'), -n('res'), { cap: n('cap') });
        break;
      case 'charge':
        setDist(u2, 1, 'Charge');
        if (out === 'ok') weaponHit(u2, t, n('mult'), sk, name);
        else if (out === 'crit') stun(u2, u2, n('stun'));
        else lost('avance sans frapper');
        break;
      case 'volee': {
        if (out === 'crit') {
          lost('rien ne se passe');
          break;
        }
        for (const x of out === 'ok' ? rankOf(t) : [t]) weaponHit(u2, x, n('mult'), sk, name);
        break;
      }
      case 'tir_precis':
        if (out === 'crit') lost('rien ne se passe');
        else weaponHit(u2, t, out === 'ok' ? n('mult') : 1e3, sk, name, { ignoreHalf: out === 'ok' });
        break;
      case 'marque':
        if (out === 'crit') {
          const a = pick(alliesOf(u2));
          if (a) addState(a, 'marque', u2, n('dur'), n('uses'));
        } else addState(t, 'marque', u2, n('dur'), out === 'ok' ? n('uses') : 1);
        break;
      case 'soin_mineur':
        if (out === 'crit') loseHp(t, Math.floor((t.hpMax * n('crit')) / 1e3), 'Soin raté', u2);
        else heal2(t, Math.floor((t.hpMax * (out === 'ok' ? n('ok') : n('half'))) / 1e3), name, true);
        break;
      case 'regeneration':
        if (out === 'crit') {
          const e = pick(enemiesOf(u2));
          if (e) addState(e, 'regeneration', u2, n('dur'), n('perTick'));
        } else addState(t, 'regeneration', u2, out === 'ok' ? n('dur') : n('halfDur'), n('perTick'));
        break;
      case 'priere':
        if (out === 'crit') changeWill(u2, -n('crit'), 'Prière ratée');
        else for (const a of out === 'ok' ? alliesOf(u2) : rankOf(u2)) heal2(a, Math.floor((a.hpMax * n('ok')) / 1e3), name, true);
        break;
      case 'purification': {
        if (out === 'crit') {
          for (const s3 of t.states.filter((s4) => !isNegative(s4))) removeState(t, s3.id);
          break;
        }
        const neg = t.states.filter(isNegative).sort((a, b) => b.order - a.order);
        for (const s3 of out === 'ok' ? neg : neg.slice(0, 1)) removeState(t, s3.id);
        if (!neg.length) lost('aucun état négatif');
        break;
      }
      case 'trait_sacre':
      case 'trait_sacre_renforce': {
        if (out === 'crit') {
          heal2(t, n('dmg'), `${name} raté`);
          break;
        }
        let base = n('dmg');
        if (out === 'half') base = Math.floor(base / 2);
        const raw = base + atk(u2);
        const bonus = t.tags.some((x) => x === 'mort-vivant' || x === 'demon') ? n('tagMult') : 1e3;
        damage(u2, t, Math.floor((raw * bonus) / 1e3), 'sacre', { cause: name });
        break;
      }
      case 'bouclier_foi':
        if (out === 'crit') lost('mana perdu');
        else addState(t, 'bouclier', u2, n('dur'), out === 'ok' ? n('ok') : n('half'));
        break;
      case 'confusion':
      case 'confusion_moine':
        if (out === 'ok') addState(t, 'confusion', u2, n('dur'));
        else if (out === 'half') changeWill(t, -n('half'), name);
        else addState(u2, 'confusion', u2, n('dur'));
        break;
      case 'trait_flammes':
        if (out === 'crit') {
          addState(u2, 'brulure', u2, n('burnDur'), n('burn'));
          break;
        }
        spellHit(u2, t, n('dmg'), 'feu', name);
        if (out === 'ok') addState(t, 'brulure', u2, n('burnDur'), n('burn'));
        break;
      case 'boule_feu': {
        if (out === 'crit') {
          for (const a of rankOf(u2)) spellHit(u2, a, a === u2 ? n('dmg') : n('splash'), 'feu', `${name} (explose)`);
          break;
        }
        let main = t;
        if (out === 'half') {
          const o = pick(rankOf(t).filter((x) => x !== t));
          if (!o) {
            lost('la boule manque sa cible');
            break;
          }
          main = o;
        }
        const rank2 = rankOf(main);
        spellHit(u2, main, n('dmg'), 'feu', name);
        if (out === 'ok') {
          for (const x of rank2) if (x !== main) spellHit(u2, x, n('splash'), 'feu', name);
          addState(main, 'brulure', u2, n('burnDur'), n('burn'));
        }
        break;
      }
      case 'arme_enflammee':
        if (out === 'crit') addState(t, 'brulure', u2, n('burnDur'), n('burn'));
        else addState(t, 'arme_feu', u2, out === 'ok' ? n('dur') : n('halfDur'), n('bonus'), { v2: n('burn') });
        break;
      case 'mur_flammes': {
        const list = out === 'ok' ? rankOf(t) : out === 'half' ? [t] : rankOf(u2);
        for (const x of list) addState(x, 'brulure', u2, n('burnDur'), n('burn'));
        break;
      }
      case 'embrasement': {
        const burning = (side: number): Unit[] => units.filter((x) => inPlay(x) && x.side === side && has(x, 'brulure'));
        let list = out === 'crit' ? burning(u2.side) : burning(1 - u2.side);
        if (out === 'half') list = list.sort((a, b) => dEnemy(u2, a) - dEnemy(u2, b) || a.slot - b.slot).slice(0, 1);
        if (!list.length) lost('personne ne brûle');
        for (const x of list) {
          const b = has(x, 'brulure')!;
          const ticks = Math.floor(b.end / P.tick) - Math.floor(now / P.tick);
          const dmg = b.v * b.charges * Math.max(0, ticks) * 2;
          removeState(x, 'brulure');
          if (dmg > 0) damage(u2, x, dmg, 'feu', { cause: name });
        }
        break;
      }
      case 'lame_saignante':
        if (out === 'crit') {
          addState(u2, 'saignement', u2, n('bleedDur'), n('bleed'));
          break;
        }
        weaponHit(u2, t, n('mult'), sk, name);
        if (out === 'ok') addState(t, 'saignement', u2, n('bleedDur'), n('bleed'));
        break;
      case 'cri_guerre':
        if (out === 'crit') {
          for (const a of alliesOf(u2)) changeWill(a, -n('crit'), 'Cri raté');
          break;
        }
        for (const a of out === 'ok' ? alliesOf(u2) : [u2]) {
          changeWill(a, n('will'), name);
          addState(a, 'cri', u2, n('dur'), n('atk'));
        }
        break;
      case 'tourbillon': {
        const foes = enemiesOf(u2).filter((e) => dEnemy(u2, e) === 1);
        for (const x of foes) weaponHit(u2, x, out === 'half' ? n('half') : 1e3, sk, name);
        if (out === 'crit') {
          for (const a of rankOf(u2)) if (a !== u2) weaponHit(u2, a, 1e3, sk, `${name} (allié)`, { melee: false });
        }
        break;
      }
      case 'morsure':
        if (out === 'crit') {
          lost('rien ne se passe');
          break;
        }
        {
          const weak = t.hp * 1e3 < t.hpMax * n('threshold');
          weaponHit(u2, t, 1e3, sk, name);
          if (out === 'ok' && weak) addState(t, 'saignement', u2, n('bleedDur'), n('bleed'));
        }
        break;
      case 'hurlement':
        if (out === 'crit') {
          for (const a of alliesOf(u2)) changeWill(a, -n('crit'), 'Hurlement raté');
          break;
        }
        for (const a of alliesOf(u2)) changeWill(a, n('ally'), name);
        if (out === 'ok') {
          for (const e of enemiesOf(u2)) if (rank(e) <= 2) changeWill(e, -n('enemy'), name);
        }
        break;
      case 'drain':
        if (out === 'crit') {
          loseHp(u2, n('crit'), 'Drain inversé');
          heal2(t, n('crit'), 'Drain inversé');
          break;
        }
        {
          const dealt = spellHit(u2, t, n('dmg'), 'tenebres', name);
          if (out === 'ok') heal2(u2, Math.floor(dealt / 2), name);
        }
        break;
      case 'murmure':
      case 'terreur_masse': {
        if (out === 'crit') {
          changeWill(u2, -n('crit'), 'Terreur retournée');
          break;
        }
        for (const x of id === 'terreur_masse' ? rankOf(t) : [t]) {
          if (out === 'ok') spellHit(u2, x, n('dmg'), 'psychique', name);
          changeWill(x, -(out === 'ok' ? n('will') : n('half')), name);
        }
        break;
      }
      case 'malediction':
        addState(out === 'crit' ? u2 : t, 'malediction', u2, out === 'half' ? n('halfDur') : n('dur'), -n('res'));
        break;
      case 'nuage':
      case 'nuage_renforce': {
        // `pick` ne rend jamais undefined ici : le rang de la cible la contient toujours.
        const list = out === 'ok' ? rankOf(t) : out === 'half' ? [pick(rankOf(t))] : rankOf(u2);
        for (const x of list) addState(x as Unit, 'poison', u2, n('dur'), n('dmg'), { cap: n('cap') });
        break;
      }
      case 'lien_vital':
        if (out === 'crit') addState(t, 'lien', u2, n('dur'), 0, { other: u2.id });
        else addState(u2, 'lien', u2, out === 'ok' ? n('dur') : n('halfDur'), 0, { other: t.id });
        break;
      case 'hate':
        addState(u2, out === 'crit' ? 'ralenti' : 'hate', u2, out === 'half' ? n('halfDur') : n('dur'));
        break;
      case 'paume_vide':
        if (out === 'crit') {
          addState(u2, 'confusion', u2, n('confDur'));
          break;
        }
        spellHit(u2, t, n('dmg'), 'psychique', name, { melee: true });
        if (out === 'ok') {
          addState(t, 'confusion', u2, n('confDur'));
          changeWill(t, -n('will'), name);
        }
        break;
      case 'seisme':
        if (out === 'crit') {
          stun(u2, u2, n('stun'));
          loseHp(u2, Math.floor((u2.hpMax * n('crit')) / 1e3), 'Séisme raté');
          break;
        }
        for (const e of enemiesOf(u2).filter((e2) => rank(e2) <= 2)) {
          spellHit(u2, e, n('dmg'), 'contondant', name);
          if (out === 'ok' && inPlay(e) && dEnemy(u2, e) === 1) stun(e, u2, n('stun'));
        }
        break;
      case 'fleche_givre':
        if (out === 'crit') {
          addState(u2, 'ralenti', u2, n('slowDur'));
          break;
        }
        if (out === 'ok') spellHit(u2, t, n('dmg'), 'glace', name);
        if (!inPlay(t)) break;
        if (out === 'ok' && has(t, 'ralenti') && (thawUntil.get(t.id) ?? -1) <= now) {
          removeState(t, 'ralenti');
          addState(t, 'gele', u2, n('freezeDur'));
          thawUntil.set(t.id, now + n('freezeDur') + (p.freezeImmune ?? 0));
        } else addState(t, 'ralenti', u2, n('slowDur'));
        break;
      case 'grappin':
        if (out === 'crit') setDist(u2, 1, 'tiré par le grappin');
        else setDist(t, out === 'ok' ? 1 : t.dist - 1, 'Grappin');
        break;
      default:
        if (sk.fx) runFx(u2, sk, t, out);
        else lost(`compétence ${id} sans effet dans le prototype`);
    }
  }
  let fxDirectHeal = false;
  function runFx(u2: Unit, sk: Skill, t: Unit, out: Outcome): void {
    fxDirectHeal = sk.ai === 'heal' || sk.ai === 'groupHeal';
    const name = sk.name;
    const fx = sk.fx!;
    const hostile = sk.target === 'enemy';
    if (out === 'crit') {
      if (!hostile) {
        emit({ k: 'lost', u: u2.id, why: 'sort raté' });
        return;
      }
      const f = fx[0]!;
      applyFx(u2, { ...f, area: 'self', v: Math.floor((f.v ?? 0) / 2), dur: Math.floor((f.dur ?? 0) / 2) }, u2, `${name} (retourné)`);
      return;
    }
    for (const f of fx) {
      const g2: Fx =
        out === 'half'
          ? {
              ...f,
              v: f.k === 'push' || f.k === 'pull' ? f.v! : Math.floor((f.v ?? 0) / 2),
              dur: Math.floor((f.dur ?? 0) / 2),
              area: f.area === 'self' ? 'self' : 'target',
            }
          : f;
      applyFx(u2, g2, t, name);
    }
  }
  function fxTargets(u2: Unit, t: Unit, area: string): Unit[] {
    switch (area) {
      case 'target':
        return inPlay(t) ? [t] : [];
      case 'rank':
        return units.filter((y) => inPlay(y) && y.side === t.side && y.dist === t.dist);
      case 'allEnemies':
        return enemiesOf(u2);
      case 'front':
        return enemiesOf(u2).filter((e) => rank(e) <= 2);
      case 'self':
        return [u2];
      case 'allies':
        return alliesOf(u2);
      case 'allyRank':
        return alliesOf(u2).filter((a) => a.dist === u2.dist);
    }
    // Zone inconnue : le prototype itère sur undefined et lève une erreur ; on garde ce comportement.
    return undefined as unknown as Unit[];
  }
  function applyFx(u2: Unit, f: Fx, t: Unit, cause: string): void {
    for (const x of fxTargets(u2, t, f.area ?? 'target')) {
      if (!inPlay(x) || ended) continue;
      if (f.ifState && !has(x, f.ifState)) continue;
      const v = f.v ?? 0;
      const bonus = f.tag && x.tags.includes(f.tag) ? (f.tagMult ?? 1e3) : 1e3;
      switch (f.k) {
        case 'dmg':
          spellHit(u2, x, Math.floor((v * bonus) / 1e3), f.type ?? 'contondant', cause);
          break;
        case 'wdmg': {
          const type = f.type ?? u2.weapon.type;
          damage(u2, x, Math.floor((weaponRaw(u2, v) * bonus) / 1e3), type, { cause, melee: dEnemy(u2, x) === 1 && x.side !== u2.side });
          break;
        }
        case 'drain': {
          const dealt = spellHit(u2, x, v, f.type ?? 'tenebres', cause);
          heal2(u2, Math.floor(dealt / 2), cause);
          break;
        }
        case 'heal':
          heal2(x, Math.floor((x.hpMax * v) / 1e3), cause, fxDirectHeal);
          break;
        case 'will':
          changeWill(x, v, cause);
          break;
        case 'mana':
          if (x.manaMax > 0) setGauge(x, 'mana', x.mana + Math.trunc((x.manaMax * v) / 1e3), cause);
          break;
        case 'energy':
          setGauge(x, 'energy', x.energy + Math.trunc((x.energyMax * v) / 1e3), cause);
          break;
        case 'stun':
          stun(x, u2, v);
          break;
        case 'push':
          setDist(x, x.dist + (v || 1), cause);
          break;
        case 'pull':
          setDist(x, x.dist - (v || 1), cause);
          break;
        case 'cleanse':
          for (const s3 of x.states.filter(isNegative)) removeState(x, s3.id);
          break;
        case 'state':
          if (f.s === 'etourdi') stun(x, u2, f.dur ?? 0);
          else addState(x, f.s!, u2, f.dur ?? 0, v, f.cap ? { cap: f.cap } : {});
          break;
      }
    }
  }
  function tick(): void {
    emit({ k: 'tick' });
    for (const u2 of ordered()) {
      for (const s3 of [...u2.states].sort((a, b) => a.order - b.order)) {
        if (!inPlay(u2)) break;
        const caster = byId.get(s3.caster);
        if (P.dotTick) continue;
        if (DOT[s3.id]) damage(caster, u2, s3.v * s3.charges, DOT[s3.id]!, { cause: STATE_NAMES[s3.id], tick: true });
        if (s3.id === 'regeneration') heal2(u2, Math.floor((u2.hpMax * s3.v) / 1e3), 'Régénération');
      }
    }
    for (const u2 of ordered())
      if (passive(u2, 'aura_serenite')) {
        for (const a of alliesOf(u2)) if (a.dist === u2.dist) changeWill(a, sp('aura_serenite', 'will'), 'Aura de sérénité');
      }
    for (const u2 of units) u2.attackers.clear();
  }
  function dotTick(): void {
    for (const u2 of ordered()) {
      for (const s3 of [...u2.states].sort((a, b) => a.order - b.order)) {
        if (!inPlay(u2)) break;
        const caster = byId.get(s3.caster);
        if (DOT[s3.id]) damage(caster, u2, s3.v * s3.charges, DOT[s3.id]!, { cause: STATE_NAMES[s3.id], tick: true });
        if (s3.id === 'regeneration') heal2(u2, Math.floor((u2.hpMax * s3.v) / 1e3), 'Régénération');
      }
    }
  }
  let lastTick = 0,
    lastDot = 0;
  checkEnd();
  while (!ended) {
    const actor = ordered()[0];
    const nextTick = lastTick + P.tick;
    const nextDot = P.dotTick ? lastDot + P.dotTick : Infinity;
    const nextAction = actor ? actor.nextAt : Infinity;
    const t = Math.min(nextTick, nextDot, nextAction);
    if (t > P.timeLimit) {
      now = P.timeLimit;
      ended = { winner: 1, reason: 'timeout' };
      emit({ k: 'end', winner: 1, reason: 'timeout' });
      break;
    }
    now = t;
    expireStates();
    if (P.dotTick && t === nextDot) {
      lastDot = nextDot;
      dotTick();
      if (ended) break;
      if (t !== nextTick && t !== nextAction) continue;
    }
    if (nextTick <= nextAction) {
      lastTick = nextTick;
      tick();
    } else act2(actor!);
  }
  const fin = ended as { winner: Side | null; reason: 'wipe' | 'timeout' };
  return {
    log,
    result: {
      winner: fin.winner,
      reason: fin.reason,
      time: now,
      units: units.map((u2) => ({
        id: u2.id,
        hp: u2.hp,
        mana: u2.mana,
        dead: !u2.alive,
        fled: u2.fled,
        dmgDealt: u2.dmgDealt,
        kills: u2.kills,
      })),
    },
  };
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
