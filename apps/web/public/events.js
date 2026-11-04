// Flux temps réel (J6) : ouvre /events et redistribue chaque événement aux pages sous forme d'un
// CustomEvent « cr:<type> » (annulable) sur document, avec les données en `detail`. Une page qui prend
// l'événement en charge appelle preventDefault() ; sinon, l'action par défaut affiche une bulle.
// Sans JavaScript, le jeu reste utilisable : les pages se rechargent normalement.
(() => {
  if (!('EventSource' in window)) return;
  const TYPES = [
    'ready',
    'notify',
    'resubscribe',
    'chat.message',
    'chat.deleted',
    'dm.received',
    'dm.sent',
    'friend.request',
    'friend.update',
    'sanction.applied',
    'pseudo.renamed',
    'dungeon.invite',
    'dungeon.update',
    'dungeon.fight',
  ];

  /** Petite bulle en bas de page ; le texte est inséré en texte brut (jamais en HTML). */
  function toast(text, href) {
    const box = document.getElementById('toasts');
    if (!box || !text) return;
    const el = document.createElement(href ? 'a' : 'p');
    el.className = 'toast';
    el.textContent = text;
    if (href && href.startsWith('/')) el.setAttribute('href', href);
    box.appendChild(el);
    setTimeout(() => el.remove(), 8000);
    while (box.children.length > 4) box.firstElementChild.remove();
  }

  /** Bulles par défaut, pour les événements qu'aucune page n'a pris en charge. */
  const DEFAULTS = {
    notify: (d) => toast(d.text, d.href),
    'dm.received': (d) => toast('Message privé de ' + d.from, '/messages/' + encodeURIComponent(d.from)),
    'friend.request': (d) => toast(d.from + ' vous demande en ami.', '/amis'),
    'sanction.applied': (d) => toast(d.text),
    'pseudo.renamed': (d) => toast(d.text, '/compte'),
    'dungeon.invite': (d) => toast(d.text, '/donjon/invitation/' + Number(d.run)),
    // Donjon à deux : la page du donjon se met à jour ; ailleurs, une bulle y mène.
    'dungeon.update': (d) => (window.location.pathname === '/donjon' ? window.location.reload() : toast(d.text, '/donjon')),
    'dungeon.fight': (d) =>
      window.location.pathname === '/donjon'
        ? window.location.assign('/combat/' + Number(d.battle))
        : toast('Le combat de la salle commence.', '/combat/' + Number(d.battle)),
  };

  function emit(type, detail) {
    const free = document.dispatchEvent(new CustomEvent('cr:' + type, { detail, cancelable: true }));
    if (free && DEFAULTS[type]) DEFAULTS[type](detail);
  }

  const es = new EventSource('/events');
  let opened = false;
  es.addEventListener('open', () => {
    // Reconnexion après une coupure : les pages relisent l'état serveur (rien n'est rejoué côté flux).
    if (opened) emit('resync', {});
    opened = true;
  });
  for (const type of TYPES) {
    es.addEventListener(type, (ev) => {
      try {
        emit(type, JSON.parse(ev.data));
      } catch {
        /* message illisible : ignoré */
      }
    });
  }
  window.addEventListener('pagehide', () => es.close());
})();
