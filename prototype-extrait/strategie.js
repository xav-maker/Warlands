var COND_LABEL = {
  always: "toujours",
  selfHpBelow: "mes PV < %",
  allyHpBelow: "PV d\u2019un alli\xE9 < %",
  selfWillBelow: "ma volont\xE9 < %",
  selfEnergyBelow: "mon \xE9nergie < %",
  selfEnergyAbove: "mon \xE9nergie \u2265 %",
  selfManaBelow: "mon mana < %",
  enemyInRange: "un ennemi \xE0 port\xE9e",
  noEnemyInRange: "aucun ennemi \xE0 port\xE9e",
  myDist: "mon rang =",
  enemiesAtLeast: "ennemis en jeu \u2265",
  timeAtLeast: "instant \u2265",
  selfHasState: "j\u2019ai l\u2019\xE9tat",
  selfLacksState: "je n\u2019ai pas l\u2019\xE9tat",
  targetHasState: "la cible a l\u2019\xE9tat",
  targetLacksState: "la cible n\u2019a pas l\u2019\xE9tat"
};
var COND_NUM = {
  selfHpBelow: [0, 100, 50],
  allyHpBelow: [0, 100, 50],
  selfWillBelow: [0, 100, 50],
  selfEnergyBelow: [0, 100, 20],
  selfEnergyAbove: [0, 100, 50],
  selfManaBelow: [0, 100, 30],
  myDist: [1, 3, 1],
  enemiesAtLeast: [1, 15, 2],
  timeAtLeast: [0, 2e3, 200]
};
var COND_STATE = /* @__PURE__ */ new Set(["selfHasState", "selfLacksState", "targetHasState", "targetLacksState"]);
var TARGET_LABEL = {
  self: "soi",
  nearestEnemy: "l\u2019ennemi le plus proche",
  weakestEnemy: "l\u2019ennemi le plus faible",
  strongestEnemy: "l\u2019ennemi le plus fort",
  lowestWillEnemy: "l\u2019ennemi le moins volontaire",
  randomEnemy: "un ennemi au hasard",
  mostWoundedAlly: "l\u2019alli\xE9 le plus bless\xE9"
};
var COMMON2 = [["avancer", "Avancer"], ["reculer", "Reculer"], ["attendre", "Attendre"], ["fuir", "Fuir"]];
var skillName = (id) => COMMON2.find((c) => c[0] === id)?.[1] ?? C.skills[id]?.name ?? id;
var targetKind = (a) => C.skills[a]?.target ?? "self";
function targetsFor(a) {
  const k = targetKind(a);
  if (k === "self") return ["self"];
  if (k === "ally") return ["mostWoundedAlly", "self"];
  return ["nearestEnemy", "weakestEnemy", "strongestEnemy", "lowestWillEnemy", "randomEnemy"];
}
function own(t) {
  if (!t.strat) t.strat = { active: troopActive(t), rules: troopRules(t) };
  return t.strat;
}
function renderStrategy(t, done) {
  const d = troopDef(t);
  const known = learned(d, t.form, t.level);
  const base = basicAttack(d);
  const active = troopActive(t);
  const rules = t.strat ? t.strat.rules : troopRules(t);
  const actions = [...active.filter((a) => C.skills[a]?.kind === "active").map((a) => [a, C.skills[a].name]), ...COMMON2];
  const states = Object.entries(STATE_NAMES);
  const edit = (fn) => {
    fn(own(t));
    done();
  };
  const num = (id2, v, min, max, set) => h("input", { id: id2, type: "number", class: "num small", value: v, min, max, inputmode: "numeric", onchange: (e) => set(Math.max(min, Math.min(max, Math.round(Number(e.target.value) || 0)))) });
  const id = `st-${t.uid}`;
  return h(
    "details",
    { class: "rules", open: openSet.has(t.uid), ontoggle: (e) => {
      e.target.open ? openSet.add(t.uid) : openSet.delete(t.uid);
    } },
    h("summary", {}, "Strat\xE9gie", h("span", { class: "meta" }, t.strat ? " \xB7 personnalis\xE9e" : " \xB7 par d\xE9faut", ` \xB7 ${active.length}/6 capacit\xE9s actives`)),
    h("p", { class: "meta small" }, "\xC0 chaque action, l\u2019unit\xE9 joue la premi\xE8re r\xE8gle applicable. Une capacit\xE9 doit \xEAtre active pour servir dans une r\xE8gle. Une r\xE8gle de sort \xE0 mana est saut\xE9e si le mana manque."),
    h("div", { class: "chips" }, known.map((k) => {
      const sk = C.skills[k];
      const isBase = k === base;
      const on = isBase || active.includes(k);
      return h("button", {
        class: "chip" + (on ? " on" : "") + (sk.kind !== "active" ? " passive" : ""),
        "aria-pressed": String(on),
        title: `${isBase ? "Attaque de base, toujours active. " : ""}${sk.desc ?? ""}`,
        disabled: isBase || !on && active.length >= 6,
        onclick: () => edit((s3) => {
          s3.active = on ? active.filter((x) => x !== k) : known.filter((x) => x === k || active.includes(x));
        })
      }, sk.name, isBase ? h("small", {}, " base") : null, sk.mana ? h("small", {}, ` ${sk.mana} mana`) : sk.energy ? h("small", {}, ` ${sk.energy} \xE9n.`) : null);
    })),
    (() => {
      const later = (d.forms.find((f) => f.id === t.form) ?? d.forms[0]).skills.filter(([k, lv]) => lv > t.level && !known.includes(k));
      return later.length ? h("p", { class: "meta small" }, "\xC0 venir : ", later.map(([k, lv]) => `${C.skills[k]?.name ?? k} (niv. ${lv})`).join(", ")) : null;
    })(),
    h("ol", {}, rules.map((r, ri) => {
      const inactive = !COMMON2.some((c) => c[0] === r.action) && !active.includes(r.action);
      const rid = `${id}-r${ri}`;
      const opts = inactive ? [[r.action, `${skillName(r.action)} (inactive)`], ...actions] : actions;
      return h(
        "li",
        { class: "rule" + (inactive ? " inactive" : "") },
        h("span", { class: "kw" }, "si"),
        select(`${rid}-c`, r.cond, Object.keys(COND_LABEL).map((k) => [k, COND_LABEL[k]]), (v) => edit((s3) => {
          const x = s3.rules[ri];
          x.cond = v;
          const n = COND_NUM[x.cond];
          x.v = n ? n[2] : void 0;
          x.s = COND_STATE.has(x.cond) ? x.s ?? "brulure" : void 0;
        })),
        COND_NUM[r.cond] ? num(`${rid}-v`, r.v ?? COND_NUM[r.cond][2], COND_NUM[r.cond][0], COND_NUM[r.cond][1], (v) => edit((s3) => {
          s3.rules[ri].v = v;
        })) : null,
        COND_STATE.has(r.cond) ? select(`${rid}-s`, r.s ?? "brulure", states, (v) => edit((s3) => {
          s3.rules[ri].s = v;
        })) : null,
        h("span", { class: "kw" }, "alors"),
        select(`${rid}-a`, r.action, opts, (v) => edit((s3) => {
          const x = s3.rules[ri];
          x.action = v;
          if (!targetsFor(v).includes(x.target)) x.target = targetsFor(v)[0];
        })),
        targetKind(r.action) === "self" ? null : h("span", { class: "kw" }, "sur"),
        targetKind(r.action) === "self" ? null : select(`${rid}-t`, r.target, targetsFor(r.action).map((x) => [x, TARGET_LABEL[x]]), (v) => edit((s3) => {
          s3.rules[ri].target = v;
        })),
        h(
          "span",
          { class: "rule-tools" },
          h("button", { class: "icon", "aria-label": "Monter la r\xE8gle", disabled: ri === 0, onclick: () => edit((s3) => {
            [s3.rules[ri - 1], s3.rules[ri]] = [s3.rules[ri], s3.rules[ri - 1]];
          }) }, "\u2191"),
          h("button", { class: "icon", "aria-label": "Descendre la r\xE8gle", disabled: ri === rules.length - 1, onclick: () => edit((s3) => {
            [s3.rules[ri + 1], s3.rules[ri]] = [s3.rules[ri], s3.rules[ri + 1]];
          }) }, "\u2193"),
          h("button", { class: "icon", "aria-label": "Supprimer la r\xE8gle", onclick: () => edit((s3) => {
            s3.rules.splice(ri, 1);
          }) }, "\u2715")
        ),
        inactive ? h("span", { class: "note" }, "capacit\xE9 non active : r\xE8gle ignor\xE9e") : null
      );
    })),
    h(
      "div",
      { class: "row gap-s" },
      h("button", { class: "small", onclick: () => edit((s3) => {
        const a = actions[0]?.[0] ?? "attendre";
        s3.rules.push({ cond: "always", action: a, target: targetsFor(a)[0] });
      }) }, "Ajouter une r\xE8gle"),
      t.strat ? h("button", { class: "small", onclick: () => {
        delete t.strat;
        done();
      } }, "Revenir \xE0 la strat\xE9gie par d\xE9faut") : null
    )
  );
}
var openSet = /* @__PURE__ */ new Set();

