import { describe, expect, it } from "vitest";
import {
  filterPolizzeByTacito,
  groupPolizzeTacitoBySede,
  mapTitoloToPolizzaTacito,
  tacitoRinnovoLabel,
  type PolizzaTacitoRinnovoRow,
} from "@/lib/polizzeTacitoRinnovo";

const row = (partial: Partial<PolizzaTacitoRinnovoRow>): PolizzaTacitoRinnovoRow => ({
  titoloId: partial.titoloId || "t1",
  numeroPolizza: partial.numeroPolizza || "P1",
  clienteNome: partial.clienteNome || "Cliente",
  agenziaNome: partial.agenziaNome || "Agenzia",
  compagniaId: partial.compagniaId ?? "c1",
  ufficioId: partial.ufficioId ?? "u1",
  ufficioNome: partial.ufficioNome || "Sede A",
  garanziaDa: partial.garanziaDa ?? "2026-01-01",
  garanziaA: partial.garanziaA ?? "2026-09-21",
  tacitoRinnovo: partial.tacitoRinnovo === undefined ? true : partial.tacitoRinnovo,
  stato: partial.stato ?? "attivo",
});

describe("polizzeTacitoRinnovo", () => {
  it("etichetta tacito sì/no/vuoto", () => {
    expect(tacitoRinnovoLabel(true)).toBe("Sì");
    expect(tacitoRinnovoLabel(false)).toBe("No");
    expect(tacitoRinnovoLabel(null)).toBe("—");
  });

  it("mappa la riga dalla vista portafoglio", () => {
    const mapped = mapTitoloToPolizzaTacito({
      id: "tit-1",
      numero_titolo: "M168509899",
      cliente_nome_display: "COMUNE CAMPOSAMPIERO",
      compagnia_id: "c1",
      compagnia_nome: "Leader Assicurazioni",
      garanzia_da: "2026-07-01",
      garanzia_a: "2027-06-30",
      tacito_rinnovo: true,
      ufficio_id: "uff-sandona",
      nome_ufficio: "SEDE SAN DONA' DI PIAVE",
      ufficio_nome: null,
      stato: "attivo",
    });
    expect(mapped?.numeroPolizza).toBe("M168509899");
    expect(mapped?.clienteNome).toBe("COMUNE CAMPOSAMPIERO");
    expect(mapped?.agenziaNome).toBe("Leader Assicurazioni");
    expect(mapped?.tacitoRinnovo).toBe(true);
    expect(mapped?.ufficioNome).toBe("SEDE SAN DONA' DI PIAVE");
  });

  it("scarta titoli senza id", () => {
    expect(mapTitoloToPolizzaTacito({
      id: null,
      numero_titolo: "X",
      cliente_nome_display: "Y",
      compagnia_id: null,
      compagnia_nome: null,
      garanzia_da: null,
      garanzia_a: null,
      tacito_rinnovo: false,
      ufficio_id: null,
      nome_ufficio: null,
      ufficio_nome: null,
      stato: "attivo",
    })).toBeNull();
  });

  it("filtra e raggruppa per sede", () => {
    const rows = [
      row({ titoloId: "1", tacitoRinnovo: true, ufficioId: "b", ufficioNome: "Belluno" }),
      row({ titoloId: "2", tacitoRinnovo: false, ufficioId: "s", ufficioNome: "Sandonà" }),
      row({ titoloId: "3", tacitoRinnovo: true, ufficioId: "s", ufficioNome: "Sandonà" }),
      row({ titoloId: "4", tacitoRinnovo: null, ufficioId: "s", ufficioNome: "Sandonà" }),
    ];
    expect(filterPolizzeByTacito(rows, "si")).toHaveLength(2);
    expect(filterPolizzeByTacito(rows, "no")).toHaveLength(1);
    expect(filterPolizzeByTacito(rows, "tutti")).toHaveLength(4);
    const gruppi = groupPolizzeTacitoBySede(rows);
    expect(gruppi.map((g) => g.sedeNome)).toEqual(["Belluno", "Sandonà"]);
    expect(gruppi[1].rows).toHaveLength(3);
  });
});
