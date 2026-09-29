import { describe, expect, it } from "vitest";
import {
  FATTORI_REGOLAZIONE_STANDARD,
  isFattoreRegolazioneStandard,
  mergeFattoriRegolazione,
} from "@/lib/fattoriRegolazioneStandard";

describe("mergeFattoriRegolazione", () => {
  const standard = FATTORI_REGOLAZIONE_STANDARD.map((s, i) => ({
    id: `std-${i}`,
    codice: s.codice,
    descrizione: s.descrizione,
  }));

  it("mette gli standard prima e aggiunge i custom", () => {
    const custom = [
      { id: "c1", codice: "altro", descrizione: "Altro" },
      { id: "c2", codice: "massa_salariale", descrizione: "Massa salariale" },
    ];
    const merged = mergeFattoriRegolazione(standard, custom);
    expect(merged.map((f) => f.codice)).toEqual([
      ...FATTORI_REGOLAZIONE_STANDARD.map((s) => s.codice),
      "altro",
      "massa_salariale",
    ]);
  });

  it("non duplica codice già presente tra gli standard", () => {
    const custom = [
      { id: "dup", codice: "fatturato", descrizione: "Fatturato custom" },
      { id: "c1", codice: "altro", descrizione: "Altro" },
    ];
    const merged = mergeFattoriRegolazione(standard, custom);
    expect(merged.filter((f) => f.codice === "fatturato")).toHaveLength(1);
    expect(merged.find((f) => f.codice === "fatturato")?.id).toBe("std-0");
    expect(merged.map((f) => f.codice)).toContain("altro");
  });

  it("funziona senza custom e senza standard DB", () => {
    expect(mergeFattoriRegolazione([], [])).toEqual([]);
    expect(mergeFattoriRegolazione(standard, [])).toHaveLength(5);
  });
});

describe("isFattoreRegolazioneStandard", () => {
  it("riconosce i 5 codici", () => {
    expect(isFattoreRegolazioneStandard("fatturato")).toBe(true);
    expect(isFattoreRegolazioneStandard("altro")).toBe(false);
  });
});
