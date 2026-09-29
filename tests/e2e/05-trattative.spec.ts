import { test, expect } from '@playwright/test';
import { STORAGE_STATE, expectPageHealthy } from '../helpers/auth-helper';

test.use({ storageState: STORAGE_STATE });

test.describe('Trattative', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/trattative');
    await expectPageHealthy(page);
  });

  test('mostra intestazione, ricerca e bottone "Nuova Trattativa"', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Trattative', exact: true })).toBeVisible();
    await expect(page.getByPlaceholder('Cerca soggetto, agenzia, bando...')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Nuova Trattativa' })).toBeVisible();
  });

  test('il bottone "Nuova Trattativa" apre il form con azione "Crea Trattativa"', async ({ page }) => {
    await page.getByRole('button', { name: 'Nuova Trattativa' }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Nuova Trattativa')).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Crea Trattativa' })).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });
});
