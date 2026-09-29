import { test, expect } from '@playwright/test';
import { STORAGE_STATE, expectPageHealthy } from '../../helpers/auth-helper';
import { SEL } from '../../helpers/selectors';

test.use({ storageState: STORAGE_STATE });

/**
 * Smoke Riepilogo Anticipi / compensazioni contabili.
 * Route: /contabilita/anticipi-clienti
 */
test.describe('Contabilità · Anticipi e compensazioni — smoke', () => {
  test('pagina anticipi si carica con filtri e tabella', async ({ page }) => {
    await page.goto('/contabilita/anticipi-clienti');
    await expectPageHealthy(page);

    await expect(
      page.getByRole('heading', { name: SEL.contabilita.anticipiHeading }),
    ).toBeVisible({ timeout: 15_000 });

    await expect(page.locator('table')).toBeVisible();
    await expect(
      page.getByText(/Nessun anticipo|Cliente|Saldo|Residuo/i).first(),
    ).toBeVisible();
  });

});
