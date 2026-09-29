import { describe, it, expect } from "vitest";
import { syncPeriodoTemporanea } from "../syncPeriodoTemporanea";

describe("syncPeriodoTemporanea", () => {
  it("allinea data competenza e garanzie a durata da/a", () => {
    expect(
      syncPeriodoTemporanea({ durataDa: "2026-06-01", durataA: "2026-07-15" }),
    ).toEqual({
      data_competenza: "2026-06-01",
      garanzia_da: "2026-06-01",
      garanzia_a: "2026-07-15",
    });
  });

  it("restituisce stringhe vuote se le date mancano", () => {
    expect(syncPeriodoTemporanea({ durataDa: "", durataA: "" })).toEqual({
      data_competenza: "",
      garanzia_da: "",
      garanzia_a: "",
    });
  });
});
