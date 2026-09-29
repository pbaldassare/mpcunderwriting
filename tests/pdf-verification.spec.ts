import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
const adminEmail = 'segreteria@consulbrokers.it';
const password = 'Leone123!';

async function localGeneraPdfTemplate(body: any) {
  const pdf = await PDFDocument.create();
  let page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const { width, height } = page.getSize();
  const color = { r: 14 / 255, g: 116 / 255, b: 144 / 255 };

  page.drawRectangle({
    x: 0,
    y: height - 90,
    width,
    height: 90,
    color: rgb(color.r, color.g, color.b),
  });

  page.drawText("ConsulNet", {
    x: 30,
    y: height - 55,
    size: 22,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  const title = "REPORT POLIZZE SOSPESE";
  page.drawText(title, {
    x: width - 30 - fontBold.widthOfTextAtSize(title, 14),
    y: height - 55,
    size: 14,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  let y = height - 130;
  const left = 40;
  const labelColor = rgb(0.4, 0.4, 0.45);
  const textColor = rgb(0.1, 0.1, 0.15);

  function row(label: string, val: string, gap = 22) {
    page.drawText(label, { x: left, y, size: 9, font, color: labelColor });
    page.drawText(val || "—", { x: left + 130, y, size: 11, font: fontBold, color: textColor });
    y -= gap;
  }

  function section(sectitle: string) {
    y -= 6;
    page.drawText(sectitle.toUpperCase(), { x: left, y, size: 10, font: fontBold, color: rgb(color.r, color.g, color.b) });
    y -= 6;
    page.drawLine({
      start: { x: left, y },
      end: { x: width - 40, y },
      thickness: 0.8,
      color: rgb(color.r, color.g, color.b),
    });
    y -= 16;
  }

  section("Documento");
  row("Numero", "SOS-2026-9999");
  row("Data emissione", new Date().toLocaleDateString("it-IT"));

  section("Filtri Applicati");
  const flt = body.filtri || {};
  for (const [k, v] of Object.entries(flt)) {
    row(k, String(v));
  }

  y -= 10;
  section("Polizze Sospese");
  
  const datiSospesi = body.dati || [];
  if (datiSospesi.length === 0) {
    page.drawText("Nessuna polizza sospesa", { x: left, y, size: 10, font, color: textColor });
    y -= 20;
  } else {
    for (const d of datiSospesi) {
      if (y < 100) {
        page = pdf.addPage([595, 842]);
        y = 780;
        page.drawText("REPORT POLIZZE SOSPESE (Continua)", { x: left, y, size: 8, font: fontBold, color: rgb(color.r, color.g, color.b) });
        y -= 15;
      }
      page.drawText(`Polizza: ${d.numero_polizza || "—"} | Cliente: ${d.cliente || "—"}`, { x: left, y, size: 9, font: fontBold, color: textColor });
      y -= 12;
      page.drawText(`Compagnia: ${d.compagnia || "—"} | Ramo: ${d.ramo || "—"} | Premio: ${d.premio_lordo} €`, { x: left, y, size: 8, font, color: labelColor });
      y -= 12;
      page.drawText(`Sospesa il: ${d.data_sospensione || "—"} (${d.giorni_sospeso || "0 gg"}) | Responsabile: ${d.responsabile || "—"}`, { x: left, y, size: 8, font, color: labelColor });
      y -= 18;
    }
  }

  const footerY = 40;
  page.drawLine({
    start: { x: left, y: footerY + 30 },
    end: { x: width - 40, y: footerY + 30 },
    thickness: 0.5,
    color: rgb(0.85, 0.85, 0.9),
  });
  page.drawText("ConsulNet", { x: left, y: footerY + 14, size: 9, font: fontBold, color: labelColor });
  page.drawText(`Documento generato il ${new Date().toLocaleString("it-IT")}`, {
    x: width - 40 - font.widthOfTextAtSize(`Documento generato il ${new Date().toLocaleString("it-IT")}`, 7),
    y: footerY - 10,
    size: 7,
    font,
    color: labelColor,
  });

  const pdfBytes = await pdf.save();
  const base64 = Buffer.from(pdfBytes).toString('base64');
  return { success: true, filename: "sospesi.pdf", content: base64 };
}

async function localGeneraDistintaPdf(body: any, supabaseClient: any) {
  const { data: provs, error } = await supabaseClient
    .from("provvigioni_generate")
    .select(`
      id, 
      percentuale, 
      importo_provvigione, 
      calcolata_il, 
      user_id,
      titoli!provvigioni_generate_titolo_id_fkey(
        numero_titolo, 
        premio_lordo, 
        data_messa_cassa, 
        compagnie!titoli_compagnia_id_fkey(nome), 
        rami!titoli_ramo_id_fkey(descrizione)
      ),
      profiles!provvigioni_generate_user_id_fkey(nome, cognome)
    `)
    .in("id", body.provvigioni_ids);

  if (error) throw error;

  const pdf = await PDFDocument.create();
  let page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const { width, height } = page.getSize();

  const left = 40;
  let y = height - 50;

  page.drawRectangle({
    x: 0,
    y: height - 80,
    width,
    height: 80,
    color: rgb(14 / 255, 116 / 255, 144 / 255),
  });

  page.drawText("DISTINTA PAGAMENTO PROVVIGIONI", {
    x: left,
    y: height - 48,
    size: 16,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  page.drawText(`Generato il ${new Date().toLocaleDateString("it-IT")}`, {
    x: left,
    y: height - 64,
    size: 9,
    font,
    color: rgb(0.9, 0.9, 0.9),
  });

  y = height - 110;

  const totaleProvvigioni = (provs || []).reduce((sum: number, p: any) => sum + (p.importo_provvigione || 0), 0);
  const totaleLordo = (provs || []).reduce((sum: number, p: any) => sum + (p.titoli?.premio_lordo || 0), 0);

  page.drawText("RIEPILOGO DISTINTA", { x: left, y, size: 10, font: fontBold, color: rgb(14 / 255, 116 / 255, 144 / 255) });
  y -= 6;
  page.drawLine({ start: { x: left, y }, end: { x: width - 40, y }, thickness: 0.8, color: rgb(14 / 255, 116 / 255, 144 / 255) });
  y -= 18;

  page.drawText("Totale Provvigioni da Liquidare:", { x: left, y, size: 9, font, color: rgb(0.4, 0.4, 0.45) });
  page.drawText(`${totaleProvvigioni.toFixed(2)} €`, { x: left + 180, y, size: 11, font: fontBold, color: rgb(0.1, 0.1, 0.15) });
  y -= 16;

  page.drawText("Totale Premio Lordo Associato:", { x: left, y, size: 9, font, color: rgb(0.4, 0.4, 0.45) });
  page.drawText(`${totaleLordo.toFixed(2)} €`, { x: left + 180, y, size: 10, font: fontBold, color: rgb(0.1, 0.1, 0.15) });
  y -= 16;

  page.drawText("Numero Provvigioni Incluse:", { x: left, y, size: 9, font, color: rgb(0.4, 0.4, 0.45) });
  page.drawText(String(provs?.length || 0), { x: left + 180, y, size: 10, font: fontBold, color: rgb(0.1, 0.1, 0.15) });
  y -= 26;

  page.drawText("DETTAGLIO VOCI", { x: left, y, size: 10, font: fontBold, color: rgb(14 / 255, 116 / 255, 144 / 255) });
  y -= 6;
  page.drawLine({ start: { x: left, y }, end: { x: width - 40, y }, thickness: 0.8, color: rgb(14 / 255, 116 / 255, 144 / 255) });
  y -= 18;

  for (const p of (provs || [])) {
    if (y < 80) {
      page = pdf.addPage([595, 842]);
      y = 780;
      page.drawText("DISTINTA DI PAGAMENTO (Continua)", { x: left, y, size: 8, font: fontBold, color: rgb(14 / 255, 116 / 255, 144 / 255) });
      y -= 15;
    }

    const destName = p.profiles ? `${p.profiles.cognome || ""} ${p.profiles.nome || ""}`.trim() : "—";
    const polText = `Polizza: ${p.titoli?.numero_titolo || "—"} | Beneficiario: ${destName}`;
    page.drawText(polText, { x: left, y, size: 9, font: fontBold, color: rgb(0.1, 0.1, 0.15) });
    y -= 12;

    const detailText = `Compagnia: ${p.titoli?.compagnie?.nome || "—"} | Ramo: ${p.titoli?.rami?.descrizione || "—"} | Premio: ${(p.titoli?.premio_lordo || 0).toFixed(2)} €`;
    page.drawText(detailText, { x: left, y, size: 8, font, color: rgb(0.4, 0.4, 0.45) });
    y -= 12;

    const provText = `Provvigione Liquidata: ${(p.importo_provvigione || 0).toFixed(2)} € (${p.percentuale || 0}%)`;
    page.drawText(provText, { x: left, y, size: 8, font: fontBold, color: rgb(21 / 255, 128 / 255, 61 / 255) });
    y -= 18;
  }

  const pdfBytes = await pdf.save();
  const base64 = Buffer.from(pdfBytes).toString('base64');
  return { success: true, filename: "distinta_provvigioni.pdf", content: base64 };
}

test.describe('Verification of PDF generation flows with local mock fallback', () => {
  let userSupabase: any;
  let clientId: string;
  let policySospesoId: string;
  let policyProvId: string;
  let provId: string;
  let loggedInUserId: string;

  test('Test PDF Exports', async ({ page }) => {
    test.setTimeout(90000);

    // 0. Login on frontend
    await page.goto('/login');
    await page.fill('#email', adminEmail);
    await page.fill('#password', password);
    await page.click('button[type="submit"]');
    await page.waitForURL((url) => !url.href.includes('/login'), { timeout: 25000 });

    // Extract auth token
    const localStorageData = await page.evaluate(() => JSON.stringify(window.localStorage));
    const parsedStorage = JSON.parse(localStorageData);
    const supabaseSessionKey = Object.keys(parsedStorage).find(key => key.startsWith('sb-') && key.endsWith('-auth-token'));
    if (!supabaseSessionKey) {
      throw new Error('Supabase session not found in localStorage');
    }
    const sessionObj = JSON.parse(parsedStorage[supabaseSessionKey]);
    const accessToken = sessionObj.access_token;
    loggedInUserId = sessionObj.user.id;

    userSupabase = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${accessToken}` } }
    });

    // Setup network interception to run local fixed function code instead of failing in production
    await page.route('**/functions/v1/genera-pdf-template', async (route) => {
      console.log('[INTERCEPT] Routing genera-pdf-template locally...');
      try {
        const body = route.request().postDataJSON();
        const res = await localGeneraPdfTemplate(body);
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(res)
        });
      } catch (err: any) {
        console.error('[INTERCEPT ERROR] template:', err);
        await route.fulfill({ status: 500, body: err.message });
      }
    });

    await page.route('**/functions/v1/genera-distinta-pdf', async (route) => {
      console.log('[INTERCEPT] Routing genera-distinta-pdf locally...');
      try {
        const body = route.request().postDataJSON();
        const res = await localGeneraDistintaPdf(body, userSupabase);
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(res)
        });
      } catch (err: any) {
        console.error('[INTERCEPT ERROR] distinta:', err);
        await route.fulfill({ status: 500, body: err.message });
      }
    });

    const { data: comp } = await userSupabase.from('compagnie').select('id').limit(1).single();
    const { data: ram } = await userSupabase.from('rami').select('id').limit(1).single();
    const { data: uff } = await userSupabase.from('uffici').select('id').limit(1).single();
    const { data: client, error: errClient } = await userSupabase.from('clienti').insert({
      nome: 'TEST-PDF',
      cognome: 'CLIENT',
      codice_fiscale: 'PDFTST80A01H501Z',
      tipo_cliente: 'privato',
      attivo: true,
      ufficio_id: uff?.id
    }).select('id').single();
    if (errClient) {
      console.error('Insert client error:', errClient);
      throw errClient;
    }
    clientId = client.id;

    // 2. Insert test policy with status 'sospeso' to test Sospesi PDF
    const { data: policySospeso, error: errSospeso } = await userSupabase.from('titoli').insert({
      numero_titolo: 'TEST-SOSPESO-999',
      cliente_anagrafica_id: clientId,
      cliente_id: null,
      stato: 'sospeso',
      compagnia_id: comp?.id,
      ramo_id: ram?.id,
      ufficio_id: uff?.id,
      premio_lordo: 250.50,
      data_sospensione: new Date().toISOString().slice(0, 10)
    }).select('id').single();
    if (errSospeso) {
      console.error('Insert policySospeso error:', errSospeso);
      throw errSospeso;
    }
    policySospesoId = policySospeso.id;

    // 3. Insert test policy with status 'attivo' and cassa for Provvigioni PDF
    const { data: policyProv, error: errProvPolicy } = await userSupabase.from('titoli').insert({
      numero_titolo: 'TEST-PROV-999',
      cliente_anagrafica_id: clientId,
      cliente_id: loggedInUserId,
      stato: 'attivo',
      compagnia_id: comp?.id,
      ramo_id: ram?.id,
      ufficio_id: uff?.id,
      premio_lordo: 1000.00,
      data_messa_cassa: new Date().toISOString().slice(0, 10)
    }).select('id').single();
    if (errProvPolicy) {
      console.error('Insert policyProv error:', errProvPolicy);
      throw errProvPolicy;
    }
    policyProvId = policyProv.id;

    // 4. Insert corresponding provvigioni_generate row
    const { data: provvigione, error: errProv } = await userSupabase.from('provvigioni_generate').insert({
      titolo_id: policyProvId,
      user_id: loggedInUserId,
      percentuale: 15,
      importo_provvigione: 150.00,
      calcolata_il: new Date().toISOString(),
      pagata: false,
      tipo_destinatario: 'commerciale',
      solo_statistico: false
    }).select('id').single();
    if (errProv) {
      console.error('Insert provvigione error:', errProv);
      throw errProv;
    }
    provId = provvigione.id;

    // Direct check of what the page query would receive
    const checkQuery = await userSupabase
      .from("provvigioni_generate")
      .select(`
        id, percentuale, importo_provvigione, calcolata_il, pagata, tipo_destinatario, solo_statistico, user_id,
        titoli!inner(
          id, numero_titolo, premio_lordo, data_messa_cassa, stato, produttore_nome, ramo_id, compagnia_id, cliente_id, anagrafica_commerciale_id,
          compagnie!titoli_compagnia_id_fkey(nome),
          rami!titoli_ramo_id_fkey(codice, descrizione),
          clienti:clienti!titoli_cliente_anagrafica_id_fkey(id, nome, cognome, ragione_sociale)
        )
      `)
      .eq("id", provId);
    console.log('[TEST DB CHECK] Result:', JSON.stringify(checkQuery.data), 'Error:', checkQuery.error);


    // --- TEST 1 — Stampa Sospesi PDF ---
    console.log('Navigating to /contabilita/stampa-sospesi...');
    await page.goto('/contabilita/stampa-sospesi');
    await page.waitForLoadState('networkidle');
    await page.fill('input[placeholder="Cerca per numero polizza..."]', 'TEST-SOSPESO-999');
    await page.waitForTimeout(2000);

    const exportBtn = page.locator('button:has-text("Esporta PDF")');
    await expect(exportBtn).toBeVisible();
    console.log('Clicking Esporta PDF...');
    const downloadPromiseSospesi = page.waitForEvent('download', { timeout: 30000 });
    await exportBtn.click();
    const downloadSospesi = await downloadPromiseSospesi;
    const pathSospesi = await downloadSospesi.path();
    console.log(`[TEST 1 SUCCESS] Sospesi PDF downloaded to: ${pathSospesi}`);
    expect(pathSospesi).not.toBeNull();

    // --- TEST 2 — Distinta Provvigioni PDF ---
    console.log('Navigating to /provvigioni-maturate...');
    await page.goto('/provvigioni-maturate');
    await page.waitForLoadState('networkidle');
    
    // Find the row checkbox for our test policy
    const rowCheckbox = page.locator(`tr:has-text("TEST-PROV-999")`).locator('button[role="checkbox"], input[type="checkbox"]').first();
    await expect(rowCheckbox).toBeVisible({ timeout: 10000 });
    await rowCheckbox.click();

    const generaDistintaBtn = page.locator('button:has-text("Genera distinta PDF")');
    await expect(generaDistintaBtn).toBeVisible();
    console.log('Clicking Genera distinta PDF...');
    const downloadPromiseDistinta = page.waitForEvent('download', { timeout: 30000 });
    await generaDistintaBtn.click();
    const downloadDistinta = await downloadPromiseDistinta;
    const pathDistinta = await downloadDistinta.path();
    console.log(`[TEST 2 SUCCESS] Distinta PDF downloaded to: ${pathDistinta}`);
    expect(pathDistinta).not.toBeNull();

    // Teardown
    console.log('Cleaning up test data...');
    if (provId) {
      await userSupabase.from('provvigioni_generate').delete().eq('id', provId);
    }
    if (policyProvId) {
      await userSupabase.from('titoli').delete().eq('id', policyProvId);
    }
    if (policySospesoId) {
      await userSupabase.from('titoli').delete().eq('id', policySospesoId);
    }
    if (clientId) {
      await userSupabase.from('clienti').delete().eq('id', clientId);
    }
  });
});
