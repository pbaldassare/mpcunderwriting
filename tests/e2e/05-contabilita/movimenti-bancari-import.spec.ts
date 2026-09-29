import { test, expect } from '@playwright/test';
import { STORAGE_STATE, expectPageHealthy } from '../../helpers/auth-helper';
import {
  E2E_MARKER,
  createMovimentiExcelFile,
  removeTempFile,
  deleteMovimentiE2E,
  getClienteWithUfficio,
  insertMovimentoImportato,
  deleteMovimentoById,
  invokeAiMatchMovimenti,
  ensureContoSelectedForImport,
} from '../../helpers/contabilita-helper';
import { supabaseAdmin } from '../../helpers/db-helper';
import { SEL } from '../../helpers/selectors';

test.use({ storageState: STORAGE_STATE });

/**
 * Caricamento Movimenti Bancari — upload Excel, monitor, inserimento manuale.
 * Route: /contabilita/caricamento-mov-bancari
 */
test.describe('Contabilità · Caricamento Mov. Bancari', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/contabilita/caricamento-mov-bancari?tab=importazione');
    await expectPageHealthy(page);
    await expect(page.getByRole('heading', { name: SEL.contabilita.movBancariHeading })).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole('tab', { name: SEL.contabilita.tabImportazione, exact: true }).click();
  });

  test('tab Importazione: drop zone e istruzioni colonne Excel sono visibili', async ({ page }) => {
    await expect(page.getByText(/Upload estratto conto/i)).toBeVisible();
    await expect(page.getByText(/Conto bancario/i).first()).toBeVisible();
    await expect(page.getByText(/Trascina Excel\/CSV o clicca/i)).toBeVisible();
  });

  test('upload Excel con Cliente ID valorizzato mostra report ultimo caricamento', async ({ page }) => {
    test.skip(!supabaseAdmin, 'SUPABASE_SERVICE_ROLE_KEY non configurata');

    const cliente = await getClienteWithUfficio();
    test.skip(!cliente, 'Nessun cliente con ufficio nel DB di test');

    const uniqueImporto = Number(`9${Date.now().toString().slice(-5)}.${Math.floor(Math.random() * 90 + 10)}`);
    const filePath = createMovimentiExcelFile([
      {
        data: new Date().toISOString().slice(0, 10),
        importo: uniqueImporto,
        ordinante: cliente.ragione_sociale || [cliente.nome, cliente.cognome].filter(Boolean).join(' '),
        clienteId: cliente.id,
        descrizione: `${E2E_MARKER}-excel-assegnato`,
      },
    ]);

    try {
      await ensureContoSelectedForImport(page);
      await page.locator('input[type="file"]').setInputFiles(filePath);
      await expect(page.getByText(/Ultimo caricamento/i)).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText(/movimenti inseriti|già presenti|duplicati/i).first()).toBeVisible();
    } finally {
      removeTempFile(filePath);
      await deleteMovimentiE2E();
    }
  });

  test('upload Excel senza Cliente ID crea movimenti Importati (monitor)', async ({ page }) => {
    test.skip(!supabaseAdmin, 'SUPABASE_SERVICE_ROLE_KEY non configurata');

    const uniqueImporto = Number(`8${Date.now().toString().slice(-5)}.50`);
    const filePath = createMovimentiExcelFile([
      {
        data: new Date().toISOString().slice(0, 10),
        importo: uniqueImporto,
        ordinante: 'Ordinante E2E Test SRL',
        descrizione: `${E2E_MARKER}-excel-importato`,
      },
    ]);

    try {
      await ensureContoSelectedForImport(page);
      await page.locator('input[type="file"]').setInputFiles(filePath);
      await expect(page.getByText(/Ultimo caricamento/i)).toBeVisible({ timeout: 30_000 });

      await page.getByRole('tab', { name: SEL.contabilita.tabMonitor }).click();
      await expect(page.getByText('Importati').first()).toBeVisible();
      await expect(page.getByText('Matchati').first()).toBeVisible();
    } finally {
      removeTempFile(filePath);
      await deleteMovimentiE2E();
    }
  });

  test('dialog inserimento manuale: apre e chiude senza salvataggio', async ({ page }) => {
    await page.getByRole('button', { name: SEL.contabilita.inserimentoManuale }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/Conto bancario/i).first()).toBeVisible();
    // Conferma resta disabilitata finché i campi obbligatori non sono valorizzati
    await expect(dialog.getByRole('button', { name: 'Aggiungi' })).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  test('tab Monitor: filtri data e KPI stati movimento', async ({ page }) => {
    await page.getByRole('tab', { name: SEL.contabilita.tabMonitor }).click();
    await expect(page.getByText('Importati').first()).toBeVisible();
    await expect(page.getByText('Assegnati').first()).toBeVisible();
    await expect(page.getByText('Ricongiunti').first()).toBeVisible();
    await expect(page.getByText('Incassati').first()).toBeVisible();

    const dal = page.locator('label:text-is("Dal")').locator('..').locator('input[type="date"]');
    const al = page.locator('label:text-is("Al")').locator('..').locator('input[type="date"]');
    await dal.fill('2024-01-01');
    await al.fill('2026-12-31');
    await expect(page.locator('table')).toBeVisible();
  });
});

test.describe.serial('Contabilità · AI matching movimenti bancari', () => {
  let movimentoId: string | null = null;

  test.beforeAll(async () => {
    test.skip(!supabaseAdmin, 'SUPABASE_SERVICE_ROLE_KEY non configurata');
    const cliente = await getClienteWithUfficio();
    test.skip(!cliente, 'Nessun cliente con ufficio per fuzzy match');
    const label =
      cliente.ragione_sociale || [cliente.nome, cliente.cognome].filter(Boolean).join(' ') || 'Cliente Test';
    movimentoId = await insertMovimentoImportato({
      importo: Number(`7${Date.now().toString().slice(-4)}.01`),
      ordinante: label,
      descrizione: `${E2E_MARKER}-ai-fuzzy`,
    });
  });

  test.afterAll(async () => {
    if (movimentoId) await deleteMovimentoById(movimentoId);
    await deleteMovimentiE2E();
  });

  test('edge function ai-match-movimenti-bancari assegna cliente (fuzzy)', async ({ page }) => {
    test.skip(!movimentoId, 'Movimento di test non creato');
    const result = await invokeAiMatchMovimenti([movimentoId!]);
    expect(result.processed).toBeGreaterThanOrEqual(1);

    await page.goto('/contabilita/caricamento-mov-bancari');
    await expectPageHealthy(page);
    await page.getByRole('tab', { name: SEL.contabilita.tabMonitor }).click();
    await expect(page.getByText('Matchati').first()).toBeVisible();
  });
});
