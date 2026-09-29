import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as XLSX from 'xlsx';
import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { supabaseAdmin } from './db-helper';

const E2E_MARKER = 'E2E-MOV-BANC';

export { E2E_MARKER };

export type MovimentoExcelRow = {
  data: string;
  importo: number;
  ordinante: string;
  clienteId?: string;
  descrizione?: string;
};

/** Genera un file Excel temporaneo nel formato atteso da CaricamentoMovBancariPage. */
export function createMovimentiExcelFile(rows: MovimentoExcelRow[]): string {
  const sheetRows = rows.map((r) => ({
    'Data contabile': r.data,
    Importo: r.importo,
    Ordinante: r.ordinante,
    'Cliente ID': r.clienteId ?? '',
    Descrizione: r.descrizione ?? E2E_MARKER,
  }));
  const ws = XLSX.utils.json_to_sheet(sheetRows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Movimenti');
  const filePath = path.join(os.tmpdir(), `mov-e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.xlsx`);
  XLSX.writeFile(wb, filePath);
  return filePath;
}

export function removeTempFile(filePath: string) {
  try {
    fs.unlinkSync(filePath);
  } catch {
    /* ignore */
  }
}

/** Attende che Portafoglio Carico (consultazione) abbia finito il caricamento iniziale. */
export async function waitForPortafoglioCarico(page: Page) {
  await expect(page.getByRole('heading', { name: 'Carico del mese' })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('Totale titoli')).toBeVisible({ timeout: 20_000 });
  const loading = page.getByText('Caricamento...');
  if (await loading.count()) {
    await expect(loading).toHaveCount(0, { timeout: 30_000 });
  }
}

/** Attende che la pagina Incassi abbia finito il caricamento iniziale. */
export async function waitForIncassi(page: Page) {
  await expect(page.getByRole('heading', { name: 'Incassi' })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('Totale titoli')).toBeVisible({ timeout: 20_000 });
  const loading = page.getByText('Caricamento...');
  if (await loading.count()) {
    await expect(loading).toHaveCount(0, { timeout: 30_000 });
  }
}

/** Restituisce i due input date (Dal / Al) nella barra filtri del Carico. */
export function caricoDateInputs(page: Page) {
  const dal = page.locator('span:text-is("Dal")').locator('..').locator('input[type="date"]');
  const al = page.locator('span:text-is("Al")').locator('..').locator('input[type="date"]');
  return { dal, al };
}

/** Seleziona un toggle periodo nel Carico (Mese Corrente / Tutte). */
export async function selectCaricoPeriodo(
  page: Page,
  periodo: 'Mese Corrente' | 'Tutte',
) {
  await page.getByRole('radio', { name: periodo }).click();
}

export async function getClienteWithUfficio() {
  if (!supabaseAdmin) return null;
  const { data } = await supabaseAdmin
    .from('clienti')
    .select('id, ragione_sociale, nome, cognome, ufficio_id')
    .not('ufficio_id', 'is', null)
    .limit(1)
    .maybeSingle();
  return data as {
    id: string;
    ragione_sociale: string | null;
    nome: string | null;
    cognome: string | null;
    ufficio_id: string;
  } | null;
}

export async function insertMovimentoImportato(opts: {
  importo: number;
  ordinante: string;
  descrizione?: string;
  dataMovimento?: string;
}) {
  if (!supabaseAdmin) throw new Error('SUPABASE_SERVICE_ROLE_KEY non configurata');
  const data_movimento = opts.dataMovimento ?? new Date().toISOString().slice(0, 10);
  const { data, error } = await supabaseAdmin
    .from('movimenti_bancari')
    .insert({
      data_movimento,
      importo: opts.importo,
      ordinante: opts.ordinante,
      descrizione: opts.descrizione ?? E2E_MARKER,
      stato: 'importato',
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function deleteMovimentiE2E() {
  if (!supabaseAdmin) return;
  await supabaseAdmin.from('movimenti_bancari').delete().ilike('descrizione', `%${E2E_MARKER}%`);
}

export async function deleteMovimentoById(id: string) {
  if (!supabaseAdmin) return;
  await supabaseAdmin.from('movimenti_bancari').delete().eq('id', id);
}

export async function invokeAiMatchMovimenti(movimentoIds?: string[]) {
  if (!supabaseAdmin) throw new Error('SUPABASE_SERVICE_ROLE_KEY non configurata');
  const { data, error } = await supabaseAdmin.functions.invoke('ai-match-movimenti-bancari', {
    body: movimentoIds?.length ? { movimento_ids: movimentoIds, use_ai: false } : { use_ai: false },
  });
  if (error) throw error;
  return data as { processed?: number; matched?: number; ai_used?: number };
}

/** Attende auto-selezione conto bancario sulla pagina import (ContoBancarioSelect autoSelectDefault). */
export async function ensureContoSelectedForImport(page: Page) {
  await expect(page.getByText(/Conto bancario/i).first()).toBeVisible();
  const fileInput = page.locator('input[type="file"]');
  await expect(fileInput).toBeEnabled({ timeout: 15_000 });
}
