import { test, expect } from '@playwright/test';
import { createTestUser, deleteTestUser } from './helpers/db-helper';

// Definiamo le credenziali e i ruoli di test
const testUsers = [
  { email: 'test.admin@consulbrokers.it', password: 'Password123!', role: 'admin', expectedPath: '/' },
  { email: 'test.cfo@consulbrokers.it', password: 'Password123!', role: 'cfo', expectedPath: '/' },
  { email: 'test.ufficio@consulbrokers.it', password: 'Password123!', role: 'ufficio', expectedPath: '/' },
  { email: 'test.produttore@consulbrokers.it', password: 'Password123!', role: 'produttore', expectedPath: '/' },
  { email: 'test.cliente@consulbrokers.it', password: 'Password123!', role: 'cliente', expectedPath: '/cliente' },
];

let createdUserIds: string[] = [];

test.describe('Autenticazione — Login con Ruoli Diversi', () => {
  
  // Setup: crea gli utenti di test prima di iniziare la suite
  test.beforeAll(async () => {
    for (const u of testUsers) {
      try {
        const userId = await createTestUser(u.email, u.password, u.role, `${u.role.toUpperCase()}-Test`);
        createdUserIds.push(userId);
      } catch (err) {
        console.error(`Errore nel setup dell'utente ${u.email}:`, err);
      }
    }
  });

  // Teardown: elimina gli utenti di test dopo aver completato la suite
  test.afterAll(async () => {
    for (const id of createdUserIds) {
      try {
        await deleteTestUser(id);
      } catch (err) {
        console.error(`Errore nel teardown dell'utente con ID ${id}:`, err);
      }
    }
  });

  // Test per ciascun utente
  for (const u of testUsers) {
    test(`Login con successo come ${u.role}`, async ({ page }) => {
      // 1. Vai alla pagina di login
      await page.goto('/login');

      // 2. Compila i campi email e password
      await page.fill('#email', u.email);
      await page.fill('#password', u.password);

      // 3. Clicca su Accedi
      await page.click('button[type="submit"]');

      // 4. Attendi che l'URL contenga il percorso di destinazione previsto
      await expect(page).toHaveURL(new RegExp(u.expectedPath + '$|' + u.expectedPath));
      
      // 5. Verifica la presenza di un indicatore visivo di login riuscito (es. logout o menu)
      // Spesso c'è un pulsante o icona utente, o il bottone Esci/Logout.
      // Se il caricamento della dashboard ha successo, l'utente è dentro.
      const isClient = u.role === 'cliente';
      if (isClient) {
        await expect(page.locator('text=Polizze').first()).toBeVisible({ timeout: 10000 });
      } else {
        await expect(page.locator('text=Dashboard').first()).toBeVisible({ timeout: 10000 });
      }
    });
  }
});
