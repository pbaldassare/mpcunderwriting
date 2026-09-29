import { describe, expect, it } from "vitest";
import { tokensRicercaOrdinante } from "@/lib/matchClienteOrdinante";

describe("tokensRicercaOrdinante", () => {
  it("estrae token utili e salta stopword generiche", () => {
    const tokens = tokensRicercaOrdinante("COMUNE DI POMIGLIANO D'ARCO SRL");
    expect(tokens).toContain("POMIGLIANO");
    expect(tokens.some((t) => t === "COMUNE" || t === "DI" || t === "SRL")).toBe(false);
  });

  it("ignora parole troppo corte", () => {
    const tokens = tokensRicercaOrdinante("AB CD EFGH");
    expect(tokens).toEqual(["EFGH"]);
  });
});
