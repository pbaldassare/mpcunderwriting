import { describe, expect, it } from "vitest";
import {
  buildAgenzieSearchOr,
  buildCompagnieAssicurativeSearchOr,
  filterAgenzieList,
  filterCompagnieAssicurativeList,
  matchesAgenziaSearch,
  matchesCompagniaAssicurativaSearch,
} from "../compagnieSearch";

const simple = {
  nome: "+SIMPLE ITALIA AGENCY",
  nome_sede: "Milano Centro",
  codice: "B0824",
  comune: "Milano",
  tipo: "agenzia",
  gruppo_compagnia_id: "g1",
};

describe("matchesAgenziaSearch", () => {
  it("senza testo restituisce tutte", () => {
    expect(matchesAgenziaSearch(simple, "")).toBe(true);
    expect(matchesAgenziaSearch(simple, "   ")).toBe(true);
  });

  it("un solo termine cerca nome, codice e sede (OR)", () => {
    expect(matchesAgenziaSearch(simple, "simple")).toBe(true);
    expect(matchesAgenziaSearch(simple, "B0824")).toBe(true);
    expect(matchesAgenziaSearch(simple, "b082")).toBe(true);
    expect(matchesAgenziaSearch(simple, "milano centro")).toBe(true);
    expect(matchesAgenziaSearch(simple, "milano")).toBe(true);
    expect(matchesAgenziaSearch(simple, "inesistente")).toBe(false);
  });
});

describe("filterAgenzieList", () => {
  const rows = [
    simple,
    {
      nome: "002 SRL",
      nome_sede: "Roma",
      codice: "FXA0011",
      comune: "Roma",
      tipo: "broker",
      gruppo_compagnia_id: "g2",
    },
  ];

  it("filtra per search unico e tiene il tipo come filtro non testuale", () => {
    expect(filterAgenzieList(rows, { search: "002" })).toHaveLength(1);
    expect(filterAgenzieList(rows, { search: "fxa" })).toHaveLength(1);
    expect(filterAgenzieList(rows, { search: "roma" })).toHaveLength(1);
    expect(filterAgenzieList(rows, { search: "simple", tipo: "broker" })).toHaveLength(0);
    expect(filterAgenzieList(rows, { search: "", tipo: "broker" })).toHaveLength(1);
  });

  it("onlyPluri usa la mappa gruppi, non un secondo search", () => {
    const gruppiMap = { g1: { is_pluri: true }, g2: { is_pluri: false } };
    expect(filterAgenzieList(rows, { onlyPluri: true, gruppiMap })).toHaveLength(1);
    expect(filterAgenzieList(rows, { onlyPluri: true, gruppiMap })[0].codice).toBe("B0824");
  });
});

describe("matchesCompagniaAssicurativaSearch", () => {
  const gruppo = { descrizione: "Gruppo GENERALI", codice: "GEN" };

  it("un solo termine su nome/descrizione o codice", () => {
    expect(matchesCompagniaAssicurativaSearch(gruppo, "generali")).toBe(true);
    expect(matchesCompagniaAssicurativaSearch(gruppo, "gen")).toBe(true);
    expect(matchesCompagniaAssicurativaSearch(gruppo, "AXA")).toBe(false);
  });
});

describe("filterCompagnieAssicurativeList", () => {
  const gruppi = [
    { descrizione: "Gruppo ALLIANZ", codice: "ALL" },
    { descrizione: "Gruppo GENERALI", codice: "GEN" },
  ];

  it("un solo search, nessun campo codice distinto", () => {
    expect(filterCompagnieAssicurativeList(gruppi, "all")).toHaveLength(1);
    expect(filterCompagnieAssicurativeList(gruppi, "GEN")).toHaveLength(1);
    expect(filterCompagnieAssicurativeList(gruppi, "")).toHaveLength(2);
  });
});

describe("build*SearchOr", () => {
  it("un solo parametro OR, null se vuoto", () => {
    expect(buildAgenzieSearchOr("")).toBeNull();
    expect(buildAgenzieSearchOr("  MED  ")).toBe(
      "nome.ilike.%med%,nome_sede.ilike.%med%,codice.ilike.%med%,comune.ilike.%med%",
    );
    expect(buildCompagnieAssicurativeSearchOr("GEN")).toBe(
      "descrizione.ilike.%gen%,codice.ilike.%gen%",
    );
  });
});
