var s = (o) => ({ kind: "active", target: "enemy", range: 1, energy: 0, mana: 0, durBase: "unit", durMult: 1e3, p: {}, ...o });
var DEFAULT_PARAMS = {
  timeLimit: 3e3,
  tick: 20,
  waitRegen: 50,
  waitManaRegen: 50,
  woundWill: 500,
  allyDeathWill: 100,
  sameTroopDeathWill: 200,
  killWill: 100,
  hasteMod: 750,
  slowMod: 1250,
  resCap: 750,
  resFloor: -1e3,
  moveMult: 1e3,
  fleeMult: 2e3,
  manaSkipsRule: 1,
  stallTime: 100,
  dotTick: 4,
  healMult: 1200,
  healCooldown: 60,
  hotCooldown: 100
};
var DEFAULT_WEAPONS = {
  epee: { name: "\xC9p\xE9e courte", type: "tranchant", dmg: 12, speed: 20, cost: 10 },
  fronde: { name: "Fronde", type: "contondant", dmg: 8, speed: 18, cost: 8 },
  masse: { name: "Masse de pr\xEAtre", type: "contondant", dmg: 6, speed: 22, cost: 6 },
  baton: { name: "B\xE2ton", type: "contondant", dmg: 6, speed: 22, cost: 6 },
  arc: { name: "Arc", type: "tranchant", dmg: 10, speed: 18, cost: 10 },
  hache2m: { name: "Hache \xE0 deux mains", type: "tranchant", dmg: 16, speed: 24, cost: 14 },
  crocs: { name: "Crocs", type: "tranchant", dmg: 10, speed: 14, cost: 8 },
  gantelets: { name: "Gantelets", type: "contondant", dmg: 8, speed: 14, cost: 6 },
  masse_lourde: { name: "Masse lourde", type: "contondant", dmg: 18, speed: 30, cost: 15 }
};
var W = "weapon";
var DEFAULT_SKILLS = {
  emploi: s({ name: "Emploi d'arme", energyW: 1e3, durBase: W, dtype: W, attack: true, melee: true, desc: "1x d\xE9g\xE2ts de l'arme. DE : un autre ennemi. EC : se frappe." }),
  exploit: s({ name: "Exploit d'arme", energyW: 2e3, durBase: W, durMult: 1500, dtype: W, attack: true, melee: true, p: { mult: 2e3, bleed: 4, bleedDur: 60, stun: 20 }, desc: "2x d\xE9g\xE2ts + sp\xE9cial (Saignement si tranchant, \xC9tourdi si contondant). DE : rien. EC : frappe un alli\xE9." }),
  meditation: s({ name: "M\xE9ditation", target: "self", energy: 10, durMult: 2e3, p: { ok: 200, half: 50, crit: 100 }, desc: "+20 % de volont\xE9. DE : +5 %. EC : perd 10 % de PV." }),
  repos: s({ name: "Repos", target: "self", p: { ok: 100, crit: 75 }, desc: "+10 % d'\xE9nergie. DE : rien. EC : perd 7,5 % de PV." }),
  coup_bouclier: s({ name: "Coup de bouclier", energy: 15, durBase: W, dtype: "contondant", attack: true, melee: true, p: { mult: 500, stun: 30 }, desc: "0,5x d\xE9g\xE2ts + \xC9tourdi 30. DE : sans \xE9tourdir. EC : s\u2019\xE9tourdit." }),
  repousser: s({ name: "Repousser", energy: 15, durBase: W, dtype: "contondant", attack: true, melee: true, p: { mult: 500, stun: 30 }, desc: "0,5x d\xE9g\xE2ts, la cible recule (\xC9tourdi 30 si d\xE9j\xE0 \xE0 3). DE : sans recul. EC : le lanceur recule." }),
  repousser_renforce: s({ name: "Repousser renforc\xE9", target: "self", energy: 20, durBase: W, dtype: "contondant", melee: true, p: { mult: 500, stun: 30 }, desc: "Repousser sur tous les ennemis au contact." }),
  provocation: s({ name: "Provocation", target: "self", energy: 15, p: { dur: 60, halfDur: 30, crit: 150 }, desc: "Les attaques ennemies doivent le viser s\u2019il est \xE0 port\xE9e, 60 instants. DE : 30. EC : \u221215 % de volont\xE9." }),
  riposte: s({ name: "Riposte", kind: "reaction", target: "self", energy: 10, p: { mult: 500 }, desc: "R\xE9action : touch\xE9 au corps \xE0 corps, contre-attaque \xE0 0,5x (10 \xE9nergie)." }),
  dernier_rempart: s({ name: "Dernier rempart", kind: "passive", target: "self", p: { will: 200 }, desc: "Passif, une fois : un alli\xE9 du m\xEAme rang qui devrait mourir reste \xE0 1 PV ; \u221220 % de volont\xE9." }),
  mur_boucliers: s({ name: "Mur de boucliers", target: "self", energy: 25, durMult: 2e3, p: { shield: 25, dur: 80 }, desc: "Bouclier de 25 aux alli\xE9s de son rang, 80 instants. DE : sur lui seul." }),
  execution: s({ name: "Ex\xE9cution", energy: 25, durBase: W, durMult: 1500, dtype: "tranchant", attack: true, melee: true, p: { threshold: 250, bonusMult: 3e3 }, desc: "1x d\xE9g\xE2ts, tripl\xE9s sous 25 % de PV. DE : rien. EC : frappe un alli\xE9." }),
  fracas: s({ name: "Fracas", energy: 20, durBase: W, durMult: 1500, dtype: "contondant", attack: true, melee: true, p: { half: 500, bonusMult: 3e3 }, desc: "1x d\xE9g\xE2ts, tripl\xE9s si la cible est Gel\xE9e (brise le gel). DE : 0,5x. EC : frappe un alli\xE9." }),
  brise_armure: s({ name: "Brise-armure", energy: 15, durBase: W, dtype: "tranchant", attack: true, melee: true, p: { mult: 500, res: 200, cap: 3, dur: 100 }, desc: "0,5x d\xE9g\xE2ts et \u221220 % de r\xE9sistance physique, cumulable 3. DE : sans l\u2019affaiblissement. EC : sur soi." }),
  charge: s({ name: "Charge", range: 4, minRange: 2, energy: 25, durMult: 1500, dtype: "contondant", attack: true, melee: true, p: { mult: 1500, stun: 20 }, desc: "Avance au rang 1 et frappe \xE0 1,5x. DE : avance sans frapper. EC : avance et s\u2019\xE9tourdit." }),
  tir_fronde: s({ name: "Tir de fronde", range: 3, energyW: 1e3, durBase: W, dtype: W, attack: true, desc: "1x d\xE9g\xE2ts de l'arme, port\xE9e 3. DE : autre ennemi. EC : touche un alli\xE9." }),
  volee: s({ name: "Vol\xE9e", range: 4, energy: 30, durBase: W, durMult: 2e3, dtype: W, attack: true, p: { mult: 600 }, desc: "0,6x d\xE9g\xE2ts \xE0 tout un rang. DE : une seule unit\xE9. EC : rien." }),
  tir_arc: s({ name: "Tir \xE0 l'arc", range: 4, energyW: 1e3, durBase: W, dtype: W, attack: true, desc: "1x d\xE9g\xE2ts de l'arme, port\xE9e 4. DE : autre ennemi. EC : touche un alli\xE9." }),
  tir_precis: s({ name: "Tir pr\xE9cis", range: 5, energy: 25, durBase: W, durMult: 2e3, dtype: W, attack: true, p: { mult: 2e3 }, desc: "2x d\xE9g\xE2ts, ignore 50 % des r\xE9sistances. DE : 1x. EC : rien." }),
  marque: s({ name: "Marque du chasseur", range: 5, energy: 10, p: { uses: 3, dur: 100, bonus: 300 }, desc: "Les 3 prochaines attaques alli\xE9es sur la cible font +30 %. DE : 1 attaque. EC : sur un alli\xE9." }),
  soin_mineur: s({ name: "Soin mineur", target: "ally", range: 2, mana: 8, p: { ok: 250, half: 100, crit: 100 }, desc: "+25 % des PV max. DE : +10 %. EC : \u221210 %." }),
  regeneration: s({ name: "R\xE9g\xE9n\xE9ration", target: "ally", range: 2, mana: 10, p: { perTick: 30, dur: 100, halfDur: 50 }, desc: "+3 % des PV max par tic, 100 instants. DE : 50. EC : sur un ennemi." }),
  priere: s({ name: "Pri\xE8re collective", target: "self", mana: 18, durMult: 3e3, p: { ok: 100, crit: 200 }, desc: "+10 % des PV max \xE0 tous les alli\xE9s. DE : son rang. EC : \u221220 % de volont\xE9." }),
  purification: s({ name: "Purification", target: "ally", range: 2, mana: 10, desc: "Retire les \xE9tats n\xE9gatifs. DE : le plus r\xE9cent. EC : retire les positifs." }),
  trait_sacre: s({ name: "Trait sacr\xE9", range: 5, mana: 10, attack: true, p: { dmg: 20, tagMult: 2e3 }, desc: "20 d\xE9g\xE2ts sacr\xE9s, x2 contre mort-vivant et d\xE9mon. DE : moiti\xE9. EC : soigne la cible." }),
  trait_sacre_renforce: s({ name: "Trait sacr\xE9 renforc\xE9", range: 5, mana: 12, attack: true, p: { dmg: 20, tagMult: 3e3 }, desc: "Trait sacr\xE9, x3 contre mort-vivant et d\xE9mon." }),
  bouclier_foi: s({ name: "Bouclier de foi", target: "ally", range: 2, mana: 12, p: { ok: 40, half: 15, dur: 100 }, desc: "Bouclier de 40 PV, 100 instants. DE : 15. EC : rien." }),
  aura_serenite: s({ name: "Aura de s\xE9r\xE9nit\xE9", kind: "passive", target: "self", p: { will: 50 }, desc: "Passif : +5 % de volont\xE9 par tic aux alli\xE9s de son rang." }),
  confusion: s({ name: "Confusion", range: 5, mana: 10, p: { dur: 200, half: 100 }, desc: "La prochaine action de la cible est un demi-\xE9chec. DE : \u221210 % de volont\xE9. EC : sur soi." }),
  confusion_moine: s({ name: "Confusion (moine)", range: 5, energy: 20, p: { dur: 200, half: 100 }, desc: "Confusion sans mana, 20 \xE9nergie." }),
  trait_flammes: s({ name: "Trait de flammes", range: 4, mana: 5, attack: true, p: { dmg: 15, burn: 6, burnDur: 20 }, desc: "15 d\xE9g\xE2ts de feu + Br\xFBlure courte. DE : sans br\xFBlure. EC : Br\xFBlure sur soi." }),
  boule_feu: s({ name: "Boule de feu", range: 5, mana: 15, durMult: 2e3, attack: true, p: { dmg: 30, splash: 10, burn: 6, burnDur: 40 }, desc: "30 \xE0 la cible, 10 \xE0 son rang, Br\xFBlure. DE : autre unit\xE9 du rang. EC : explose sur son rang." }),
  arme_enflammee: s({ name: "Arme enflamm\xE9e", target: "ally", range: 1, mana: 10, p: { dur: 80, halfDur: 40, bonus: 8, burn: 4, burnDur: 40 }, desc: "Les attaques d\u2019arme de l\u2019alli\xE9 ajoutent 8 feu et Br\xFBlure, 80 instants. DE : 40. EC : Br\xFBlure sur l\u2019alli\xE9." }),
  mur_flammes: s({ name: "Mur de flammes", range: 5, mana: 18, durMult: 2e3, p: { burn: 6, burnDur: 60 }, desc: "Br\xFBlure \xE0 tout un rang ennemi. DE : une unit\xE9. EC : son propre rang." }),
  embrasement: s({ name: "Embrasement", range: 5, mana: 20, durMult: 2e3, desc: "Chaque ennemi qui br\xFBle subit le double des d\xE9g\xE2ts de br\xFBlure restants. DE : le plus proche. EC : les alli\xE9s." }),
  coeur_ardent: s({ name: "C\u0153ur ardent", kind: "passive", target: "self", p: { bonus: 200 }, desc: "Passif : d\xE9g\xE2ts de feu +20 % sur les cibles qui br\xFBlent." }),
  lame_saignante: s({ name: "Lame saignante", energy: 15, durBase: W, dtype: "tranchant", attack: true, melee: true, p: { mult: 800, bleed: 5, bleedDur: 60 }, desc: "0,8x d\xE9g\xE2ts + Saignement. DE : sans saignement. EC : saigne lui-m\xEAme." }),
  cri_guerre: s({ name: "Cri de guerre", target: "self", energy: 20, p: { will: 200, atk: 100, dur: 80, crit: 100 }, desc: "+20 % de volont\xE9 et +10 % d\u2019attaque aux alli\xE9s, 80 instants. DE : lui seul. EC : \u221210 % de volont\xE9." }),
  rage: s({ name: "Rage", kind: "passive", target: "self", p: { atkPer10: 20 }, desc: "Passif : +2 % d\u2019attaque par 10 % de PV perdus ; ses blessures ne baissent pas sa volont\xE9." }),
  tourbillon: s({ name: "Tourbillon", target: "self", energy: 35, durBase: W, durMult: 2e3, dtype: "tranchant", melee: true, p: { half: 500 }, desc: "1x d\xE9g\xE2ts \xE0 tous les ennemis au contact. DE : moiti\xE9. EC : touche aussi son rang." }),
  morsure: s({ name: "Morsure", energyW: 1e3, durBase: W, dtype: "tranchant", attack: true, melee: true, p: { threshold: 500, bleed: 5, bleedDur: 60 }, desc: "1x d\xE9g\xE2ts + Saignement si la cible est sous 50 %. DE : sans saignement. EC : rien." }),
  hurlement: s({ name: "Hurlement", target: "self", energy: 20, p: { ally: 150, enemy: 100, crit: 100 }, desc: "+15 % de volont\xE9 aux alli\xE9s, \u221210 % aux ennemis des rangs 1 et 2. DE : alli\xE9s seulement. EC : \u221210 % aux alli\xE9s." }),
  instinct_meute: s({ name: "Instinct de meute", kind: "passive", target: "self", p: { bonus: 150 }, desc: "Passif : +15 % sur une cible d\xE9j\xE0 attaqu\xE9e par l\u2019autre loup depuis le dernier tic." }),
  drain: s({ name: "Drain de vie", range: 3, mana: 12, durMult: 2e3, attack: true, p: { dmg: 20, crit: 10 }, desc: "20 t\xE9n\xE8bres, r\xE9cup\xE8re la moiti\xE9. DE : sans soin. EC : le lien s\u2019inverse." }),
  murmure: s({ name: "Murmure de terreur", range: 5, mana: 10, attack: true, p: { dmg: 10, will: 250, half: 100, crit: 150 }, desc: "10 psychiques et \u221225 % de volont\xE9. DE : \u221210 %. EC : \u221215 % sur soi." }),
  terreur_masse: s({ name: "Terreur de masse", range: 5, mana: 18, durMult: 2e3, p: { dmg: 10, will: 250, half: 100, crit: 150 }, desc: "Murmure de terreur sur tout un rang." }),
  malediction: s({ name: "Mal\xE9diction de faiblesse", range: 5, mana: 12, durMult: 2e3, p: { res: 250, dur: 80, halfDur: 40 }, desc: "\u221225 % de r\xE9sistance \xE0 tout, 80 instants. DE : 40. EC : sur soi." }),
  nuage: s({ name: "Nuage pestilentiel", range: 4, mana: 12, durMult: 2e3, p: { dmg: 3, dur: 100, cap: 3 }, desc: "Poison sur un rang (3 par tic, cumulable 3). DE : une unit\xE9. EC : son propre rang." }),
  nuage_renforce: s({ name: "Nuage renforc\xE9", range: 4, mana: 14, durMult: 2e3, p: { dmg: 3, dur: 100, cap: 5 }, desc: "Nuage pestilentiel, 5 charges max." }),
  lien_vital: s({ name: "Lien vital", range: 4, mana: 15, durMult: 2e3, p: { dur: 60, halfDur: 30, share: 300 }, desc: "30 % des d\xE9g\xE2ts subis par le lanceur sont renvoy\xE9s sur la cible, 60 instants. DE : 30. EC : sens inverse." }),
  non_mort: s({ name: "Non-mort", kind: "passive", target: "self", desc: "Passif : insensible au Poison et au Saignement." }),
  contagion: s({ name: "Contagion", kind: "passive", target: "self", p: { cap: 5 }, desc: "Passif : quand un ennemi empoisonn\xE9 meurt, son poison passe au plus proche." }),
  pieges_glace: s({ name: "Pi\xE8ges de glace", kind: "passive", target: "self", p: { dur: 60 }, desc: "Passif : le premier ennemi qui avance au contact est Ralenti." }),
  esprit_inebranlable: s({ name: "Esprit in\xE9branlable", kind: "passive", target: "self", desc: "Passif : sa volont\xE9 ne descend jamais sous 50 %." }),
  hate: s({ name: "H\xE2te", target: "self", energy: 25, p: { dur: 80, halfDur: 40 }, desc: "H\xE2te sur soi, 80 instants. DE : 40. EC : Ralenti." }),
  paume_vide: s({ name: "Paume du vide", energy: 30, durMult: 1500, attack: true, melee: true, p: { dmg: 25, will: 200, confDur: 200 }, desc: "25 psychiques + Confusion + \u221220 % de volont\xE9. DE : d\xE9g\xE2ts seuls. EC : se confond." }),
  seisme: s({ name: "S\xE9isme", target: "self", energy: 40, durMult: 3e3, p: { dmg: 20, stun: 20, crit: 100 }, desc: "20 d\xE9g\xE2ts aux ennemis des rangs 1 et 2, \xC9tourdi au contact. DE : sans \xE9tourdir. EC : s\u2019\xE9tourdit et perd 10 %." }),
  fleche_givre: s({ name: "Fl\xE8che de givre", range: 4, energy: 15, durBase: W, attack: true, p: { dmg: 15, slowDur: 60, freezeDur: 20, freezeImmune: 100 }, desc: "15 glace + Ralenti ; Gel\xE9 20 si d\xE9j\xE0 ralenti (pas de nouveau gel sur la m\xEAme cible pendant 100 instants). DE : Ralenti seul. EC : se ralentit." }),
  grappin: s({ name: "Grappin", range: 4, energy: 20, durMult: 2e3, desc: "Attire la cible au rang 1. DE : d\u2019un cran. EC : le lanceur est tir\xE9 au rang 1." })
};
var R = (action, target, cond = "always", v, st) => ({ cond, v, s: st, action, target });
var NE = "nearestEnemy";
var WE = "weakestEnemy";
var SE = "strongestEnemy";
var MW = "mostWoundedAlly";
var ME = "self";
var DEFAULT_TROOPS = {
  milicien: {
    name: "Milicien",
    units: 1,
    pop: 1,
    tags: ["humain"],
    role: "contact, protection",
    weapon: "epee",
    defaultDist: 1,
    base: { hp: 100, will: 60, energy: 100, mana: 0, atk: 5 },
    growth: { hp: 6, will: 1, energy: 2, mana: 0, atk: 1 },
    forms: [
      { id: "milicien", name: "Milicien", level: 1, speed: 20, res: { tranchant: 10 }, skills: [["emploi", 1], ["exploit", 1], ["repos", 3], ["coup_bouclier", 5], ["repousser", 8]] },
      { id: "fantassin", name: "Fantassin", level: 10, parent: "milicien", hpMult: 1150, bonus: { will: 10, energy: 10, atk: 3 }, speed: 19, res: { tranchant: 15, contondant: 10 }, skills: [["provocation", 10], ["riposte", 14]] },
      { id: "garde", name: "Garde du rempart", level: 20, parent: "fantassin", hpMult: 1300, bonus: { will: 20, energy: 10, atk: 2 }, speed: 20, res: { tranchant: 25, contondant: 20 }, skills: [["dernier_rempart", 20], ["mur_boucliers", 24]] },
      { id: "lame", name: "Lame v\xE9t\xE9rane", level: 20, parent: "fantassin", hpMult: 1150, bonus: { will: 15, energy: 20, atk: 8 }, speed: 17, res: { tranchant: 15 }, skills: [["execution", 20], ["brise_armure", 22], ["charge", 26]] }
    ],
    rules: [
      R("repos", ME, "selfEnergyBelow", 15),
      R("mur_boucliers", ME, "allyHpBelow", 60),
      R("provocation", ME, "selfLacksState", void 0, "provocation"),
      R("execution", WE),
      R("coup_bouclier", NE, "targetLacksState", void 0, "etourdi"),
      R("repousser", NE, "selfEnergyAbove", 80),
      R("exploit", NE, "selfEnergyAbove", 50),
      R("emploi", NE),
      R("avancer", ME, "noEnemyInRange")
    ]
  },
  frondeurs: {
    name: "Frondeurs",
    units: 3,
    pop: 2,
    tags: ["humain"],
    role: "tir depuis l\u2019arri\xE8re",
    weapon: "fronde",
    defaultDist: 3,
    base: { hp: 55, will: 45, energy: 80, mana: 0, atk: 3 },
    growth: { hp: 3, will: 1, energy: 2, mana: 0, atk: 1 },
    forms: [
      { id: "frondeur", name: "Frondeur", level: 1, speed: 18, res: { contondant: -10 }, skills: [["tir_fronde", 1], ["repos", 1], ["marque", 6]] },
      { id: "tirailleur", name: "Tirailleur", level: 10, parent: "frondeur", hpMult: 1200, bonus: { will: 10, energy: 10, atk: 3 }, speed: 16, res: {}, skills: [["volee", 10], ["tir_precis", 16]] }
    ],
    rules: [
      R("repos", ME, "selfEnergyBelow", 15),
      R("marque", SE, "targetLacksState", void 0, "marque"),
      R("volee", NE, "enemiesAtLeast", 3),
      R("tir_fronde", WE),
      R("avancer", ME, "noEnemyInRange")
    ]
  },
  acolyte: {
    name: "Acolyte",
    units: 1,
    pop: 1,
    tags: ["humain"],
    role: "soin",
    weapon: "masse",
    defaultDist: 3,
    base: { hp: 70, will: 80, energy: 80, mana: 40, atk: 2 },
    growth: { hp: 4, will: 2, energy: 1, mana: 2, atk: 0.5 },
    forms: [
      { id: "acolyte", name: "Acolyte", level: 1, speed: 22, res: { sacre: 30, tenebres: -20 }, skills: [["emploi", 1], ["soin_mineur", 1], ["meditation", 1], ["trait_sacre", 4], ["purification", 7]] },
      { id: "pretre", name: "Pr\xEAtre", level: 10, parent: "acolyte", hpMult: 1100, bonus: { will: 15, energy: 10, mana: 15, atk: 1 }, speed: 21, res: { sacre: 40, psychique: 10 }, skills: [["regeneration", 10], ["bouclier_foi", 13]] },
      { id: "haut_pretre", name: "Haut-pr\xEAtre", level: 20, parent: "pretre", hpMult: 1150, bonus: { will: 20, energy: 10, mana: 30, atk: 1 }, speed: 20, res: { sacre: 50, psychique: 20 }, skills: [["priere", 20], ["aura_serenite", 24]] },
      { id: "inquisiteur", name: "Inquisiteur", level: 20, parent: "pretre", hpMult: 1250, bonus: { will: 15, energy: 20, mana: 15, atk: 5 }, speed: 20, res: { sacre: 40, tenebres: 10 }, skills: [["trait_sacre_renforce", 20], ["confusion", 24]] }
    ],
    rules: [
      R("priere", ME, "allyHpBelow", 40),
      R("soin_mineur", MW, "allyHpBelow", 50),
      R("purification", MW, "targetHasState", void 0, "poison"),
      R("bouclier_foi", MW, "allyHpBelow", 70),
      R("regeneration", MW, "allyHpBelow", 85),
      R("meditation", ME, "selfWillBelow", 50),
      R("confusion", SE, "targetLacksState", void 0, "confusion"),
      R("trait_sacre_renforce", NE),
      R("trait_sacre", NE),
      R("emploi", NE),
      R("attendre", ME)
    ]
  },
  pyromancien: {
    name: "Apprenti pyromancien",
    units: 1,
    pop: 2,
    tags: ["humain"],
    role: "d\xE9g\xE2ts de zone",
    weapon: "baton",
    defaultDist: 3,
    base: { hp: 65, will: 55, energy: 70, mana: 50, atk: 2 },
    growth: { hp: 3, will: 1, energy: 1, mana: 3, atk: 1 },
    forms: [
      { id: "apprenti", name: "Apprenti pyromancien", level: 1, speed: 24, res: { feu: 40, glace: -25 }, skills: [["emploi", 1], ["trait_flammes", 1], ["boule_feu", 5], ["meditation", 5]] },
      { id: "pyromancien", name: "Pyromancien", level: 10, parent: "apprenti", hpMult: 1100, bonus: { will: 10, energy: 10, mana: 20, atk: 3 }, speed: 22, res: { feu: 50, glace: -25 }, skills: [["arme_enflammee", 10], ["mur_flammes", 15]] },
      { id: "maitre_cendres", name: "Ma\xEEtre des cendres", level: 20, parent: "pyromancien", hpMult: 1150, bonus: { will: 15, energy: 10, mana: 40, atk: 5 }, speed: 21, res: { feu: 70, glace: -25 }, skills: [["embrasement", 20], ["coeur_ardent", 25]] }
    ],
    rules: [
      R("meditation", ME, "selfWillBelow", 40),
      R("embrasement", NE, "targetHasState", void 0, "brulure"),
      R("arme_enflammee", MW, "targetLacksState", void 0, "arme_feu"),
      R("mur_flammes", NE, "enemiesAtLeast", 3),
      R("boule_feu", NE, "targetLacksState", void 0, "brulure"),
      R("trait_flammes", WE),
      R("emploi", NE),
      R("attendre", ME)
    ]
  },
  chasseur: {
    name: "Chasseur",
    units: 1,
    pop: 1,
    tags: ["humain"],
    role: "contr\xF4le \xE0 distance",
    weapon: "arc",
    defaultDist: 3,
    base: { hp: 80, will: 55, energy: 100, mana: 0, atk: 4 },
    growth: { hp: 4, will: 1, energy: 2, mana: 0, atk: 1 },
    forms: [
      { id: "chasseur", name: "Chasseur", level: 1, speed: 18, res: { glace: 20 }, skills: [["tir_arc", 1], ["repos", 1], ["marque", 4], ["fleche_givre", 8]] },
      { id: "traqueur", name: "Traqueur des neiges", level: 10, parent: "chasseur", hpMult: 1150, bonus: { will: 10, energy: 15, atk: 4 }, speed: 16, res: { glace: 40 }, skills: [["grappin", 10], ["pieges_glace", 16], ["tir_precis", 22]] }
    ],
    rules: [
      R("repos", ME, "selfEnergyBelow", 15),
      R("fleche_givre", NE, "targetLacksState", void 0, "gele"),
      R("marque", SE, "targetLacksState", void 0, "marque"),
      R("grappin", SE, "selfEnergyAbove", 80),
      R("tir_precis", SE),
      R("tir_arc", WE),
      R("avancer", ME, "noEnemyInRange")
    ]
  },
  berserker: {
    name: "Berserker",
    units: 1,
    pop: 2,
    tags: ["humain"],
    role: "d\xE9g\xE2ts au contact",
    weapon: "hache2m",
    defaultDist: 1,
    base: { hp: 120, will: 40, energy: 110, mana: 0, atk: 9 },
    growth: { hp: 7, will: 1, energy: 2, mana: 0, atk: 2 },
    forms: [
      { id: "berserker", name: "Berserker", level: 1, speed: 21, res: { psychique: -20, maladie: 10 }, skills: [["emploi", 1], ["exploit", 1], ["rage", 1], ["lame_saignante", 4], ["charge", 8], ["cri_guerre", 12]] },
      { id: "massacreur", name: "Massacreur", level: 15, parent: "berserker", hpMult: 1200, bonus: { will: 10, energy: 20, atk: 8 }, speed: 19, res: { psychique: -10, maladie: 20 }, skills: [["execution", 15], ["tourbillon", 20]] }
    ],
    rules: [
      R("cri_guerre", ME, "selfLacksState", void 0, "cri"),
      R("charge", NE),
      R("execution", WE),
      R("tourbillon", ME, "enemiesAtLeast", 2),
      R("lame_saignante", NE, "targetLacksState", void 0, "saignement"),
      R("exploit", NE, "selfEnergyAbove", 40),
      R("emploi", NE),
      R("avancer", ME, "noEnemyInRange")
    ]
  },
  loups: {
    name: "Loups jumeaux",
    units: 2,
    pop: 2,
    tags: ["bete"],
    role: "harc\xE8lement",
    weapon: "crocs",
    defaultDist: 1,
    base: { hp: 70, will: 50, energy: 100, mana: 0, atk: 5 },
    growth: { hp: 4, will: 1, energy: 2, mana: 0, atk: 1 },
    forms: [
      { id: "loup", name: "Loup", level: 1, speed: 15, res: { glace: 25, feu: -25 }, skills: [["morsure", 1], ["repos", 1], ["charge", 5], ["hurlement", 9]] },
      { id: "alpha", name: "Loup alpha", level: 12, parent: "loup", hpMult: 1200, bonus: { will: 15, energy: 10, atk: 4 }, speed: 13, res: { glace: 35, feu: -20 }, skills: [["instinct_meute", 12], ["execution", 18]] }
    ],
    rules: [R("repos", ME, "selfEnergyBelow", 10), R("hurlement", ME, "selfWillBelow", 60), R("charge", WE), R("execution", WE), R("morsure", WE), R("avancer", ME, "noEnemyInRange")]
  },
  adepte: {
    name: "Adepte des ombres",
    units: 1,
    pop: 2,
    tags: ["humain"],
    role: "affaiblissements",
    weapon: "baton",
    defaultDist: 3,
    base: { hp: 65, will: 65, energy: 70, mana: 45, atk: 2 },
    growth: { hp: 3, will: 2, energy: 1, mana: 2, atk: 1 },
    forms: [
      { id: "adepte", name: "Adepte des ombres", level: 1, speed: 23, res: { tenebres: 30, sacre: -30 }, skills: [["emploi", 1], ["drain", 1], ["meditation", 1], ["murmure", 5], ["malediction", 8]] },
      { id: "necromancien", name: "N\xE9cromancien", level: 10, parent: "adepte", hpMult: 1100, bonus: { will: 15, energy: 10, mana: 15, atk: 2 }, speed: 22, res: { tenebres: 40, maladie: 20, sacre: -30 }, skills: [["nuage", 10], ["lien_vital", 15]] },
      { id: "liche", name: "Liche", level: 20, parent: "necromancien", hpMult: 1100, bonus: { will: 30, energy: 10, mana: 30, atk: 3 }, speed: 22, res: { tenebres: 60, maladie: 50, glace: 30, sacre: -50 }, tags: ["mort-vivant"], skills: [["non_mort", 20], ["terreur_masse", 24]] },
      { id: "sorcier_peste", name: "Sorcier de peste", level: 20, parent: "necromancien", hpMult: 1200, bonus: { will: 15, energy: 15, mana: 20, atk: 4 }, speed: 21, res: { tenebres: 40, maladie: 60, sacre: -30 }, skills: [["contagion", 20], ["nuage_renforce", 24]] }
    ],
    rules: [
      R("meditation", ME, "selfWillBelow", 40),
      R("nuage_renforce", NE, "enemiesAtLeast", 3),
      R("nuage", NE, "enemiesAtLeast", 3),
      R("lien_vital", SE, "targetLacksState", void 0, "lien"),
      R("malediction", SE, "targetLacksState", void 0, "malediction"),
      R("terreur_masse", NE),
      R("murmure", "lowestWillEnemy"),
      R("drain", NE),
      R("emploi", NE),
      R("attendre", ME)
    ]
  },
  moine: {
    name: "Novice du monast\xE8re",
    units: 1,
    pop: 1,
    tags: ["humain"],
    role: "contact, contr\xF4le",
    weapon: "gantelets",
    defaultDist: 1,
    base: { hp: 85, will: 100, energy: 110, mana: 0, atk: 4 },
    growth: { hp: 5, will: 3, energy: 3, mana: 0, atk: 1 },
    forms: [
      { id: "novice", name: "Novice", level: 1, speed: 16, res: { psychique: 30 }, skills: [["emploi", 1], ["meditation", 1], ["repos", 1], ["repousser", 5], ["fracas", 9]] },
      { id: "moine", name: "Moine", level: 10, parent: "novice", hpMult: 1150, bonus: { will: 20, energy: 15, atk: 3 }, speed: 15, res: { psychique: 45, maladie: 15 }, skills: [["confusion_moine", 10], ["hate", 15]] },
      { id: "maitre_souffle", name: "Ma\xEEtre du souffle", level: 20, parent: "moine", hpMult: 1200, bonus: { will: 30, energy: 20, atk: 5 }, speed: 14, res: { psychique: 60, maladie: 25 }, skills: [["esprit_inebranlable", 20], ["paume_vide", 24]] }
    ],
    rules: [
      R("repos", ME, "selfEnergyBelow", 15),
      R("meditation", ME, "selfWillBelow", 50),
      R("hate", ME, "selfLacksState", void 0, "hate"),
      R("fracas", NE, "targetHasState", void 0, "gele"),
      R("paume_vide", NE, "targetLacksState", void 0, "confusion"),
      R("confusion_moine", SE, "targetLacksState", void 0, "confusion"),
      R("repousser", NE, "selfEnergyAbove", 80),
      R("emploi", NE),
      R("avancer", ME, "noEnemyInRange")
    ]
  },
  briseur: {
    name: "Briseur",
    units: 1,
    pop: 3,
    tags: ["geant"],
    role: "tank lourd",
    weapon: "masse_lourde",
    defaultDist: 1,
    base: { hp: 180, will: 70, energy: 120, mana: 0, atk: 8 },
    growth: { hp: 10, will: 1, energy: 2, mana: 0, atk: 2 },
    forms: [
      { id: "briseur", name: "Briseur", level: 1, speed: 28, res: { contondant: 25, tranchant: 25, feu: -10 }, skills: [["emploi", 1], ["exploit", 1], ["repos", 1], ["brise_armure", 4], ["fracas", 8], ["riposte", 12]] },
      { id: "colosse", name: "Colosse de si\xE8ge", level: 15, parent: "briseur", hpMult: 1250, bonus: { will: 15, energy: 20, atk: 6 }, speed: 27, res: { contondant: 40, tranchant: 35, feu: -10 }, skills: [["repousser_renforce", 15], ["provocation", 18], ["seisme", 24]] }
    ],
    rules: [
      R("repos", ME, "selfEnergyBelow", 15),
      R("provocation", ME, "selfLacksState", void 0, "provocation"),
      R("seisme", ME, "enemiesAtLeast", 3),
      R("repousser_renforce", ME, "selfEnergyAbove", 70),
      R("fracas", NE, "targetHasState", void 0, "gele"),
      R("brise_armure", SE, "targetLacksState", void 0, "brise"),
      R("exploit", NE, "selfEnergyAbove", 50),
      R("emploi", NE),
      R("avancer", ME, "noEnemyInRange")
    ]
  }
};
function defaultContent() {
  return JSON.parse(JSON.stringify({ params: DEFAULT_PARAMS, weapons: DEFAULT_WEAPONS, skills: DEFAULT_SKILLS, troops: DEFAULT_TROOPS }));
}
function formChain(t, formId) {
  const chain = [];
  let f = t.forms.find((x) => x.id === formId) ?? t.forms[0];
  while (f) {
    chain.unshift(f);
    f = f.parent ? t.forms.find((x) => x.id === f.parent) : void 0;
  }
  return chain;
}
function formsAvailable(t, level) {
  return t.forms.filter((f) => f.level <= level);
}
function learned(t, formId, level) {
  const out = [];
  for (const f of formChain(t, formId)) for (const [id, lvl] of f.skills) if (lvl <= level && !out.includes(id)) out.push(id);
  return out;
}
function basicAttack(t) {
  return t.forms[0].skills[0][0];
}
function defaultActive(t, formId, level) {
  const all = learned(t, formId, level);
  if (all.length <= 6) return all;
  const pickd = [all[0]];
  for (let i = all.length - 1; i > 0 && pickd.length < 6; i--) pickd.push(all[i]);
  return all.filter((x) => pickd.includes(x));
}
function bestForm(t, level) {
  const av = formsAvailable(t, level);
  return av[av.length - 1].id;
}
var GAUGE_MULT = 3;
function computeStats(t, formId, level) {
  const chain = formChain(t, formId);
  const f = chain[chain.length - 1];
  const g2 = (k) => t.base[k] + Math.floor(t.growth[k] * (level - 1));
  const b = (k) => f.bonus?.[k] ?? 0;
  const hp = Math.floor(g2("hp") * (f.hpMult ?? 1e3) / 1e3) * GAUGE_MULT;
  const res = {};
  for (const ty of DMG_TYPES) res[ty] = (f.res[ty] ?? 0) * 10;
  const tags = [.../* @__PURE__ */ new Set([...t.tags, ...chain.flatMap((c) => c.tags ?? [])])];
  return {
    name: f.name,
    hpMax: hp,
    willMax: g2("will") + b("will"),
    energyMax: (g2("energy") + b("energy")) * GAUGE_MULT,
    manaMax: t.base.mana || t.growth.mana ? (g2("mana") + b("mana")) * GAUGE_MULT : 0,
    atk: g2("atk") + b("atk"),
    speed: f.speed,
    res,
    tags
  };
}
function defaultRules(t, formId, level) {
  const known = learned(t, formId, level);
  const common = ["avancer", "reculer", "attendre", "fuir"];
  return JSON.parse(JSON.stringify(t.rules.filter((r) => common.includes(r.action) || known.includes(r.action))));
}
function newTroop(c, type, level = 10) {
  const t = c.troops[type];
  const form = bestForm(t, level);
  return {
    type,
    level,
    form,
    active: defaultActive(t, form, level),
    rules: defaultRules(t, form, level),
    units: Array.from({ length: t.units }, () => ({ dist: t.defaultDist, hpPct: 100, manaPct: 100 }))
  };
}

