import { test, expect } from '@playwright/test';
import { STORAGE_STATE, expectPageHealthy } from '../../helpers/auth-helper';
import { waitForIncassi } from '../../helpers/contabilita-helper';
import { SEL } from '../../helpers/selectors';

test.use({ storageState: STORAGE_STATE });

/**
 * Messa a Cassa — dialog di incasso da Portafoglio Carico e da Ricongiungimento.
 * I test aprono il dialog e lo chiudono senza confermare l'incasso (no mutazioni DB).
 */
test.describe('Contabilità · Messa a Cassa (dialog)', () => {
  test('da Incassi: selezione + Incassa apre dialog Conferma Messa a Cassa', async ({ page }) => {
    await page.goto('/portafoglio/incassi');
    await expectPageHealthy(page);
    await waitForIncassi(page);

    const rowCheckbox = page.locator('table tbody tr').first().locator('[role="checkbox"]').first();
    if (!(await rowCheckbox.count())) {
      test.skip(true, 'Nessuna quietanza attiva incassabile nel carico corrente');
      return;
    }

    await rowCheckbox.click();

    const incassaBtn = page.getByRole('button', { name: /^Incassa \(\d+\)$/ }).first();
    if (!(await incassaBtn.count())) {
      test.skip(true, 'Nessuna riga selezionabile per incasso');
      return;
    }

    await incassaBtn.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: SEL.messaCassa.dialog })).toBeVisible();
    await dialog.getByRole('button', { name: SEL.messaCassa.annulla }).click();
    await expect(dialog).toBeHidden();
  });

  test('Incassi: colonna Messa a Cassa visibile in vista Tutte', async ({ page }) => {
    await page.goto('/portafoglio/incassi');
    await expectPageHealthy(page);
    await waitForIncassi(page);
    await expect(page.getByRole('columnheader', { name: /Messa a Cassa/i })).toBeVisible();
  });
});

