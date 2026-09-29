import { test, expect } from '@playwright/test';
import {
  login,
  expectPageHealthy,
  ADMIN_ONLY_ROUTES,
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
 * Verifica che un utente admin possa accedere alle rotte di sistema
 * e vedere i dati di entrambe le sedi create per i test RLS.
 */
test.describe('Admin — accesso completo', () => {
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

  test('login admin reindirizza alla dashboard del gestionale', async ({ page }) => {
    await login(page, fixtures!.admin.email, fixtures!.password);
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator('header')).toBeVisible({ timeout: 15_000 });
  });

  for (const route of ADMIN_ONLY_ROUTES) {
    test(`admin accede a "${route.label}" (${route.path})`, async ({ page }) => {
      await login(page, fixtures!.admin.email, fixtures!.password);
      await page.goto(route.path, { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle').catch(() => {});

      await expect(page, `admin deve restare su ${route.path}`).toHaveURL(new RegExp(`${route.path}(\\?|$)`));
      await expectPageHealthy(page);
    });
  }

  test('admin vede clienti di entrambe le sedi di test', async ({ page }) => {
    await login(page, fixtures!.admin.email, fixtures!.password);

    await searchClienti(page, fixtures!.clienteA.cognome);
    await expect(page.getByRole('cell', { name: fixtures!.clienteA.cognome })).toBeVisible({ timeout: 15_000 });

    await searchClienti(page, fixtures!.clienteB.cognome);
    await expect(page.getByRole('cell', { name: fixtures!.clienteB.cognome })).toBeVisible({ timeout: 15_000 });
  });

  test('admin vede polizze di entrambe le sedi di test', async ({ page }) => {
    await login(page, fixtures!.admin.email, fixtures!.password);

    await searchTitoli(page, fixtures!.polizzaA.numero);
    await expect(page.getByRole('cell', { name: fixtures!.polizzaA.numero })).toBeVisible({ timeout: 15_000 });

    await searchTitoli(page, fixtures!.polizzaB.numero);
    await expect(page.getByRole('cell', { name: fixtures!.polizzaB.numero })).toBeVisible({ timeout: 15_000 });
  });

  test('admin accede al dettaglio cliente di un\'altra sede', async ({ page }) => {
    await login(page, fixtures!.admin.email, fixtures!.password);
    await page.goto(`/archivi/clienti/${fixtures!.clienteB.id}`);
    await page.waitForLoadState('networkidle').catch(() => {});

    await expect(page).toHaveURL(new RegExp(`/archivi/clienti/${fixtures!.clienteB.id}`));
    await expect(page.getByText(fixtures!.clienteB.cognome).first()).toBeVisible({ timeout: 15_000 });
  });
});
