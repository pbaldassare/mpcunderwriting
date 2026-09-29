import { test, expect } from '@playwright/test';
import {
  login,
  expectRouteBlocked,
  ADMIN_ONLY_ROUTES,
} from '../../helpers/auth-helper';
import {
  setupAuthRoleFixtures,
  teardownAuthRoleFixtures,
  skipWithoutServiceRole,
  hasServiceRole,
  type AuthRoleFixtures,
} from '../../helpers/role-test-data';

/**
 * Test che non richiedono setup DB (solo guard AuthGuard).
 */
test.describe('Accesso negato — utente non autenticato', () => {
  test('utente non autenticato viene reindirizzato al login', async ({ page }) => {
    await page.goto('/archivi/clienti');
    await expect(page).toHaveURL(/\/login/);
  });

  test('utente non autenticato non accede alle rotte admin', async ({ page }) => {
    await page.goto('/utenti-privilegi');
    await expect(page).toHaveURL(/\/login/);
  });
});

/**
 * Guard RoleGuard / ClienteGuard — richiede SUPABASE_SERVICE_ROLE_KEY.
 */
test.describe('Accesso negato — guard di ruolo (richiede service role)', () => {
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

  for (const route of ADMIN_ONLY_ROUTES) {
    test(`ufficio bloccato su "${route.label}" (${route.path})`, async ({ page }) => {
      await login(page, fixtures!.sede.email, fixtures!.password);
      await page.goto(route.path, { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle').catch(() => {});

      await expect(page, `ufficio non deve restare su ${route.path}`).not.toHaveURL(
        new RegExp(`${route.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\?|$)`),
      );
      await expect(page).not.toHaveURL(/\/login/);
    });
  }

  test('ufficio può accedere a rotte operative della propria sede', async ({ page }) => {
    await login(page, fixtures!.sede.email, fixtures!.password);
    await page.goto('/archivi/clienti');
    await page.waitForLoadState('networkidle').catch(() => {});

    await expect(page).toHaveURL(/\/archivi\/clienti/);
    await expect(page.getByRole('heading', { name: 'Clienti', exact: true })).toBeVisible();
  });

  test('ufficio può accedere a Impostazioni (condivisa admin/ufficio)', async ({ page }) => {
    await login(page, fixtures!.sede.email, fixtures!.password);
    await page.goto('/impostazioni');
    await page.waitForLoadState('networkidle').catch(() => {});

    await expect(page).toHaveURL(/\/impostazioni/);
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('cliente bloccato dal gestionale e reindirizzato al portale', async ({ page }) => {
    await login(page, fixtures!.cliente.email, fixtures!.password);
    await expectRouteBlocked(page, '/utenti-privilegi', /\/cliente(\?|$)/);
  });

  test('admin accede liberamente a tutte le rotte admin-only', async ({ page }) => {
    await login(page, fixtures!.admin.email, fixtures!.password);

    for (const route of ADMIN_ONLY_ROUTES) {
      await page.goto(route.path, { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle').catch(() => {});
      await expect(page, `admin deve accedere a ${route.path}`).toHaveURL(new RegExp(`${route.path}(\\?|$)`));
    }
  });
});
