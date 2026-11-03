// Outils DOM du prototype (prototype-extrait/dom.js), inchangés.
/* eslint-disable */
function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === void 0 || v === null || v === false) continue;
    if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (k === "class") el.className = v;
    else if (k === "style") el.setAttribute("style", v);
    else if (k === "value") el.value = String(v);
    else if (k === "checked" || k === "disabled" || k === "selected") el[k] = !!v;
    else el.setAttribute(k, v === true ? "" : String(v));
  }
  const add = (c) => {
    if (c === null || c === void 0 || c === false) return;
    if (Array.isArray(c)) c.forEach(add);
    else el.appendChild(typeof c === "object" ? c : document.createTextNode(String(c)));
  };
  kids.forEach(add);
  return el;
}
function select(id, value, options, onchange, cls = "") {
  return h(
    "select",
    { id, class: cls, onchange: (e) => onchange(e.target.value) },
    options.map(([v, l]) => h("option", { value: v, selected: v === value }, l))
  );
}


export { h, select };
