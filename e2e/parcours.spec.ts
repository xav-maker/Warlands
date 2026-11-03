/**
 * Critère de fin de J2 (guide 20) : de Havre-Gris à la première route, jusqu'au gardien, puis à la ville
 * suivante, en regardant chaque rediffusion jusqu'au bout (README 10.2).
 */
import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { DATABASE_URL } from './playwright.config.ts';

test('Havre-Gris → Forêt des Ronces → gardien → Port-Salant', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  const email = `e2e-${Date.now()}@example.org`;

  // Inscription puis connexion.
  await page.goto('/inscription');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Pseudo').fill(`E2E ${Date.now() % 100000}`);
  await page.getByLabel('Mot de passe').fill('motdepasse-long');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: /créer/i }).click();
  await expect(page.getByRole('heading', { name: 'Vérifiez votre boîte mail' })).toBeVisible();
  await page.goto('/connexion');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Mot de passe').fill('motdepasse-long');
  await page.getByRole('button', { name: /connecter/i }).click();
  await expect(page.getByRole('heading', { name: 'Havre-Gris' })).toBeVisible();
  await expect(page.getByText('200 or')).toBeVisible();

  // Escouade de test (tools/seed-dev) : deux recrues de niveau 1 ne passent pas le gardien.
  execSync(`pnpm -s seed-dev squad ${email}`, {
    env: { ...process.env, DATABASE_URL },
    cwd: join(import.meta.dirname, '..'),
    stdio: 'pipe',
  });
  await page.reload();
  await expect(page.getByText('Briseur')).toBeVisible();

  // Rediffusion à la vitesse maximale (réglage gardé par le navigateur).
  await page.evaluate(() => localStorage.setItem('cr.replay.speed', '100'));
  await page.getByRole('button', { name: 'Partir' }).first().click();
  await expect(page).toHaveURL(/\/route$/);

  for (let step = 1; step <= 5; step++) {
    await page.getByRole('button', { name: 'Combattre' }).click();
    await expect(page).toHaveURL(/\/combat\/\d+$/);
    // La rediffusion se joue (canvas 8 bits), l'issue reste cachée jusqu'au bout.
    await expect(page.locator('#replay canvas')).toBeVisible();
    const cont = page.getByRole('link', { name: 'Continuer' });
    await expect(cont).toBeVisible({ timeout: 120_000 });
    await expect(page.getByRole('heading', { name: 'Victoire' })).toBeVisible();
    await cont.click();
    await expect(page).toHaveURL(/\/route$/);
    if (step < 5) await page.getByRole('button', { name: 'Avancer' }).click();
  }
  await page.getByRole('button', { name: 'Arriver à Port-Salant' }).click();
  await expect(page.getByRole('heading', { name: 'Port-Salant' })).toBeVisible();
  // Objet de première victoire sur le gardien des Ronces, dans le sac.
  await page.goto('/sac');
  await expect(page.getByText('Cœur de ronce')).toBeVisible();
  expect(errors).toEqual([]);
});
