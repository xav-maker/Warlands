// Pages sociales (J6) : chat de région, messages privés, amis. Le serveur reste la source de vérité : à chaque
// événement du flux, on relit le fragment concerné (htmx), ce qui applique aussi blocages et suppressions.
(() => {
  function init() {
    const h = window.htmx;
    if (!h) return;

    /** Recharge un fragment sans empiler les requêtes : une relecture en cours, au plus une en attente. */
    function refresher(url, target) {
      let busy = false;
      let again = false;
      const go = () => {
        const el = typeof target === 'function' ? target() : target;
        const u = typeof url === 'function' ? url() : url;
        if (!document.querySelector(el) || !u) return;
        if (busy) {
          again = true;
          return;
        }
        busy = true;
        h.ajax('GET', u, { target: el, swap: 'innerHTML' }).finally(() => {
          busy = false;
          if (again) {
            again = false;
            go();
          }
        });
      };
      return go;
    }

    /** Garde le bas de la liste visible quand un message arrive, sauf si l'on relit plus haut. */
    document.addEventListener('htmx:beforeSwap', (e) => {
      const t = e.detail.target;
      if (t && t.classList && t.classList.contains('chat')) t.dataset.stick = String(t.scrollHeight - t.scrollTop - t.clientHeight < 40);
    });
    document.addEventListener('htmx:afterSwap', (e) => {
      const t = e.detail.target;
      if (t && t.classList && t.classList.contains('chat') && t.dataset.stick !== 'false') t.scrollTop = t.scrollHeight;
    });
    for (const el of document.querySelectorAll('.chat')) el.scrollTop = el.scrollHeight;

    // Après un envoi réussi : champ vidé, prêt pour le message suivant. Une erreur laisse le texte en place.
    document.addEventListener('htmx:afterRequest', (e) => {
      const f = e.detail.elt;
      if (f && (f.id === 'chat-form' || f.id === 'dm-form') && e.detail.successful && e.detail.xhr.status === 204) {
        f.reset();
        const input = f.querySelector('input[name="text"]');
        if (input) input.focus();
      }
    });

    // Chat de région.
    const chat = refresher('/chat/messages', '#chat-log');
    for (const type of ['chat.message', 'chat.deleted', 'resync']) document.addEventListener('cr:' + type, chat);
    // Changement de région : le titre et le fil changent ; une page rechargée est la plus simple et la plus sûre.
    document.addEventListener('cr:resubscribe', () => {
      if (document.getElementById('chat-log')) window.location.reload();
    });

    // Messages privés : on relit la conversation ouverte ; sinon une bulle prévient (voir events.js).
    const threadUrl = () => {
      const t = document.getElementById('thread');
      return t ? '/messages/' + encodeURIComponent(t.dataset.with) + '/fil' : null;
    };
    const thread = refresher(threadUrl, '#thread');
    document.addEventListener('cr:dm.received', (e) => {
      const t = document.getElementById('thread');
      if (t && t.dataset.with === e.detail.from) {
        thread();
        e.preventDefault();
      }
    });
    document.addEventListener('cr:dm.sent', (e) => {
      const t = document.getElementById('thread');
      if (t && t.dataset.with === e.detail.to) thread();
    });
    document.addEventListener('cr:resync', thread);

    // Amis : listes relues quand une demande arrive ou est acceptée.
    const friends = refresher('/amis/liste', '#friends-lists');
    for (const type of ['friend.request', 'friend.update', 'resync']) document.addEventListener('cr:' + type, friends);
  }
  // htmx est chargé après ce script (tous deux différés, donc exécutés avant DOMContentLoaded) : on attend cet événement.
  if (document.readyState === 'complete') init();
  else document.addEventListener('DOMContentLoaded', init);
})();
