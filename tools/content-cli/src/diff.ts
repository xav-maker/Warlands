/**
 * Différence de deux packs (guide 5.3) : entrées ajoutées, retirées et modifiées par collection, avec les
 * champs qui changent et leurs valeurs (abrégées). Les règles du jeu (params, online) sont comparées champ
 * par champ.
 */
type Json = unknown;

const show = (v: Json): string => {
  const s = JSON.stringify(v);
  return s.length > 80 ? `${s.slice(0, 77)}…` : s;
};
const same = (a: Json, b: Json): boolean => JSON.stringify(a) === JSON.stringify(b);

/** Champs qui diffèrent entre deux objets, à plat (a.b.c). */
function fields(a: Json, b: Json, prefix = '', out: string[] = [], depth = 0): string[] {
  if (same(a, b)) return out;
  const obj = (x: Json): x is Record<string, Json> => !!x && typeof x === 'object' && !Array.isArray(x);
  if (obj(a) && obj(b) && depth < 3) {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) fields(a[k], b[k], prefix ? `${prefix}.${k}` : k, out, depth + 1);
    return out;
  }
  out.push(`${prefix || '(valeur)'} : ${show(a)} → ${show(b)}`);
  return out;
}

const COLLECTIONS = ['skills', 'troops', 'monsters', 'items', 'equip', 'weapons'] as const;

export function diffPacks(a: Record<string, Json>, b: Record<string, Json>): string {
  const lines: string[] = [`# Différence de packs : ${String(a.id)} → ${String(b.id)}`, ''];
  for (const col of COLLECTIONS) {
    const A = (a[col] ?? {}) as Record<string, Json>;
    const B = (b[col] ?? {}) as Record<string, Json>;
    const added = Object.keys(B).filter((k) => !(k in A));
    const removed = Object.keys(A).filter((k) => !(k in B));
    const changed = Object.keys(B).filter((k) => k in A && !same(A[k], B[k]));
    if (!added.length && !removed.length && !changed.length) continue;
    lines.push(`## ${col} : +${added.length} −${removed.length} ~${changed.length}`, '');
    if (added.length) lines.push(`Ajoutés : ${added.join(', ')}.`, '');
    if (removed.length) lines.push(`Retirés : ${removed.join(', ')}.`, '');
    for (const k of changed) {
      lines.push(`- **${k}**`);
      for (const f of fields(A[k], B[k]).slice(0, 12)) lines.push(`  - ${f}`);
    }
    if (changed.length) lines.push('');
  }
  const lists = (x: Record<string, Json>, key: string): Record<string, Json> =>
    Object.fromEntries(((x[key] ?? []) as { id: string }[]).map((e) => [e.id, e]));
  for (const key of ['regions', 'routes', 'rares'] as const) {
    const A = lists(a, key);
    const B = lists(b, key);
    const added = Object.keys(B).filter((k) => !(k in A));
    const removed = Object.keys(A).filter((k) => !(k in B));
    const changed = Object.keys(B).filter((k) => k in A && !same(A[k], B[k]));
    if (!added.length && !removed.length && !changed.length) continue;
    lines.push(`## ${key} : +${added.length} −${removed.length} ~${changed.length}`, '');
    if (added.length) lines.push(`Ajoutés : ${added.join(', ')}.`, '');
    if (removed.length) lines.push(`Retirés : ${removed.join(', ')}.`, '');
    for (const k of changed) lines.push(`- **${k}** : ${fields(A[k], B[k]).slice(0, 6).join(' ; ')}`);
    if (changed.length) lines.push('');
  }
  const rules = [...fields(a.params, b.params, 'params'), ...fields(a.eco, b.eco, 'eco'), ...fields(a.online, b.online, 'online')];
  if (a.engineVersion !== b.engineVersion) rules.unshift(`engineVersion : ${String(a.engineVersion)} → ${String(b.engineVersion)}`);
  if (rules.length) lines.push('## Règles', '', ...rules.map((r) => `- ${r}`), '');
  if (lines.length === 2) lines.push('Aucune différence.');
  return lines.join('\n') + '\n';
}
