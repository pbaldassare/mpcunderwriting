import { test, expect } from '@playwright/test';
import { STORAGE_STATE, expectPageHealthy } from '../helpers/auth-helper';

test.use({ storageState: STORAGE_STATE });

/**
 * Test smoke della pagina "Gestione Polizze" — hub action-first.
 *
 * Verifica per ciascuna delle 12 operazioni che:
 *  - la card è visibile per l'utente admin di test
 *  - cliccandola compaiono i filtri (sezione "2. Filtra polizza") e la tabella risultati
 *  - se la lista contiene almeno una polizza compatibile, il bottone "Esegui" risulta
 *    abilitato e produce l'effetto atteso (apertura dialog OR navigazione verso la route
 *    dedicata per Appendice/Rinnovo/Duplica/Precontrattuale/Carica Documenti).
 *
 * Il test NON esegue la mutazione finale (storno/messa-a-cassa/annulla) per non
 * inquinare i dati: si ferma all'apertura del dialog/route e ne valida i campi
 * obbligatori richiesti dal piano (numero polizza, decorrenza, scadenza per Duplica;
 * pulsanti conferma per gli altri).
 */

const OPERAZIONI: Array<{
  key: string;
  label: string;
  /** true → al click su Esegui apre un dialog modale */
  apreDialog: boolean;
  /** se diverso da null, al click su Esegui naviga verso questo prefisso URL */
  navigaA?: string;
  /** testo atteso nell'header del dialog (case-insensitive) */
  dialogHeading?: RegExp;
}> = [
  { key: 'appendice', label: 'Appendice', apreDialog: false, navigaA: '/portafoglio/appendici' },
  { key: 'storno', label: 'Storno', apreDialog: true, dialogHeading: /storno/i },
  { key: 'rinnovo', label: 'Rinnovo', apreDialog: false, navigaA: '/portafoglio/rinnovi' },
  { key: 'duplica', label: 'Duplica Polizza', apreDialog: true, dialogHeading: /duplica/i },
  { key: 'sostituzione', label: 'Sostituzione', apreDialog: true, dialogHeading: /sostituzione/i },
  { key: 'sospensione', label: 'Sospensione', apreDialog: true, dialogHeading: /sospensione/i },
  { key: 'riattivazione', label: 'Riattivazione', apreDialog: true, dialogHeading: /riattivazione/i },
  { key: 'annulla', label: 'Annulla Polizza', apreDialog: true, dialogHeading: /annullare la polizza/i },
  { key: 'messa_cassa', label: 'Messa a Cassa', apreDialog: true, dialogHeading: /messa a cassa/i },
  { key: 'annulla_messa_cassa', label: 'Annulla Messa a Cassa', apreDialog: true, dialogHeading: /annullare la messa a cassa/i },
  { key: 'carica_doc', label: 'Carica Documenti', apreDialog: false, navigaA: '/titoli/' },
  { key: 'precontrattuale', label: 'Genera Precontrattuale', apreDialog: false, navigaA: '/portafoglio/doc-precontrattuale' },
];

test.describe('Gestione Polizze — hub azioni', () => {
  test('la pagina si apre con tutte le 12 card operazione (admin)', async ({ page }) => {
    await page.goto('/portafoglio/gestione');
    await expectPageHealthy(page);
    await expect(page.getByRole('heading', { name: /Gestione Polizze/i })).toBeVisible();

    for (const op of OPERAZIONI) {
      await expect(
        page.locator(`button[data-op="${op.key}"]`),
        `card operazione "${op.label}" deve essere visibile`,
      ).toBeVisible();
    }
  });

  test('filtri e ordinamento sono presenti dopo selezione operazione', async ({ page }) => {
    await page.goto('/portafoglio/gestione');
    await expectPageHealthy(page);
    await page.locator('button[data-op="appendice"]').click();

    // filtri avanzati
    await expect(page.getByText('2. Filtra polizza')).toBeVisible();
    await expect(page.getByLabel('Cliente')).toBeVisible();
    await expect(page.getByLabel('Compagnia')).toBeVisible();
    await expect(page.getByLabel('N° polizza / ricerca libera')).toBeVisible();
    await expect(page.getByLabel('Stato')).toBeVisible();

    // header tabella + ordinamento cliccabile
    await expect(page.getByRole('button', { name: /N° Polizza/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Scad\./i })).toBeVisible();
  });

  test('sezione Attività recenti è presente', async ({ page }) => {
    await page.goto('/portafoglio/gestione');
    await page.locator('button[data-op="storno"]').click();
    await expect(page.getByText('4. Attività recenti')).toBeVisible();
  });

  for (const op of OPERAZIONI) {
    test(`operazione "${op.label}" — Esegui apre ${op.apreDialog ? 'dialog' : `route ${op.navigaA}`}`, async ({
      page,
    }) => {
      await page.goto('/portafoglio/gestione');
      await expectPageHealthy(page);

      // seleziona operazione
      await page.locator(`button[data-op="${op.key}"]`).click();

      // attendi caricamento tabella risultati
      await expect(page.getByText(/3\. Risultati/)).toBeVisible();

      // se la tabella è vuota per i filtri default dell'operazione, lo registra e termina:
      // significa che il dataset di test non contiene polizze nello stato richiesto
      const emptyMsg = page.getByText('Nessuna polizza corrisponde ai filtri impostati.');
      if (await emptyMsg.isVisible().catch(() => false)) {
        test.info().annotations.push({
          type: 'skip-reason',
          description: `nessuna polizza compatibile per "${op.label}" nel dataset corrente`,
        });
        return;
      }

      // attendi prima riga
      const firstExecBtn = page.getByRole('button', { name: /^Esegui$/ }).first();
      await firstExecBtn.waitFor({ state: 'visible', timeout: 10_000 });

      if (op.apreDialog) {
        await firstExecBtn.click();
        const dialog = page.getByRole('alertdialog').or(page.getByRole('dialog')).first();
        await expect(dialog).toBeVisible({ timeout: 10_000 });
        if (op.dialogHeading) {
          await expect(dialog.getByText(op.dialogHeading).first()).toBeVisible();
        }

        // Per "Duplica Polizza" verifica i campi obbligatori richiesti dal piano:
        // N° Polizza, Decorrenza, Scadenza devono essere presenti come input.
        if (op.key === 'duplica') {
          await expect(dialog.getByLabel(/N°\s*Polizza/i).first()).toBeVisible();
          await expect(dialog.getByLabel(/Decorrenza/i).first()).toBeVisible();
          await expect(dialog.getByLabel(/Scadenza/i).first()).toBeVisible();
        }

        // chiude senza confermare per non mutare dati
        await page.keyboard.press('Escape');
      } else {
        await firstExecBtn.click();
        await page.waitForURL((url) => url.pathname.startsWith(op.navigaA!), { timeout: 10_000 });
        await expectPageHealthy(page);
      }
    });
  }
});
