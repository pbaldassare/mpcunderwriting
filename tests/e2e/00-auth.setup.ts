import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { login, STORAGE_STATE, TEST_EMAIL, TEST_PASSWORD } from './helpers/auth-helper';
import { createTestUser, supabaseAdmin } from '../helpers/db-helper';

/**
 * Setup di autenticazione.
 *
 * Esegue il login una sola volta (questo file ordina prima - prefisso 00) e salva
 * lo stato della sessione su disco. Le altre spec lo riutilizzano via
 * `test.use({ storageState: STORAGE_STATE })`, evitando di ri-loggare per ogni test.
 */
test('setup: login e salvataggio sessione', async ({ page }) => {
  if (supabaseAdmin) {
    await createTestUser(TEST_EMAIL, TEST_PASSWORD, 'admin', 'E2E');
  }

  await login(page);

  await expect(page).not.toHaveURL(/\/login/);

  fs.mkdirSync(path.dirname(STORAGE_STATE), { recursive: true });
  await page.context().storageState({ path: STORAGE_STATE });

  console.log(`[setup] Sessione salvata per ${TEST_EMAIL} -> ${STORAGE_STATE}`);
});
