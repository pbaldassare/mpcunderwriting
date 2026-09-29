import { expect, type Page } from '@playwright/test';
import { SEL } from './selectors';

/** Attende che la pagina Carico (consultazione) abbia finito il caricamento. */
export async function waitForPortafoglioCarico(page: Page) {
  await expect(page.getByRole('heading', { name: SEL.portafoglio.caricoHeading })).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByText(SEL.portafoglio.totaleTitoli)).toBeVisible({ timeout: 20_000 });
  const loading = page.getByText('Caricamento...');
  if (await loading.count()) {
    await expect(loading).toHaveCount(0, { timeout: 30_000 });
  }
}

/** Attende che la pagina Incassi (operatività) abbia finito il caricamento. */
export async function waitForIncassi(page: Page) {
  await expect(page.getByRole('heading', { name: SEL.portafoglio.incassiHeading })).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByText(SEL.portafoglio.totaleTitoli)).toBeVisible({ timeout: 20_000 });
  const loading = page.getByText('Caricamento...');
  if (await loading.count()) {
    await expect(loading).toHaveCount(0, { timeout: 30_000 });
  }
}

export function caricoDateInputs(page: Page) {
  const dal = page.locator('span:text-is("Dal")').locator('..').locator('input[type="date"]');
  const al = page.locator('span:text-is("Al")').locator('..').locator('input[type="date"]');
  return { dal, al };
}

export async function selectCaricoPeriodo(page: Page, periodo: 'Mese Corrente' | 'Tutte') {
  await page.getByRole('radio', { name: periodo }).click();
}

export async function readCaricoCounters(page: Page) {
  const totaleTitoli = page.locator('p:text-is("Totale titoli")').locator('..').locator('.text-2xl');
  const quietanze = page.locator(`p:text-is("${SEL.portafoglio.quietanze}")`).locator('..').locator('.text-2xl');
  return {
    totale: (await totaleTitoli.textContent())?.trim() ?? '',
    quietanze: (await quietanze.textContent())?.trim() ?? '',
  };
}

export async function readIncassiCounters(page: Page) {
  const totaleTitoli = page.locator('p:text-is("Totale titoli")').locator('..').locator('.text-2xl');
  const quietanze = page.locator(`p:text-is("${SEL.portafoglio.quietanze}")`).locator('..').locator('.text-2xl');
  const inAttesa = page.locator(`p:text-is("${SEL.portafoglio.inAttesaRinnovo}")`).locator('..').locator('.text-2xl');
  return {
    totale: (await totaleTitoli.textContent())?.trim() ?? '',
    quietanze: (await quietanze.textContent())?.trim() ?? '',
    inAttesa: (await inAttesa.textContent())?.trim() ?? '',
  };
}
