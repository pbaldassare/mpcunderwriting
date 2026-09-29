import { describe, expect, it } from "vitest";
import { TITOLI_DA_INCASSARE_COLUMNS } from "@/lib/titoliDaIncassare/columns";
import { mapTitoloDaIncassareRow } from "@/lib/titoliDaIncassare/mapRow";
import { buildPivotCommentary, pivotPerCompagnia, totaliPivot } from "@/lib/titoliDaIncassare/pivot";

describe("titoliDaIncassare", () => {
  it("esclude colonne codice legacy (33 campi descrittivi)", () => {
    expect(TITOLI_DA_INCASSARE_COLUMNS).toHaveLength(33);
    const headers = TITOLI_DA_INCASSARE_COLUMNS.map((c) => c.header).join("|");
    expect(headers).not.toMatch(/CdClie|CdAE|CdComp|CdRamo|rg|St/);
    expect(headers).toContain("Cliente");
    expect(headers).toContain("Competenza");
  });

  it("mappa riga con etichette chiare", () => {
    const row = mapTitoloDaIncassareRow({
      id: "1",
      numero_titolo: "0332440753",
      cliente_nome_display: "FAST POLICECE SRL",
      compagnia_nome: "ASSISUD",
      ramo_nome: "R. C. AUTO",
      data_competenza: "2026-06-01",
      garanzia_da: "2026-06-01",
      garanzia_a: "2027-06-01",
      premio_lordo: 1862.45,
      provvigioni_quietanza: 120.51,
      sostituisce_polizza: "madre-id",
      tacito_rinnovo: "R",
      numero_rata: 1,
      numero_rate_totali: 1,
    });
    expect(row.cliente).toBe("FAST POLICECE SRL");
    expect(row.competenza).toBe("01/06/2026");
    expect(row.tipoTitolo).toBe("PQ");
    expect(row.premio).toBe(1862.45);
  });

  it("genera pivot e commento", () => {
    const rows = [
      mapTitoloDaIncassareRow({
        id: "1",
        numero_titolo: "A",
        cliente_nome_display: "C1",
        compagnia_nome: "Comp A",
        ramo_nome: "RCA",
        premio_lordo: 100,
        provvigioni_quietanza: 10,
        sostituisce_polizza: "x",
      }),
      mapTitoloDaIncassareRow({
        id: "2",
        numero_titolo: "B",
        cliente_nome_display: "C2",
        compagnia_nome: "Comp A",
        ramo_nome: "RCA",
        premio_lordo: 50,
        provvigioni_quietanza: 5,
        sostituisce_polizza: "x",
      }),
    ];
    const pivot = pivotPerCompagnia(rows);
    expect(pivot[0].nTitoli).toBe(2);
    expect(totaliPivot(rows).totPremio).toBe(150);
    expect(buildPivotCommentary(rows, "giugno 2026")).toContain("Comp A");
  });
});
