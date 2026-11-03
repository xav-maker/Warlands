/**
 * Contenu actif : compilé depuis content/ (YAML) au démarrage, refusé s'il est invalide. La publication de
 * packs en base (content_pack, guide 5.4) viendra avec le déploiement du contenu (guide 17.3).
 */
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateContent } from '@cr/content';
import type { GameContent } from '@cr/domain';
import type { GenContent } from '@cr/gen';

const here = dirname(fileURLToPath(import.meta.url));

/** content/ : CONTENT_DIR, sinon à côté de l'application empaquetée (image), sinon à la racine du dépôt. */
export function contentDir(env: NodeJS.ProcessEnv = process.env): string {
  const candidates = [env.CONTENT_DIR, join(here, '..', 'content'), join(here, '..', '..', '..', 'content')].filter(Boolean) as string[];
  const dir = candidates.find((d) => existsSync(join(d, 'pack.yaml')));
  if (!dir) throw new Error(`content/ introuvable (cherché : ${candidates.join(', ')})`);
  return dir;
}

export function loadGameContent(dir = contentDir()): GameContent {
  const v = validateContent(dir);
  if (!v.ok) {
    const errors = v.issues.filter((i) => i.level === 'error').map((i) => `${i.where} : ${i.message}`);
    throw new Error(`Contenu invalide (${dir}) :\n${errors.join('\n')}`);
  }
  return { pack: v.pack as unknown as GenContent, hash: v.hash! };
}
