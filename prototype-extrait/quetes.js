var RARE_CHANCE = 15;
var RARE_MIN_WINS = 10;
var RARE_HP = 2.4;
var RARE_ATK = 3;
var RARE_TUNE = { epaves: 0.8, tertre: 0.8, puits: 0.8, filons: 0.9, dunes: 1.2, caravane: 1, tombeaux: 1.5, verrerie: 1, parvis: 0.7, jardins: 0.7 };
var QUESTS_PER_CITY = 5;
var RARE_ROWS = [
  [0, "lisiere", "loup_gris", "Croc-de-Givre", "fourrure_givre", "Fourrure de Croc-de-Givre"],
  [0, "sentier", "gobelins", "Grishnak le Balafr\xE9", "banniere_grishnak", "Banni\xE8re de Grishnak"],
  [0, "nids", "araignee", "Reine-Soie", "oeuf_reine_soie", "\u0152uf de Reine-Soie"],
  [0, "camp", "troll", "Vieux M\xE2chefer", "oeil_machefer", "\u0152il de M\xE2chefer"],
  [1, "berges", "crapaud", "Gueule-de-Vase", "langue_vase", "Langue de Gueule-de-Vase"],
  [1, "roselieres", "hommes_lezards", "Ssark l\u2019\xC9corcheur", "crane_ssark", "Cr\xE2ne peint de Ssark"],
  [1, "epaves", "pecheurs_maudits", "Capitaine sans visage", "lanterne_capitaine", "Lanterne du Capitaine"],
  [1, "tertre", "crocodile", "Mangeur-de-Barques", "dent_mangeur", "Dent du Mangeur-de-Barques"],
  [2, "entree", "artificier", "Br\xFBle-M\xE8che", "detonateur", "D\xE9tonateur de Br\xFBle-M\xE8che"],
  [2, "galeries", "ver_galeries", "Grand Ver blanc", "mandibule_ver", "Mandibule du Grand Ver"],
  [2, "filons", "elementaire_cristal", "Prisme vivant", "coeur_prisme", "C\u0153ur de prisme"],
  [2, "puits", "basilic", "Basilic \xE0 l\u2019\u0153il d\u2019or", "oeil_or", "\u0152il d\u2019or"],
  [3, "dunes", "ombre_mirage", "Mirage jumeau", "voile_mirage", "Voile du Mirage jumeau"],
  [3, "caravane", "pillards_sable", "Khaled Main-Rouge", "sceau_main_rouge", "Sceau de Main-Rouge"],
  [3, "tombeaux", "pretre_scarabee", "Grand pr\xEAtre Ankhaset", "scarabee_or", "Scarab\xE9e d\u2019or d\u2019Ankhaset"],
  [3, "verrerie", "ver_sables", "Ver-Roi des sables", "perle_ver_roi", "Perle du Ver-Roi"],
  [4, "marches", "griffons", "Griffon aux ailes d\u2019argent", "remige_argent", "R\xE9mige d\u2019argent"],
  [4, "parvis", "sentinelles", "Sentinelle \xE9veill\xE9e", "glyphe_vigilance", "Glyphe de vigilance"],
  [4, "observatoire", "astromancien", "Astromancien fou", "astrolabe_brise", "Astrolabe bris\xE9"],
  [4, "jardins", "chimere", "Chim\xE8re \xE0 trois t\xEAtes", "corne_chimere", "Corne de chim\xE8re"]
];
var RARES = [];
for (const [region, step, base, name, trophy, trophyName] of RARE_ROWS) {
  const b = MONSTERS[base];
  if (!b) throw new Error(`mod\xE8le de rare inconnu : ${base}`);
  const id = `rare_${step}`;
  const k = RARE_HP * b.units * (RARE_TUNE[step] ?? 1);
  MONSTERS[id] = {
    ...b,
    name,
    units: 1,
    pop: 2,
    role: `monstre rare (${b.role})`,
    base: { ...b.base, hp: Math.round(b.base.hp * k), will: Math.round(b.base.will * 1.3), atk: b.base.atk + Math.round(RARE_ATK * Math.max(1, RARE_TUNE[step] ?? 1)) },
    growth: { ...b.growth, hp: Math.round(b.growth.hp * k * 10) / 10 },
    forms: b.forms.map((f) => ({ ...f, name })),
    drops: [trophy],
    boss: false,
    region,
    rare: { step, trophy, base }
  };
  ITEMS[trophy] = { id: trophy, name: trophyName, kind: "trophee", tier: region + 1, value: 20 * (region + 1) * (region + 1), tags: [], desc: `Troph\xE9e de ${name} (${REGIONS[region].territory.name}). Demand\xE9 par les qu\xEAtes des villes.` };
  RARES.push({ id, region, step, base, name, trophy });
}
var rareOfStep = (stepId) => RARES.find((r) => r.step === stepId) ?? null;
var rareOfTrophy = (trophy) => RARES.find((r) => r.trophy === trophy) ?? null;
function rarePresent(seed, key, fights) {
  return hash(seed, "rare", key, fights) % 100 < RARE_CHANCE;
}
var GIVERS = [
  ["Ma\xEEtre Aldric, forgeron", "Dame Ysolde, capitaine de la garde", "Fr\xE8re Beno\xEEt, du temple", "Mirela, marchande d\u2019\xE9toffes", "le vieux Tomas, chasseur"],
  ["Capitaine Morvan", "Nella la rebouteuse", "Gaspard, armateur", "S\u0153ur Ma\xEBlle, du phare", "le Borgne, contrebandier"],
  ["Thrain, ma\xEEtre forgeron", "Dagna, cheffe des mineurs", "Brokk le runiste", "Hilde, prospectrice", "le thane Gorm"],
  ["Sayed, caravanier", "Amira, pr\xEAtresse du soleil", "le vizir Kassim", "Nour, alchimiste", "Rachid, ma\xEEtre d\u2019armes"],
  ["M\xE8re S\xE9raphine", "le chevalier Aur\xE8le", "Lysandre, astronome", "Fr\xE8re Cl\xE9ment, archiviste", "H\xE9liane, oracle"]
];
function points(trophy) {
  const r = rareOfTrophy(trophy);
  return 2 + REGIONS[r.region].territory.steps.findIndex((s3) => s3.id === r.step);
}
function genQuest(seed, region, n) {
  const r = new Rng(hash(seed, "quete", region, n));
  const terr = region > 0 && r.int(10) < 3 ? region - 1 : region;
  const T = REGIONS[terr].tier;
  const kind = weighted(r, [["equip", 40], ["troop", 25], ["items", 35]]);
  const pool = RARES.filter((x) => x.region === terr).map((x) => x.trophy);
  const types = [];
  const nTypes = r.int(10) < 6 ? 1 : 2;
  while (types.length < nTypes) {
    const t = pool[r.int(pool.length)];
    if (!types.includes(t)) types.push(t);
  }
  const target = kind === "items" ? between(r, 4, 6) : kind === "equip" ? between(r, 6, 9) : between(r, 9, 12);
  const count = Object.fromEntries(types.map((t) => [t, 1]));
  let pts = types.reduce((a, t) => a + points(t), 0);
  for (let guard = 0; pts < target && guard < 20; guard++) {
    const t = types[r.int(types.length)];
    if (count[t] >= 4) continue;
    count[t]++;
    pts += points(t);
  }
  const needs = types.map((t) => [t, count[t]]);
  const gold = Math.round(pts * 5 * T * T);
  let reward;
  if (kind === "equip") {
    const bases = Object.values(EQUIP).filter((b) => b.tier === T && b.craft !== false).map((b) => [b.id, 1]);
    reward = { kind: "equip", base: weighted(r, bases), roll: between(r, 1250, 1400) };
  } else if (kind === "troop") {
    const types2 = REGIONS.slice(0, terr + 1).flatMap((rg, i) => rg.city.recruit.map((t) => [t, i === region ? 1 : 2]));
    reward = { kind: "troop", type: weighted(r, types2), level: REGIONS[terr].minLevel + 3 };
  } else {
    const comps = Object.values(ITEMS).filter((i) => i.kind === "composant" && i.tier >= Math.min(T + 1, 5) && i.tier <= Math.min(T + 2, 5));
    const cons = Object.values(ITEMS).filter((i) => i.kind === "consommable" && i.tier <= T + 1 && i.tier >= Math.min(T, 3) - 1 && i.id !== "onguent");
    const items = [];
    if (comps.length) items.push([comps[r.int(comps.length)].id, between(r, 1, 2)]);
    const c1 = cons[r.int(cons.length)].id;
    items.push([c1, between(r, 3, 5)]);
    if (r.int(2)) {
      const c2 = cons[r.int(cons.length)].id;
      if (c2 !== c1) items.push([c2, between(r, 2, 4)]);
    }
    if (T >= 4 && r.int(3) === 0) items.push(["onguent", 1]);
    reward = { kind: "items", items };
  }
  const giver = GIVERS[region][r.int(GIVERS[region].length)];
  const rares = needs.map(([t]) => rareOfTrophy(t));
  const title = rares.length === 1 ? [`La traque de ${rares[0].name}`, `Prime : ${rares[0].name}`, `Le troph\xE9e de ${rares[0].name}`][r.int(3)] : [`Double prime : ${rares[0].name} et ${rares[1].name}`, `Chasse en ${REGIONS[terr].territory.name}`][r.int(2)];
  const pitch = {
    equip: ["Rapportez-moi ces troph\xE9es et je vous remettrai une pi\xE8ce comme on n\u2019en forge plus.", "J\u2019ai gard\xE9 une pi\xE8ce d\u2019exception pour qui me prouvera sa valeur.", "Ces troph\xE9es valent bien ce que j\u2019ai de meilleur en r\xE9serve."],
    troop: ["Mes meilleurs combattants suivront celui qui aura abattu ces b\xEAtes.", "Prouvez votre valeur, et une troupe aguerrie se joindra \xE0 vous.", "Ceux que je commande ne servent que les plus braves."],
    items: ["Ma r\xE9serve est \xE0 vous en \xE9change de ces troph\xE9es.", "J\u2019en ai besoin pour mes pr\xE9parations : je paierai en nature.", "Rapportez-les et vous ne repartirez pas les mains vides."]
  }[kind];
  const where = [...new Set(rares.map((x) => `${REGIONS[x.region].territory.steps.find((s3) => s3.id === x.step).name}`))].join(" et ");
  const text = `\xAB ${pitch[r.int(pitch.length)]} \xBB On les croise parfois : ${where}, ${REGIONS[terr].territory.name}.`;
  return { id: `q${region}-${n}`, region, giver, title, text, needs, reward, gold };
}

