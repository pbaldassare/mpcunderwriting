import { test, expect } from '@playwright/test';
import { STORAGE_STATE, expectPageHealthy } from '../helpers/auth-helper';

test.use({ storageState: STORAGE_STATE });

test.describe('Polizze / Titoli', () => {
  test('elenco polizze: intestazione e bottone "Nuovo Titolo"', async ({ page }) => {
    await page.goto('/titoli');
    await expectPageHealthy(page);
    await expect(page.getByRole('heading', { name: 'Elenco Polizze' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Nuovo Titolo' })).toBeVisible();
  });

  test('il bottone "Nuovo Titolo" apre il form con azione "Crea Titolo"', async ({ page }) => {
    await page.goto('/titoli');
    await expectPageHealthy(page);
    await page.getByRole('button', { name: 'Nuovo Titolo' }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Nuovo Titolo')).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Crea Titolo' })).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  test('Polizze Attive: la pagina di portafoglio si carica', async ({ page }) => {
    await page.goto('/portafoglio/attive');
    await expectPageHealthy(page);
    // Deve renderizzare un\'intestazione o una tabella
    const heading = page.locator('h1, h2').first();
    await expect(heading).toBeVisible({ timeout: 15_000 });
  });
});
