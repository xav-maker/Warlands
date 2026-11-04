/** Outils d'exploitation lancés par les parcours (les mêmes qu'en production : `node dist/<outil>.js`). */
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { DATABASE_URL } from './playwright.config.ts';

function tool(name: string, args: string[]): void {
  const file = join(import.meta.dirname, `../apps/web/dist/${name}.js`);
  execFileSync(process.execPath, [file, ...args], { env: { ...process.env, DATABASE_URL }, stdio: 'pipe' });
}

/** Marque l'adresse d'un compte comme vérifiée (le lien du courriel n'est pas lisible depuis le navigateur). */
export const verifyEmail = (email: string): void => tool('verify-email', [email]);

/** Code TOTP du moment pour une clé affichée sur la page Compte (le rôle d'une application d'authentification). */
export { totpCode } from '../packages/domain/src/totp.ts';

/** Nomme un modérateur ou un administrateur. */
export const grantRole = (email: string, role: 'moderator' | 'admin'): void => tool('grant-role', [email, role]);
