import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
const adminEmail = 'segreteria@consulbrokers.it';
const password = 'Leone123!';

test.describe('E2E Sinistri Flow Completo', () => {
  let userSupabase: any;
  let clientId: string;
  let policyId: string;
  let sinistroId: string;

  test('Esegui tutti i test sinistro', async ({ page, request }) => {
    test.setTimeout(180000);

    // 0. Login on frontend to get session and setup user client
    await page.goto('/login');
    await page.fill('#email', adminEmail);
    await page.fill('#password', password);
    await page.click('button[type="submit"]');
    await page.waitForURL((url) => !url.href.includes('/login'), { timeout: 25000 });

    // Extract auth token from browser localStorage to authenticate our Node Supabase client as the admin user!
    const localStorageData = await page.evaluate(() => JSON.stringify(window.localStorage));
    const parsedStorage = JSON.parse(localStorageData);
    const supabaseSessionKey = Object.keys(parsedStorage).find(key => key.startsWith('sb-') && key.endsWith('-auth-token'));
    if (!supabaseSessionKey) {
      throw new Error('Supabase session not found in localStorage');
    }
    const sessionObj = JSON.parse(parsedStorage[supabaseSessionKey]);
    const accessToken = sessionObj.access_token;

    userSupabase = createClient(supabaseUrl, anonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      },
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    });

    // Setup Test Data using Authenticated Session!
    const { data: comp } = await userSupabase.from('compagnie').select('id').limit(1).single();
    const { data: ram } = await userSupabase.from('rami').select('id').limit(1).single();
    const { data: uff } = await userSupabase.from('uffici').select('id').limit(1).single();

    // Insert test client
    const { data: client, error: cErr } = await userSupabase.from('clienti').insert({
      nome: 'TEST',
      cognome: 'SINISTRO',
      codice_fiscale: 'TSTSNR80A01H501Z',
      tipo_cliente: 'privato',
      attivo: true,
      ufficio_id: uff?.id
    }).select('id').single();

    if (cErr) throw new Error(`Client creation failed: ${cErr.message}`);
    clientId = client.id;

    // Get authenticated user ID to satisfy foreign key constraint on titles table
    const { data: { user } } = await userSupabase.auth.getUser();
    if (!user) throw new Error("Utente non autenticato");
    const authUserId = user.id;

    // Insert test policy (titolo)
    const { data: policy, error: pErr } = await userSupabase.from('titoli').insert({
      numero_titolo: 'TEST-001',
      cliente_id: authUserId,
      cliente_anagrafica_id: clientId,
      stato: 'attivo',
      compagnia_id: comp?.id,
      ramo_id: ram?.id,
      ufficio_id: uff?.id,
      premio_lordo: 100
    }).select('id').single();

    if (pErr) throw new Error(`Policy creation failed: ${pErr.message}`);
    policyId = policy.id;

    // TEST 1 — Apertura Wizard /sinistri/apertura
    console.log('--- TEST 1 ---');
    await page.goto(`/sinistri/apertura?cliente_id=${clientId}`);
    await expect(page.locator('text=Cliente preselezionato').first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=TEST-001').first()).toBeVisible({ timeout: 15000 });
    await page.click('button:has-text("Avanti")');

    // Step 2 Dettagli
    await expect(page.locator('text=Step 2: Dettagli dell\'Accadimento')).toBeVisible({ timeout: 15000 });
    const todayStr = new Date().toISOString().slice(0, 10);
    await page.fill('#data_evento', todayStr);
    await page.fill('#data_denuncia', todayStr);
    await page.click('button[id="tipo_sinistro"]');
    await page.click('span:has-text("Furto")');
    await page.fill('#numero_sinistro_compagnia', 'E2E-TEST-COMPAGNIA');
    await page.fill('#luogo_sinistro', 'Milano, Centro');
    await page.fill('#importo_riserva', '500');
    await page.fill('#descrizione', 'Descrizione lunga per test e2e di almeno venti caratteri.');
    await page.click('button:has-text("Avanti")');

    // Step 3 Documenti (Salta)
    await expect(page.locator('text=Step 3: Documenti Iniziali')).toBeVisible({ timeout: 15000 });
    await page.click('button:has-text("Avanti")');

    // Step 4 Assegnazione
    await expect(page.locator('text=Step 4: Assegnazione Pratica')).toBeVisible({ timeout: 15000 });
    await page.click('div:has(> label:has-text("Liquidatore Esterno")) >> button[role="combobox"]');
    await page.locator('div[role="option"]').first().click();
    await page.click('button:has-text("Avanti")');

    // Step 5 Riepilogo
    await expect(page.locator('text=Step 5: Riepilogo e Conferma')).toBeVisible({ timeout: 15000 });
    
    // Check if redirect already occurred (due to auto-submit or fast click). If not, perform the click.
    const currentPath = await page.evaluate(() => window.location.pathname);
    if (currentPath.includes('apertura')) {
      const confirmBtn = page.locator('button[type="submit"], button:has-text("Conferma e Apri Sinistro")').first();
      await expect(confirmBtn).toBeVisible({ timeout: 10000 });
      // If button has text "Creazione in corso...", it's already submitting. Wait for redirect.
      const btnText = await confirmBtn.innerText();
      if (!btnText.includes('Creazione')) {
        await confirmBtn.click().catch(() => {});
      }
    }

    // Redirect - wait for URL to match detail view (without "apertura")
    await page.waitForURL(/\/sinistri\/(?!apertura)[a-f0-9-]+/, { timeout: 60000 });
    let currentUrl = page.url();
    sinistroId = currentUrl.split('/').pop()?.split('?')[0] || '';
    console.log('Sinistro creato con ID:', sinistroId);
    expect(sinistroId).not.toBe('');
    expect(sinistroId).not.toContain('apertura');

    // TEST 2 — Lista Sinistri /sinistri
    console.log('--- TEST 2 ---');
    // Fetch the generated numero_sinistro directly from userSupabase
    const { data: sinData } = await userSupabase.from('sinistri').select('numero_sinistro').eq('id', sinistroId).single();
    const numeroSinistro = sinData?.numero_sinistro || '';
    console.log('Codice Sinistro Generato:', numeroSinistro);

    await page.goto('/sinistri');
    await page.waitForLoadState('networkidle');
    await page.fill('input[placeholder="Cerca per numero, descrizione..."]', numeroSinistro);
    await page.waitForTimeout(2000);
    const tableRow = page.locator(`tr:has-text("${numeroSinistro}")`).first();
    await expect(tableRow).toBeVisible();

    // TEST 3 — Dettaglio Sinistro /sinistri/:id
    console.log('--- TEST 3 ---');
    await page.goto(`/sinistri/${sinistroId}`);
    await expect(page.locator('text=TEST-001').first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=SINISTRO TEST').first()).toBeVisible({ timeout: 15000 });

    // TEST 4 — Prescrizioni /sinistri/prescrizioni
    console.log('--- TEST 4 ---');
    // Calculate data_evento date so that the computed prescrizione date (data_evento + 2 years) is exactly today + 25 days
    // to fall within the red badge (< 30 days) logic.
    // data_evento = (today + 25 days) - 2 years
    const targetEventDate = new Date();
    targetEventDate.setDate(targetEventDate.getDate() + 25);
    targetEventDate.setFullYear(targetEventDate.getFullYear() - 2);
    const eventDateStr = targetEventDate.toISOString().slice(0, 10);
    await userSupabase.from('sinistri').update({ data_evento: eventDateStr }).eq('id', sinistroId);

    await page.goto('/sinistri/prescrizioni');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    const tablePrescrizione = page.locator(`tr:has-text("${numeroSinistro}")`).first();
    await expect(tablePrescrizione).toBeVisible({ timeout: 15000 });

    // TEST 5 — Report SIR /sinistri/report-sir
    console.log('--- TEST 5 ---');
    await page.goto('/sinistri/report-sir');
    await page.waitForLoadState('networkidle');

    // TEST 6 — Apertura da scheda cliente
    console.log('--- TEST 6 ---');
    await page.goto(`/archivi/clienti/${clientId}`);
    await page.click('button[role="tab"]:has-text("Sinistri")');
    const apriSinistroBtn = page.locator('button:has-text("Apri Sinistro")').first();
    await expect(apriSinistroBtn).toBeVisible({ timeout: 15000 });
    await apriSinistroBtn.click();
    await page.waitForURL(/\/sinistri\/apertura\?cliente_id=.+/, { timeout: 15000 });
    await expect(page.locator('text=Cliente preselezionato')).toBeVisible({ timeout: 15000 });

    // Teardown
    console.log('--- TEARDOWN ---');
    if (sinistroId) {
      await userSupabase.from('sinistro_checklist').delete().eq('sinistro_id', sinistroId);
      await userSupabase.from('sinistro_eventi').delete().eq('sinistro_id', sinistroId);
      await userSupabase.from('sinistri').delete().eq('id', sinistroId);
    }
    if (policyId) {
      await userSupabase.from('titoli').delete().eq('id', policyId);
    }
    if (clientId) {
      await userSupabase.from('clienti').delete().eq('id', clientId);
    }
  });
});
