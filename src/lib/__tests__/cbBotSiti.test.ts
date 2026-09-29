import { describe, expect, it } from "vitest";
import { isCbBotUrlAllowed, parseCbBotSitoInput } from "@/lib/cbBotSiti";
import { CB_BOT_SITI_CATALOGO, missingCatalogoSiti } from "@/lib/cbBotSitiCatalogo";

describe("parseCbBotSitoInput", () => {
  it("accetta dominio nudo e URL completi", () => {
    expect(parseCbBotSitoInput("ivass.it")).toEqual({
      ok: true,
      url: "https://ivass.it",
      dominio: "ivass.it",
    });
    expect(parseCbBotSitoInput("https://www.ania.it/normativa")).toEqual({
      ok: true,
      url: "https://www.ania.it/normativa",
      dominio: "ania.it",
    });
  });

  it("rifiuta input vuoto, spazi, IP e localhost", () => {
    expect(parseCbBotSitoInput("").ok).toBe(false);
    expect(parseCbBotSitoInput("ivass .it").ok).toBe(false);
    expect(parseCbBotSitoInput("127.0.0.1").ok).toBe(false);
    expect(parseCbBotSitoInput("localhost").ok).toBe(false);
  });
});

describe("isCbBotUrlAllowed", () => {
  const domains = ["ivass.it", "ania.it"];

  it("accetta host e sottodomini, rifiuta altri siti", () => {
    expect(isCbBotUrlAllowed("https://www.ivass.it/provvedimenti/x", domains)).toBe(true);
    expect(isCbBotUrlAllowed("https://portale.ivass.it/a", domains)).toBe(true);
    expect(isCbBotUrlAllowed("https://example.com", domains)).toBe(false);
    expect(isCbBotUrlAllowed("https://not-ivass.it", domains)).toBe(false);
  });

  it("senza domini non autorizza nulla", () => {
    expect(isCbBotUrlAllowed("https://ivass.it", [])).toBe(false);
  });
});

describe("CB_BOT_SITI_CATALOGO", () => {
  it("ha domini univoci e manca solo ciò che non è già in elenco", () => {
    const domains = CB_BOT_SITI_CATALOGO.map((s) => s.dominio);
    expect(new Set(domains).size).toBe(domains.length);
    expect(missingCatalogoSiti(["ania.it", "generali.it"]).every((s) => s.dominio !== "ania.it")).toBe(true);
    expect(missingCatalogoSiti([]).length).toBe(CB_BOT_SITI_CATALOGO.length);
  });
});
