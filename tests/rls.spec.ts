import { test, expect } from '@playwright/test';
import { createTestUser, deleteTestUser, createTestTitolo, cleanupTestTitolo } from './helpers/db-helper';

const polizzaNumero = 'TEST-POL-RLS-AAA';
const produttoreAEmail = 'produttore.a@consulbrokers.it';
const produttoreBEmail = 'produttore.b@consulbrokers.it';
const clienteEmail = 'cliente.rls@consulbrokers.it';
const password = 'Password123!';

let produttoreAId: string;
let produttoreBId: string;
let clienteId: string;
let titoloId: string;
let clienteAnagraficaId: string;

test.describe('Sicurezza — Row Level Security (RLS) su Titoli', () => {

  // Setup: crea i produttori, il cliente e associa la polizza al Produttore A
  test.beforeAll(async () => {
    try {
      produttoreAId = await createTestUser(produttoreAEmail, password, 'produttore', 'Produttore-A');
      produttoreBId = await createTestUser(produttoreBEmail, password, 'produttore', 'Produttore-B');
      clienteId = await createTestUser(clienteEmail, password, 'cliente', 'Cliente-RLS');
      
      // La polizza viene intestata e assegnata al Produttore A
      const setupTitolo = await createTestTitolo(polizzaNumero, clienteId, produttoreAId);
      titoloId = setupTitolo.titoloId;
      clienteAnagraficaId = setupTitolo.clienteAnagraficaId;
    } catch (err) {
      console.error('Errore nel setup del test RLS:', err);
    }
  });

  // Teardown: ripulirà polizza e utenti a fine test
  test.afterAll(async () => {
    try {
      await cleanupTestTitolo(polizzaNumero, clienteAnagraficaId);
      await deleteTestUser(produttoreAId);
      await deleteTestUser(produttoreBId);
      await deleteTestUser(clienteId);
    } catch (err) {
      console.error('Errore nel teardown del test RLS:', err);
    }
  });

  test('Produttore A deve visualizzare la propria polizza', async ({ page }) => {
    // 1. Esegui il login come Produttore A
    await page.goto('/login');
    await page.fill('#email', produttoreAEmail);
    await page.fill('#password', password);
    await page.click('button[type="submit"]');
    
    // Attendi la dashboard principale
    await expect(page).toHaveURL('/');

    // 2. Naviga alla lista titoli
    await page.goto('/titoli');

    // 3. Esegui la ricerca della polizza
    await page.fill('input[placeholder="Numero polizza..."]', polizzaNumero);
    await page.click('button:has-text("CERCA")');

    // 4. Asserzione: La polizza deve comparire nella tabella
    const polizzaCell = page.locator(`td:has-text("${polizzaNumero}")`).first();
    await expect(polizzaCell).toBeVisible({ timeout: 10000 });

    // 5. Naviga direttamente al dettaglio e verifica l'accesso consentito
    await page.goto(`/titoli/${titoloId}`);
    await expect(page.locator(`text=Polizza ${polizzaNumero}`).first()).toBeVisible({ timeout: 10000 });
  });

  test('Cliente utente auth viene reindirizzato dal gestionale titoli', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email', clienteEmail);
    await page.fill('#password', password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/cliente(\?|$)/, { timeout: 15_000 });

    await page.goto(`/titoli/${titoloId}`);
    await page.waitForLoadState('networkidle').catch(() => {});
    await expect(page).toHaveURL(/\/cliente(\?|$)/);
    await expect(page.getByText(polizzaNumero)).toHaveCount(0);
  });

  test('Produttore B NON deve visualizzare nè accedere alla polizza del Produttore A', async ({ page }) => {
    // 1. Esegui il login come Produttore B
    await page.goto('/login');
    await page.fill('#email', produttoreBEmail);
    await page.fill('#password', password);
    await page.click('button[type="submit"]');
    
    // Attendi la dashboard principale
    await expect(page).toHaveURL('/');

    // 2. Naviga alla lista titoli
    await page.goto('/titoli');

    // 3. Esegui la ricerca della polizza del Produttore A
    await page.fill('input[placeholder="Numero polizza..."]', polizzaNumero);
    await page.click('button:has-text("CERCA")');

    // 4. Asserzione: La polizza NON deve comparire nei risultati
    const noResultsCell = page.locator('text=Nessun risultato trovato').first();
    await expect(noResultsCell).toBeVisible({ timeout: 10000 });

    // 5. Prova ad accedere direttamente all'URL di dettaglio della polizza
    await page.goto(`/titoli/${titoloId}`);
    
    // Asserzione: La polizza non deve essere visualizzabile (errore "Titolo non trovato" a causa della RLS)
    await expect(page.locator('text=Titolo non trovato').first()).toBeVisible({ timeout: 10000 });
  });
});
