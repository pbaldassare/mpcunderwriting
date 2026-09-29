import { describe, expect, it } from "vitest";
import {
  aggregateGaranziePremi,
  calcProvvigioniAppendice,
} from "@/lib/appendicePremi";
import type { GaranziaEditorRow } from "@/components/polizze/PolizzaEditorInline";

const row = (partial: Partial<GaranziaEditorRow>): GaranziaEditorRow => ({
  garanzia: "RCA",
  codice_garanzia: null,
  firma: 100,
  rata: 10,
  imposta_provinciale: 12.5,
  ssn: 0,
  lordo_calcolato: 122.5,
  is_rca_principale: true,
  ordine: 1,
  ...partial,
});

describe("appendicePremi", () => {
  it("aggregateGaranziePremi somma righe garanzia", () => {
    const agg = aggregateGaranziePremi([row({}), row({ firma: 50, rata: 0, imposta_provinciale: 5, ssn: 2, lordo_calcolato: 57 })]);
    expect(agg.premio_netto).toBe(150);
    expect(agg.addizionali).toBe(10);
    expect(agg.tasse).toBe(17.5);
    expect(agg.ssn_firma).toBe(2);
    expect(agg.premio_lordo).toBe(179.5);
  });

  it("calcProvvigioniAppendice applica percentuale sul netto", () => {
    expect(calcProvvigioniAppendice(100, 15)).toBe(15);
    expect(calcProvvigioniAppendice(0, 15)).toBe(0);
    expect(calcProvvigioniAppendice(100, null)).toBe(0);
  });
});
