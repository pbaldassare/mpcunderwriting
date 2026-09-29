import { describe, expect, it } from "vitest";
import {
  EMPTY_SINISTRI_FILTERS,
  applySinistriOrder,
  hasSinistriFilters,
  isRelatedSinistriSort,
  normalizeTargaFilter,
  paginateSortedIds,
  ramoSinistroIlikeTerms,
  sanitizePostgrestTerm,
  sinistriFilterChips,
  sinistriOrderClauses,
  sinistriRamoOrClause,
  sinistroClienteSortKey,
  sinistroPolizzaDisplay,
  sinistroPolizzaSortKey,
  sortSinistriRelatedRows,
  targaColumnOrClause,
  targaFilterVariants,
  targaOrClause,
  targaSinistriOrClause,
} from "@/lib/sinistriListSearch";

describe("sanitizePostgrestTerm", () => {
  it("toglie caratteri che rompono il filtro PostgREST", () => {
    expect(sanitizePostgrestTerm("  varese,(ig)  ")).toBe("varese ig");
    expect(sanitizePostgrestTerm("50%")).toBe("50");
  });
});

describe("sinistriFilterChips", () => {
  it("non emette chip se i filtri sono vuoti", () => {
    expect(sinistriFilterChips(EMPTY_SINISTRI_FILTERS)).toEqual([]);
    expect(hasSinistriFilters(EMPTY_SINISTRI_FILTERS)).toBe(false);
  });

  it("compone chip combinabili per cliente, controparte e tipo", () => {
    const chips = sinistriFilterChips({
      ...EMPTY_SINISTRI_FILTERS,
      clienteId: "c1",
      clienteLabel: "Comune di Varese",
      controparte: "Ignoti",
      tipo: "furto",
    }, "Furto");
    expect(chips.map((c) => c.label)).toEqual([
      "Cliente: Comune di Varese",
      "Controparte: Ignoti",
      "Tipo: Furto",
    ]);
    expect(hasSinistriFilters({
      ...EMPTY_SINISTRI_FILTERS,
      clienteId: "c1",
      clienteLabel: "Comune di Varese",
    })).toBe(true);
  });

  it("compone chip combinabili per accadimento, ramo e targa", () => {
    const chips = sinistriFilterChips({
      ...EMPTY_SINISTRI_FILTERS,
      eventoDa: "2026-01-01",
      eventoA: "2026-01-31",
      ramoId: "r1",
      ramoLabel: "RC Auto · RCA",
      targa: "AB 123 CD",
    });
    expect(chips.map((c) => c.label)).toEqual([
      "Accadimento: 2026-01-01 → 2026-01-31",
      "Ramo: RC Auto · RCA",
      "Targa: AB 123 CD",
    ]);
    expect(chips.map((c) => c.key)).toEqual(["evento", "ramo", "targa"]);
  });
});

describe("targa / ramo filter mapping", () => {
  it("normalizza spazi sulla targa e produce varianti ilike", () => {
    expect(normalizeTargaFilter("  AB 123 CD  ")).toBe("AB123CD");
    expect(normalizeTargaFilter("ab-123-cd")).toBe("ab123cd");
    expect(targaFilterVariants("  AB 123 CD  ")).toEqual(["AB 123 CD", "AB123CD", "AB-123-CD"]);
    expect(targaOrClause("ab 123 cd")).toBe(
      "targa_veicolo.ilike.%ab 123 cd%,targa_veicolo.ilike.%ab123cd%,targa_veicolo.ilike.%ab-123-cd%",
    );
    expect(targaColumnOrClause("targa", "AB123CD")).toContain("targa.ilike.%AB123CD%");
    expect(targaSinistriOrClause("AB123CD", ["t1", "t2"])).toContain("titolo_id.in.(t1,t2)");
    expect(targaOrClause("   ")).toBeNull();
    expect(targaSinistriOrClause("   ", [])).toBeNull();
  });

  it("estrae termini ilike da ramo catalogo + testo libero import", () => {
    expect(ramoSinistroIlikeTerms({
      label: "RC Auto · RCA",
      descrizione: "RCA",
      codice: "10",
      gruppo: "RC Auto",
    })).toEqual(["RC Auto · RCA", "RC Auto", "RCA", "10"]);
    expect(ramoSinistroIlikeTerms({ label: "Furto" })).toEqual(["Furto"]);
  });

  it("OR ramo_sinistro ilike + titoli con ramo_id", () => {
    const clause = sinistriRamoOrClause(
      { label: "RCA", descrizione: "RCA" },
      ["t1", "t2"],
    );
    expect(clause).toBe("ramo_sinistro.ilike.%RCA%,titolo_id.in.(t1,t2)");
    expect(sinistriRamoOrClause({}, [])).toBeNull();
  });
});

describe("sinistriOrderClauses", () => {
  it("mappa Data accadimento su sinistri.data_evento", () => {
    expect(sinistriOrderClauses("data_evento", "desc")).toEqual([
      { column: "data_evento", ascending: false, nullsFirst: false },
    ]);
  });

  it("ordina Cliente sulla relazione clienti (ragione sociale / cognome / nome)", () => {
    expect(sinistriOrderClauses("cliente", "asc")).toEqual([
      { column: "clienti(ragione_sociale)", ascending: true, nullsFirst: false },
      { column: "clienti(cognome)", ascending: true, nullsFirst: false },
      { column: "clienti(nome)", ascending: true, nullsFirst: false },
    ]);
    expect(isRelatedSinistriSort("cliente")).toBe(true);
  });

  it("ordina Polizza su titoli.numero_titolo e sinistri.numero_polizza", () => {
    expect(sinistriOrderClauses("polizza", "desc")).toEqual([
      { column: "titoli(numero_titolo)", ascending: false, nullsFirst: false },
      { column: "numero_polizza", ascending: false, nullsFirst: false },
    ]);
    expect(isRelatedSinistriSort("polizza")).toBe(true);
  });

  it("lascia le colonne locali come campo DB", () => {
    expect(sinistriOrderClauses("numero_sinistro", "asc")).toEqual([
      { column: "numero_sinistro", ascending: true },
    ]);
    expect(isRelatedSinistriSort("numero_sinistro")).toBe(false);
  });

  it("applySinistriOrder applica le clause in sequenza", () => {
    const calls: Array<{ column: string; ascending?: boolean; nullsFirst?: boolean }> = [];
    const q = {
      order(column: string, opts?: { ascending?: boolean; nullsFirst?: boolean }) {
        calls.push({ column, ...opts });
        return this;
      },
    };
    applySinistriOrder(q, "cliente", "desc");
    expect(calls.map((c) => c.column)).toEqual([
      "clienti(ragione_sociale)",
      "clienti(cognome)",
      "clienti(nome)",
    ]);
    expect(calls.every((c) => c.ascending === false && c.nullsFirst === false)).toBe(true);
  });
});

describe("sinistro sort keys / display", () => {
  it("cliente: azienda da ragione sociale, privato da cognome+nome, vuoto → chiave vuota", () => {
    expect(sinistroClienteSortKey({ tipo_cliente: "azienda", ragione_sociale: "ATMRC S.r.l." }))
      .toBe("atmrc s.r.l.");
    expect(sinistroClienteSortKey({ tipo_cliente: "privato", cognome: "Rossi", nome: "Mario" }))
      .toBe("rossi mario");
    expect(sinistroClienteSortKey(null)).toBe("");
  });

  it("polizza: titoli.numero_titolo se non terzi, altrimenti numero_polizza", () => {
    expect(sinistroPolizzaDisplay({
      sinistro_terzi: false,
      numero_polizza: "IGNORAMI",
      titoli: { numero_titolo: "61314025566" },
    })).toBe("61314025566");
    expect(sinistroPolizzaDisplay({
      sinistro_terzi: true,
      numero_polizza: "TERZI-99",
      titoli: { numero_titolo: "61314025566" },
    })).toBe("TERZI-99");
    expect(sinistroPolizzaDisplay({ sinistro_terzi: false, titoli: null })).toBe("—");
    expect(sinistroPolizzaSortKey({ sinistro_terzi: false, titoli: { numero_titolo: "AB-10" } }))
      .toBe("ab-10");
  });

  it("sortSinistriRelatedRows + paginateSortedIds rispettano asc/desc e la pagina", () => {
    const rows = [
      { id: "2", clienti: { tipo_cliente: "azienda", ragione_sociale: "Zeta Spa" } },
      { id: "1", clienti: { tipo_cliente: "azienda", ragione_sociale: "Alfa Srl" } },
      { id: "3", clienti: { tipo_cliente: "azienda", ragione_sociale: "Beta Snc" } },
    ];
    const asc = sortSinistriRelatedRows(rows, "cliente", "asc").map((r) => r.id);
    const desc = sortSinistriRelatedRows(rows, "cliente", "desc").map((r) => r.id);
    expect(asc).toEqual(["1", "3", "2"]);
    expect(desc).toEqual(["2", "3", "1"]);
    expect(paginateSortedIds(asc, 0, 1)).toEqual(["1", "3"]);
    expect(paginateSortedIds(asc, 2, 10)).toEqual(["2"]);
  });
});
