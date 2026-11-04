/** Contenu actif du serveur web (voir @cr/content › active.ts). */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findContentDir, loadActivePack } from '@cr/content';
import type { GameContent } from '@cr/domain';
import type { GenContent } from '@cr/gen';

const here = dirname(fileURLToPath(import.meta.url));

/** content/ : CONTENT_DIR, sinon à côté de l'application empaquetée (image), sinon à la racine du dépôt. */
export const contentDir = (env: NodeJS.ProcessEnv = process.env): string =>
  findContentDir([join(here, '..', 'content'), join(here, '..', '..', '..', 'content')], env);

export function loadGameContent(dir = contentDir()): GameContent {
  const { pack, hash } = loadActivePack(dir);
  return { pack: pack as unknown as GenContent, hash };
}
