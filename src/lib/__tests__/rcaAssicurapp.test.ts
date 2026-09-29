import { describe, expect, it } from "vitest";
import {
  deriveStatoPreventivoDaOfferte,
  extractPremioOfferta,
  genderFromCf,
  labelStatoOfferta,
  selectedCvtsFromGaranzie,
} from "@/lib/rca/assicurapp";

describe("Assicurapp mapping", () => {
  it("deriva CVT dalle garanzie CBnet", () => {
    expect(selectedCvtsFromGaranzie(["cristalli", "rinuncia_rivalsa"])).toEqual([]);
    expect(selectedCvtsFromGaranzie(["infortuni_conducente", "furto_incendio", "kasko"])).toEqual([
      "IF",
      "IFE",
      "IFE K",
    ]);
  });

  it("stato preventivo da offerte e quoteUID", () => {
    expect(deriveStatoPreventivoDaOfferte([], null)).toBe("pronto");
    expect(deriveStatoPreventivoDaOfferte([], "q1")).toBe("in_quotazione");
    expect(deriveStatoPreventivoDaOfferte([{ status: "pending" }], "q1")).toBe("in_quotazione");
    expect(deriveStatoPreventivoDaOfferte([{ status: "completed" }], "q1")).toBe("quotato");
  });

  it("ricava sesso dal codice fiscale se manca M/F", () => {
    expect(genderFromCf("SMNDTL62A52H823F", "na")).toBe("F");
    expect(genderFromCf("RSSMRA80A01H501U", "")).toBe("M");
    expect(genderFromCf("SMNDTL62A52H823F", "M")).toBe("M");
  });

  it("etichetta stato offerta Assicurapp", () => {
    expect(labelStatoOfferta("not_quotable")).toBe("Non quotabile");
    expect(labelStatoOfferta("completed")).toBe("Completata");
  });

  it("estrae premio da prices", () => {
    expect(extractPremioOfferta({ total_gross: 412.5 })).toBe(412.5);
    expect(extractPremioOfferta({ rate: [{ min: 300, max: 400 }] })).toBe(300);
    expect(extractPremioOfferta({})).toBeNull();
  });
});
