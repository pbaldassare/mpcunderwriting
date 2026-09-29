import { test, expect } from '@playwright/test';
import { login, logout, TEST_EMAIL, TEST_PASSWORD } from '../helpers/auth-helper';

/**
 * Test funzionali della pagina di Login (eseguiti SENZA sessione salvata:
 * ogni test parte da utente sloggato).
 */
test.describe('Login & Autenticazione', () => {
  test('mostra il form di login con i campi attesi', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Accedi' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Password dimenticata?' })).toBeVisible();
  });

  test('una rotta protetta reindirizza al login se non autenticati', async ({ page }) => {
    await page.goto('/archivi/clienti');
    await expect(page).toHaveURL(/\/login/);
  });

  test('il toggle "mostra/nascondi password" cambia il tipo del campo', async ({ page }) => {
    await page.goto('/login');
    const pwd = page.locator('#password');
    await pwd.fill('segreto123');
    await expect(pwd).toHaveAttribute('type', 'password');

    // Il bottone occhio è l'unico button dentro il contenitore della password
    await page.locator('#password ~ button[type="button"]').click();
    await expect(pwd).toHaveAttribute('type', 'text');
  });

  test('il link "Password dimenticata?" apre la modalità recupero', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: 'Password dimenticata?' }).click();
    await expect(page.getByRole('heading', { name: 'Recupera Password' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Invia link di reset' })).toBeVisible();
    // Torna al login
    await page.getByRole('button', { name: 'Torna al login' }).click();
    await expect(page.getByRole('heading', { name: 'Accedi' })).toBeVisible();
  });

  test('credenziali errate mostrano un messaggio di errore e restano sul login', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email', TEST_EMAIL);
    await page.fill('#password', 'password-sbagliata-xyz');
    await page.click('button[type="submit"]');

    // Toast sonner di errore
    await expect(page.getByText('Accesso fallito')).toBeVisible({ timeout: 15_000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test('login con credenziali valide entra nell\'applicazione', async ({ page }) => {
    await login(page, TEST_EMAIL, TEST_PASSWORD);
    // Siamo dentro: nessun redirect al login e topbar presente
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator('header')).toBeVisible({ timeout: 15_000 });
  });

  test('logout riporta alla pagina di login', async ({ page }) => {
    await login(page, TEST_EMAIL, TEST_PASSWORD);
    await logout(page);
    await expect(page).toHaveURL(/\/login/);
  });
});
