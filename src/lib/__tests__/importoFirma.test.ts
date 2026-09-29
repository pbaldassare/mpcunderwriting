import { describe, expect, it } from "vitest";
import { lordoFirmaDaVoci, payloadImportoFirma, vociDaLordoFirma } from "@/lib/importoFirma";

describe("importoFirma", () => {
  it("lordo = netto + tasse + ssn + accessori", () => {
    expect(lordoFirmaDaVoci({ netto: 1000, tasse: 200, ssn: 22.5, addizionali: 0 })).toBe(1222.5);
  });

  it("cambia il lordo tenendo le extra e aggiornando il netto", () => {
    const next = vociDaLordoFirma(1000, { netto: 1000, tasse: 200, ssn: 22.5, addizionali: 0 });
    expect(next).toEqual({ netto: 777.5, tasse: 200, ssn: 22.5, addizionali: 0 });
    expect(lordoFirmaDaVoci(next)).toBe(1000);
  });

  it("se le extra superano il lordo, azzera extra e mette tutto sul netto", () => {
    const next = vociDaLordoFirma(50, { netto: 1000, tasse: 200, ssn: 22.5, addizionali: 0 });
    expect(next).toEqual({ netto: 50, tasse: 0, ssn: 0, addizionali: 0 });
  });

  it("payload per update titoli", () => {
    expect(payloadImportoFirma({ netto: 777.5, tasse: 200, ssn: 22.5, addizionali: 0 })).toEqual({
      premio_netto: 777.5,
      tasse: 200,
      ssn_firma: 22.5,
      addizionali: 0,
    });
  });
});
