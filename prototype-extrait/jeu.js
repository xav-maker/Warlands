var SAVE_VERSION = 2;
var C = gameContent();
function newGame(seed) {
  const g2 = {
    v: SAVE_VERSION,
    seed,
    gold: ECO.startGold,
    where: "ville",
    step: 0,
    cleared: REGIONS[0].territory.steps.map(() => false),
    encounter: null,
    region: 0,
    unlocked: 0,
    guardians: REGIONS.map(() => false),
    gauges: GAUGE_MULT,
    bag: { stacks: {}, equip: [] },
    bank: { stacks: { ...ECO.startItems }, equip: [] },
    troops: [],
    recipes: genRecipes(C, seed),
    counter: 0,
    pending: [],
    journal: [],
    last: null,
    stats: { fights: 0, wins: 0, deaths: 0, crafts: 0 }
  };
  for (const [id, q] of g2.recipes[ECO.startRecipe].ingredients) g2.bank.stacks[id] = (g2.bank.stacks[id] ?? 0) + q;
  for (const [type, lvl] of ECO.startTroops) addTroop(g2, type, lvl, true);
  ensureQuests(g2);
  note(g2, `Arriv\xE9e \xE0 ${REGIONS[0].city.name} avec ${g2.troops.map(troopName).join(" et ")}.`);
  return g2;
}
function upgradeSave(g2) {
  const k = GAUGE_MULT / (g2.gauges ?? 1);
  if (k !== 1) for (const t of g2.troops) for (const u2 of t.units) {
    u2.hp = Math.round(u2.hp * k);
    u2.mana = Math.round(u2.mana * k);
    clampUnit(t, u2);
  }
  g2.gauges = GAUGE_MULT;
  ensureQuests(g2);
  return g2;
}
var regionOf = (g2) => REGIONS[g2.region];
var cityOf = (g2) => REGIONS[g2.region].city;
var terrIndex = (g2) => g2.where === "territoire" ? g2.terr ?? g2.region : g2.region;
var territoryOf = (g2) => REGIONS[terrIndex(g2)].territory;
var dirOf = (g2) => g2.where === "territoire" ? g2.dir ?? 1 : 1;
var stepOrder = (g2) => [...Array(territoryOf(g2).steps.length).keys()];
function destination(g2) {
  const t = terrIndex(g2), d = dirOf(g2);
  const r = d > 0 ? t + 1 : t;
  return r >= 0 && r < REGIONS.length && r !== g2.region ? r : null;
}
function rng(g2, what) {
  return new Rng(hash(g2.seed, what, g2.counter++));
}
function note(g2, s3) {
  g2.journal.unshift(s3);
  if (g2.journal.length > 60) g2.journal.length = 60;
}
var fail = (msg) => {
  throw new Error(msg);
};
function troopActive(t) {
  const d = C.troops[t.type];
  const known = learned(d, t.form, t.level);
  const base = basicAttack(d);
  const act2 = t.strat ? t.strat.active.filter((k) => known.includes(k)) : defaultActive(d, t.form, t.level);
  return act2.includes(base) ? act2 : [base, ...act2.slice(0, 5)];
}
function troopRules(t) {
  return JSON.parse(JSON.stringify(t.strat ? t.strat.rules : defaultRules(C.troops[t.type], t.form, t.level)));
}
function troopName(t) {
  return C.troops[t.type].forms.find((f) => f.id === t.form)?.name ?? C.troops[t.type].name;
}
function troopDef(t) {
  return C.troops[t.type];
}
function addTroop(g2, type, level, squad2) {
  const def = C.troops[type];
  const r = rng(g2, "troupe");
  const t = { uid: "t" + r.next().toString(36), type, level, xp: 0, form: def.forms[0].id, units: [], rank: def.defaultDist, squad: false, bornAt: g2.stats.fights };
  for (let i = 0; i < def.units; i++) t.units.push(freshUnit(t));
  g2.troops.push(t);
  if (squad2 && squadCheck(g2, t) === null) t.squad = true;
  return t;
}
function freshUnit(t) {
  const s3 = computeStats(C.troops[t.type], t.form, t.level);
  return { hp: s3.hpMax, mana: s3.manaMax, equip: {} };
}
function unitStats(t, u2) {
  const def = C.troops[t.type];
  const s3 = computeStats(def, t.form, t.level);
  const res = { ...s3.res };
  const weaponBase = u2.equip.arme ? { ...EQUIP[u2.equip.arme.base].weapon, name: EQUIP[u2.equip.arme.base].name } : { ...C.weapons[def.weapon] };
  const out = { ...s3, res, weapon: weaponBase };
  for (const it of Object.values(u2.equip)) {
    if (!it) continue;
    for (const st0 of it.stats) {
      const st = { ...st0, v: boost(st0) };
      switch (st.k) {
        case "atk":
          out.atk += st.v;
          break;
        case "hp":
          out.hpMax += st.v * GAUGE_MULT;
          break;
        case "will":
          out.willMax += st.v;
          break;
        case "energy":
          out.energyMax += st.v * GAUGE_MULT;
          break;
        case "mana":
          out.manaMax += st.v * GAUGE_MULT;
          break;
        case "res":
          res[st.type] = (res[st.type] ?? 0) + st.v * 10;
          break;
        case "wdmg":
          out.weapon.dmg += st.v;
          break;
        case "wspeed":
          out.weapon.speed = Math.max(8, out.weapon.speed - st.v);
          break;
        case "wcost":
          out.weapon.cost = Math.max(1, out.weapon.cost - st.v);
          break;
      }
    }
  }
  return out;
}
function clampUnit(t, u2) {
  const s3 = unitStats(t, u2);
  u2.hp = Math.max(1, Math.min(u2.hp, s3.hpMax));
  u2.mana = Math.max(0, Math.min(u2.mana, s3.manaMax));
}
function squad(g2) {
  return g2.troops.filter((t) => t.squad);
}
function squadUsage(g2, extra) {
  const list = [...squad(g2), ...extra && !extra.squad ? [extra] : []];
  return { pop: list.reduce((a, t) => a + C.troops[t.type].pop, 0), slots: list.reduce((a, t) => a + t.units.length, 0) };
}
function squadCheck(g2, t) {
  const u2 = squadUsage(g2, t);
  if (u2.pop > 5) return "population d\xE9pass\xE9e (5 au plus)";
  if (u2.slots > 5) return "plus que 5 emplacements";
  return null;
}
function slotsUsed(s3) {
  return Object.entries(s3.stacks).reduce((a, [id, q]) => a + (q > 0 ? Math.ceil(q / STACK[ITEMS[id].kind]) : 0), 0) + s3.equip.length;
}
var capacity = (g2, s3) => s3 === g2.bag ? ECO.bagSlots : ECO.bankSlots;
function addStack(g2, s3, id, qty) {
  const per = STACK[ITEMS[id].kind];
  const cap = capacity(g2, s3);
  let left = qty;
  while (left > 0) {
    const cur = s3.stacks[id] ?? 0;
    const room = cur % per === 0 ? 0 : per - cur % per;
    if (room > 0) {
      const n2 = Math.min(room, left);
      s3.stacks[id] = cur + n2;
      left -= n2;
      continue;
    }
    if (slotsUsed(s3) >= cap) break;
    const n = Math.min(per, left);
    s3.stacks[id] = cur + n;
    left -= n;
  }
  return left;
}
function addEquip(g2, s3, it) {
  if (slotsUsed(s3) >= capacity(g2, s3)) return false;
  s3.equip.push(it);
  return true;
}
function takeStack(s3, id, qty) {
  const cur = s3.stacks[id] ?? 0;
  if (cur < qty) fail(`pas assez de ${ITEMS[id].name}`);
  if (cur === qty) delete s3.stacks[id];
  else s3.stacks[id] = cur - qty;
}
function have(g2, id) {
  return (g2.bank.stacks[id] ?? 0) + (g2.bag.stacks[id] ?? 0);
}
function consume(g2, id, qty) {
  const fromBank = Math.min(qty, g2.bank.stacks[id] ?? 0);
  if (fromBank) takeStack(g2.bank, id, fromBank);
  if (qty - fromBank) takeStack(g2.bag, id, qty - fromBank);
}
function inCity(g2) {
  if (g2.where !== "ville") fail("possible seulement en ville");
}
function canPay(g2, rec, mult = 1) {
  return g2.gold >= Math.ceil(rec.gold * mult) && rec.ingredients.every(([id, q]) => have(g2, id) >= Math.ceil(q * mult));
}
function pay(g2, rec, mult = 1) {
  if (!canPay(g2, rec, mult)) fail("ressources insuffisantes");
  g2.gold -= Math.ceil(rec.gold * mult);
  for (const [id, q] of rec.ingredients) consume(g2, id, Math.ceil(q * mult));
}
function recruit(g2, type) {
  inCity(g2);
  if (!cityOf(g2).recruit.includes(type)) fail("ce type ne se recrute pas ici");
  pay(g2, g2.recipes[type]);
  const t = addTroop(g2, type, recruitLevel(type), true);
  note(g2, `Recrutement : ${troopName(t)}${t.squad ? " (rejoint l\u2019escouade)" : " (en caserne)"}.`);
  return t;
}
function recruitLevel(type) {
  return REGIONS[Math.max(0, recruitRegion(type))].minLevel;
}
function rebuyCost(t) {
  const d = troopDef(t);
  return (d.units - t.units.length) / d.units;
}
function rebuy(g2, uidT) {
  inCity(g2);
  const t = findTroop(g2, uidT);
  const m2 = rebuyCost(t);
  if (m2 <= 0) fail("la troupe est compl\xE8te");
  if (recruitRegion(t.type) !== g2.region) fail(`se rach\xE8te \xE0 ${REGIONS[recruitRegion(t.type)].city.name}, sa ville de recrutement`);
  if (t.squad && squadUsage(g2).slots + (troopDef(t).units - t.units.length) > 5) fail("plus d\u2019emplacement libre dans l\u2019escouade");
  pay(g2, g2.recipes[t.type], m2);
  while (t.units.length < troopDef(t).units) t.units.push(freshUnit(t));
  note(g2, `${troopName(t)} : unit\xE9s manquantes rachet\xE9es.`);
}
function canBorrow(g2) {
  return g2.where === "ville" && g2.troops.length === 0;
}
function borrow(g2) {
  if (!canBorrow(g2)) fail("possible seulement sans aucune troupe");
  const t = addTroop(g2, "milicien", 1, true);
  note(g2, `La garde de ${cityOf(g2).name} pr\xEAte un ${troopName(t)}.`);
}
function heal(g2) {
  inCity(g2);
  for (const t of g2.troops) for (const u2 of t.units) {
    const s3 = unitStats(t, u2);
    u2.hp = s3.hpMax;
    u2.mana = s3.manaMax;
  }
  note(g2, "Le temple a soign\xE9 toutes les troupes (PV et mana au maximum).");
}
function craft(g2, out) {
  inCity(g2);
  const rec = g2.recipes[out];
  if (!rec || rec.kind === "recrue") fail("recette inconnue");
  const ws = workshopRegion(out);
  if (ws >= 0 && ws !== g2.region) fail(`seul l\u2019atelier de ${REGIONS[ws].city.name} sait fabriquer cet objet`);
  pay(g2, rec);
  g2.stats.crafts++;
  if (rec.kind === "equip") {
    const it = genEquip(out, rng(g2, "craft"));
    if (!addEquip(g2, g2.bank, it)) fail("banque pleine");
    note(g2, `Atelier : ${EQUIP[out].name} fabriqu\xE9(e).`);
    return it;
  }
  if (addStack(g2, g2.bank, out, 1)) fail("banque pleine");
  note(g2, `Atelier : ${ITEMS[out].name} fabriqu\xE9(e).`);
  return null;
}
var priceOf = (id) => Math.ceil((EQUIP[id]?.value ?? ITEMS[id].value) * ECO.sellMarkup);
function buy(g2, id) {
  inCity(g2);
  if (!cityOf(g2).shop.includes(id)) fail("le marchand ne vend pas cet objet");
  const p = priceOf(id);
  if (g2.gold < p) fail("pas assez d\u2019or");
  if (EQUIP[id]) {
    if (!addEquip(g2, g2.bank, genEquip(id, rng(g2, "achat"), ECO.shopRoll))) fail("banque pleine");
  } else if (addStack(g2, g2.bank, id, 1)) fail("banque pleine");
  g2.gold -= p;
  note(g2, `Achat : ${EQUIP[id]?.name ?? ITEMS[id].name} pour ${p} or.`);
}
function sellPrice(x) {
  return "id" in x ? Math.max(1, Math.floor(ITEMS[x.id].value * ECO.buyBack)) : Math.max(1, Math.floor(itemValue(x.equip) * ECO.buyBack));
}
function sellStack(g2, where, id, qty) {
  inCity(g2);
  takeStack(g2[where], id, qty);
  const p = sellPrice({ id }) * qty;
  g2.gold += p;
  note(g2, `Vente : ${qty} \xD7 ${ITEMS[id].name} pour ${p} or.`);
}
function sellEquip(g2, where, uidI) {
  inCity(g2);
  const s3 = g2[where];
  const i = s3.equip.findIndex((e) => e.uid === uidI);
  if (i < 0) fail("objet introuvable");
  const [it] = s3.equip.splice(i, 1);
  const p = sellPrice({ equip: it });
  g2.gold += p;
  note(g2, `Vente : ${EQUIP[it.base].name} pour ${p} or.`);
}
function transferStack(g2, from, id, qty) {
  inCity(g2);
  const to = from === "bag" ? g2.bank : g2.bag;
  takeStack(g2[from], id, qty);
  const left = addStack(g2, to, id, qty);
  if (left) {
    addStack(g2, g2[from], id, left);
    if (left === qty) fail(`${from === "bag" ? "banque" : "sac"} plein`);
  }
}
function transferEquip(g2, from, uidI) {
  inCity(g2);
  const src = g2[from], dst = from === "bag" ? g2.bank : g2.bag;
  const i = src.equip.findIndex((e) => e.uid === uidI);
  if (i < 0) fail("objet introuvable");
  if (slotsUsed(dst) >= capacity(g2, dst)) fail(`${from === "bag" ? "banque" : "sac"} plein`);
  dst.equip.push(...src.equip.splice(i, 1));
}
function discard(g2, x) {
  if ("uid" in x) {
    const i = g2.bag.equip.findIndex((e) => e.uid === x.uid);
    if (i >= 0) g2.bag.equip.splice(i, 1);
  } else takeStack(g2.bag, x.id, x.qty);
}
function findTroop(g2, uidT) {
  return g2.troops.find((t) => t.uid === uidT) ?? fail("troupe introuvable");
}
function equip(g2, uidT, ui, uidI) {
  const t = findTroop(g2, uidT);
  const u2 = t.units[ui] ?? fail("unit\xE9 introuvable");
  const fromBank = g2.bank.equip.some((e) => e.uid === uidI);
  if (fromBank) inCity(g2);
  const src = fromBank ? g2.bank : g2.bag;
  const i = src.equip.findIndex((e) => e.uid === uidI);
  if (i < 0) fail("objet introuvable");
  const it = src.equip[i];
  const why = canWear(t.type, t.level, it.base);
  if (why) fail(why);
  const slot = EQUIP[it.base].slot;
  src.equip.splice(i, 1);
  const old = u2.equip[slot];
  u2.equip[slot] = it;
  if (old) src.equip.push(old);
  clampUnit(t, u2);
}
function unequip(g2, uidT, ui, slot) {
  const t = findTroop(g2, uidT);
  const u2 = t.units[ui] ?? fail("unit\xE9 introuvable");
  const it = u2.equip[slot];
  if (!it) return;
  const dst = g2.where === "ville" ? g2.bank : g2.bag;
  if (!addEquip(g2, dst, it)) fail(`${dst === g2.bag ? "sac" : "banque"} plein`);
  delete u2.equip[slot];
  clampUnit(t, u2);
}
function toggleSquad(g2, uidT) {
  inCity(g2);
  const t = findTroop(g2, uidT);
  if (t.squad) {
    t.squad = false;
    return;
  }
  const why = squadCheck(g2, t);
  if (why) fail(why);
  t.squad = true;
}
function setRank(g2, uidT, r) {
  findTroop(g2, uidT).rank = Math.max(1, Math.min(3, r));
}
function useConsumable(g2, id, uidT, ui) {
  const it = ITEMS[id];
  if (it?.kind !== "consommable") fail("pas un consommable");
  const t = findTroop(g2, uidT);
  const u2 = t.units[ui] ?? fail("unit\xE9 introuvable");
  const s3 = unitStats(t, u2);
  if (it.effect?.hp && u2.hp >= s3.hpMax && !it.effect.mana) fail("PV d\xE9j\xE0 au maximum");
  if (it.effect?.mana && (s3.manaMax === 0 || u2.mana >= s3.manaMax) && !it.effect.hp) fail("mana d\xE9j\xE0 au maximum");
  takeStack((g2.bag.stacks[id] ?? 0) > 0 || g2.where !== "ville" ? g2.bag : g2.bank, id, 1);
  if (it.effect?.hp) u2.hp = Math.min(s3.hpMax, u2.hp + Math.ceil(s3.hpMax * it.effect.hp / 100));
  if (it.effect?.mana) u2.mana = Math.min(s3.manaMax, u2.mana + Math.ceil(s3.manaMax * it.effect.mana / 100));
}
function depart(g2, dir = 1) {
  mustWatch(g2);
  inCity(g2);
  if (!squad(g2).length) fail("l\u2019escouade est vide");
  const t = dir > 0 ? g2.region : g2.region - 1;
  if (t < 0) fail("aucune route dans ce sens");
  g2.terr = t;
  g2.dir = dir;
  g2.outings = (g2.outings ?? 0) + 1;
  g2.where = "territoire";
  g2.step = 0;
  g2.cleared = REGIONS[t].territory.steps.map(() => false);
  g2.pending = [];
  newEncounter(g2);
  const dest = destination(g2);
  note(g2, `D\xE9part dans ${territoryOf(g2).name}${dest !== null ? ` en direction de ${REGIONS[dest].city.name}` : ""}.`);
}
function arrive(g2) {
  mustWatch(g2);
  if (g2.where !== "territoire") fail("pas en exp\xE9dition");
  const dest = destination(g2);
  if (dest === null) fail("pas de ville au bout de ce territoire");
  const order = stepOrder(g2);
  if (g2.step !== order[order.length - 1] || !g2.cleared[g2.step]) fail("il faut d\u2019abord franchir tout le territoire");
  const lostN = g2.pending.length;
  g2.region = dest;
  g2.unlocked = Math.max(g2.unlocked, dest);
  g2.where = "ville";
  g2.encounter = null;
  g2.pending = [];
  note(g2, `Arriv\xE9e \xE0 ${REGIONS[dest].city.name}${lostN ? ` (${lostN} objet(s) laiss\xE9(s) sur place)` : ""}.`);
}
function newEncounter(g2) {
  const st = territoryOf(g2).steps[g2.step];
  const seed = hash(g2.seed, "rencontre", st.id, g2.counter++);
  const rare = !st.guardian && g2.stats.wins >= RARE_MIN_WINS && rarePresent(g2.seed, `${st.id}|${g2.outings ?? 0}`, g2.stats.fights) ? rareOfStep(st.id).id : void 0;
  g2.encounter = { seed, side: genMonsters(C, { level: st.level, pop: st.pop, pool: st.pool, forced: [...st.forced ?? [], ...rare ? [rare] : []] }, seed), ...rare ? { rare } : {} };
}
function advance(g2) {
  mustWatch(g2);
  if (g2.where !== "territoire") fail("pas en exp\xE9dition");
  if (!g2.cleared[g2.step]) fail("il faut d\u2019abord vaincre les monstres de cette \xE9tape");
  const order = stepOrder(g2);
  if (g2.step === order[order.length - 1]) fail("derni\xE8re \xE9tape");
  g2.step += 1;
  g2.pending = [];
  newEncounter(g2);
}
function back(g2) {
  mustWatch(g2);
  if (g2.where !== "territoire" || g2.step === stepOrder(g2)[0]) fail("impossible");
  g2.step -= 1;
  g2.pending = [];
  newEncounter(g2);
}
function searchFight(g2) {
  mustWatch(g2);
  if (g2.where !== "territoire") fail("pas en exp\xE9dition");
  newEncounter(g2);
}
function goHome(g2, forced = false) {
  if (!forced) mustWatch(g2);
  if (g2.where !== "territoire") return;
  const lostN = g2.pending.length;
  g2.where = "ville";
  g2.encounter = null;
  g2.pending = [];
  const city = cityOf(g2).name;
  note(g2, forced ? `Repli forc\xE9 vers ${city}.` : `Retour \xE0 ${city}${lostN ? ` (${lostN} objet(s) laiss\xE9(s) sur place)` : ""}.`);
}
var guardAdj = 1e3;
var mHp = (v, r) => Math.round(v * ECO.monsterHp[r] * guardAdj / 1e6);
var mAtk = (v, r) => Math.round(v * ECO.monsterAtk[r] * guardAdj / 1e6);
var mWeapon = (w, r) => ({ ...w, dmg: mAtk(w.dmg, r) });
function buildInput(g2) {
  guardAdj = g2.where === "territoire" && territoryOf(g2).steps[g2.step]?.guardian ? ECO.guardianAdj[terrIndex(g2)] : 1e3;
  const units = [];
  let slot = 0;
  squad(g2).forEach((t, ti) => {
    const def = troopDef(t);
    const skills = troopActive(t);
    const rules = troopRules(t);
    t.units.forEach((u2, ui) => {
      const s3 = unitStats(t, u2);
      units.push({
        id: `A${slot + 1}`,
        side: 0,
        slot: slot++,
        troop: `0-${ti}`,
        kind: t.type,
        name: def.units > 1 ? `${s3.name} ${ui + 1}` : s3.name,
        tags: s3.tags,
        hpMax: s3.hpMax,
        willMax: s3.willMax,
        energyMax: s3.energyMax,
        manaMax: s3.manaMax,
        atk: s3.atk,
        speed: s3.speed,
        res: s3.res,
        weapon: s3.weapon,
        hp: Math.min(u2.hp, s3.hpMax),
        mana: Math.min(u2.mana, s3.manaMax),
        dist: t.rank,
        skills,
        rules
      });
    });
  });
  slot = 0;
  g2.encounter.side.troops.forEach((tr, ti) => {
    const def = C.troops[tr.type];
    const s3 = computeStats(def, tr.form, tr.level);
    tr.units.forEach((us, ui) => units.push({
      id: `B${slot + 1}`,
      side: 1,
      slot: slot++,
      troop: `1-${ti}`,
      kind: MONSTERS[tr.type]?.rare?.base ?? tr.type,
      name: def.units > 1 ? `${s3.name} ${ui + 1}` : s3.name,
      tags: s3.tags,
      hpMax: mHp(s3.hpMax, terrIndex(g2)),
      willMax: s3.willMax,
      energyMax: s3.energyMax,
      manaMax: s3.manaMax,
      atk: mAtk(s3.atk, terrIndex(g2)),
      speed: s3.speed,
      res: s3.res,
      weapon: mWeapon(C.weapons[def.weapon], terrIndex(g2)),
      hp: mHp(s3.hpMax, terrIndex(g2)),
      mana: s3.manaMax,
      dist: us.dist,
      skills: tr.active,
      rules: tr.rules
    }));
  });
  return { engineVersion: ENGINE_VERSION, units, params: C.params, skills: C.skills };
}
function mustWatch(g2) {
  if (g2.watch) fail("regardez d\u2019abord le combat");
}
function endWatch(g2) {
  g2.watch = false;
}
function fight(g2) {
  mustWatch(g2);
  if (g2.where !== "territoire" || !g2.encounter) fail("pas de combat ici");
  if (!squad(g2).length) fail("escouade vide");
  const st = territoryOf(g2).steps[g2.step];
  const input = buildInput(g2);
  const seed = hash(g2.encounter.seed, "combat");
  const { result, log } = simuler(input, seed);
  const won = result.winner === 0;
  g2.stats.fights++;
  if (won) g2.stats.wins++;
  const ti = terrIndex(g2);
  const rec = { input, log, result, region: ti, step: g2.step, won, xp: 0, xpBy: [], levelUps: [], deaths: [], gold: 0, loot: [], lost: [] };
  const byId = new Map(result.units.map((u2) => [u2.id, u2]));
  let k = 0;
  const earners = /* @__PURE__ */ new Set();
  for (const t of squad(g2)) {
    const keep = [];
    t.units.forEach((u2, ui) => {
      const ur = byId.get(`A${++k}`);
      if (ur.dead) {
        rec.deaths.push(`${troopName(t)}${t.units.length > 1 ? ` (unit\xE9 ${ui + 1})` : ""}`);
        g2.stats.deaths++;
        return;
      }
      const mx = unitStats(t, u2).manaMax;
      u2.hp = Math.max(1, ur.hp);
      u2.mana = Math.min(mx, ur.mana + Math.floor(mx * ECO.manaRegenEnd / 100));
      keep.push(u2);
      if (mx > 0) (rec.manaBack ?? (rec.manaBack = [])).push([`${troopName(t)}${t.units.length > 1 ? ` ${ui + 1}` : ""}`, u2.mana - ur.mana, u2.mana]);
      if (!ur.fled) earners.add(t);
    });
    t.units = keep;
  }
  g2.troops = g2.troops.filter((t) => t.units.length > 0);
  if (won) {
    const types = g2.encounter.side.troops.map((t) => t.type);
    rec.xp = g2.encounter.side.troops.reduce((a, t) => a + t.level * C.troops[t.type].pop * ECO.xpPerMonsterLevelPop, 0);
    const avgLvl = g2.encounter.side.troops.reduce((a, t) => a + t.level, 0) / g2.encounter.side.troops.length;
    for (const t of earners) {
      if (!g2.troops.includes(t)) continue;
      const gain = xpFor(rec.xp, t.level, avgLvl);
      rec.xpBy.push([troopName(t), gain]);
      t.xp += gain;
      while (t.level < ECO.maxLevel && t.xp >= ECO.xpToNext(t.level)) {
        const before = t.units.map((u2) => unitStats(t, u2));
        t.xp -= ECO.xpToNext(t.level);
        t.level++;
        t.units.forEach((u2, i) => {
          const after = unitStats(t, u2);
          u2.hp += after.hpMax - before[i].hpMax;
          u2.mana += after.manaMax - before[i].manaMax;
          clampUnit(t, u2);
        });
        rec.levelUps.push(`${troopName(t)} passe niveau ${t.level}`);
      }
    }
    const reg = REGIONS[ti];
    const loot = rollLoot(st, types, seed, st.guardian ? { first: !g2.guardians[ti], firstItem: reg.firstItem, loot: reg.guardianLoot } : null);
    rec.gold = loot.gold;
    g2.gold += loot.gold;
    const rare = g2.encounter.rare;
    if (rare) {
      loot.items.unshift({ id: MONSTERS[rare].rare.trophy, qty: 1 });
      note(g2, `Monstre rare vaincu : ${MONSTERS[rare].name}.`);
    }
    for (const it of loot.items) {
      if ("id" in it) {
        const left = addStack(g2, g2.bag, it.id, it.qty);
        if (left < it.qty) rec.loot.push({ id: it.id, qty: it.qty - left });
        if (left) {
          rec.lost.push({ id: it.id, qty: left });
          g2.pending.push({ id: it.id, qty: left });
        }
      } else if (addEquip(g2, g2.bag, it.equip)) rec.loot.push(it);
      else {
        rec.lost.push(it);
        g2.pending.push(it);
      }
    }
    g2.cleared[g2.step] = true;
    if (st.guardian && !g2.guardians[ti]) {
      g2.guardians[ti] = true;
      note(g2, `${C.troops[st.forced[0]].name} est vaincu pour la premi\xE8re fois.`);
    }
    note(g2, `Victoire \xE0 l\u2019\xE9tape \xAB ${st.name} \xBB : +${rec.gold} or, +${rec.xp} XP${rec.deaths.length ? `, pertes : ${rec.deaths.join(", ")}` : ""}.`);
    g2.encounter = null;
  } else {
    note(g2, `D\xE9faite \xE0 l\u2019\xE9tape \xAB ${st.name} \xBB${rec.deaths.length ? ` : ${rec.deaths.join(", ")} ${rec.deaths.length > 1 ? "sont morts" : "est mort"}` : ""}.`);
  }
  if (!won || !squad(g2).length) goHome(g2, true);
  g2.last = rec;
  g2.watch = true;
  return rec;
}
function xpFor(base, troopLevel, monsterLevel) {
  const over = troopLevel - Math.floor(monsterLevel) - 2;
  return over <= 0 ? base : Math.floor(base / 2 ** over);
}
function takePending(g2, i) {
  const it = g2.pending[i];
  if (!it) return;
  if ("id" in it) {
    const left = addStack(g2, g2.bag, it.id, it.qty);
    if (left === it.qty) fail("sac plein");
    if (left) it.qty = left;
    else g2.pending.splice(i, 1);
  } else {
    if (!addEquip(g2, g2.bag, it.equip)) fail("sac plein");
    g2.pending.splice(i, 1);
  }
}
function ensureQuests(g2) {
  g2.quests ?? (g2.quests = REGIONS.map(() => []));
  g2.questN ?? (g2.questN = REGIONS.map(() => 0));
  REGIONS.forEach((_, i) => {
    var _a, _b;
    (_a = g2.quests)[i] ?? (_a[i] = []);
    (_b = g2.questN)[i] ?? (_b[i] = 0);
    while (g2.quests[i].length < QUESTS_PER_CITY) g2.quests[i].push(genQuest(g2.seed, i, g2.questN[i]++));
  });
}
function cityQuests(g2) {
  ensureQuests(g2);
  return g2.quests[g2.region];
}
var canComplete = (g2, q) => q.needs.every(([id, n]) => have(g2, id) >= n);
var abandonCost = (g2) => 10 * REGIONS[g2.region].tier;
function replaceQuest(g2, i) {
  g2.quests[g2.region][i] = genQuest(g2.seed, g2.region, g2.questN[g2.region]++);
}
function questIndex(g2, id) {
  inCity(g2);
  mustWatch(g2);
  const i = cityQuests(g2).findIndex((q) => q.id === id);
  if (i < 0) fail("qu\xEAte introuvable dans cette ville");
  return i;
}
function completeQuest(g2, id) {
  const i = questIndex(g2, id);
  const q = g2.quests[g2.region][i];
  if (!canComplete(g2, q)) fail("il manque des troph\xE9es");
  const rw = q.reward;
  let got = "";
  if (rw.kind === "equip") {
    if (slotsUsed(g2.bank) >= ECO.bankSlots && slotsUsed(g2.bag) >= ECO.bagSlots) fail("banque et sac pleins");
    const it = genEquip(rw.base, rng(g2, "quete"), rw.roll);
    if (!addEquip(g2, g2.bank, it)) addEquip(g2, g2.bag, it);
    got = `${EQUIP[rw.base].name} (excellent)`;
  } else if (rw.kind === "items") {
    const free = ECO.bankSlots - slotsUsed(g2.bank) + ECO.bagSlots - slotsUsed(g2.bag);
    if (free < rw.items.length) fail(`il faut ${rw.items.length} emplacements libres en banque ou dans le sac`);
    for (const [it, n] of rw.items) {
      const left = addStack(g2, g2.bank, it, n);
      if (left) addStack(g2, g2.bag, it, left);
    }
    got = rw.items.map(([it, n]) => `${n} \xD7 ${ITEMS[it].name}`).join(", ");
  }
  for (const [t, n] of q.needs) consume(g2, t, n);
  g2.gold += q.gold;
  if (rw.kind === "troop") {
    const t = addTroop(g2, rw.type, rw.level, true);
    got = `${troopName(t)} niv. ${rw.level}${t.squad ? " (rejoint l\u2019escouade)" : " (en caserne)"}`;
  }
  g2.questsDone = (g2.questsDone ?? 0) + 1;
  note(g2, `Qu\xEAte \xAB ${q.title} \xBB rendue \xE0 ${q.giver} : ${got}, +${q.gold} or.`);
  replaceQuest(g2, i);
  return got;
}
function abandonQuest(g2, id) {
  const i = questIndex(g2, id);
  const cost = abandonCost(g2);
  if (g2.gold < cost) fail(`il faut ${cost} or`);
  g2.gold -= cost;
  note(g2, `Qu\xEAte \xAB ${g2.quests[g2.region][i].title} \xBB abandonn\xE9e.`);
  replaceQuest(g2, i);
}

