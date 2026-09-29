import { test, expect } from '@playwright/test';
import {
  login,
  expectOnRoute,
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
import { SEL } from '../../helpers/selectors';

/**
 * Smoke rapido portale cliente — login, dashboard e blocco gestionale.
 * Per test RLS completi vedere tests/e2e/auth/cliente.spec.ts
 */
test.describe('Smoke · Portale cliente', () => {
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

  test('login reindirizza al portale /cliente', async ({ page }) => {
    await login(page, fixtures!.cliente.email, fixtures!.password);
    await expectOnRoute(page, /\/cliente(\?|$)/);
    await expect(page.getByText(SEL.clientePortale.benvenuto)).toBeVisible({ timeout: 15_000 });
  });

  for (const route of CLIENTE_PORTAL_ROUTES.slice(0, 3)) {
    test(`carica "${route.label}" (${route.path})`, async ({ page }) => {
      await login(page, fixtures!.cliente.email, fixtures!.password);
      await page.goto(route.path, { waitUntil: 'domcontentloaded' });
      await expect(page).not.toHaveURL(/\/login/);
    });
  }

  for (const path of GESTIONALE_BLOCKED_FOR_CLIENTE.slice(0, 3)) {
    test(`bloccato dal gestionale su ${path}`, async ({ page }) => {
      await login(page, fixtures!.cliente.email, fixtures!.password);
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await expect(page).toHaveURL(/\/cliente(\?|$)/, { timeout: 15_000 });
    });
  }
});
