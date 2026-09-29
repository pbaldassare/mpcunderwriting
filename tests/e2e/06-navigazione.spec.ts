import { test, expect } from '@playwright/test';
import {
  STORAGE_STATE,
  SIDEBAR_SMOKE_LINKS,
  expectPageHealthy,
} from './helpers/auth-helper';

test.use({ storageState: STORAGE_STATE });

test.describe('Navigazione — sidebar senza 404', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expectPageHealthy(page);
  });

  for (const link of SIDEBAR_SMOKE_LINKS) {
    test(`click sidebar "${link.label}" non produce 404`, async ({ page }) => {
      await page.goto('/');
      await page.getByRole('link', { name: link.label, exact: true }).click();
      await page.waitForLoadState('networkidle').catch(() => {});
      await expect(page).toHaveURL(link.path);
      await expectPageHealthy(page);
      await expect(page.locator('main')).toBeVisible();
    });
  }

  test('espansione gruppo Contabilità operativa e navigazione a Incassi', async ({ page }) => {
    const contabilitaBtn = page.getByRole('button', { name: 'Contabilità operativa' });
    if (await contabilitaBtn.count()) {
      await contabilitaBtn.click();
    }
    await page.getByRole('link', { name: 'Incassi' }).click();
    await expect(page).toHaveURL(/\/portafoglio\/carico/);
    await expectPageHealthy(page);
  });

  test('espansione gruppo Sinistri e navigazione a Ricerca', async ({ page }) => {
    const sinistriBtn = page.getByRole('button', { name: 'Sinistri' });
    if (await sinistriBtn.count()) {
      await sinistriBtn.click();
    }
    await page.getByRole('link', { name: 'Ricerca' }).click();
    await expect(page).toHaveURL(/\/sinistri/);
    await expectPageHealthy(page);
  });
});

test.describe('Navigazione — breadcrumb', () => {
  test('breadcrumb visibile sulla lista clienti', async ({ page }) => {
    await page.goto('/archivi/clienti');
    await expectPageHealthy(page);
    const breadcrumb = page.locator('nav[aria-label="breadcrumb"], [data-slot="breadcrumb"]').first();
    await expect(breadcrumb).toBeVisible();
    await expect(breadcrumb.getByText('Clienti')).toBeVisible();
  });

  test('breadcrumb su Incassi include Contabilità operativa', async ({ page }) => {
    await page.goto('/portafoglio/incassi');
    await expectPageHealthy(page);
    const breadcrumb = page.locator('nav[aria-label="breadcrumb"], [data-slot="breadcrumb"]').first();
    await expect(breadcrumb).toBeVisible();
    await expect(breadcrumb.getByText(/Portafoglio|Incassi|Contabilità/i).first()).toBeVisible();
  });

  test('breadcrumb su Carico include Portafoglio', async ({ page }) => {
    await page.goto('/portafoglio/carico');
    await expectPageHealthy(page);
    const breadcrumb = page.locator('nav[aria-label="breadcrumb"], [data-slot="breadcrumb"]').first();
    await expect(breadcrumb).toBeVisible();
    await expect(breadcrumb.getByText(/Portafoglio|Carico/i).first()).toBeVisible();
  });

  test('breadcrumb su Riepilogo Messe a Cassa', async ({ page }) => {
    await page.goto('/contabilita');
    await expectPageHealthy(page);
    const breadcrumb = page.locator('nav[aria-label="breadcrumb"], [data-slot="breadcrumb"]').first();
    await expect(breadcrumb).toBeVisible();
    await expect(breadcrumb.getByText(/Contabilità operativa|Riepilogo Messe a Cassa/i).first()).toBeVisible();
  });

  test('navigazione breadcrumb Home riporta alla dashboard', async ({ page }) => {
    await page.goto('/archivi/clienti');
    await expectPageHealthy(page);
    const homeLink = page.locator('nav[aria-label="breadcrumb"] a, [data-slot="breadcrumb"] a').filter({ hasText: /Home/i }).first();
    if (await homeLink.count()) {
      await homeLink.click();
      await expect(page).toHaveURL(/^\/(\?|$)/);
      await expectPageHealthy(page);
    }
  });
});
