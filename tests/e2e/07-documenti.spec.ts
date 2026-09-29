import { test, expect } from '@playwright/test';
import {
  STORAGE_STATE,
  expectPageHealthy,
  openFirstClienteDetail,
} from './helpers/auth-helper';
import { SEL } from './helpers/selectors';

test.use({ storageState: STORAGE_STATE });

test.describe('Documenti — scheda cliente', () => {
  test('tab Documenti mostra scansione AI e upload tipizzato', async ({ page }) => {
    const clienteId = await openFirstClienteDetail(page);
    test.skip(!clienteId, 'Nessun cliente visibile nel DB di test');

    await page.getByRole('tab', { name: 'Documenti' }).click();
    await expect(page).toHaveURL(/tab=documenti/);
    await expect(page.getByText('Scansione AI Documenti')).toBeVisible();
    await expect(page.getByRole('button', { name: SEL.documenti.caricaDocumento })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Tipologia' })).toBeVisible();
    await expectPageHealthy(page);
  });

  test('bottone Carica Documento apre modale con tipologia', async ({ page }) => {
    const clienteId = await openFirstClienteDetail(page);
    test.skip(!clienteId, 'Nessun cliente visibile nel DB di test');

    await page.getByRole('tab', { name: 'Documenti' }).click();
    await page.getByRole('button', { name: SEL.documenti.caricaDocumento }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/Tipologia documento/i)).toBeVisible();
    await expect(dialog.getByText(/Visibile al cliente/i)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  test('tabella documenti mostra lista o messaggio vuoto', async ({ page }) => {
    const clienteId = await openFirstClienteDetail(page);
    test.skip(!clienteId, 'Nessun cliente visibile nel DB di test');

    await page.getByRole('tab', { name: 'Documenti' }).click();
    const empty = page.getByText(/Nessun documento/i);
    const rows = page.locator('table tbody tr');
    const hasEmpty = (await empty.count()) > 0;
    const hasRows = (await rows.count()) > 0;
    expect(hasEmpty || hasRows).toBeTruthy();
  });
});

test.describe('Documenti — archivio documentale', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/portafoglio/documentale');
    await expectPageHealthy(page);
  });

  test('pagina documentale si carica con tab Libreria CGA', async ({ page }) => {
    await expect(page.getByRole('tab', { name: SEL.documenti.libreriaCga })).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('main')).not.toBeEmpty();
  });

  test('tab Libreria CGA mostra contenuto o messaggio vuoto', async ({ page }) => {
    await page.getByRole('tab', { name: SEL.documenti.libreriaCga }).click();
    const empty = page.getByText(/Nessuna CGA trovata/i);
    const heading = page.getByRole('heading', { name: /Libreria CGA/i });
    const hasEmpty = (await empty.count()) > 0;
    const hasHeading = (await heading.count()) > 0;
    expect(hasEmpty || hasHeading).toBeTruthy();
    await expectPageHealthy(page);
  });

  test('ricerca documentale accetta input', async ({ page }) => {
    const search = page.getByPlaceholder(/Cerca/i).first();
    if (await search.count()) {
      await search.fill('polizza');
      await page.waitForTimeout(400);
    }
    await expectPageHealthy(page);
  });
});
