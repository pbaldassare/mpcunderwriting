import { test, expect } from '@playwright/test';
import { STORAGE_STATE } from '../../helpers/auth-helper';
import { supabaseAdmin } from '../../helpers/db-helper';
import {
  assertQuietanzeChain,
  cleanupPolizzaChain,
  expectQuietanzePanelCount,
  fetchImmissioneFixtures,
  fillImmissionePolizzaForm,
  submitImmissionePolizza,
  type ImmissioneFixtures,
} from './portafoglio-helpers';

test.use({ storageState: STORAGE_STATE });

/**
 * Scenario 1: immissione polizza semestrale → generazione quietanze coerenti col piano rate.
 */
test.describe.serial('Immissione polizza — generazione quietanze', () => {
  const POLIZZA_NUM = `IMM-E2E-${Date.now()}`;
  const DURATA_DA = '2026-01-01';
  const DURATA_A = '2027-01-01';
  let fixtures: ImmissioneFixtures | null = null;
  let madreId: string | null = null;

  test.beforeAll(async () => {
    test.skip(!supabaseAdmin, 'SUPABASE_SERVICE_ROLE_KEY non configurata');
    fixtures = await fetchImmissioneFixtures();
    test.skip(!fixtures, 'Dataset insufficiente (cliente/compagnia/ramo)');
  });

  test.afterAll(async () => {
    await cleanupPolizzaChain(POLIZZA_NUM);
  });

  test('crea polizza semestrale e genera la catena quietanze attesa', async ({ page }) => {
    expect(fixtures).not.toBeNull();

    await fillImmissionePolizzaForm(page, {
      numeroPolizza: POLIZZA_NUM,
      fixtures: fixtures!,
      frazionamento: 'Semestrale',
      anniDurata: '1',
      durataDa: DURATA_DA,
      durataA: DURATA_A,
      garanziaDa: DURATA_DA,
      garanziaA: DURATA_A,
      premioNetto: '600',
    });

    madreId = await submitImmissionePolizza(page);
    expect(madreId).toBeTruthy();

    const { madreId: dbMadreId, quietanzaIds } = await assertQuietanzeChain(POLIZZA_NUM, {
      frazionamento: 'Semestrale',
      anniDurata: 1,
      garanziaDa: DURATA_DA,
      garanziaA: DURATA_A,
      dataCompetenza: DURATA_DA,
    });

    expect(dbMadreId).toBe(madreId);
    expect(quietanzaIds.length).toBe(1);

    // UI: pannello quietanze mostra polizza + rate
    await expectQuietanzePanelCount(page, 2);

    const secondaRataGarDa = '2026-07-01';
    const { data: q2 } = await supabaseAdmin!
      .from('titoli')
      .select('garanzia_da, garanzia_a, sostituisce_polizza, sostituisce_riga')
      .eq('id', quietanzaIds[0])
      .single();

    expect(q2?.sostituisce_polizza).toBe(POLIZZA_NUM);
    expect(q2?.garanzia_da).toBe(secondaRataGarDa);
    expect(q2?.garanzia_a).toBe(DURATA_A);
  });
});
