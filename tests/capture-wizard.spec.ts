import { test, expect } from '@playwright/test';
import * as path from 'path';

const adminEmail = 'segreteria@consulbrokers.it';
const password = 'Leone123!';
const artifactDir = 'C:/Users/Administrator/.gemini/antigravity-ide/brain/2ad2c41b-6f60-4e4e-8e6b-691b9659a1ce';

test.describe('Cattura Screenshot Sinistri', () => {

  test('Naviga pagine sinistri e cattura screenshot', async ({ page, request }) => {
    test.setTimeout(120000);

    // Abilita logging in console
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', err => console.error('PAGE ERROR:', err.message));

    // 0. Esegui il provision dell'utente segreteria prima di procedere
    try {
      console.log('Chiamata a provision-user per segreteria@consulbrokers.it...');
      const resp = await request.post('https://zbjmnnlojxprlogbnxef.supabase.co/functions/v1/provision-user', {
        data: { secret: 'provision-segreteria-2026' }
      });
      console.log('Provision user status:', resp.status(), await resp.text());
    } catch (err: any) {
      console.warn('Impossibile chiamare la Edge Function di provision-user:', err.message);
    }

    // 1. Esegui il Login
    let loginSuccess = false;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await page.goto('/login');
        await page.fill('#email', adminEmail);
        await page.fill('#password', password);
        await page.click('button[type="submit"]');
        
        // Attendi che l'URL si sposti dalla pagina di login
        await page.waitForURL((url) => !url.href.includes('/login'), { timeout: 25000 });
        loginSuccess = true;
        break;
      } catch (err: any) {
        console.warn(`[Login] Tentativo ${attempt} fallito: ${err.message}. Riprovo in 3 secondi...`);
        await page.waitForTimeout(3000);
      }
    }

    if (!loginSuccess) {
      throw new Error("Impossibile effettuare il login.");
    }
    
    await page.waitForLoadState('networkidle');

    // ==========================================
    // PAGINA 1: WIZARD MULTI-STEP APERTURA
    // ==========================================
    await page.goto('/sinistri/apertura');
    await expect(page.locator('text=Apertura Nuovo Sinistro')).toBeVisible({ timeout: 15000 });

    // Step 1: Polizza
    await page.screenshot({ path: path.join(artifactDir, 'wizard_step1.png') });

    // Cerca una qualsiasi polizza attiva digitando "A" o lasciando vuoto
    await page.fill('input[placeholder="Cerca per Numero Polizza, Nome / Cognome / Ragione Sociale cliente..."]', 'A');
    await page.click('button:has-text("Cerca Polizze")');
    
    // Seleziona la prima polizza trovata
    const selezionaBtn = page.locator('button:has-text("Seleziona")').first();
    await expect(selezionaBtn).toBeVisible({ timeout: 15000 });
    await selezionaBtn.click();
    await expect(page.locator('text=Polizza Selezionata per il Sinistro')).toBeVisible({ timeout: 15000 });
    await page.click('button:has-text("Avanti")');

    // Step 2: Dati Sinistro
    await expect(page.locator('text=Step 2: Dettagli dell\'Accadimento')).toBeVisible({ timeout: 15000 });
    
    const todayStr = new Date().toISOString().slice(0, 10);
    await page.fill('#data_evento', todayStr);
    await page.fill('#data_denuncia', todayStr);
    await page.click('button[id="tipo_sinistro"]');
    await page.click('span:has-text("Furto")');
    await page.fill('#numero_sinistro_compagnia', 'WIZ-TEST-123456');
    await page.fill('#luogo_sinistro', 'Milano, Centro');
    await page.fill('#importo_riserva', '1500');
    await page.fill('#descrizione', 'Apertura sinistro di test da script per screenshot.');
    await page.screenshot({ path: path.join(artifactDir, 'wizard_step2.png') });
    await page.click('button:has-text("Avanti")');

    // Step 3: Documenti
    await expect(page.locator('text=Step 3: Documenti Iniziali')).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: path.join(artifactDir, 'wizard_step3.png') });
    await page.click('button:has-text("Avanti")');

    // Step 4: Assegnazione
    await expect(page.locator('text=Step 4: Assegnazione Pratica')).toBeVisible({ timeout: 15000 });

    // Seleziona liquidatore esterno
    await page.click('div:has(> label:has-text("Liquidatore Esterno")) >> button[role="combobox"]');
    await page.locator('div[role="option"]').first().click();

    await page.fill('#note_interne', 'Test screenshot note interne.');
    await page.screenshot({ path: path.join(artifactDir, 'wizard_step4.png') });
    await page.click('button:has-text("Avanti")');

    // Step 5: Riepilogo
    await expect(page.locator('text=Step 5: Riepilogo e Conferma')).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: path.join(artifactDir, 'wizard_step5.png') });

    // ==========================================
    // PAGINA 2: PRESCRIZIONI
    // ==========================================
    await page.goto('/sinistri/prescrizioni');
    await page.waitForLoadState('networkidle');
    // Aspetta 3 secondi per sicurezza caricamento dati
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(artifactDir, 'prescrizioni.png') });

    // ==========================================
    // PAGINA 3: REPORT SIR
    // ==========================================
    await page.goto('/sinistri/report-sir');
    await page.waitForLoadState('networkidle');
    
    // Apri SearchableSelect per i sinistri di tipo infortunio/malattia
    await page.click('button[role="combobox"]');
    await page.waitForTimeout(2000);
    
    const option = page.locator('div[role="option"]').first();
    if (await option.count() > 0) {
      await option.click();
      // Attendi che i campi si popolino (es. input nome ha valore)
      await page.waitForFunction(() => {
        const input = document.getElementById('nome') as HTMLInputElement;
        return input && input.value !== '';
      }, { timeout: 10000 }).catch(() => console.log('Timeout attesa popolamento dati infortunato'));
      await page.waitForTimeout(2000);
    }
    
    await page.screenshot({ path: path.join(artifactDir, 'report_sir.png') });
  });

});
