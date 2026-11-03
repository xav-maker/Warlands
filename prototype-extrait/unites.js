var NEW_WEAPONS = {
  lance: { name: "Lance", type: "tranchant", dmg: 13, speed: 21, cost: 11 },
  dague: { name: "Dague", type: "tranchant", dmg: 9, speed: 14, cost: 6 },
  arbalete: { name: "Arbal\xE8te", type: "tranchant", dmg: 15, speed: 24, cost: 12 },
  griffes: { name: "Griffes de combat", type: "tranchant", dmg: 9, speed: 13, cost: 6 },
  sceptre: { name: "Sceptre", type: "sacre", dmg: 7, speed: 22, cost: 6 },
  pioche: { name: "Pioche", type: "contondant", dmg: 12, speed: 21, cost: 10 },
  flasques: { name: "Flasques", type: "feu", dmg: 7, speed: 18, cost: 7 },
  dard_s: { name: "Dards", type: "maladie", dmg: 9, speed: 15, cost: 7 }
};
var A = { arme: ["une_main"], armure: ["legere", "moyenne", "lourde"], accessoire: ["bottes", "anneau"] };
var MAGE = { arme: ["baton"], armure: ["robe"], accessoire: ["bottes", "anneau"] };
var TIR = { arme: ["arc"], armure: ["legere"], accessoire: ["bottes", "anneau"] };
var BETE = { accessoire: ["collier"] };
var u = (id, name, units, pop, tags, role, weapon, dist, base, growth, speed, res, skills, slots, region) => ({ id, name, units, pop, tags, role, weapon, dist, base, growth, speed, res, skills, slots, region });
var UNIT_ROWS = [
  // Région 1 : Havre-Gris
  u("ecuyer", "\xC9cuyer", 1, 1, ["humain"], "contact, ralentit", "epee", 1, [95, 55, 100, 0, 5], [6, 1, 2, 0, 1], 19, { tranchant: 10 }, [["emploi", 1], ["coup_jarret", 3], ["second_souffle", 6], ["exploit", 8], ["coup_tonnerre", 12]], A, 0),
  u("herboriste", "Herboriste", 1, 1, ["humain"], "soin, protection", "masse", 3, [70, 75, 80, 40, 2], [4, 2, 1, 2, 0.5], 22, { maladie: 25 }, [["emploi", 1], ["seve", 1], ["meditation", 1], ["peau_ecorce", 4], ["soin_mineur", 8], ["cercle_soins", 15]], { arme: ["une_main", "baton"], armure: ["robe", "legere"], accessoire: ["bottes", "anneau"] }, 0),
  u("braconniers", "Braconniers", 2, 2, ["humain"], "tir, poison", "arc", 3, [60, 45, 85, 0, 3], [3, 1, 2, 0, 1], 18, { glace: 10 }, [["tir_arc", 1], ["repos", 1], ["tir_empoisonne", 3], ["tir_recul", 8]], TIR, 0),
  // Région 2 : Port-Salant
  u("harponneur", "Harponneur", 1, 1, ["humain"], "attire et ach\xE8ve", "lance", 1, [90, 55, 100, 0, 5], [5, 1, 2, 0, 1], 20, { glace: 15 }, [["emploi", 1], ["repos", 1], ["grappin", 3], ["coup_jarret", 6], ["assassinat", 14]], { arme: ["deux_mains"], armure: ["legere"], accessoire: ["bottes", "anneau"] }, 1),
  u("sorciere_marais", "Sorci\xE8re des marais", 1, 2, ["humain"], "poison, affaiblissement", "baton", 3, [65, 70, 70, 50, 2], [3, 2, 1, 3, 1], 23, { maladie: 40, feu: -20 }, [["emploi", 1], ["fleau", 1], ["meditation", 1], ["affaiblissement", 4], ["toucher_spectral", 8], ["nuage", 14]], MAGE, 1),
  u("gardes_maree", "Gardes de la mar\xE9e", 2, 2, ["humain"], "protection", "epee", 1, [85, 60, 100, 0, 4], [5, 1, 2, 0, 1], 20, { tranchant: 15, contondant: 10 }, [["emploi", 1], ["repos", 1], ["provocation", 3], ["carapace_epines", 6], ["coup_bouclier", 10]], A, 1),
  u("arbaletrier", "Arbal\xE9trier", 1, 1, ["humain"], "tir lourd", "arbalete", 3, [80, 55, 95, 0, 4], [4, 1, 2, 0, 1], 19, {}, [["tir_arc", 1], ["repos", 1], ["tir_perforant", 5], ["tir_precis", 10]], TIR, 1),
  u("chamane_crues", "Chamane des crues", 1, 2, ["humain"], "glace, soin", "baton", 3, [70, 70, 75, 50, 2], [4, 2, 1, 3, 1], 22, { glace: 30, feu: -15 }, [["emploi", 1], ["eclat_glace", 1], ["meditation", 1], ["soin_mineur", 3], ["tempete_givre", 10]], MAGE, 1),
  // Région 3 : Rochecreuse
  u("mineurs", "Mineurs de fond", 3, 2, ["nain"], "nu\xE9e au contact", "pioche", 1, [60, 60, 90, 0, 3], [4, 1, 2, 0, 1], 21, { contondant: 15 }, [["emploi", 1], ["repos", 1], ["coup_massue", 4], ["frappe_sismique", 8]], A, 2),
  u("forgeron_runes", "Forgeron des runes", 1, 2, ["nain"], "renfort, \xE9tourdit", "masse", 1, [120, 70, 110, 30, 5], [7, 1, 2, 2, 1], 22, { feu: 30, contondant: 10 }, [["emploi", 1], ["chant_guerre", 1], ["coup_tonnerre", 4], ["repos", 4], ["benediction", 10]], A, 2),
  u("eclaireuse", "\xC9claireuse des galeries", 1, 1, ["humain"], "assassin", "dague", 1, [75, 55, 100, 0, 6], [4, 1, 2, 0, 2], 15, { tenebres: 15 }, [["emploi", 1], ["repos", 1], ["assassinat", 4], ["lame_ombre", 8], ["hate", 12]], { arme: ["une_main"], armure: ["legere"], accessoire: ["bottes", "anneau"] }, 2),
  u("alchimiste", "Alchimiste", 1, 1, ["humain"], "feu et poison \xE0 distance", "flasques", 3, [65, 60, 80, 35, 3], [3, 1, 1, 2, 1], 20, { feu: 20, maladie: 20 }, [["tir_fronde", 1], ["meditation", 1], ["tir_empoisonne", 3], ["fleche_feu", 6], ["pluie_feu", 12]], { arme: ["fronde"], armure: ["robe", "legere"], accessoire: ["bottes", "anneau"] }, 2),
  u("gardien_pierre", "Gardien de pierre", 1, 3, ["construct"], "tank", "masse_lourde", 1, [190, 80, 120, 0, 7], [11, 1, 2, 0, 2], 28, { contondant: 30, tranchant: 30, glace: -10 }, [["emploi", 1], ["repos", 1], ["provocation", 3], ["carapace_epines", 6], ["frappe_sismique", 12], ["riposte", 16]], { arme: ["deux_mains"], armure: ["lourde"], accessoire: ["collier", "anneau"] }, 2),
  u("mage_cristal", "Mage de cristal", 1, 2, ["humain"], "glace, silence", "baton", 3, [65, 70, 70, 55, 2], [3, 2, 1, 3, 1], 23, { glace: 35, contondant: -15 }, [["emploi", 1], ["eclat_glace", 1], ["meditation", 1], ["mot_silence", 5], ["tempete_givre", 10]], MAGE, 2),
  // Région 4 : Cendrelune
  u("lanciers_cendres", "Lanciers des cendres", 2, 2, ["humain"], "contact, charge", "lance", 1, [80, 55, 100, 0, 5], [5, 1, 2, 0, 1], 20, { feu: 25 }, [["emploi", 1], ["repos", 1], ["coup_jarret", 3], ["charge", 6], ["frappe_sismique", 12]], { arme: ["deux_mains"], armure: ["legere", "moyenne"], accessoire: ["bottes", "anneau"] }, 3),
  u("nomade", "Nomade des sables", 1, 1, ["humain"], "tir, contr\xF4le", "arc", 3, [80, 55, 100, 0, 4], [4, 1, 2, 0, 1], 17, { feu: 20 }, [["tir_arc", 1], ["repos", 1], ["fleche_feu", 3], ["tir_recul", 6], ["tir_precis", 12]], TIR, 3),
  u("derviche", "Derviche", 1, 2, ["humain"], "tourbillon", "griffes", 1, [100, 70, 120, 0, 6], [6, 2, 3, 0, 2], 15, { psychique: 20 }, [["emploi", 1], ["hate", 1], ["second_souffle", 3], ["tourbillon", 6], ["lame_ombre", 10]], { arme: ["gantelets"], armure: ["legere", "robe"], accessoire: ["bottes", "anneau"] }, 3),
  u("pretresse_soleil", "Pr\xEAtresse du soleil", 1, 2, ["humain"], "soin, sacr\xE9", "sceptre", 3, [75, 85, 80, 55, 2], [4, 2, 1, 3, 1], 21, { sacre: 40, feu: 20, tenebres: -20 }, [["emploi", 1], ["javelot_lumiere", 1], ["meditation", 1], ["soin_majeur", 4], ["benediction", 10]], MAGE, 3),
  u("scorpions", "Scorpions dress\xE9s", 2, 2, ["bete"], "poison au contact", "dard_s", 1, [70, 50, 90, 0, 4], [4, 1, 2, 0, 1], 16, { feu: 20, maladie: 30 }, [["morsure", 1], ["repos", 1], ["morsure_venin", 3], ["carapace_epines", 6]], BETE, 3),
  u("mage_cendre", "Mage de cendre", 1, 2, ["humain"], "feu de zone", "baton", 3, [65, 60, 70, 60, 2], [3, 1, 1, 3, 1], 23, { feu: 50, glace: -25 }, [["emploi", 1], ["trait_flammes", 1], ["meditation", 1], ["pluie_feu", 6], ["eruption", 15]], MAGE, 3),
  u("garde_oasis", "Garde de l'oasis", 1, 2, ["humain"], "protection", "epee", 1, [130, 75, 110, 0, 5], [8, 2, 2, 0, 1], 20, { tranchant: 20, feu: 20 }, [["emploi", 1], ["provocation", 1], ["repos", 1], ["mur_boucliers", 5], ["carapace_epines", 8], ["coup_tonnerre", 12]], A, 3),
  u("barde", "Barde du d\xE9sert", 1, 1, ["humain"], "renfort, peur", "dague", 2, [70, 80, 80, 40, 3], [4, 2, 1, 2, 1], 18, { psychique: 30 }, [["emploi", 1], ["chant_guerre", 1], ["meditation", 1], ["cri_effroi", 4], ["vent_rapide", 10]], { arme: ["une_main"], armure: ["legere", "robe"], accessoire: ["bottes", "anneau"] }, 3),
  // Région 5 : Sanctuaire de l'Aube
  u("paladin", "Paladin de l'aube", 1, 3, ["humain"], "tank sacr\xE9", "epee", 1, [170, 90, 110, 40, 7], [10, 2, 2, 2, 2], 21, { sacre: 40, tenebres: 20, tranchant: 15 }, [["emploi", 1], ["provocation", 1], ["javelot_lumiere", 3], ["benediction", 8], ["coup_tonnerre", 12], ["soin_mineur", 16]], A, 4),
  u("archonte_aube", "Archonte", 1, 3, ["celeste"], "soin de groupe, sacr\xE9", "sceptre", 3, [110, 100, 80, 70, 3], [6, 2, 1, 4, 1], 21, { sacre: 50, psychique: 30 }, [["emploi", 1], ["nova_sacree", 1], ["meditation", 1], ["cercle_soins", 5], ["mot_silence", 10], ["javelot_lumiere", 14]], MAGE, 4),
  u("lames_jumelles", "Lames jumelles", 2, 2, ["humain"], "assassins", "dague", 1, [70, 55, 100, 0, 6], [4, 1, 2, 0, 2], 14, { tenebres: 15 }, [["emploi", 1], ["repos", 1], ["coup_jarret", 1], ["assassinat", 3], ["lame_ombre", 6]], { arme: ["une_main"], armure: ["legere"], accessoire: ["bottes", "anneau"] }, 4),
  u("tireur_astral", "Tireur astral", 1, 2, ["celeste"], "tir de pr\xE9cision", "arc", 3, [90, 65, 110, 0, 6], [5, 1, 2, 0, 2], 17, { glace: 20, sacre: 20 }, [["tir_arc", 1], ["repos", 1], ["marque", 1], ["tir_perforant", 3], ["tir_precis", 6]], TIR, 4),
  u("oracle", "Oracle", 1, 2, ["humain"], "affaiblissements", "baton", 3, [70, 100, 70, 60, 2], [4, 3, 1, 3, 1], 22, { psychique: 40 }, [["emploi", 1], ["affaiblissement", 1], ["meditation", 1], ["mot_silence", 3], ["terreur_masse", 10]], MAGE, 4),
  u("chevalier_griffon", "Chevalier-griffon", 1, 3, ["humain"], "charge lourde", "lance", 1, [160, 75, 120, 0, 8], [9, 1, 2, 0, 2], 18, { tranchant: 20, contondant: 15 }, [["emploi", 1], ["repos", 1], ["charge", 1], ["coup_massue", 4], ["frappe_sismique", 10]], { arme: ["deux_mains"], armure: ["moyenne", "lourde"], accessoire: ["bottes", "anneau"] }, 4),
  u("invocatrice", "Invocatrice des temp\xEAtes", 1, 2, ["humain"], "glace et feu de zone", "baton", 3, [70, 70, 70, 65, 2], [3, 2, 1, 4, 1], 23, { glace: 30, feu: 30 }, [["emploi", 1], ["eclat_glace", 1], ["meditation", 1], ["tempete_givre", 4], ["eruption", 12]], MAGE, 4),
  u("gardiens_celestes", "Gardiens c\xE9lestes", 3, 3, ["celeste"], "mur de boucliers", "epee", 1, [80, 75, 100, 0, 5], [5, 2, 2, 0, 1], 20, { sacre: 30, tranchant: 15 }, [["emploi", 1], ["repos", 1], ["provocation", 3], ["carapace_epines", 6]], A, 4)
];
function rowToTroop(r, SK) {
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
    forms: [{ id: r.id, name: r.name, level: 1, speed: r.speed, res: r.res, skills: r.skills }],
    rules: genRules(r.skills.map((s3) => s3[0]), SK)
  };
}

