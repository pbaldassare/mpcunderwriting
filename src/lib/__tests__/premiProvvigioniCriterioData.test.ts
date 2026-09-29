import { describe, expect, it } from "vitest";
import {
  labelPremiProvvigioniCriterioData,
  periodoConCriterioLabel,
  resolvePremiProvvigioniDateColumn,
} from "@/lib/premiProvvigioni/criterioData";

describe("premiProvvigioni criterioData", () => {
  it("mappa i quattro criteri alle colonne vista", () => {
    expect(resolvePremiProvvigioniDateColumn("cassa")).toBe("data_messa_cassa");
    expect(resolvePremiProvvigioniDateColumn("competenza")).toBe("data_competenza");
    expect(resolvePremiProvvigioniDateColumn("effetto")).toBe("durata_da");
    expect(resolvePremiProvvigioniDateColumn("scadenza")).toBe("garanzia_a");
  });

  it("etichette UI in italiano", () => {
    expect(labelPremiProvvigioniCriterioData("effetto")).toBe("Data effetto");
    expect(labelPremiProvvigioniCriterioData("scadenza")).toBe("Scadenza");
  });

  it("periodoConCriterioLabel include criterio", () => {
    expect(periodoConCriterioLabel("Tutto il periodo", "competenza")).toContain("competenza");
  });
});
