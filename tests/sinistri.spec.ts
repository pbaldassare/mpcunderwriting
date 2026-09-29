import { test, expect } from '@playwright/test';
import { createTestUser, deleteTestUser, createTestTitolo, cleanupTestTitolo, deleteTestSinistro } from './helpers/db-helper';

const polizzaNumero = 'TEST-POL-SIN-111';
const sinistroNumero = 'TEST-SIN-E2E-999';
const adminEmail = 'test.admin.sinistri@consulbrokers.it';
const clienteEmail = 'test.cliente.sinistri@consulbrokers.it';
const produttoreEmail = 'test.produttore.sinistri@consulbrokers.it';
const password = 'Password123!';

let adminId: string;
let clienteId: string;
let produttoreId: string;
let titoloId: string;
let clienteAnagraficaId: string;

test.describe.skip('Sinistri — Apertura e Cambio Stato (legacy dialog rimosso, ora /sinistri/apertura)', () => {

  // Setup: Crea gli utenti e la polizza attiva necessari per aprire il sinistro
  test.beforeAll(async () => {
    try {
      adminId = await createTestUser(adminEmail, password, 'admin', 'Admin-Sinistri');
      clienteId = await createTestUser(clienteEmail, password, 'cliente', 'Cliente-Sinistri');
      produttoreId = await createTestUser(produttoreEmail, password, 'produttore', 'Produttore-Sinistri');
      
      const setupTitolo = await createTestTitolo(polizzaNumero, clienteId, produttoreId);
      titoloId = setupTitolo.titoloId;
      clienteAnagraficaId = setupTitolo.clienteAnagraficaId;
    } catch (err) {
      console.error('Errore nel setup del test Sinistri:', err);
    }
  });

  // Teardown: Elimina il sinistro, la polizza e gli utenti temporanei
  test.afterAll(async () => {
    try {
      await deleteTestSinistro(sinistroNumero);
      await cleanupTestTitolo(polizzaNumero, clienteAnagraficaId);
      await deleteTestUser(adminId);
      await deleteTestUser(clienteId);
      await deleteTestUser(produttoreId);
    } catch (err) {
      console.error('Errore nel teardown del test Sinistri:', err);
    }
  });

  test('Apertura nuovo sinistro e cambio di stato in lavorazione', async ({ page }) => {
    // 1. Esegui il login come L1 Admin
    await page.goto('/login');
    await page.fill('#email', adminEmail);
    await page.fill('#password', password);
    await page.click('button[type="submit"]');
    
    // Attendi la dashboard principale
    await expect(page).toHaveURL('/');

    // 2. Naviga alla lista Sinistri
    await page.goto('/sinistri');

    // 3. Apri la modale "Nuovo Sinistro"
    const nuovoSinistroButton = page.locator('button:has-text("Nuovo Sinistro")');
    await expect(nuovoSinistroButton).toBeVisible();
    await nuovoSinistroButton.click();

    // 4. STEP 1: Cerca la polizza attiva creata nel setup
    const polizzaInput = page.locator('input[placeholder="Numero polizza"]');
    await expect(polizzaInput).toBeVisible();
    await polizzaInput.fill(polizzaNumero);
    
    const cercaPolizzeButton = page.locator('button:has-text("Cerca Polizze")');
    await cercaPolizzeButton.click();

    // Seleziona la polizza trovata nei risultati
    const selezionaButton = page.locator('button:has-text("Seleziona")').first();
    await expect(selezionaButton).toBeVisible({ timeout: 10000 });
    await selezionaButton.click();

    // 5. STEP 2: Inserisci i dati del sinistro
    await page.fill('input[placeholder="Es. SIN-2026-001"]', sinistroNumero);
    
    // Seleziona il Tipo Sinistro
    await page.click('button:has-text("Seleziona tipo")');
    await page.click('div[role="option"] >> text=furto');

    // Compila il luogo e la data evento
    await page.fill('input[placeholder="Es. Via Roma 1, Milano"]', 'Via Test E2E, Roma');
    
    // Data evento (impostiamo oggi in formato YYYY-MM-DD)
    const todayStr = new Date().toISOString().slice(0, 10);
    await page.fill('input[type="date"]', todayStr);

    // Compila la descrizione
    await page.fill('textarea[placeholder="Descrivi l\'evento..."]', 'Furto attrezzature informatiche di test e2e');

    // Invia il form
    await page.click('button:has-text("Crea Sinistro")');

    // 6. Verifica la comparsa del toast di successo
    await expect(page.locator('text=Sinistro creato').first()).toBeVisible({ timeout: 15000 });

    // 7. Cerca il sinistro nella tabella principale e cliccaci per andare al dettaglio
    await page.fill('input[placeholder="Cerca per numero, descrizione..."]', sinistroNumero);
    const tableRow = page.locator(`td:has-text("${sinistroNumero}")`).first();
    await expect(tableRow).toBeVisible({ timeout: 10000 });
    await tableRow.click();

    // 8. Verifica che la navigazione sia andata sulla pagina di dettaglio sinistro
    await expect(page).toHaveURL(/\/sinistri\/.+/);

    // 9. Cambia lo stato in "IN LAVORAZIONE"
    const inLavorazioneButton = page.locator('button:has-text("IN LAVORAZIONE")');
    await expect(inLavorazioneButton).toBeVisible();
    await inLavorazioneButton.click();

    // 10. Verifica la notifica di aggiornamento stato
    await expect(page.locator('text=Stato aggiornato a "IN LAVORAZIONE"').first()).toBeVisible({ timeout: 15000 });

    // 11. Verifica il badge dello stato aggiornato a "IN LAVORAZIONE"
    await expect(page.locator('text=IN LAVORAZIONE').first()).toBeVisible();
  });
});
