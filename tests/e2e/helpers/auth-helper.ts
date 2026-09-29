import { expect, type Page } from '@playwright/test';
import * as path from 'path';

/**
 * Credenziali di test (override via TEST_USER_EMAIL / TEST_USER_PASSWORD).
 * Copia locale per la suite tests/e2e/ — non modificare tests/helpers/auth-helper.ts.
 */
export const TEST_EMAIL = process.env.TEST_USER_EMAIL || 'cloude@gmail.com';
export const TEST_PASSWORD = process.env.TEST_USER_PASSWORD || 'Leone123!';

export const TEST_SEDE_EMAIL = process.env.TEST_SEDE_EMAIL || '';
export const TEST_SEDE_PASSWORD = process.env.TEST_SEDE_PASSWORD || process.env.TEST_USER_PASSWORD || 'Leone123!';

export const STORAGE_STATE = path.resolve(process.cwd(), 'tests/.auth/user.json');

/** Sessione vuota per test login senza autenticazione pre-salvata. */
export const EMPTY_STORAGE_STATE = { cookies: [] as [], origins: [] as [] };

/** Rotte riservate esclusivamente al ruolo admin (RoleGuard). */
export const ADMIN_ONLY_ROUTES: { label: string; path: string }[] = [
  { label: 'Centro Utenti & Privilegi', path: '/utenti-privilegi' },
  { label: 'Backup & Export', path: '/backup-export' },
  { label: 'Manutenzione', path: '/manutenzione' },
  { label: 'Tabelle di Base', path: '/tabelle-base' },
  { label: 'Compagnie / Agenzie', path: '/compagnie' },
  { label: 'Gestione Uffici', path: '/gestione-uffici' },
  { label: 'Sitemap', path: '/sitemap' },
];

/** Voci sidebar di primo livello / link diretti per smoke navigazione. */
export const SIDEBAR_SMOKE_LINKS: { label: string; path: RegExp }[] = [
  { label: 'Home', path: /^\/(\?|$)/ },
  { label: 'Bandi Pubblici', path: /\/bandi-pubblici/ },
  { label: 'Assistente IA', path: /\/ai-assistant/ },
];

/**
 * Esegue il login via UI partendo dalla pagina /login.
 */
export async function login(
  page: Page,
  email: string = TEST_EMAIL,
  password: string = TEST_PASSWORD,
): Promise<void> {
  await page.goto('/login');
  const emailField = page.locator('#email').or(page.getByRole('textbox', { name: /^Email$/i }));
  await emailField.waitFor({ state: 'visible', timeout: 30_000 });
  await emailField.fill(email);
  const pwdField = page.locator('#password').or(page.getByRole('textbox', { name: /^Password$/i }));
  await pwdField.fill(password);
  const submit = page.locator('button[type="submit"]').or(page.getByRole('button', { name: /^Accedi$/i }));
  await submit.click();
  const loginError = page.getByText('Accesso fallito', { exact: true }).first();
  const leftLogin = page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 30_000 });
  const failed = loginError.waitFor({ state: 'visible', timeout: 30_000 }).then(() => 'error' as const);
  const result = await Promise.race([leftLogin.then(() => 'ok' as const), failed]);
  if (result === 'error') {
    throw new Error(`Login fallito per ${email}: credenziali non valide o utente disattivato`);
  }
}

export async function logout(page: Page): Promise<void> {
  await page.locator('header button').last().click();
  await page.getByRole('menuitem', { name: 'Esci' }).click();
  await page.waitForURL((url) => url.pathname.startsWith('/login'), { timeout: 15_000 });
}

export async function searchClienti(page: Page, query: string): Promise<void> {
  await page.goto('/archivi/clienti');
  await page.getByPlaceholder('Cerca per nome, CF, P.IVA...').fill(query);
  await page.waitForTimeout(500);
}

export async function expectPageHealthy(page: Page): Promise<void> {
  await expect(page, 'non deve essere reindirizzato al login').not.toHaveURL(/\/login(\?|$)/);
  await expect(
    page.getByRole('heading', { name: /Si è verificato un errore/i }),
    'AppErrorBoundary non deve essere visibile',
  ).toHaveCount(0);
  await expect(
    page.getByText('Page not found', { exact: false }),
    'la rotta non deve cadere sul 404',
  ).toHaveCount(0);
}

export async function openFirstClienteDetail(page: Page): Promise<string | null> {
  await page.goto('/archivi/clienti');
  await expectPageHealthy(page);
  const row = page.locator('table tbody tr').filter({ hasNotText: 'Nessun cliente trovato' }).first();
  if (!(await row.count())) return null;
  await row.click();
  await page.waitForURL(/\/archivi\/clienti\/[^/]+/, { timeout: 15_000 }).catch(() => {});
  const match = page.url().match(/\/archivi\/clienti\/([^/?]+)/);
  return match?.[1] ?? null;
}

export async function openFirstSinistroDetail(page: Page): Promise<boolean> {
  await page.goto('/sinistri');
  await expectPageHealthy(page);
  const row = page.locator('table tbody tr').filter({ hasNotText: 'Nessun sinistro trovato' }).first();
  if (!(await row.count())) return false;
  await row.click();
  await page.waitForURL(/\/sinistri\/[^/]+/, { timeout: 15_000 }).catch(() => {});
  return /\/sinistri\/[^/]+/.test(page.url());
}
