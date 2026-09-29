import { test, expect } from '@playwright/test';
import {
  STORAGE_STATE,
  expectPageHealthy,
  openFirstSinistroDetail,
} from './helpers/auth-helper';
import { SEL } from './helpers/selectors';

test.use({ storageState: STORAGE_STATE });

test.describe('Sinistri — lista', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/sinistri');
    await expectPageHealthy(page);
  });

  test('mostra intestazione, ricerca e bottone Nuovo Sinistro', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /Sinistri/i })).toBeVisible();
    await expect(page.getByPlaceholder(SEL.sinistri.searchPlaceholder)).toBeVisible();
    await expect(page.getByRole('button', { name: SEL.sinistri.nuovoSinistro })).toBeVisible();
  });

  test('ricerca testuale non causa errori', async ({ page }) => {
    await page.getByPlaceholder(SEL.sinistri.searchPlaceholder).fill('sin');
    await page.waitForTimeout(500);
    await expectPageHealthy(page);
  });

  test('Nuovo Sinistro apre il wizard di apertura', async ({ page }) => {
    await page.getByRole('button', { name: SEL.sinistri.nuovoSinistro }).click();
    await expect(page).toHaveURL(/\/sinistri\/apertura/);
    await expect(page.getByRole('heading', { name: /Apertura Nuovo Sinistro/i })).toBeVisible();
  });
});

test.describe('Sinistri — scheda dettaglio e tab', () => {
  test('apre la scheda del primo sinistro con tab principali', async ({ page }) => {
    const opened = await openFirstSinistroDetail(page);
    test.skip(!opened, 'Nessun sinistro visibile nel DB di test');

    await expectPageHealthy(page);
    await expect(page.getByRole('tab', { name: 'Dati Pratica' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Checklist' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Eventi' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Documenti' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Chat' })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Log Attività|Timeline/i })).toBeVisible();
  });

  test('navigazione tab Documenti e Eventi sulla scheda sinistro', async ({ page }) => {
    const opened = await openFirstSinistroDetail(page);
    test.skip(!opened, 'Nessun sinistro visibile nel DB di test');

    await page.getByRole('tab', { name: 'Eventi' }).click();
    await expect(page).toHaveURL(/tab=eventi/);
    await expectPageHealthy(page);

    await page.getByRole('tab', { name: 'Documenti' }).click();
    await expect(page).toHaveURL(/tab=documenti/);
    await expectPageHealthy(page);
  });
});

test.describe('Sinistri — sottopagine', () => {
  const subpages = [
    { path: '/sinistri/prescrizioni', heading: /Termini di prescrizione/i },
    { path: '/sinistri/report-sir', heading: /Report Sanitario SIR/i },
  ];

  for (const sub of subpages) {
    test(`sottopagina ${sub.path} si carica`, async ({ page }) => {
      await page.goto(sub.path);
      await expectPageHealthy(page);
      await expect(page.getByRole('heading', { name: sub.heading }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});
