import { expect, type Page } from '@playwright/test';
import { supabaseAdmin } from '../../helpers/db-helper';
import { computeQuietanzePlan, computeQuietanzeOnly, type QuietanzaPlanInput } from '../../../src/lib/quietanzePlan';
import { groupTitoliByPolizza } from '../../../src/lib/quietanze';
import { expectPageHealthy } from '../../helpers/auth-helper';

export type ImmissioneFixtures = {
  clienteId: string;
  clienteLabel: string;
  gruppoCompagniaId: string;
  gruppoCompagniaLabel: string;
  compagniaId: string;
  compagniaLabel: string;
  gruppoRamoId: string;
  gruppoRamoLabel: string;
  ramoId: string;
  sottoramoLabel: string;
  ufficioId: string | null;
};

export type ImmissioneFormOptions = {
  numeroPolizza: string;
  fixtures: ImmissioneFixtures;
  frazionamento?: string;
  anniDurata?: string;
  polizzaTemporanea?: boolean;
  durataDa?: string;
  durataA?: string;
  garanziaDa?: string;
  garanziaA?: string;
  premioNetto?: string;
};

const DEFAULT_DURATA_DA = '2026-01-01';
const DEFAULT_DURATA_A = '2027-01-01';

/** Recupera cliente, compagnia, agenzia e sottoramo utilizzabili in immissione. */
export async function fetchImmissioneFixtures(): Promise<ImmissioneFixtures | null> {
  if (!supabaseAdmin) return null;

  const { data: cliente } = await supabaseAdmin
    .from('clienti')
    .select('id, nome, cognome, ragione_sociale, gruppo_finanziario_id, ufficio_id, tipo_soggetto')
    .not('gruppo_finanziario_id', 'is', null)
    .eq('attivo', true)
    .neq('tipo_soggetto', 'ente')
    .limit(1)
    .maybeSingle();

  if (!cliente) return null;

  const { data: agenzia } = await supabaseAdmin
    .from('compagnie')
    .select('id, nome, codice, gruppo_compagnia_id, tipo')
    .eq('attiva', true)
    .in('tipo', ['agenzia', 'direzione'])
    .not('gruppo_compagnia_id', 'is', null)
    .limit(1)
    .maybeSingle();

  if (!agenzia?.gruppo_compagnia_id) return null;

  const { data: gruppoComp } = await supabaseAdmin
    .from('gruppi_compagnia')
    .select('id, nome, descrizione')
    .eq('id', agenzia.gruppo_compagnia_id)
    .maybeSingle();

  const { data: sottoramo } = await supabaseAdmin
    .from('rami')
    .select('id, codice, descrizione, gruppo_ramo_id, gruppi_ramo(id, codice, descrizione)')
    .limit(1)
    .maybeSingle();

  if (!sottoramo?.gruppo_ramo_id) return null;

  const gf = sottoramo.gruppi_ramo as { codice?: string; descrizione?: string } | null;
  const compLabel = gruppoComp?.nome || gruppoComp?.descrizione || '';
  const ramoLabel = gf?.descrizione || gf?.codice || '';
  const garLabel = sottoramo.descrizione || sottoramo.codice || '';

  return {
    clienteId: cliente.id,
    clienteLabel: (cliente.ragione_sociale || `${cliente.cognome || ''} ${cliente.nome || ''}`).trim(),
    gruppoCompagniaId: agenzia.gruppo_compagnia_id,
    gruppoCompagniaLabel: compLabel,
    compagniaId: agenzia.id,
    compagniaLabel: `${agenzia.codice || ''} - ${agenzia.nome || ''}`.trim(),
    gruppoRamoId: sottoramo.gruppo_ramo_id,
    gruppoRamoLabel: ramoLabel,
    ramoId: sottoramo.id,
    sottoramoLabel: garLabel,
    ufficioId: cliente.ufficio_id ?? null,
  };
}

/** Seleziona un valore in un SearchableSelect identificato dall'etichetta del campo. */
export async function pickSearchableByLabel(
  page: Page,
  labelPattern: RegExp | string,
  optionPattern?: RegExp | string,
  searchText?: string,
): Promise<void> {
  const field = page.locator('div').filter({
    has: page.locator('label').filter({ hasText: labelPattern }),
  }).first();
  await field.scrollIntoViewIfNeeded();
  await field.getByRole('combobox').click();

  if (searchText) {
    const searchInput = page.getByPlaceholder(/Cerca/i).last();
    await searchInput.fill(searchText);
    await page.waitForTimeout(400);
  }

  if (optionPattern) {
    const opt =
      typeof optionPattern === 'string'
        ? page.getByRole('option', { name: optionPattern })
        : page.getByRole('option').filter({ hasText: optionPattern });
    await opt.first().click();
  } else {
    await page.getByRole('option').first().click();
  }
}

/** Compila il form di immissione polizza (campi obbligatori). */
export async function fillImmissionePolizzaForm(page: Page, opts: ImmissioneFormOptions): Promise<void> {
  const {
    numeroPolizza,
    fixtures,
    frazionamento = 'Semestrale',
    anniDurata = '1',
    polizzaTemporanea = false,
    durataDa = DEFAULT_DURATA_DA,
    durataA = DEFAULT_DURATA_A,
    garanziaDa = DEFAULT_DURATA_DA,
    garanziaA = DEFAULT_DURATA_A,
    premioNetto = '500',
  } = opts;

  await page.goto(`/portafoglio/immissione?clienteId=${fixtures.clienteId}`);
  await expectPageHealthy(page);
  await expect(page.getByRole('heading', { name: /Immissione Polizza/i })).toBeVisible({ timeout: 15_000 });

  // Cliente (preselezionato via querystring o scelto manualmente)
  if (!(await page.getByText(/^✓ /).isVisible().catch(() => false))) {
    await pickSearchableByLabel(page, /Cliente esistente/i, fixtures.clienteLabel.slice(0, 20), fixtures.clienteLabel.slice(0, 8));
  }
  await expect(page.getByText(/^✓ /)).toBeVisible({ timeout: 10_000 });

  await pickSearchableByLabel(page, /Compagnia Assicurativa/i, fixtures.gruppoCompagniaLabel);
  await pickSearchableByLabel(page, /Agenzia di Riferimento/i, fixtures.compagniaLabel);

  await pickSearchableByLabel(page, /Gruppo Ramo/i, fixtures.gruppoRamoLabel);
  await pickSearchableByLabel(page, /^Garanzia$/i, fixtures.sottoramoLabel);

  await page.getByLabel(/^N° Polizza/i).fill(numeroPolizza);

  if (polizzaTemporanea) {
    const periodoSection = page.locator('div').filter({ has: page.getByText('Periodo', { exact: true }) }).first();
    await periodoSection.scrollIntoViewIfNeeded();
    const temporaneaSwitch = periodoSection.locator('button[role="switch"]').first();
    const checked = await temporaneaSwitch.getAttribute('data-state');
    if (checked !== 'checked') {
      await temporaneaSwitch.click();
    }
    await page.locator('label').filter({ hasText: /^Durata Da$/ }).locator('..').locator('input[type="date"]').fill(durataDa);
    await page.locator('label').filter({ hasText: /^Durata A$/ }).locator('..').locator('input[type="date"]').fill(durataA);
    await page.locator('label').filter({ hasText: /^Garanzia Da$/ }).locator('..').locator('input[type="date"]').fill(garanziaDa);
    await page.locator('label').filter({ hasText: /^Garanzia A$/ }).locator('..').locator('input[type="date"]').fill(garanziaA);
  } else {
    await page.locator('label').filter({ hasText: /^Durata Da$/ }).locator('..').locator('input[type="date"]').fill(durataDa);
    await page.locator('label').filter({ hasText: /^Durata A$/ }).locator('..').locator('input[type="date"]').fill(durataA);
    await page.locator('label').filter({ hasText: /^Garanzia Da$/ }).locator('..').locator('input[type="date"]').fill(garanziaDa);
    await page.locator('label').filter({ hasText: /^Garanzia A$/ }).locator('..').locator('input[type="date"]').fill(garanziaA);
    await pickSearchableByLabel(page, /^Frazionamento$/i, frazionamento);
    await page.locator('label').filter({ hasText: /^Anni Durata$/ }).locator('..').locator('input[type="number"]').fill(anniDurata);
  }

  const firmaCard = page.locator('div').filter({ hasText: 'Premi per Garanzia — Firma' }).first();
  await firmaCard.scrollIntoViewIfNeeded();
  const nettoInput = firmaCard.locator('tbody tr').first().locator('input').first();
  await nettoInput.fill(premioNetto);
  await nettoInput.blur();
}

/** Clicca Conferma e attende redirect al dettaglio titolo. */
export async function submitImmissionePolizza(page: Page): Promise<string> {
  const conferma = page.getByRole('button', { name: /^Conferma$/ });
  await expect(conferma).toBeEnabled({ timeout: 10_000 });
  await conferma.click();
  await page.waitForURL(/\/titoli\/[0-9a-f-]+/, { timeout: 30_000 });
  await expectPageHealthy(page);
  const match = page.url().match(/\/titoli\/([0-9a-f-]+)/);
  if (!match) throw new Error('Redirect al dettaglio titolo non avvenuto');
  return match[1];
}

export async function fetchTitoliChain(numeroPolizza: string) {
  if (!supabaseAdmin) throw new Error('supabaseAdmin non configurato');
  const { data, error } = await supabaseAdmin
    .from('titoli')
    .select('id, numero_titolo, riga, sostituisce_polizza, sostituisce_riga, garanzia_da, garanzia_a, stato, polizza_temporanea, frazionamento, data_messa_cassa, premio_lordo, created_at')
    .eq('numero_titolo', numeroPolizza)
    .order('riga', { ascending: true, nullsFirst: true });
  if (error) throw error;
  return data || [];
}

/** Verifica conteggio quietanze atteso in base a quietanzePlan + modello polizza/quietanza. */
export async function assertQuietanzeChain(
  numeroPolizza: string,
  planInput: QuietanzaPlanInput,
): Promise<{ madreId: string; quietanzaIds: string[] }> {
  const titoli = await fetchTitoliChain(numeroPolizza);
  expect(titoli.length).toBeGreaterThan(0);

  const catene = groupTitoliByPolizza(titoli);
  expect(catene).toHaveLength(1);
  const catena = catene[0];
  expect(catena.madre).not.toBeNull();

  const plan = computeQuietanzePlan(planInput);
  const onlySuccessive = computeQuietanzeOnly(planInput);

  if (planInput.polizzaTemporanea) {
    expect(catena.rate).toHaveLength(1);
    expect(plan).toHaveLength(1);
  } else {
    expect(catena.all.length).toBe(plan.length);
    expect(catena.rate.length).toBe(onlySuccessive.length);
  }

  return {
    madreId: catena.madre!.id,
    quietanzaIds: catena.rate.map((r) => r.id),
  };
}

/** Prima quietanza incassabile (non madre contratto). */
export async function getFirstQuietanzaId(numeroPolizza: string): Promise<string> {
  const titoli = await fetchTitoliChain(numeroPolizza);
  const catena = groupTitoliByPolizza(titoli)[0];
  const target = catena.rate.find((r) => r.stato === 'attivo' && !r.data_messa_cassa) || catena.rate[0];
  if (!target) throw new Error(`Nessuna quietanza trovata per ${numeroPolizza}`);
  return target.id;
}

/** Esegue messa a cassa dalla scheda titolo/quietanza. */
export async function performMessaACassa(page: Page, titoloId: string): Promise<void> {
  await page.goto(`/titoli/${titoloId}`);
  await expectPageHealthy(page);

  const incassaBtn = page.getByRole('button', { name: /^Incassa$/ }).first();
  await expect(incassaBtn).toBeVisible({ timeout: 15_000 });
  await incassaBtn.click();

  const dialog = page.getByRole('dialog', { name: /Conferma Messa a Cassa/i });
  await expect(dialog).toBeVisible({ timeout: 10_000 });
  await dialog.getByRole('button', { name: /Conferma Incasso/i }).click();

  await expect(page.getByText(/incassat/i).first()).toBeVisible({ timeout: 20_000 }).catch(async () => {
    // toast sonner può sparire: verifica stato in pagina
    await expect(page.getByRole('button', { name: /Annulla Incasso/i })).toBeVisible({ timeout: 10_000 });
  });
}

/** Annulla incasso/messa a cassa (richiede password admin). */
export async function performAnnullaIncasso(page: Page, password: string): Promise<void> {
  const annullaBtn = page.getByRole('button', { name: /Annulla Incasso|Annulla Messa a Cassa/i }).first();
  await expect(annullaBtn).toBeVisible({ timeout: 10_000 });
  await annullaBtn.click();

  const dialog = page.getByRole('dialog', { name: /Conferma Annullamento Incasso/i });
  await expect(dialog).toBeVisible();
  await dialog.locator('input[type="password"]').fill(password);
  await dialog.getByRole('button', { name: /Conferma Annullamento/i }).click();

  await expect(page.getByRole('button', { name: /^Incassa$/ }).first()).toBeVisible({ timeout: 20_000 });
}

/** Elimina tutti i titoli della catena (teardown). */
export async function cleanupPolizzaChain(numeroPolizza: string): Promise<void> {
  if (!supabaseAdmin) return;
  const chain = await fetchTitoliChain(numeroPolizza);
  for (const t of chain) {
    await supabaseAdmin.from('movimenti_polizza').delete().eq('titolo_id', t.id);
    await supabaseAdmin.from('premi_garanzia_polizza').delete().eq('titolo_id', t.id);
  }
  await supabaseAdmin.from('titoli').delete().eq('numero_titolo', numeroPolizza);
}

/** Apre il pannello quietanze nel dettaglio e verifica il conteggio righe. */
export async function expectQuietanzePanelCount(page: Page, expectedCount: number): Promise<void> {
  const trigger = page.getByText(/Quietanze di questa polizza/i);
  if (await trigger.isVisible().catch(() => false)) {
    await trigger.click();
  }
  const rows = page.locator('table tbody tr');
  await expect(rows).toHaveCount(expectedCount, { timeout: 10_000 });
}
