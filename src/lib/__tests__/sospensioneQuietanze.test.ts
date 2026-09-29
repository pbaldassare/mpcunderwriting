import { describe, it, expect } from "vitest";
import {
  addDaysISO,
  diffDaysISO,
  buildQuietanzeSnapshot,
  computeShiftedDates,
  wasInCorsoAtSuspension,
  selectQuietanzeToFreeze,
} from "../sospensioneQuietanze";

describe("addDaysISO / diffDaysISO", () => {
  it("addDaysISO aggiunge giorni correttamente", () => {
    expect(addDaysISO("2026-01-01", 10)).toBe("2026-01-11");
    expect(addDaysISO("2026-01-31", 1)).toBe("2026-02-01");
  });

  it("diffDaysISO calcola la differenza in giorni", () => {
    expect(diffDaysISO("2026-01-01", "2026-01-11")).toBe(10);
    expect(diffDaysISO("2026-03-01", "2026-03-15")).toBe(14);
  });
});

describe("wasInCorsoAtSuspension", () => {
  it("true se data sospensione è nel periodo garanzia (escluso il primo giorno)", () => {
    expect(wasInCorsoAtSuspension("2026-01-01", "2026-06-30", "2026-03-15")).toBe(true);
    expect(wasInCorsoAtSuspension("2026-01-01", "2026-06-30", "2026-01-01")).toBe(false);
    expect(wasInCorsoAtSuspension("2026-01-01", "2026-06-30", "2026-06-30")).toBe(true);
  });

  it("false se fuori periodo", () => {
    expect(wasInCorsoAtSuspension("2026-07-01", "2026-12-31", "2026-03-15")).toBe(false);
  });
});

describe("computeShiftedDates", () => {
  const dataSosp = "2026-03-15";
  const dataRiatt = "2026-04-01";
  const shift = diffDaysISO(dataSosp, dataRiatt);

  it("quietanza in corso: garanzia_da = data riattivazione, garanzia_a estesa di shiftDays", () => {
    const origDa = "2026-01-01";
    const origA = "2026-06-30";
    const result = computeShiftedDates(origDa, origA, dataSosp, dataRiatt, shift);
    expect(result.garanzia_da).toBe(dataRiatt);
    expect(result.garanzia_a).toBe(addDaysISO(origA, shift));
  });

  it("quietanza futura: entrambe le date shiftate di shiftDays", () => {
    const origDa = "2026-07-01";
    const origA = "2026-12-31";
    const result = computeShiftedDates(origDa, origA, dataSosp, dataRiatt, shift);
    expect(result.garanzia_da).toBe(addDaysISO(origDa, shift));
    expect(result.garanzia_a).toBe(addDaysISO(origA, shift));
  });

  it("shiftDays coerente con diffDaysISO", () => {
    expect(shift).toBe(17);
    const origDa = "2026-07-01";
    const origA = "2026-12-31";
    const result = computeShiftedDates(origDa, origA, dataSosp, dataRiatt, shift);
    expect(result.garanzia_da).toBe("2026-07-18");
    expect(result.garanzia_a).toBe("2027-01-17");
  });
});

describe("buildQuietanzeSnapshot", () => {
  it("serializza le quietanze congelate", () => {
    const snap = buildQuietanzeSnapshot("2026-03-15", [
      { id: "q1", riga: 2, garanzia_da: "2026-07-01", garanzia_a: "2026-12-31", premio_lordo: 500, stato: "attivo" },
    ]);
    expect(snap.data_sospensione).toBe("2026-03-15");
    expect(snap.quietanze).toHaveLength(1);
    expect(snap.quietanze[0].id).toBe("q1");
    expect(snap.quietanze[0].premio_lordo).toBe(500);
    expect(snap.frozen_at).toBeTruthy();
  });
});

describe("selectQuietanzeToFreeze", () => {
  const rows = [
    { id: "q-future", riga: 2, stato: "attivo", data_messa_cassa: null, garanzia_da: "2026-07-01", garanzia_a: "2026-12-31" },
    { id: "q-incassata", riga: 3, stato: "incassato", data_messa_cassa: "2026-01-01", garanzia_da: "2027-01-01", garanzia_a: "2027-06-30" },
    { id: "q-corso", riga: 1, stato: "attivo", data_messa_cassa: null, garanzia_da: "2026-01-01", garanzia_a: "2026-06-30" },
  ];

  it("include quietanze future non incassate e in corso", () => {
    const frozen = selectQuietanzeToFreeze(rows, 0, "2026-03-15");
    expect(frozen.map((r) => r.id).sort()).toEqual(["q-corso", "q-future"]);
  });

  it("esclude quietanze già incassate", () => {
    const frozen = selectQuietanzeToFreeze(rows, 0, "2026-03-15");
    expect(frozen.find((r) => r.id === "q-incassata")).toBeUndefined();
  });
});
