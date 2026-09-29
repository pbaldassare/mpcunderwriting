import { describe, expect, it } from "vitest";
import {
  matchKnowHow,
  normalizeKnowHowDomanda,
  pairUserAssistant,
  scoreKnowHow,
} from "@/lib/cbBotKnowHow";

describe("normalizeKnowHowDomanda", () => {
  it("toglie stopword e accenti", () => {
    expect(normalizeKnowHowDomanda("Come funziona la copertura cyber per le PMI?")).toBe(
      "copertura cyber pmi",
    );
  });
});

describe("scoreKnowHow / matchKnowHow", () => {
  const items = [
    {
      id: "1",
      domanda: "Come funziona la copertura cyber per le PMI?",
      domanda_norm: "copertura cyber pmi",
    },
    {
      id: "2",
      domanda: "Ultimi provvedimenti IVASS su distribuzione assicurativa",
      domanda_norm: "provvedimenti ivass distribuzione assicurativa",
    },
  ];

  it("match esatto sulla norma", () => {
    expect(matchKnowHow(items, "copertura cyber PMI")?.id).toBe("1");
  });

  it("match simile senza bruciare IA", () => {
    expect(scoreKnowHow(
      "Come funziona la copertura cyber per le PMI?",
      "Funzionamento copertura cyber PMI",
    )).toBeGreaterThan(0.6);
    expect(matchKnowHow(items, "Funzionamento della copertura cyber PMI")?.id).toBe("1");
  });

  it("non matcha domande diverse", () => {
    expect(matchKnowHow(items, "Differenza tra polizza tutela legale e D&O")).toBeNull();
  });
});

describe("pairUserAssistant", () => {
  it("accoppia domanda e risposta, salta errori IA", () => {
    const pairs = pairUserAssistant([
      { role: "user", content: "Q1" },
      { role: "assistant", content: "A1", id: "a1", fonti: [{ url: "https://ivass.it" }] },
      { role: "user", content: "Q2" },
      { role: "assistant", content: "Non sono riuscito a completare la ricerca.\n\nx" },
    ]);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].domanda).toBe("Q1");
    expect(pairs[0].messaggioId).toBe("a1");
  });
});
