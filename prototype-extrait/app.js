var KEY = "proto.ville.v1";
var store = {
  get(k) {
    try {
      const v = localStorage.getItem(k);
      return v ? JSON.parse(v) : null;
    } catch {
      return null;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch {
    }
  }
};
var g = (() => {
  const s3 = store.get(KEY);
  return s3 && s3.v === SAVE_VERSION ? upgradeSave(s3) : newGame(randomSeed());
})();
function randomSeed() {
  return Math.random() * 2 ** 31 | 0;
}
function save() {
  store.set(KEY, g);
}
var tab = store.get("proto.ville.tab") ?? "ville";
var toastMsg = null;
var craftFilter = { can: false, kind: "tout", tier: 0 };
var lastCrafted = null;
var resetAsk = false;
var resetSeed = 0;
function act(fn, ok) {
  try {
    fn();
    save();
    if (ok) toast(ok);
  } catch (e) {
    toast(e.message, true);
  }
  render();
}
function toast(text, bad = false) {
  toastMsg = { text: text.charAt(0).toUpperCase() + text.slice(1), bad };
}
function go(t) {
  stopReplay();
  if (g.watch && t !== "combat") {
    toast("Regardez d\u2019abord le combat jusqu\u2019au bout.", true);
    t = "combat";
  }
  tab = t;
  store.set("proto.ville.tab", t);
  render();
  window.scrollTo({ top: 0 });
}
var CAT_FR = { une_main: "une main", deux_mains: "deux mains", fronde: "fronde", arc: "arc", baton: "b\xE2ton", gantelets: "gantelets", legere: "l\xE9g\xE8re", moyenne: "moyenne", lourde: "lourde", robe: "robe", bottes: "bottes", collier: "collier", anneau: "anneau" };
var KIND_FR = { materiau: "mat\xE9riau", composant: "composant", consommable: "consommable", trophee: "troph\xE9e" };
var cat = (c) => CAT_FR[c] ?? c;
var itemName = (id) => EQUIP[id]?.name ?? ITEMS[id]?.name ?? C.troops[id]?.name ?? id;
function bar(cls, val, max, label = true) {
  if (max <= 0) return null;
  return h("div", { class: `bar g-${cls}`, title: `${val} / ${max}` }, h("i", { style: `width:${Math.max(0, Math.min(100, Math.round(100 * val / max)))}%` }), label ? h("span", {}, `${val} / ${max}`) : null);
}
function qualityTag(it) {
  const q = quality(it.roll);
  return h("span", { class: `q q-${q.replace("\xE9", "e")}`, title: `jet ${Math.round(it.roll / 10)} % du budget` }, q);
}
function equipCard(it, ...actions) {
  const b = EQUIP[it.base];
  return h(
    "div",
    { class: "eq" },
    h("div", { class: "eq-head" }, h("b", {}, b.name), qualityTag(it)),
    h("div", { class: "meta" }, `${b.slot}, ${cat(b.cat)} \xB7 palier ${b.tier} \xB7 niv. ${TIER_LEVEL[b.tier]}+`, b.weapon ? ` \xB7 ${TYPE_FR[b.weapon.type]} ${b.weapon.dmg}, vitesse ${b.weapon.speed}, co\xFBt ${b.weapon.cost}` : ""),
    h("ul", { class: "eq-stats" }, it.stats.map((s3) => h("li", {}, statText(s3)))),
    actions.length ? h("div", { class: "row gap-s" }, actions) : null
  );
}
function ingredientList(ings, mult = 1) {
  return h("span", { class: "ings" }, ings.map(([id, q]) => {
    const need = Math.ceil(q * mult), n = have(g, id);
    return h("span", { class: `ing ${n >= need ? "ok" : "miss"}`, title: `vous en avez ${n}` }, `${need} ${itemName(id)}`, h("small", {}, ` (${n})`));
  }));
}
function troopLine(type, level, units) {
  const d = C.troops[type];
  return h("li", {}, h("b", {}, d.name), ` niv. ${level}`, units > 1 ? ` \xB7 ${units} unit\xE9s` : "", h("span", { class: "dim" }, ` \xB7 ${d.role}`));
}
function groupView(side) {
  return h("ul", { class: "group" }, side.troops.map((t) => troopLine(t.type, t.level, t.units.length)));
}
function renderHeader() {
  const where = g.where === "ville" ? cityOf(g).name : `${territoryOf(g).name} \xB7 ${territoryOf(g).steps[g.step].name}`;
  const top = document.getElementById("status");
  if (g.watch) {
    top.replaceChildren(h("span", { class: "pill where territoire" }, "Combat en cours"));
  } else top.replaceChildren(
    h("span", { class: "pill" }, h("b", {}, g.gold), " or"),
    h("span", { class: "pill" }, "Sac ", h("b", {}, `${slotsUsed(g.bag)}/${ECO.bagSlots}`)),
    h("span", { class: "pill" }, "Escouade ", h("b", {}, `${squadUsage(g).pop}/5`), " pop."),
    h("span", { class: `pill where ${g.where}` }, where)
  );
  document.querySelectorAll("[data-tab]").forEach((b) => {
    b.setAttribute("aria-selected", String(b.dataset.tab === tab));
    const t = b.dataset.tab;
    b.classList.toggle("off", g.where !== "ville" && (t === "ville" || t === "atelier") || !!g.watch && t !== "combat");
    if (t === "combat") b.hidden = !g.last;
  });
}
function renderVille() {
  const CITY = cityOf(g), TERRITORY = territoryOf(g);
  if (g.where !== "ville") return h("div", { class: "panel" }, h("p", {}, `Vous \xEAtes en exp\xE9dition dans ${TERRITORY.name}. Rentrez pour acc\xE9der aux services de ${CITY.name}.`), h("button", { class: "primary", onclick: () => go("expedition") }, "Voir l\u2019exp\xE9dition"));
  const wounded = g.troops.some((t) => t.units.some((u2) => {
    const s3 = unitStats(t, u2);
    return u2.hp < s3.hpMax || u2.mana < s3.manaMax;
  }));
  const incomplete = g.troops.filter((t) => rebuyCost(t) > 0);
  return h(
    "div",
    { class: "grid" },
    h(
      "section",
      { class: "panel span2 hero" },
      h("div", {}, h("h2", {}, CITY.name), h("p", { class: "meta" }, `${regionOf(g).name} \xB7 r\xE9gion ${g.region + 1} \xB7 niveaux ${regionOf(g).minLevel}-${regionOf(g).minLevel + 6 + MONSTER_LEVEL_BONUS}`), h("p", {}, CITY.desc)),
      h(
        "div",
        { class: "row gap" },
        canBorrow(g) ? h("button", { onclick: () => act(() => borrow(g)) }, "Demander un milicien \xE0 la garde") : null,
        departButtons()
      )
    ),
    renderQuetes(),
    h(
      "section",
      { class: "panel" },
      h("h3", {}, "Temple"),
      h("p", { class: "meta" }, "Les soins sont gratuits en ville : PV et mana de toutes les troupes au maximum."),
      h("button", { disabled: !wounded, onclick: () => act(() => heal(g), "Troupes soign\xE9es.") }, wounded ? "Soigner toutes les troupes" : "Tout le monde est en forme"),
      incomplete.length ? h(
        "div",
        { class: "sub" },
        h("h4", {}, "Reconstituer une troupe"),
        incomplete.map((t) => h(
          "div",
          { class: "recipe" },
          h("div", {}, h("b", {}, troopName(t)), ` niv. ${t.level} \xB7 ${t.units.length}/${troopDef(t).units} unit\xE9s`),
          h("div", {}, ingredientList(g.recipes[t.type].ingredients, rebuyCost(t)), ` + ${Math.ceil(g.recipes[t.type].gold * rebuyCost(t))} or`),
          recruitRegion(t.type) === g.region ? h("button", { disabled: !canPay(g, g.recipes[t.type], rebuyCost(t)), onclick: () => act(() => rebuy(g, t.uid)) }, "Racheter les unit\xE9s") : h("span", { class: "meta small" }, `Se rach\xE8te \xE0 ${REGIONS[recruitRegion(t.type)].city.name}.`)
        ))
      ) : null
    ),
    renderVoyage(),
    h(
      "section",
      { class: "panel" },
      h("h3", {}, "Marchand"),
      h("p", { class: "meta" }, `Vend l\u2019\xE9quipement de d\xE9part (jet fixe de 80 %) et les consommables de base \xE0 150 % de leur valeur. Rach\xE8te tout \xE0 20 % : vendez depuis la Banque.`),
      h("div", { class: "shop" }, CITY.shop.map((id) => h(
        "div",
        { class: "shop-row" },
        h("span", {}, itemName(id), ITEMS[id]?.desc ? h("small", { class: "dim" }, ` \xB7 ${ITEMS[id].desc}`) : EQUIP[id] ? h("small", { class: "dim" }, ` \xB7 ${EQUIP[id].slot}`) : ""),
        h("button", { disabled: g.gold < priceOf(id), onclick: () => act(() => buy(g, id), `${itemName(id)} achet\xE9(e), en banque.`) }, `${priceOf(id)} or`)
      )))
    ),
    h(
      "section",
      { class: "panel span2" },
      h("h3", {}, "Caserne : recrutement"),
      h("p", { class: "meta" }, `Vos recettes de recrutement sont personnelles : un autre joueur paie d\u2019autres mat\xE9riaux pour la m\xEAme troupe. Ingr\xE9dients pris en banque puis dans le sac. Une recrue arrive au niveau ${recruitLevel(CITY.recruit[CITY.recruit.length - 1])} et rejoint l\u2019escouade s\u2019il reste de la place.`),
      h("div", { class: "recruits" }, CITY.recruit.map((type) => {
        const d = C.troops[type];
        const rec = g.recipes[type];
        return h(
          "div",
          { class: "recipe" },
          h("div", {}, h("b", {}, d.name), h("span", { class: "dim" }, ` \xB7 niv. ${recruitLevel(type)} \xB7 ${d.role} \xB7 ${d.pop} pop.${d.units > 1 ? ` \xB7 ${d.units} unit\xE9s` : ""}`)),
          h("div", {}, ingredientList(rec.ingredients), ` + ${rec.gold} or`),
          h("button", { disabled: !canPay(g, rec), onclick: () => act(() => recruit(g, type)) }, "Recruter")
        );
      }))
    ),
    renderJournal()
  );
}
function rewardText(q) {
  const rw = q.reward;
  if (rw.kind === "equip") return `${EQUIP[rw.base].name} de qualit\xE9 excellente (jet ${Math.round(rw.roll / 10)} %, palier ${EQUIP[rw.base].tier}, ${EQUIP[rw.base].slot})`;
  if (rw.kind === "troop") {
    const d = C.troops[rw.type];
    return `Troupe v\xE9t\xE9rane : ${d.name} niv. ${rw.level} (${d.role}, ${d.pop} pop.${d.units > 1 ? `, ${d.units} unit\xE9s` : ""})`;
  }
  return rw.items.map(([id, n]) => `${n} \xD7 ${ITEMS[id].name}`).join(", ");
}
function renderQuetes() {
  const qs = cityQuests(g);
  return h(
    "section",
    { class: "panel span2" },
    h("h3", {}, "Tableau des qu\xEAtes"),
    h("p", { class: "meta" }, `Les habitants \xE9changent les troph\xE9es des monstres rares contre de l\u2019\xE9quipement, des troupes ou des objets. Chaque \xE9tape (hors gardien) a son monstre rare, pr\xE9sent dans ${RARE_CHANCE} % des rencontres une fois votre escouade aguerrie (${RARE_MIN_WINS} victoires) ; il laisse toujours son troph\xE9e. Troph\xE9es pris en banque puis dans le sac. Une qu\xEAte rendue est aussit\xF4t remplac\xE9e.`),
    h("div", { class: "quests" }, qs.map((q) => {
      const ok = canComplete(g, q);
      return h(
        "div",
        { class: `quest ${ok ? "ready" : ""}` },
        h("div", { class: "row gap between" }, h("b", {}, q.title), h("span", { class: `badge ${ok ? "good" : ""}` }, ok ? "pr\xEAte" : q.reward.kind === "equip" ? "\xE9quipement" : q.reward.kind === "troop" ? "troupe" : "objets")),
        h("div", { class: "meta small" }, q.giver),
        h("p", { class: "small" }, q.text),
        h("div", {}, h("span", { class: "dim" }, "Demande : "), q.needs.map(([id, n], k) => {
          const rr = rareOfTrophy(id);
          const hv = have(g, id);
          return h("span", { class: hv >= n ? "good" : "", title: `Laiss\xE9 par ${rr.name} (${REGIONS[rr.region].territory.steps.find((s3) => s3.id === rr.step).name}, ${REGIONS[rr.region].territory.name})` }, `${k ? ", " : ""}${ITEMS[id].name} ${Math.min(hv, n)}/${n}`);
        })),
        h("div", {}, h("span", { class: "dim" }, "R\xE9compense : "), rewardText(q), ` + ${q.gold} or`),
        h(
          "div",
          { class: "row gap" },
          h("button", { class: ok ? "primary" : "", disabled: !ok, onclick: () => act(() => completeQuest(g, q.id), `Qu\xEAte rendue : ${rewardText(q)}.`) }, "Rendre la qu\xEAte"),
          h("button", { disabled: g.gold < abandonCost(g), title: "Remplace la qu\xEAte par une autre", onclick: () => act(() => abandonQuest(g, q.id)) }, `Renoncer (${abandonCost(g)} or)`)
        )
      );
    }))
  );
}
function departButtons(compact = false) {
  const i = g.region, ok = squad(g).length > 0;
  const fwd = REGIONS[i].territory, next = REGIONS[i + 1];
  const prev = i > 0 ? REGIONS[i - 1] : null;
  const go2 = (d) => act(() => {
    depart(g, d);
    go("expedition");
  });
  return [
    h("button", { class: "primary", disabled: !ok, onclick: () => go2(1) }, next ? `Vers ${next.city.name} : ${fwd.name}` : `Explorer ${fwd.name}`),
    prev ? h("button", { disabled: !ok, onclick: () => go2(-1) }, `Vers ${prev.city.name} : ${prev.territory.name} \xE0 rebours`) : null,
    compact ? null : null
  ];
}
function renderVoyage() {
  return h(
    "section",
    { class: "panel span2" },
    h("h3", {}, "Routes"),
    h("p", { class: "meta" }, "Chaque territoire relie deux villes. Pour atteindre une ville, il faut traverser le territoire qui y m\xE8ne et vaincre sa derni\xE8re \xE9tape : dans les deux sens, les \xE9tapes se font dans le m\xEAme ordre et le gardien est au bout. La banque est commune \xE0 toutes les villes ; chaque ville a sa caserne, son marchand et l\u2019atelier de son palier."),
    h("ol", { class: "route" }, REGIONS.map((r, i) => h(
      "li",
      { class: `${i === g.region ? "here" : ""} ${i <= g.unlocked ? "" : "locked"}` },
      h("b", {}, r.city.name),
      i === g.region ? h("span", { class: "badge" }, "vous \xEAtes ici") : i > g.unlocked ? h("span", { class: "dim small" }, " \xB7 jamais atteinte") : null,
      h("div", { class: "meta small" }, `\u2193 ${r.territory.name} \xB7 niv. ${r.territory.steps[0].level[0]}-${r.territory.steps[r.territory.steps.length - 1].level[1]}`, g.guardians[i] ? " \xB7 gardien d\xE9j\xE0 vaincu" : "", i === REGIONS.length - 1 ? " \xB7 sans issue" : "")
    ))),
    h("div", { class: "row gap" }, departButtons())
  );
}
function renderJournal() {
  return h("section", { class: "panel span2" }, h("h3", {}, "Journal"), h("ol", { class: "journal" }, g.journal.slice(0, 14).map((s3) => h("li", {}, s3))));
}
function renderTrack() {
  const TERRITORY = territoryOf(g);
  return h("ol", { class: "track" }, stepOrder(g).map((i) => {
    const st = TERRITORY.steps[i];
    const here = g.where === "territoire" && g.step === i;
    const cls = ["stop", here ? "here" : "", g.where === "territoire" && g.cleared[i] ? "done" : "", st.guardian ? "boss" : ""].join(" ");
    return h("li", { class: cls }, h("span", { class: "dot" }, st.guardian ? "\u265B" : String(stepOrder(g).indexOf(i) + 1)), h("span", { class: "lbl" }, st.name), h("small", {}, `niv. ${st.level[0]}${st.level[1] !== st.level[0] ? `-${st.level[1]}` : ""}`));
  }));
}
function squadPanel(withItems) {
  const bagCons = Object.entries(g.bag.stacks).filter(([id]) => ITEMS[id].kind === "consommable");
  return h(
    "section",
    { class: "panel" },
    h("h3", {}, "Escouade"),
    squad(g).length ? squad(g).map((t) => h(
      "div",
      { class: "sq" },
      h("div", { class: "sq-head" }, h("b", {}, troopName(t)), h("span", { class: "dim" }, ` niv. ${t.level} \xB7 rang ${t.rank}`)),
      t.units.map((u2, ui) => {
        const s3 = unitStats(t, u2);
        return h(
          "div",
          { class: "sq-unit" },
          t.units.length > 1 ? h("span", { class: "dim small" }, `#${ui + 1}`) : null,
          h("div", { class: "bars" }, bar("hp", u2.hp, s3.hpMax), bar("mana", u2.mana, s3.manaMax)),
          withItems && bagCons.length ? select(
            `use-${t.uid}-${ui}`,
            "",
            [["", "Utiliser\u2026"], ...bagCons.map(([id, q]) => [id, `${ITEMS[id].name} (${q})`])],
            (v) => v && act(() => useConsumable(g, v, t.uid, ui), `${ITEMS[v].name} utilis\xE9(e).`),
            "small"
          ) : null
        );
      })
    )) : h("p", { class: "meta" }, "Escouade vide.")
  );
}
function renderExpedition() {
  const CITY = cityOf(g), TERRITORY = territoryOf(g);
  if (g.where === "ville") {
    return h(
      "div",
      { class: "grid" },
      h(
        "section",
        { class: "panel span2" },
        h("h2", {}, `Depuis ${CITY.name}`),
        h("p", {}, `${TERRITORY.name} : ${TERRITORY.desc}`),
        renderTrack(),
        h("p", { class: "meta" }, `Cinq \xE9tapes, de plus en plus dures. Il faut vaincre les monstres d\u2019une \xE9tape pour avancer. Les PV ne remontent pas entre deux combats ; le mana regagne 25 % du maximum \xE0 la fin de chaque combat. Hors de la ville, seuls les consommables du sac soignent. Le sac contient ${ECO.bagSlots} emplacements. Une unit\xE9 tomb\xE9e \xE0 0 PV est perdue avec son \xE9quipement.`),
        h("p", { class: "meta" }, "Pour arriver dans une autre ville, il faut franchir tout le territoire qui y m\xE8ne, gardien compris. On peut rentrer \xE0 la ville de d\xE9part \xE0 tout moment."),
        squad(g).length ? null : h("p", { class: "bad" }, canBorrow(g) ? "Vous n\u2019avez plus de troupe : demandez un milicien \xE0 la garde, en Ville." : "Escouade vide : engagez une troupe dans l\u2019onglet Troupes."),
        h("div", { class: "row gap" }, departButtons())
      ),
      g.last ? renderResult(g.last) : null,
      squadPanel(false)
    );
  }
  const st = TERRITORY.steps[g.step];
  const cleared = g.cleared[g.step];
  const order = stepOrder(g), pos = order.indexOf(g.step), d = dirOf(g);
  const dest = destination(g);
  const atEnd = pos === order.length - 1;
  const last = g.last && g.last.step === g.step && !g.encounter ? g.last : null;
  return h(
    "div",
    { class: "grid" },
    h("section", { class: "panel span2" }, h("p", { class: "meta" }, `${TERRITORY.name}${d < 0 ? " \xE0 rebours" : ""} \xB7 d\xE9part de ${CITY.name}${dest !== null ? ` \xB7 arriv\xE9e : ${REGIONS[dest].city.name}` : " \xB7 sans issue"}`), renderTrack()),
    h(
      "section",
      { class: "panel span2 step" },
      h("div", { class: "row gap between" }, h("div", {}, h("h2", {}, st.name), h("p", {}, st.desc)), cleared ? h("span", { class: "badge good" }, "\xE9tape d\xE9gag\xE9e") : null),
      g.encounter ? h(
        "div",
        { class: "enc" },
        h("h3", {}, st.guardian ? "Le gardien vous attend" : "Vous apercevez", g.encounter.rare ? h("span", { class: "tag rare" }, `monstre rare : ${MONSTERS[g.encounter.rare].name}`) : null),
        g.encounter.rare ? h("p", { class: "meta" }, `Bien plus coriace que les autres monstres de l\u2019\xE9tape. Vaincu, il laisse \xE0 coup s\xFBr : ${ITEMS[MONSTERS[g.encounter.rare].rare.trophy].name}. Pour l\u2019\xE9viter, rentrez en ville : il ne sera peut-\xEAtre plus l\xE0 au prochain d\xE9part.`) : null,
        groupView(g.encounter.side),
        h("p", { class: "meta" }, `Puissance estim\xE9e ${groupPower(C, g.encounter.side)} (population \xD7 niveau). Votre escouade : ${squad(g).reduce((a, t) => a + troopDef(t).pop * t.level, 0)}.`)
      ) : h("p", { class: "meta" }, "Aucun monstre en vue. Vous pouvez chercher un autre combat ici pour r\xE9colter, avancer, ou rebrousser chemin."),
      h(
        "div",
        { class: "row gap actions" },
        g.encounter ? h("button", { class: "primary", onclick: () => {
          act(() => fight(g));
          if (g.watch) {
            combatView = "pixel";
            go("combat");
          }
        } }, "Combattre") : h("button", { onclick: () => act(() => searchFight(g)) }, "Chercher un combat"),
        !atEnd ? h("button", { disabled: !cleared, title: cleared ? "" : "Battez d\u2019abord les monstres de cette \xE9tape", onclick: () => act(() => advance(g)) }, `Avancer : ${TERRITORY.steps[g.step + 1].name}`) : null,
        atEnd && dest !== null ? h("button", { class: cleared ? "primary" : "", disabled: !cleared, title: cleared ? "" : "Battez d\u2019abord cette derni\xE8re \xE9tape", onclick: () => act(() => {
          arrive(g);
          go("ville");
        }) }, `Arriver \xE0 ${REGIONS[dest].city.name}`) : null,
        pos > 0 ? h("button", { onclick: () => act(() => back(g)) }, `Rebrousser : ${TERRITORY.steps[g.step - 1].name}`) : null,
        h("button", { onclick: () => act(() => goHome(g)) }, `Rentrer \xE0 ${CITY.name}`)
      )
    ),
    last ? renderResult(last) : null,
    squadPanel(true),
    h(
      "section",
      { class: "panel" },
      h("h3", {}, `Sac ${slotsUsed(g.bag)}/${ECO.bagSlots}`),
      bagList(true),
      g.pending.length ? h(
        "div",
        { class: "sub" },
        h("h4", { class: "bad" }, "Butin laiss\xE9 au sol (sac plein)"),
        h("p", { class: "meta" }, "Jetez quelque chose pour le ramasser. Il est perdu si vous quittez l\u2019\xE9tape."),
        g.pending.map((it, i) => h("div", { class: "shop-row" }, lootText(it), h("button", { onclick: () => act(() => takePending(g, i)) }, "Ramasser")))
      ) : null
    ),
    renderJournal()
  );
}
function lootText(it) {
  return "id" in it ? h("span", {}, `${it.qty} \xD7 ${ITEMS[it.id].name}`) : h("span", {}, EQUIP[it.equip.base].name, " ", qualityTag(it.equip));
}
function renderResult(r) {
  return h(
    "section",
    { class: `panel span2 result-panel ${r.won ? "won" : "lost"}` },
    h("div", { class: "row gap between" }, h("h3", {}, r.won ? "Victoire" : "D\xE9faite"), h("button", { onclick: () => go("combat") }, "Revoir le combat")),
    r.won ? h("p", {}, `+${r.gold} or \xB7 XP : `, r.xpBy.map(([n, x]) => `${n} +${x}`).join(", ") || "aucune (personne n\u2019a fini en jeu)") : null,
    r.levelUps.length ? h("p", { class: "good" }, r.levelUps.join(" \xB7 ")) : null,
    r.manaBack?.length ? h("p", { class: "meta" }, `Mana r\xE9cup\xE9r\xE9 apr\xE8s le combat (+${ECO.manaRegenEnd} % du maximum) : `, r.manaBack.map(([n, d, v]) => `${n} +${d} (${v})`).join(", ")) : null,
    r.deaths.length ? h("p", { class: "bad" }, `Mort${r.deaths.length > 1 ? "s" : ""} : ${r.deaths.join(", ")}. L\u2019\xE9quipement port\xE9 est perdu.`) : null,
    r.loot.length ? h("div", { class: "loot" }, h("span", { class: "dim" }, "Butin : "), r.loot.map((it) => h("span", { class: "lootit" }, lootText(it)))) : r.won ? h("p", { class: "meta" }, "Pas de butin.") : null
  );
}
function bagList(inField) {
  const s3 = g.bag;
  const stacks = Object.entries(s3.stacks).sort(([a], [b]) => ITEMS[a].kind.localeCompare(ITEMS[b].kind) || ITEMS[a].name.localeCompare(ITEMS[b].name));
  if (!stacks.length && !s3.equip.length) return h("p", { class: "meta" }, "Vide.");
  return h(
    "div",
    { class: "inv" },
    stacks.map(([id, q]) => h(
      "div",
      { class: "inv-row" },
      h("span", {}, h("b", {}, q), " ", ITEMS[id].name, h("small", { class: "dim" }, ` \xB7 ${KIND_FR[ITEMS[id].kind]}`)),
      h(
        "span",
        { class: "row gap-s" },
        !inField ? null : h("button", { class: "small", onclick: () => act(() => discard(g, { id, qty: q })) }, "Jeter")
      )
    )),
    s3.equip.map((it) => h("div", { class: "inv-row" }, h("span", {}, EQUIP[it.base].name, " ", qualityTag(it)), inField ? h("button", { class: "small", onclick: () => act(() => discard(g, { uid: it.uid })) }, "Jeter") : null))
  );
}
function storeColumn(where) {
  const s3 = g[where];
  const city = g.where === "ville";
  const other = where === "bag" ? "banque" : "sac";
  const useless = new Set(tradeOnly(g.seed));
  const stacks = Object.entries(s3.stacks).sort(([a], [b]) => ITEMS[a].kind.localeCompare(ITEMS[b].kind) || ITEMS[a].tier - ITEMS[b].tier || ITEMS[a].name.localeCompare(ITEMS[b].name));
  return h(
    "section",
    { class: "panel" },
    h("h3", {}, where === "bag" ? "Sac" : "Banque", h("span", { class: "dim" }, ` ${slotsUsed(s3)}/${capacity(g, s3)} emplacements`)),
    h("p", { class: "meta" }, where === "bag" ? "Ce que l\u2019escouade emporte en exp\xE9dition. Une pile = un emplacement (50 mat\xE9riaux, 20 composants, 10 consommables)." : "Commune \xE0 toutes les villes. Le craft et le recrutement y puisent en premier."),
    !stacks.length && !s3.equip.length ? h("p", { class: "meta" }, "Vide.") : null,
    stacks.length ? h("div", { class: "inv" }, stacks.map(([id, q]) => {
      const it = ITEMS[id];
      const stack = STACK[it.kind];
      return h(
        "div",
        { class: "inv-row" },
        h("span", {}, h("b", {}, q), " ", it.name, h("small", { class: "dim" }, ` \xB7 ${KIND_FR[it.kind]} p${it.tier}${it.desc ? ` \xB7 ${it.desc}` : ""}${q > stack ? ` \xB7 ${Math.ceil(q / stack)} piles` : ""}`), useless.has(id) ? h("span", { class: "tag", title: "Aucune de vos recettes ne l\u2019utilise : \xE0 vendre ou \xE9changer" }, "inutile pour vous") : null),
        h(
          "span",
          { class: "row gap-s" },
          city ? h("button", { class: "small", onclick: () => act(() => transferStack(g, where, id, q)) }, `\u2192 ${other}`) : null,
          city ? h("button", { class: "small", onclick: () => act(() => sellStack(g, where, id, 1)) }, `Vendre 1 (${sellPrice({ id })})`) : null,
          city && q > 1 ? h("button", { class: "small", onclick: () => act(() => sellStack(g, where, id, q)) }, `Tout (${sellPrice({ id }) * q})`) : null,
          !city && where === "bag" ? h("button", { class: "small", onclick: () => act(() => discard(g, { id, qty: q })) }, "Jeter") : null
        )
      );
    })) : null,
    s3.equip.length ? h("div", { class: "eqs" }, s3.equip.map((it) => equipCard(
      it,
      city ? h("button", { class: "small", onclick: () => act(() => transferEquip(g, where, it.uid)) }, `\u2192 ${other}`) : null,
      city ? h("button", { class: "small", onclick: () => act(() => sellEquip(g, where, it.uid)) }, `Vendre (${sellPrice({ equip: it })})`) : null,
      !city && where === "bag" ? h("button", { class: "small", onclick: () => act(() => discard(g, { uid: it.uid })) }, "Jeter") : null
    ))) : null
  );
}
function renderBanque() {
  return h(
    "div",
    { class: "grid" },
    g.where !== "ville" ? h("p", { class: "panel span2 meta" }, "En exp\xE9dition : la banque est consultable mais pas accessible. Le sac reste utilisable.") : null,
    storeColumn("bag"),
    storeColumn("bank")
  );
}
function renderTroupes() {
  const city = g.where === "ville";
  const u2 = squadUsage(g);
  const list = [...g.troops].sort((a, b) => Number(b.squad) - Number(a.squad));
  return h(
    "div",
    { class: "troops" },
    h("p", { class: "meta" }, `Escouade : ${u2.pop}/5 population, ${u2.slots}/5 emplacements. Les troupes hors escouade restent en caserne (ville) et ne co\xFBtent rien. Ouvrez \xAB Strat\xE9gie \xBB sur une troupe pour choisir ses capacit\xE9s actives et ses r\xE8gles ; elle s\u2019applique \xE0 toutes ses unit\xE9s et se modifie aussi en exp\xE9dition, entre deux combats.`),
    !list.length ? h("p", {}, "Aucune troupe.") : null,
    list.map((t) => troopCard(t, city))
  );
}
function troopCard(t, city) {
  const d = troopDef(t);
  const next = ECO.xpToNext(t.level);
  const slots = TROOP_SLOTS[t.type] ?? {};
  const pool = city ? [...g.bank.equip.map((e) => ({ e, from: "banque" })), ...g.bag.equip.map((e) => ({ e, from: "sac" }))] : g.bag.equip.map((e) => ({ e, from: "sac" }));
  const skills = learned(d, t.form, t.level);
  return h(
    "article",
    { class: `troop ${t.squad ? "in" : ""}` },
    h(
      "div",
      { class: "troop-head" },
      h("div", {}, h("h3", {}, troopName(t), h("small", { class: "dim" }, ` niv. ${t.level}`)), h("div", { class: "meta" }, `${d.role} \xB7 ${d.pop} pop. \xB7 ${t.units.length}/${d.units} unit\xE9${d.units > 1 ? "s" : ""}`)),
      h(
        "div",
        { class: "row gap-s" },
        h("label", { class: "field inline" }, "Rang", select(`rank-${t.uid}`, String(t.rank), [["1", "1 (contact)"], ["2", "2"], ["3", "3 (arri\xE8re)"]], (v) => act(() => setRank(g, t.uid, Number(v))))),
        city ? h("button", { class: t.squad ? "" : "primary", onclick: () => act(() => toggleSquad(g, t.uid)) }, t.squad ? "Retirer de l\u2019escouade" : "Engager") : h("span", { class: "badge" }, t.squad ? "escouade" : "caserne")
      )
    ),
    h("div", { class: "xp" }, bar("xp", t.xp, next), h("small", { class: "dim" }, `XP vers le niveau ${t.level + 1}`)),
    renderStrategy(t, () => {
      save();
      render();
    }),
    h("div", { class: "units-eq" }, t.units.map((u2, ui) => {
      const s3 = unitStats(t, u2);
      return h(
        "div",
        { class: "unit-eq" },
        d.units > 1 ? h("div", { class: "dim small" }, `Unit\xE9 ${ui + 1}`) : null,
        h("div", { class: "bars" }, bar("hp", u2.hp, s3.hpMax), bar("mana", u2.mana, s3.manaMax)),
        h(
          "dl",
          { class: "stats" },
          [["Att.", s3.atk], ["Vol.", s3.willMax], ["\xC9ner.", s3.energyMax], ["Vit.", s3.speed], ["Arme", `${s3.weapon.dmg}/${s3.weapon.speed}`]].map(([k, v]) => h("div", {}, h("dt", {}, k), h("dd", {}, v)))
        ),
        h("div", { class: "meta small" }, "R\xE9sistances : ", DMG_TYPES.filter((r) => s3.res[r]).map((r) => `${TYPE_FR[r]} ${s3.res[r] / 10} %`).join(", ") || "aucune"),
        h("div", { class: "slots" }, ["arme", "armure", "accessoire"].map((sl) => {
          const cats = slots[sl];
          const cur = u2.equip[sl];
          if (!cats) return h("div", { class: "slot na" }, h("span", { class: "sl" }, sl), h("span", { class: "dim" }, sl === "arme" ? `naturelle : ${C.weapons[d.weapon].name}` : "aucun"));
          const opts = pool.filter((p) => EQUIP[p.e.base].slot === sl && canWear(t.type, t.level, p.e.base) === null);
          return h(
            "div",
            { class: "slot" },
            h("span", { class: "sl" }, sl),
            cur ? h("span", {}, EQUIP[cur.base].name, " ", qualityTag(cur), h("small", { class: "dim" }, ` ${cur.stats.map(statText).join(", ")}`)) : h("span", { class: "dim" }, sl === "arme" ? `${C.weapons[d.weapon].name} (de base)` : "vide", h("small", {}, ` \xB7 ${cats.map(cat).join(", ")}`)),
            h(
              "span",
              { class: "row gap-s" },
              opts.length ? select(
                `eq-${t.uid}-${ui}-${sl}`,
                "",
                [["", cur ? "Remplacer\u2026" : "\xC9quiper\u2026"], ...opts.map((p) => [p.e.uid, `${EQUIP[p.e.base].name} \xB7 ${quality(p.e.roll)} \xB7 ${p.e.stats.map(statText).join(", ")} (${p.from})`])],
                (v) => v && act(() => equip(g, t.uid, ui, v)),
                "small"
              ) : null,
              cur ? h("button", { class: "small", onclick: () => act(() => unequip(g, t.uid, ui, sl)) }, "Retirer") : null
            )
          );
        }))
      );
    }))
  );
}
function renderAtelier() {
  if (g.where !== "ville") return h("div", { class: "panel" }, h("p", {}, "L\u2019atelier est en ville."));
  const recs = Object.values(g.recipes).filter((r) => r.kind !== "recrue").filter((r) => craftFilter.kind === "tout" || (craftFilter.kind === "consommable" ? r.kind === "consommable" : EQUIP[r.out]?.slot === craftFilter.kind)).filter((r) => !craftFilter.can || canPay(g, r)).filter((r) => !craftFilter.tier || (EQUIP[r.out]?.tier ?? ITEMS[r.out].tier) === craftFilter.tier).sort((a, b) => (EQUIP[a.out]?.tier ?? ITEMS[a.out].tier) - (EQUIP[b.out]?.tier ?? ITEMS[b.out].tier) || itemName(a.out).localeCompare(itemName(b.out)));
  const useless = tradeOnly(g.seed);
  return h(
    "div",
    { class: "grid" },
    h(
      "section",
      { class: "panel span2" },
      h("h2", {}, "Atelier"),
      h("p", { class: "meta" }, "Vos recettes sont personnelles et fixes : un autre joueur fabrique les m\xEAmes objets avec d\u2019autres ingr\xE9dients, pour un co\xFBt total \xE9quivalent (\xB1 10 %). Les stats d\u2019un \xE9quipement sont tir\xE9es \xE0 la fabrication : on ne les conna\xEEt qu\u2019une fois l\u2019objet cr\xE9\xE9. L\u2019objet arrive en banque. D\xE8s le palier 3, l\u2019\xE9quipement demande un composant (butin des monstres). Les paliers 4 et 5 ne se fabriquent que dans l\u2019atelier de leur r\xE9gion (Cendrelune, Sanctuaire de l\u2019Aube)."),
      h("p", { class: "meta" }, "Mat\xE9riaux qu\u2019aucune de vos recettes n\u2019utilise : ", h("b", {}, useless.map(itemName).join(", ")), ". Ils sont faits pour \xEAtre vendus ou \xE9chang\xE9s."),
      h(
        "div",
        { class: "row gap" },
        select("fkind", craftFilter.kind, [["tout", "Tout"], ["arme", "Armes"], ["armure", "Armures"], ["accessoire", "Accessoires"], ["consommable", "Consommables"]], (v) => {
          craftFilter.kind = v;
          render();
        }),
        select("ftier", String(craftFilter.tier), [["0", "Tous paliers"], ...[1, 2, 3, 4, 5].map((t) => [String(t), `Palier ${t}`])], (v) => {
          craftFilter.tier = Number(v);
          render();
        }),
        h("label", { class: "check" }, h("input", { type: "checkbox", checked: craftFilter.can, onchange: (e) => {
          craftFilter.can = e.target.checked;
          render();
        } }), " Seulement ce que je peux fabriquer")
      )
    ),
    lastCrafted ? h("section", { class: "panel span2 crafted" }, h("h3", {}, "Vient de sortir de l\u2019atelier"), equipCard(lastCrafted)) : null,
    h("section", { class: "panel span2" }, h("div", { class: "recipes" }, recs.map((r) => {
      const b = EQUIP[r.out];
      const ws = workshopRegion(r.out);
      const here = ws < 0 || ws === g.region;
      return h(
        "div",
        { class: "recipe" },
        h(
          "div",
          {},
          h("b", {}, itemName(r.out)),
          h("span", { class: "dim" }, b ? ` \xB7 ${b.slot}, ${cat(b.cat)} \xB7 palier ${b.tier} \xB7 niv. ${TIER_LEVEL[b.tier]}+` : ` \xB7 ${ITEMS[r.out].desc}`)
        ),
        b ? h(
          "div",
          { class: "meta small" },
          b.weapon ? `${TYPE_FR[b.weapon.type]} ${b.weapon.dmg}, vitesse ${b.weapon.speed}, co\xFBt ${b.weapon.cost} \xB7 ` : "",
          `${b.nStats ?? (b.tier >= 3 ? 3 : 2)} stats tir\xE9es parmi : `,
          [...new Set(b.pool.map(([k, , ty]) => k === "res" ? `r\xE9s. ${ty ? TYPE_FR[ty] : "au hasard"}` : STAT_COST[k].label))].join(", ")
        ) : null,
        h("div", {}, ingredientList(r.ingredients), r.gold ? ` + ${r.gold} or` : ""),
        !here ? h("span", { class: "meta small" }, `Atelier de ${REGIONS[ws].city.name} seulement.`) : null,
        h("button", { disabled: !here || !canPay(g, r), onclick: () => act(() => {
          const it = craft(g, r.out);
          lastCrafted = it;
          if (!it) toast(`${itemName(r.out)} fabriqu\xE9(e), en banque.`);
        }) }, "Fabriquer")
      );
    })))
  );
}
var combatView = "pixel";
var px = null;
var pxSpeed = store.get("proto.ville.pxspeed") ?? 25;
function renderCombat() {
  if (!g.last) return h("p", {}, "Aucun combat pour l\u2019instant.");
  const rec = g.last;
  const st = REGIONS[rec.region ?? 0].territory.steps[rec.step];
  const title = h("h2", {}, `${g.watch ? "Combat" : "Dernier combat"} \xB7 ${st.name}`);
  const watching = !!g.watch;
  const end = rec.log[rec.log.length - 1].t;
  const views = watching ? null : h(
    "div",
    { class: "row gap-s seg" },
    h("button", { class: combatView === "pixel" ? "on" : "", "aria-pressed": String(combatView === "pixel"), onclick: () => {
      combatView = "pixel";
      render();
    } }, "Vue 8 bits"),
    h("button", { class: combatView === "table" ? "on" : "", "aria-pressed": String(combatView === "table"), onclick: () => {
      combatView = "table";
      render();
    } }, "Vue tableau et journal")
  );
  if (combatView === "table" && !watching) return h("div", { class: "grid" }, h("section", { class: "panel span2" }, h("div", { class: "row gap between" }, title, views)), renderResult(rec), h("section", { class: "panel span2" }, renderReplay(rec, null)));
  return h(
    "div",
    { class: "grid" },
    h(
      "section",
      { class: "panel span2" },
      h("div", { class: "row gap between" }, title, views),
      watching ? h("p", { class: "meta" }, "Le combat se joue sous vos yeux : il faut le regarder jusqu\u2019au bout pour continuer. Vous pouvez l\u2019acc\xE9l\xE9rer.") : null,
      h(
        "div",
        { class: "pixel-view" },
        h("div", { class: "pixel-frame" }, h("canvas", { id: "pixel", role: "img", "aria-label": "Combat en pixel art : votre escouade \xE0 gauche, les monstres \xE0 droite, ligne de front au milieu" })),
        h(
          "div",
          { class: "player" },
          h(
            "div",
            { class: "row gap-s" },
            h("button", { class: "icon", "aria-label": "Recommencer", title: "Recommencer", onclick: () => px?.restart() }, "\u23EE"),
            h("button", { class: "icon play", id: "pxplay", "aria-label": "Pause", onclick: () => px?.toggle() }, "\u23F8"),
            select("pxspeed", String(pxSpeed), [["10", "lent"], ["25", "normal"], ["50", "rapide x2"], ["100", "tr\xE8s rapide x4"]], (v) => {
              pxSpeed = Number(v);
              store.set("proto.ville.pxspeed", pxSpeed);
              px?.setSpeed(pxSpeed);
            })
          ),
          watching ? h("progress", { id: "pxprog", max: end, value: 0, "aria-label": "Avancement du combat" }) : h("input", { id: "pxscrub", type: "range", min: 0, max: end, value: 0, "aria-label": "Instant du combat", oninput: (e) => px?.seek(Number(e.target.value)) }),
          h("div", { class: "clock" }, h("span", { id: "pxclock" }, "instant 0"), h("span", { class: "dim" }, ` / ${end}`))
        ),
        h(
          "div",
          { class: "legend" },
          h("span", {}, h("i", { style: "background:#58d068" }), "PV"),
          h("span", {}, h("i", { style: "background:#4a9cf0" }), "mana"),
          h("span", {}, "Points \xE0 droite d\u2019une unit\xE9 : ses \xE9tats \xB7 \xAB ? \xBB d\xE9sob\xE9it \xB7 \xAB !! \xBB panique \xB7 \xAB ... \xBB attend \xB7 sous chaque camp : rang r\xE9el > rang compt\xE9"),
          h("span", {}, rec.input.units.map((u2) => h("span", { class: `roster who-${u2.side ? "b" : "a"}` }, `${u2.id} ${u2.name}`)))
        )
      ),
      watching ? h(
        "div",
        { id: "watchdone", class: "row gap watch-done", hidden: true },
        h("b", { class: rec.won ? "good" : "bad" }, rec.won ? "Victoire !" : "D\xE9faite : repli forc\xE9 vers la ville."),
        rec.manaBack?.length ? h("span", { class: "meta" }, `Mana r\xE9cup\xE9r\xE9 (+${ECO.manaRegenEnd} %) : `, rec.manaBack.map(([n, d]) => `${n} +${d}`).join(", ")) : null,
        h("button", { class: "primary", onclick: () => {
          endWatch(g);
          save();
          go(g.where === "territoire" ? "expedition" : "ville");
        } }, "Continuer")
      ) : null
    ),
    watching ? null : renderResult(rec)
  );
}
function mountCombat() {
  const canvas = document.getElementById("pixel");
  if (!canvas || !g.last) return;
  const rec = g.last;
  const end = rec.log[rec.log.length - 1].t;
  const clockEl = document.getElementById("pxclock"), btn = document.getElementById("pxplay");
  let shown = -1, was = null;
  px = mountPixel(canvas, rec.input, rec.log, {
    onIndex() {
    },
    onClock(t, playing) {
      if (t !== shown) {
        shown = t;
        clockEl.textContent = `instant ${t}`;
        const sc = document.getElementById("pxscrub");
        if (sc && document.activeElement !== sc) sc.value = String(t);
        const pr = document.getElementById("pxprog");
        if (pr) pr.value = t;
        if (t >= end) {
          const d = document.getElementById("watchdone");
          if (d && d.hidden) {
            d.hidden = false;
            d.querySelector("button")?.focus();
          }
        }
      }
      if (playing !== was) {
        was = playing;
        btn.textContent = playing ? "\u23F8" : "\u25B6";
        btn.setAttribute("aria-label", playing ? "Pause" : "Lecture");
      }
    }
  }, rec.region ?? 0);
  px.setSpeed(pxSpeed);
  px.play();
}
registerLooks(Object.fromEntries(Object.entries(C.troops).map(([id, d]) => {
  const st = computeStats(d, d.forms[0].id, 10);
  return [id, { tags: d.tags, pop: d.pop, units: d.units, caster: st.manaMax > 0 && C.weapons[d.weapon]?.type !== "tranchant" && /baton|sceptre|os|spectral/.test(d.weapon), weapon: d.weapon, ranged: d.defaultDist >= 3 }];
})));
var lab = {
  mon: { lmin: 3, lmax: 4, pmin: 3, pmax: 5, pool: ["gobelins", "frondeurs_gob", "loup_gris", "araignee", "chaman", "troll"], region: -1, forced: "", seed: 1 },
  item: { base: "lame_1", n: 12, seed: 1 },
  rec: { out: "lame_1", seeds: "1, 2, 3" },
  sim: null
};
function renderLabo() {
  const m2 = lab.mon;
  const spec = { level: [m2.lmin, Math.max(m2.lmin, m2.lmax)], pop: [m2.pmin, Math.max(m2.pmin, m2.pmax)], pool: m2.pool, forced: m2.forced ? [m2.forced] : [] };
  const group = genMonsters(C, spec, m2.seed);
  const r = new Rng(hash(lab.item.seed, "labo"));
  const items = Array.from({ length: lab.item.n }, () => genEquip(lab.item.base, r)).sort((a, b) => b.roll - a.roll);
  const seeds = lab.rec.seeds.split(/[ ,;]+/).map(Number).filter((n) => Number.isFinite(n)).slice(0, 6);
  const numIn = (v, min, max, set) => h("input", { type: "number", class: "num", value: v, min, max, onchange: (e) => {
    set(Math.max(min, Math.min(max, Number(e.target.value) | 0)));
    lab.sim = null;
    render();
  } });
  return h(
    "div",
    { class: "grid" },
    h("section", { class: "panel span2" }, h("h2", {}, "Labo des g\xE9n\xE9rateurs"), h("p", { class: "meta" }, "Les trois g\xE9n\xE9rateurs du jeu, r\xE9glables \xE0 la main. Ils sont d\xE9terministes : m\xEAme graine, m\xEAme r\xE9sultat. Rien ici ne touche \xE0 la partie, sauf la simulation qui utilise une copie de votre escouade.")),
    h(
      "section",
      { class: "panel span2" },
      h("h3", {}, "Troupes de monstres"),
      h("p", { class: "meta" }, "Le g\xE9n\xE9rateur d\xE9pense un budget de population (5 emplacements au plus) : d\u2019abord les monstres impos\xE9s, puis des tirages dans le pool. Ce qui reste du budget devient du niveau."),
      h(
        "div",
        { class: "row gap" },
        h("label", { class: "field" }, "Niveau min", numIn(m2.lmin, 1, 30, (n) => m2.lmin = n)),
        h("label", { class: "field" }, "Niveau max", numIn(m2.lmax, 1, 30, (n) => m2.lmax = n)),
        h("label", { class: "field" }, "Population min", numIn(m2.pmin, 1, 12, (n) => m2.pmin = n)),
        h("label", { class: "field" }, "Population max", numIn(m2.pmax, 1, 12, (n) => m2.pmax = n)),
        h("label", { class: "field" }, "Impos\xE9", select("forced", m2.forced, [["", "aucun"], ...Object.keys(MONSTERS).map((k) => [k, MONSTERS[k].name])], (v) => {
          m2.forced = v;
          lab.sim = null;
          render();
        })),
        h("label", { class: "field" }, "Graine", numIn(m2.seed, 0, 2 ** 31, (n) => m2.seed = n)),
        h("button", { onclick: () => {
          m2.seed = randomSeed();
          lab.sim = null;
          render();
        } }, "Nouvelle graine")
      ),
      h("div", { class: "row gap" }, select("lreg", String(m2.region), [["-1", "Monstres : toutes r\xE9gions"], ...REGIONS.map((r2, i) => [String(i), `Monstres : ${r2.territory.name}`])], (v) => {
        m2.region = Number(v);
        render();
      })),
      h("div", { class: "chips" }, Object.entries(MONSTERS).filter(([, d]) => !d.boss && (m2.region < 0 || d.region === m2.region)).map(([k, d]) => h("button", { class: `chip ${m2.pool.includes(k) ? "on" : ""}`, onclick: () => {
        m2.pool = m2.pool.includes(k) ? m2.pool.filter((x) => x !== k) : [...m2.pool, k];
        lab.sim = null;
        render();
      } }, `${d.name} \xB7 ${d.pop} pop.`))),
      groupView(group),
      h("p", { class: "meta" }, `Puissance ${groupPower(C, group)} \xB7 XP de base ${group.troops.reduce((a, t) => a + t.level * C.troops[t.type].pop * ECO.xpPerMonsterLevelPop, 0)}`),
      h(
        "div",
        { class: "row gap" },
        h("button", { disabled: !squad(g).length, onclick: () => {
          lab.sim = simulate(spec);
          render();
        } }, "Simuler 100 groupes contre mon escouade"),
        lab.sim ? h("span", {}, `Victoires ${lab.sim.w} / ${lab.sim.n} \xB7 ${(lab.sim.deaths / lab.sim.n).toFixed(1)} unit\xE9(s) perdue(s) par combat en moyenne (escouade \xE0 pleine vie)`) : null
      )
    ),
    h(
      "section",
      { class: "panel" },
      h("h3", {}, "Objets"),
      h("p", { class: "meta" }, "N stats tir\xE9es dans le pool de la base, jet de puissance 60-140 % (moyenne de deux tirages), au moins 15 % du budget par stat."),
      h(
        "div",
        { class: "row gap" },
        select("lbase", lab.item.base, Object.values(EQUIP).map((b) => [b.id, `${b.name} (p${b.tier})`]), (v) => {
          lab.item.base = v;
          render();
        }),
        h("button", { onclick: () => {
          lab.item.seed = randomSeed();
          render();
        } }, "Retirer 12 exemplaires")
      ),
      h("div", { class: "eqs" }, items.map((it) => equipCard(it)))
    ),
    h(
      "section",
      { class: "panel" },
      h("h3", {}, "Recettes personnelles"),
      h("p", { class: "meta" }, "La m\xEAme recette pour plusieurs joueurs (graines). Votre graine de joueur : ", h("b", {}, g.seed), "."),
      h(
        "div",
        { class: "row gap" },
        select("lrec", lab.rec.out, Object.values(g.recipes).map((r2) => [r2.out, `${itemName(r2.out)}${r2.kind === "recrue" ? " (recrue)" : ""}`]), (v) => {
          lab.rec.out = v;
          render();
        }),
        h("label", { class: "field inline" }, "Joueurs", h("input", { value: lab.rec.seeds, class: "wide-text", onchange: (e) => {
          lab.rec.seeds = e.target.value;
          render();
        } }))
      ),
      h(
        "table",
        {},
        h("thead", {}, h("tr", {}, h("th", {}, "Joueur"), h("th", {}, "Ingr\xE9dients"), h("th", {}, "Valeur"), h("th", {}, "Inutiles pour lui"))),
        h("tbody", {}, seeds.map((sd) => {
          const rec = genRecipes(C, sd)[lab.rec.out];
          return h("tr", {}, h("td", {}, sd), h("td", { class: "wrap" }, rec.ingredients.map(([id, q]) => `${q} ${itemName(id)}`).join(" + "), rec.gold ? ` + ${rec.gold} or` : ""), h("td", {}, rec.budget), h("td", { class: "wrap" }, tradeOnly(sd).map(itemName).join(", ")));
        }))
      )
    )
  );
}
function simulate(spec) {
  const copy = JSON.parse(JSON.stringify(g));
  copy.troops.forEach((t) => t.units.forEach((u2) => {
    const s3 = unitStats(t, u2);
    u2.hp = s3.hpMax;
    u2.mana = s3.manaMax;
  }));
  let w = 0, deaths = 0;
  const N = 100;
  for (let i = 0; i < N; i++) {
    const seed = hash(lab.mon.seed, "sim", i);
    copy.encounter = { seed, side: genMonsters(C, spec, seed) };
    const { result } = simuler(buildInput(copy), seed);
    if (result.winner === 0) w++;
    deaths += result.units.filter((u2) => u2.id[0] === "A" && u2.dead).length;
  }
  return { w, n: N, deaths };
}
function renderReglages() {
  return h(
    "div",
    { class: "grid" },
    h(
      "section",
      { class: "panel span2" },
      h("h2", {}, "Partie"),
      h("p", {}, `Graine du joueur : `, h("b", {}, g.seed), `. Elle fixe vos recettes personnelles et vos mat\xE9riaux \xAB inutiles \xBB. Combats : ${g.stats.fights} (${g.stats.wins} victoires), unit\xE9s perdues : ${g.stats.deaths}, objets fabriqu\xE9s : ${g.stats.crafts}.`),
      h("p", { class: "meta" }, "La partie est sauvegard\xE9e dans ce navigateur apr\xE8s chaque action."),
      resetAsk ? h(
        "div",
        { class: "row gap confirm" },
        h("span", { class: "bad" }, "La partie en cours sera effac\xE9e."),
        h("label", { class: "field inline" }, "Graine", h("input", { id: "newseed", type: "number", class: "num wide", value: resetSeed, onchange: (e) => {
          resetSeed = Number(e.target.value) | 0;
        } })),
        h("button", { class: "primary", onclick: () => {
          g = newGame(resetSeed);
          lastCrafted = null;
          resetAsk = false;
          save();
          go("ville");
        } }, "Recommencer"),
        h("button", { onclick: () => {
          resetAsk = false;
          render();
        } }, "Annuler")
      ) : h("div", { class: "row gap" }, h("button", { onclick: () => {
        resetAsk = true;
        resetSeed = randomSeed();
        render();
      } }, "Nouvelle partie (nouveau joueur)"))
    ),
    h(
      "section",
      { class: "panel span2 about" },
      h("h3", {}, "Ce que fait ce prototype"),
      h(
        "ul",
        {},
        h("li", {}, "Moteur de combat du banc d\u2019essai, compl\xE9t\xE9 par des effets g\xE9n\xE9riques d\xE9crits par des donn\xE9es (d\xE9g\xE2ts, soins, \xE9tats, d\xE9placements\u2026) pour les 33 nouveaux sorts, et 4 nouveaux \xE9tats : Affaibli, Garde, Silence, \xC9pines. L\u2019\xE9quipement modifie les statistiques d\u2019entr\xE9e des unit\xE9s (spec combat 12.1)."),
        h("li", {}, "5 r\xE9gions de niveau 1 \xE0 27 : une ville et un territoire de 5 \xE9tapes chacune. 40 types de troupes recrutables, 57 types de monstres dont 5 gardiens, 5 paliers d\u2019\xE9quipement. Tout est consultable dans l\u2019onglet Codex."),
        h("li", {}, "Ville : temple (soins gratuits), caserne (recettes de recrutement personnelles, rachat des unit\xE9s manquantes), atelier (recettes personnelles, stats tir\xE9es \xE0 la fabrication), marchand (vend le d\xE9part, rach\xE8te \xE0 20 %), banque de 100 emplacements."),
        h("li", {}, "Territoires : 5 \xE9tapes, monstres g\xE9n\xE9r\xE9s \xE0 l\u2019arriv\xE9e selon le niveau et la population de l\u2019\xE9tape, PV persistants, mana +25 % du maximum \xE0 la fin de chaque combat, sac de 20, butin surtout en mat\xE9riaux, mort permanente, XP r\xE9duite si la troupe d\xE9passe les monstres de plus de 2 niveaux."),
        h("li", {}, "Strat\xE9gie modifiable par troupe (onglet Troupes) : capacit\xE9s actives et r\xE8gles si/alors, comme au banc d\u2019essai."),
        h("li", {}, "Pas encore : \xE9volutions, march\xE9 entre joueurs, main secondaire, r\xE9serve de troupes emmen\xE9e en exp\xE9dition.")
      )
    )
  );
}
function render() {
  renderHeader();
  const main = document.getElementById("main");
  const views = { ville: renderVille, expedition: renderExpedition, troupes: renderTroupes, atelier: renderAtelier, banque: renderBanque, combat: renderCombat, labo: renderLabo, codex: () => renderCodex(C) };
  if (g.watch && g.last) tab = "combat";
  if (tab === "combat" && !g.last) tab = "ville";
  px?.destroy();
  px = null;
  const view = tab === "reglages" ? renderReglages() : views[tab]();
  main.replaceChildren(toastMsg ? h("div", { class: `toast ${toastMsg.bad ? "bad" : ""}`, role: "status" }, toastMsg.text, h("button", { class: "x", "aria-label": "Fermer", onclick: () => {
    toastMsg = null;
    render();
  } }, "\xD7")) : "", view);
  toastMsg = null;
  if (tab === "combat") {
    if (combatView === "pixel" || g.watch) mountCombat();
    else paintReplay();
  }
}
setRerender(render);
setCodexRerender(render);
document.querySelectorAll("[data-tab]").forEach((b) => b.addEventListener("click", () => go(b.dataset.tab)));
render();
})();
