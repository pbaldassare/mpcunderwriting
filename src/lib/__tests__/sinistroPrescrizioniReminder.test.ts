import { describe, expect, it } from "vitest";
import {
  buildPrescrizioneBiennaleAgenzia,
  calcScadenzaPrescrizione,
  calcScadenzaPrescrizioneBiennale,
  normalizePrescrizioneAnni,
  PRESCRIZIONE_DESTINATARIO_AGENZIA,
  REMINDER_LIST_DEFAULT_STATI,
  reminderListSeesAllSedi,
  resolveDataAccadimentoPrescrizione,
  testoPrescrizioneLegale,
} from "@/lib/sinistroPrescrizioniReminder";

describe("sinistroPrescrizioniReminder", () => {
  it("calcola scadenza da data accadimento + anni (default 2)", () => {
    expect(calcScadenzaPrescrizioneBiennale("2026-08-04")).toBe("2028-08-04");
    expect(calcScadenzaPrescrizione("2026-09-25", 2)).toBe("2028-09-25");
    expect(calcScadenzaPrescrizione("2026-09-25", 1)).toBe("2027-09-25");
    expect(calcScadenzaPrescrizione("2026-09-25", 5)).toBe("2031-09-25");
    expect(calcScadenzaPrescrizione("2026-09-25", 10)).toBe("2036-09-25");
  });

  it("normalizza anni prescrizione a 1/2/5/10 con default 2", () => {
    expect(normalizePrescrizioneAnni(5)).toBe(5);
    expect(normalizePrescrizioneAnni("10")).toBe(10);
    expect(normalizePrescrizioneAnni(3)).toBe(2);
    expect(normalizePrescrizioneAnni(undefined)).toBe(2);
  });

  it("usa data accadimento, non denuncia, come base", () => {
    expect(resolveDataAccadimentoPrescrizione("2026-01-10", "2026-03-01", "2026-03-02")).toBe("2026-01-10");
    expect(resolveDataAccadimentoPrescrizione(null, "2026-03-01", "2026-03-02")).toBe("2026-03-01");
  });

  it("costruisce prescrizione automatica verso agenzia di riferimento", () => {
    const draft = buildPrescrizioneBiennaleAgenzia("2026-08-04", "AG. MILANO FILIBERTO");
    expect(draft).toMatchObject({
      destinatario_tipo: PRESCRIZIONE_DESTINATARIO_AGENZIA,
      destinatario_label: "AG. MILANO FILIBERTO",
      data_scadenza_risposta: "2028-08-04",
      corpo: "Prescrizione biennale dalla data di accadimento del sinistro.",
    });
    expect(draft?.oggetto).toContain("2952");
  });

  it("testo e scadenza per 1/5/10 anni", () => {
    const cinque = buildPrescrizioneBiennaleAgenzia("2026-09-25", "AG. ROMA", 5);
    expect(cinque?.data_scadenza_risposta).toBe("2031-09-25");
    expect(cinque?.oggetto).toContain("quinquennale");
    expect(testoPrescrizioneLegale(1).oggetto).toContain("annuale");
    expect(testoPrescrizioneLegale(10).corpo).toContain("accadimento");
  });

  it("elenco reminder globale include attivi e completati (come scheda pratica)", () => {
    expect(REMINDER_LIST_DEFAULT_STATI).toEqual(["attivo", "completato"]);
  });

  it("visibilità elenco reminder: admin/cfo tutte le sedi, ufficio no", () => {
    expect(reminderListSeesAllSedi("admin")).toBe(true);
    expect(reminderListSeesAllSedi("cfo")).toBe(true);
    expect(reminderListSeesAllSedi("ufficio")).toBe(false);
    expect(reminderListSeesAllSedi("backoffice")).toBe(false);
    expect(reminderListSeesAllSedi("produttore")).toBe(false);
  });
});
