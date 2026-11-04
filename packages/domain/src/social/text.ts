/**
 * Texte des joueurs (guide 12, README 25) : nettoyage, longueur, filtre de mots.
 * Le texte reste du texte brut : il n'est jamais interprété comme du HTML (les vues échappent).
 */

/** Espaces et retours à la ligne ramenés à une espace, caractères de contrôle retirés, bords coupés. */
export function normalizeText(raw: string): string {
  return raw
    .normalize('NFC')
    .replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, (ch) => (/[\n\r\t\u2028\u2029]/.test(ch) ? ' ' : ''))
    .replace(/\s+/g, ' ')
    .trim();
}

/** Longueur en points de code (comme `char_length` de Postgres). */
export const textLength = (s: string): number => [...s].length;

/** Texte nettoyé, ou `null` s'il est vide ou trop long. */
export function cleanText(raw: string, max: number): string | null {
  const t = normalizeText(raw);
  return t && textLength(t) <= max ? t : null;
}

const LEET: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', $: 's' };

/** Lettre de base d'un caractère : sans accent, minuscule, chiffres d'argot ramenés à leur lettre. */
function base(ch: string): string {
  if (ch.length > 1) return '\uFFFD'; // hors plan de base (émoji) : un seul caractère neutre, pour garder les positions
  const d = ch.normalize('NFD')[0]!.toLowerCase();
  return LEET[d] ?? d;
}

const SEPARATORS = '[\\s.\\-_*]*';
const escapeRe = (s: string): string => s.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&');
const compiled = new WeakMap<readonly string[], RegExp | null>();

/** Expression qui reconnaît un mot de la liste, même coupé de séparateurs (« p.u.t.e »), entre deux non-lettres. */
function matcher(words: readonly string[]): RegExp | null {
  if (compiled.has(words)) return compiled.get(words)!;
  const parts = words
    .map((w) => [...w].map(base).filter((c) => c !== '\uFFFD'))
    .filter((cs) => cs.length >= 2)
    .map((cs) => cs.map(escapeRe).join(SEPARATORS));
  const re = parts.length ? new RegExp(`(?<![\\p{L}\\p{N}])(?:${parts.join('|')})(?![\\p{L}\\p{N}])`, 'gu') : null;
  compiled.set(words, re);
  return re;
}

/** Masque les mots interdits par des astérisques ; `hits` compte les infractions. */
export function filterWords(text: string, words: readonly string[]): { text: string; hits: number } {
  const re = matcher(words);
  if (!re) return { text, hits: 0 };
  const chars = [...text];
  const plain = chars.map(base).join('');
  let hits = 0;
  re.lastIndex = 0;
  for (const m of plain.matchAll(re)) {
    hits++;
    for (let i = m.index; i < m.index + m[0].length; i++) chars[i] = '*';
  }
  return { text: chars.join(''), hits };
}
