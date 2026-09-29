import { test, expect } from '@playwright/test';
import { STORAGE_STATE } from '../../helpers/auth-helper';
import { supabaseAdmin } from '../../helpers/db-helper';
import {
  cleanupPolizzaChain,
  fetchImmissioneFixtures,
  fillImmissionePolizzaForm,
  getFirstQuietanzaId,
  performMessaACassa,
  submitImmissionePolizza,
  type ImmissioneFixtures,
} from '../portafoglio/portafoglio-helpers';

test.use({ storageState: STORAGE_STATE });

/**
 * Integrazione: immissione polizza → messa a cassa quietanza.
 * Sostituisce tests/titoli.spec.ts con pattern portafoglio-helpers e cleanup.
 */
test.describe.serial('Integrazione · Messa a cassa e quietanza', () => {
  const POLIZZA_NUM = `E2E-MCA-QZ-${Date.now()}`;
  const DURATA_DA = '2026-03-01';
  const DURATA_A = '2027-03-01';
  let fixtures: ImmissioneFixtures | null = null;
  let quietanzaId: string | null = null;

  test.beforeAll(async () => {
    test.skip(!supabaseAdmin, 'SUPABASE_SERVICE_ROLE_KEY non configurata');
    fixtures = await fetchImmissioneFixtures();
    test.skip(!fixtures, 'Dataset insufficiente (cliente/compagnia/ramo)');
  });

  test.afterAll(async () => {
    await cleanupPolizzaChain(POLIZZA_NUM);
  });

  test('1. crea polizza annuale con quietanza', async ({ page }) => {
    expect(fixtures).not.toBeNull();

    await fillImmissionePolizzaForm(page, {
      numeroPolizza: POLIZZA_NUM,
      fixtures: fixtures!,
      frazionamento: 'Annuale',
      anniDurata: '1',
      durataDa: DURATA_DA,
      durataA: DURATA_A,
      garanziaDa: DURATA_DA,
      garanziaA: DURATA_A,
      premioNetto: '300',
    });

    await submitImmissionePolizza(page);
    quietanzaId = await getFirstQuietanzaId(POLIZZA_NUM).catch(() => null);

    const { data: madre } = await supabaseAdmin!
      .from('titoli')
      .select('id, stato, numero_titolo')
      .eq('numero_titolo', POLIZZA_NUM)
      .is('sostituisce_polizza', null)
      .single();

    expect(madre?.numero_titolo).toBe(POLIZZA_NUM);
    expect(madre?.stato).toBe('attivo');
  });

  test('2. messa a cassa sulla quietanza o polizza madre', async ({ page }) => {
    const targetId = quietanzaId ?? (await supabaseAdmin!
      .from('titoli')
      .select('id')
      .eq('numero_titolo', POLIZZA_NUM)
      .limit(1)
      .single()).data?.id;

    expect(targetId).toBeTruthy();
    await performMessaACassa(page, targetId!);

    const { data: titolo } = await supabaseAdmin!
      .from('titoli')
      .select('stato, data_messa_cassa')
      .eq('id', targetId!)
      .single();

    expect(titolo?.stato).toBe('incassato');
    expect(titolo?.data_messa_cassa).not.toBeNull();
  });
});
