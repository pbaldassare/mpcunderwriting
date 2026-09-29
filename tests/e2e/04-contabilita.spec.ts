import { test, expect } from '@playwright/test';
import { STORAGE_STATE, expectPageHealthy } from './helpers/auth-helper';
import { SEL } from './helpers/selectors';

test.use({ storageState: STORAGE_STATE });

test.describe('Contabilità — Riepilogo Messe a Cassa', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/contabilita');
    await expectPageHealthy(page);
  });

  test('pagina incassi mostra intestazione e navigazione mese', async ({ page }) => {
    await expect(page.getByRole('heading', { name: SEL.contabilita.incassiHeading })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator('main')).not.toBeEmpty();
  });

  test('filtro ricerca testuale accetta input senza crash', async ({ page }) => {
    const search = page.getByPlaceholder(/Cerca/i).first();
    if (await search.count()) {
      await search.fill('test');
      await page.waitForTimeout(400);
    }
    await expectPageHealthy(page);
  });
});

test.describe('Contabilità — Caricamento Mov. Bancari', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/contabilita/caricamento-mov-bancari');
    await expectPageHealthy(page);
    await expect(page.getByRole('heading', { name: SEL.contabilita.movBancariHeading })).toBeVisible({
      timeout: 15_000,
    });
  });

  test('tab Importazione e Monitor sono navigabili', async ({ page }) => {
    await expect(page.getByRole('tab', { name: SEL.contabilita.tabImportazione })).toBeVisible();
    const monitorTab = page.getByRole('tab', { name: SEL.contabilita.tabMonitor });
    if (await monitorTab.count()) {
      await monitorTab.click();
      await expectPageHealthy(page);
      await page.getByRole('tab', { name: SEL.contabilita.tabImportazione }).click();
    }
    await expect(page.getByText(/Upload Excel|Trascina un file Excel/i).first()).toBeVisible();
  });

  test('zona upload Excel e istruzioni colonne sono visibili', async ({ page }) => {
    await expect(page.getByText(/Upload Excel|Trascina un file Excel/i).first()).toBeVisible();
    await expect(page.getByText(/Data contabile/i).first()).toBeVisible();
  });
});

test.describe('Contabilità — Bonifici (merge Incassi)', () => {
  test('route legacy reindirizza a Incassi', async ({ page }) => {
    await page.goto('/contabilita/ricongiungimento-bancario');
    await expectPageHealthy(page);
    await expect(page).toHaveURL(/\/portafoglio\/carico\?tab=bonifici/);
    await expect(page.getByRole('heading', { name: SEL.portafoglio.caricoHeading })).toBeVisible({
      timeout: 15_000,
    });
  });

  test('storico accessibile con ?tab=storico', async ({ page }) => {
    await page.goto('/contabilita/ricongiungimento-bancario?tab=storico');
    await expectPageHealthy(page);
    await expect(page.getByRole('heading', { name: SEL.contabilita.ricongiungimentoHeading })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole('tab', { name: SEL.contabilita.tabStorico })).toBeVisible();
    await expect(page.getByRole('button', { name: /Export Excel/i })).toBeVisible();
    const dal = page.locator('label:text-is("Dal")').locator('..').locator('input[type="date"]');
    const al = page.locator('label:text-is("Al")').locator('..').locator('input[type="date"]');
    await dal.fill('2020-01-01');
    await al.fill('2030-12-31');
    await expect(page.locator('table')).toBeVisible();
  });
});
