import { describe, expect, it } from "vitest";
import {
  computeRegolazioneDatePresunte,
  resizeRegolazioneDatePresunte,
  addYearsISO,
} from "@/lib/regolazioneDatePresunte";

describe("computeRegolazioneDatePresunte", () => {
  it("1 anno → 1 data (fine anno 1)", () => {
    expect(
      computeRegolazioneDatePresunte({
        durataDa: "2026-03-15",
        anniDurata: 1,
      }),
    ).toEqual(["2027-03-15"]);
  });

  it("3 anni → 3 date fine-anno", () => {
    expect(
      computeRegolazioneDatePresunte({
        durataDa: "2026-03-15",
        anniDurata: 3,
      }),
    ).toEqual(["2027-03-15", "2028-03-15", "2029-03-15"]);
  });

  it("usa garanziaDa se durataDa assente", () => {
    expect(
      computeRegolazioneDatePresunte({
        garanziaDa: "2026-03-15",
        anniDurata: 2,
      }),
    ).toEqual(["2027-03-15", "2028-03-15"]);
  });

  it("preferisce durataDa a garanziaDa", () => {
    expect(
      computeRegolazioneDatePresunte({
        durataDa: "2026-01-01",
        garanziaDa: "2026-06-01",
        anniDurata: 1,
      }),
    ).toEqual(["2027-01-01"]);
  });

  it("anniDurata invalidi → almeno 1", () => {
    expect(
      computeRegolazioneDatePresunte({
        durataDa: "2026-03-15",
        anniDurata: 0,
      }),
    ).toEqual(["2027-03-15"]);
  });

  it("senza base → array vuoto", () => {
    expect(computeRegolazioneDatePresunte({ anniDurata: 3 })).toEqual([]);
  });
});

describe("addYearsISO leap year", () => {
  it("29 feb + 1 anno overflow come Date.UTC del progetto", () => {
    // 2024-02-29 + 12 mesi → 2025-03-01 (comportamento Date.UTC esistente)
    expect(addYearsISO("2024-02-29", 1)).toBe("2025-03-01");
  });
});

describe("resizeRegolazioneDatePresunte", () => {
  it("preserva date touched e aggiunge nuove calcolate", () => {
    const { dates, touched } = resizeRegolazioneDatePresunte({
      current: ["2027-06-01"],
      touched: [true],
      durataDa: "2026-03-15",
      anniDurata: 3,
    });
    expect(dates).toEqual(["2027-06-01", "2028-03-15", "2029-03-15"]);
    expect(touched).toEqual([true, false, false]);
  });

  it("rimuove excess quando anni diminuiscono", () => {
    const { dates } = resizeRegolazioneDatePresunte({
      current: ["2027-03-15", "2028-03-15", "2029-03-15"],
      touched: [false, false, false],
      durataDa: "2026-03-15",
      anniDurata: 1,
    });
    expect(dates).toEqual(["2027-03-15"]);
  });
});
