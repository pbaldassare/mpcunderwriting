import { describe, expect, it } from "vitest";
import {
  KEYWORD_BROKERAGGIO,
  KEYWORD_SERVIZI,
  frasiKeywordRicerca,
  includeBrokeraggio,
  includeServiziAssicurativi,
  keywordDaTesto,
  labelKeywordRicerca,
  matchesFiltroKeyword,
  parseKeywordRicerca,
} from "@/lib/bandiKeywords";

describe("parseKeywordRicerca", () => {
  it("default brokeraggio, accetta servizi o entrambe", () => {
    expect(parseKeywordRicerca(undefined)).toBe("brokeraggio");
    expect(parseKeywordRicerca("servizi")).toBe("servizi");
    expect(parseKeywordRicerca("entrambe")).toBe("entrambe");
  });
});

describe("frasiKeywordRicerca", () => {
  it("default solo brokeraggio, oppure l'altra, oppure entrambe", () => {
    expect(frasiKeywordRicerca("brokeraggio")).toEqual([KEYWORD_BROKERAGGIO]);
    expect(frasiKeywordRicerca("servizi")).toEqual([KEYWORD_SERVIZI]);
    expect(frasiKeywordRicerca("entrambe")).toEqual([KEYWORD_BROKERAGGIO, KEYWORD_SERVIZI]);
  });
});

describe("include flags", () => {
  it("entrambe include le due keyword", () => {
    expect(includeBrokeraggio("brokeraggio")).toBe(true);
    expect(includeServiziAssicurativi("brokeraggio")).toBe(false);
    expect(includeBrokeraggio("servizi")).toBe(false);
    expect(includeServiziAssicurativi("servizi")).toBe(true);
    expect(includeBrokeraggio("entrambe")).toBe(true);
    expect(includeServiziAssicurativi("entrambe")).toBe(true);
  });
});

describe("etichette e classificazione", () => {
  it("etichetta la ricerca e classifica il testo", () => {
    expect(labelKeywordRicerca("brokeraggio")).toBe(KEYWORD_BROKERAGGIO);
    expect(labelKeywordRicerca("entrambe")).toContain("servizi");
    expect(keywordDaTesto("Affidamento servizio di brokeraggio assicurativo")).toBe(KEYWORD_BROKERAGGIO);
    expect(keywordDaTesto("Servizi assicurativi RCA flotta")).toBe(KEYWORD_SERVIZI);
  });
});

describe("matchesFiltroKeyword", () => {
  it("filtra l'archivio per keyword salvata o titolo", () => {
    expect(matchesFiltroKeyword(KEYWORD_BROKERAGGIO, "x", "tutte")).toBe(true);
    expect(matchesFiltroKeyword(KEYWORD_BROKERAGGIO, "x", "brokeraggio")).toBe(true);
    expect(matchesFiltroKeyword(KEYWORD_SERVIZI, "Servizi assicurativi", "servizi")).toBe(true);
    expect(matchesFiltroKeyword(KEYWORD_BROKERAGGIO, "brokeraggio", "servizi")).toBe(false);
  });
});
