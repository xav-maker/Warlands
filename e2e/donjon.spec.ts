/**
 * Critère de J7 (guide 20) : un donjon à deux navigateurs. L'ouvreuse trouve une porte (outil de test : la porte
 * n'apparaît qu'à 2 %), invite au hasard ; le renfort, disponible, reçoit l'invitation en direct et rejoint. Chacun
 * se dit prêt, le second lance le combat de la salle 1 chez les deux ; puis le renfort sort avec son coffre et
 * l'ouvreuse continue seule.
 */
import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { expect, test, type Browser, type Page } from '@playwright/test';
import { DATABASE_URL } from './playwright.config.ts';

const stamp = `${Date.now() % 1_000_000}`;

async function newPlayer(browser: Browser, tag: string): Promise<{ page: Page; pseudo: string }> {
  const page = await (await browser.newContext()).newPage();
  const pseudo = `${tag} ${stamp}`.slice(0, 20);
  const email = `${tag.toLowerCase()}-${stamp}@example.org`;
  await page.goto('/inscription');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Pseudo').fill(pseudo);
  await page.getByLabel('Mot de passe').fill('motdepasse-long');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: /créer/i }).click();
  await expect(page.getByText('Vérifiez votre boîte mail').first()).toBeVisible();
  await page.goto('/connexion');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Mot de passe').fill('motdepasse-long');
  await page.getByRole('button', { name: /connecter/i }).click();
  await expect(page.getByRole('heading', { name: 'Havre-Gris' })).toBeVisible();
  // Escouade de niveau 30 (tools/seed-dev, base locale seulement : le jeu ne donne aucune troupe) et rediffusion à la
  // vitesse maximale.
  execSync(`pnpm -s seed-dev squad ${email}`, {
    env: { ...process.env, DATABASE_URL },
    cwd: join(import.meta.dirname, '..'),
    stdio: 'pipe',
  });
  await page.evaluate(() => localStorage.setItem('cr.replay.speed', '100'));
  return { page, pseudo };
}

/** Attend la fin de la rediffusion, puis continue. */
async function watch(page: Page): Promise<void> {
  await expect(page).toHaveURL(/\/combat\/\d+$/);
  const cont = page.getByRole('link', { name: 'Continuer' });
  await expect(cont).toBeVisible({ timeout: 120_000 });
  await expect(page.getByRole('heading', { name: 'Victoire' })).toBeVisible();
  await cont.click();
  await expect(page).toHaveURL(/\/donjon$/);
}

test('donjon à deux navigateurs : invitation au hasard, salle jouée ensemble, sortie de l’un', async ({ browser }) => {
  const a = await newPlayer(browser, 'Ouvreuse');
  const b = await newPlayer(browser, 'Renfort');
  const errors: string[] = [];
  for (const p of [a.page, b.page]) p.on('pageerror', (e) => errors.push(e.message));

  // Le renfort se déclare disponible pour un donjon à deux et attend en ville.
  await b.page.goto('/ville');
  await b.page.getByRole('button', { name: 'Me déclarer disponible' }).click();
  await expect(b.page.getByRole('button', { name: 'Ne plus être disponible' })).toBeVisible();

  // L'ouvreuse part sur les Prés de Brande, fait apparaître la porte et invite au hasard.
  await a.page.goto('/ville');
  await a.page.locator('form[action="/depart"]', { hasText: 'Prés de Brande' }).getByRole('button', { name: 'Partir' }).click();
  await expect(a.page).toHaveURL(/\/route$/);
  await a.page.getByRole('button', { name: 'Faire apparaître la porte' }).click();
  await expect(a.page.getByRole('heading', { name: 'Une porte de donjon' })).toBeVisible();
  await a.page.getByRole('button', { name: 'Inviter un joueur au hasard' }).click();
  await expect(a.page.getByRole('heading', { name: 'En attente d’un partenaire' })).toBeVisible();

  // L'invitation arrive en direct chez le renfort, qui rejoint ; la page de l'ouvreuse se met à jour.
  const toast = b.page.locator('#toasts a', { hasText: `${a.pseudo} vous invite dans le donjon Terriers du Roi Kobold` });
  await expect(toast).toBeVisible();
  await toast.click();
  await b.page.getByRole('button', { name: 'Rejoindre' }).click();
  await expect(b.page.getByText(`donjon à deux, avec ${a.pseudo}`)).toBeVisible();
  await expect(a.page.getByText(`donjon à deux, avec ${b.pseudo}`)).toBeVisible();

  // Chacun se dit prêt ; le second lance le combat, qui s'ouvre chez les deux.
  await a.page.getByRole('button', { name: 'Prêt pour la salle 1' }).click();
  await expect(a.page.getByText(`le combat commence quand ${b.pseudo} l’est aussi`)).toBeVisible();
  await expect(b.page.getByText('prêt', { exact: true })).toBeVisible();
  await b.page.getByRole('button', { name: 'Prêt pour la salle 1' }).click();
  await watch(b.page);
  await watch(a.page);
  await expect(a.page.getByRole('heading', { name: 'Salle 2' })).toBeVisible();

  // Le renfort sort avec son coffre ; l'ouvreuse continue seule.
  await b.page.getByRole('button', { name: 'Quitter le donjon avec le coffre' }).click();
  await expect(b.page.getByRole('heading', { name: 'Havre-Gris' })).toBeVisible();
  await expect(a.page.getByRole('button', { name: 'Combattre la salle 2' })).toBeVisible();
  // L'or de la salle 1 (10 × 1² × 1,25, arrondi) est versé à la sortie : 1 000 + 13.
  await expect(b.page.locator('.gold')).toHaveText('1013 or');
  expect(errors).toEqual([]);
});
