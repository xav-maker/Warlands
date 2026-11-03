/**
 * content-cli (guide 5.2 à 5.4) : valider, compiler le contenu, regénérer l'annexe.
 *
 *   pnpm content validate [dossier]                  erreurs et avertissements ; code 1 s'il y a une erreur
 *   pnpm content compile  [dossier] [--out pack.json] pack JSON et son empreinte SHA-256
 *   pnpm content annexe   [dossier] [--out fichier]   annexe de contenu en Markdown
 *
 * Dossier par défaut : content/. Simulation, différence de packs et publication viendront avec J4 et le
 * déploiement du contenu (guide 5.3, 5.4, 17.3).
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { validateContent } from '@cr/content';
import type { Issue } from '@cr/content';
import { annexe } from './annexe.ts';

const [cmd, ...rest] = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const i = rest.indexOf(`--${name}`);
  return i >= 0 ? rest[i + 1] : undefined;
};
const positional = rest.filter((a, i) => !a.startsWith('--') && !rest[i - 1]?.startsWith('--'));
const dir = resolve(process.env.INIT_CWD ?? process.cwd(), positional[0] ?? 'content');
const outPath = (p: string | undefined): string | undefined => (p ? resolve(process.env.INIT_CWD ?? process.cwd(), p) : undefined);

function report(issues: Issue[]): void {
  for (const i of issues) console.log(`${i.level === 'error' ? 'ERREUR ' : 'avert. '} ${i.where} : ${i.message}`);
  const errors = issues.filter((i) => i.level === 'error').length;
  console.log(`${errors} erreur(s), ${issues.length - errors} avertissement(s)`);
}

const v = validateContent(dir);
switch (cmd) {
  case 'validate':
    report(v.issues);
    if (v.ok) console.log(`pack ${String(v.pack!.id)} valide, empreinte ${v.hash}`);
    process.exitCode = v.ok ? 0 : 1;
    break;
  case 'compile': {
    if (!v.ok) {
      report(v.issues);
      process.exitCode = 1;
      break;
    }
    const json = JSON.stringify(v.pack);
    const out = outPath(flag('out'));
    if (out) writeFileSync(out, json);
    else process.stdout.write(json);
    console.error(`pack ${String(v.pack!.id)} : ${json.length} octets, empreinte ${v.hash}`);
    break;
  }
  case 'annexe': {
    if (!v.ok) {
      report(v.issues);
      process.exitCode = 1;
      break;
    }
    const text = annexe(v.pack as never, {
      source: flag('source') ?? 'le contenu YAML (`content/`)',
      date: flag('date') ?? new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }),
    });
    const out = outPath(flag('out'));
    if (out) writeFileSync(out, text);
    else process.stdout.write(text);
    break;
  }
  default:
    console.error('usage : content-cli validate|compile|annexe [dossier] [--out fichier]');
    process.exitCode = 2;
}
