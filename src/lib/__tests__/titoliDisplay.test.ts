import { describe, expect, it } from "vitest";
import {
  buildPolizzaOptionDetails,
  buildPolizzaSelectOption,
  formatPolizzaGaranzia,
  formatPolizzaOptionDescription,
  formatPolizzaPeriodo,
  formatPolizzaProdotto,
} from "@/lib/titoliDisplay";

const polizza = {
  id: "t1",
  numero_titolo: "1602/4177699",
  prodotto_nome: "RCT Enti pubblici",
  compagnia_diretta: { nome: "KRM UNDERWRITING SRL" },
  garanzia_da: "2026-12-01",
  garanzia_a: "2027-12-31",
  ramo: {
    descrizione: "RC Patrimonio",
    gruppo_ramo: { descrizione: "Responsabilità civile" },
  },
  premi_garanzia_polizza: [
    { garanzia: "RCT" },
    { garanzia: "RCO" },
    { garanzia: "RCT" },
  ],
};

describe("titoliDisplay polizza option", () => {
  it("preferisce il prodotto_nome e le garanzie da premi", () => {
    expect(formatPolizzaProdotto(polizza)).toBe("RCT Enti pubblici");
    expect(formatPolizzaGaranzia(polizza)).toBe("RCT, RCO");
    expect(formatPolizzaPeriodo(polizza)).toBe("01/12/2026 → 31/12/2027");
  });

  it("usa il ramo quando mancano i premi garanzia", () => {
    expect(formatPolizzaGaranzia({ ramo: polizza.ramo })).toBe("Responsabilità civile · RC Patrimonio");
    expect(formatPolizzaGaranzia({})).toBe("—");
  });

  it("compone descrizione e dettagli etichettati per la tendina", () => {
    expect(formatPolizzaOptionDescription(polizza)).toBe(
      "RCT Enti pubblici · RCT, RCO · KRM UNDERWRITING SRL",
    );
    expect(buildPolizzaOptionDetails(polizza)).toEqual([
      { label: "Prodotto", value: "RCT Enti pubblici" },
      { label: "Garanzia", value: "RCT, RCO" },
      { label: "Compagnia", value: "KRM UNDERWRITING SRL" },
      { label: "Periodo", value: "01/12/2026 → 31/12/2027" },
    ]);
    const option = buildPolizzaSelectOption(polizza);
    expect(option.label).toBe("1602/4177699");
    expect(option.details).toHaveLength(4);
    expect(option.searchText).toContain("RCT Enti pubblici");
    expect(option.searchText).toContain("RCO");
  });
});
