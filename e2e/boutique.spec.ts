/**
 * Critère de J5 (guide 20) : une vente entre deux comptes, dans deux navigateurs. Le vendeur met en vente,
 * l'acheteur trouve l'annonce et l'achète ; l'or et l'objet changent de mains ; le vendeur est notifié.
 */
import { expect, test, type Browser, type Page } from '@playwright/test';
import { verifyEmail } from './support.ts';

async function newPlayer(browser: Browser, tag: string): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  const stamp = `${Date.now() % 1_000_000}${Math.floor(Math.random() * 100)}`;
  const email = `${tag}-${stamp}@example.org`;
  await page.goto('/inscription');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Pseudo').fill(`${tag} ${stamp}`.slice(0, 20));
  await page.getByLabel('Mot de passe').fill('motdepasse-long');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: /créer/i }).click();
  await expect(page.getByText('Vérifiez votre boîte mail').first()).toBeVisible();
  verifyEmail(email); // les boutiques exigent une adresse vérifiée
  await page.goto('/connexion');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Mot de passe').fill('motdepasse-long');
  await page.getByRole('button', { name: /connecter/i }).click();
  await expect(page.getByRole('heading', { name: 'Havre-Gris' })).toBeVisible();
  return page;
}

test('vente entre deux comptes à la boutique de Havre-Gris', async ({ browser }) => {
  const seller = await newPlayer(browser, 'Vendeur');
  const buyer = await newPlayer(browser, 'Acheteur');
  const errors: string[] = [];
  for (const p of [seller, buyer]) p.on('pageerror', (e) => errors.push(e.message));

  // Le vendeur met en vente 2 de ses 3 bandages, 30 or le lot.
  await seller.goto('/boutique');
  const stackForm = seller.locator('form').filter({ has: seller.locator('input[name="kind"][value="stack"]') });
  await stackForm.getByLabel('Objet').selectOption('bandage');
  await stackForm.getByLabel('Quantité').fill('2');
  await stackForm.getByLabel('Prix total').fill('30');
  await stackForm.getByRole('button', { name: 'Mettre en vente' }).click();
  await expect(seller.getByText('votre annonce')).toBeVisible();

  // L'acheteur la trouve par la recherche et l'achète.
  await buyer.goto('/boutique');
  await buyer.getByLabel('Nom').fill('bandage');
  await buyer.getByRole('button', { name: 'Chercher' }).click();
  const offer = buyer.locator('li', { hasText: 'Bandage × 2' }).filter({ hasText: '30 or' });
  await expect(offer).toBeVisible();
  await offer.getByRole('button', { name: 'Acheter' }).click();
  await expect(buyer.getByText('970 or')).toBeVisible(); // 1000 − 30
  await buyer.goto('/sac');
  await expect(buyer.getByText('Bandage × 5')).toBeVisible(); // 3 du départ + 2

  // Le vendeur a son or (moins la taxe de 5 %) et une notification.
  await seller.goto('/ville');
  await expect(seller.getByText('1028 or')).toBeVisible(); // 1000 + 30 − 2
  await seller.getByRole('link', { name: /Notifications non lues/ }).click();
  await expect(seller.getByText(/Vente à Havre-Gris : Bandage × 2 pour 30 or/)).toBeVisible();
  await seller.getByRole('button', { name: 'Tout marquer comme lu' }).click();
  await expect(seller.getByRole('link', { name: /Notifications non lues/ })).toHaveCount(0);

  // L'historique des prix de la ville garde la vente.
  await buyer.goto('/boutique/historique/bandage');
  await expect(buyer.getByText('Prix moyen des 20 dernières ventes : 15 or l’unité.')).toBeVisible();
  expect(errors).toEqual([]);
});
