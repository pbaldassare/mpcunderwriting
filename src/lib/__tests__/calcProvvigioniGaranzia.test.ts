import { describe, it, expect } from "vitest";
import { emptyGaranziaRow, type GaranziaRow } from "@/components/polizze/PremiGaranziaCardShell";
import {
  calcProvvigioniGaranzia,
  calcTasseRiga,
  calcLordoGaranziaRow,
  resolveRowPctAccessori,
  resolveRowPctNetto,
  resolveRowPctNettoAgenzia,
  resolveRowPctAccessoriAgenzia,
  decomposeLordoToPremi,
  type MatriceProvvAccessori,
} from "@/lib/calcProvvigioniGaranzia";

const matrice: MatriceProvvAccessori = {
  pctByRamoId: new Map([["sotto-1", 15]]),
  pctAccessoriByRamoId: new Map([["sotto-1", 10]]),
  pctDefault: 12,
  pctAccessoriDefault: 8,
  pctPrevalente: 15,
  isUniform: false,
};

const row = (over: Partial<GaranziaRow> = {}): GaranziaRow => ({
  ...emptyGaranziaRow(),
  sottoramoId: "sotto-1",
  netto: "100",
  accessori: "20",
  ...over,
});

describe("calcTasseRiga", () => {
  it("calcola tasse su imponibile netto + accessori", () => {
    expect(calcTasseRiga(100, 20, 2.5)).toBe(3);
  });
});

describe("calcLordoGaranziaRow", () => {
  it("diritti agenzia: lordo = solo tasse", () => {
    expect(calcLordoGaranziaRow({ ...emptyGaranziaRow(), dirittiAgenzia: true, tasse: "22" })).toBe(22);
  });

  it("garanzia standard: netto + accessori + tasse + ssn", () => {
    expect(
      calcLordoGaranziaRow({ ...emptyGaranziaRow(), netto: "100", tasse: "22", ssn: "0" }),
    ).toBe(122);
  });

  it("rettifica tasse: aumenta lordo senza cambiare provvigioni", () => {
    const base = row({ netto: "100", accessori: "20", tasse: "3" });
    const conRett = row({ netto: "100", accessori: "20", tasse: "3", tasseRettifica: "0.50" });
    expect(calcProvvigioniGaranzia([base], matrice)).toBe(calcProvvigioniGaranzia([conRett], matrice));
    expect(calcLordoGaranziaRow(conRett)).toBeCloseTo(calcLordoGaranziaRow(base) + 0.5, 2);
  });

  it("rettifica negativa riduce lordo", () => {
    const r = row({ netto: "100", accessori: "", tasse: "22", tasseRettifica: "-1.00" });
    expect(calcLordoGaranziaRow(r)).toBe(121);
  });
});

describe("decomposeLordoToPremi", () => {
  it("scompone lordo positivo con tasse", () => {
    const p = decomposeLordoToPremi({ lordo: 122.5, aliquotaTassePct: 2.5 });
    expect(p.netto + p.tasse + p.ssn + p.tasseRettifica).toBeCloseTo(122.5, 2);
    expect(p.netto).toBeGreaterThan(0);
    expect(p.tasse).toBeGreaterThan(0);
  });

  it("scompone lordo negativo (appendice a credito) senza clamp a zero", () => {
    const p = decomposeLordoToPremi({ lordo: -176, aliquotaTassePct: 2.5 });
    expect(p.netto).toBeLessThan(0);
    expect(p.tasse).toBeLessThan(0);
    expect(p.netto + p.tasse + p.ssn + p.tasseRettifica).toBeCloseTo(-176, 2);
  });

  it("senza aliquote: netto = lordo − accessori (anche negativo)", () => {
    const p = decomposeLordoToPremi({ lordo: -100, accessori: 0 });
    expect(p.netto).toBe(-100);
    expect(p.tasse).toBe(0);
    expect(p.ssn).toBe(0);
  });

  it("con SSN automatico propaga il segno sul netto", () => {
    const p = decomposeLordoToPremi({
      lordo: -115.5,
      aliquotaTassePct: 0,
      ssnAuto: true,
      aliquotaSsnPct: 10.5,
    });
    expect(p.netto).toBeLessThan(0);
    expect(p.ssn).toBeLessThan(0);
    expect(p.netto + p.ssn + p.tasseRettifica).toBeCloseTo(-115.5, 2);
  });
});

describe("calcProvvigioniGaranzia", () => {
  it("somma provvigione su netto e su accessori con % distinte", () => {
    const provv = calcProvvigioniGaranzia([row()], matrice);
    // 100 * 15% + 20 * 10% = 15 + 2 = 17
    expect(provv).toBeCloseTo(17, 2);
  });

  it("usa pctAccessoriDefault prima del fallback sulla % netto", () => {
    const m: MatriceProvvAccessori = {
      ...matrice,
      pctAccessoriByRamoId: new Map(),
      pctAccessoriDefault: 12,
    };
    const provv = calcProvvigioniGaranzia([row({ netto: "543.56", accessori: "100.50" })], {
      ...m,
      pctByRamoId: new Map([["sotto-1", 8]]),
      pctDefault: 8,
      pctPrevalente: 8,
    });
    // 543.56 * 8% + 100.50 * 12% = 43.4848 + 12.06 = 55.5448
    expect(provv).toBeCloseTo(55.5448, 2);
  });

  it("usa fallback % accessori = % netto solo se manca anche il default", () => {
    const m: MatriceProvvAccessori = {
      ...matrice,
      pctAccessoriByRamoId: new Map(),
      pctAccessoriDefault: null,
    };
    const provv = calcProvvigioniGaranzia([row()], m);
    // 100 * 15% + 20 * 15% = 18
    expect(provv).toBeCloseTo(18, 2);
  });

  it("esclude righe con escludiProvvigioni", () => {
    expect(calcProvvigioniGaranzia([row({ escludiProvvigioni: true })], matrice)).toBe(0);
  });

  it("esclude righe diritti di agenzia (solo tasse)", () => {
    expect(calcProvvigioniGaranzia([row({ dirittiAgenzia: true, netto: "", tasse: "50" })], matrice)).toBe(0);
  });

  it("non crasha su input assente o non array", () => {
    expect(calcProvvigioniGaranzia(undefined, matrice)).toBe(0);
    expect(calcProvvigioniGaranzia(null, matrice)).toBe(0);
  });
});

describe("resolveRowPctAccessori", () => {
  it("rispetta override manuale solo se il flag override è attivo", () => {
    const r = resolveRowPctAccessori(
      row({ provvAccessoriPct: 5, provvAccessoriPctOverride: true }),
      matrice,
    );
    expect(r.pct).toBe(5);
    expect(r.matched).toBe(true);
  });

  it("ignora la % di riga se il flag override non è attivo (usa matrice agenzia)", () => {
    const r = resolveRowPctAccessori(row({ provvAccessoriPct: 5 }), matrice);
    // sotto-1 → 10% da matrice, l'override senza flag viene ignorato
    expect(r.pct).toBe(10);
  });

  it("resolveRowPctAccessoriAgenzia ignora sempre l'override di riga", () => {
    const r = resolveRowPctAccessoriAgenzia(
      row({ provvAccessoriPct: 5, provvAccessoriPctOverride: true }),
      matrice,
    );
    expect(r.pct).toBe(10);
  });
});

describe("resolveRowPctNetto", () => {
  it("usa la matrice agenzia senza override", () => {
    expect(resolveRowPctNetto(row(), matrice).pct).toBe(15);
  });

  it("rispetta override netto solo con flag attivo", () => {
    expect(
      resolveRowPctNetto(row({ provvNettoPct: 9, provvNettoPctOverride: true }), matrice).pct,
    ).toBe(9);
    // senza flag → ignora
    expect(resolveRowPctNetto(row({ provvNettoPct: 9 }), matrice).pct).toBe(15);
  });

  it("resolveRowPctNettoAgenzia ignora sempre l'override di riga", () => {
    expect(
      resolveRowPctNettoAgenzia(row({ provvNettoPct: 9, provvNettoPctOverride: true }), matrice).pct,
    ).toBe(15);
  });

  it("override netto entra nel calcolo provvigioni di riga", () => {
    // 100 * 9% (override) + 20 * 10% (acc matrice) = 9 + 2 = 11
    const provv = calcProvvigioniGaranzia(
      [row({ provvNettoPct: 9, provvNettoPctOverride: true })],
      matrice,
    );
    expect(provv).toBeCloseTo(11, 2);
  });
});
