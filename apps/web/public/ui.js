// Interface (sans framework) : menus déroulants qui se referment, filtres et recherche des listes.
// Sans JavaScript, tout reste utilisable : les menus s'ouvrent au clic (<details>), les listes sont complètes.
(() => {
  // ---------- Menus : un seul ouvert à la fois, fermés au clic ailleurs ou sur Échap ----------
  const menus = () => document.querySelectorAll('details.menu');
  document.addEventListener('click', (e) => {
    for (const m of menus()) if (m.open && !m.contains(e.target)) m.open = false;
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    for (const m of menus()) if (m.open) m.open = false;
  });
  document.addEventListener(
    'toggle',
    (e) => {
      const t = e.target;
      if (!(t instanceof window.HTMLDetailsElement) || !t.classList.contains('menu') || !t.open) return;
      for (const m of menus()) if (m !== t && !m.contains(t) && !t.contains(m)) m.open = false;
    },
    true,
  );

  // ---------- Infobulles des sorts : au toucher, une seule ouverte à la fois ----------
  document.addEventListener('click', (e) => {
    const tip = e.target instanceof window.Element ? e.target.closest('.spell') : null;
    for (const s of document.querySelectorAll('.spell.open')) if (s !== tip) s.classList.remove('open');
    if (tip) tip.classList.toggle('open');
  });

  // ---------- Filtres : <div class="filterbar" data-for="sélecteur des listes"> ----------
  const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  function setup(bar) {
    const lists = [...document.querySelectorAll(bar.dataset.for)];
    if (!lists.length) return;
    const search = bar.querySelector('[data-search]');
    const count = bar.querySelector('[data-count]');
    const state = {};
    const items = () => lists.flatMap((l) => [...l.querySelectorAll(':scope > [data-text]')]);

    function apply() {
      const q = norm(search ? search.value : '');
      let shown = 0;
      for (const it of items()) {
        let ok = !q || norm(it.dataset.text).includes(q);
        for (const [k, v] of Object.entries(state)) if (v && v !== '*' && !(it.dataset[k] || '').split(' ').includes(v)) ok = false;
        it.hidden = !ok;
        if (ok) shown++;
      }
      for (const l of lists) {
        const empty = l.querySelector(':scope > .filter-empty');
        const any = [...l.querySelectorAll(':scope > [data-text]')].some((x) => !x.hidden);
        if (empty) empty.hidden = any;
      }
      if (count) count.textContent = shown + ' résultat' + (shown > 1 ? 's' : '');
    }

    for (const group of bar.querySelectorAll('[data-key]')) {
      const key = group.dataset.key;
      if (group.tagName === 'SELECT') {
        state[key] = group.value;
        group.addEventListener('change', () => {
          state[key] = group.value;
          apply();
        });
        continue;
      }
      const buttons = group.querySelectorAll('button[data-value]');
      state[key] = group.querySelector('button[aria-pressed="true"]')?.dataset.value || '*';
      for (const b of buttons)
        b.addEventListener('click', () => {
          for (const x of buttons) x.setAttribute('aria-pressed', String(x === b));
          state[key] = b.dataset.value;
          apply();
        });
    }
    if (search) search.addEventListener('input', apply);
    bar.hidden = false;
    apply();
  }

  function init() {
    for (const bar of document.querySelectorAll('.filterbar[data-for]')) setup(bar);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
