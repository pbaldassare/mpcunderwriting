import { test, expect } from '@playwright/test';
import {
  login,
  expectOnRoute,
  expectRouteBlocked,
  CLIENTE_PORTAL_ROUTES,
  GESTIONALE_BLOCKED_FOR_CLIENTE,
} from '../../helpers/auth-helper';
import {
  setupAuthRoleFixtures,
  teardownAuthRoleFixtures,
  skipWithoutServiceRole,
  hasServiceRole,
  type AuthRoleFixtures,
} from '../../helpers/role-test-data';

/**
 * Verifica che l'utente portale cliente veda solo i propri dati
 * e non possa accedere al gestionale interno.
 */
test.describe('Cliente — portale riservato', () => {
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

  test('login cliente reindirizza al portale /cliente', async ({ page }) => {
    await login(page, fixtures!.cliente.email, fixtures!.password);
    await expectOnRoute(page, /\/cliente(\?|$)/);
  });

  for (const route of CLIENTE_PORTAL_ROUTES) {
    test(`cliente accede a "${route.label}" (${route.path})`, async ({ page }) => {
      await login(page, fixtures!.cliente.email, fixtures!.password);
      await page.goto(route.path, { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle').catch(() => {});

      await expect(page).toHaveURL(new RegExp(`${route.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\?|$|#)`));
      await expect(page).not.toHaveURL(/\/login/);
    });
  }

  test('cliente vede la propria polizza nel portale', async ({ page }) => {
    await login(page, fixtures!.cliente.email, fixtures!.password);
    await page.goto('/cliente/polizze');
    await page.waitForLoadState('networkidle').catch(() => {});

    await expect(page.getByText(fixtures!.polizzaA.numero).first()).toBeVisible({ timeout: 15_000 });
  });

  test('cliente NON vede polizze di altri clienti', async ({ page }) => {
    await login(page, fixtures!.cliente.email, fixtures!.password);
    await page.goto('/cliente/polizze');
    await page.waitForLoadState('networkidle').catch(() => {});

    await expect(page.getByText(fixtures!.polizzaB.numero)).toHaveCount(0);
  });

  for (const path of GESTIONALE_BLOCKED_FOR_CLIENTE) {
    test(`cliente bloccato dal gestionale su ${path}`, async ({ page }) => {
      await login(page, fixtures!.cliente.email, fixtures!.password);
      await expectRouteBlocked(page, path, /\/cliente(\?|$)/);
    });
  }

  test('cliente non accede al dettaglio titolo altrui via URL diretto', async ({ page }) => {
    await login(page, fixtures!.cliente.email, fixtures!.password);
    await page.goto(`/titoli/${fixtures!.polizzaB.id}`);
    await page.waitForLoadState('networkidle').catch(() => {});

    await expect(page).toHaveURL(/\/cliente(\?|$)/);
    await expect(page.getByText(fixtures!.polizzaB.numero)).toHaveCount(0);
  });
});
