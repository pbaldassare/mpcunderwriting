import { describe, it, expect } from "vitest";
import {
  calcLordoGaranzia,
  calcConguaglioProposto,
  buildVeicoloSnapshot,
  buildOggettoSnapshot,
  VEICOLO_EDITABLE_FIELDS,
} from "../operazionePolizzaPremi";

describe("calcLordoGaranzia", () => {
  it("somma firma, rata, imposta e SSN arrotondando a 2 decimali", () => {
    expect(calcLordoGaranzia({ firma: 100, rata: 50, imposta_provinciale: 12.5, ssn: 10.5 })).toBe(173);
    expect(calcLordoGaranzia({ firma: 10.333, rata: 0, imposta_provinciale: 1.111, ssn: 0 })).toBe(11.44);
  });

  it("tratta valori null/undefined come zero", () => {
    expect(calcLordoGaranzia({ firma: 100 })).toBe(100);
    expect(calcLordoGaranzia({})).toBe(0);
  });
});

describe("calcConguaglioProposto", () => {
  it("calcola la differenza tra nuovo e originale", () => {
    expect(calcConguaglioProposto(1200, 1000)).toBe(200);
    expect(calcConguaglioProposto(800, 1000)).toBe(-200);
    expect(calcConguaglioProposto(100.01, 100)).toBe(0.01);
  });
});

describe("buildVeicoloSnapshot", () => {
  it("mappa i campi veicolo nel formato storico", () => {
    const snap = buildVeicoloSnapshot({
      targa: "AB123CD",
      marca: "Fiat",
      modello: "Panda",
      versione: "1.0",
      telaio: "ZFA123",
      tipo_veicolo: "Autovettura",
      tipo_alimentazione: "Benzina",
      cc: 999,
      kw: 51,
      cv: 69,
      posti: 5,
      data_immatricolazione: "2020-01-15",
      classe_bm: "1",
      provincia_circolazione: "VE",
    });
    expect(snap.tipo).toBe("veicolo");
    expect(snap.targa).toBe("AB123CD");
    expect(snap.cilindrata).toBe(999);
    expect(snap.potenza_kw).toBe(51);
    expect(snap.provincia_circolazione).toBe("VE");
  });

  it("ritorna null per veicolo assente", () => {
    const snap = buildVeicoloSnapshot(null);
    expect(snap.targa).toBeNull();
    expect(snap.cilindrata).toBeNull();
  });
});

describe("buildOggettoSnapshot", () => {
  it("include descrizione e campi extra", () => {
    const snap = buildOggettoSnapshot(
      { descrizione_polizza: "Immobile via Roma" },
      { ubicazione_rischio: "Via Roma 1", valore_assicurato: "150000,50", riferimento_oggetto: "Matr. X" },
    );
    expect(snap.tipo).toBe("oggetto_generico");
    expect(snap.descrizione).toBe("Immobile via Roma");
    expect(snap.ubicazione_rischio).toBe("Via Roma 1");
    expect(snap.valore_assicurato).toBe(150000.5);
    expect(snap.riferimento_oggetto).toBe("Matr. X");
  });
});

describe("VEICOLO_EDITABLE_FIELDS", () => {
  it("include i campi RCA previsti", () => {
    expect(VEICOLO_EDITABLE_FIELDS).toContain("targa");
    expect(VEICOLO_EDITABLE_FIELDS).toContain("provincia_circolazione");
    expect(VEICOLO_EDITABLE_FIELDS.length).toBe(14);
  });
});
