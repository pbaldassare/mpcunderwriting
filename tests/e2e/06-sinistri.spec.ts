import { test, expect } from '@playwright/test';
import { STORAGE_STATE, expectPageHealthy } from '../helpers/auth-helper';

test.use({ storageState: STORAGE_STATE });

test.describe('Sinistri', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/sinistri');
    await expectPageHealthy(page);
  });

  test('mostra intestazione, ricerca e bottone "Nuovo Sinistro"', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /Sinistri/ })).toBeVisible();
    await expect(page.getByPlaceholder('Cerca per numero, descrizione...')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Nuovo Sinistro' })).toBeVisible();
  });

  test('il bottone "Nuovo Sinistro" porta al wizard di apertura', async ({ page }) => {
    await page.getByRole('button', { name: 'Nuovo Sinistro' }).click();
    await expect(page).toHaveURL(/\/sinistri\/apertura/);
    await expect(page.getByRole('heading', { name: /Apertura Nuovo Sinistro/i })).toBeVisible();
  });

  test('le sottopagine Sinistri si caricano', async ({ page }) => {
    for (const sub of ['/sinistri/apertura', '/sinistri/prescrizioni', '/sinistri/report-sir']) {
      await page.goto(sub);
      await expectPageHealthy(page);
      await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 15_000 });
    }
  });
});
