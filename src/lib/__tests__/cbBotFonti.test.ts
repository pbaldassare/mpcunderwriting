import { describe, expect, it } from "vitest";
import {
  extractWebFonti,
  normalizeFonteUrl,
  pickFontiForQuery,
  scoreFonteVsQuery,
  assertFonteSuSitiAutorizzati,
} from "@/lib/cbBotFonti";

describe("normalizeFonteUrl", () => {
  it("normalizza host, https e slash finale", () => {
    expect(normalizeFonteUrl("https://www.IVASS.it/provvedimenti/128/")).toBe(
      "https://ivass.it/provvedimenti/128",
    );
  });

  it("rifiuta input vuoto", () => {
    expect(normalizeFonteUrl("")).toBeNull();
  });
});

describe("extractWebFonti", () => {
  it("prende solo hit web con url, deduplica", () => {
    expect(
      extractWebFonti([
        { title: "A", url: "https://www.ivass.it/a/", snippet: "x" },
        { title: "A2", url: "https://ivass.it/a" },
        { nome_prodotto: "CGA", compagnia: "AXA" },
      ]),
    ).toEqual([{ title: "A", url: "https://ivass.it/a", snippet: "x" }]);
  });
});

describe("pickFontiForQuery", () => {
  const fonti = [
    { titolo: "Provvedimento IVASS distribuzione", snippet: "regolamento 40", url: "https://ivass.it/1" },
    { titolo: "ANIA raccolta premi", snippet: "statistiche 2024", url: "https://ania.it/2" },
    { titolo: "Normattiva codice civile", snippet: null, url: "https://normattiva.it/3" },
    { titolo: "IVASS consultazione", snippet: "distribuzione riassicurativa", url: "https://ivass.it/4" },
    { titolo: "Cyber PMI", snippet: "copertura", url: "https://ania.it/5" },
    { titolo: "Altro", snippet: "nessun match", url: "https://ivass.it/6" },
  ];

  it("con poche fonti le restituisce tutte", () => {
    expect(pickFontiForQuery(fonti.slice(0, 3), "distribuzione").length).toBe(3);
  });

  it("con molte fonti tiene solo l'overlap", () => {
    const picked = pickFontiForQuery(fonti, "provvedimenti IVASS distribuzione");
    expect(picked.map((f) => f.url)).toContain("https://ivass.it/1");
    expect(picked.map((f) => f.url)).not.toContain("https://ania.it/5");
  });
});

describe("scoreFonteVsQuery", () => {
  it("conta i token presenti", () => {
    expect(
      scoreFonteVsQuery(
        { titolo: "IVASS distribuzione", snippet: "provvedimento", url: "https://ivass.it/x" },
        "provvedimenti IVASS su distribuzione",
      ),
    ).toBeGreaterThan(0);
  });
});

describe("assertFonteSuSitiAutorizzati", () => {
  it("accetta solo URL sui domini autorizzati", () => {
    expect(assertFonteSuSitiAutorizzati("https://www.ivass.it/p/1", ["ivass.it"]).ok).toBe(true);
    expect(assertFonteSuSitiAutorizzati("https://example.com/x", ["ivass.it"]).ok).toBe(false);
  });
});
