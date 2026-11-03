/**
 * Rediffusion d'un combat dans la page (README 10.2 et 10.3, guide 7.1 « îlot JS »).
 *
 * La page fournit, dans <script type="application/json" id="replay-data">, l'adresse du journal et ce que
 * le serveur seul connaît (noms des capacités, apparences, décor, blocage restant). Pendant le blocage de
 * rediffusion : vue 8 bits seulement, barre de progression sans curseur, issue et bilan cachés jusqu'au bout.
 * Ensuite : curseur, vue tableau avec journal, bouton « Continuer ». Sans JavaScript, la page reste lisible.
 */
import { mountPixel, registerLooks } from './pixel.js';
import { paintReplay, renderReplay, setRerender, setSkillNames, stopReplay } from './replay.js';

interface ReplayData {
  journal: string;
  theme: number;
  waitMs: number;
  next: string;
  timeLimit: number;
  result: { winner: number | null; reason: string; time: number };
  skillNames: Record<string, string>;
  /** Définitions des capacités du combat (lues par la vue 8 bits). */
  skills: Record<string, unknown>;
  looks: Record<string, unknown>;
}

interface Journal {
  units: { id: string; side: number; name: string }[];
  log: { k: string; t: number }[];
}

const SPEEDS: [number, string][] = [
  [10, 'lent'],
  [25, 'normal'],
  [50, 'rapide ×2'],
  [100, 'très rapide ×4'],
];

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  ...kids: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  e.append(...kids);
  return e;
}

function storedSpeed(): number {
  try {
    return Number(localStorage.getItem('cr.replay.speed')) || 25;
  } catch {
    return 25;
  }
}

async function main(): Promise<void> {
  const root = document.getElementById('replay');
  const dataEl = document.getElementById('replay-data');
  if (!root || !dataEl) return;
  const data = JSON.parse(dataEl.textContent ?? '{}') as ReplayData;
  const res = await fetch(data.journal, { credentials: 'same-origin' });
  if (!res.ok) return;
  const j = (await res.json()) as Journal;
  registerLooks(data.looks);
  setSkillNames(data.skillNames);
  const rec = { input: { units: j.units, params: { timeLimit: data.timeLimit }, skills: data.skills }, log: j.log, result: data.result };
  const end = j.log[j.log.length - 1]!.t;
  const deadline = Date.now() + data.waitMs;
  let watching = data.waitMs > 0;

  // L'issue et le bilan attendent la fin de la lecture (ou que le joueur y saute, une fois le blocage passé).
  const spoilers = [...document.querySelectorAll<HTMLElement>('[data-after-replay]')];
  for (const s of spoilers) s.hidden = true;
  const reveal = (): void => {
    for (const s of spoilers) s.hidden = false;
  };

  const canvas = el('canvas', {
    role: 'img',
    'aria-label': 'Combat en pixel art : votre escouade à gauche, les monstres à droite, ligne de front au milieu',
  });
  const play = el('button', { type: 'button', class: 'icon', 'aria-label': 'Pause' }, '⏸');
  const restart = el('button', { type: 'button', class: 'icon', 'aria-label': 'Recommencer', title: 'Recommencer' }, '⏮');
  const speed = el('select', { 'aria-label': 'Vitesse' });
  for (const [v, l] of SPEEDS) speed.append(el('option', { value: String(v) }, l));
  speed.value = String(storedSpeed());
  const progress = el('progress', { max: String(end), value: '0', 'aria-label': 'Avancement du combat' });
  const scrub = el('input', { type: 'range', min: '0', max: String(end), value: '0', 'aria-label': 'Instant du combat' });
  const clock = el('span', {}, 'instant 0');
  const done = el('div', { class: 'row gap watch-done' });
  done.hidden = true;
  const views = el('div', { class: 'seg', role: 'group', 'aria-label': 'Vue' });
  const pixelBtn = el('button', { type: 'button', class: 'on', 'aria-pressed': 'true' }, 'Vue 8 bits');
  const tableBtn = el('button', { type: 'button', 'aria-pressed': 'false' }, 'Vue tableau et journal');
  views.append(pixelBtn, tableBtn);
  views.hidden = watching;
  const pixelView = el(
    'div',
    { class: 'pixel-view' },
    el('div', { class: 'pixel-frame' }, canvas),
    el(
      'div',
      { class: 'player' },
      el('div', { class: 'row gap-s' }, restart, play, speed),
      watching ? progress : scrub,
      el('div', { class: 'clock' }, clock, el('span', { class: 'dim' }, ` / ${end}`)),
    ),
    el(
      'div',
      { class: 'legend' },
      el('span', {}, el('i', { style: 'background:#58d068' }), 'PV'),
      el('span', {}, el('i', { style: 'background:#4a9cf0' }), 'mana'),
      el('span', {}, 'Points à droite d’une unité : ses états · « ? » désobéit · « !! » panique · « ... » attend'),
    ),
  );
  const tableView = el('div', {});
  tableView.hidden = true;
  root.replaceChildren(views, pixelView, tableView, done);

  function showDone(): void {
    if (!done.hidden) return;
    const left = deadline - Date.now();
    if (left > 0) {
      // La lecture est allée plus vite que le blocage du serveur (vitesse maximale dépassée ? horloge ?) : on attend.
      setTimeout(showDone, left + 50);
      return;
    }
    watching = false;
    reveal();
    done.replaceChildren(el('a', { class: 'btn primary', href: data.next }, 'Continuer'));
    done.hidden = false;
    views.hidden = false;
    if (progress.isConnected) progress.replaceWith(scrub);
    done.querySelector('a')?.focus();
  }

  let shown = -1;
  let was: boolean | null = null;
  const px = mountPixel(
    canvas,
    rec.input,
    rec.log,
    {
      onIndex() {},
      onClock(t: number, playing: boolean) {
        if (t !== shown) {
          shown = t;
          clock.textContent = `instant ${t}`;
          progress.value = t;
          if (document.activeElement !== scrub) scrub.value = String(t);
          if (t >= end) showDone();
        }
        if (playing !== was) {
          was = playing;
          play.textContent = playing ? '⏸' : '▶';
          play.setAttribute('aria-label', playing ? 'Pause' : 'Lecture');
        }
      },
    },
    data.theme,
  );
  px.setSpeed(Number(speed.value));
  px.play();
  play.addEventListener('click', () => px.toggle());
  restart.addEventListener('click', () => px.restart());
  speed.addEventListener('change', () => {
    px.setSpeed(Number(speed.value));
    try {
      localStorage.setItem('cr.replay.speed', speed.value);
    } catch {
      /* navigation privée : la vitesse n'est pas gardée */
    }
  });
  scrub.addEventListener('input', () => {
    if (watching) return;
    px.seek(Number(scrub.value));
    if (Number(scrub.value) >= end) showDone();
  });

  // Vue tableau (prototype replay.js), disponible une fois la rediffusion regardée.
  const showTable = (): void => {
    tableView.replaceChildren(renderReplay(rec, null));
    paintReplay();
  };
  setRerender(showTable);
  pixelBtn.addEventListener('click', () => {
    stopReplay();
    tableView.hidden = true;
    pixelView.hidden = false;
    pixelBtn.className = 'on';
    tableBtn.className = '';
    pixelBtn.setAttribute('aria-pressed', 'true');
    tableBtn.setAttribute('aria-pressed', 'false');
  });
  tableBtn.addEventListener('click', () => {
    if (watching) return;
    px.pause();
    pixelView.hidden = true;
    tableView.hidden = false;
    tableBtn.className = 'on';
    pixelBtn.className = '';
    tableBtn.setAttribute('aria-pressed', 'true');
    pixelBtn.setAttribute('aria-pressed', 'false');
    showTable();
    showDone();
  });
}

void main();
