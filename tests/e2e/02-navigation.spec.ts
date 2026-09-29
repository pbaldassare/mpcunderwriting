import { test, expect } from '@playwright/test';
import { GESTIONALE_ROUTES, STORAGE_STATE, expectPageHealthy } from '../helpers/auth-helper';

/**
 * Smoke test di navigazione su tutte le rotte principali del gestionale.
 *
 * Per ogni rotta verifica che la pagina:
 *  - non rimandi al /login (sessione valida),
 *  - non mostri l'AppErrorBoundary (crash di runtime),
 *  - non cada sul 404,
 *  - renderizzi del contenuto nel <main>.
 *
 * Usa la sessione salvata dal setup (00-auth.setup.ts) per non ri-loggare.
 */
test.use({ storageState: STORAGE_STATE });

test.describe('Navigazione — smoke su tutte le pagine', () => {
  for (const route of GESTIONALE_ROUTES) {
    test(`pagina "${route.label}" (${route.path}) si carica senza errori`, async ({ page }) => {
      const response = await page.goto(route.path, { waitUntil: 'domcontentloaded' });

      // La risposta HTML della SPA deve essere ok (mai 5xx)
      if (response) {
        expect(response.status(), `status HTTP per ${route.path}`).toBeLessThan(500);
      }

      // Lascia stabilizzare il rendering / eventuali redirect dei guard
      await page.waitForLoadState('networkidle').catch(() => {});

      await expectPageHealthy(page);

      // Deve esserci del contenuto renderizzato (layout app o portale)
      await expect(page.locator('body')).not.toBeEmpty();
    });
  }
});
