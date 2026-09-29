import { test, expect } from '@playwright/test';
import {
  login,
  expectPageHealthy,
  searchClienti,
  searchTitoli,
} from '../../helpers/auth-helper';
import {
  setupAuthRoleFixtures,
  teardownAuthRoleFixtures,
  skipWithoutServiceRole,
  hasServiceRole,
  type AuthRoleFixtures,
} from '../../helpers/role-test-data';

/**
 * Verifica che un utente ufficio/sede veda solo clienti e polizze
 * della propria sede (RLS own_office).
 */
test.describe('Sede — visibilità limitata alla propria sede', () => {
  let fixtures: AuthRoleFixtures | null = null;

  test.beforeAll(async () => {
    if (!hasServiceRole()) return;
    fixtures = await setupAuthRoleFixtures();
  });

  test.afterAll(async () => {
    await teardownAuthRoleFixtures(fixtures);
    fixtures = null;
  });

  test.beforeEach(({ }, testInfo) => {
    skipWithoutServiceRole(testInfo);
  });

  test('login ufficio reindirizza alla dashboard del gestionale', async ({ page }) => {
    await login(page, fixtures!.sede.email, fixtures!.password);
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator('header')).toBeVisible({ timeout: 15_000 });
  });

  test('ufficio vede i clienti della propria sede', async ({ page }) => {
    await login(page, fixtures!.sede.email, fixtures!.password);
    await searchClienti(page, fixtures!.clienteA.cognome);

    await expect(page.getByRole('cell', { name: fixtures!.clienteA.cognome })).toBeVisible({ timeout: 15_000 });
    await expectPageHealthy(page);
  });

  test('ufficio NON vede clienti di un\'altra sede', async ({ page }) => {
    await login(page, fixtures!.sede.email, fixtures!.password);
    await searchClienti(page, fixtures!.clienteB.cognome);

    await expect(page.getByRole('cell', { name: fixtures!.clienteB.cognome })).toHaveCount(0);
    await expect(page.getByText('Nessun cliente trovato')).toBeVisible({ timeout: 15_000 });
  });

  test('ufficio vede le polizze della propria sede', async ({ page }) => {
    await login(page, fixtures!.sede.email, fixtures!.password);
    await searchTitoli(page, fixtures!.polizzaA.numero);

    await expect(page.getByRole('cell', { name: fixtures!.polizzaA.numero })).toBeVisible({ timeout: 15_000 });
  });

  test('ufficio NON vede polizze di un\'altra sede', async ({ page }) => {
    await login(page, fixtures!.sede.email, fixtures!.password);
    await searchTitoli(page, fixtures!.polizzaB.numero);

    await expect(page.getByRole('cell', { name: fixtures!.polizzaB.numero })).toHaveCount(0);
    await expect(page.getByText('Nessun risultato trovato')).toBeVisible({ timeout: 15_000 });
  });

  test('accesso diretto al cliente di un\'altra sede è bloccato da RLS', async ({ page }) => {
    await login(page, fixtures!.sede.email, fixtures!.password);
    await page.goto(`/archivi/clienti/${fixtures!.clienteB.id}`);
    await page.waitForLoadState('networkidle').catch(() => {});

    // ClienteDetail non renderizza nulla se la query RLS non restituisce righe
    await expect(page.getByText(fixtures!.clienteB.cognome)).toHaveCount(0);
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('accesso diretto al titolo di un\'altra sede mostra errore', async ({ page }) => {
    await login(page, fixtures!.sede.email, fixtures!.password);
    await page.goto(`/titoli/${fixtures!.polizzaB.id}`);
    await page.waitForLoadState('networkidle').catch(() => {});

    await expect(page.getByText('Titolo non trovato').first()).toBeVisible({ timeout: 15_000 });
  });
});
