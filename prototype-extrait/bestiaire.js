var MONSTER_WEAPONS2 = {
  griffes_m: { name: "Griffes", type: "tranchant", dmg: 10, speed: 15, cost: 8 },
  dard: { name: "Dard", type: "maladie", dmg: 9, speed: 16, cost: 8 },
  lame_rouillee: { name: "Lame rouill\xE9e", type: "tranchant", dmg: 11, speed: 19, cost: 9 },
  poing_pierre: { name: "Poings de pierre", type: "contondant", dmg: 16, speed: 26, cost: 12 },
  harpon_m: { name: "Harpon", type: "tranchant", dmg: 12, speed: 20, cost: 10 },
  baton_m: { name: "B\xE2ton tordu", type: "contondant", dmg: 6, speed: 22, cost: 6 },
  arc_m: { name: "Arc court", type: "tranchant", dmg: 11, speed: 18, cost: 10 },
  bec: { name: "Bec", type: "tranchant", dmg: 8, speed: 14, cost: 6 },
  mains_spectrales: { name: "Mains spectrales", type: "tenebres", dmg: 9, speed: 18, cost: 7 },
  lame_lumiere: { name: "Lame de lumi\xE8re", type: "sacre", dmg: 14, speed: 20, cost: 10 },
  machoires: { name: "M\xE2choires", type: "tranchant", dmg: 15, speed: 22, cost: 12 },
  souffle: { name: "Souffle br\xFBlant", type: "feu", dmg: 12, speed: 20, cost: 10 }
};
var m = (region, id, name, units, pop, tags, role, weapon, dist, base, growth, speed, res, skills, drops, boss = false) => ({ id, name, units, pop, tags, role, weapon, dist, base, growth, speed, res, skills, drops, region, boss });
var G1 = [3, 1, 1, 0, 1];
var G2 = [5, 1, 2, 1, 1];
var G3 = [8, 1, 2, 1, 2];
var GM = [3, 2, 1, 3, 1];
var GB = [13, 2, 2, 2, 2];
var MONSTER_ROWS = [
  // Région 1 : Forêt des Ronces (en plus des 7 existants)
  m(0, "loup_alpha", "Loup alpha", 1, 2, ["bete"], "chef de meute", "crocs_gris", 1, [90, 60, 100, 0, 6], G2, 14, { glace: 25, feu: -20 }, ["morsure", "repos", "charge", "hurlement"], ["croc_loup", "cuir_epais", "cuir_brut"]),
  m(0, "corbeaux", "Nu\xE9e de corbeaux", 3, 2, ["bete"], "harc\xE8lement", "bec", 1, [30, 35, 70, 0, 2], G1, 13, { contondant: -20 }, ["morsure", "repos"], ["plume_corbeau", "champignon_pale"]),
  // Région 2 : Marais des Noyés
  m(1, "noyes", "Noy\xE9s", 3, 3, ["mort-vivant"], "nu\xE9e au contact", "lame_rouillee", 1, [50, 90, 70, 0, 3], G1, 21, { maladie: 50, sacre: -40, glace: 20 }, ["emploi", "repos", "lame_saignante"], ["algue_noire", "os_ancien", "perle_noyee"]),
  m(1, "crapaud", "Crapaud g\xE9ant", 1, 2, ["bete"], "poison", "dard", 1, [110, 50, 90, 0, 4], G2, 20, { maladie: 40 }, ["morsure", "repos", "morsure_venin", "jet_toile"], ["venin", "ecaille_terne"]),
  m(1, "sangsues", "Sangsues g\xE9antes", 3, 2, ["bete"], "drain", "dard", 1, [40, 40, 70, 30, 2], G1, 17, { maladie: 30, feu: -30 }, ["morsure", "toucher_spectral"], ["algue_noire", "venin"]),
  m(1, "feu_follet", "Feu follet", 1, 1, ["esprit"], "feu \xE0 distance", "mains_spectrales", 3, [45, 70, 60, 50, 3], GM, 18, { feu: 60, glace: -30, tranchant: 30 }, ["emploi", "trait_flammes", "meditation"], ["tourbe", "plume_heron"]),
  m(1, "hommes_lezards", "Hommes-l\xE9zards", 2, 2, ["reptile"], "contact, ralentit", "harpon_m", 1, [80, 55, 90, 0, 4], G2, 19, { glace: -20, maladie: 20 }, ["emploi", "repos", "coup_jarret", "grappin"], ["ecaille_terne", "cuir_epais"]),
  m(1, "sorciere_noyee", "Sorci\xE8re noy\xE9e", 1, 2, ["mort-vivant"], "mal\xE9dictions", "baton_m", 3, [70, 80, 70, 55, 2], GM, 23, { maladie: 40, sacre: -40 }, ["emploi", "fleau", "affaiblissement", "meditation"], ["algue_noire", "perle_noyee", "seve_ambree"]),
  m(1, "crocodile", "Crocodile des fanges", 1, 3, ["reptile", "bete"], "brute", "machoires", 1, [170, 55, 110, 0, 7], G3, 24, { tranchant: 20, glace: -20 }, ["morsure", "repos", "assassinat"], ["ecaille_terne", "cuir_epais", "os_ancien"]),
  m(1, "moustiques", "Essaim de moustiques", 3, 1, ["bete"], "nu\xE9e", "dard", 1, [22, 30, 60, 0, 1], G1, 12, { feu: -40 }, ["morsure", "morsure_venin"], ["venin", "tourbe"]),
  m(1, "troll_marais", "Troll des marais", 1, 3, ["geant"], "brute qui se soigne", "gourdin", 1, [180, 55, 110, 30, 6], G3, 26, { contondant: 20, feu: -30 }, ["emploi", "repos", "coup_massue", "seve"], ["os_ancien", "tourbe", "cuir_epais"]),
  m(1, "spectre_brumes", "Spectre des brumes", 1, 2, ["mort-vivant", "esprit"], "drain, peur", "mains_spectrales", 2, [70, 90, 80, 45, 3], GM, 18, { tranchant: 40, contondant: 40, sacre: -50 }, ["emploi", "toucher_spectral", "cri_effroi"], ["plume_heron", "perle_noyee"]),
  m(1, "pecheurs_maudits", "P\xEAcheurs maudits", 2, 2, ["mort-vivant"], "attirent", "harpon_m", 2, [65, 80, 80, 0, 4], G2, 20, { maladie: 40, sacre: -40 }, ["emploi", "repos", "grappin"], ["algue_noire", "fer_noir"]),
  m(1, "mere_noyes", "M\xE8re des Noy\xE9s", 1, 5, ["mort-vivant"], "gardienne", "mains_spectrales", 2, [320, 100, 120, 80, 9], GB, 22, { maladie: 50, glace: 30, sacre: -40 }, ["emploi", "fleau", "tempete_givre", "toucher_spectral", "cercle_soins"], ["perle_noyee", "algue_noire", "coeur_marais"], true),
  // Région 3 : Mines de Fer-Hurlant
  m(2, "kobolds", "Kobolds", 3, 2, ["kobold"], "nu\xE9e", "lame_rouillee", 1, [42, 40, 80, 0, 3], G1, 16, { feu: 10 }, ["emploi", "repos", "lame_saignante"], ["minerai_argent", "charbon_dense"]),
  m(2, "artificier", "Kobold artificier", 1, 1, ["kobold"], "explosifs", "flasques", 3, [50, 45, 70, 30, 3], G1, 19, { feu: 30 }, ["tir_fronde", "fleche_feu", "repos"], ["soufre", "charbon_dense"]),
  m(2, "golem_pierre", "Golem de pierre", 1, 3, ["construct"], "tank", "poing_pierre", 1, [200, 99, 110, 0, 6], G3, 28, { contondant: 35, tranchant: 35, maladie: 50, glace: -20 }, ["emploi", "repos", "coup_massue", "carapace_epines"], ["cristal_brut", "noyau_golem"]),
  m(2, "chauves_souris", "Chauves-souris des puits", 3, 1, ["bete"], "harc\xE8lement", "bec", 1, [28, 40, 60, 0, 2], G1, 12, { sacre: -20 }, ["morsure", "repos"], ["cuir_basilic", "charbon_dense"]),
  m(2, "ver_galeries", "Ver des galeries", 1, 2, ["bete"], "poison, secousses", "machoires", 1, [130, 50, 100, 0, 5], G2, 23, { contondant: 20 }, ["morsure", "morsure_venin", "frappe_sismique"], ["soie_profonde", "cuir_basilic"]),
  m(2, "nains_renegats", "Nains ren\xE9gats", 2, 2, ["nain"], "contact, \xE9tourdit", "pioche", 1, [90, 65, 100, 0, 5], G2, 21, { contondant: 15, feu: 15 }, ["emploi", "repos", "coup_tonnerre"], ["minerai_argent", "fer_noir"]),
  m(2, "elementaire_cristal", "\xC9l\xE9mentaire de cristal", 1, 2, ["construct"], "glace", "mains_spectrales", 3, [80, 99, 70, 60, 3], GM, 22, { glace: 60, contondant: -30 }, ["emploi", "eclat_glace", "tempete_givre", "meditation"], ["cristal_brut", "gemme_profonde"]),
  m(2, "basilic", "Basilic", 1, 3, ["reptile"], "regard affaiblissant", "machoires", 1, [160, 70, 100, 40, 6], G3, 23, { tranchant: 20, maladie: 20 }, ["morsure", "affaiblissement", "morsure_venin"], ["cuir_basilic", "soie_profonde"]),
  m(2, "gelee", "Gel\xE9e acide", 1, 1, ["vase"], "poison", "dard", 1, [80, 99, 60, 0, 3], G1, 22, { tranchant: 30, contondant: 30, feu: -30 }, ["morsure", "morsure_venin"], ["soufre", "soie_profonde"]),
  m(2, "contremaitre", "Contrema\xEEtre kobold", 1, 2, ["kobold"], "chef", "lame_rouillee", 2, [90, 70, 90, 30, 4], G2, 20, { feu: 10 }, ["emploi", "chant_guerre", "repos"], ["minerai_argent", "charbon_dense"]),
  m(2, "mineurs_fantomes", "Mineurs fant\xF4mes", 2, 2, ["mort-vivant"], "drain", "pioche", 1, [70, 80, 80, 30, 4], G2, 21, { tranchant: 30, sacre: -40 }, ["emploi", "toucher_spectral"], ["minerai_argent", "cristal_brut"]),
  m(2, "coeur_forge", "C\u0153ur-de-Forge", 1, 5, ["construct"], "gardien", "poing_pierre", 1, [420, 99, 140, 60, 10], GB, 27, { contondant: 35, tranchant: 35, feu: 50, glace: -20 }, ["emploi", "coup_tonnerre", "frappe_sismique", "carapace_epines", "eruption"], ["noyau_golem", "gemme_profonde", "cristal_brut"], true),
  // Région 4 : Désert de Cendre
  m(3, "scorpions_geants", "Scorpions g\xE9ants", 2, 2, ["bete"], "poison", "dard", 1, [85, 55, 90, 0, 5], G2, 16, { feu: 30, maladie: 30 }, ["morsure", "morsure_venin", "repos"], ["chitine_doree", "sel_ardent"]),
  m(3, "momies", "Momies", 2, 2, ["mort-vivant"], "maladie", "lame_rouillee", 1, [95, 99, 80, 30, 4], G2, 23, { maladie: 50, feu: -40, sacre: -30 }, ["emploi", "fleau"], ["os_dragonnet", "essence_mirage"]),
  m(3, "djinn", "Djinn mineur", 1, 2, ["esprit"], "feu de zone", "souffle", 3, [85, 80, 70, 70, 4], GM, 20, { feu: 70, glace: -30 }, ["emploi", "trait_flammes", "pluie_feu", "meditation"], ["essence_mirage", "flamme_figee"]),
  m(3, "pillards_sable", "Pillards des sables", 3, 3, ["humain"], "assassins", "lame_rouillee", 1, [65, 50, 90, 0, 5], G2, 17, { feu: 20 }, ["emploi", "repos", "assassinat"], ["sel_ardent", "ecorce_cendre"]),
  m(3, "archers_nomades", "Archers nomades", 2, 2, ["humain"], "tir enflamm\xE9", "arc_m", 3, [70, 55, 90, 0, 5], G2, 17, { feu: 20 }, ["tir_arc", "repos", "fleche_feu"], ["ecorce_cendre", "verre_cendre"]),
  m(3, "salamandre", "Salamandre", 1, 2, ["reptile"], "souffle", "souffle", 2, [110, 60, 110, 0, 5], G2, 19, { feu: 80, glace: -40 }, ["emploi", "souffle_feu", "repos"], ["os_dragonnet", "sel_ardent"]),
  m(3, "ver_sables", "Ver des sables", 1, 3, ["bete"], "secousses", "machoires", 1, [200, 50, 120, 0, 7], G3, 25, { contondant: 25 }, ["morsure", "frappe_sismique", "repos"], ["chitine_doree", "os_dragonnet"]),
  m(3, "vautours", "Vautours", 3, 1, ["bete"], "harc\xE8lement", "bec", 1, [35, 40, 70, 0, 3], G1, 13, {}, ["morsure", "repos"], ["ecorce_cendre", "sel_ardent"]),
  m(3, "ombre_mirage", "Ombre du mirage", 1, 1, ["esprit"], "silence", "mains_spectrales", 2, [60, 80, 80, 40, 5], GM, 15, { tranchant: 40, contondant: 40, sacre: -40 }, ["emploi", "lame_ombre", "mot_silence"], ["essence_mirage", "verre_cendre"]),
  m(3, "golem_verre", "Golem de verre", 1, 3, ["construct"], "\xE9pines", "poing_pierre", 1, [190, 99, 110, 0, 6], G3, 27, { tranchant: 40, feu: 40, contondant: -30 }, ["emploi", "coup_massue", "carapace_epines"], ["verre_cendre", "flamme_figee"]),
  m(3, "pretre_scarabee", "Pr\xEAtre-scarab\xE9e", 1, 2, ["humain"], "soin, affaiblit", "baton_m", 3, [80, 80, 70, 60, 3], GM, 22, { feu: 30, sacre: 20 }, ["emploi", "soin_mineur", "affaiblissement", "meditation"], ["chitine_doree", "essence_mirage"]),
  m(3, "dragon_cendre", "Dragon de cendre", 1, 6, ["dragon"], "gardien", "souffle", 1, [600, 99, 150, 80, 13], GB, 24, { feu: 75, tranchant: 25, glace: -30 }, ["emploi", "souffle_feu", "eruption", "coup_massue", "cri_effroi"], ["coeur_dragon", "os_dragonnet", "flamme_figee"], true),
  // Région 5 : Ruines Célestes
  m(4, "sentinelles", "Sentinelles de marbre", 2, 2, ["construct"], "protection", "lame_lumiere", 1, [110, 99, 100, 0, 5], G2, 22, { tranchant: 30, contondant: 20, sacre: 40 }, ["emploi", "provocation", "repos"], ["pierre_lune", "eclat_astral"]),
  m(4, "gargouilles", "Gargouilles", 2, 2, ["construct"], "\xE9pines, coups lourds", "poing_pierre", 1, [110, 99, 100, 0, 6], G2, 23, { contondant: 30, tranchant: 30 }, ["emploi", "coup_massue", "carapace_epines"], ["pierre_lune", "poussiere_etoile"]),
  m(4, "anges_dechus", "Ange d\xE9chu", 1, 2, ["celeste"], "ombre et drain", "lame_lumiere", 2, [100, 80, 90, 50, 6], G2, 18, { tenebres: 40, sacre: 40 }, ["emploi", "lame_ombre", "toucher_spectral"], ["plume_seraphique", "larme_aube"]),
  m(4, "harpies", "Harpies c\xE9lestes", 3, 2, ["bete"], "peur", "griffes_m", 1, [55, 50, 90, 0, 4], G1, 13, { glace: 20 }, ["morsure", "cri_effroi", "repos"], ["plume_seraphique", "fil_lumiere"]),
  m(4, "astromancien", "Astromancien", 1, 2, ["humain"], "glace, silence", "baton_m", 3, [80, 90, 70, 70, 3], GM, 22, { glace: 40, psychique: 30 }, ["emploi", "tempete_givre", "mot_silence", "meditation"], ["eclat_astral", "poussiere_etoile"]),
  m(4, "golem_astral", "Golem astral", 1, 3, ["construct"], "tank", "poing_pierre", 1, [230, 99, 120, 0, 7], G3, 27, { contondant: 35, tranchant: 35, sacre: 30 }, ["emploi", "coup_tonnerre", "carapace_epines"], ["eclat_astral", "pierre_lune", "plume_archonte"]),
  m(4, "griffons", "Griffon sauvage", 1, 2, ["bete"], "charge", "griffes_m", 1, [120, 60, 110, 0, 6], G2, 15, { tranchant: 15 }, ["morsure", "charge", "repos"], ["plume_seraphique", "fil_lumiere"]),
  m(4, "spectres_lumiere", "Spectres de lumi\xE8re", 2, 2, ["esprit"], "sacr\xE9 de zone", "lame_lumiere", 3, [65, 90, 70, 50, 4], GM, 20, { sacre: 60, tenebres: -40, tranchant: 30 }, ["emploi", "nova_sacree", "javelot_lumiere"], ["larme_aube", "fil_lumiere"]),
  m(4, "chimere", "Chim\xE8re", 1, 3, ["bete"], "feu et poison", "machoires", 1, [190, 70, 120, 0, 7], G3, 20, { feu: 40, maladie: 30 }, ["morsure", "souffle_feu", "morsure_venin"], ["poussiere_etoile", "os_dragonnet"]),
  m(4, "archers_celestes", "Archers c\xE9lestes", 2, 2, ["celeste"], "tir perforant", "arc_m", 3, [75, 70, 100, 0, 6], G2, 17, { sacre: 30 }, ["tir_arc", "tir_perforant", "repos"], ["fil_lumiere", "eclat_astral"]),
  m(4, "gardien_seuil", "Gardien du seuil", 1, 3, ["celeste"], "protection, \xE9tourdit", "lame_lumiere", 1, [210, 99, 120, 30, 7], G3, 22, { sacre: 50, tranchant: 25, contondant: 25 }, ["emploi", "provocation", "coup_tonnerre", "benediction"], ["larme_aube", "plume_archonte"]),
  m(4, "archonte_dechu", "Archonte d\xE9chu", 1, 6, ["celeste"], "gardien", "lame_lumiere", 2, [480, 99, 150, 100, 11], GB, 21, { sacre: 50, tenebres: 50, psychique: 40 }, ["emploi", "nova_sacree", "eruption", "cercle_soins", "mot_silence", "lame_ombre"], ["couronne_aube", "plume_archonte", "larme_aube"], true)
];
function monsterToTroop(r, SK) {
  const [hp, will, energy, mana, atk] = r.base, [gh, gw, ge, gm, ga] = r.growth;
  return {
    name: r.name,
    units: r.units,
    pop: r.pop,
    tags: r.tags,
    role: r.role,
    weapon: r.weapon,
    defaultDist: r.dist,
    base: { hp, will, energy, mana, atk },
    growth: { hp: gh, will: gw, energy: ge, mana: gm, atk: ga },
    forms: [{ id: r.id, name: r.name, level: 1, speed: r.speed, res: r.res, skills: r.skills.map((s3) => [s3, 1]) }],
    rules: genRules(r.skills, SK)
  };
}

