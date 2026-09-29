import { describe, it, expect } from "vitest";
import { emptyGaranziaRow, type GaranziaRow } from "@/components/polizze/PremiGaranziaCardShell";
import { calcTasseEffettiveRiga } from "@/lib/calcProvvigioniGaranzia";
import {
  sameRowContent,
  syncQuietanzaFromFirma,
  markQuietanzaEdits,
  mirrorAllFromFirma,
  resetQuietanzaRow,
  isQuietanzaSincronizzata,
} from "@/components/polizze/premiSync";

const row = (over: Partial<GaranziaRow> = {}): GaranziaRow => ({
  ...emptyGaranziaRow(),
  codice: "MAL",
  descrizione: "Malattia",
  netto: "100",
  tasse: "2.50",
  aliquotaTasse: 2.5,
  ...over,
});

describe("sameRowContent", () => {
  it("riconosce righe identiche nei campi di contenuto", () => {
    expect(sameRowContent(row(), row())).toBe(true);
  });
  it("distingue righe con netto diverso", () => {
    expect(sameRowContent(row({ netto: "100" }), row({ netto: "200" }))).toBe(false);
  });
  it("distingue righe con accessori diverso", () => {
    expect(sameRowContent(row({ accessori: "10" }), row({ accessori: "20" }))).toBe(false);
  });
  it("ignora il flag di personalizzazione nel confronto", () => {
    expect(sameRowContent(row({ quietanzaPersonalizzata: true }), row({ quietanzaPersonalizzata: false }))).toBe(true);
  });
});

describe("syncQuietanzaFromFirma", () => {
  it("rispecchia la Firma quando la Quietanza non è personalizzata", () => {
    const firma = [row({ netto: "300" })];
    const quietanza = [row({ netto: "100", quietanzaPersonalizzata: false })];
    const out = syncQuietanzaFromFirma(firma, quietanza);
    expect(out).toHaveLength(1);
    expect(out[0].netto).toBe("300");
    expect(out[0].quietanzaPersonalizzata).toBe(false);
  });

  it("preserva le righe personalizzate (non le sovrascrive dalla Firma)", () => {
    const firma = [row({ netto: "300" })];
    const quietanza = [row({ netto: "150", quietanzaPersonalizzata: true })];
    const out = syncQuietanzaFromFirma(firma, quietanza);
    expect(out[0].netto).toBe("150");
    expect(out[0].quietanzaPersonalizzata).toBe(true);
  });

  it("sincronizza solo le righe non personalizzate in un mix", () => {
    const firma = [row({ netto: "10" }), row({ netto: "20" }), row({ netto: "30" })];
    const quietanza = [
      row({ netto: "999", quietanzaPersonalizzata: false }),
      row({ netto: "888", quietanzaPersonalizzata: true }),
      row({ netto: "777", quietanzaPersonalizzata: false }),
    ];
    const out = syncQuietanzaFromFirma(firma, quietanza);
    expect(out.map((r) => r.netto)).toEqual(["10", "888", "30"]);
  });

  it("estende la Quietanza quando la Firma aggiunge righe", () => {
    const firma = [row({ netto: "10" }), row({ netto: "20" })];
    const quietanza = [row({ netto: "10", quietanzaPersonalizzata: false })];
    const out = syncQuietanzaFromFirma(firma, quietanza);
    expect(out).toHaveLength(2);
    expect(out[1].netto).toBe("20");
  });

  it("scarta le righe Quietanza in eccesso non personalizzate ma tiene quelle personalizzate", () => {
    const firma = [row({ netto: "10" })];
    const quietanza = [
      row({ netto: "10", quietanzaPersonalizzata: false }),
      row({ netto: "55", quietanzaPersonalizzata: false }),
      row({ netto: "77", quietanzaPersonalizzata: true }),
    ];
    const out = syncQuietanzaFromFirma(firma, quietanza);
    expect(out.map((r) => r.netto)).toEqual(["10", "77"]);
  });

  it("propaga tasseRettifica dalla Firma alla Quietanza specchio", () => {
    const firma = [
      row({
        netto: "5919.83",
        tasse: "1317.16",
        tasseRettifica: "0.01",
        tasseManualOverride: true,
        aliquotaTasse: 22.25,
      }),
    ];
    const quietanza = [row({ netto: "0", quietanzaPersonalizzata: false })];
    const out = syncQuietanzaFromFirma(firma, quietanza);
    expect(out[0].tasseRettifica).toBe("0.01");
    expect(out[0].tasseManualOverride).toBe(true);
    const lordo =
      parseFloat(out[0].netto!) +
      parseFloat(out[0].accessori || "0") +
      calcTasseEffettiveRiga(out[0]) +
      parseFloat(out[0].ssn || "0");
    expect(lordo).toBeCloseTo(7237, 2);
  });
});

describe("markQuietanzaEdits", () => {
  it("marca personalizzata la riga il cui campo è cambiato (stessa lunghezza)", () => {
    const prev = [row({ netto: "100" }), row({ netto: "200" })];
    const next = [row({ netto: "100" }), row({ netto: "250" })];
    const out = markQuietanzaEdits(prev, next);
    expect(out[0].quietanzaPersonalizzata).toBeFalsy();
    expect(out[1].quietanzaPersonalizzata).toBe(true);
  });

  it("non marca nulla se nessun contenuto cambia", () => {
    const prev = [row({ netto: "100" })];
    const next = [row({ netto: "100" })];
    const out = markQuietanzaEdits(prev, next);
    expect(out[0].quietanzaPersonalizzata).toBeFalsy();
  });

  it("marca personalizzata una riga aggiunta a mano (lunghezza diversa)", () => {
    const prev = [row({ netto: "100", quietanzaPersonalizzata: false })];
    const next = [row({ netto: "100", quietanzaPersonalizzata: false }), emptyGaranziaRow()];
    const out = markQuietanzaEdits(prev, next);
    expect(out[1].quietanzaPersonalizzata).toBe(true);
  });
});

describe("mirrorAllFromFirma / resetQuietanzaRow", () => {
  it("mirrorAllFromFirma azzera tutte le personalizzazioni", () => {
    const firma = [row({ netto: "10" }), row({ netto: "20" })];
    const out = mirrorAllFromFirma(firma);
    expect(out.every((r) => r.quietanzaPersonalizzata === false)).toBe(true);
    expect(out.map((r) => r.netto)).toEqual(["10", "20"]);
  });

  it("resetQuietanzaRow riallinea solo la riga indicata", () => {
    const firma = [row({ netto: "10" }), row({ netto: "20" })];
    const quietanza = [
      row({ netto: "111", quietanzaPersonalizzata: true }),
      row({ netto: "222", quietanzaPersonalizzata: true }),
    ];
    const out = resetQuietanzaRow(firma, quietanza, 0);
    expect(out[0].netto).toBe("10");
    expect(out[0].quietanzaPersonalizzata).toBe(false);
    // la seconda riga resta personalizzata
    expect(out[1].netto).toBe("222");
    expect(out[1].quietanzaPersonalizzata).toBe(true);
  });
});

describe("isQuietanzaSincronizzata", () => {
  it("true quando nessuna riga è personalizzata", () => {
    expect(isQuietanzaSincronizzata([row(), row()])).toBe(true);
  });
  it("false quando almeno una riga è personalizzata", () => {
    expect(isQuietanzaSincronizzata([row(), row({ quietanzaPersonalizzata: true })])).toBe(false);
  });
  it("false su lista vuota", () => {
    expect(isQuietanzaSincronizzata([])).toBe(false);
  });
});
