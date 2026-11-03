function hash(seed, ...parts) {
  let h2 = (2166136261 ^ seed) >>> 0;
  for (const ch of parts.join("|")) {
    h2 ^= ch.charCodeAt(0);
    h2 = Math.imul(h2, 16777619) >>> 0;
  }
  return h2 >>> 0;
}
var between = (r, a, b) => a + r.int(b - a + 1);
function weighted(r, list) {
  const tot = list.reduce((a, [, w]) => a + w, 0);
  if (tot <= 0) return void 0;
  let x = r.int(Math.max(1, Math.round(tot * 1e3))) / 1e3;
  for (const [v, w] of list) {
    if (x < w) return v;
    x -= w;
  }
  return list[list.length - 1][0];
}
var uid = (r, p = "i") => p + r.next().toString(36) + r.int(1296).toString(36);
function quality(roll) {
  return roll < 850 ? "m\xE9diocre" : roll < 1050 ? "correct" : roll < 1200 ? "bon" : "excellent";
}
function genEquip(baseId, r, fixedRoll) {
  const b = EQUIP[baseId];
  const n = Math.min(b.nStats ?? TIER_NSTATS[b.tier], b.pool.length);
  const roll = fixedRoll ?? Math.floor((between(r, 600, 1400) + between(r, 600, 1400)) / 2);
  const pool = b.pool.map((p, i) => [i, p[1]]);
  const chosen = [];
  while (chosen.length < n) {
    const i = weighted(r, pool.filter(([j]) => !chosen.includes(j)));
    chosen.push(i);
  }
  const budget = Math.max(n, Math.floor(TIER_BUDGET[b.tier] * roll / 1e3));
  const w = chosen.map(() => 1 + r.int(100));
  const wt = w.reduce((a, x) => a + x, 0);
  const free = 1e3 - 150 * n;
  const shares = w.map((x) => 150 + Math.floor(free * x / wt));
  const usedTypes = /* @__PURE__ */ new Set();
  const stats = chosen.map((i, j) => {
    const [k, , forced] = b.pool[i];
    const pts = Math.floor(budget * shares[j] / 1e3);
    let v = Math.max(1, Math.floor(pts * STAT_COST[k].per));
    if (k === "wspeed") v = Math.min(3, v);
    const s3 = { k, v };
    if (k === "res") {
      let ty = forced;
      if (!ty || usedTypes.has(ty)) {
        const left = DMG_TYPES.filter((t) => !usedTypes.has(t));
        ty = left[r.int(left.length)];
      }
      usedTypes.add(ty);
      s3.type = ty;
    }
    return s3;
  });
  const merged = [];
  for (const s3 of stats) {
    const m2 = merged.find((x) => x.k === s3.k && x.type === s3.type);
    if (m2) m2.v += s3.v;
    else merged.push(s3);
  }
  return { uid: uid(r), base: baseId, roll, stats: merged };
}
var ITEM_BOOST = 2;
var boost = (s3) => s3.v * ITEM_BOOST;
function statText(s0) {
  const s3 = { ...s0, v: boost(s0) };
  const c = STAT_COST[s3.k];
  if (s3.k === "wspeed") return `Arme plus rapide \u2212${s3.v}`;
  if (s3.k === "wcost") return `Co\xFBt de l'arme \u2212${s3.v}`;
  if (s3.k === "res") return `+${s3.v} % r\xE9s. ${TYPE_FR[s3.type]}`;
  return `+${s3.v} ${c.label}`;
}
var TYPE_FR = {
  contondant: "contondant",
  tranchant: "tranchant",
  maladie: "maladie",
  psychique: "psychique",
  feu: "feu",
  glace: "glace",
  tenebres: "t\xE9n\xE8bres",
  sacre: "sacr\xE9"
};
function itemValue(i) {
  return Math.round(EQUIP[i.base].value * i.roll / 1e3);
}
var CONSUMABLE_TAGS = {
  bandage: ["fil", "cuir", "herbe"],
  potion_mineure: ["herbe", "essence"],
  potion_soin: ["herbe", "essence", "bete"],
  potion_mana: ["essence", "plume", "herbe"],
  potion_mana_normale: ["essence", "plume"],
  potion_majeure: ["herbe", "essence", "bete"],
  tonique: ["essence", "herbe"]
};
var RECRUIT_VALUE = [0, 1, 2.5, 5, 9, 15];
var CONSUMABLE_VALUE_MULT = 0.7;
function recipeSpecs(c) {
  const specs = [];
  for (const b of Object.values(EQUIP)) {
    if (b.craft === false) continue;
    specs.push({ out: b.id, kind: "equip", tier: b.tier, tags: b.tags, target: Math.round(b.value * 0.7), n: b.tier === 1 ? [2, 3] : [3, 4], gold: ECO.craftGoldPerTier * b.tier * b.tier, comp: b.tier >= 3 });
  }
  for (const id of CRAFT_CONSUMABLES) {
    const it = ITEMS[id];
    specs.push({ out: id, kind: "consommable", tier: it.tier, tags: CONSUMABLE_TAGS[id] ?? [], target: Math.max(4, Math.round(it.value * CONSUMABLE_VALUE_MULT)), n: [2, 2], gold: 0 });
  }
  for (const [id, t] of Object.entries(c.troops)) {
    if (MONSTERS[id]) continue;
    const reg = recruitRegion(id);
    if (reg < 0) continue;
    const tier = Math.max(reg + 1, t.pop >= 3 && reg === 0 ? 2 : 1);
    specs.push({ out: id, kind: "recrue", tier, tags: t.tags, target: Math.round(14 * t.pop * RECRUIT_VALUE[reg + 1]), n: tier === 1 ? [2, 3] : [3, 4], gold: ECO.recruitGoldPerPop * t.pop * (reg + 1) });
  }
  return specs;
}
function genRecipes(c, playerSeed) {
  const out = {};
  const usage = {};
  const banned = tradeOnly(playerSeed);
  for (const sp of recipeSpecs(c)) {
    const r = new Rng(hash(playerSeed, "recette", sp.out));
    const pool = Object.values(ITEMS).filter((i) => i.kind === "materiau" && i.tier <= sp.tier && !banned.includes(i.id));
    const comps = Object.values(ITEMS).filter((i) => i.kind === "composant" && i.tier <= sp.tier && i.tier >= sp.tier - 1 && i.value <= sp.target * 0.4);
    const comp = sp.comp && comps.length ? comps[r.int(comps.length)] : null;
    const target = sp.target - (comp?.value ?? 0);
    const lo = Math.floor(target * 0.9), hi = Math.ceil(target * 1.1);
    let best = null;
    for (let attempt = 0; attempt < 12; attempt++) {
      const n = between(r, sp.n[0], sp.n[1]);
      const picked = [];
      const top = (id) => ITEMS[id].tier >= sp.tier;
      while (picked.length < n) {
        const cand = pool.filter((i) => !picked.includes(i.id) && (sp.tier < 2 || picked.length < n - 1 || picked.some(top) || top(i.id)));
        const id = weighted(r, cand.map((i) => [i.id, (i.tags.some((t) => sp.tags.includes(t)) ? 3 : 1) / (1 + 1.5 * (usage[i.id] ?? 0))]));
        if (!id) break;
        picked.push(id);
      }
      const qty = picked.map(() => 1);
      const val = () => picked.reduce((a, id, i) => a + ITEMS[id].value * qty[i], 0);
      for (let guard = 0; val() < lo && guard < 200; guard++) {
        const fits = picked.map((_, i) => i).filter((i) => val() + ITEMS[picked[i]].value <= hi);
        if (!fits.length) break;
        qty[fits[r.int(fits.length)]]++;
      }
      const v = val();
      if (!best || Math.abs(v - target) < Math.abs(best.val - target)) best = { picked, qty, val: v };
      if (v >= lo && v <= hi) break;
    }
    best.picked.forEach((id) => usage[id] = (usage[id] ?? 0) + 1);
    const ings = best.picked.map((id, i) => [id, best.qty[i]]);
    if (comp) ings.push([comp.id, 1]);
    out[sp.out] = { out: sp.out, kind: sp.kind, ingredients: ings, gold: sp.gold, budget: best.val + (comp?.value ?? 0) };
  }
  return out;
}
function tradeOnly(playerSeed) {
  const r = new Rng(hash(playerSeed, "echange"));
  const out = [];
  for (const [tier, n] of [[1, 3], [2, 1], [3, 1], [4, 1], [5, 1]]) {
    const list = Object.values(ITEMS).filter((i) => i.kind === "materiau" && i.tier === tier).map((i) => i.id);
    for (let k = 0; k < n; k++) {
      const left = list.filter((x) => !out.includes(x));
      out.push(left[r.int(left.length)]);
    }
  }
  return out;
}
function genMonsters(c, spec, seed) {
  const r = new Rng(hash(seed, "monstres"));
  const troops = [];
  let pop = between(r, spec.pop[0], spec.pop[1]), slots = 5;
  const add = (type) => {
    const t = c.troops[type];
    const lvl = between(r, spec.level[0], spec.level[1]);
    troops.push(newTroop(c, type, Math.max(1, lvl)));
    pop -= t.pop;
    slots -= t.units;
  };
  for (const f of spec.forced ?? []) add(f);
  for (let guard = 0; guard < 10; guard++) {
    const fit = spec.pool.filter((id) => c.troops[id] && c.troops[id].pop <= pop && c.troops[id].units <= slots);
    if (!fit.length) break;
    add(weighted(r, fit.map((id) => [id, c.troops[id].pop])));
  }
  for (; pop > 0 && troops.length; pop--) {
    const tr = troops[r.int(troops.length)];
    const nt = newTroop(c, tr.type, Math.min(ECO.maxLevel, tr.level + 1));
    Object.assign(tr, { ...nt, units: tr.units });
  }
  for (const tr of troops) for (const u2 of tr.units) if (r.int(4) === 0) u2.dist = Math.max(1, Math.min(3, u2.dist + (r.int(2) ? 1 : -1)));
  return { troops };
}
function groupPower(c, side) {
  return side.troops.reduce((a, t) => a + c.troops[t.type].pop * t.level, 0);
}
function rollLoot(step, monsterTypes, seed, guardian) {
  const r = new Rng(hash(seed, "butin"));
  const gold = Math.round(step.gold * (80 + r.int(41)) / 100);
  const items = [];
  const dropMats = [.../* @__PURE__ */ new Set([...step.mats, ...monsterTypes.flatMap((m2) => MONSTERS[m2]?.drops ?? [])])].filter((id) => ITEMS[id]?.kind === "materiau");
  const comps = [...new Set(monsterTypes.flatMap((m2) => MONSTERS[m2]?.drops ?? []))].filter((id) => ITEMS[id]?.kind === "composant");
  const T = step.tier;
  const mat2 = (rare = false) => {
    const list = dropMats.filter((id2) => !rare || ITEMS[id2].tier >= T);
    const src = list.length ? list : dropMats;
    const id = weighted(r, src.map((x) => [x, ITEMS[x].tier > T ? 0.3 : ITEMS[x].tier < T ? 0.5 : 1]));
    items.push({ id, qty: ITEMS[id].tier >= T ? between(r, 1, 2) : between(r, 1, 3) });
  };
  const equip2 = (fromGuardian = false) => {
    const id = fromGuardian && guardian && r.int(2) === 0 ? guardian.loot : weighted(r, Object.values(EQUIP).filter((b) => b.craft !== false && b.tier <= T && b.tier >= T - 1).map((b) => [b.id, b.tier === T ? 2 : 1]));
    items.push({ equip: genEquip(id, r) });
  };
  const comp = () => {
    if (comps.length) items.push({ id: comps[r.int(comps.length)], qty: 1 });
    else mat2(true);
  };
  const cons = () => items.push({ id: weighted(r, [
    ["bandage", T <= 2 ? 3 : 1],
    ["potion_mineure", T <= 2 ? 3 : 1],
    ["potion_mana", 2],
    ["potion_soin", T >= 2 ? 2 : 0.5],
    ["potion_mana_normale", T >= 2 ? 1.5 : 0],
    ["potion_majeure", T >= 3 ? 2 : 0],
    ["tonique", T >= 3 ? 1.5 : 0],
    ["onguent", T >= 5 ? 0.5 : 0]
  ]), qty: 1 });
  const draws = between(r, step.draws[0], step.draws[1]);
  for (let i = 0; i < draws; i++) {
    const k = weighted(r, Object.entries(ECO.table));
    if (k === "materiau") mat2();
    else if (k === "composant") comp();
    else if (k === "consommable") cons();
    else equip2();
  }
  if (step.guardian && guardian) {
    const k = weighted(r, Object.entries(ECO.guardianTable));
    if (k === "composant") comp();
    else if (k === "equipement") equip2(true);
    else mat2(true);
    if (guardian.first) items.push({ id: guardian.firstItem, qty: 1 });
  }
  const merged = [];
  for (const it of items) {
    if ("id" in it) {
      const m2 = merged.find((x) => "id" in x && x.id === it.id);
      if (m2) {
        m2.qty += it.qty;
        continue;
      }
    }
    merged.push(it);
  }
  return { gold, items: merged };
}
function canWear(type, level, baseId) {
  const b = EQUIP[baseId];
  const ok = TROOP_SLOTS[type]?.[b.slot];
  if (!ok || !ok.includes(b.cat)) return "cat\xE9gorie non accept\xE9e";
  const req = TIER_LEVEL[b.tier] ?? 1;
  if (level < req) return `niveau ${req} requis`;
  return null;
}

