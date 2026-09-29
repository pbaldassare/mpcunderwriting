import { test, expect } from '@playwright/test';
import { STORAGE_STATE, expectPageHealthy } from './helpers/auth-helper';
import {
  waitForPortafoglioCarico,
  selectCaricoPeriodo,
  caricoDateInputs,
  readCaricoCounters,
} from './helpers/portafoglio-helper';
import { SEL } from './helpers/selectors';

test.use({ storageState: STORAGE_STATE });

test.describe('Portafoglio — Carico filtri e contatori', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/portafoglio/carico');
    await expectPageHealthy(page);
    await waitForPortafoglioCarico(page);
  });

  test('mostra contatori Totale titoli e Quietanze (consultazione)', async ({ page }) => {
    await expect(page.getByText(SEL.portafoglio.totaleTitoli)).toBeVisible();
    await expect(page.getByText(SEL.portafoglio.quietanze)).toBeVisible();
    await expect(page.getByText(SEL.portafoglio.inAttesaRinnovo)).toHaveCount(0);
    await expect(page.getByText(/Bonifici aperti/i)).toHaveCount(0);

    const counters = await readCaricoCounters(page);
    expect(counters.totale).toMatch(/^\d+$/);
    expect(counters.quietanze).toMatch(/^\d+$/);
  });

  test('toggle periodo Mese Corrente / Tutte aggiorna URL', async ({ page }) => {
    await expect(page.getByRole('radio', { name: 'Tutte' })).toHaveAttribute('data-state', 'on');

    await selectCaricoPeriodo(page, 'Mese Corrente');
    await expect(page).toHaveURL(/periodo=mese_corrente/);

    await selectCaricoPeriodo(page, 'Tutte');
    await expect(page).toHaveURL(/periodo=tutte/);
  });

  test('datepicker Dal/Al aggiorna parametri URL', async ({ page }) => {
    const { dal, al } = caricoDateInputs(page);
    await dal.fill('2025-01-01');
    await al.fill('2025-06-30');
    await expect(page).toHaveURL(/dal=2025-01-01/);
    await expect(page).toHaveURL(/al=2025-06-30/);
  });

  test('Reset Filtri ripristina default e nasconde il bottone', async ({ page }) => {
    const { dal, al } = caricoDateInputs(page);
    await selectCaricoPeriodo(page, 'Tutte');
    await dal.fill('2024-06-01');
    await al.fill('2024-12-31');

    const reset = page.getByRole('button', { name: SEL.portafoglio.resetFiltri });
    await expect(reset).toBeVisible();
    await reset.click();

    await expect(dal).toHaveValue('');
    await expect(al).toHaveValue('');
    await expect(page.getByRole('radio', { name: 'Tutte' })).toHaveAttribute('data-state', 'on');
    await expect(page).not.toHaveURL(/[?&]periodo=/);
    await expect(page).not.toHaveURL(/[?&]dal=/);
    await expect(reset).toHaveCount(0);
  });

  test('cambio filtro mantiene tabella o messaggio vuoto coerente', async ({ page }) => {
    const before = await readCaricoCounters(page);
    await selectCaricoPeriodo(page, 'Mese Corrente');
    await waitForPortafoglioCarico(page);
    const after = await readCaricoCounters(page);

    expect(before.totale).toMatch(/^\d+$/);
    expect(after.totale).toMatch(/^\d+$/);

    const tableRows = page.locator('table tbody tr');
    const emptyMsg = page.getByText(/Nessuna quietanza|Nessuna polizza/i);
    const hasTable = (await tableRows.count()) > 0;
    const hasEmpty = (await emptyMsg.count()) > 0;
    expect(hasTable || hasEmpty).toBeTruthy();
  });
});
