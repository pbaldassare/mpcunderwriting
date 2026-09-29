import { test, expect } from '@playwright/test';
import { STORAGE_STATE, expectPageHealthy } from '../helpers/auth-helper';

test.use({ storageState: STORAGE_STATE });

test.describe('Anagrafica Clienti', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/archivi/clienti');
    await expectPageHealthy(page);
  });

  test('mostra intestazione, ricerca e bottone "Nuovo Cliente"', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Clienti', exact: true })).toBeVisible();
    await expect(page.getByPlaceholder('Cerca per nome, CF, P.IVA...')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Nuovo Cliente' })).toBeVisible();
  });

  test('la barra di ricerca accetta input', async ({ page }) => {
    const search = page.getByPlaceholder('Cerca per nome, CF, P.IVA...');
    await search.fill('Rossi');
    await expect(search).toHaveValue('Rossi');
    // Debounce lato app: attende e verifica che la pagina non vada in crash
    await page.waitForTimeout(600);
    await expectPageHealthy(page);
  });

  test('il bottone "Nuovo Cliente" apre il form di inserimento', async ({ page }) => {
    await page.getByRole('button', { name: 'Nuovo Cliente' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    // Il dialog di creazione contiene campi di input
    await expect(dialog.locator('input').first()).toBeVisible();
    // Chiude con Escape
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });
});
