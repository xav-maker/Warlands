/**
 * content-cli (guide 5.2 à 5.4) : valider, compiler le contenu, regénérer l'annexe.
 *
 *   pnpm content validate [dossier]                  erreurs et avertissements ; code 1 s'il y a une erreur
 *   pnpm content compile  [dossier] [--out pack.json] pack JSON et son empreinte SHA-256
 *   pnpm content annexe   [dossier] [--out fichier]   annexe de contenu en Markdown
 *   pnpm content simulate [dossier] [--fights N] [--runs N] [--bare] [--out fichier]  équilibrage contre les escouades de
 *                                                    référence, équipées au palier (--bare : sans équipement)
 *   pnpm content diff     <ancien> [nouveau] [--out fichier]       différence de deux packs (dossiers ou JSON)
 *
 * Dossier par défaut : content/. La publication des packs viendra avec leur déploiement (guide 5.4, 17.3).
 */
import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { validateContent } from '@cr/content';
import type { Issue } from '@cr/content';
import type { GenContent } from '@cr/gen';
import { annexe } from './annexe.ts';
import { diffPacks } from './diff.ts';
import { dungeonReport, loadSquads, report as simReport, simulate, simulateDungeons, SQUADS_FILE } from './simulate.ts';

const [cmd, ...rest] = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const i = rest.indexOf(`--${name}`);
  return i >= 0 ? rest[i + 1] : undefined;
};
const positional = rest.filter((a, i) => !a.startsWith('--') && (rest[i - 1] === '--bare' || !rest[i - 1]?.startsWith('--')));
const dir = resolve(process.env.INIT_CWD ?? process.cwd(), positional[0] ?? 'content');
const outPath = (p: string | undefined): string | undefined => (p ? resolve(process.env.INIT_CWD ?? process.cwd(), p) : undefined);

function report(issues: Issue[]): void {
  for (const i of issues) console.log(`${i.level === 'error' ? 'ERREUR ' : 'avert. '} ${i.where} : ${i.message}`);
  const errors = issues.filter((i) => i.level === 'error').length;
  console.log(`${errors} erreur(s), ${issues.length - errors} avertissement(s)`);
}

const write = (text: string): void => {
  const out = outPath(flag('out'));
  if (out) writeFileSync(out, text);
  else process.stdout.write(text);
};
/** Pack d'un dossier de contenu ou d'un fichier JSON compilé. */
const packOf = (p: string): Record<string, unknown> => {
  const abs = resolve(process.env.INIT_CWD ?? process.cwd(), p);
  if (statSync(abs).isFile()) return JSON.parse(readFileSync(abs, 'utf8')) as Record<string, unknown>;
  const x = validateContent(abs);
  if (!x.ok) throw new Error(`${p} : pack invalide`);
  return x.pack!;
};

const v = cmd === 'diff' ? { ok: true, issues: [] } : validateContent(dir);
switch (cmd) {
  case 'simulate': {
    if (!v.ok) {
      report(v.issues);
      process.exitCode = 1;
      break;
    }
    const squads = loadSquads(SQUADS_FILE);
    const gear = !rest.includes('--bare');
    const rows = simulate(v.pack as unknown as GenContent, squads, { fights: Number(flag('fights') ?? 20), gear });
    const dungeons = simulateDungeons(v.pack as unknown as GenContent, squads, Number(flag('runs') ?? 20));
    write(simReport(rows, squads, { gear }) + (dungeons.length ? '\n' + dungeonReport(dungeons) : ''));
    break;
  }
  case 'diff':
    write(diffPacks(packOf(positional[0] ?? 'content'), packOf(positional[1] ?? 'content')));
    break;
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
    console.error('usage : content-cli validate|compile|annexe|simulate [dossier] [--out fichier] ; content-cli diff <ancien> [nouveau]');
    process.exitCode = 2;
}
