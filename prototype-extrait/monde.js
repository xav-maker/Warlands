var mat = (id, name, tier, value, tags, desc = "") => ({ id, name, kind: "materiau", tier, value, tags, desc });
var ITEMS = Object.fromEntries([
  // palier 1
  mat("bois_tordu", "Bois tordu", 1, 4, ["bois"]),
  mat("resine", "R\xE9sine collante", 1, 4, ["bois", "essence"]),
  mat("cuir_brut", "Cuir brut", 1, 5, ["cuir", "bete"]),
  mat("croc_loup", "Croc de loup", 1, 6, ["bete", "os"]),
  mat("oreille_gobelin", "Oreille de gobelin", 1, 3, ["gobelin"]),
  mat("ferraille", "Ferraille rouill\xE9e", 1, 5, ["metal", "gobelin"]),
  mat("fil_araignee", "Fil d'araign\xE9e", 1, 6, ["fil", "bete"]),
  mat("champignon_pale", "Champignon p\xE2le", 1, 4, ["herbe"]),
  mat("pierre_lisse", "Pierre lisse", 1, 3, ["pierre"]),
  mat("plume_corbeau", "Plume de corbeau", 1, 5, ["plume", "essence"]),
  // palier 2
  mat("cuir_epais", "Cuir \xE9pais", 2, 12, ["cuir", "bete"]),
  mat("venin", "Glande \xE0 venin", 2, 14, ["essence", "bete"]),
  mat("fer_noir", "Fer noir", 2, 15, ["metal"]),
  mat("seve_ambree", "S\xE8ve ambr\xE9e", 2, 12, ["bois", "essence"]),
  mat("os_ancien", "Os ancien", 2, 13, ["os", "pierre"]),
  // palier 2 (Marais des Noyés)
  mat("algue_noire", "Algue noire", 2, 11, ["herbe", "essence"]),
  mat("ecaille_terne", "\xC9caille terne", 2, 13, ["cuir", "bete"]),
  mat("tourbe", "Tourbe compacte", 2, 10, ["bois", "pierre"]),
  mat("plume_heron", "Plume de h\xE9ron", 2, 12, ["plume"]),
  // palier 3 (Mines de Fer-Hurlant)
  mat("minerai_argent", "Minerai d'argent", 3, 28, ["metal"]),
  mat("cristal_brut", "Cristal brut", 3, 30, ["pierre", "essence"]),
  mat("charbon_dense", "Charbon dense", 3, 24, ["pierre", "bois"]),
  mat("cuir_basilic", "Cuir de basilic", 3, 29, ["cuir", "bete"]),
  mat("soie_profonde", "Soie des profondeurs", 3, 27, ["fil"]),
  mat("soufre", "Soufre", 3, 25, ["essence", "pierre"]),
  // palier 4 (Désert de Cendre)
  mat("verre_cendre", "Verre de cendre", 4, 50, ["pierre", "metal"]),
  mat("sel_ardent", "Sel ardent", 4, 46, ["essence"]),
  mat("os_dragonnet", "Os de dragonnet", 4, 55, ["os", "bete"]),
  mat("ecorce_cendre", "\xC9corce de cendre", 4, 45, ["bois"]),
  mat("essence_mirage", "Essence de mirage", 4, 52, ["essence", "fil"]),
  mat("chitine_doree", "Chitine dor\xE9e", 4, 50, ["cuir", "os"]),
  // palier 5 (Ruines Célestes)
  mat("plume_seraphique", "Plume s\xE9raphique", 5, 90, ["plume", "fil"]),
  mat("eclat_astral", "\xC9clat astral", 5, 95, ["metal", "pierre"]),
  mat("pierre_lune", "Pierre de lune", 5, 85, ["pierre"]),
  mat("poussiere_etoile", "Poussi\xE8re d'\xE9toile", 5, 88, ["essence"]),
  mat("larme_aube", "Larme d'aube", 5, 92, ["essence", "herbe"]),
  mat("fil_lumiere", "Fil de lumi\xE8re", 5, 86, ["fil"]),
  // composants (rares, gardiens)
  { id: "totem_gobelin", name: "Totem gobelin", kind: "composant", tier: 2, value: 25, tags: ["gobelin", "essence"], desc: "Composant rare du camp gobelin." },
  { id: "coeur_ronce", name: "C\u0153ur de ronce", kind: "composant", tier: 3, value: 45, tags: ["bois", "essence"], desc: "Composant du gardien des Ronces." },
  { id: "perle_noyee", name: "Perle noy\xE9e", kind: "composant", tier: 3, value: 35, tags: ["essence"], desc: "Composant rare du Marais des Noy\xE9s." },
  { id: "coeur_marais", name: "C\u0153ur du marais", kind: "composant", tier: 3, value: 60, tags: ["essence", "herbe"], desc: "Composant de la M\xE8re des Noy\xE9s." },
  { id: "noyau_golem", name: "Noyau de golem", kind: "composant", tier: 4, value: 60, tags: ["pierre", "metal"], desc: "Composant rare des mines." },
  { id: "gemme_profonde", name: "Gemme profonde", kind: "composant", tier: 4, value: 90, tags: ["pierre", "essence"], desc: "Composant du C\u0153ur-de-Forge." },
  { id: "flamme_figee", name: "Flamme fig\xE9e", kind: "composant", tier: 5, value: 100, tags: ["essence"], desc: "Composant rare du d\xE9sert." },
  { id: "coeur_dragon", name: "C\u0153ur de dragon", kind: "composant", tier: 5, value: 140, tags: ["bete", "essence"], desc: "Composant du Dragon de cendre." },
  { id: "plume_archonte", name: "Plume d'archonte", kind: "composant", tier: 5, value: 110, tags: ["plume", "essence"], desc: "Composant rare des Ruines C\xE9lestes." },
  { id: "couronne_aube", name: "Couronne de l'aube", kind: "composant", tier: 5, value: 180, tags: ["metal", "essence"], desc: "Composant de l'Archonte d\xE9chu." },
  // consommables (effets fixes, entre deux combats)
  { id: "bandage", name: "Bandage", kind: "consommable", tier: 1, value: 6, tags: [], effect: { hp: 15 }, desc: "+15 % des PV max" },
  { id: "potion_mineure", name: "Potion de soin mineure", kind: "consommable", tier: 1, value: 12, tags: [], effect: { hp: 30 }, desc: "+30 % des PV max" },
  { id: "potion_soin", name: "Potion de soin", kind: "consommable", tier: 2, value: 25, tags: [], effect: { hp: 50 }, desc: "+50 % des PV max" },
  { id: "potion_mana", name: "Potion de mana mineure", kind: "consommable", tier: 1, value: 12, tags: [], effect: { mana: 40 }, desc: "+40 % du mana max" },
  { id: "potion_mana_normale", name: "Potion de mana", kind: "consommable", tier: 2, value: 25, tags: [], effect: { mana: 80 }, desc: "+80 % du mana max" },
  { id: "potion_majeure", name: "Potion de soin majeure", kind: "consommable", tier: 3, value: 50, tags: [], effect: { hp: 80 }, desc: "+80 % des PV max" },
  { id: "tonique", name: "Tonique", kind: "consommable", tier: 3, value: 40, tags: [], effect: { hp: 25, mana: 25 }, desc: "+25 % des PV et du mana max" },
  { id: "onguent", name: "Onguent de remise", kind: "consommable", tier: 5, value: 90, tags: [], effect: { hp: 100 }, desc: "Soigne enti\xE8rement une unit\xE9 (butin rare)" }
].map((i) => [i.id, i]));
var STACK = { materiau: 50, composant: 20, consommable: 10, trophee: 20 };
var STAT_COST = {
  atk: { per: 1, label: "Attaque" },
  hp: { per: 5, label: "PV max" },
  will: { per: 3, label: "Volont\xE9 max" },
  energy: { per: 4, label: "\xC9nergie max" },
  mana: { per: 3, label: "Mana max" },
  res: { per: 2, label: "R\xE9sistance", unit: "%" },
  wdmg: { per: 1, label: "D\xE9g\xE2ts de l'arme" },
  wspeed: { per: 0.25, label: "Vitesse de l'arme" },
  wcost: { per: 0.5, label: "Co\xFBt en \xE9nergie de l'arme" }
};
var TIER_BUDGET = { 1: 10, 2: 20, 3: 35, 4: 55, 5: 80 };
var TIER_NSTATS = { 1: 2, 2: 2, 3: 3, 4: 3, 5: 4 };
var TIER_LEVEL = { 1: 1, 2: 6, 3: 11, 4: 16, 5: 21 };
var WPOOL = [["atk", 3], ["wdmg", 3], ["wspeed", 1], ["wcost", 2], ["energy", 1]];
var TIER_VALUE = [0, 30, 70, 140, 260, 450];
var TIER_DMG = [0, 1e3, 1250, 1550, 1900, 2300];
var CATS = [
  { id: "lame", slot: "arme", cat: "une_main", tags: ["metal", "cuir"], weapon: { type: "tranchant", dmg: 12, speed: 20, cost: 10 }, types: ["tranchant", "tranchant", "tranchant", "feu", "sacre"], pool: WPOOL, names: ["\xC9p\xE9e courte", "Lame de fer noir", "\xC9p\xE9e d'argent", "Cimeterre de cendre", "Lame de l'aube"] },
  { id: "masse", slot: "arme", cat: "une_main", tags: ["metal", "bois"], weapon: { type: "contondant", dmg: 10, speed: 21, cost: 8 }, pool: [...WPOOL, ["will", 1]], names: ["Masse clout\xE9e", "Masse de fer noir", "Marteau runique", "Masse de verre-cendre", "\xC9toile du matin"] },
  { id: "deuxmains", slot: "arme", cat: "deux_mains", tags: ["metal", "bois"], weapon: { type: "tranchant", dmg: 16, speed: 24, cost: 14 }, types: ["tranchant", "tranchant", "contondant", "tranchant", "tranchant"], pool: [...WPOOL, ["hp", 1]], names: ["Hache de b\xFBcheron", "Hache des fanges", "Grand marteau nain", "Fauchard de cendre", "Lance c\xE9leste"] },
  { id: "fronde", slot: "arme", cat: "fronde", tags: ["cuir", "fil"], weapon: { type: "contondant", dmg: 8, speed: 18, cost: 8 }, types: ["contondant", "contondant", "contondant", "feu", "sacre"], pool: WPOOL, names: ["Fronde tress\xE9e", "Fronde en cuir \xE9pais", "Lance-pierre d'argent", "Fronde \xE0 soufre", "Fronde stellaire"] },
  { id: "arc", slot: "arme", cat: "arc", tags: ["bois", "fil", "plume"], weapon: { type: "tranchant", dmg: 10, speed: 18, cost: 10 }, pool: WPOOL, names: ["Arc de fr\xEAne", "Arc des marais", "Arc composite d'argent", "Arc du d\xE9sert", "Arc astral"] },
  { id: "baton", slot: "arme", cat: "baton", tags: ["bois", "essence", "herbe"], weapon: { type: "contondant", dmg: 6, speed: 22, cost: 6 }, types: ["contondant", "contondant", "glace", "feu", "sacre"], pool: [["mana", 3], ["will", 2], ["wdmg", 1], ["atk", 1], ["res", 1]], names: ["B\xE2ton noueux", "B\xE2ton de s\xE8ve", "B\xE2ton de cristal", "B\xE2ton de braise", "Sceptre de l'aube"] },
  { id: "gantelets", slot: "arme", cat: "gantelets", tags: ["cuir", "metal"], weapon: { type: "contondant", dmg: 8, speed: 14, cost: 6 }, pool: [...WPOOL, ["will", 1]], names: ["Gantelets clout\xE9s", "Poings \xE9caill\xE9s", "Gantelets runiques", "Griffes de verre", "Gantelets s\xE9raphiques"] },
  { id: "legere", slot: "armure", cat: "legere", tags: ["cuir", "fil"], pool: [["hp", 3], ["energy", 2], ["res", 2, "tranchant"], ["res", 1, "contondant"], ["res", 1]], names: ["Gilet de cuir", "Veste d'\xE9cailles", "Cuir de basilic", "Tunique de chitine", "Cuirasse de plumes"] },
  { id: "moyenne", slot: "armure", cat: "moyenne", tags: ["metal", "cuir"], pool: [["hp", 3], ["res", 3, "tranchant"], ["res", 2, "contondant"], ["will", 1], ["res", 1]], names: ["Brigandine us\xE9e", "Cotte de mailles", "Maille d'argent", "\xC9cailles de dragonnet", "Haubert lunaire"] },
  { id: "lourde", slot: "armure", cat: "lourde", tags: ["metal", "pierre"], pool: [["hp", 4], ["res", 3, "tranchant"], ["res", 3, "contondant"], ["res", 1]], names: ["Plastron de ferraille", "Armure de fer noir", "Plaques naines", "Armure de verre-cendre", "Plate de l'aube"] },
  { id: "robe", slot: "armure", cat: "robe", tags: ["fil", "herbe", "plume"], pool: [["mana", 3], ["will", 2], ["hp", 1], ["res", 1]], names: ["Robe de lin", "Robe d'algues", "Robe de soie profonde", "Robe de mirage", "Robe \xE9toil\xE9e"] },
  { id: "bottes", slot: "accessoire", cat: "bottes", acc: true, tags: ["cuir", "fil"], pool: [["hp", 2], ["energy", 2], ["res", 1, "contondant"], ["will", 1]], names: ["Bottes rapi\xE9c\xE9es", "Bottes de marais", "Bottes de mineur", "Sandales du d\xE9sert", "Bottes ail\xE9es"] },
  { id: "anneau", slot: "accessoire", cat: "anneau", acc: true, tags: ["essence", "pierre", "metal"], pool: [["mana", 2], ["will", 2], ["atk", 1], ["res", 2]], names: ["Anneau de cuivre", "Anneau d'ambre", "Anneau de cristal", "Anneau de sel ardent", "Anneau de pierre de lune"] },
  { id: "collier", slot: "accessoire", cat: "collier", acc: true, tags: ["cuir", "metal", "os"], pool: [["atk", 2], ["hp", 2], ["energy", 1], ["res", 1]], names: ["Collier \xE0 pointes", "Collier d'\xE9cailles", "Collier d'argent", "Collier de chitine", "Collier d'\xE9toiles"] }
];
var genBases = CATS.flatMap((c) => c.names.map((name, i) => {
  const tier = i + 1;
  const b = { id: `${c.id}_${tier}`, name, tier, slot: c.slot, cat: c.cat, value: Math.round(TIER_VALUE[tier] * (c.acc ? 0.85 : 1)), tags: c.tags, pool: c.pool };
  if (c.weapon) b.weapon = { ...c.weapon, type: c.types?.[i] ?? c.weapon.type, dmg: Math.round(c.weapon.dmg * TIER_DMG[tier] / 1e3) };
  if (tier >= 4) b.workshop = true;
  return b;
}));
var lootBases = [
  { id: "ecorce_vivante", name: "Armure d\u2019\xE9corce vivante", tier: 2, slot: "armure", cat: "moyenne", value: 110, tags: [], craft: false, nStats: 3, pool: [["hp", 3], ["res", 2, "tranchant"], ["res", 2, "feu"], ["energy", 1]] },
  { id: "cape_noyes", name: "Cape des Noy\xE9s", tier: 3, slot: "accessoire", cat: "anneau", value: 220, tags: [], craft: false, nStats: 4, pool: [["mana", 2], ["will", 2], ["res", 2, "maladie"], ["res", 2, "glace"], ["hp", 1]] },
  { id: "poings_forge", name: "Poings du C\u0153ur-de-Forge", tier: 4, slot: "arme", cat: "gantelets", value: 400, tags: [], craft: false, nStats: 4, weapon: { type: "feu", dmg: 17, speed: 14, cost: 6 }, pool: WPOOL },
  { id: "ecailles_dragon", name: "\xC9cailles du dragon de cendre", tier: 5, slot: "armure", cat: "lourde", value: 650, tags: [], craft: false, nStats: 5, pool: [["hp", 4], ["res", 3, "feu"], ["res", 3, "tranchant"], ["res", 2, "contondant"], ["energy", 1]] },
  { id: "diademe_aube", name: "Diad\xE8me de l'aube", tier: 5, slot: "accessoire", cat: "anneau", value: 650, tags: [], craft: false, nStats: 5, pool: [["mana", 2], ["will", 2], ["atk", 2], ["hp", 2], ["res", 1]] }
];
var EQUIP = Object.fromEntries([...genBases, ...lootBases].map((b) => [b.id, b]));
var TROOP_SLOTS = {
  milicien: { arme: ["une_main"], armure: ["legere", "moyenne", "lourde"], accessoire: ["bottes", "anneau"] },
  frondeurs: { arme: ["fronde"], armure: ["legere"], accessoire: ["bottes", "anneau"] },
  acolyte: { arme: ["une_main", "baton"], armure: ["robe", "legere"], accessoire: ["bottes", "anneau"] },
  pyromancien: { arme: ["baton"], armure: ["robe"], accessoire: ["bottes", "anneau"] },
  chasseur: { arme: ["arc"], armure: ["legere"], accessoire: ["bottes", "anneau"] },
  berserker: { arme: ["deux_mains"], armure: ["legere", "moyenne"], accessoire: ["bottes", "collier", "anneau"] },
  loups: { accessoire: ["collier"] },
  adepte: { arme: ["baton"], armure: ["robe"], accessoire: ["bottes", "anneau"] },
  moine: { arme: ["gantelets"], armure: ["robe", "legere"], accessoire: ["bottes", "anneau"] },
  briseur: { arme: ["deux_mains"], armure: ["moyenne", "lourde"], accessoire: ["collier", "anneau"] },
  ...Object.fromEntries(UNIT_ROWS.map((r) => [r.id, r.slots]))
};
var R3 = (action, target, cond = "always", v, st) => ({ cond, v, s: st, action, target });
var NE2 = "nearestEnemy";
var WE2 = "weakestEnemy";
var SE2 = "strongestEnemy";
var ME2 = "self";
var MW2 = "mostWoundedAlly";
var MONSTER_WEAPONS = {
  coutelas: { name: "Coutelas \xE9br\xE9ch\xE9", type: "tranchant", dmg: 8, speed: 17, cost: 7 },
  fronde_gob: { name: "Fronde de gobelin", type: "contondant", dmg: 6, speed: 18, cost: 7 },
  crocs_gris: { name: "Crocs", type: "tranchant", dmg: 9, speed: 15, cost: 8 },
  chelic\u00E8res: { name: "Ch\xE9lic\xE8res", type: "maladie", dmg: 8, speed: 17, cost: 8 },
  baton_os: { name: "B\xE2ton d'os", type: "contondant", dmg: 5, speed: 22, cost: 6 },
  gourdin: { name: "Gourdin", type: "contondant", dmg: 15, speed: 27, cost: 13 },
  branches: { name: "Branches", type: "contondant", dmg: 16, speed: 26, cost: 12 }
};
var MONSTERS = {
  gobelins: {
    region: 0,
    name: "Gobelins pillards",
    units: 3,
    pop: 3,
    tags: ["gobelin"],
    role: "nu\xE9e au contact",
    weapon: "coutelas",
    defaultDist: 1,
    base: { hp: 38, will: 40, energy: 70, mana: 0, atk: 2 },
    growth: { hp: 3, will: 1, energy: 1, mana: 0, atk: 1 },
    forms: [{ id: "gobelin", name: "Gobelin pillard", level: 1, speed: 17, res: { tenebres: 10, sacre: -10 }, skills: [["emploi", 1], ["repos", 1], ["lame_saignante", 4], ["exploit", 7]] }],
    rules: [R3("repos", ME2, "selfEnergyBelow", 15), R3("lame_saignante", WE2, "targetLacksState", void 0, "saignement"), R3("exploit", WE2, "selfEnergyAbove", 60), R3("emploi", WE2), R3("avancer", ME2, "noEnemyInRange")],
    drops: ["oreille_gobelin", "ferraille", "cuir_brut"]
  },
  frondeurs_gob: {
    region: 0,
    name: "Gobelins frondeurs",
    units: 2,
    pop: 2,
    tags: ["gobelin"],
    role: "tir",
    weapon: "fronde_gob",
    defaultDist: 3,
    base: { hp: 32, will: 35, energy: 70, mana: 0, atk: 2 },
    growth: { hp: 2, will: 1, energy: 1, mana: 0, atk: 1 },
    forms: [{ id: "frondeur_gob", name: "Gobelin frondeur", level: 1, speed: 18, res: { sacre: -10 }, skills: [["tir_fronde", 1], ["repos", 1], ["marque", 6]] }],
    rules: [R3("repos", ME2, "selfEnergyBelow", 15), R3("marque", SE2, "targetLacksState", void 0, "marque"), R3("tir_fronde", WE2), R3("avancer", ME2, "noEnemyInRange")],
    drops: ["oreille_gobelin", "pierre_lisse", "cuir_brut"]
  },
  loup_gris: {
    region: 0,
    name: "Loup gris",
    units: 1,
    pop: 1,
    tags: ["bete"],
    role: "harc\xE8lement",
    weapon: "crocs_gris",
    defaultDist: 1,
    base: { hp: 60, will: 45, energy: 90, mana: 0, atk: 4 },
    growth: { hp: 4, will: 1, energy: 2, mana: 0, atk: 1 },
    forms: [{ id: "loup_gris", name: "Loup gris", level: 1, speed: 15, res: { glace: 20, feu: -20 }, skills: [["morsure", 1], ["repos", 1], ["charge", 4], ["hurlement", 8]] }],
    rules: [R3("repos", ME2, "selfEnergyBelow", 10), R3("hurlement", ME2, "selfWillBelow", 60), R3("charge", WE2), R3("morsure", WE2), R3("avancer", ME2, "noEnemyInRange")],
    drops: ["croc_loup", "cuir_brut", "cuir_epais"]
  },
  araignee: {
    region: 0,
    name: "Araign\xE9e des ronces",
    units: 1,
    pop: 2,
    tags: ["bete"],
    role: "poison",
    weapon: "chelic\xE8res",
    defaultDist: 2,
    base: { hp: 75, will: 50, energy: 80, mana: 30, atk: 3 },
    growth: { hp: 4, will: 1, energy: 1, mana: 2, atk: 1 },
    forms: [{ id: "araignee", name: "Araign\xE9e des ronces", level: 1, speed: 18, res: { maladie: 40, feu: -25 }, skills: [["emploi", 1], ["repos", 1], ["nuage", 3], ["grappin", 6]] }],
    rules: [R3("repos", ME2, "selfEnergyBelow", 15), R3("nuage", NE2, "targetLacksState", void 0, "poison"), R3("grappin", SE2, "selfEnergyAbove", 70), R3("emploi", NE2), R3("avancer", ME2, "noEnemyInRange")],
    drops: ["fil_araignee", "venin", "champignon_pale"]
  },
  chaman: {
    region: 0,
    name: "Chaman gobelin",
    units: 1,
    pop: 2,
    tags: ["gobelin"],
    role: "soin, mal\xE9dictions",
    weapon: "baton_os",
    defaultDist: 3,
    base: { hp: 55, will: 60, energy: 70, mana: 45, atk: 2 },
    growth: { hp: 3, will: 2, energy: 1, mana: 3, atk: 1 },
    forms: [{ id: "chaman", name: "Chaman gobelin", level: 1, speed: 22, res: { tenebres: 25, sacre: -25 }, skills: [["emploi", 1], ["trait_flammes", 1], ["soin_mineur", 3], ["murmure", 6], ["malediction", 9]] }],
    rules: [R3("soin_mineur", MW2, "allyHpBelow", 50), R3("malediction", SE2, "targetLacksState", void 0, "malediction"), R3("murmure", "lowestWillEnemy"), R3("trait_flammes", WE2), R3("emploi", NE2), R3("attendre", ME2)],
    drops: ["plume_corbeau", "champignon_pale", "oreille_gobelin", "totem_gobelin"]
  },
  troll: {
    region: 0,
    name: "Troll des fourr\xE9s",
    units: 1,
    pop: 3,
    tags: ["geant"],
    role: "brute",
    weapon: "gourdin",
    defaultDist: 1,
    base: { hp: 150, will: 55, energy: 110, mana: 0, atk: 6 },
    growth: { hp: 9, will: 1, energy: 2, mana: 0, atk: 2 },
    forms: [{ id: "troll", name: "Troll des fourr\xE9s", level: 1, speed: 26, res: { contondant: 20, feu: -20 }, skills: [["emploi", 1], ["repos", 1], ["exploit", 3], ["riposte", 6]] }],
    rules: [R3("repos", ME2, "selfEnergyBelow", 15), R3("exploit", NE2, "selfEnergyAbove", 50), R3("emploi", NE2), R3("avancer", ME2, "noEnemyInRange")],
    drops: ["os_ancien", "cuir_epais", "pierre_lisse"]
  },
  sylvain: {
    region: 0,
    name: "Sylvain des Ronces",
    units: 1,
    pop: 4,
    tags: ["plante"],
    role: "gardien",
    weapon: "branches",
    defaultDist: 1,
    boss: true,
    base: { hp: 300, will: 90, energy: 130, mana: 30, atk: 9 },
    growth: { hp: 12, will: 2, energy: 2, mana: 2, atk: 2 },
    forms: [{ id: "sylvain", name: "Sylvain des Ronces", level: 1, speed: 25, res: { tranchant: 25, contondant: 15, maladie: 30, feu: -30 }, skills: [["emploi", 1], ["repos", 1], ["repousser", 1], ["brise_armure", 1], ["regeneration", 1], ["riposte", 1]] }],
    rules: [R3("repos", ME2, "selfEnergyBelow", 15), R3("regeneration", ME2, "selfHpBelow", 50), R3("brise_armure", SE2, "targetLacksState", void 0, "brise"), R3("repousser", NE2, "selfEnergyAbove", 70), R3("emploi", NE2), R3("avancer", ME2, "noEnemyInRange")],
    drops: ["seve_ambree", "bois_tordu", "resine", "coeur_ronce"]
  }
};
var ALL_SKILLS = { ...DEFAULT_SKILLS, ...NEW_SKILLS };
for (const r of MONSTER_ROWS) MONSTERS[r.id] = { ...monsterToTroop(r, ALL_SKILLS), drops: r.drops, boss: r.boss, region: r.region };
var MONSTER_LEVEL_BONUS = 2;
function steps(L, tier, defs, guardian, firstPop, guardianPop = [8, 9]) {
  const pops = [firstPop, [firstPop[1], firstPop[1] + 1], [3, 5], [5, 7], guardianPop];
  const gold = [8, 12, 16, 22, 40].map((g2) => g2 * tier * tier);
  return defs.map(([id, name, desc, pool, mats], i) => ({
    id,
    name,
    desc,
    pool,
    mats,
    tier,
    gold: gold[i],
    level: i < 4 ? [L + i + MONSTER_LEVEL_BONUS, L + i + 1 + MONSTER_LEVEL_BONUS] : [L + 5 + MONSTER_LEVEL_BONUS, L + 6 + MONSTER_LEVEL_BONUS],
    pop: pops[i],
    draws: i < 2 ? [1, 2] : i < 4 ? [2, 2] : [2, 3],
    ...i === 4 ? { guardian: true, forced: [guardian] } : {}
  }));
}
var shop = (tier, cats) => [...cats.map((c) => `${c}_${tier}`), "bandage", "potion_mineure", ...tier >= 2 ? ["potion_soin", "potion_mana"] : []];
var REGIONS = [
  {
    id: "ronces",
    name: "Pays de Havre-Gris",
    tier: 1,
    minLevel: 1,
    firstItem: "coeur_ronce",
    guardianLoot: "ecorce_vivante",
    city: { name: "Havre-Gris", desc: "Capitale de la r\xE9gion. Banque, atelier, recrutement, temple et marchand.", recruit: ["milicien", "chasseur", "acolyte", "frondeurs", "moine", "ecuyer", "herboriste", "braconniers"], shop: shop(1, ["lame", "baton", "arc", "legere", "robe"]) },
    territory: {
      name: "For\xEAt des Ronces",
      desc: "Une for\xEAt \xE9touff\xE9e de ronces o\xF9 gobelins, b\xEAtes et araign\xE9es se disputent les sentiers. Le Sylvain qui garde son c\u0153ur barre la route du marais.",
      steps: steps(1, 1, [
        ["lisiere", "Lisi\xE8re", "Des loups r\xF4dent et quelques gobelins guettent les voyageurs.", ["loup_gris", "gobelins", "frondeurs_gob", "corbeaux"], ["bois_tordu", "pierre_lisse", "champignon_pale"]],
        ["sentier", "Sentier des pillards", "Les bandes gobelines tiennent le sentier.", ["gobelins", "frondeurs_gob", "loup_gris", "corbeaux"], ["bois_tordu", "resine", "plume_corbeau"]],
        ["nids", "Nids de soie", "Les arbres sont pris dans les toiles.", ["araignee", "loup_gris", "frondeurs_gob", "loup_alpha"], ["resine", "fil_araignee", "champignon_pale"]],
        ["camp", "Camp gobelin", "Le chaman y tient sa cour, prot\xE9g\xE9 par un troll.", ["gobelins", "frondeurs_gob", "chaman", "troll"], ["ferraille", "fer_noir", "plume_corbeau"]],
        ["coeur", "C\u0153ur des Ronces", "Le gardien de la for\xEAt. Le vaincre ouvre la route du marais.", ["loup_gris", "araignee", "loup_alpha"], ["seve_ambree", "os_ancien", "resine"]]
      ], "sylvain", [1, 2])
    }
  },
  {
    id: "marais",
    name: "C\xF4te de Port-Salant",
    tier: 2,
    minLevel: 6,
    firstItem: "coeur_marais",
    guardianLoot: "cape_noyes",
    city: { name: "Port-Salant", desc: "Port de p\xEAcheurs adoss\xE9 au marais, ses quais sentent la vase et le goudron.", recruit: ["pyromancien", "loups", "berserker", "harponneur", "sorciere_marais", "gardes_maree", "arbaletrier", "chamane_crues"], shop: shop(2, ["lame", "deuxmains", "arc", "moyenne", "robe"]) },
    territory: {
      name: "Marais des Noy\xE9s",
      desc: "Des eaux noires o\xF9 les morts ne restent pas couch\xE9s. Au centre, la M\xE8re des Noy\xE9s.",
      steps: steps(6, 2, [
        ["berges", "Berges", "Moustiques et crapauds sur la vase.", ["moustiques", "crapaud", "sangsues", "hommes_lezards"], ["algue_noire", "tourbe", "venin"]],
        ["roselieres", "Roseli\xE8res", "Les hommes-l\xE9zards chassent entre les roseaux.", ["hommes_lezards", "feu_follet", "crapaud", "pecheurs_maudits"], ["ecaille_terne", "plume_heron", "algue_noire"]],
        ["epaves", "Cimeti\xE8re des \xE9paves", "Des barques coul\xE9es, et ceux qui les menaient.", ["noyes", "pecheurs_maudits", "spectre_brumes", "sangsues"], ["fer_noir", "algue_noire", "os_ancien"]],
        ["tertre", "Tertre de la sorci\xE8re", "La sorci\xE8re noy\xE9e y garde ses b\xEAtes.", ["sorciere_noyee", "crocodile", "troll_marais", "noyes"], ["tourbe", "seve_ambree", "ecaille_terne"]],
        ["gouffre", "Gouffre des Noy\xE9s", "La gardienne du marais.", ["noyes", "spectre_brumes", "sangsues"], ["algue_noire", "perle_noyee", "plume_heron"]]
      ], "mere_noyes", [2, 3], [6, 7])
    }
  },
  {
    id: "mines",
    name: "Monts de Rochecreuse",
    tier: 3,
    minLevel: 11,
    firstItem: "gemme_profonde",
    guardianLoot: "poings_forge",
    city: { name: "Rochecreuse", desc: "Cit\xE9 naine creus\xE9e dans la montagne, forges allum\xE9es jour et nuit.", recruit: ["briseur", "adepte", "mineurs", "forgeron_runes", "eclaireuse", "alchimiste", "gardien_pierre", "mage_cristal"], shop: shop(3, ["masse", "fronde", "gantelets", "lourde", "robe"]) },
    territory: {
      name: "Mines de Fer-Hurlant",
      desc: "Des galeries abandonn\xE9es par les nains, reprises par les kobolds et pire encore.",
      steps: steps(11, 3, [
        ["entree", "Entr\xE9e des mines", "Kobolds et chauves-souris.", ["kobolds", "chauves_souris", "artificier", "gelee"], ["charbon_dense", "minerai_argent", "soufre"]],
        ["galeries", "Galeries effondr\xE9es", "Les vers creusent de nouveaux tunnels.", ["ver_galeries", "kobolds", "contremaitre", "gelee"], ["soie_profonde", "charbon_dense", "cuir_basilic"]],
        ["filons", "Filons de cristal", "Les \xE9l\xE9mentaires gardent les gisements.", ["elementaire_cristal", "nains_renegats", "mineurs_fantomes", "artificier"], ["cristal_brut", "minerai_argent", "soufre"]],
        ["puits", "Puits du basilic", "Le regard du basilic fige les imprudents.", ["basilic", "golem_pierre", "nains_renegats", "mineurs_fantomes"], ["cuir_basilic", "cristal_brut", "soie_profonde"]],
        ["forge", "Forge oubli\xE9e", "Le gardien des mines.", ["golem_pierre", "kobolds", "artificier"], ["minerai_argent", "cristal_brut", "charbon_dense"]]
      ], "coeur_forge", [2, 3])
    }
  },
  {
    id: "desert",
    name: "Terres de Cendrelune",
    tier: 4,
    minLevel: 16,
    firstItem: "coeur_dragon",
    guardianLoot: "ecailles_dragon",
    city: { name: "Cendrelune", desc: "Oasis fortifi\xE9e au bord du d\xE9sert, carrefour des caravanes.", recruit: ["lanciers_cendres", "nomade", "derviche", "pretresse_soleil", "scorpions", "mage_cendre", "garde_oasis", "barde"], shop: shop(4, ["lame", "arc", "baton", "legere", "moyenne"]) },
    territory: {
      name: "D\xE9sert de Cendre",
      desc: "Dunes grises et ruines br\xFBl\xE9es. Un dragon dort sous la plus haute.",
      steps: steps(16, 4, [
        ["dunes", "Dunes grises", "Vautours et scorpions.", ["vautours", "scorpions_geants", "archers_nomades", "ombre_mirage"], ["sel_ardent", "ecorce_cendre", "chitine_doree"]],
        ["caravane", "Piste des caravanes", "Les pillards guettent les convois.", ["pillards_sable", "archers_nomades", "scorpions_geants", "salamandre"], ["ecorce_cendre", "verre_cendre", "sel_ardent"]],
        ["tombeaux", "Tombeaux ensabl\xE9s", "Les momies veillent leurs pr\xEAtres.", ["momies", "pretre_scarabee", "ombre_mirage", "djinn"], ["essence_mirage", "os_dragonnet", "chitine_doree"]],
        ["verrerie", "Champs de verre", "Le sable fondu a donn\xE9 naissance \xE0 des golems.", ["golem_verre", "ver_sables", "djinn", "salamandre"], ["verre_cendre", "os_dragonnet", "essence_mirage"]],
        ["antre", "Antre du dragon", "Le gardien du d\xE9sert.", ["salamandre", "scorpions_geants", "djinn"], ["os_dragonnet", "verre_cendre", "sel_ardent"]]
      ], "dragon_cendre", [3, 4], [9, 10])
    }
  },
  {
    id: "ciel",
    name: "Hauteurs de l'Aube",
    tier: 5,
    minLevel: 21,
    firstItem: "couronne_aube",
    guardianLoot: "diademe_aube",
    city: { name: "Sanctuaire de l'Aube", desc: "Dernier temple debout au pied des ruines c\xE9lestes.", recruit: ["paladin", "archonte_aube", "lames_jumelles", "tireur_astral", "oracle", "chevalier_griffon", "invocatrice", "gardiens_celestes"], shop: shop(5, ["lame", "deuxmains", "baton", "lourde", "robe"]) },
    territory: {
      name: "Ruines C\xE9lestes",
      desc: "Les marches bris\xE9es d'une cit\xE9 tomb\xE9e du ciel. L'Archonte d\xE9chu y r\xE8gne encore.",
      steps: steps(21, 5, [
        ["marches", "Marches bris\xE9es", "Harpies et gargouilles.", ["harpies", "gargouilles", "griffons", "sentinelles"], ["plume_seraphique", "pierre_lune", "fil_lumiere"]],
        ["parvis", "Parvis des sentinelles", "Les gardiens de marbre tiennent encore leur poste.", ["sentinelles", "archers_celestes", "gargouilles", "griffons"], ["pierre_lune", "eclat_astral", "fil_lumiere"]],
        ["observatoire", "Observatoire", "Les astromanciens lisent un ciel qui n\u2019existe plus.", ["astromancien", "spectres_lumiere", "anges_dechus", "harpies"], ["poussiere_etoile", "eclat_astral", "larme_aube"]],
        ["jardins", "Jardins suspendus", "Chim\xE8res et golems errent entre les fontaines.", ["chimere", "golem_astral", "gardien_seuil", "anges_dechus"], ["larme_aube", "plume_seraphique", "poussiere_etoile"]],
        ["trone", "Tr\xF4ne de l'Archonte", "Le gardien des ruines.", ["anges_dechus", "spectres_lumiere", "archers_celestes"], ["eclat_astral", "larme_aube", "plume_seraphique"]]
      ], "archonte_dechu", [3, 4], [7, 7])
    }
  }
];
var ECO = {
  startGold: 200,
  startTroops: [["milicien", 1], ["chasseur", 1]],
  startItems: { bandage: 3 },
  /** En plus : les ingrédients de la recette personnelle de ce type, pour un premier recrutement. */
  startRecipe: "acolyte",
  /** Mana regagné par chaque unité survivante à la fin d'un combat, en % du mana max (décision de Xavier, 3 novembre 2026). */
  manaRegenEnd: 25,
  /** Renfort des monstres en millièmes (PV, attaque), après le doublement des bonus d'équipement (Xavier, 3 novembre 2026). */
  monsterHp: [1250, 1700, 2300, 4500, 3800],
  monsterAtk: [1200, 1500, 1900, 3200, 2800],
  guardianAdj: [1e3, 1e3, 1050, 480, 1050],
  // par région, croissant pour que la difficulté monte (Xavier, 3 novembre 2026) ; gardiens ajustés à part
  bagSlots: 20,
  bankSlots: 100,
  buyBack: 0.2,
  sellMarkup: 1.5,
  shopRoll: 800,
  recruitGoldPerPop: 40,
  craftGoldPerTier: 6,
  xpPerMonsterLevelPop: 8,
  xpToNext: (lvl) => Math.round(50 * lvl * (1 + lvl / 10)),
  maxLevel: 30,
  /** Proportions d'un tirage de rencontre (spec objets 3.3) et d'un tirage garanti de gardien. */
  table: { materiau: 85, composant: 5, consommable: 7, equipement: 3 },
  guardianTable: { composant: 50, equipement: 30, materiau: 20 }
};
var CRAFT_CONSUMABLES = ["bandage", "potion_mineure", "potion_soin", "potion_mana", "potion_mana_normale", "potion_majeure", "tonique"];
function recruitRegion(type) {
  return REGIONS.findIndex((r) => r.city.recruit.includes(type));
}
function workshopRegion(baseId) {
  const b = EQUIP[baseId];
  return b?.workshop ? b.tier - 1 : -1;
}
function gameContent() {
  const c = defaultContent();
  Object.assign(c.skills, NEW_SKILLS);
  Object.assign(c.weapons, MONSTER_WEAPONS, MONSTER_WEAPONS2, NEW_WEAPONS);
  for (const r of UNIT_ROWS) c.troops[r.id] = rowToTroop(r, c.skills);
  for (const [id, m2] of Object.entries(MONSTERS)) {
    const { drops, boss, region, rare, ...def } = m2;
    c.troops[id] = def;
  }
  return c;
}

