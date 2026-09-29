import { test, expect } from '@playwright/test';
import { STORAGE_STATE, expectPageHealthy } from '../helpers/auth-helper';
import { supabaseAdmin, createTestTitolo, cleanupTestTitolo } from '../helpers/db-helper';

test.use({ storageState: STORAGE_STATE });

/**
 * Verifica che:
 *  1. il filtro "Cliente" filtri davvero la tabella (regressione: prima usava
 *     cliente_anagrafica_id contro un ID di public.clienti, restituendo 0 righe);
 *  2. dopo la selezione cliente+polizza, "Esegui" porti ai deep link corretti
 *     per le operazioni che navigano (Appendice, Precontrattuale, Carica Doc.,
 *     Regolazioni Attese, CIG Temporanei).
 */

const POLIZZA_NUM = `OPE-E2E-${Date.now()}`;
let titoloId: string | null = null;
let clienteId: string | null = null;
let clienteAnagraficaId: string | null = null;

test.describe.serial('Gestione Polizze — filtro cliente + operazioni', () => {
  test.beforeAll(async () => {
    test.skip(!supabaseAdmin, 'SUPABASE_SERVICE_ROLE_KEY non configurata');

    const { data: cli } = await supabaseAdmin!
      .from('clienti').select('id').eq('attivo', true).limit(1).single();
    const { data: prod } = await supabaseAdmin!
      .from('anagrafiche_professionali').select('id').limit(1).single();
    if (!cli || !prod) {
      test.skip(true, 'Dataset insufficiente');
      return;
    }
    clienteId = cli.id;
    const created = await createTestTitolo(POLIZZA_NUM, cli.id, prod.id);
    titoloId = created.titoloId;
    clienteAnagraficaId = created.clienteAnagraficaId;
  });

  test.afterAll(async () => {
    if (!supabaseAdmin) return;
    await cleanupTestTitolo(POLIZZA_NUM, clienteAnagraficaId ?? undefined);
  });

  test('filtro Cliente filtra realmente la tabella e persiste in URL', async ({ page }) => {
    // deep link con cliente=<uuid> deve mostrare il titolo di test
    await page.goto(`/portafoglio/gestione?op=appendice&cliente=${clienteId}&q=${encodeURIComponent(POLIZZA_NUM)}`);
    await expectPageHealthy(page);

    await expect(page.getByRole('row').filter({ hasText: POLIZZA_NUM })).toBeVisible({ timeout: 10_000 });
    expect(new URL(page.url()).searchParams.get('cliente')).toBe(clienteId);

    // reload: la selezione cliente sopravvive
    await page.reload();
    await expectPageHealthy(page);
    expect(new URL(page.url()).searchParams.get('cliente')).toBe(clienteId);
    await expect(page.getByRole('row').filter({ hasText: POLIZZA_NUM })).toBeVisible({ timeout: 10_000 });
  });

  test('Esegui Appendice naviga a /portafoglio/appendici?titoloId=…', async ({ page }) => {
    await page.goto(`/portafoglio/gestione?op=appendice&cliente=${clienteId}&q=${encodeURIComponent(POLIZZA_NUM)}`);
    await expectPageHealthy(page);
    const row = page.getByRole('row').filter({ hasText: POLIZZA_NUM });
    await expect(row).toBeVisible({ timeout: 10_000 });
    await row.getByRole('button', { name: /^Esegui$/ }).click();
    await page.waitForURL((u) => u.pathname === '/portafoglio/appendici', { timeout: 10_000 });
    expect(new URL(page.url()).searchParams.get('titoloId')).toBe(titoloId);
  });

  test('Esegui Precontrattuale naviga a /portafoglio/doc-precontrattuale?titoloId=…', async ({ page }) => {
    await page.goto(`/portafoglio/gestione?op=precontrattuale&cliente=${clienteId}&q=${encodeURIComponent(POLIZZA_NUM)}`);
    await expectPageHealthy(page);
    const row = page.getByRole('row').filter({ hasText: POLIZZA_NUM });
    await expect(row).toBeVisible({ timeout: 10_000 });
    await row.getByRole('button', { name: /^Esegui$/ }).click();
    await page.waitForURL((u) => u.pathname === '/portafoglio/doc-precontrattuale', { timeout: 10_000 });
    expect(new URL(page.url()).searchParams.get('titoloId')).toBe(titoloId);
  });

  test('Esegui Carica Doc. naviga a /titoli/:id?tab=documenti', async ({ page }) => {
    await page.goto(`/portafoglio/gestione?op=carica_doc&cliente=${clienteId}&q=${encodeURIComponent(POLIZZA_NUM)}`);
    await expectPageHealthy(page);
    const row = page.getByRole('row').filter({ hasText: POLIZZA_NUM });
    await expect(row).toBeVisible({ timeout: 10_000 });
    await row.getByRole('button', { name: /^Esegui$/ }).click();
    await page.waitForURL((u) => u.pathname === `/titoli/${titoloId}`, { timeout: 10_000 });
    expect(new URL(page.url()).searchParams.get('tab')).toBe('documenti');
  });
});
