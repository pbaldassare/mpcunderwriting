import { test, expect } from '@playwright/test';
import {
  STORAGE_STATE,
  expectPageHealthy,
  openFirstClienteDetail,
  searchClienti,
} from './helpers/auth-helper';
import { SEL } from './helpers/selectors';

test.use({ storageState: STORAGE_STATE });

test.describe('Clienti — lista anagrafica', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/archivi/clienti');
    await expectPageHealthy(page);
  });

  test('mostra intestazione, ricerca e bottone Nuovo Cliente', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Clienti', exact: true })).toBeVisible();
    await expect(page.getByPlaceholder(SEL.clienti.searchPlaceholder)).toBeVisible();
    await expect(page.getByRole('button', { name: SEL.clienti.nuovoCliente })).toBeVisible();
  });

  test('la ricerca testuale filtra senza errori', async ({ page }) => {
    const search = page.getByPlaceholder(SEL.clienti.searchPlaceholder);
    await search.fill('a');
    await page.waitForTimeout(600);
    await expectPageHealthy(page);
    const hasRows = (await page.locator('table tbody tr').count()) > 0;
    const hasEmpty = (await page.getByText('Nessun cliente trovato').count()) > 0;
    expect(hasRows || hasEmpty).toBeTruthy();
  });

  test('Nuovo Cliente apre il dialog di creazione', async ({ page }) => {
    await page.getByRole('button', { name: SEL.clienti.nuovoCliente }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('input').first()).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });
});

test.describe('Clienti — scheda dettaglio e tab', () => {
  test('apre la scheda del primo cliente e mostra le tab principali', async ({ page }) => {
    const clienteId = await openFirstClienteDetail(page);
    test.skip(!clienteId, 'Nessun cliente visibile nel DB di test');

    await expect(page).toHaveURL(new RegExp(`/archivi/clienti/${clienteId}`));
    await expect(page.getByRole('tab', { name: /Polizze/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Anagrafica' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Sinistri' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Documenti' })).toBeVisible();
  });

  test('navigazione tra tab Polizze, Anagrafica e Documenti', async ({ page }) => {
    const clienteId = await openFirstClienteDetail(page);
    test.skip(!clienteId, 'Nessun cliente visibile nel DB di test');

    await page.getByRole('tab', { name: 'Anagrafica' }).click();
    await expect(page).toHaveURL(/tab=anagrafica/);
    await expect(page.getByText('Assegnazioni Gestionali').first()).toBeVisible({ timeout: 15_000 });

    await page.getByRole('tab', { name: 'Documenti' }).click();
    await expect(page).toHaveURL(/tab=documenti/);
    await expect(page.getByRole('button', { name: SEL.documenti.analizzaCga })).toBeVisible();

    await page.getByRole('tab', { name: /Polizze/i }).click();
    await expect(page).toHaveURL(/tab=polizze/);
    await expectPageHealthy(page);
  });

  test('ricerca cliente e apertura scheda da lista', async ({ page }) => {
    await searchClienti(page, 'a');
    const row = page.locator('table tbody tr').first();
    test.skip(!(await row.count()), 'Nessun risultato di ricerca');

    await row.click();
    await expect(page).toHaveURL(/\/archivi\/clienti\/[^/]+/);
    await expectPageHealthy(page);
  });
});
