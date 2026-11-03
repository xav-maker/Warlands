var ENGINE_VERSION = "proto-0.4-ville";
var DMG_TYPES = ["contondant", "tranchant", "maladie", "psychique", "feu", "glace", "tenebres", "sacre"];
var Rng = class {
  constructor(seed) {
    __publicField(this, "s", new Uint32Array(4));
    let x = seed >>> 0;
    for (let i = 0; i < 4; i++) {
      x = x + 2654435769 >>> 0;
      let z = x;
      z = Math.imul(z ^ z >>> 16, 2246822507) >>> 0;
      z = Math.imul(z ^ z >>> 13, 3266489909) >>> 0;
      this.s[i] = (z ^ z >>> 16) >>> 0;
    }
  }
  next() {
    const s3 = this.s;
    const r = Math.imul(rotl(Math.imul(s3[1], 5) >>> 0, 7), 9) >>> 0;
    const t = s3[1] << 9 >>> 0;
    s3[2] ^= s3[0];
    s3[3] ^= s3[1];
    s3[1] ^= s3[2];
    s3[0] ^= s3[3];
    s3[2] ^= t;
    s3[3] = rotl(s3[3], 11);
    return r;
  }
  int(n) {
    return this.next() % n;
  }
};
function rotl(x, k) {
  return (x << k | x >>> 32 - k) >>> 0;
}
var DOT = { saignement: "tranchant", poison: "maladie", brulure: "feu" };
var STATE_NAMES = {
  saignement: "Saignement",
  poison: "Poison",
  brulure: "Br\xFBlure",
  regeneration: "R\xE9g\xE9n\xE9ration",
  hate: "H\xE2te",
  ralenti: "Ralenti",
  etourdi: "\xC9tourdi",
  gele: "Gel\xE9",
  bouclier: "Bouclier",
  marque: "Marque",
  provocation: "Provocation",
  confusion: "Confusion",
  cri: "Cri de guerre",
  peau: "Peau de pierre",
  malediction: "Mal\xE9diction",
  brise: "Brise-armure",
  arme_feu: "Arme enflamm\xE9e",
  lien: "Lien vital",
  affaibli: "Affaibli",
  garde: "Garde",
  silence: "Silence",
  epines: "\xC9pines"
};
var NEGATIVE = /* @__PURE__ */ new Set(["saignement", "poison", "brulure", "ralenti", "etourdi", "gele", "marque", "confusion", "malediction", "brise", "lien", "affaibli", "silence"]);
function isNegative(s3) {
  return NEGATIVE.has(s3.id) || s3.id === "peau" && s3.v < 0;
}
var COMMON = /* @__PURE__ */ new Set(["avancer", "reculer", "attendre", "fuir"]);
function simuler(input, seed) {
  const P = input.params;
  const SK = input.skills;
  const rng2 = new Rng(seed);
  const log = [];
  let now = 0;
  let stateOrder = 0;
  let ended = null;
  let inReaction = false;
  let lastWound = 0;
  const units = input.units.map((u2) => ({
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
    used: /* @__PURE__ */ new Set(),
    attackers: /* @__PURE__ */ new Set(),
    pendingRegen: 0,
    pendingMana: 0,
    extraDelay: 0,
    dmgDealt: 0,
    kills: 0,
    acting: false
  }));
  const byId = new Map(units.map((u2) => [u2.id, u2]));
  const emit = (e) => {
    if (ended && e.k !== "end") return;
    e.t = now;
    log.push(e);
  };
  emit({ k: "start", units: input.units.map((u2) => ({ ...u2, hp: clamp(u2.hp, 0, u2.hpMax), mana: clamp(u2.mana, 0, u2.manaMax) })) });
  const inPlay = (u2) => u2.alive && !u2.fled;
  const ordered = () => units.filter(inPlay).sort(tieOrder);
  function tieOrder(a, b) {
    return a.nextAt - b.nextAt || a.speed - b.speed || a.side - b.side || a.slot - b.slot;
  }
  const enemiesOf = (u2) => units.filter((e) => inPlay(e) && e.side !== u2.side);
  const alliesOf = (u2) => units.filter((e) => inPlay(e) && e.side === u2.side);
  const rank = (u2) => {
    const occ = new Set(units.filter((x) => inPlay(x) && x.side === u2.side).map((x) => x.dist));
    occ.add(u2.dist);
    return [...occ].filter((d) => d <= u2.dist).length;
  };
  const dEnemy = (a, b) => rank(a) + rank(b) - 1;
  const dAlly = (a, b) => Math.abs(rank(a) - rank(b));
  const has = (u2, s3) => u2.states.find((x) => x.id === s3);
  const passive = (u2, id) => inPlay(u2) && u2.active.has(id) && SK[id]?.kind !== "active";
  const pct = (v, max) => max > 0 ? Math.floor(v * 1e3 / max) : 0;
  function atk(u2) {
    let m2 = 1e3;
    const cri = has(u2, "cri");
    if (cri) m2 += cri.v;
    const aff = has(u2, "affaibli");
    if (aff) m2 -= aff.v;
    if (passive(u2, "rage")) m2 += SK.rage.p.atkPer10 * Math.floor(pct(u2.hpMax - u2.hp, u2.hpMax) / 100);
    return Math.max(0, Math.floor(u2.atk * Math.max(0, m2) / 1e3));
  }
  function res(u2, t) {
    let r = u2.res[t] || 0;
    for (const s3 of u2.states) {
      if (s3.id === "malediction" || s3.id === "garde") r += s3.v;
      if ((s3.id === "peau" || s3.id === "brise") && (t === "contondant" || t === "tranchant")) r += s3.v * s3.charges;
    }
    return clamp(r, P.resFloor, P.resCap);
  }
  function durMod(u2, d) {
    const h2 = has(u2, "hate"), s3 = has(u2, "ralenti");
    if (h2 && !s3) d = Math.floor(d * P.hasteMod / 1e3);
    if (s3 && !h2) d = Math.floor(d * P.slowMod / 1e3);
    return Math.max(1, d);
  }
  function setGauge(u2, g2, to, cause) {
    const max = g2 === "hp" ? u2.hpMax : g2 === "will" ? u2.willMax : g2 === "energy" ? u2.energyMax : u2.manaMax;
    let floor = 0;
    if (g2 === "will" && passive(u2, "esprit_inebranlable")) floor = Math.floor(u2.willMax / 2);
    to = clamp(to, Math.min(floor, max), max);
    const from = u2[g2];
    if (to === from || ended) return;
    u2[g2] = to;
    emit({ k: "gauge", u: u2.id, g: g2, from, to, cause });
  }
  const changeWill = (u2, permille, cause) => inPlay(u2) && setGauge(u2, "will", u2.will + Math.trunc(u2.willMax * permille / 1e3), cause);
  const healCdUntil = /* @__PURE__ */ new Map();
  const healReady = (x) => !P.healCooldown || (healCdUntil.get(x.id) ?? -1) <= now;
  const hotCdUntil = /* @__PURE__ */ new Map();
  const hotReady = (x) => !P.hotCooldown || (hotCdUntil.get(x.id) ?? -1) <= now;
  const heal2 = (u2, amount, cause, direct = false) => {
    if (!inPlay(u2)) return;
    if (direct && P.healCooldown) {
      if (!healReady(u2)) {
        emit({ k: "passive", u: u2.id, name: cause, text: "soin sans effet : recharge en cours" });
        return;
      }
      healCdUntil.set(u2.id, now + P.healCooldown);
    }
    setGauge(u2, "hp", u2.hp + Math.max(0, Math.floor(amount * (P.healMult ?? 1e3) / 1e3)), cause);
  };
  function loseHp(u2, amount, cause, by) {
    if (!inPlay(u2) || amount <= 0) return 0;
    let to = u2.hp - amount;
    if (to <= 0) {
      const guard = alliesOf(u2).sort((a, b) => a.slot - b.slot).find((g2) => g2.dist === u2.dist && passive(g2, "dernier_rempart") && !g2.used.has("dernier_rempart"));
      if (guard) {
        guard.used.add("dernier_rempart");
        to = 1;
        emit({ k: "passive", u: guard.id, name: "Dernier rempart", text: `retient ${u2.name} \xE0 1 PV` });
        changeWill(guard, -SK.dernier_rempart.p.will, "Dernier rempart");
      }
    }
    const lost = u2.hp - Math.max(0, to);
    if (lost > 0) lastWound = now;
    setGauge(u2, "hp", to, cause);
    if (!passive(u2, "rage")) {
      const wl = Math.floor(lost * u2.willMax * P.woundWill / (u2.hpMax * 1e3));
      if (wl > 0 && u2.hp > 0) setGauge(u2, "will", u2.will - wl, "blessure");
    }
    if (u2.hp <= 0) kill(u2, by);
    return lost;
  }
  function kill(u2, by) {
    u2.alive = false;
    emit({ k: "death", u: u2.id, by: by?.id });
    if (by && by.side !== u2.side && inPlay(by)) {
      by.kills++;
      changeWill(by, P.killWill, "ennemi tu\xE9");
    }
    for (const a of alliesOf(u2)) changeWill(a, -(a.troop === u2.troop ? P.sameTroopDeathWill : P.allyDeathWill), `mort de ${u2.name}`);
    const poison = has(u2, "poison");
    if (poison) {
      const sorcerer = units.find((x) => x.side !== u2.side && passive(x, "contagion"));
      const next = alliesOf(u2).sort((a, b) => dAlly(a, u2) - dAlly(b, u2) || a.hp - b.hp || a.slot - b.slot)[0];
      if (sorcerer && next) {
        emit({ k: "passive", u: sorcerer.id, name: "Contagion", text: `le poison passe sur ${next.name}` });
        addState(next, "poison", sorcerer, poison.end - now, poison.v, { cap: SK.contagion.p.cap, charges: poison.charges });
      }
    }
    u2.states = [];
    checkEnd();
  }
  function checkEnd() {
    if (ended) return;
    const a = units.some((u2) => u2.side === 0 && inPlay(u2));
    const b = units.some((u2) => u2.side === 1 && inPlay(u2));
    if (!a || !b) {
      ended = { winner: a ? 0 : b ? 1 : null, reason: "wipe" };
      emit({ k: "end", winner: ended.winner, reason: "wipe" });
    }
  }
  const thawUntil = /* @__PURE__ */ new Map();
  function addState(u2, id, caster, dur, v = 0, o = {}) {
    if (!inPlay(u2) || dur <= 0) return;
    if (id === "regeneration" && P.hotCooldown) {
      if (!hotReady(u2)) {
        emit({ k: "passive", u: u2.id, name: STATE_NAMES[id], text: "sans effet : recharge en cours" });
        return;
      }
      hotCdUntil.set(u2.id, now + P.hotCooldown);
    }
    if (P.dotTick && (DOT[id] || id === "regeneration")) dur = Math.max(P.dotTick, Math.round(dur * P.dotTick / P.tick));
    if ((id === "poison" || id === "saignement") && passive(u2, "non_mort")) {
      emit({ k: "state", u: u2.id, s: id, op: "immune" });
      return;
    }
    const end = now + dur;
    const cur = has(u2, id);
    if (cur) {
      if (o.cap) cur.charges = Math.min(o.cap, cur.charges + (o.charges ?? 1));
      cur.end = Math.max(cur.end, end);
      cur.v = id === "bouclier" ? Math.max(cur.v, v) : v;
      if (o.v2 !== void 0) cur.v2 = o.v2;
      cur.caster = caster.id;
      if (o.other) cur.other = o.other;
      emit({ k: "state", u: u2.id, s: id, op: "renew", charges: cur.charges, until: cur.end, v: cur.v });
    } else {
      u2.states.push({ id, caster: caster.id, end, charges: Math.min(o.cap ?? 1, o.charges ?? 1), v, v2: o.v2 ?? 0, other: o.other, order: stateOrder++ });
      emit({ k: "state", u: u2.id, s: id, op: "add", charges: o.charges ?? 1, until: end, v });
    }
  }
  function removeState(u2, id) {
    const i = u2.states.findIndex((s3) => s3.id === id);
    if (i < 0) return;
    u2.states.splice(i, 1);
    emit({ k: "state", u: u2.id, s: id, op: "end" });
  }
  function expireStates() {
    for (const u2 of ordered()) for (const s3 of [...u2.states].sort((a, b) => a.order - b.order)) if (s3.end <= now) removeState(u2, s3.id);
  }
  function stun(u2, by, amount) {
    if (!inPlay(u2)) return;
    if (u2.acting) u2.extraDelay += amount;
    else u2.nextAt += amount;
    addState(u2, "etourdi", by, amount);
  }
  function setDist(u2, to, cause) {
    to = clamp(to, 1, 3);
    if (!inPlay(u2) || to === u2.dist) return;
    const from = u2.dist;
    u2.dist = to;
    emit({ k: "move", u: u2.id, from, to, cause });
    if (to === 1 && from > 1 && (cause === "Avancer" || cause === "Charge" || cause === "Approche automatique")) {
      for (const trap of enemiesOf(u2)) if (passive(trap, "pieges_glace") && !trap.used.has("pieges_glace")) {
        trap.used.add("pieges_glace");
        emit({ k: "passive", u: trap.id, name: "Pi\xE8ges de glace", text: `${u2.name} est ralenti` });
        addState(u2, "ralenti", trap, SK.pieges_glace.p.dur);
        break;
      }
    }
  }
  function damage(src, t, raw, type, o) {
    if (!inPlay(t) || ended) return 0;
    raw = Math.max(0, raw);
    if (src && !o.tick && src.side !== t.side) {
      const m2 = has(t, "marque");
      if (m2) {
        raw = Math.floor(raw * (1e3 + SK.marque.p.bonus) / 1e3);
        if (--m2.v <= 0) removeState(t, "marque");
      }
      if (passive(src, "instinct_meute") && [...t.attackers].some((id) => id !== src.id && byId.get(id).troop === src.troop))
        raw = Math.floor(raw * (1e3 + SK.instinct_meute.p.bonus) / 1e3);
      if (type === "feu" && passive(src, "coeur_ardent") && has(t, "brulure"))
        raw = Math.floor(raw * (1e3 + SK.coeur_ardent.p.bonus) / 1e3);
      t.attackers.add(src.id);
    }
    let r = res(t, type);
    if (o.ignoreHalf && r > 0) r = Math.floor(r / 2);
    const final = Math.max(1, Math.floor(raw * (1e3 - r) / 1e3));
    let absorbed = 0;
    const sh = has(t, "bouclier");
    if (sh) {
      absorbed = Math.min(sh.v, final);
      sh.v -= absorbed;
      if (sh.v <= 0) removeState(t, "bouclier");
    }
    emit({ k: "hit", src: src?.id, u: t.id, type, raw, final, absorbed, cause: o.cause });
    const lost = loseHp(t, final - absorbed, o.cause, src);
    if (src && src.side !== t.side) src.dmgDealt += final;
    const link = has(t, "lien");
    if (link && !o.noLink && lost > 0 && link.other) {
      const other = byId.get(link.other);
      const back2 = Math.floor(lost * SK.lien_vital.p.share / 1e3);
      if (back2 > 0 && inPlay(other)) {
        emit({ k: "passive", u: t.id, name: "Lien vital", text: `${back2} d\xE9g\xE2ts renvoy\xE9s sur ${other.name}` });
        loseHp(other, back2, "Lien vital", t);
      }
    }
    if (o.melee && src && src.side !== t.side && inPlay(t) && inPlay(src) && !inReaction && passive(t, "riposte") && t.energy >= SK.riposte.energy && !has(t, "etourdi") && !has(t, "gele")) {
      inReaction = true;
      emit({ k: "passive", u: t.id, name: "Riposte", text: `contre-attaque ${src.name}` });
      setGauge(t, "energy", t.energy - SK.riposte.energy, "Riposte");
      damage(t, src, weaponRaw(t, SK.riposte.p.mult), t.weapon.type, { cause: "Riposte" });
      inReaction = false;
    }
    const th = has(t, "epines");
    if (th && o.melee && src && src.side !== t.side && inPlay(src) && !inReaction) {
      inReaction = true;
      damage(t, src, th.v, "tranchant", { cause: "\xC9pines" });
      inReaction = false;
    }
    return final;
  }
  const weaponRaw = (u2, mult) => Math.floor(u2.weapon.dmg * mult / 1e3) + atk(u2);
  function weaponHit(u2, t, mult, sk, cause, o = {}) {
    const type = !sk.dtype || sk.dtype === "weapon" ? u2.weapon.type : sk.dtype;
    const dealt = damage(u2, t, weaponRaw(u2, mult), type, { cause, melee: sk.melee, ...o });
    const fire = has(u2, "arme_feu");
    if (fire && inPlay(t)) {
      damage(u2, t, fire.v, "feu", { cause: "Arme enflamm\xE9e" });
      addState(t, "brulure", u2, SK.arme_enflammee.p.burnDur, fire.v2);
    }
    return dealt;
  }
  const spellHit = (u2, t, base, type, cause, o = {}) => damage(u2, t, base + atk(u2), type, { cause, ...o });
  const pick = (list) => list.length ? list[rng2.int(list.length)] : void 0;
  function selfValid(u2, id) {
    switch (id) {
      case "avancer":
        return rank(u2) > 1;
      case "reculer":
        return u2.dist < 3;
      case "fuir":
        return u2.dist === 3;
      case "tourbillon":
      case "repousser_renforce":
        return enemiesOf(u2).some((e) => dEnemy(u2, e) === 1);
      case "seisme":
        return enemiesOf(u2).some((e) => rank(e) <= 2);
      default:
        return true;
    }
  }
  function candidates(u2, id) {
    const sk = COMMON.has(id) ? null : SK[id];
    if (!sk) return selfValid(u2, id) ? [u2] : [];
    if (sk.target === "self") return selfValid(u2, id) ? [u2] : [];
    if (sk.target === "ally") return alliesOf(u2).filter((a) => dAlly(u2, a) <= sk.range);
    let list = enemiesOf(u2).filter((e) => dEnemy(u2, e) <= sk.range && dEnemy(u2, e) >= (sk.minRange ?? 1));
    if (sk.attack) {
      const prov = list.filter((e) => has(e, "provocation"));
      if (prov.length) list = prov;
    }
    return list;
  }
  function canHit(u2) {
    return u2.skills.some((id) => {
      const sk = SK[id];
      if (!sk || sk.kind !== "active" || u2.mana < sk.mana) return false;
      if (sk.target === "enemy") return (!!sk.attack || !!sk.fx?.some((f) => f.k === "dmg" || f.k === "wdmg" || f.k === "drain")) && candidates(u2, id).length > 0;
      return (id === "tourbillon" || id === "repousser_renforce" || id === "seisme") && selfValid(u2, id);
    });
  }
  const blocked = () => now - lastWound >= P.stallTime || !units.some((x) => inPlay(x) && canHit(x));
  function mainRange(u2) {
    for (const id of u2.skills) {
      const sk = SK[id];
      if (sk && sk.kind === "active" && sk.target === "enemy") return sk.range;
    }
    return 1;
  }
  function condOk(u2, r) {
    const v = r.v ?? 0;
    switch (r.cond) {
      case "always":
        return true;
      case "selfHpBelow":
        return u2.hp * 100 < v * u2.hpMax;
      case "allyHpBelow":
        return alliesOf(u2).some((a) => a.hp * 100 < v * a.hpMax);
      case "selfWillBelow":
        return u2.will * 100 < v * u2.willMax;
      case "selfEnergyBelow":
        return u2.energy * 100 < v * u2.energyMax;
      case "selfEnergyAbove":
        return u2.energy * 100 >= v * u2.energyMax;
      case "selfManaBelow":
        return u2.manaMax > 0 && u2.mana * 100 < v * u2.manaMax;
      case "enemyInRange":
        return enemiesOf(u2).some((e) => dEnemy(u2, e) <= mainRange(u2));
      case "noEnemyInRange":
        return !enemiesOf(u2).some((e) => dEnemy(u2, e) <= mainRange(u2));
      case "myDist":
        return rank(u2) === v;
      case "enemiesAtLeast":
        return enemiesOf(u2).length >= v;
      case "timeAtLeast":
        return now >= v;
      case "selfHasState":
        return !!has(u2, r.s ?? "");
      case "selfLacksState":
        return !has(u2, r.s ?? "");
      default:
        return true;
    }
  }
  function select2(u2, list, sel, kind) {
    if (!list.length) return void 0;
    if (kind === "self") return list[0];
    if (kind === "ally" && sel !== "mostWoundedAlly" && sel !== "self") sel = "mostWoundedAlly";
    if (kind === "ally" && sel === "self") return list.find((x) => x === u2) ?? list[0];
    if (kind === "enemy" && (sel === "mostWoundedAlly" || sel === "self")) sel = "nearestEnemy";
    const d = (e) => kind === "ally" ? dAlly(u2, e) : dEnemy(u2, e);
    const base = (a, b) => a.hp - b.hp || d(a) - d(b) || a.slot - b.slot;
    const sorted = [...list];
    switch (sel) {
      case "nearestEnemy":
        sorted.sort((a, b) => d(a) - d(b) || a.hp - b.hp || a.slot - b.slot);
        break;
      case "weakestEnemy":
        sorted.sort(base);
        break;
      case "strongestEnemy":
        sorted.sort((a, b) => b.hp - a.hp || d(a) - d(b) || a.slot - b.slot);
        break;
      case "lowestWillEnemy":
        sorted.sort((a, b) => pct(a.will, a.willMax) - pct(b.will, b.willMax) || base(a, b));
        break;
      case "mostWoundedAlly":
        sorted.sort((a, b) => pct(a.hp, a.hpMax) - pct(b.hp, b.hpMax) || base(a, b));
        break;
      case "randomEnemy":
        return pick(sorted.sort(base));
    }
    return sorted[0];
  }
  const isHealSkill = (id) => id === "soin_mineur" || id === "priere" || !!SK[id]?.fx && (SK[id].ai === "heal" || SK[id].ai === "groupHeal");
  const isHotSkill = (id) => id === "regeneration" || !!SK[id]?.fx?.some((f) => f.k === "state" && f.s === "regeneration");
  function choose(u2) {
    for (let i = 0; i < u2.rules.length; i++) {
      const r = u2.rules[i];
      const id = r.action;
      if (!COMMON.has(id) && (!u2.active.has(id) || !SK[id] || SK[id].kind !== "active")) continue;
      if (!COMMON.has(id) && SK[id].mana > 0 && has(u2, "silence")) continue;
      if (!condOk(u2, r)) continue;
      let list = candidates(u2, id);
      if (P.healCooldown && isHealSkill(id)) {
        const v = r.v ?? 0;
        if (!alliesOf(u2).some((a) => healReady(a) && (r.cond !== "allyHpBelow" || a.hp * 100 < v * a.hpMax))) continue;
        if (SK[id].target === "ally") list = list.filter(healReady);
      }
      if (P.hotCooldown && isHotSkill(id)) {
        if (SK[id].target === "ally") list = list.filter(hotReady);
        else if (!alliesOf(u2).some(hotReady)) continue;
      }
      if (r.cond === "targetHasState") list = list.filter((x) => has(x, r.s ?? ""));
      if (r.cond === "targetLacksState") list = list.filter((x) => !has(x, r.s ?? ""));
      const kind = COMMON.has(id) ? "self" : SK[id].target;
      const target = select2(u2, list, r.target, kind);
      if (!target) continue;
      if (!COMMON.has(id) && P.manaSkipsRule && u2.mana < SK[id].mana) continue;
      return { i, id, target };
    }
    return null;
  }
  function wait(u2, why) {
    emit({ k: "wait", u: u2.id, why });
    u2.pendingRegen += Math.floor(u2.energyMax * P.waitRegen / 1e3);
    u2.pendingMana += Math.floor(u2.manaMax * (P.waitManaRegen ?? 0) / 1e3);
    return durMod(u2, Math.floor(u2.speed * P.moveMult / 1e3));
  }
  function act2(u2) {
    if (u2.pendingRegen) {
      setGauge(u2, "energy", u2.energy + u2.pendingRegen, "Attendre");
      u2.pendingRegen = 0;
    }
    if (u2.pendingMana) {
      setGauge(u2, "mana", u2.mana + u2.pendingMana, "Attendre");
      u2.pendingMana = 0;
    }
    const g2 = has(u2, "gele");
    if (g2 && g2.end > now) {
      emit({ k: "frozen", u: u2.id, until: g2.end });
      u2.nextAt = g2.end;
      return;
    }
    u2.acting = true;
    u2.extraDelay = 0;
    let dur;
    const c = blocked() && rank(u2) > 1 ? { i: -1, id: "avancer", target: u2 } : choose(u2);
    if (!c) dur = wait(u2, "norule");
    else if (c.id === "attendre") {
      emit({ k: "act", u: u2.id, rule: c.i, skill: c.id });
      dur = wait(u2, "choice");
    } else if (COMMON.has(c.id)) {
      emit({ k: "act", u: u2.id, rule: c.i, skill: c.id });
      if (c.id === "avancer") setDist(u2, Math.max(1, ...alliesOf(u2).map((a) => a.dist).filter((d) => d < u2.dist)), c.i < 0 ? "Approche automatique" : "Avancer");
      if (c.id === "reculer") setDist(u2, u2.dist + 1, "Reculer");
      dur = durMod(u2, Math.floor(u2.speed * (c.id === "fuir" ? P.fleeMult : P.moveMult) / 1e3));
      if (c.id === "fuir") {
        u2.fled = true;
        emit({ k: "flee", u: u2.id });
        checkEnd();
      }
    } else {
      const sk = SK[c.id];
      const energy = sk.energy + Math.floor(u2.weapon.cost * (sk.energyW ?? 0) / 1e3);
      if (u2.energy < energy || u2.mana < sk.mana) {
        dur = wait(u2, "energy");
      } else {
        emit({ k: "act", u: u2.id, rule: c.i, skill: c.id, target: c.target.id });
        let out = "ok";
        const conf = has(u2, "confusion");
        const wp = pct(u2.will, u2.willMax);
        if (conf) {
          out = "half";
          removeState(u2, "confusion");
          emit({ k: "will", u: u2.id, pct: wp, res: out, forced: true });
        } else {
          if (wp < 500) {
            const roll = rng2.int(2);
            if (roll === 1) out = wp < 200 ? "crit" : "half";
          }
          emit({ k: "will", u: u2.id, pct: wp, res: out });
        }
        if (energy) setGauge(u2, "energy", u2.energy - energy, sk.name);
        if (sk.mana) setGauge(u2, "mana", u2.mana - sk.mana, sk.name);
        resolve(u2, c.id, sk, c.target, out);
        const base = sk.durBase === "weapon" ? u2.weapon.speed : u2.speed;
        dur = durMod(u2, Math.floor(base * sk.durMult / 1e3));
      }
    }
    u2.nextAt = now + dur + u2.extraDelay;
    u2.acting = false;
    u2.extraDelay = 0;
  }
  function resolve(u2, id, sk, t, out) {
    const p = sk.p;
    const lost = (why) => emit({ k: "lost", u: u2.id, why });
    const otherEnemy = () => pick(candidates(u2, id).filter((e) => e !== t));
    const randomAllyInRange = (range = sk.range) => pick(alliesOf(u2).filter((a) => a !== u2 && dAlly(u2, a) <= Math.max(0, range)));
    const anyAlly = () => pick(alliesOf(u2).filter((a) => a !== u2));
    const rankOf = (x) => units.filter((y) => inPlay(y) && y.side === x.side && y.dist === x.dist);
    const name = sk.name;
    switch (id) {
      case "emploi":
      case "tir_fronde":
      case "tir_arc": {
        if (out === "ok") weaponHit(u2, t, 1e3, sk, name);
        else if (out === "half") {
          const o = otherEnemy();
          o ? weaponHit(u2, o, 1e3, sk, name) : lost("aucun autre ennemi \xE0 port\xE9e");
        } else if (id === "emploi") weaponHit(u2, u2, 1e3, sk, `${name} (sur soi)`, { melee: false });
        else {
          const a = anyAlly();
          a ? weaponHit(u2, a, 1e3, sk, `${name} (sur un alli\xE9)`, { melee: false }) : lost("aucun alli\xE9");
        }
        break;
      }
      case "exploit": {
        if (out === "ok") {
          weaponHit(u2, t, p.mult, sk, name);
          if (u2.weapon.type === "tranchant") addState(t, "saignement", u2, p.bleedDur, p.bleed);
          else stun(t, u2, p.stun);
        } else if (out === "half") lost("rien ne se passe");
        else {
          const a = randomAllyInRange(1);
          a ? weaponHit(u2, a, p.mult, sk, `${name} (sur un alli\xE9)`, { melee: false }) : lost("aucun alli\xE9 \xE0 port\xE9e");
        }
        break;
      }
      case "meditation":
        if (out === "crit") loseHp(u2, Math.floor(u2.hpMax * p.crit / 1e3), "M\xE9ditation rat\xE9e");
        else changeWill(u2, out === "ok" ? p.ok : p.half, name);
        break;
      case "repos":
        if (out === "ok") setGauge(u2, "energy", u2.energy + Math.floor(u2.energyMax * p.ok / 1e3), name);
        else if (out === "half") lost("rien ne se passe");
        else loseHp(u2, Math.floor(u2.hpMax * p.crit / 1e3), "Repos rat\xE9");
        break;
      case "coup_bouclier":
        if (out === "crit") stun(u2, u2, p.stun);
        else {
          weaponHit(u2, t, p.mult, sk, name);
          if (out === "ok") stun(t, u2, p.stun);
        }
        break;
      case "repousser":
      case "repousser_renforce": {
        if (out === "crit") {
          setDist(u2, u2.dist + 1, "recule");
          break;
        }
        const targets = id === "repousser" ? [t] : enemiesOf(u2).filter((e) => dEnemy(u2, e) === 1);
        for (const x of targets) {
          weaponHit(u2, x, p.mult, sk, name);
          if (out === "ok" && inPlay(x)) {
            if (x.dist === 3) stun(x, u2, p.stun);
            else setDist(x, x.dist + 1, "repouss\xE9");
          }
        }
        break;
      }
      case "provocation":
        if (out === "crit") changeWill(u2, -p.crit, "Provocation rat\xE9e");
        else addState(u2, "provocation", u2, out === "ok" ? p.dur : p.halfDur);
        break;
      case "mur_boucliers":
        if (out === "crit") lost("rien ne se passe");
        else for (const a of out === "ok" ? rankOf(u2) : [u2]) addState(a, "bouclier", u2, p.dur, p.shield);
        break;
      case "execution":
      case "fracas": {
        if (out === "crit") {
          const a = randomAllyInRange(1);
          a ? weaponHit(u2, a, 1e3, sk, `${name} (sur un alli\xE9)`, { melee: false }) : lost("aucun alli\xE9 \xE0 port\xE9e");
          break;
        }
        if (out === "half") {
          if (id === "fracas") weaponHit(u2, t, p.half, sk, name);
          else lost("rien ne se passe");
          break;
        }
        let mult = 1e3;
        if (id === "execution" && t.hp * 1e3 < t.hpMax * p.threshold) mult = p.bonusMult;
        if (id === "fracas" && has(t, "gele")) {
          mult = p.bonusMult;
          removeState(t, "gele");
          emit({ k: "passive", u: u2.id, name, text: "le gel est bris\xE9" });
        }
        weaponHit(u2, t, mult, sk, name);
        break;
      }
      case "brise_armure":
        if (out === "crit") {
          addState(u2, "brise", u2, p.dur, -p.res, { cap: p.cap });
          break;
        }
        weaponHit(u2, t, p.mult, sk, name);
        if (out === "ok") addState(t, "brise", u2, p.dur, -p.res, { cap: p.cap });
        break;
      case "charge":
        setDist(u2, 1, "Charge");
        if (out === "ok") weaponHit(u2, t, p.mult, sk, name);
        else if (out === "crit") stun(u2, u2, p.stun);
        else lost("avance sans frapper");
        break;
      case "volee": {
        if (out === "crit") {
          lost("rien ne se passe");
          break;
        }
        for (const x of out === "ok" ? rankOf(t) : [t]) weaponHit(u2, x, p.mult, sk, name);
        break;
      }
      case "tir_precis":
        if (out === "crit") lost("rien ne se passe");
        else weaponHit(u2, t, out === "ok" ? p.mult : 1e3, sk, name, { ignoreHalf: out === "ok" });
        break;
      case "marque":
        if (out === "crit") {
          const a = pick(alliesOf(u2));
          if (a) addState(a, "marque", u2, p.dur, p.uses);
        } else addState(t, "marque", u2, p.dur, out === "ok" ? p.uses : 1);
        break;
      case "soin_mineur":
        if (out === "crit") loseHp(t, Math.floor(t.hpMax * p.crit / 1e3), "Soin rat\xE9", u2);
        else heal2(t, Math.floor(t.hpMax * (out === "ok" ? p.ok : p.half) / 1e3), name, true);
        break;
      case "regeneration":
        if (out === "crit") {
          const e = pick(enemiesOf(u2));
          if (e) addState(e, "regeneration", u2, p.dur, p.perTick);
        } else addState(t, "regeneration", u2, out === "ok" ? p.dur : p.halfDur, p.perTick);
        break;
      case "priere":
        if (out === "crit") changeWill(u2, -p.crit, "Pri\xE8re rat\xE9e");
        else for (const a of out === "ok" ? alliesOf(u2) : rankOf(u2)) heal2(a, Math.floor(a.hpMax * p.ok / 1e3), name, true);
        break;
      case "purification": {
        if (out === "crit") {
          for (const s3 of t.states.filter((s4) => !isNegative(s4))) removeState(t, s3.id);
          break;
        }
        const neg = t.states.filter(isNegative).sort((a, b) => b.order - a.order);
        for (const s3 of out === "ok" ? neg : neg.slice(0, 1)) removeState(t, s3.id);
        if (!neg.length) lost("aucun \xE9tat n\xE9gatif");
        break;
      }
      case "trait_sacre":
      case "trait_sacre_renforce": {
        if (out === "crit") {
          heal2(t, p.dmg, `${name} rat\xE9`);
          break;
        }
        let base = p.dmg;
        if (out === "half") base = Math.floor(base / 2);
        const raw = base + atk(u2);
        const bonus = t.tags.some((x) => x === "mort-vivant" || x === "demon") ? p.tagMult : 1e3;
        damage(u2, t, Math.floor(raw * bonus / 1e3), "sacre", { cause: name });
        break;
      }
      case "bouclier_foi":
        if (out === "crit") lost("mana perdu");
        else addState(t, "bouclier", u2, p.dur, out === "ok" ? p.ok : p.half);
        break;
      case "confusion":
      case "confusion_moine":
        if (out === "ok") addState(t, "confusion", u2, p.dur);
        else if (out === "half") changeWill(t, -p.half, name);
        else addState(u2, "confusion", u2, p.dur);
        break;
      case "trait_flammes":
        if (out === "crit") {
          addState(u2, "brulure", u2, p.burnDur, p.burn);
          break;
        }
        spellHit(u2, t, p.dmg, "feu", name);
        if (out === "ok") addState(t, "brulure", u2, p.burnDur, p.burn);
        break;
      case "boule_feu": {
        if (out === "crit") {
          for (const a of rankOf(u2)) spellHit(u2, a, a === u2 ? p.dmg : p.splash, "feu", `${name} (explose)`);
          break;
        }
        let main = t;
        if (out === "half") {
          const o = pick(rankOf(t).filter((x) => x !== t));
          if (!o) {
            lost("la boule manque sa cible");
            break;
          }
          main = o;
        }
        const rank2 = rankOf(main);
        spellHit(u2, main, p.dmg, "feu", name);
        if (out === "ok") {
          for (const x of rank2) if (x !== main) spellHit(u2, x, p.splash, "feu", name);
          addState(main, "brulure", u2, p.burnDur, p.burn);
        }
        break;
      }
      case "arme_enflammee":
        if (out === "crit") addState(t, "brulure", u2, p.burnDur, p.burn);
        else addState(t, "arme_feu", u2, out === "ok" ? p.dur : p.halfDur, p.bonus, { v2: p.burn });
        break;
      case "mur_flammes": {
        const list = out === "ok" ? rankOf(t) : out === "half" ? [t] : rankOf(u2);
        for (const x of list) addState(x, "brulure", u2, p.burnDur, p.burn);
        break;
      }
      case "embrasement": {
        const burning = (side) => units.filter((x) => inPlay(x) && x.side === side && has(x, "brulure"));
        let list = out === "crit" ? burning(u2.side) : burning(1 - u2.side);
        if (out === "half") list = list.sort((a, b) => dEnemy(u2, a) - dEnemy(u2, b) || a.slot - b.slot).slice(0, 1);
        if (!list.length) lost("personne ne br\xFBle");
        for (const x of list) {
          const b = has(x, "brulure");
          const ticks = Math.floor(b.end / P.tick) - Math.floor(now / P.tick);
          const dmg = b.v * b.charges * Math.max(0, ticks) * 2;
          removeState(x, "brulure");
          if (dmg > 0) damage(u2, x, dmg, "feu", { cause: name });
        }
        break;
      }
      case "lame_saignante":
        if (out === "crit") {
          addState(u2, "saignement", u2, p.bleedDur, p.bleed);
          break;
        }
        weaponHit(u2, t, p.mult, sk, name);
        if (out === "ok") addState(t, "saignement", u2, p.bleedDur, p.bleed);
        break;
      case "cri_guerre":
        if (out === "crit") {
          for (const a of alliesOf(u2)) changeWill(a, -p.crit, "Cri rat\xE9");
          break;
        }
        for (const a of out === "ok" ? alliesOf(u2) : [u2]) {
          changeWill(a, p.will, name);
          addState(a, "cri", u2, p.dur, p.atk);
        }
        break;
      case "tourbillon": {
        const foes = enemiesOf(u2).filter((e) => dEnemy(u2, e) === 1);
        for (const x of foes) weaponHit(u2, x, out === "half" ? p.half : 1e3, sk, name);
        if (out === "crit") {
          for (const a of rankOf(u2)) if (a !== u2) weaponHit(u2, a, 1e3, sk, `${name} (alli\xE9)`, { melee: false });
        }
        break;
      }
      case "morsure":
        if (out === "crit") {
          lost("rien ne se passe");
          break;
        }
        {
          const weak = t.hp * 1e3 < t.hpMax * p.threshold;
          weaponHit(u2, t, 1e3, sk, name);
          if (out === "ok" && weak) addState(t, "saignement", u2, p.bleedDur, p.bleed);
        }
        break;
      case "hurlement":
        if (out === "crit") {
          for (const a of alliesOf(u2)) changeWill(a, -p.crit, "Hurlement rat\xE9");
          break;
        }
        for (const a of alliesOf(u2)) changeWill(a, p.ally, name);
        if (out === "ok") {
          for (const e of enemiesOf(u2)) if (rank(e) <= 2) changeWill(e, -p.enemy, name);
        }
        break;
      case "drain":
        if (out === "crit") {
          loseHp(u2, p.crit, "Drain invers\xE9");
          heal2(t, p.crit, "Drain invers\xE9");
          break;
        }
        {
          const dealt = spellHit(u2, t, p.dmg, "tenebres", name);
          if (out === "ok") heal2(u2, Math.floor(dealt / 2), name);
        }
        break;
      case "murmure":
      case "terreur_masse": {
        if (out === "crit") {
          changeWill(u2, -p.crit, "Terreur retourn\xE9e");
          break;
        }
        for (const x of id === "terreur_masse" ? rankOf(t) : [t]) {
          if (out === "ok") spellHit(u2, x, p.dmg, "psychique", name);
          changeWill(x, -(out === "ok" ? p.will : p.half), name);
        }
        break;
      }
      case "malediction":
        addState(out === "crit" ? u2 : t, "malediction", u2, out === "half" ? p.halfDur : p.dur, -p.res);
        break;
      case "nuage":
      case "nuage_renforce": {
        const list = out === "ok" ? rankOf(t) : out === "half" ? [pick(rankOf(t))] : rankOf(u2);
        for (const x of list) addState(x, "poison", u2, p.dur, p.dmg, { cap: p.cap });
        break;
      }
      case "lien_vital":
        if (out === "crit") addState(t, "lien", u2, p.dur, 0, { other: u2.id });
        else addState(u2, "lien", u2, out === "ok" ? p.dur : p.halfDur, 0, { other: t.id });
        break;
      case "hate":
        addState(u2, out === "crit" ? "ralenti" : "hate", u2, out === "half" ? p.halfDur : p.dur);
        break;
      case "paume_vide":
        if (out === "crit") {
          addState(u2, "confusion", u2, p.confDur);
          break;
        }
        spellHit(u2, t, p.dmg, "psychique", name, { melee: true });
        if (out === "ok") {
          addState(t, "confusion", u2, p.confDur);
          changeWill(t, -p.will, name);
        }
        break;
      case "seisme":
        if (out === "crit") {
          stun(u2, u2, p.stun);
          loseHp(u2, Math.floor(u2.hpMax * p.crit / 1e3), "S\xE9isme rat\xE9");
          break;
        }
        for (const e of enemiesOf(u2).filter((e2) => rank(e2) <= 2)) {
          spellHit(u2, e, p.dmg, "contondant", name);
          if (out === "ok" && inPlay(e) && dEnemy(u2, e) === 1) stun(e, u2, p.stun);
        }
        break;
      case "fleche_givre":
        if (out === "crit") {
          addState(u2, "ralenti", u2, p.slowDur);
          break;
        }
        if (out === "ok") spellHit(u2, t, p.dmg, "glace", name);
        if (!inPlay(t)) break;
        if (out === "ok" && has(t, "ralenti") && (thawUntil.get(t.id) ?? -1) <= now) {
          removeState(t, "ralenti");
          addState(t, "gele", u2, p.freezeDur);
          thawUntil.set(t.id, now + p.freezeDur + (p.freezeImmune ?? 0));
        } else addState(t, "ralenti", u2, p.slowDur);
        break;
      case "grappin":
        if (out === "crit") setDist(u2, 1, "tir\xE9 par le grappin");
        else setDist(t, out === "ok" ? 1 : t.dist - 1, "Grappin");
        break;
      default:
        if (sk.fx) runFx(u2, sk, t, out);
        else lost(`comp\xE9tence ${id} sans effet dans le prototype`);
    }
  }
  let fxDirectHeal = false;
  function runFx(u2, sk, t, out) {
    fxDirectHeal = sk.ai === "heal" || sk.ai === "groupHeal";
    const name = sk.name;
    const fx = sk.fx;
    const hostile = sk.target === "enemy";
    if (out === "crit") {
      if (!hostile) {
        emit({ k: "lost", u: u2.id, why: "sort rat\xE9" });
        return;
      }
      const f = fx[0];
      applyFx(u2, { ...f, area: "self", v: Math.floor((f.v ?? 0) / 2), dur: Math.floor((f.dur ?? 0) / 2) }, u2, `${name} (retourn\xE9)`);
      return;
    }
    for (const f of fx) {
      const g2 = out === "half" ? { ...f, v: f.k === "push" || f.k === "pull" ? f.v : Math.floor((f.v ?? 0) / 2), dur: Math.floor((f.dur ?? 0) / 2), area: f.area === "self" ? "self" : "target" } : f;
      applyFx(u2, g2, t, name);
    }
  }
  function fxTargets(u2, t, area) {
    switch (area) {
      case "target":
        return inPlay(t) ? [t] : [];
      case "rank":
        return units.filter((y) => inPlay(y) && y.side === t.side && y.dist === t.dist);
      case "allEnemies":
        return enemiesOf(u2);
      case "front":
        return enemiesOf(u2).filter((e) => rank(e) <= 2);
      case "self":
        return [u2];
      case "allies":
        return alliesOf(u2);
      case "allyRank":
        return alliesOf(u2).filter((a) => a.dist === u2.dist);
    }
  }
  function applyFx(u2, f, t, cause) {
    for (const x of fxTargets(u2, t, f.area ?? "target")) {
      if (!inPlay(x) || ended) continue;
      if (f.ifState && !has(x, f.ifState)) continue;
      const v = f.v ?? 0;
      const bonus = f.tag && x.tags.includes(f.tag) ? f.tagMult ?? 1e3 : 1e3;
      switch (f.k) {
        case "dmg":
          spellHit(u2, x, Math.floor(v * bonus / 1e3), f.type ?? "contondant", cause);
          break;
        case "wdmg": {
          const type = f.type ?? u2.weapon.type;
          damage(u2, x, Math.floor(weaponRaw(u2, v) * bonus / 1e3), type, { cause, melee: dEnemy(u2, x) === 1 && x.side !== u2.side });
          break;
        }
        case "drain": {
          const dealt = spellHit(u2, x, v, f.type ?? "tenebres", cause);
          heal2(u2, Math.floor(dealt / 2), cause);
          break;
        }
        case "heal":
          heal2(x, Math.floor(x.hpMax * v / 1e3), cause, fxDirectHeal);
          break;
        case "will":
          changeWill(x, v, cause);
          break;
        case "mana":
          if (x.manaMax > 0) setGauge(x, "mana", x.mana + Math.trunc(x.manaMax * v / 1e3), cause);
          break;
        case "energy":
          setGauge(x, "energy", x.energy + Math.trunc(x.energyMax * v / 1e3), cause);
          break;
        case "stun":
          stun(x, u2, v);
          break;
        case "push":
          setDist(x, x.dist + (v || 1), cause);
          break;
        case "pull":
          setDist(x, x.dist - (v || 1), cause);
          break;
        case "cleanse":
          for (const s3 of x.states.filter(isNegative)) removeState(x, s3.id);
          break;
        case "state":
          if (f.s === "etourdi") stun(x, u2, f.dur ?? 0);
          else addState(x, f.s, u2, f.dur ?? 0, v, f.cap ? { cap: f.cap } : {});
          break;
      }
    }
  }
  function tick() {
    emit({ k: "tick" });
    for (const u2 of ordered()) {
      for (const s3 of [...u2.states].sort((a, b) => a.order - b.order)) {
        if (!inPlay(u2)) break;
        const caster = byId.get(s3.caster);
        if (P.dotTick) continue;
        if (DOT[s3.id]) damage(caster, u2, s3.v * s3.charges, DOT[s3.id], { cause: STATE_NAMES[s3.id], tick: true });
        if (s3.id === "regeneration") heal2(u2, Math.floor(u2.hpMax * s3.v / 1e3), "R\xE9g\xE9n\xE9ration");
      }
    }
    for (const u2 of ordered()) if (passive(u2, "aura_serenite")) {
      for (const a of alliesOf(u2)) if (a.dist === u2.dist) changeWill(a, SK.aura_serenite.p.will, "Aura de s\xE9r\xE9nit\xE9");
    }
    for (const u2 of units) u2.attackers.clear();
  }
  function dotTick() {
    for (const u2 of ordered()) {
      for (const s3 of [...u2.states].sort((a, b) => a.order - b.order)) {
        if (!inPlay(u2)) break;
        const caster = byId.get(s3.caster);
        if (DOT[s3.id]) damage(caster, u2, s3.v * s3.charges, DOT[s3.id], { cause: STATE_NAMES[s3.id], tick: true });
        if (s3.id === "regeneration") heal2(u2, Math.floor(u2.hpMax * s3.v / 1e3), "R\xE9g\xE9n\xE9ration");
      }
    }
  }
  let lastTick = 0, lastDot = 0;
  checkEnd();
  while (!ended) {
    const actor = ordered()[0];
    const nextTick = lastTick + P.tick;
    const nextDot = P.dotTick ? lastDot + P.dotTick : Infinity;
    const nextAction = actor ? actor.nextAt : Infinity;
    const t = Math.min(nextTick, nextDot, nextAction);
    if (t > P.timeLimit) {
      now = P.timeLimit;
      ended = { winner: 1, reason: "timeout" };
      emit({ k: "end", winner: 1, reason: "timeout" });
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
    } else act2(actor);
  }
  const fin = ended;
  return {
    log,
    result: {
      winner: fin.winner,
      reason: fin.reason,
      time: now,
      units: units.map((u2) => ({ id: u2.id, hp: u2.hp, mana: u2.mana, dead: !u2.alive, fled: u2.fled, dmgDealt: u2.dmgDealt, kills: u2.kills }))
    }
  };
}
function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

