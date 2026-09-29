import { describe, it, expect } from "vitest";
import { datePeriodoPolizzaGaranzia, extremaDate, compareText } from "../datePolizzaGaranzia";

describe("datePeriodoPolizzaGaranzia", () => {
  it("fine polizza resta su durata_a anche se una quietanza ha garanzia oltre il contratto", () => {
    // COMUNE CAMPOSAMPIERO / M16850989: durata 2026-2029, ultima rata 2029-2030
    const head = {
      durata_da: "2026-06-30",
      durata_a: "2029-06-30",
      garanzia_da: "2027-06-30",
      garanzia_a: "2028-06-30",
    };
    const rate = [
      { garanzia_da: "2027-06-30", garanzia_a: "2028-06-30" },
      { garanzia_da: "2028-06-30", garanzia_a: "2029-06-30" },
      { garanzia_da: "2029-06-30", garanzia_a: "2030-06-30" },
    ];
    const d = datePeriodoPolizzaGaranzia(head, rate);
    expect(d.inizioPolizza).toBe("2026-06-30");
    expect(d.finePolizza).toBe("2029-06-30");
    expect(d.inizioGaranzia).toBe("2029-06-30");
    expect(d.fineGaranzia).toBe("2030-06-30");
  });

  it("non allunga la durata se durata_a è ferma al primo anno e le rate vanno oltre", () => {
    const head = {
      durata_da: "2026-06-29",
      durata_a: "2027-06-29",
      garanzia_da: "2026-06-29",
      garanzia_a: "2027-06-29",
    };
    const rate = [
      { garanzia_da: "2026-06-29", garanzia_a: "2027-06-29" },
      { garanzia_da: "2027-06-29", garanzia_a: "2028-06-29" },
    ];
    const d = datePeriodoPolizzaGaranzia(head, rate);
    expect(d.inizioPolizza).toBe("2026-06-29");
    expect(d.finePolizza).toBe("2027-06-29");
    expect(d.inizioGaranzia).toBe("2027-06-29");
    expect(d.fineGaranzia).toBe("2028-06-29");
  });

  it("senza durata_a usa il max delle garanzie (testata + rate)", () => {
    const d = datePeriodoPolizzaGaranzia(
      { garanzia_da: "2026-06-30", garanzia_a: "2027-06-30" },
      [{ garanzia_da: "2027-06-30", garanzia_a: "2028-06-30" }],
    );
    expect(d.inizioPolizza).toBe("2026-06-30");
    expect(d.finePolizza).toBe("2028-06-30");
  });

  it("senza rate usa le date della madre", () => {
    const d = datePeriodoPolizzaGaranzia({
      garanzia_da: "2026-01-01",
      garanzia_a: "2027-01-01",
    });
    expect(d.inizioGaranzia).toBe("2026-01-01");
    expect(d.fineGaranzia).toBe("2027-01-01");
    expect(d.inizioPolizza).toBe("2026-01-01");
    expect(d.finePolizza).toBe("2027-01-01");
  });
});

describe("compareText", () => {
  it("ordina in italiano e inverte con desc", () => {
    expect(compareText("RCA", "Furto", "asc")).toBeGreaterThan(0);
    expect(compareText("RCA", "Furto", "desc")).toBeLessThan(0);
  });
});

describe("extremaDate", () => {
  it("min e max", () => {
    expect(extremaDate(["2027-01-01", "2026-01-01"], "min")).toBe("2026-01-01");
    expect(extremaDate(["2027-01-01", "2026-01-01"], "max")).toBe("2027-01-01");
    expect(extremaDate([null, ""], "max")).toBeNull();
  });
});
