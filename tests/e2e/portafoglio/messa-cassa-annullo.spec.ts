import { test, expect } from '@playwright/test';
import { STORAGE_STATE, TEST_PASSWORD } from '../../helpers/auth-helper';
import { supabaseAdmin } from '../../helpers/db-helper';
import {
  assertQuietanzeChain,
  cleanupPolizzaChain,
  fetchImmissioneFixtures,
  fillImmissionePolizzaForm,
  getFirstQuietanzaId,
  performAnnullaIncasso,
  performMessaACassa,
  submitImmissionePolizza,
  type ImmissioneFixtures,
} from './portafoglio-helpers';

test.use({ storageState: STORAGE_STATE });

/**
 * Scenario 3: messa a cassa su quietanza + annullamento incasso (admin).
 */
test.describe.serial('Messa a cassa e annullo incasso', () => {
  const POLIZZA_NUM = `MCA-E2E-${Date.now()}`;
  const DURATA_DA = '2026-02-01';
  const DURATA_A = '2027-02-01';
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

  test('1. crea polizza trimestrale con quietanze', async ({ page }) => {
    expect(fixtures).not.toBeNull();

    await fillImmissionePolizzaForm(page, {
      numeroPolizza: POLIZZA_NUM,
      fixtures: fixtures!,
      frazionamento: 'Trimestrale',
      anniDurata: '1',
      durataDa: DURATA_DA,
      durataA: DURATA_A,
      garanziaDa: DURATA_DA,
      garanziaA: DURATA_A,
      premioNetto: '400',
    });

    await submitImmissionePolizza(page);

    await assertQuietanzeChain(POLIZZA_NUM, {
      frazionamento: 'Trimestrale',
      anniDurata: 1,
      garanziaDa: DURATA_DA,
      garanziaA: DURATA_A,
    });

    quietanzaId = await getFirstQuietanzaId(POLIZZA_NUM);
    expect(quietanzaId).toBeTruthy();
  });

  test('2. messa a cassa sulla prima quietanza', async ({ page }) => {
    expect(quietanzaId).not.toBeNull();
    await performMessaACassa(page, quietanzaId!);

    const { data: titolo } = await supabaseAdmin!
      .from('titoli')
      .select('stato, data_messa_cassa, data_incasso')
      .eq('id', quietanzaId!)
      .single();

    expect(titolo?.stato).toBe('incassato');
    expect(titolo?.data_messa_cassa).not.toBeNull();
    expect(titolo?.data_incasso).not.toBeNull();
  });

  test('3. annulla incasso e ripristina stato attivo', async ({ page }) => {
    expect(quietanzaId).not.toBeNull();
    await page.goto(`/titoli/${quietanzaId}`);
    await performAnnullaIncasso(page, TEST_PASSWORD);

    const { data: titolo } = await supabaseAdmin!
      .from('titoli')
      .select('stato, data_messa_cassa, data_incasso')
      .eq('id', quietanzaId!)
      .single();

    expect(titolo?.stato).toBe('attivo');
    expect(titolo?.data_messa_cassa).toBeNull();
    expect(titolo?.data_incasso).toBeNull();
  });
});
