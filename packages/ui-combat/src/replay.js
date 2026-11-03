// Vue tableau et journal des combats : copie de prototype-extrait/replay.js (proto-0.4-ville) (guide 4.1).
// Raccords, seuls changements : imports de h/select et des noms du moteur ; noms des capacités fournis par
// setSkillNames (au lieu de la globale C du prototype) ; exports en fin de fichier.
/* eslint-disable */
import { h, select } from './dom.js';
import { DMG_TYPES, STATE_NAMES } from '@cr/engine';
var COMMON3 = [["avancer", "Avancer"], ["reculer", "Reculer"], ["attendre", "Attendre"], ["fuir", "Fuir"]];
var TYPE_LABEL = {
  contondant: "contondant",
  tranchant: "tranchant",
  maladie: "maladie",
  psychique: "psychique",
  feu: "feu",
  glace: "glace",
  tenebres: "t\xE9n\xE8bres",
  sacre: "sacr\xE9"
};
var SKILL_NAMES = {};
function setSkillNames(m) {
  SKILL_NAMES = m;
}
var skillName2 = (id) => COMMON3.find((c) => c[0] === id)?.[1] ?? SKILL_NAMES[id] ?? id;
var battle = null;
var rp = { i: 0, playing: false, speed: 2, timer: 0, detailed: false };
var rerender2 = () => {
};
function setRerender(f) {
  rerender2 = f;
}
function stopReplay() {
  stop();
}
function viewAt(upTo) {
  const units = /* @__PURE__ */ new Map();
  let t = 0;
  if (!battle) return { units, t };
  for (let i = 0; i <= upTo && i < battle.log.length; i++) {
    const e = battle.log[i];
    t = e.t;
    switch (e.k) {
      case "start":
        for (const u2 of e.units) units.set(u2.id, { u: u2, hp: u2.hp, will: u2.willMax, energy: u2.energyMax, mana: u2.mana, dist: u2.dist, states: /* @__PURE__ */ new Map(), dead: u2.hp <= 0, fled: false });
        break;
      case "gauge":
        units.get(e.u)[e.g] = e.to;
        break;
      case "move":
        units.get(e.u).dist = e.to;
        break;
      case "state": {
        const v = units.get(e.u);
        if (e.op === "end") v.states.delete(e.s);
        else if (e.op !== "immune") v.states.set(e.s, { charges: e.charges ?? 1, until: e.until ?? 0 });
        break;
      }
      case "death": {
        const v = units.get(e.u);
        v.dead = true;
        v.states.clear();
        break;
      }
      case "flee":
        units.get(e.u).fled = true;
        break;
    }
  }
  return { units, t };
}
var nameOf = (id) => id && battle ? battle.input.units.find((u2) => u2.id === id)?.name ?? id : "?";
var tagOf = (id) => id ? id[0] === "A" ? "A" : "B" : "";
function who(id) {
  return h("span", { class: `who who-${tagOf(id).toLowerCase()}` }, nameOf(id));
}
function evLine(e) {
  const d = rp.detailed;
  switch (e.k) {
    case "start":
      return h("span", {}, "D\xE9but du combat");
    case "act":
      return h("span", {}, who(e.u), " \xB7 ", h("b", {}, skillName2(e.skill)), e.target && e.target !== e.u ? [" \u2192 ", who(e.target)] : "", e.rule < 0 ? h("span", { class: "dim" }, " automatique : combat bloqu\xE9") : h("span", { class: "dim" }, ` r\xE8gle ${e.rule + 1}`));
    case "wait":
      return e.why === "choice" ? null : h("span", {}, who(e.u), e.why === "energy" ? " attend : pas assez d\u2019\xE9nergie" : " attend : aucune r\xE8gle applicable");
    case "frozen":
      return h("span", {}, who(e.u), ` est gel\xE9 jusqu\u2019\xE0 l\u2019instant ${e.until}`);
    case "will":
      if (e.res === "ok" && !d) return null;
      return h(
        "span",
        { class: e.res !== "ok" ? "bad" : "" },
        who(e.u),
        e.forced ? " est confus : demi-\xE9chec forc\xE9" : e.res === "ok" ? ` ob\xE9it (volont\xE9 ${Math.floor(e.pct / 10)} %)` : e.res === "half" ? ` d\xE9sob\xE9it : demi-\xE9chec (volont\xE9 ${Math.floor(e.pct / 10)} %)` : ` panique : \xE9chec critique (volont\xE9 ${Math.floor(e.pct / 10)} %)`
      );
    case "move":
      return h("span", {}, who(e.u), ` passe du rang ${e.from} au rang ${e.to}`, h("span", { class: "dim" }, ` (${e.cause})`));
    case "hit":
      return h(
        "span",
        {},
        who(e.u),
        " subit ",
        h("b", { class: "dmg" }, String(e.final)),
        ` ${TYPE_LABEL[e.type]}`,
        e.absorbed ? ` (${e.absorbed} absorb\xE9s)` : "",
        h("span", { class: "dim" }, ` \xB7 ${e.cause}${d ? `, brut ${e.raw}` : ""}`)
      );
    case "gauge":
      if (e.g === "hp" && e.to > e.from) return h("span", {}, who(e.u), " ", h("b", { class: "heal" }, `+${e.to - e.from} PV`), h("span", { class: "dim" }, ` \xB7 ${e.cause}`));
      if (e.g === "will" && (d || e.cause !== "blessure")) return h("span", {}, who(e.u), ` volont\xE9 ${e.from} \u2192 ${e.to}`, h("span", { class: "dim" }, ` \xB7 ${e.cause}`));
      if (d) return h("span", { class: "dim" }, nameOf(e.u), ` ${e.g === "energy" ? "\xE9nergie" : e.g === "mana" ? "mana" : e.g === "hp" ? "PV" : "volont\xE9"} ${e.from} \u2192 ${e.to} \xB7 ${e.cause}`);
      return null;
    case "state": {
      const n = STATE_NAMES[e.s] ?? e.s;
      if (e.op === "end") return d || e.s !== "etourdi" ? h("span", { class: "dim" }, `${n} se termine sur `, who(e.u)) : null;
      if (e.op === "immune") return h("span", {}, who(e.u), ` est insensible : ${n}`);
      return h("span", {}, who(e.u), " ", h("span", { class: "st" }, n), (e.charges ?? 1) > 1 ? ` \xD7${e.charges}` : "", e.op === "renew" ? " renouvel\xE9" : "", h("span", { class: "dim" }, ` jusqu\u2019\xE0 ${e.until}`));
    }
    case "tick":
      return d ? h("span", { class: "dim" }, "tic") : null;
    case "passive":
      return h("span", {}, who(e.u), " \xB7 ", h("b", {}, e.name), ` : ${e.text}`);
    case "lost":
      return h("span", { class: "dim" }, nameOf(e.u), ` : action perdue, ${e.why}`);
    case "death":
      return h("span", { class: "bad" }, who(e.u), " meurt", e.by && e.by !== e.u ? [" (", who(e.by), ")"] : "");
    case "flee":
      return h("span", {}, who(e.u), " s\u2019enfuit");
    case "end":
      return h("b", {}, resultText(e.winner, e.reason));
  }
}
function resultText(w, reason) {
  if (reason === "timeout") return "Dur\xE9e limite atteinte : d\xE9faite";
  return w === null ? "Aucun survivant" : w === 0 ? "Victoire" : "D\xE9faite";
}
var DELAY = { act: 520, hit: 260, death: 700, move: 300, state: 160, passive: 300, will: 200, end: 0, wait: 220, frozen: 200, lost: 200, flee: 500 };
function renderReplay(rec, title = null) {
  if (battle !== rec) {
    stop();
    battle = rec;
    rp.i = 0;
  }
  const b = battle;
  return h(
    "div",
    { class: "combat" },
    h(
      "div",
      { class: "toolbar" },
      title,
      h("span", { class: `result r-${b.result.winner === 0 ? "a" : "b"}` }, resultText(b.result.winner, b.result.reason), ` \xB7 instant ${b.result.time}`)
    ),
    h(
      "div",
      { class: "arena-wrap" },
      h(
        "div",
        { class: "arena", id: "arena" },
        [3, 2, 1].map((r) => h("div", { class: "lane lane-a", "data-rank": r }, h("div", { class: "lane-label", id: `label-A-${r}` }, `A \xB7 rang ${r}`), h("div", { class: "lane-units", id: `lane-A-${r}` }))),
        h("div", { class: "front", "aria-hidden": "true" }),
        [1, 2, 3].map((r) => h("div", { class: "lane lane-b", "data-rank": r }, h("div", { class: "lane-label", id: `label-B-${r}` }, `B \xB7 rang ${r}`), h("div", { class: "lane-units", id: `lane-B-${r}` })))
      )
    ),
    h(
      "div",
      { class: "player" },
      h(
        "div",
        { class: "row gap-s" },
        h("button", { class: "icon", "aria-label": "D\xE9but", title: "D\xE9but", onclick: () => {
          stop();
          rp.i = 0;
          paintReplay();
        } }, "\u23EE"),
        h("button", { class: "icon", "aria-label": "\xC9v\xE9nement pr\xE9c\xE9dent", title: "Pr\xE9c\xE9dent", onclick: () => {
          stop();
          stepVisible(-1);
        } }, "\u25C0"),
        h("button", { class: "icon play", id: "playbtn", "aria-label": "Lecture", onclick: () => rp.playing ? stop() : play() }, "\u25B6"),
        h("button", { class: "icon", "aria-label": "\xC9v\xE9nement suivant", title: "Suivant", onclick: () => {
          stop();
          stepVisible(1);
        } }, "\u25B6|"),
        h("button", { class: "icon", "aria-label": "Fin", title: "Fin", onclick: () => {
          stop();
          rp.i = b.log.length - 1;
          paintReplay();
        } }, "\u23ED"),
        select("speed", String(rp.speed), [["1", "x1"], ["2", "x2"], ["4", "x4"], ["8", "x8"], ["32", "x32"]], (v) => {
          rp.speed = Number(v);
        })
      ),
      h("input", {
        id: "scrub",
        type: "range",
        min: 0,
        max: b.log.length - 1,
        value: rp.i,
        "aria-label": "Position dans le combat",
        oninput: (e) => {
          stop();
          rp.i = Number(e.target.value);
          paintReplay();
        }
      }),
      h("div", { class: "clock" }, h("span", { id: "clock" }, ""), h("span", { class: "dim" }, ` / ${b.input.params.timeLimit} instants`))
    ),
    h("div", { class: "now", id: "now", "aria-live": "polite" }),
    h(
      "div",
      { class: "legend" },
      [["hp", "PV"], ["will", "volont\xE9"], ["energy", "\xE9nergie"], ["mana", "mana"]].map(([g2, l]) => h("span", {}, h("i", { style: `background:var(--${g2})` }), l)),
      h("span", {}, "Contour dor\xE9 : unit\xE9 qui agit \xB7 contour rouge : sa cible \xB7 survole une unit\xE9 pour ses r\xE9sistances")
    ),
    h(
      "div",
      { class: "log-head row gap" },
      h("h2", {}, "Journal"),
      h("label", { class: "check" }, h("input", { type: "checkbox", id: "detailed", checked: rp.detailed, onchange: (e) => {
        rp.detailed = e.target.checked;
        rerender2();
      } }), " D\xE9taill\xE9 (tests r\xE9ussis, \xE9nergie, mana, tics)")
    ),
    h("ol", { class: "log", id: "log" }, b.log.map((e, i) => {
      const line2 = evLine(e);
      return line2 ? h("li", { "data-i": i, onclick: () => {
        stop();
        rp.i = i;
        paintReplay();
      } }, h("span", { class: "t" }, e.t), line2) : null;
    }))
  );
}
function stepVisible(dir) {
  if (!battle) return;
  let i = rp.i + dir;
  while (i > 0 && i < battle.log.length - 1 && !document.querySelector(`#log li[data-i="${i}"]`)) i += dir;
  rp.i = Math.max(0, Math.min(battle.log.length - 1, i));
  paintReplay();
}
function play() {
  if (!battle) return;
  if (rp.i >= battle.log.length - 1) rp.i = 0;
  rp.playing = true;
  const btn = document.getElementById("playbtn");
  if (btn) {
    btn.textContent = "\u23F8";
    btn.setAttribute("aria-label", "Pause");
  }
  const stepOnce = () => {
    if (!battle || !rp.playing) return;
    rp.i++;
    while (rp.i < battle.log.length - 1 && !DELAY[battle.log[rp.i].k]) rp.i++;
    paintReplay();
    if (rp.i >= battle.log.length - 1) {
      stop();
      return;
    }
    rp.timer = setTimeout(stepOnce, (DELAY[battle.log[rp.i].k] ?? 100) / rp.speed);
  };
  rp.timer = setTimeout(stepOnce, 100);
}
function stop() {
  rp.playing = false;
  clearTimeout(rp.timer);
  const btn = document.getElementById("playbtn");
  if (btn) {
    btn.textContent = "\u25B6";
    btn.setAttribute("aria-label", "Lecture");
  }
}
var RES_ORDER = DMG_TYPES;
function paintReplay() {
  if (!battle || !document.getElementById("arena")) return;
  const { units, t } = viewAt(rp.i);
  const ev = battle.log[rp.i];
  const actor = ev && "u" in ev && (ev.k === "act" || ev.k === "wait" || ev.k === "will") ? ev.u : null;
  let lastAct;
  for (let j = rp.i; j >= 0; j--) {
    const x = battle.log[j];
    if (x.k === "act") {
      lastAct = x;
      break;
    }
    if (x.k === "tick") break;
  }
  const actId = lastAct && lastAct.k === "act" ? lastAct.u : actor;
  const tgtId = lastAct && lastAct.k === "act" ? lastAct.target : void 0;
  const hitNow = ev && ev.k === "hit" ? ev : null;
  const healNow = ev && ev.k === "gauge" && ev.g === "hp" && ev.to > ev.from ? ev : null;
  document.querySelectorAll(".lane-units").forEach((l) => l.replaceChildren());
  for (const v of units.values()) {
    const lane = document.getElementById(`lane-${v.u.side ? "B" : "A"}-${v.dist}`);
    if (!lane) continue;
    const cls = ["token", v.u.side ? "tb" : "ta"];
    if (v.dead) cls.push("dead");
    if (v.fled) cls.push("fled");
    if (v.u.id === actId) cls.push("actor");
    if (v.u.id === tgtId && tgtId !== actId) cls.push("target");
    const bar2 = (g2, val, max) => max > 0 ? h(
      "div",
      { class: `bar g-${g2}`, title: `${g2} ${val}/${max}` },
      h("i", { style: `width:${Math.round(100 * val / max)}%` }),
      h("span", {}, `${val}`)
    ) : null;
    const st = [...v.states.entries()];
    lane.appendChild(h(
      "div",
      { class: cls.join(" "), title: `${v.u.name} \xB7 vitesse ${v.u.speed} \xB7 ${v.u.weapon.name}
R\xE9sistances : ${RES_ORDER.filter((r) => v.u.res[r]).map((r) => `${TYPE_LABEL[r]} ${v.u.res[r] / 10}`).join(", ") || "aucune"}` },
      h("div", { class: "tk-head" }, h("span", { class: "tk-id" }, v.u.id), h("span", { class: "tk-name" }, v.u.name)),
      bar2("hp", v.hp, v.u.hpMax),
      bar2("will", v.will, v.u.willMax),
      bar2("energy", v.energy, v.u.energyMax),
      bar2("mana", v.mana, v.u.manaMax),
      st.length ? h("div", { class: "tk-states" }, st.map(([k, s3]) => h("span", { class: "st", title: `jusqu\u2019\xE0 ${s3.until}` }, STATE_NAMES[k] ?? k, s3.charges > 1 ? ` \xD7${s3.charges}` : ""))) : null,
      v.dead ? h("div", { class: "tk-flag" }, "mort") : v.fled ? h("div", { class: "tk-flag" }, "enfui") : null,
      hitNow && hitNow.u === v.u.id ? h("div", { class: "float dmg" }, `\u2212${hitNow.final - hitNow.absorbed}`) : null,
      healNow && healNow.u === v.u.id ? h("div", { class: "float heal" }, `+${healNow.to - healNow.from}`) : null
    ));
  }
  for (const side of ["A", "B"]) {
    const occ = [...new Set([...units.values()].filter((v) => !v.dead && !v.fled && (v.u.side ? "B" : "A") === side).map((v) => v.dist))].sort();
    for (const r of [1, 2, 3]) {
      const el = document.getElementById(`label-${side}-${r}`);
      if (el) el.textContent = occ.includes(r) ? `${side} \xB7 rang ${r}${occ.indexOf(r) + 1 !== r ? ` \xB7 compte comme ${occ.indexOf(r) + 1}` : ""}` : `${side} \xB7 rang ${r} \xB7 vide`;
    }
  }
  const clock = document.getElementById("clock");
  if (clock) clock.textContent = `instant ${t}`;
  const nowEl = document.getElementById("now");
  if (nowEl) {
    let j = rp.i;
    let line2 = null;
    while (j >= 0 && !(line2 = evLine(battle.log[j]))) j--;
    nowEl.replaceChildren(line2 ?? "");
  }
  const scrub = document.getElementById("scrub");
  if (scrub) scrub.value = String(rp.i);
  const log = document.getElementById("log");
  if (log) {
    log.querySelectorAll("li.cur").forEach((li2) => li2.classList.remove("cur"));
    let j = rp.i;
    let li = null;
    while (j >= 0 && !(li = log.querySelector(`li[data-i="${j}"]`))) j--;
    if (li) {
      li.classList.add("cur");
      const el = li;
      log.scrollTop = el.offsetTop - log.offsetTop - log.clientHeight / 2;
    }
    log.querySelectorAll("li").forEach((x) => x.classList.toggle("future", Number(x.dataset.i) > rp.i));
  }
}


export { renderReplay, paintReplay, setRerender, stopReplay, setSkillNames };
