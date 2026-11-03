// Vue 8 bits des combats : copie de prototype-extrait/pixel.js (proto-0.4-ville), inchangée (guide 4.1).
// Seule la dernière ligne (export) est ajoutée. Lecture du journal uniquement : aucune règle de jeu ici.
/* eslint-disable */
var W3 = 256;
var H = 144;
var FONT = '"Press Start 2P", ui-monospace, monospace';
var HUMAN = [
  "................",
  "......oooo......",
  ".....ohhhho.....",
  ".....ohssseo....",
  ".....osssso.....",
  "......osso......",
  ".....obbbbo.....",
  "....obbbbbbo....",
  "....osbbbbso....",
  "....osbbbbso....",
  ".....obbbbo.....",
  ".....oddddo.....",
  ".....odoodo.....",
  ".....odoodo.....",
  ".....odoodo.....",
  ".....oo..oo....."
];
var ROBE = [
  "................",
  "......oooo......",
  ".....ohhhho.....",
  "....ohhsseo.....",
  "....ohssssho....",
  ".....ohssho.....",
  ".....obbbbo.....",
  "....obbbbbbo....",
  "....osbbbbso....",
  "....obbbbbbo....",
  "....obbddbbo....",
  "...obbbddbbbo...",
  "...obbbddbbbo...",
  "...obbbbbbbbo...",
  "...oooooooooo...",
  "................"
];
var WOLF = [
  "................",
  "................",
  "................",
  "................",
  "................",
  "...........oo...",
  "..........ohho..",
  "..o......ohhheo.",
  ".obo....ohhhhhoo",
  "..obooooobbbbo..",
  "...obbbbbbbbo...",
  "...obbbbbbbbo...",
  "...obddoooddo...",
  "...odo.o..odo...",
  "...oo.....oo....",
  "................"
];
var GIANT = [
  "................",
  ".....oooooo.....",
  "....ohhhhhho....",
  "....ohssssseo...",
  "....osssssso....",
  "...oobbbbbboo...",
  "..obbbbbbbbbbo..",
  "..obbbbbbbbbbo..",
  "..osbbbbbbbbso..",
  "..osobbbbbboso..",
  "..oo.obbbbo.oo..",
  ".....oddddo.....",
  "....oddoodddo...",
  "....oddo.oddo...",
  "....oddo.oddo...",
  "....oooo.oooo..."
];
var TOMB = [
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  "......oooo......",
  ".....oggggo.....",
  "....oggooggo...",
  "....ogoooogo....",
  "....oggooggo...",
  "....oggooggo...",
  "....oggggggo....",
  "....oggggggo....",
  "...oooooooooo...",
  "................"
];
var BIRD = [
  "................",
  "................",
  "................",
  "..o.........o...",
  ".obo.......obo..",
  ".obbo.ooo.obbo..",
  "..obbohhhobbo...",
  "...obhhhhhbo....",
  "....ohheshoo....",
  "....ohhhhhoyo...",
  ".....obbbo.oo...",
  "......obo.......",
  ".....od.do......",
  "................",
  "................",
  "................"
];
var BLOB = [
  "................",
  "................",
  "................",
  "................",
  "................",
  ".......oo.......",
  ".....oohhoo.....",
  "....ohhhhhho....",
  "...ohhhhhhhho...",
  "...ohheohheho...",
  "..ohbhhhhhhbho..",
  "..obbbbbbbbbbo..",
  "..obbbbbbbbbbo..",
  "...oddddddddo...",
  "....oooooooo....",
  "................"
];
var BUG = [
  "................",
  "................",
  "................",
  "................",
  "................",
  "..........oo....",
  ".........ohho...",
  "....ooo.ohhheo..",
  "...obbboohhhho..",
  "..obbbbbbbhhho..",
  "..obbbbbbbbbo...",
  "..oddbbbbbddo...",
  ".od.od.od.od....",
  ".o..o..o..o.....",
  "................",
  "................"
];
var DRAGON = [
  "..........oo....",
  ".o.......ohhoo..",
  ".oo.....ohhhheo.",
  ".obo...ohhhhhhoo",
  ".obbo.ohhhhoooo.",
  "..obboobbbho....",
  "..obbbbbbbbo....",
  "...obbbbbbbbo...",
  "..obbbbbbbbbbo..",
  ".obbbbbbbbbbbo..",
  ".obbbbbbbbbbbbo.",
  "oddbbbbbbbbbddo.",
  "o.oddo...oddo...",
  "..oddo...oddo...",
  "..oooo...oooo...",
  "................"
];
var line = (x, y0, y1, k) => Array.from({ length: y1 - y0 + 1 }, (_, i) => [x, y0 + i, k]);
var BASE = { o: "#1a1420", e: "#1a1420", s: "#f0c090", m: "#d4dae2", w: "#8a5a2a", g: "#8a8f99" };
var LOOKS = {
  milicien: {
    body: HUMAN,
    pal: { h: "#a7b0b8", b: "#4f74b0", d: "#33425e", k: "#8a6a3a" },
    extra: [...line(12, 3, 9, "m"), [11, 10, "w"], [12, 10, "w"], [13, 10, "w"], ...line(2, 7, 11, "k"), ...line(3, 7, 11, "k"), ...line(4, 8, 10, "m")]
  },
  frondeurs: {
    body: HUMAN,
    pal: { h: "#7a5230", b: "#7b8a3a", d: "#4d5526" },
    extra: [[11, 9, "w"], [12, 8, "w"], [13, 7, "w"], [14, 6, "w"], [14, 5, "o"], [15, 5, "o"]]
  },
  acolyte: {
    body: ROBE,
    pal: { h: "#e8e2cc", b: "#e8e2cc", d: "#c9a640", x: "#ffd84a" },
    extra: [...line(12, 5, 14, "w"), [11, 3, "x"], [12, 3, "x"], [13, 3, "x"], [11, 4, "x"], [12, 4, "x"], [13, 4, "x"]]
  },
  pyromancien: {
    body: ROBE,
    pal: { h: "#b4321e", b: "#c8462a", d: "#7a1e12", x: "#ffa02a", y: "#fff07a" },
    extra: [...line(12, 4, 14, "w"), [12, 1, "y"], [11, 2, "x"], [12, 2, "y"], [13, 2, "x"], [11, 3, "x"], [12, 3, "x"], [13, 3, "x"]]
  },
  chasseur: {
    body: HUMAN,
    pal: { h: "#3f6b35", b: "#5d7f3a", d: "#3b4f25" },
    extra: [[13, 3, "w"], ...line(14, 4, 10, "w"), [13, 11, "w"], ...line(13, 4, 10, "m")]
  },
  berserker: {
    body: HUMAN,
    pal: { h: "#d8742a", b: "#8a5a3a", d: "#5a3a22", s: "#d9a070" },
    extra: [...line(12, 3, 13, "w"), [13, 2, "m"], [14, 2, "m"], [13, 3, "m"], [14, 3, "m"], [15, 3, "m"], [13, 4, "m"], [14, 4, "m"], [15, 4, "m"], [13, 5, "m"]]
  },
  loups: { body: WOLF, pal: { h: "#a2a2ae", b: "#7d7d8a", d: "#55555f", e: "#ffd040" }, extra: [[15, 9, "m"]] },
  adepte: {
    body: ROBE,
    pal: { h: "#3b2a52", b: "#4a3366", d: "#2a1c3c", s: "#d9d0c0", x: "#b06aff" },
    extra: [...line(12, 4, 14, "w"), [11, 2, "x"], [12, 2, "x"], [13, 2, "x"], [12, 1, "x"], [12, 3, "x"]]
  },
  moine: {
    body: HUMAN,
    pal: { h: "#e0b07a", b: "#d87a28", d: "#8a4a18", s: "#e0b07a" },
    extra: [[11, 8, "m"], [12, 8, "m"], [11, 9, "m"], [12, 9, "m"], [3, 8, "m"], [3, 9, "m"]]
  },
  briseur: {
    body: GIANT,
    pal: { h: "#6d6a64", b: "#80705a", d: "#4e4438", s: "#d9a878" },
    extra: [...line(13, 5, 14, "w"), ...[12, 13, 14, 15].flatMap((x) => line(x, 1, 4, "m"))]
  }
};
var FALLBACK = { body: HUMAN, pal: { h: "#888", b: "#777", d: "#555" }, extra: [] };
var hints = /* @__PURE__ */ new Map();
function registerLooks(list) {
  for (const [k, v] of Object.entries(list)) hints.set(k, v);
  spriteCache.clear();
}
function hue(kind, n) {
  let x = 7;
  for (const c of kind) x = x * 31 + c.charCodeAt(0) >>> 0;
  return (x >>> n * 5) % 360;
}
var hsl = (h2, s3, l) => `hsl(${h2} ${s3}% ${l}%)`;
function autoLook(kind) {
  const t = hints.get(kind);
  if (!t) return FALLBACK;
  const has = (x) => t.tags.includes(x);
  const h1 = hue(kind, 0), h2 = hue(kind, 1);
  const flying = /corbeau|vautour|chauve|harpie|moustique|griffon/.test(kind);
  const bug = /araignee|scorpion|sangsue|ver_|crapaud/.test(kind);
  const blob = has("vase") || /follet|gelee|elementaire|djinn|spectre|ombre/.test(kind);
  let body = HUMAN;
  if (/dragon|chimere|basilic|crocodile|salamandre/.test(kind)) body = t.pop / t.units >= 3 ? DRAGON : WOLF;
  else if (flying) body = BIRD;
  else if (bug) body = BUG;
  else if (blob) body = BLOB;
  else if (has("bete")) body = WOLF;
  else if (has("construct") || has("geant") || has("plante") || t.pop / t.units >= 3) body = GIANT;
  else if (t.caster) body = ROBE;
  let skin = "#e0b07a", main = hsl(h1, 45, 42), dark = hsl(h1, 40, 26), hair = hsl(h2, 35, 35);
  if (has("mort-vivant")) {
    skin = "#a8b89a";
    main = hsl(h1, 15, 38);
    dark = hsl(h1, 15, 22);
    hair = "#d0d8c0";
  }
  if (has("esprit")) {
    skin = hsl(h1, 70, 80);
    main = hsl(h1, 70, 60);
    dark = hsl(h1, 60, 40);
    hair = hsl(h1, 80, 85);
  }
  if (has("construct")) {
    skin = hsl(h1, 10, 62);
    main = hsl(h1, 12, 48);
    dark = hsl(h1, 12, 30);
    hair = hsl(h2, 60, 70);
  }
  if (has("celeste")) {
    skin = "#f0dcc0";
    main = "#e8e4d8";
    dark = "#c9a640";
    hair = "#ffe08a";
  }
  if (has("kobold")) {
    skin = "#c0603a";
  }
  if (has("gobelin")) {
    skin = "#7ab04a";
    main = hsl(h1, 30, 34);
  }
  if (has("plante")) {
    skin = "#6a8a3a";
    main = "#4a6a2a";
    dark = "#2e4418";
    hair = "#8ac04a";
  }
  if (has("nain")) {
    hair = "#a0582a";
  }
  if (has("reptile") || /crapaud/.test(kind)) {
    skin = hsl(100 + h1 % 60, 40, 45);
    main = hsl(100 + h1 % 60, 40, 38);
    dark = hsl(100 + h1 % 60, 40, 24);
    hair = main;
  }
  if (body === WOLF || body === BIRD || body === BUG || body === DRAGON) {
    hair = hsl(h1, 30, 55);
    main = hsl(h1, 30, 42);
    dark = hsl(h1, 30, 26);
  }
  if (/dragon_cendre|salamandre/.test(kind)) {
    hair = "#d8642a";
    main = "#8a3a22";
    dark = "#4a1e14";
  }
  const pal = { h: hair, b: main, d: dark, s: skin, e: has("mort-vivant") || has("esprit") ? "#ff5050" : "#1a1420", x: hsl(h2, 85, 65), y: "#fff07a" };
  const extra = [];
  if (body === HUMAN || body === ROBE || body === GIANT) {
    if (t.caster) extra.push(...line(12, 4, 14, "w"), [11, 3, "x"], [12, 3, "x"], [13, 3, "x"], [12, 2, "x"]);
    else if (/arc|arbalete/.test(t.weapon)) extra.push([13, 3, "w"], ...line(14, 4, 10, "w"), [13, 11, "w"], ...line(13, 4, 10, "m"));
    else if (/lance|harpon/.test(t.weapon)) extra.push(...line(12, 0, 13, "w"), [12, 0, "m"], [12, 1, "m"]);
    else if (/fronde|flasque/.test(t.weapon)) extra.push([11, 9, "w"], [12, 8, "w"], [13, 7, "w"], [14, 6, "x"]);
    else if (/masse|pioche|poing/.test(t.weapon)) extra.push(...line(12, 4, 11, "w"), [11, 3, "m"], [12, 3, "m"], [13, 3, "m"], [12, 2, "m"]);
    else extra.push(...line(12, 3, 9, "m"), [11, 10, "w"], [12, 10, "w"], [13, 10, "w"]);
    if (has("nain")) extra.push([6, 5, "h"], [7, 6, "h"], [8, 6, "h"], [9, 5, "h"]);
  }
  return { body, pal, extra };
}
function paintGrid(rows, pal, extra, white = false) {
  const c = document.createElement("canvas");
  c.width = 16;
  c.height = 16;
  const g2 = c.getContext("2d");
  const put = (x, y, k) => {
    const col = white ? "#ffffff" : pal[k] ?? BASE[k];
    if (!col || k === "." || k === " ") return;
    g2.fillStyle = col;
    g2.fillRect(x, y, 1, 1);
  };
  rows.forEach((r, y) => [...r.padEnd(16, ".").slice(0, 16)].forEach((k, x) => put(x, y, k)));
  for (const [x, y, k] of extra) put(x, y, k);
  return c;
}
function flip(src) {
  const c = document.createElement("canvas");
  c.width = 16;
  c.height = 16;
  const g2 = c.getContext("2d");
  g2.translate(16, 0);
  g2.scale(-1, 1);
  g2.drawImage(src, 0, 0);
  return c;
}
var spriteCache = /* @__PURE__ */ new Map();
function sprites(kind) {
  let s3 = spriteCache.get(kind);
  if (!s3) {
    const l = LOOKS[kind] ?? autoLook(kind);
    const right = paintGrid(l.body, l.pal, l.extra), whiteR = paintGrid(l.body, l.pal, l.extra, true);
    s3 = { right, left: flip(right), whiteR, whiteL: flip(whiteR) };
    spriteCache.set(kind, s3);
  }
  return s3;
}
var tombSprite = null;
var TYPE_COLOR = {
  contondant: "#d8cbb0",
  tranchant: "#eef0ff",
  maladie: "#86d04e",
  psychique: "#f07ae0",
  feu: "#ff8a2a",
  glace: "#86e0ff",
  tenebres: "#a86aff",
  sacre: "#ffe66a"
};
var SKILL_TYPE = {
  boule_feu: "feu",
  trait_flammes: "feu",
  mur_flammes: "feu",
  embrasement: "feu",
  arme_enflammee: "feu",
  fleche_givre: "glace",
  trait_sacre: "sacre",
  trait_sacre_renforce: "sacre",
  drain: "tenebres",
  malediction: "tenebres",
  lien_vital: "tenebres",
  murmure: "psychique",
  terreur_masse: "psychique",
  confusion: "psychique",
  confusion_moine: "psychique",
  paume_vide: "psychique",
  nuage: "maladie",
  nuage_renforce: "maladie",
  marque: "tranchant",
  grappin: "contondant"
};
var STATE_COLOR = {
  saignement: "#e03030",
  poison: "#70c040",
  brulure: "#ff8a2a",
  regeneration: "#9af07a",
  hate: "#ffe040",
  ralenti: "#60b0ff",
  etourdi: "#ffffff",
  gele: "#a8ecff",
  bouclier: "#ffd24a",
  marque: "#ff4060",
  provocation: "#ff6a30",
  confusion: "#f07ae0",
  cri: "#ffb040",
  peau: "#a0a0a0",
  malediction: "#9a5ae0",
  brise: "#a06a40",
  arme_feu: "#ff8a2a",
  lien: "#c070ff",
  affaibli: "#8a7a6a",
  garde: "#c0c8d8",
  silence: "#d0d0f0",
  epines: "#6aa040"
};
var HEALS = /* @__PURE__ */ new Set(["soin_mineur", "regeneration", "priere", "soin_majeur", "cercle_soins", "seve", "second_souffle"]);
var TEAM = ["#4aa8de", "#e0648e"];
function mountPixel(canvas, input, log, hooks, theme = 0) {
  canvas.width = W3;
  canvas.height = H;
  const g2 = canvas.getContext("2d");
  g2.imageSmoothingEnabled = false;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const endT = log[log.length - 1].t;
  const bg = paintBackground(theme);
  if (!tombSprite) tombSprite = paintGrid(TOMB, { g: "#8a8f99" }, []);
  let units = /* @__PURE__ */ new Map();
  let idx = 0;
  let clock = 0;
  let speed = 25;
  let playing = false;
  let raf = 0;
  let last = performance.now();
  let queue = [];
  let fx = [];
  let groupStart = 0, groupDelay = 0;
  let ended = null;
  let lastIndex = 0;
  function reset() {
    units = /* @__PURE__ */ new Map();
    const start = log[0];
    if (start.k === "start") for (const u2 of start.units)
      units.set(u2.id, { u: u2, hp: u2.hp, mana: u2.mana, dist: u2.dist, states: /* @__PURE__ */ new Set(), dead: u2.hp <= 0, fled: false, x: 0, y: 0, placed: false, flash: 0, lunge: 0, lungeDir: 0, bubble: null });
    idx = 1;
    clock = 0;
    queue = [];
    fx = [];
    ended = null;
    lastIndex = 0;
  }
  function applyState(e) {
    switch (e.k) {
      case "gauge": {
        const v = units.get(e.u);
        if (e.g === "hp") v.hp = e.to;
        if (e.g === "mana") v.mana = e.to;
        break;
      }
      case "move":
        units.get(e.u).dist = e.to;
        break;
      case "state": {
        const v = units.get(e.u);
        if (e.op === "end") v.states.delete(e.s);
        else if (e.op !== "immune") v.states.add(e.s);
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
      case "end":
        ended = e;
        break;
    }
  }
  const head = (v) => ({ x: v.x, y: v.y - 9 });
  const say = (v, text2, color, ms = 700) => {
    v.bubble = { text: text2, color, until: performance.now() + ms };
  };
  function visual(e, t) {
    switch (e.k) {
      case "act": {
        const a = units.get(e.u);
        const sk = input.skills[e.skill];
        const tg = e.target ? units.get(e.target) : void 0;
        groupStart = t;
        groupDelay = 120;
        if (!sk) {
          if (e.skill === "attendre") say(a, "...", "#c8c8d0");
          break;
        }
        const type = SKILL_TYPE[e.skill] ?? sk.fx?.find((f) => f.type)?.type ?? (sk.dtype && sk.dtype !== "weapon" ? sk.dtype : a.u.weapon.type);
        const color = TYPE_COLOR[type];
        if (sk.target === "enemy" && tg) {
          if (sk.melee || sk.range <= 1 || e.skill === "charge") {
            a.lunge = t;
            a.lungeDir = a.u.side ? -1 : 1;
            groupDelay = 130;
          } else {
            const p0 = head(a), p1 = head(tg);
            fx.push({ kind: "shot", start: t, dur: 260, x0: p0.x + (a.u.side ? -6 : 6), y0: p0.y, x1: p1.x, y1: p1.y, color, arc: a.u.weapon.type === "contondant" && !sk.mana ? 10 : 0 });
            groupDelay = 270;
          }
        } else if (sk.target === "ally" && tg) {
          const p0 = head(a), p1 = head(tg);
          if (tg !== a) fx.push({ kind: "shot", start: t, dur: 220, x0: p0.x, y0: p0.y - 4, x1: p1.x, y1: p1.y, color: HEALS.has(e.skill) ? "#9af07a" : "#ffd24a", arc: 8 });
          fx.push({ kind: "spark", start: t + (tg !== a ? 200 : 0), dur: 520, x0: p1.x, y0: p1.y, x1: 0, y1: 0, color: HEALS.has(e.skill) ? "#9af07a" : "#ffd24a" });
          groupDelay = tg !== a ? 220 : 120;
        } else {
          const p = head(a);
          const area = ["tourbillon", "seisme", "repousser_renforce", "hurlement", "cri_guerre", "priere", "mur_boucliers"].includes(e.skill) || !!sk.fx?.some((f) => f.area && f.area !== "target" && f.area !== "self");
          if (area) fx.push({ kind: "ring", start: t, dur: 420, x0: p.x, y0: a.y - 6, x1: 0, y1: 0, color: e.skill === "priere" || HEALS.has(e.skill) ? "#9af07a" : e.skill === "seisme" ? "#d8cbb0" : "#ffd24a" });
          else fx.push({ kind: "spark", start: t, dur: 480, x0: p.x, y0: p.y, x1: 0, y1: 0, color: e.skill === "meditation" ? "#b090ff" : e.skill === "repos" ? "#ffe040" : "#ffd24a" });
          if (e.skill === "repos") say(a, "z", "#ffe040");
        }
        break;
      }
      case "wait":
        if (e.why !== "choice") say(units.get(e.u), "...", "#c8c8d0");
        break;
      case "frozen":
        say(units.get(e.u), "*", "#a8ecff");
        break;
      case "will":
        if (e.res !== "ok") say(units.get(e.u), e.res === "half" ? "?" : "!!", e.res === "half" ? "#ffd24a" : "#ff5050", 900);
        break;
      case "hit": {
        const v = units.get(e.u);
        v.flash = t;
        const p = head(v);
        const dmg = e.final - e.absorbed;
        fx.push({ kind: "text", start: t, dur: 900, x0: p.x, y0: p.y - 6, x1: 0, y1: 0, color: e.absorbed && !dmg ? "#ffd24a" : "#ff5a4a", text: dmg ? `-${dmg}` : "0" });
        break;
      }
      case "gauge":
        if (e.g === "hp" && e.to > e.from) {
          const v = units.get(e.u);
          const p = head(v);
          fx.push({ kind: "text", start: t, dur: 900, x0: p.x, y0: p.y - 6, x1: 0, y1: 0, color: "#7aec6a", text: `+${e.to - e.from}` });
        }
        break;
      case "passive": {
        const v = units.get(e.u);
        say(v, "!", "#ffd24a", 600);
        fx.push({ kind: "spark", start: t, dur: 480, x0: v.x, y0: v.y - 9, x1: 0, y1: 0, color: "#ffd24a" });
        break;
      }
      case "death": {
        const v = units.get(e.u);
        fx.push({ kind: "spark", start: t, dur: 700, x0: v.x, y0: v.y - 8, x1: 0, y1: 0, color: "#e8e8f0" });
        break;
      }
    }
  }
  const laneX = (side, dist) => side === 0 ? W3 / 2 - 18 - (dist - 1) * 36 : W3 / 2 + 18 + (dist - 1) * 36;
  function layout(dt) {
    const lanes = /* @__PURE__ */ new Map();
    for (const v of units.values()) {
      if (v.fled) continue;
      const key = `${v.u.side}-${v.dist}`;
      (lanes.get(key) ?? lanes.set(key, []).get(key)).push(v);
    }
    for (const [key, list] of lanes) {
      const [side, dist] = key.split("-").map(Number);
      list.sort((a, b) => a.u.slot - b.u.slot);
      const step = Math.min(28, 84 / list.length);
      const y0 = 92 - (list.length - 1) * step / 2;
      list.forEach((v, i) => {
        const tx = laneX(side, dist) + (i % 2 ? side ? 6 : -6 : 0), ty = Math.round(y0 + i * step);
        if (!v.placed || reduce) {
          v.x = tx;
          v.y = ty;
          v.placed = true;
        } else {
          const k = Math.min(1, dt * 9);
          v.x += (tx - v.x) * k;
          v.y += (ty - v.y) * k;
        }
      });
    }
    for (const v of units.values()) if (v.fled) v.x += (v.u.side ? 1 : -1) * dt * 120;
  }
  function draw(t) {
    g2.drawImage(bg, 0, 0);
    for (const side of [0, 1]) {
      const occ = [...new Set([...units.values()].filter((v) => v.u.side === side && !v.dead && !v.fled).map((v) => v.dist))].sort();
      for (const d of [1, 2, 3]) {
        const x = laneX(side, d);
        const eff = occ.indexOf(d) + 1;
        g2.globalAlpha = eff ? 0.9 : 0.35;
        g2.fillStyle = side ? "#5a2a3c" : "#24445a";
        g2.fillRect(x - 12, 135, 24, 9);
        text(eff ? eff !== d ? `${d}>${eff}` : `${d}` : "-", x, 136, eff ? "#e8e8f0" : "#9aa0a8", 8, "center");
        g2.globalAlpha = 1;
      }
    }
    const list = [...units.values()].sort((a, b) => a.y - b.y);
    for (const v of list) {
      if (v.fled && (v.x < -20 || v.x > W3 + 20)) continue;
      const x = Math.round(v.x), y = Math.round(v.y);
      g2.fillStyle = TEAM[v.u.side];
      g2.globalAlpha = 0.55;
      g2.fillRect(x - 6, y, 12, 2);
      g2.fillRect(x - 4, y + 2, 8, 1);
      g2.globalAlpha = 1;
      if (v.dead) {
        g2.drawImage(tombSprite, x - 8, y - 15);
        label(v, x, y);
        continue;
      }
      const s3 = sprites(v.u.kind ?? "");
      const p = t - v.lunge;
      const dx = p >= 0 && p < 280 && !reduce ? Math.round(Math.sin(Math.PI * p / 280) * 10 * v.lungeDir) : 0;
      const shake = t - v.flash < 220 && !reduce ? Math.floor((t - v.flash) / 40) % 2 ? 1 : -1 : 0;
      const white = t - v.flash < 220 && Math.floor((t - v.flash) / 55) % 2 === 0;
      const img = v.u.side ? white ? s3.whiteL : s3.left : white ? s3.whiteR : s3.right;
      if (v.fled) g2.globalAlpha = 0.6;
      g2.drawImage(img, x - 8 + dx + shake, y - 16);
      g2.globalAlpha = 1;
      if (v.states.has("gele")) {
        g2.fillStyle = "rgba(150,220,255,0.38)";
        g2.fillRect(x - 7 + dx, y - 15, 14, 15);
      }
      if (v.states.has("bouclier")) {
        g2.strokeStyle = "#ffd24a";
        g2.globalAlpha = 0.8;
        g2.strokeRect(x - 9.5 + dx, y - 17.5, 19, 19);
        g2.globalAlpha = 1;
      }
      if (v.states.has("etourdi")) {
        const a = t / 120 % 4;
        g2.fillStyle = "#fff07a";
        g2.fillRect(x - 4 + Math.round(a * 2), y - 19, 1, 1);
        g2.fillRect(x + 4 - Math.round(a * 2), y - 18, 1, 1);
      }
      const hpw = Math.max(0, Math.round(14 * v.hp / v.u.hpMax));
      g2.fillStyle = "#100c14";
      g2.fillRect(x - 8, y - 22, 16, v.u.manaMax ? 5 : 4);
      const r = v.hp / v.u.hpMax;
      g2.fillStyle = r > 0.5 ? "#58d068" : r > 0.25 ? "#f0c040" : "#f05040";
      g2.fillRect(x - 7, y - 21, hpw, 2);
      if (v.u.manaMax) {
        g2.fillStyle = "#4a9cf0";
        g2.fillRect(x - 7, y - 19, Math.round(14 * v.mana / v.u.manaMax), 1);
      }
      let k = 0;
      for (const st of v.states) {
        if (k > 5) break;
        g2.fillStyle = STATE_COLOR[st] ?? "#fff";
        g2.fillRect(x + 9 + k % 2 * 3, y - 15 + Math.floor(k / 2) * 3, 2, 2);
        k++;
      }
      label(v, x, y);
      if (v.bubble && t < v.bubble.until) text(v.bubble.text, x + dx, y - 31, v.bubble.color, 8, "center");
    }
    fx = fx.filter((f) => t < f.start + f.dur);
    for (const f of fx) {
      const p = (t - f.start) / f.dur;
      if (p < 0) continue;
      if (f.kind === "shot") {
        const x = f.x0 + (f.x1 - f.x0) * p, y = f.y0 + (f.y1 - f.y0) * p - Math.sin(Math.PI * p) * (f.arc ?? 0);
        g2.fillStyle = f.color;
        g2.fillRect(Math.round(x) - 1, Math.round(y) - 1, 3, 3);
        g2.globalAlpha = 0.5;
        const bx = f.x0 + (f.x1 - f.x0) * Math.max(0, p - 0.08), by = f.y0 + (f.y1 - f.y0) * Math.max(0, p - 0.08);
        g2.fillRect(Math.round(bx), Math.round(by), 2, 2);
        g2.globalAlpha = 1;
      } else if (f.kind === "text") {
        g2.globalAlpha = p > 0.7 ? (1 - p) / 0.3 : 1;
        text(f.text, f.x0, Math.round(f.y0 - 12 * p), f.color, 8, "center", true);
        g2.globalAlpha = 1;
      } else if (f.kind === "spark") {
        g2.fillStyle = f.color;
        g2.globalAlpha = 1 - p;
        for (let i = 0; i < 6; i++) {
          const a = i / 6 * Math.PI * 2 + p;
          const r = 3 + p * 9;
          g2.fillRect(Math.round(f.x0 + Math.cos(a) * r), Math.round(f.y0 + Math.sin(a) * r * 0.8), 2, 2);
        }
        g2.globalAlpha = 1;
      } else if (f.kind === "ring") {
        g2.strokeStyle = f.color;
        g2.globalAlpha = 1 - p;
        g2.lineWidth = 1;
        g2.beginPath();
        g2.ellipse(f.x0, f.y0, 4 + p * 40, 2 + p * 14, 0, 0, Math.PI * 2);
        g2.stroke();
        g2.globalAlpha = 1;
      }
    }
    text(`T ${String(Math.floor(clock)).padStart(4, "0")}`, 6, 5, "#e8e8f0", 8, "left", true);
    text(`${speed}/s`, W3 - 6, 5, "#9aa0a8", 8, "right");
    text("A", W3 / 2 - 18 - 72, 16, TEAM[0], 8, "center", true);
    text("B", W3 / 2 + 18 + 72, 16, TEAM[1], 8, "center", true);
    if (ended && ended.k === "end" && queue.length === 0) {
      g2.fillStyle = "rgba(10,8,16,0.82)";
      g2.fillRect(0, 46, W3, 34);
      const msg = ended.reason === "timeout" ? "TEMPS ECOULE" : ended.winner === null ? "AUCUN SURVIVANT" : `VICTOIRE DU CAMP ${ended.winner ? "B" : "A"}`;
      text(msg, W3 / 2, 54, ended.reason === "timeout" ? TEAM[1] : ended.winner === null ? "#e8e8f0" : TEAM[ended.winner], 8, "center", true);
      text(ended.reason === "timeout" ? "DEFAITE DU CAMP A" : `INSTANT ${ended.t}`, W3 / 2, 66, "#c8c8d0", 8, "center");
    }
  }
  function label(v, x, y) {
    text(v.u.id, x, y + 3, v.dead ? "#8a8f99" : TEAM[v.u.side], 8, "center");
  }
  function text(s3, x, y, color, size, align, shadow = false) {
    g2.font = `${size}px ${FONT}`;
    g2.textAlign = align;
    g2.textBaseline = "top";
    if (shadow) {
      g2.fillStyle = "#100c14";
      g2.fillText(s3, x + 1, y + 1);
    }
    g2.fillStyle = color;
    g2.fillText(s3, x, y);
  }
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1e3);
    last = now;
    if (playing) {
      clock = Math.min(endT, clock + dt * speed);
      while (idx < log.length && log[idx].t <= clock) {
        const e = log[idx];
        if (e.k === "act") {
          visual(e, now);
          applyState(e);
          report(idx);
        } else if (e.k === "tick") {
          groupStart = now;
          groupDelay = 0;
        } else queue.push({ at: Math.max(now, groupStart + groupDelay), e, i: idx });
        idx++;
      }
    }
    while (queue.length && queue[0].at <= now) {
      const q = queue.shift();
      applyState(q.e);
      visual(q.e, now);
      report(q.i);
    }
    if (playing && idx >= log.length && !queue.length) {
      playing = false;
    }
    layout(dt);
    draw(now);
    hooks.onClock(Math.floor(clock), playing);
    raf = requestAnimationFrame(frame);
  }
  function report(i) {
    if (i !== lastIndex) {
      lastIndex = i;
      hooks.onIndex(i);
    }
  }
  function seek(t) {
    reset();
    t = Math.max(0, Math.min(endT, t));
    while (idx < log.length && log[idx].t <= t) {
      applyState(log[idx]);
      idx++;
    }
    clock = t;
    for (const v of units.values()) v.placed = false;
    report(Math.max(0, idx - 1));
  }
  reset();
  raf = requestAnimationFrame(frame);
  document.fonts?.load(`8px ${FONT}`).catch(() => void 0);
  return {
    play() {
      if (idx >= log.length && !queue.length) seek(0);
      playing = true;
      last = performance.now();
    },
    pause() {
      playing = false;
    },
    toggle() {
      this.isPlaying() ? this.pause() : this.play();
    },
    restart() {
      seek(0);
      playing = true;
    },
    seek(t) {
      seek(t);
    },
    setSpeed(n) {
      speed = n;
    },
    isPlaying: () => playing,
    destroy() {
      cancelAnimationFrame(raf);
    }
  };
}
var THEMES = [
  { sky: ["#141428", "#1c1c3a", "#26264c", "#30305c", "#3c3a68"], hill: "#2a3048", near: "#1f3a2a", ground: ["#2f5a34", "#2a5230", "#264a2c", "#224428", "#1f3e25"] },
  { sky: ["#1a2224", "#222c2c", "#2a3634", "#33403c", "#3c4a44"], hill: "#2c3a34", near: "#24342a", ground: ["#3a4a2e", "#34442a", "#2e3c26", "#2a3824", "#263420"] },
  { sky: ["#0e0c10", "#141016", "#1a141c", "#201822", "#261c28"], hill: "#3a3238", near: "#2c2428", ground: ["#4a403a", "#433a34", "#3c342e", "#362e2a", "#302926"] },
  { sky: ["#3a2018", "#58301e", "#784424", "#98582a", "#b86e32"], hill: "#6a4a36", near: "#7a5a3a", ground: ["#b89a6a", "#a88c60", "#9a7e56", "#8c724e", "#7e6646"] },
  { sky: ["#283a6a", "#34508a", "#4268a8", "#5a84c0", "#7aa0d4"], hill: "#c8d0e0", near: "#9aa8c0", ground: ["#d8d4c8", "#cac6ba", "#bcb8ac", "#aeaa9e", "#a09c92"] }
];
function paintBackground(theme = 0) {
  const T = THEMES[theme] ?? THEMES[0];
  const c = document.createElement("canvas");
  c.width = W3;
  c.height = H;
  const g2 = c.getContext("2d");
  const bands = T.sky;
  bands.forEach((col, i) => {
    g2.fillStyle = col;
    g2.fillRect(0, i * 7, W3, 7);
  });
  g2.fillStyle = "#c8c8e8";
  if (theme < 3) for (let i = 0; i < 26; i++) g2.fillRect((i * 97 + 13) % W3, i * 37 % 28, 1, 1);
  g2.fillStyle = T.hill;
  for (let x = 0; x < W3; x++) {
    const h2 = 8 + Math.round(6 * Math.sin(x / 23) + 4 * Math.sin(x / 9 + 1));
    g2.fillRect(x, 36 - h2, 1, h2 + 4);
  }
  g2.fillStyle = T.near;
  for (let x = 0; x < W3; x++) {
    const h2 = 4 + Math.round(3 * Math.sin(x / 15 + 2));
    g2.fillRect(x, 42 - h2, 1, h2);
  }
  const ground = T.ground;
  for (let y = 42; y < H; y++) {
    g2.fillStyle = ground[Math.min(ground.length - 1, Math.floor((y - 42) / 21))];
    g2.fillRect(0, y, W3, 1);
  }
  g2.fillStyle = "rgba(0,0,0,0.18)";
  for (let y = 44; y < H; y += 2) for (let x = y / 2 % 4; x < W3; x += 8) g2.fillRect(x, y, 1, 1);
  g2.fillStyle = "#c9a040";
  for (let y = 46; y < 132; y += 6) g2.fillRect(W3 / 2 - 1, y, 2, 3);
  return c;
}


export { mountPixel, registerLooks, W3 as WIDTH, H as HEIGHT };
