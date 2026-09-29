import { test, expect } from '@playwright/test';
import { STORAGE_STATE, expectPageHealthy } from '../../helpers/auth-helper';
import { supabaseAdmin } from '../../helpers/db-helper';
import { fetchImmissioneFixtures, pickSearchableByLabel } from '../portafoglio/portafoglio-helpers';
import { SEL } from '../../helpers/selectors';

test.use({ storageState: STORAGE_STATE });

/**
 * Smoke test wizard immissione polizza — compila i campi principali
 * senza confermare (nessuna mutazione DB).
 */
test.describe('Immissione polizza — smoke wizard', () => {
  test('form immissione si carica e accetta input senza submit', async ({ page }) => {
    test.skip(!supabaseAdmin, 'SUPABASE_SERVICE_ROLE_KEY non configurata');

    const fixtures = await fetchImmissioneFixtures();
    test.skip(!fixtures, 'Dataset insufficiente (cliente/compagnia/ramo)');

    const numeroPolizza = `E2E-WIZ-${Date.now()}`;

    await page.goto(`/portafoglio/immissione?clienteId=${fixtures!.clienteId}`);
    await expectPageHealthy(page);
    await expect(page.getByRole('heading', { name: SEL.portafoglio.immissioneHeading })).toBeVisible({
      timeout: 15_000,
    });

    await pickSearchableByLabel(page, /Compagnia Assicurativa/i, fixtures!.gruppoCompagniaLabel);
    await pickSearchableByLabel(page, /Agenzia di Riferimento/i, fixtures!.compagniaLabel);
    await pickSearchableByLabel(page, /Gruppo Ramo/i, fixtures!.gruppoRamoLabel);
    await pickSearchableByLabel(page, /^Garanzia$/i, fixtures!.sottoramoLabel);

    await page.getByLabel(/^N° Polizza/i).fill(numeroPolizza);
    await page.locator('label').filter({ hasText: /^Durata Da$/ }).locator('..').locator('input[type="date"]').fill('2026-01-01');
    await page.locator('label').filter({ hasText: /^Durata A$/ }).locator('..').locator('input[type="date"]').fill('2027-01-01');

    await pickSearchableByLabel(page, /^Frazionamento$/i, 'Semestrale');

    const conferma = page.getByRole('button', { name: SEL.portafoglio.conferma });
    await expect(conferma).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page).toHaveURL(/\/portafoglio\/immissione/);
  });
});
