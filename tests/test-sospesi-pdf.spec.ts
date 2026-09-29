import { test, expect } from '@playwright/test';
import * as path from 'path';

const adminEmail = 'segreteria@consulbrokers.it';
const password = 'Leone123!';

test.describe('Test Esportazione PDF Polizze Sospese', () => {

  test('Naviga su stampa-sospesi e clicca Export PDF', async ({ page, request }) => {
    test.setTimeout(60000);

    // Cattura ed evidenzia gli errori di console o di pagina
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      console.log('PAGE LOG:', msg.text());
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    page.on('pageerror', err => {
      console.error('PAGE ERROR:', err.message);
      pageErrors.push(err.message);
    });

    // 0. Esegui il login
    console.log('Navigo su /login...');
    await page.goto('/login');
    await page.fill('#email', adminEmail);
    await page.fill('#password', password);
    await page.click('button[type="submit"]');

    await page.waitForURL((url) => !url.href.includes('/login'), { timeout: 25000 });
    console.log('Login effettuato con successo.');
    await page.waitForLoadState('networkidle');

    // 1. Vai alla pagina stampa-sospesi
    console.log('Navigo su /contabilita/stampa-sospesi...');
    await page.goto('/contabilita/stampa-sospesi');
    await page.waitForLoadState('networkidle');

    // Attendi la visibilità dell'header e della tabella
    await expect(page.locator('h1:has-text("Polizze Sospese")')).toBeVisible({ timeout: 15000 });
    console.log('Pagina caricata correttamente.');

    // Controlliamo se ci sono polizze sospese (cerchiamo righe con click cursor-pointer)
    const rows = page.locator('tbody tr');
    const rowCount = await rows.count();
    console.log(`Trovate ${rowCount} righe nella tabella.`);

    // Se non ci sono polizze sospese, la tabella mostrerà il testo "Nessuna polizza sospesa corrispondente ai criteri di ricerca."
    // Ma solitamente nel DB di test c'è già qualche titolo sospeso.
    
    // 2. Clicca Export PDF
    const exportBtn = page.locator('button:has-text("Esporta PDF")');
    await expect(exportBtn).toBeVisible({ timeout: 10000 });
    
    if (rowCount > 0 && await exportBtn.isEnabled()) {
      console.log('Clicco sul pulsante "Esporta PDF"...');
      
      // Aspettiamo l'evento download
      const downloadPromise = page.waitForEvent('download', { timeout: 30000 });
      await exportBtn.click();
      
      const download = await downloadPromise;
      const downloadPath = await download.path();
      console.log(`Download completato con successo. File salvato in: ${downloadPath}`);
      expect(downloadPath).not.toBeNull();
    } else {
      console.log('Nessuna polizza sospesa da esportare o pulsante disabilitato. Provo a forzare il click se abilitato...');
      if (await exportBtn.isEnabled()) {
        await exportBtn.click();
        await page.waitForTimeout(5000);
      }
    }

    // Assicuriamoci che non ci siano stati errori gravi sulla pagina o errori di console non gestiti
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.filter(e => e.includes('Failed to load resource') || e.includes('genera-pdf-template')).length).toBe(0);
  });

});
