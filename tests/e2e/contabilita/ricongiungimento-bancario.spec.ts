import { test, expect } from '@playwright/test';
import { STORAGE_STATE, expectPageHealthy } from '../../helpers/auth-helper';

test.use({ storageState: STORAGE_STATE });

/**
 * Bonifici: flusso primario in Incassi; storico / legacy sulla vecchia route.
 */
test.describe('Contabilità · Bonifici (merge Incassi)', () => {
  test('route legacy reindirizza a Incassi → Bonifici aperti', async ({ page }) => {
    await page.goto('/contabilita/ricongiungimento-bancario');
    await expectPageHealthy(page);
    await expect(page).toHaveURL(/\/portafoglio\/carico\?tab=bonifici/);
    await expect(page.getByRole('heading', { name: /Incassi/i })).toBeVisible({
      timeout: 15_000,
    });
  });

  test('storico accessibile con ?tab=storico', async ({ page }) => {
    await page.goto('/contabilita/ricongiungimento-bancario?tab=storico');
    await expectPageHealthy(page);
    await expect(page.getByRole('heading', { name: /Storico bonifici|Bonifici \(legacy\)/i })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole('tab', { name: /Storico/i })).toBeVisible();
    const dal = page.locator('label:text-is("Dal")').locator('..').locator('input[type="date"]');
    const al = page.locator('label:text-is("Al")').locator('..').locator('input[type="date"]');
    await dal.fill('2020-01-01');
    await al.fill('2030-12-31');
    await expect(page.locator('table')).toBeVisible();
  });

  test('legacy=1 mantiene Da collegare per casi avanzati', async ({ page }) => {
    await page.goto('/contabilita/ricongiungimento-bancario?legacy=1');
    await expectPageHealthy(page);
    await expect(page.getByRole('tab', { name: /Da collegare/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Storico/i })).toBeVisible();

    const trigger = page.locator('.cursor-pointer').filter({ hasText: /Ordinante:/i }).first();
    if (!(await trigger.count())) {
      test.skip(true, 'Nessun movimento assegnato da collegare nel DB di test');
      return;
    }

    await trigger.click();
    await expect(page.getByRole('button', { name: /Salva Ricongiungimento/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Metti a Cassa/i })).toBeVisible();
  });
});
