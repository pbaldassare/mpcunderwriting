import { test, expect } from '@playwright/test';
import {
  login,
  logout,
  TEST_EMAIL,
  TEST_PASSWORD,
  TEST_SEDE_EMAIL,
  TEST_SEDE_PASSWORD,
  ADMIN_ONLY_ROUTES,
  EMPTY_STORAGE_STATE,
  expectPageHealthy,
} from './helpers/auth-helper';
import {
  setupAuthRoleFixtures,
  teardownAuthRoleFixtures,
  skipWithoutServiceRole,
  hasServiceRole,
  type AuthRoleFixtures,
} from '../helpers/role-test-data';

test.describe('Autenticazione — accesso non autorizzato', () => {
  test.use({ storageState: EMPTY_STORAGE_STATE });

  test('rota protetta reindirizza al login se non autenticati', async ({ page }) => {
    await page.goto('/archivi/clienti');
    await expect(page).toHaveURL(/\/login/);
  });

  test('rotte admin reindirizzano al login se non autenticati', async ({ page }) => {
    await page.goto('/utenti-privilegi');
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('Autenticazione — login admin', () => {
  test.use({ storageState: EMPTY_STORAGE_STATE });

  test('login admin entra nel gestionale con topbar visibile', async ({ page }) => {
    await login(page, TEST_EMAIL, TEST_PASSWORD);
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator('header')).toBeVisible({ timeout: 15_000 });
    await expectPageHealthy(page);
  });

  test('logout admin riporta al login', async ({ page }) => {
    await login(page, TEST_EMAIL, TEST_PASSWORD);
    await logout(page);
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('Autenticazione — login sede (env o fixture)', () => {
  test.use({ storageState: EMPTY_STORAGE_STATE });

  test('login sede via TEST_SEDE_EMAIL entra nel gestionale', async ({ page }) => {
    test.skip(!TEST_SEDE_EMAIL, 'Impostare TEST_SEDE_EMAIL nel .env per questo test');
    await login(page, TEST_SEDE_EMAIL, TEST_SEDE_PASSWORD);
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator('header')).toBeVisible({ timeout: 15_000 });
    await expectPageHealthy(page);
  });
});

test.describe('Autenticazione — redirect non autorizzato (service role)', () => {
  let fixtures: AuthRoleFixtures | null = null;

  test.use({ storageState: EMPTY_STORAGE_STATE });

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

  test('login sede fixture reindirizza alla dashboard', async ({ page }) => {
    await login(page, fixtures!.sede.email, fixtures!.password);
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator('header')).toBeVisible({ timeout: 15_000 });
  });

  for (const route of ADMIN_ONLY_ROUTES.slice(0, 3)) {
    test(`ufficio bloccato su "${route.label}"`, async ({ page }) => {
      await login(page, fixtures!.sede.email, fixtures!.password);
      await page.goto(route.path, { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle').catch(() => {});
      await expect(page).not.toHaveURL(new RegExp(`${route.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\?|$)`));
      await expect(page).not.toHaveURL(/\/login/);
    });
  }

  test('admin fixture accede a utenti-privilegi', async ({ page }) => {
    await login(page, fixtures!.admin.email, fixtures!.password);
    await page.goto('/utenti-privilegi');
    await page.waitForLoadState('networkidle').catch(() => {});
    await expect(page).toHaveURL(/\/utenti-privilegi/);
    await expectPageHealthy(page);
  });
});
