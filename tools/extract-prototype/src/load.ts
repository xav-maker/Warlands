/**
 * Charge le code du prototype (prototype-extrait/, proto-0.4-ville) dans un bac à sable Node, dans l'ordre
 * du bundle publié, et rend ses définitions globales. Le prototype reste la source de vérité des règles
 * (guide 4) : ce chargeur ne modifie rien, il ne fait qu'exposer ce que le bundle définit.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

export const PROTOTYPE_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../../prototype-extrait');

/** Ordre du bundle (dépendances avant usages). L'interface (app, dom, codex, pixel, replay, strategie) n'est pas chargée. */
const FILES = ['engine', 'content', 'sorts', 'ia', 'unites', 'bestiaire', 'monde', 'gen', 'quetes', 'jeu'];

/** Assistant que esbuild insère en tête du bundle pour les champs de classe. */
const PRELUDE = `var __defProp = Object.defineProperty;
var __publicField = (obj, key, value) => (__defProp(obj, typeof key !== "symbol" ? key + "" : key, { enumerable: true, configurable: true, writable: true, value }), value);
`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Proto = Record<string, any>;

export function loadPrototype(): Proto {
  const code = PRELUDE + FILES.map((f) => readFileSync(join(PROTOTYPE_DIR, `${f}.js`), 'utf8')).join('\n');
  const ctx = vm.createContext({ console });
  vm.runInContext(code, ctx, { filename: 'prototype.js' });
  return ctx as Proto;
}
