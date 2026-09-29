import { describe, expect, it } from "vitest";
import { ecClienteDefaultSelected, ecClienteTitoloEligible } from "@/lib/ecClienteTitoli";

describe("ecClienteTitoli", () => {
  const today = "2026-06-25";

  it("esclude polizza madre e quietanze future", () => {
    expect(ecClienteTitoloEligible({
      sostituisce_polizza: null,
      data_messa_cassa: null,
      garanzia_da: "2026-05-31",
      stato: "attivo",
    }, today)).toBe(false);

    expect(ecClienteTitoloEligible({
      sostituisce_polizza: "2026/10/1",
      data_messa_cassa: null,
      garanzia_da: "2027-06-01",
      stato: "attivo",
    }, today)).toBe(false);
  });

  it("include quietanza non incassata con garanzia già decorso", () => {
    const row = {
      sostituisce_polizza: "2026/10/1",
      data_messa_cassa: null,
      garanzia_da: "2026-05-31",
      stato: "attivo",
    };
    expect(ecClienteTitoloEligible(row, today)).toBe(true);
    expect(ecClienteDefaultSelected(row, today)).toBe(true);
  });

  it("esclude quietanza già messa a cassa", () => {
    expect(ecClienteTitoloEligible({
      sostituisce_polizza: "2026/10/1",
      data_messa_cassa: "2026-06-01",
      garanzia_da: "2026-05-31",
      stato: "incassato",
    }, today)).toBe(false);
  });
});
