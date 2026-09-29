import { describe, it, expect } from "vitest";
import {
  shouldShowRate,
  computeFlatQuietanze,
  computeCounts,
  computeRenderedRowCount,
  groupTitoliByPolizza,
} from "../polizzeClienteView";

// Fixture: 2 polizze
//  - POL-A: madre + 2 rate
//  - POL-B: solo madre (nessuna rata)
const titoli = [
  { id: "a0", numero_titolo: "POL-A", sostituisce_polizza: null, garanzia_da: "2026-01-01" },
  { id: "a1", numero_titolo: "POL-A", sostituisce_polizza: "a0", garanzia_da: "2026-02-01" },
  { id: "a2", numero_titolo: "POL-A", sostituisce_polizza: "a1", garanzia_da: "2026-03-01" },
  { id: "b0", numero_titolo: "POL-B", sostituisce_polizza: null, garanzia_da: "2026-01-15" },
];

describe("shouldShowRate", () => {
  it("non espande più le rate annidate (vista separata Polizze / Quietanze)", () => {
    expect(shouldShowRate("polizze", true)).toBe(false);
    expect(shouldShowRate("polizze", false)).toBe(false);
    expect(shouldShowRate("quietanze", true)).toBe(false);
  });
});

describe("computeFlatQuietanze", () => {
  it("emette una riga per rata con madreNum/madreId/totale (= numero di figli) e idx 1-based partendo da 1", () => {
    const catene = groupTitoliByPolizza(titoli);
    const flat = computeFlatQuietanze(catene);

    expect(flat).toHaveLength(2);
    expect(flat.every((r) => r.madreNum === "POL-A")).toBe(true);
    expect(flat.every((r) => r.madreId === "a0")).toBe(true);
    // totale = numero di quietanze (figli), NON madre+figli
    expect(flat.every((r) => r.totale === 2)).toBe(true);
    expect(flat.map((r) => r.idx).sort()).toEqual([1, 2]);
    expect(flat.map((r) => r.rata.id).sort()).toEqual(["a1", "a2"]);
  });

  it("non emette righe per catene senza rate", () => {
    const catene = groupTitoliByPolizza([titoli[3]]); // solo POL-B madre
    expect(computeFlatQuietanze(catene)).toEqual([]);
  });

  it("usa all[0] come fallback se manca la madre", () => {
    // catena 'orfana': solo rate, madre mancante → madreNum dal primo elemento
    const orfana = [
      { id: "x1", numero_titolo: "POL-X", sostituisce_polizza: "x0", garanzia_da: "2026-02-01" },
    ];
    const catene = groupTitoliByPolizza(orfana);
    const flat = computeFlatQuietanze(catene);
    expect(flat).toHaveLength(1);
    expect(flat[0].madreNum).toBe("POL-X");
    expect(flat[0].totale).toBe(1);
    expect(flat[0].idx).toBe(1);
  });
});


describe("computeCounts", () => {
  it("conta polizze (madri) e quietanze separatamente", () => {
    expect(computeCounts(titoli)).toEqual({ polizze: 2, quietanze: 2 });
  });
  it("ritorna 0 su array vuoto", () => {
    expect(computeCounts([])).toEqual({ polizze: 0, quietanze: 0 });
  });
});

describe("computeRenderedRowCount — dataset differente per modalità", () => {
  const catene = groupTitoliByPolizza(titoli);

  it("'polizze' → 1 riga per catena (2)", () => {
    expect(computeRenderedRowCount(catene, "polizze")).toBe(2);
  });

  it("'quietanze' → solo le rate flat (2)", () => {
    expect(computeRenderedRowCount(catene, "quietanze")).toBe(2);
  });

  it("i conteggi della toolbar restano invariati al cambiare di filtroTipo", () => {
    const counts = computeCounts(titoli);
    expect(counts).toEqual({ polizze: 2, quietanze: 2 });
  });
});
