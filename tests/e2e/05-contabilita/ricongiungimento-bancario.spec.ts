import { test, expect } from '@playwright/test';
import { STORAGE_STATE, expectPageHealthy } from '../../helpers/auth-helper';
import { SEL } from '../../helpers/selectors';

test.use({ storageState: STORAGE_STATE });

/**
 * Hub Bonifici: da ricongiungere / ricongiunti / import su caricamento-mov-bancari.
 * Le route legacy ricongiungimento-bancario reindirizzano al hub.
 */
test.describe('Contabilità · Bonifici (hub)', () => {
  test('route legacy reindirizza a hub → Da ricongiungere', async ({ page }) => {
    await page.goto('/contabilita/ricongiungimento-bancario');
    await expectPageHealthy(page);
    await expect(page).toHaveURL(/\/contabilita\/caricamento-mov-bancari\?tab=da-ricongiungere/);
    await expect(page.getByRole('heading', { name: SEL.contabilita.movBancariHeading })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole('tab', { name: SEL.contabilita.tabDaRicongiungere })).toBeVisible();
  });

  test('storico legacy reindirizza a hub → Ricongiunti', async ({ page }) => {
    await page.goto('/contabilita/ricongiungimento-bancario?tab=storico');
    await expectPageHealthy(page);
    await expect(page).toHaveURL(/\/contabilita\/caricamento-mov-bancari\?tab=ricongiunti/);
    await expect(page.getByRole('heading', { name: SEL.contabilita.movBancariHeading })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole('tab', { name: SEL.contabilita.tabRicongiunti })).toBeVisible();
    const dal = page.locator('label:text-is("Dal")').locator('..').locator('input[type="date"]');
    const al = page.locator('label:text-is("Al")').locator('..').locator('input[type="date"]');
    await dal.fill('2020-01-01');
    await al.fill('2030-12-31');
    await expect(page.locator('table').first()).toBeVisible({ timeout: 15_000 });
  });

  test('hub mostra tab nell\'ordine concordato', async ({ page }) => {
    await page.goto('/contabilita/caricamento-mov-bancari?tab=da-ricongiungere');
    await expectPageHealthy(page);
    await expect(page.getByRole('heading', { name: SEL.contabilita.movBancariHeading })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole('tab', { name: SEL.contabilita.tabDaRicongiungere })).toBeVisible();
    await expect(page.getByRole('tab', { name: SEL.contabilita.tabRicongiunti })).toBeVisible();
    await expect(page.getByRole('tab', { name: SEL.contabilita.tabImportazione, exact: true })).toBeVisible();
    await expect(page.getByRole('tab', { name: SEL.contabilita.tabStoricoImportazioni, exact: true })).toBeVisible();

    await page.getByRole('tab', { name: SEL.contabilita.tabImportazione, exact: true }).click();
    await expect(page).toHaveURL(/tab=importazione/);
    await expect(page.getByText(/Upload estratto conto/i)).toBeVisible();

    await page.getByRole('tab', { name: SEL.contabilita.tabStoricoImportazioni, exact: true }).click();
    await expect(page).toHaveURL(/tab=storico-importazioni/);
  });

  test('legacy=1 mantiene tab Da collegare per casi avanzati', async ({ page }) => {
    await page.goto('/contabilita/ricongiungimento-bancario?legacy=1');
    await expectPageHealthy(page);
    await expect(page.getByRole('heading', { name: SEL.contabilita.ricongiungimentoHeading })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole('tab', { name: 'Da collegare' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Storico', exact: true })).toBeVisible();
  });
});
