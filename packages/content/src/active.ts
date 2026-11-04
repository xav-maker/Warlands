/**
 * Contenu actif d'un processus (web ou worker) : compilé depuis content/ (YAML) au démarrage, refusé s'il est invalide.
 * La publication de packs en base (content_pack, guide 5.4) viendra avec le déploiement du contenu (guide 17.3).
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Pack } from './compile.ts';
import { validateContent } from './validate.ts';

/** content/ : CONTENT_DIR, sinon le premier des dossiers proposés qui contient pack.yaml. */
export function findContentDir(candidates: string[], env: NodeJS.ProcessEnv = process.env): string {
  const list = [env.CONTENT_DIR, ...candidates].filter(Boolean) as string[];
  const dir = list.find((d) => existsSync(join(d, 'pack.yaml')));
  if (!dir) throw new Error(`content/ introuvable (cherché : ${list.join(', ')})`);
  return dir;
}

/** Pack compilé et son empreinte ; lève une erreur qui liste les fautes si le contenu est invalide. */
export function loadActivePack(dir: string): { pack: Pack; hash: string } {
  const v = validateContent(dir);
  if (!v.ok) {
    const errors = v.issues.filter((i) => i.level === 'error').map((i) => `${i.where} : ${i.message}`);
    throw new Error(`Contenu invalide (${dir}) :\n${errors.join('\n')}`);
  }
  return { pack: v.pack!, hash: v.hash! };
}
