/**
 * Critère de J6 (guide 20) : un chat entre deux navigateurs, des sanctions appliquées. Alice et Bob discutent
 * en direct (flux SSE, sans recharger la page) ; Alice signale un message ; un modérateur sanctionne Bob :
 * la sourdine tombe en direct chez lui, puis une suspension le déconnecte.
 */
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { expect, test, type Browser, type Page } from '@playwright/test';
import { DATABASE_URL } from './playwright.config.ts';

const stamp = `${Date.now() % 1_000_000}`;
let ips = 0;

async function newPlayer(browser: Browser, tag: string): Promise<{ page: Page; pseudo: string; email: string }> {
  // Une adresse par joueur (l'application est derrière un proxy) : l'inscription est limitée à 5 par minute et par IP.
  const ctx = await browser.newContext({ extraHTTPHeaders: { 'x-forwarded-for': `10.66.${Date.now() % 250}.${++ips}` } });
  const page = await ctx.newPage();
  const pseudo = `${tag} ${stamp}`.slice(0, 20);
  const email = `${tag.toLowerCase()}-${stamp}@example.org`;
  await page.goto('/inscription');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Pseudo').fill(pseudo);
  await page.getByLabel('Mot de passe').fill('motdepasse-long');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: /créer/i }).click();
  await page.goto('/connexion');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Mot de passe').fill('motdepasse-long');
  await page.getByRole('button', { name: /connecter/i }).click();
  await expect(page.getByRole('heading', { name: 'Havre-Gris' })).toBeVisible();
  return { page, pseudo, email };
}

/** Nomme un modérateur avec l'outil d'exploitation (le même qu'en production). */
function grant(email: string, role: 'moderator' | 'admin'): void {
  const tool = join(import.meta.dirname, '../apps/web/dist/grant-role.js');
  execFileSync(process.execPath, [tool, email, role], { env: { ...process.env, DATABASE_URL }, stdio: 'pipe' });
}

const hello = `Bonjour Bob ${stamp}, <b>prêt</b> pour les Ronces ?`;
const retort = `Pas comme ce connard de gobelin ${stamp}`;
const retortShown = `Pas comme ce ******* de gobelin ${stamp}`;

async function say(page: Page, text: string): Promise<void> {
  await page.getByLabel('Message').fill(text);
  await page.getByRole('button', { name: 'Envoyer' }).click();
}

test('chat en direct entre deux navigateurs, signalement, sanctions', async ({ browser }) => {
  const alice = await newPlayer(browser, 'Alice');
  const bob = await newPlayer(browser, 'Bob');
  const mod = await newPlayer(browser, 'Mod');
  grant(mod.email, 'moderator');
  const errors: string[] = [];
  for (const p of [alice.page, bob.page, mod.page]) p.on('pageerror', (e) => errors.push(e.message));

  // Les deux joueurs ouvrent le chat de la région.
  await alice.page.goto('/chat');
  await bob.page.goto('/chat');
  await expect(alice.page.getByRole('heading', { name: 'Pays de Havre-Gris' })).toBeVisible();

  // Alice parle : Bob voit le message arriver sans recharger sa page.
  await say(alice.page, hello);
  await expect(bob.page.locator('#chat-log')).toContainText(hello);
  await expect(alice.page.locator('#chat-log')).toContainText(hello); // son propre message aussi
  expect(await bob.page.locator('#chat-log b', { hasText: 'prêt' }).count()).toBe(0); // échappé, jamais du HTML

  // Bob répond, avec un mot masqué par le filtre.
  await alice.page.waitForTimeout(1100); // limite d'un message par seconde
  await say(bob.page, retort);
  await expect(alice.page.locator('#chat-log')).toContainText(retortShown);
  await expect(bob.page.getByLabel('Message')).toHaveValue(''); // champ vidé après l'envoi

  // Alice signale le message de Bob.
  await alice.page.locator('li', { hasText: retortShown }).getByRole('link', { name: 'signaler' }).click();
  await expect(alice.page.getByText(retortShown)).toBeVisible();
  await alice.page.getByLabel('Motif').selectOption('insulte');
  await alice.page.getByRole('button', { name: 'Envoyer le signalement' }).click();
  await expect(alice.page.getByText(/signalement a été transmis/)).toBeVisible();

  // Messages privés en direct : Alice écrit à Bob, qui a la conversation ouverte.
  await bob.page.goto(`/messages/${encodeURIComponent(alice.pseudo)}`);
  await alice.page.goto(`/messages/${encodeURIComponent(bob.pseudo)}`);
  await alice.page.getByLabel('Message').fill(`Rendez-vous à la sortie de la ville ${stamp}.`);
  await alice.page.getByRole('button', { name: 'Envoyer' }).click();
  await expect(bob.page.locator('#thread')).toContainText(`Rendez-vous à la sortie de la ville ${stamp}.`);
  await bob.page.goto('/chat');

  // Le modérateur traite le signalement et rend Bob muet : la sanction tombe en direct chez Bob.
  await mod.page.goto('/moderation');
  await mod.page.getByRole('link', { name: new RegExp(`#\\d+ · ${bob.pseudo}`) }).click();
  await expect(mod.page.getByText(retortShown).first()).toBeVisible();
  const bobId = (await mod.page.locator('form[action="/moderation/sanction"] input[name="player"]').getAttribute('value'))!;
  await mod.page.getByLabel('Durée en heures').fill('2');
  await mod.page.getByLabel(/Motif \(communiqué/).fill('Insulte dans le chat de région');
  await mod.page.getByRole('button', { name: /Appliquer et classer/ }).click();
  await expect(mod.page.getByRole('heading', { name: 'Signalements' })).toBeVisible();
  await expect(bob.page.locator('#toasts')).toContainText('Sourdine');
  await expect(bob.page.locator('#toasts')).toContainText('Insulte dans le chat de région');

  // Bob ne peut plus parler ; Alice est informée de la décision.
  await bob.page.getByLabel('Message').fill('Je peux encore écrire ?');
  await bob.page.getByRole('button', { name: 'Envoyer' }).click();
  await expect(bob.page.locator('#flash')).toContainText('réduit au silence');
  await alice.page.goto('/notifications');
  await expect(alice.page.getByText(/Votre signalement #\d+ est traité : Sourdine .* Insulte dans le chat de région/)).toBeVisible();

  // Récidive : suspension. Bob est déconnecté, et ne peut plus se reconnecter.
  await mod.page.goto(`/moderation/joueur/${bobId}`);
  await mod.page.getByLabel('Sanction').selectOption('suspend');
  await mod.page.getByLabel('Durée en heures').fill('3');
  await mod.page.getByLabel(/Motif \(communiqué/).fill('Récidive après sourdine');
  await mod.page.getByRole('button', { name: 'Appliquer' }).click();
  await bob.page.goto('/chat');
  await expect(bob.page).toHaveURL(/\/connexion/);
  await bob.page.getByLabel('E-mail').fill(bob.email);
  await bob.page.getByLabel('Mot de passe').fill('motdepasse-long');
  await bob.page.getByRole('button', { name: /connecter/i }).click();
  await expect(bob.page.getByRole('alert').first()).toHaveText('Ce compte est suspendu.');

  // Les actions de la modération sont au journal d'administration.
  await mod.page.goto('/moderation/journal');
  await expect(mod.page.getByText('sanction.suspend').first()).toBeVisible();
  expect(errors).toEqual([]);
});
