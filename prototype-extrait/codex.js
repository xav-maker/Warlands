var part = "regions";
var rerender = () => {
};
var PARTS = [["regions", "R\xE9gions"], ["unites", "Unit\xE9s"], ["monstres", "Monstres"], ["sorts", "Sorts"], ["objets", "Objets"]];
function troopRow(C2, id, level, extra) {
  const d = C2.troops[id];
  const f = d.forms[0];
  const s3 = computeStats(d, f.id, level);
  const skills = learned(d, f.id, Math.max(level, 30)).map((k) => C2.skills[k]?.name ?? k);
  return h(
    "div",
    { class: "cx" },
    h("div", { class: "cx-head" }, h("b", {}, d.name), h("span", { class: "dim small" }, ` ${extra}`)),
    h("div", { class: "meta small" }, `${d.role} \xB7 ${d.pop} pop.${d.units > 1 ? ` \xB7 ${d.units} unit\xE9s` : ""} \xB7 ${d.tags.join(", ")}`),
    h("div", { class: "meta small" }, `Niv. ${level} : PV ${s3.hpMax}, att. ${s3.atk}, vol. ${s3.willMax}, \xE9ner. ${s3.energyMax}${s3.manaMax ? `, mana ${s3.manaMax}` : ""}, vit. ${s3.speed} \xB7 ${C2.weapons[d.weapon]?.name ?? d.weapon}`),
    h("div", { class: "small" }, skills.join(", "))
  );
}
function renderCodex(C2) {
  const nav = h("div", { class: "row gap-s codex-nav", role: "tablist" }, PARTS.map(([p, l]) => h("button", { class: part === p ? "primary" : "", "aria-selected": String(part === p), onclick: () => {
    part = p;
    rerender();
  } }, l)));
  let body;
  if (part === "regions") {
    body = h("div", { class: "grid" }, REGIONS.map((r, i) => h(
      "section",
      { class: "panel span2" },
      h("h3", {}, `${i + 1}. ${r.name}`, h("span", { class: "dim small" }, ` \xB7 palier ${r.tier} \xB7 niveaux ${r.minLevel}-${r.minLevel + 6 + MONSTER_LEVEL_BONUS}`)),
      h("p", {}, h("b", {}, r.city.name), ` : ${r.city.desc}`),
      h("p", { class: "meta small" }, "Recrute : ", r.city.recruit.map((t) => C2.troops[t].name).join(", ")),
      h("p", {}, h("b", {}, r.territory.name), ` : ${r.territory.desc}`),
      h("ol", { class: "cx-steps" }, r.territory.steps.map((st) => h(
        "li",
        {},
        h("b", {}, st.name),
        ` \xB7 niv. ${st.level[0]}-${st.level[1]} \xB7 `,
        h("span", { class: "dim" }, (st.forced ?? []).concat(st.pool).map((m2) => C2.troops[m2]?.name ?? m2).join(", ")),
        rareOfStep(st.id) ? h("div", { class: "meta small" }, `Monstre rare (${RARE_CHANCE} % des rencontres) : ${rareOfStep(st.id).name}, laisse ${ITEMS[rareOfStep(st.id).trophy].name}.`) : null,
        h("div", { class: "meta small" }, "Mat\xE9riaux : ", st.mats.map((m2) => ITEMS[m2]?.name ?? m2).join(", "))
      ))),
      h("p", { class: "meta small" }, `Gardien : premi\xE8re victoire = ${ITEMS[r.firstItem]?.name}, butin r\xE9serv\xE9 : ${EQUIP[r.guardianLoot]?.name}.`)
    )));
  } else if (part === "unites") {
    const ids = Object.keys(C2.troops).filter((id) => recruitRegion(id) >= 0).sort((a, b) => recruitRegion(a) - recruitRegion(b));
    body = h("div", {}, REGIONS.map((r, i) => h(
      "section",
      { class: "panel" },
      h("h3", {}, r.city.name, h("span", { class: "dim small" }, ` \xB7 arriv\xE9e niv. ${r.minLevel}`)),
      h("div", { class: "cxs" }, ids.filter((id) => recruitRegion(id) === i).map((id) => troopRow(C2, id, r.minLevel, "")))
    )));
  } else if (part === "monstres") {
    body = h("div", {}, REGIONS.map((r, i) => h(
      "section",
      { class: "panel" },
      h("h3", {}, r.territory.name),
      h("div", { class: "cxs" }, Object.entries(MONSTERS).filter(([, m2]) => m2.region === i).sort(([, a], [, b]) => Number(!!a.boss) - Number(!!b.boss) || Number(!!a.rare) - Number(!!b.rare)).map(([id, m2]) => troopRow(C2, id, r.minLevel + (m2.boss ? 5 : 2), m2.boss ? "\xB7 gardien" : m2.rare ? `\xB7 rare, laisse ${ITEMS[m2.rare.trophy].name}` : "")))
    )));
  } else if (part === "sorts") {
    const all = Object.entries(C2.skills).filter(([, s3]) => s3.kind === "active" && s3.desc);
    const users = (k) => Object.entries(C2.troops).filter(([, d]) => learned(d, d.forms[0].id, 30).includes(k)).map(([, d]) => d.name);
    body = h(
      "section",
      { class: "panel" },
      h("p", { class: "meta" }, `${all.length} capacit\xE9s actives, dont ${Object.keys(NEW_SKILLS).length} ajout\xE9es (marqu\xE9es \u2726).`),
      h("div", { class: "cxs" }, all.sort(([a], [b]) => Number(!(a in NEW_SKILLS)) - Number(!(b in NEW_SKILLS))).map(([k, s3]) => {
        const u2 = users(k);
        return h(
          "div",
          { class: "cx" },
          h(
            "div",
            { class: "cx-head" },
            h("b", {}, k in NEW_SKILLS ? "\u2726 " : "", s3.name),
            h("span", { class: "dim small" }, ` \xB7 port\xE9e ${s3.range}${s3.mana ? ` \xB7 ${s3.mana} mana` : ""}${s3.energy ? ` \xB7 ${s3.energy} \xE9nergie` : ""}`)
          ),
          h("div", { class: "small" }, s3.desc),
          u2.length ? h("div", { class: "meta small" }, u2.slice(0, 8).join(", "), u2.length > 8 ? ` +${u2.length - 8}` : "") : null
        );
      }))
    );
  } else {
    const kinds = [["materiau", "Mat\xE9riaux"], ["composant", "Composants"], ["consommable", "Consommables"], ["trophee", "Troph\xE9es de monstres rares"]];
    body = h(
      "div",
      {},
      kinds.map(([k, l]) => h(
        "section",
        { class: "panel" },
        h("h3", {}, l),
        h("div", { class: "cxs" }, Object.values(ITEMS).filter((i) => i.kind === k).sort((a, b) => a.tier - b.tier).map((i) => h("div", { class: "cx" }, h("div", { class: "cx-head" }, h("b", {}, i.name), h("span", { class: "dim small" }, ` \xB7 palier ${i.tier} \xB7 valeur ${i.value}`)), i.desc ? h("div", { class: "small" }, i.desc) : null)))
      )),
      h(
        "section",
        { class: "panel" },
        h("h3", {}, "\xC9quipement"),
        h("div", { class: "cxs" }, Object.values(EQUIP).sort((a, b) => a.tier - b.tier || a.slot.localeCompare(b.slot)).map((b) => h(
          "div",
          { class: "cx" },
          h("div", { class: "cx-head" }, h("b", {}, b.name), h("span", { class: "dim small" }, ` \xB7 palier ${b.tier} \xB7 niv. ${TIER_LEVEL[b.tier]}+`)),
          h("div", { class: "meta small" }, `${b.slot}, ${b.cat.replace("_", " ")}${b.weapon ? ` \xB7 ${TYPE_FR[b.weapon.type]} ${b.weapon.dmg}, vitesse ${b.weapon.speed}` : ""}${b.craft === false ? " \xB7 butin de gardien" : b.workshop ? " \xB7 atelier r\xE9gional" : ""}`)
        )))
      )
    );
  }
  return h("div", {}, h("section", { class: "panel" }, h("h2", {}, "Codex"), nav), body);
}
function setCodexRerender(fn) {
  rerender = fn;
}

