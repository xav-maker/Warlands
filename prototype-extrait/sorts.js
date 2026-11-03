var s2 = (o) => ({ kind: "active", target: "enemy", range: 1, energy: 0, mana: 0, durBase: "unit", durMult: 1e3, p: {}, ...o });
var W2 = "weapon";
var NEW_SKILLS = {
  // ---- magie élémentaire
  eclat_glace: s2({ name: "\xC9clat de glace", range: 4, mana: 8, attack: true, ai: "attack", fx: [{ k: "dmg", v: 16, type: "glace" }, { k: "state", s: "ralenti", dur: 40 }], desc: "16 glace + Ralenti 40." }),
  tempete_givre: s2({ name: "Temp\xEAte de givre", range: 5, mana: 20, durMult: 2e3, attack: true, ai: "aoe", fx: [{ k: "dmg", v: 14, type: "glace", area: "rank" }, { k: "state", s: "ralenti", dur: 60, area: "rank" }], desc: "14 glace et Ralenti 60 \xE0 tout un rang." }),
  pluie_feu: s2({ name: "Pluie de feu", range: 5, mana: 24, durMult: 2500, attack: true, ai: "aoe", fx: [{ k: "dmg", v: 12, type: "feu", area: "allEnemies" }, { k: "state", s: "brulure", v: 4, dur: 40, area: "allEnemies" }], desc: "12 feu et Br\xFBlure \xE0 tous les ennemis." }),
  eruption: s2({ name: "\xC9ruption", range: 5, mana: 30, durMult: 3e3, attack: true, ai: "aoe", fx: [{ k: "dmg", v: 24, type: "feu", area: "allEnemies" }, { k: "stun", v: 10, area: "front" }], desc: "24 feu \xE0 tous les ennemis, \xC9tourdi 10 aux rangs 1-2." }),
  souffle_feu: s2({ name: "Souffle de feu", range: 2, energy: 30, durMult: 2e3, attack: true, ai: "aoe", fx: [{ k: "dmg", v: 18, type: "feu", area: "rank" }, { k: "state", s: "brulure", v: 5, dur: 40, area: "rank" }], desc: "18 feu et Br\xFBlure \xE0 un rang proche." }),
  // ---- magie sacrée et ténèbres
  javelot_lumiere: s2({ name: "Javelot de lumi\xE8re", range: 5, mana: 12, attack: true, ai: "attack", fx: [{ k: "dmg", v: 22, type: "sacre", tag: "mort-vivant", tagMult: 2e3 }], desc: "22 sacr\xE9, x2 contre les morts-vivants." }),
  nova_sacree: s2({ name: "Nova sacr\xE9e", range: 5, mana: 18, durMult: 2e3, attack: true, ai: "aoe", fx: [{ k: "dmg", v: 15, type: "sacre", area: "front", tag: "mort-vivant", tagMult: 2e3 }], desc: "15 sacr\xE9 aux ennemis des rangs 1-2." }),
  fleau: s2({ name: "Fl\xE9au", range: 4, mana: 14, attack: true, ai: "debuff", fx: [{ k: "state", s: "poison", v: 4, dur: 100, cap: 3 }, { k: "dmg", v: 8, type: "maladie" }], desc: "Poison 4 par tic (3 charges) et 8 maladie." }),
  toucher_spectral: s2({ name: "Toucher spectral", range: 3, mana: 10, attack: true, ai: "attack", fx: [{ k: "drain", v: 18, type: "tenebres" }], desc: "18 t\xE9n\xE8bres, rend la moiti\xE9 en PV." }),
  lame_ombre: s2({ name: "Lame d'ombre", energy: 20, durBase: W2, attack: true, melee: true, ai: "attack", fx: [{ k: "wdmg", v: 1300, type: "tenebres" }], desc: "1,3x l'arme en t\xE9n\xE8bres." }),
  // ---- contrôle et affaiblissements
  cri_effroi: s2({ name: "Cri d'effroi", range: 5, energy: 20, ai: "control", fx: [{ k: "will", v: -150, area: "front" }], desc: "\u221215 % de volont\xE9 aux ennemis des rangs 1-2." }),
  mot_silence: s2({ name: "Mot de silence", range: 5, mana: 12, ai: "debuff", fx: [{ k: "state", s: "silence", dur: 80 }], desc: "Silence 80 : la cible ne peut plus lancer de sort \xE0 mana." }),
  affaiblissement: s2({ name: "Affaiblissement", range: 5, mana: 10, ai: "debuff", fx: [{ k: "state", s: "affaibli", v: 250, dur: 80 }], desc: "\u221225 % d\u2019attaque pendant 80." }),
  jet_toile: s2({ name: "Jet de toile", range: 4, energy: 15, ai: "control", fx: [{ k: "state", s: "ralenti", dur: 80 }, { k: "pull", v: 1 }], desc: "Ralenti 80 et attire d\u2019un rang." }),
  coup_jarret: s2({ name: "Coup au jarret", energy: 15, durBase: W2, attack: true, melee: true, ai: "control", fx: [{ k: "wdmg", v: 700 }, { k: "state", s: "ralenti", dur: 60 }], desc: "0,7x l\u2019arme et Ralenti 60." }),
  tir_recul: s2({ name: "Tir repoussant", range: 4, energy: 18, durBase: W2, attack: true, ai: "control", fx: [{ k: "wdmg", v: 800 }, { k: "push", v: 1 }], desc: "0,8x l\u2019arme et repousse d\u2019un rang." }),
  coup_tonnerre: s2({ name: "Coup de tonnerre", energy: 25, durBase: W2, durMult: 1500, attack: true, melee: true, ai: "control", fx: [{ k: "wdmg", v: 1200 }, { k: "stun", v: 15 }], desc: "1,2x l\u2019arme et \xC9tourdi 15." }),
  // ---- techniques d'arme
  frappe_sismique: s2({ name: "Frappe sismique", energy: 30, durBase: W2, durMult: 2e3, attack: true, melee: true, ai: "aoe", fx: [{ k: "wdmg", v: 900, area: "rank" }], desc: "0,9x l\u2019arme \xE0 tout le rang au contact." }),
  assassinat: s2({ name: "Assassinat", energy: 30, durBase: W2, durMult: 1500, attack: true, melee: true, ai: "finisher", fx: [{ k: "wdmg", v: 1800 }, { k: "state", s: "saignement", v: 5, dur: 60 }], desc: "1,8x l\u2019arme et Saignement." }),
  coup_massue: s2({ name: "Coup de massue", energy: 22, durBase: W2, durMult: 1500, attack: true, melee: true, ai: "attack", fx: [{ k: "wdmg", v: 1400 }, { k: "push", v: 1 }], desc: "1,4x l\u2019arme et repousse d\u2019un rang." }),
  tir_perforant: s2({ name: "Tir perforant", range: 5, energy: 20, durBase: W2, durMult: 1500, attack: true, ai: "aoe", fx: [{ k: "wdmg", v: 900, area: "rank" }], desc: "0,9x l\u2019arme \xE0 tout le rang vis\xE9." }),
  tir_empoisonne: s2({ name: "Tir empoisonn\xE9", range: 4, energy: 15, durBase: W2, attack: true, ai: "debuff", fx: [{ k: "state", s: "poison", v: 3, dur: 80, cap: 3 }, { k: "wdmg", v: 900 }], desc: "0,9x l\u2019arme et Poison." }),
  fleche_feu: s2({ name: "Fl\xE8che enflamm\xE9e", range: 4, energy: 15, durBase: W2, attack: true, ai: "attack", fx: [{ k: "wdmg", v: 1e3, type: "feu" }, { k: "state", s: "brulure", v: 4, dur: 40 }], desc: "1x l\u2019arme en feu et Br\xFBlure." }),
  morsure_venin: s2({ name: "Morsure venimeuse", energy: 12, durBase: W2, attack: true, melee: true, ai: "debuff", fx: [{ k: "state", s: "poison", v: 3, dur: 80, cap: 3 }, { k: "wdmg", v: 900 }], desc: "0,9x l\u2019arme et Poison." }),
  // ---- soins et soutien
  soin_majeur: s2({ name: "Soin majeur", target: "ally", range: 3, mana: 16, ai: "heal", fx: [{ k: "heal", v: 450 }], desc: "+45 % des PV max." }),
  cercle_soins: s2({ name: "Cercle de soins", target: "self", mana: 20, durMult: 2e3, ai: "groupHeal", fx: [{ k: "heal", v: 180, area: "allies" }], desc: "+18 % des PV max \xE0 tous les alli\xE9s." }),
  seve: s2({ name: "S\xE8ve r\xE9g\xE9n\xE9ratrice", target: "ally", range: 2, mana: 12, ai: "buffAlly", fx: [{ k: "state", s: "regeneration", v: 40, dur: 100 }], desc: "R\xE9g\xE9n\xE9ration +4 % par tic pendant 100." }),
  peau_ecorce: s2({ name: "Peau d'\xE9corce", target: "ally", range: 2, mana: 10, ai: "buffAlly", fx: [{ k: "state", s: "garde", v: 250, dur: 100 }], desc: "+25 % de r\xE9sistance \xE0 tout pendant 100." }),
  benediction: s2({ name: "B\xE9n\xE9diction", target: "self", mana: 16, durMult: 2e3, ai: "buffGroup", fx: [{ k: "state", s: "garde", v: 150, dur: 80, area: "allies" }], desc: "+15 % de r\xE9sistance \xE0 tout aux alli\xE9s pendant 80." }),
  chant_guerre: s2({ name: "Chant de guerre", target: "self", mana: 12, durMult: 1500, ai: "buffGroup", fx: [{ k: "state", s: "cri", v: 150, dur: 80, area: "allies" }, { k: "will", v: 100, area: "allies" }], desc: "+15 % d\u2019attaque et +10 % de volont\xE9 aux alli\xE9s." }),
  vent_rapide: s2({ name: "Vent rapide", target: "self", mana: 18, durMult: 1500, ai: "buffGroup", fx: [{ k: "state", s: "hate", dur: 60, area: "allyRank" }], desc: "H\xE2te 60 aux alli\xE9s de son rang." }),
  carapace_epines: s2({ name: "Carapace d'\xE9pines", target: "self", energy: 15, ai: "buffSelf", fx: [{ k: "state", s: "epines", v: 6, dur: 100 }], desc: "Renvoie 6 d\xE9g\xE2ts \xE0 chaque attaque au contact pendant 100." }),
  second_souffle: s2({ name: "Second souffle", target: "self", durMult: 1500, ai: "restore", fx: [{ k: "energy", v: 300 }, { k: "heal", v: 80 }], desc: "+30 % d\u2019\xE9nergie et +8 % de PV." })
};

