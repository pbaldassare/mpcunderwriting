import { describe, expect, it } from "vitest";
import {
  createEmptyWizardUiState,
  createWizardFormDefaults,
  hydrateWizardFromSinistroBozza,
  parseBozzaWizardJson,
  serializeBozzaWizardJson,
  shouldStartCleanWizard,
} from "@/lib/sinistroAperturaDraft";
import { todayDateISO } from "@/lib/sinistroPraticaSchema";

describe("sinistroAperturaDraft", () => {
  it("shouldStartCleanWizard — pulito solo senza bozza_id e senza cliente preselezionato", () => {
    expect(shouldStartCleanWizard({ bozzaId: null, clienteId: null })).toBe(true);
    expect(shouldStartCleanWizard({ bozzaId: "abc", clienteId: null })).toBe(false);
    expect(shouldStartCleanWizard({ bozzaId: null, clienteId: "cli-1" })).toBe(false);
  });

  it("createEmptyWizardUiState — stato iniziale deterministico", () => {
    const a = createEmptyWizardUiState();
    const b = createEmptyWizardUiState();
    expect(a).toEqual(b);
    expect(a.currentStep).toBe(1);
    expect(a.selectedClienteId).toBeNull();
    expect(a.prescrizioniDrafts).toEqual([]);
  });

  it("createWizardFormDefaults — form vuoto con data denuncia odierna", () => {
    const d = createWizardFormDefaults();
    expect(d.titolo_id).toBe("");
    expect(d.sinistro_terzi).toBe(false);
    expect(d.numero_polizza).toBe("");
    expect(d.documenti).toEqual([]);
    expect(d.data_evento).toBe("");
    expect(d.data_denuncia).toBe(todayDateISO());
  });

  it("parseBozzaWizardJson — valida step e metadati", () => {
    expect(parseBozzaWizardJson(null)).toBeNull();
    expect(parseBozzaWizardJson({ currentStep: 99 })).toBeNull();
    const parsed = parseBozzaWizardJson({
      v: 1,
      currentStep: 3,
      sinistro_terzi: true,
      prescrizioniDrafts: [{ destinatario_tipo: "compagnia", oggetto: "Test", data_scadenza_risposta: "2026-01-01" }],
    });
    expect(parsed?.currentStep).toBe(3);
    expect(parsed?.sinistro_terzi).toBe(true);
    expect(parsed?.prescrizioniDrafts).toHaveLength(1);
    expect(parsed?.anniPrescrizione).toBe(2);
  });

  it("serializeBozzaWizardJson — roundtrip", () => {
    const json = serializeBozzaWizardJson({
      currentStep: 2,
      sinistro_terzi: false,
      soloMadri: true,
      prescrizioniDrafts: [],
      reminderDrafts: [{ testo: "Richiamare cliente", data_scadenza: "2026-02-01" }],
    });
    expect(parseBozzaWizardJson(json)).toEqual(json);
  });

  it("hydrateWizardFromSinistroBozza — ripristina form e step da DB", () => {
    const { formValues, ui } = hydrateWizardFromSinistroBozza(
      {
        cliente_anagrafica_id: "c1",
        titolo_id: "t1",
        sinistro_terzi: false,
        numero_polizza: "1602/1",
        ramo_sinistro: "RCA",
        data_evento: "2026-01-15",
        data_denuncia: "2026-01-20",
        descrizione: "Descrizione di test sufficientemente lunga",
        bozza_wizard_json: serializeBozzaWizardJson({
          currentStep: 4,
          sinistro_terzi: false,
          soloMadri: false,
          prescrizioniDrafts: [],
          reminderDrafts: [],
        }),
      },
      [
        {
          id: "d1",
          nome_file: "foto.pdf",
          path_storage: "sinistro/x/foto.pdf",
          categoria: "denuncia",
          descrizione: null,
        },
      ],
    );

    expect(ui.currentStep).toBe(4);
    expect(ui.selectedClienteId).toBe("c1");
    expect(ui.soloMadri).toBe(false);
    expect(ui.anniPrescrizione).toBe(2);
    expect(formValues.titolo_id).toBe("t1");
    expect(formValues.numero_polizza).toBe("1602/1");
    expect(formValues.ramo_sinistro).toBe("RCA");
    expect(formValues.documenti).toHaveLength(1);
    expect(formValues.documenti[0].saved).toBe(true);
    expect(formValues.data_denuncia).toBe("2026-01-20");
  });

  it("hydrateWizardFromSinistroBozza — data denuncia odierna se bozza senza valore", () => {
    const { formValues } = hydrateWizardFromSinistroBozza(
      {
        cliente_anagrafica_id: "c1",
        titolo_id: "t1",
        sinistro_terzi: false,
        data_evento: "2026-01-15",
        data_denuncia: null,
        descrizione: "",
        bozza_wizard_json: serializeBozzaWizardJson({
          currentStep: 2,
          sinistro_terzi: false,
          soloMadri: true,
          prescrizioniDrafts: [],
          reminderDrafts: [],
        }),
      },
      [],
    );

    expect(formValues.data_denuncia).toBe(todayDateISO());
  });
});
