import { describe, expect, it } from "vitest";
import {
  classifyPremio,
  inDateRange,
  isApertoDaIncassare,
  labelTipoDocumento,
  moraStatusOf,
  mapPremiScopertiRow,
} from "@/lib/premiScopertiGarantiti";

describe("premiScopertiGarantiti", () => {
  it("classifica garantito da copertura con fondi in attesa (anche con messa a cassa)", () => {
    expect(
      classifyPremio({
        id: "1",
        sostituisce_polizza: "madre",
        conferimento_gestito: true,
        tipo_pagamento: "garantito",
        data_copertura: "2026-01-10",
        data_messa_cassa: "2026-01-10",
        fondi_ricevuti: false,
        stato: "attivo",
      }),
    ).toBe("garantito");
  });

  it("classifica scoperto se non in copertura garantita", () => {
    expect(
      classifyPremio({
        id: "2",
        sostituisce_polizza: "madre",
        conferimento_gestito: false,
        data_copertura: null,
        data_messa_cassa: null,
        stato: "attivo",
      }),
    ).toBe("scoperto");
  });

  it("isApertoDaIncassare include garantito con data_messa_cassa", () => {
    expect(
      isApertoDaIncassare({
        id: "g",
        sostituisce_polizza: "madre",
        conferimento_gestito: true,
        tipo_pagamento: "garantito",
        data_copertura: "2026-01-10",
        data_messa_cassa: "2026-01-10",
        fondi_ricevuti: false,
        stato: "attivo",
      }),
    ).toBe(true);
    expect(
      isApertoDaIncassare({
        id: "paid",
        sostituisce_polizza: "madre",
        data_messa_cassa: "2026-01-10",
        conferimento_gestito: false,
        stato: "attivo",
      }),
    ).toBe(false);
  });

  it("labelTipoDocumento da flag appendice/quietanza", () => {
    expect(
      labelTipoDocumento({ id: "a", is_appendice_modifica: true, sostituisce_polizza: null }),
    ).toBe("Appendice");
    expect(
      labelTipoDocumento({ id: "q", sostituisce_polizza: "madre" }),
    ).toBe("Quietanza");
  });

  it("moraStatusOf e date range", () => {
    expect(moraStatusOf(null)).toBe("senza_limite");
    expect(moraStatusOf("2020-01-01", "2026-01-01")).toBe("scaduto");
    expect(moraStatusOf("2026-12-01", "2026-01-01")).toBe("in_corso");
    expect(inDateRange("2026-06-15", new Date("2026-06-01"), new Date("2026-06-30"))).toBe(true);
    expect(inDateRange(null, new Date("2026-06-01"), null)).toBe(false);
  });

  it("mapPremiScopertiRow espone sede e agenzia", () => {
    const row = mapPremiScopertiRow({
      id: "x",
      numero_titolo: "POL-1",
      premio_lordo: 100,
      sostituisce_polizza: "madre",
      clienti: { ragione_sociale: "ACME" },
      compagnia_diretta: { nome: "Agenzia X" },
      ramo: { descrizione: "Incendio", gruppo_ramo: { descrizione: "Danni" } },
      uffici: { nome_ufficio: "SEDE TEST" },
      data_messa_cassa: null,
      stato: "attivo",
    });
    expect(row.cliente).toBe("ACME");
    expect(row.agenzia).toBe("Agenzia X");
    expect(row.ramo).toBe("Danni / Incendio");
    expect(row.sede).toBe("SEDE TEST");
    expect(row.classificazione).toBe("scoperto");
  });
});
