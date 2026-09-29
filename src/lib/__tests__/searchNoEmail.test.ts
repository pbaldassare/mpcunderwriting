import { describe, expect, it } from "vitest";
import {
  buildIlikeOr,
  IDGUARD_CLIENTI_SEARCH_COLUMNS,
  isEmailLikeSearchTerm,
  matchesAnagraficaListSearch,
  matchesProfileNameSearch,
  matchesSearchFields,
  PROFILES_SEARCH_COLUMNS,
  PROSPECT_SEARCH_COLUMNS,
  RICHIESTE_QUIETANZA_SEARCH_COLUMNS,
  sanitizeSearchTerm,
} from "../searchNoEmail";

describe("searchNoEmail", () => {
  it("sanifica caratteri pericolosi PostgREST", () => {
    expect(sanitizeSearchTerm("  mario,(rossi) 50% ")).toBe("mario rossi 50");
  });

  it("OR ilike non include mai colonne email/pec/mail", () => {
    const all = [
      ...PROSPECT_SEARCH_COLUMNS,
      ...PROFILES_SEARCH_COLUMNS,
      ...IDGUARD_CLIENTI_SEARCH_COLUMNS,
      ...RICHIESTE_QUIETANZA_SEARCH_COLUMNS,
    ];
    expect(all.some((c) => /email|pec|^mail/i.test(c))).toBe(false);
    expect(buildIlikeOr([...PROSPECT_SEARCH_COLUMNS], "mario@test.it")).toBe(
      "nome.ilike.%mario@test.it%,cognome.ilike.%mario@test.it%,ragione_sociale.ilike.%mario@test.it%,codice_fiscale.ilike.%mario@test.it%,partita_iva.ilike.%mario@test.it%",
    );
    expect(buildIlikeOr([...PROFILES_SEARCH_COLUMNS], "anna")).toBe(
      "nome.ilike.%anna%,cognome.ilike.%anna%",
    );
    expect(buildIlikeOr([...RICHIESTE_QUIETANZA_SEARCH_COLUMNS], "quietanza")).toBe(
      "oggetto.ilike.%quietanza%,compagnia_nome.ilike.%quietanza%",
    );
    expect(buildIlikeOr(["nome"], "   ")).toBeNull();
  });

  it("non matcha un indirizzo email se non compare in nome/codice", () => {
    const item = {
      codice: "10009500",
      cognome: "ABATANGELO",
      nome: "COSIMO DAMIANO",
      ragione_sociale: null,
    };
    expect(matchesAnagraficaListSearch(item, "abatangelo")).toBe(true);
    expect(matchesAnagraficaListSearch(item, "10009500")).toBe(true);
    expect(matchesAnagraficaListSearch(item, "cosimo@agenzia.it")).toBe(false);
    expect(matchesSearchFields("cosimo@agenzia.it", [item.nome, item.cognome, "cosimo@agenzia.it"])).toBe(true);
    expect(matchesSearchFields("cosimo@agenzia.it", [item.nome, item.cognome])).toBe(false);
  });

  it("profili: nome sì, email no", () => {
    const u = { nome: "Anna", cognome: "Bianchi", ruolo: "ufficio" };
    expect(matchesProfileNameSearch(u, "bianchi")).toBe(true);
    expect(matchesProfileNameSearch(u, "anna.bianchi@cbnet.it")).toBe(false);
    expect(isEmailLikeSearchTerm("anna.bianchi@cbnet.it")).toBe(true);
    expect(isEmailLikeSearchTerm("Anna Bianchi")).toBe(false);
  });
});
