var OLD_AI = {
  emploi: { ai: "basic" },
  tir_fronde: { ai: "basic" },
  tir_arc: { ai: "basic" },
  morsure: { ai: "basic" },
  exploit: { ai: "attack" },
  meditation: { ai: "will" },
  repos: { ai: "energy" },
  hurlement: { ai: "will" },
  coup_bouclier: { ai: "control", s: "etourdi" },
  repousser: { ai: "control" },
  provocation: { ai: "buffSelf", s: "provocation" },
  mur_boucliers: { ai: "groupHeal" },
  execution: { ai: "finisher" },
  fracas: { ai: "attack", ifState: "gele" },
  brise_armure: { ai: "debuff", s: "brise" },
  charge: { ai: "attack" },
  tir_precis: { ai: "attack" },
  volee: { ai: "aoe" },
  marque: { ai: "debuff", s: "marque" },
  soin_mineur: { ai: "heal" },
  regeneration: { ai: "buffAlly", s: "regeneration" },
  priere: { ai: "groupHeal" },
  trait_sacre: { ai: "attack" },
  bouclier_foi: { ai: "buffAlly", s: "bouclier" },
  confusion: { ai: "debuff", s: "confusion" },
  confusion_moine: { ai: "debuff", s: "confusion" },
  trait_flammes: { ai: "attack" },
  boule_feu: { ai: "debuff", s: "brulure" },
  arme_enflammee: { ai: "buffAlly", s: "arme_feu" },
  mur_flammes: { ai: "aoe" },
  lame_saignante: { ai: "debuff", s: "saignement" },
  cri_guerre: { ai: "buffSelf", s: "cri" },
  tourbillon: { ai: "aoe", self: true },
  seisme: { ai: "aoe", self: true },
  drain: { ai: "attack" },
  murmure: { ai: "control" },
  terreur_masse: { ai: "aoe" },
  malediction: { ai: "debuff", s: "malediction" },
  nuage: { ai: "debuff", s: "poison" },
  lien_vital: { ai: "debuff", s: "lien" },
  hate: { ai: "buffSelf", s: "hate" },
  paume_vide: { ai: "debuff", s: "confusion" },
  fleche_givre: { ai: "control", s: "gele" },
  grappin: { ai: "control" }
};
var R2 = (action, target, cond = "always", v, st) => ({ cond, v, s: st, action, target });
function info(id, sk) {
  if (OLD_AI[id]) return OLD_AI[id];
  const st = sk.fx?.find((f) => f.k === "state" && f.s);
  return { ai: sk.ai ?? "attack", s: st?.s, ifState: sk.fx?.find((f) => f.ifState)?.ifState, self: sk.target === "self" };
}
function genRules(skills, SK) {
  const rules = [];
  const by = (ai) => skills.filter((id) => SK[id] && SK[id].kind === "active" && info(id, SK[id]).ai === ai);
  const basic = skills[0];
  const ranged = (SK[basic]?.range ?? 1) >= 3;
  for (const id of by("energy")) rules.push(R2(id, "self", "selfEnergyBelow", 15));
  for (const id of by("restore")) rules.push(R2(id, "self", "selfEnergyBelow", 20));
  for (const id of by("will")) rules.push(R2(id, "self", "selfWillBelow", 45));
  for (const id of by("groupHeal")) rules.push(R2(id, "self", "allyHpBelow", 50));
  for (const id of by("heal")) rules.push(R2(id, "mostWoundedAlly", "allyHpBelow", 55));
  for (const id of by("buffAlly")) {
    const i = info(id, SK[id]);
    rules.push(R2(id, "mostWoundedAlly", i.s ? "targetLacksState" : "allyHpBelow", i.s ? void 0 : 70, i.s));
  }
  for (const id of by("buffGroup")) {
    const i = info(id, SK[id]);
    rules.push(R2(id, "self", i.s ? "selfLacksState" : "always", void 0, i.s));
  }
  for (const id of by("buffSelf")) {
    const i = info(id, SK[id]);
    rules.push(R2(id, "self", i.s ? "selfLacksState" : "always", void 0, i.s));
  }
  for (const id of by("finisher")) rules.push(R2(id, "weakestEnemy"));
  for (const id of by("debuff")) {
    const i = info(id, SK[id]);
    rules.push(R2(id, "strongestEnemy", i.s ? "targetLacksState" : "always", void 0, i.s));
  }
  for (const id of by("control")) {
    const i = info(id, SK[id]);
    rules.push(i.s ? R2(id, "nearestEnemy", "targetLacksState", void 0, i.s) : R2(id, "nearestEnemy", "selfEnergyAbove", 60));
  }
  for (const id of by("aoe")) rules.push(R2(id, info(id, SK[id]).self ? "self" : "nearestEnemy", "enemiesAtLeast", 3));
  for (const id of by("attack")) {
    const i = info(id, SK[id]);
    if (i.ifState) rules.push(R2(id, "nearestEnemy", "targetHasState", void 0, i.ifState));
    else rules.push(R2(id, (SK[id].range ?? 1) >= 3 ? "weakestEnemy" : "nearestEnemy", SK[id].mana > 0 ? "always" : "selfEnergyAbove", SK[id].mana > 0 ? void 0 : 40));
  }
  if (basic) rules.push(R2(basic, ranged ? "weakestEnemy" : "nearestEnemy"));
  rules.push(ranged || (SK[basic]?.range ?? 1) >= 2 ? R2("attendre", "self") : R2("avancer", "self", "noEnemyInRange"));
  if (!ranged) rules.push(R2("attendre", "self"));
  return rules;
}

