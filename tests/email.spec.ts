import { test, expect } from '@playwright/test';
import { createTestUser, deleteTestUser, createTestTitolo, cleanupTestTitolo } from './helpers/db-helper';

const polizzaNumero = 'TEST-POL-MAIL-888';
const adminEmail = 'test.admin.email@consulbrokers.it';
const clienteEmail = 'test.cliente.email@consulbrokers.it';
const produttoreEmail = 'test.produttore.email@consulbrokers.it';
const password = 'Password123!';

let adminId: string;
let clienteId: string;
let produttoreId: string;
let titoloId: string;
let clienteAnagraficaId: string;

test.describe('Email — Invocazione Edge Function di Notifica', () => {

  // Setup: crea gli utenti e la polizza attiva necessari
  test.beforeAll(async () => {
    try {
      adminId = await createTestUser(adminEmail, password, 'admin', 'Admin-Email');
      clienteId = await createTestUser(clienteEmail, password, 'cliente', 'Cliente-Email');
      produttoreId = await createTestUser(produttoreEmail, password, 'produttore', 'Produttore-Email');
      
      const setupTitolo = await createTestTitolo(polizzaNumero, clienteId, produttoreId);
      titoloId = setupTitolo.titoloId;
      clienteAnagraficaId = setupTitolo.clienteAnagraficaId;
    } catch (err) {
      console.error('Errore nel setup del test Email:', err);
    }
  });

  // Teardown: ripulirà polizza e utenti a fine test
  test.afterAll(async () => {
    try {
      await cleanupTestTitolo(polizzaNumero, clienteAnagraficaId);
      await deleteTestUser(adminId);
      await deleteTestUser(clienteId);
      await deleteTestUser(produttoreId);
    } catch (err) {
      console.error('Errore nel teardown del test Email:', err);
    }
  });

  test('Verifica chiamata di rete a notifica-messa-cassa-agenzia su cassa', async ({ page }) => {
    let edgeFunctionChiamata = false;
    let payloadInviato: any = null;

    // Intercetta la chiamata POST all'Edge Function di notifica di messa a cassa
    await page.route('**/functions/v1/notifica-messa-cassa-agenzia', async (route) => {
      edgeFunctionChiamata = true;
      const request = route.request();
      if (request.method() === 'POST') {
        payloadInviato = request.postDataJSON();
      }
      
      // Rispondi con un mock di successo per evitare invii email reali in produzione
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, message: 'Email inviata con successo (mock)', recipient: 'test@compagnia.it' })
      });
    });

    // 1. Esegui il login come L1 Admin
    await page.goto('/login');
    await page.fill('#email', adminEmail);
    await page.fill('#password', password);
    await page.click('button[type="submit"]');
    
    // Attendi la dashboard principale
    await expect(page).toHaveURL('/');

    // 2. Naviga direttamente al dettaglio della polizza
    await page.goto(`/titoli/${titoloId}`);

    // 3. Esegui il click sul pulsante "Incassa"
    const incassaButton = page.locator('button:has-text("Incassa")');
    await expect(incassaButton).toBeVisible();
    await incassaButton.click();

    // 4. Conferma la messa a cassa nella modale
    const confirmButton = page.locator('button:has-text("Conferma")').first();
    await expect(confirmButton).toBeVisible();
    await confirmButton.click();

    // 5. Attendi il caricamento dello stato aggiornato (e l'invocazione dell'Edge Function)
    await expect(page.locator('text=Stato aggiornato').first()).toBeVisible({ timeout: 15000 });

    // 6. Asserzione: Verifica che la chiamata di rete all'Edge Function sia avvenuta
    expect(edgeFunctionChiamata).toBe(true);

    // 7. Asserzione: Verifica che il payload della chiamata contenga il corretto titolo_id
    expect(payloadInviato).not.toBeNull();
    expect(payloadInviato.titolo_id).toBe(titoloId);
  });
});
