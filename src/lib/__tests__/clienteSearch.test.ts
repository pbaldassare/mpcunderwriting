import { describe, expect, it } from "vitest";
import {
  clienteSearchBlob,
  matchesClienteSearch,
  parseSearchClientiRankedPayload,
  sanitizeClienteSearchTerm,
  toClienteSearchOption,
  type ClienteSearchRow,
} from "../clienteSearch";

const abatangelo: ClienteSearchRow = {
  id: "1",
  cognome: "ABATANGELO",
  nome: "COSIMO DAMIANO",
  tipo_cliente: "privato",
  indirizzo_residenza: "Via Dante 10",
  citta_residenza: "Bari",
  cap_residenza: "70121",
};

const conNominativo: ClienteSearchRow = {
  id: "2",
  ragione_sociale: "ACME SRL",
  tipo_cliente: "azienda",
  indirizzo_sede: "Corso Italia 5",
  citta_sede: "Milano",
  nominativi: [{ nome: "MARCO", cognome: "DE GOBBI" }],
};

describe("clienteSearch", () => {
  it("sanifica caratteri pericolosi PostgREST", () => {
    expect(sanitizeClienteSearchTerm("  varese,(ig) 50% ")).toBe("varese ig 50");
  });

  it("trova clienti con più nomi in qualsiasi ordine", () => {
    expect(matchesClienteSearch(abatangelo, "cosimo damiano")).toBe(true);
    expect(matchesClienteSearch(abatangelo, "damiano abatangelo")).toBe(true);
    expect(matchesClienteSearch(abatangelo, "abatangelo cosimo")).toBe(true);
    expect(matchesClienteSearch(abatangelo, "rossi")).toBe(false);
  });

  it("trova per indirizzo e città", () => {
    expect(matchesClienteSearch(abatangelo, "via dante")).toBe(true);
    expect(matchesClienteSearch(abatangelo, "dante bari")).toBe(true);
    expect(matchesClienteSearch(abatangelo, "70121")).toBe(true);
    expect(matchesClienteSearch(abatangelo, "via verdi")).toBe(false);
  });

  it("trova per nominativo aggiuntivo + indirizzo sede", () => {
    expect(matchesClienteSearch(conNominativo, "de gobbi")).toBe(true);
    expect(matchesClienteSearch(conNominativo, "marco corso italia")).toBe(true);
    expect(clienteSearchBlob(conNominativo)).toContain("de gobbi");
  });

  it("parse payload RPC jsonb", () => {
    expect(parseSearchClientiRankedPayload({ data: [abatangelo], total_count: 1 })).toEqual([abatangelo]);
    expect(parseSearchClientiRankedPayload([abatangelo])).toEqual([abatangelo]);
    expect(parseSearchClientiRankedPayload(null)).toEqual([]);
  });

  it("opzione dropdown include indirizzo nel searchText", () => {
    const opt = toClienteSearchOption(abatangelo);
    expect(opt.label).toBe("ABATANGELO COSIMO DAMIANO");
    expect(opt.description).toContain("Via Dante 10");
    expect(opt.searchText).toContain("via dante 10");
  });

  it("non matcha email/pec anche se presenti in anagrafica", () => {
    const conEmail: ClienteSearchRow = {
      ...abatangelo,
      email: "cosimo.damiano@agenzia.it",
      pec: "abatangelo@pec.it",
    };
    expect(matchesClienteSearch(conEmail, "cosimo.damiano@agenzia.it")).toBe(false);
    expect(matchesClienteSearch(conEmail, "abatangelo@pec.it")).toBe(false);
    expect(clienteSearchBlob(conEmail)).not.toContain("@");
    expect(matchesClienteSearch(conEmail, "abatangelo")).toBe(true);
    expect(matchesClienteSearch(conEmail, "BTNCMD635P09F100")).toBe(false);
  });

  it("trova ancora per CF e P.IVA", () => {
    const fiscale: ClienteSearchRow = {
      id: "3",
      cognome: "ABATANGELO",
      nome: "COSIMO DAMIANO",
      codice_fiscale: "BTNCMD635P09F100",
      partita_iva: "01234567890",
      email: "x@y.it",
    };
    expect(matchesClienteSearch(fiscale, "BTNCMD635P09F100")).toBe(true);
    expect(matchesClienteSearch(fiscale, "01234567890")).toBe(true);
    expect(matchesClienteSearch(fiscale, "x@y.it")).toBe(false);
  });
});
