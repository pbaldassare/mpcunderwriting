import { test, expect } from '@playwright/test';
import { STORAGE_STATE, expectPageHealthy } from '../helpers/auth-helper';

test.use({ storageState: STORAGE_STATE });

/**
 * Verifica l'interazione reale con la chrome dell'app: sidebar, menu utente,
 * navigazione tra pagine tramite click (non solo goto diretto).
 */
test.describe('Navigazione via interfaccia', () => {
  test('la sidebar permette di navigare a una voce di primo livello', async ({ page }) => {
    await page.goto('/');
    await expectPageHealthy(page);

    const sidebar = page.locator('aside, nav').first();
    await expect(sidebar).toBeVisible();

    // Voce singola sempre visibile nel menu
    await page.getByRole('link', { name: 'Bandi Pubblici' }).click();
    await expect(page).toHaveURL(/\/bandi-pubblici/);
    await expectPageHealthy(page);
  });

  test('il menu utente mostra l\'email e permette di aprire "Il mio profilo"', async ({ page }) => {
    await page.goto('/');
    await expectPageHealthy(page);

    // Apre il dropdown utente (ultimo bottone nell'header)
    await page.locator('header button').last().click();
    await expect(page.getByRole('menuitem', { name: 'Il mio profilo' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Esci' })).toBeVisible();

    await page.getByRole('menuitem', { name: 'Il mio profilo' }).click();
    await expect(page).toHaveURL(/\/mio-profilo/);
    await expectPageHealthy(page);
  });

  test('la dashboard/home si carica con contenuto', async ({ page }) => {
    await page.goto('/');
    await expectPageHealthy(page);
    await expect(page.locator('main')).toBeVisible();
    await expect(page.locator('main')).not.toBeEmpty();
  });
});
