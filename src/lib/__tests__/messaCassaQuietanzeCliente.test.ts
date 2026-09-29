import { describe, expect, it } from "vitest";
import { filterQuietanzeClienteDaIncassare } from "../messaCassaQuietanzeCliente";

describe("filterQuietanzeClienteDaIncassare", () => {
  it("sostituisce il lordo legacy 1222,50 con quello del titolo", () => {
    const out = filterQuietanzeClienteDaIncassare(
      [{ id: "madre", numero_titolo: "LIT-MSIG-26-FA041", sostituisce_polizza: null, premio_lordo: 1222.5 }],
      new Set(),
      new Set(),
      { madre: 10000 },
    );
    expect(out).toHaveLength(1);
    expect(out[0].premio_lordo).toBe(10000);
  });

  it("nasconde la riga se quella polizza è già in distinta", () => {
    const out = filterQuietanzeClienteDaIncassare(
      [{ id: "madre", numero_titolo: "LIT-MSIG-26-FA041", sostituisce_polizza: null, premio_lordo: 1222.5 }],
      new Set(["figlia"]),
      new Set(["LIT-MSIG-26-FA041"]),
      { madre: 1000 },
    );
    expect(out).toHaveLength(0);
  });

  it("esclude la madre se nel set ci sono già le rate", () => {
    const out = filterQuietanzeClienteDaIncassare(
      [
        { id: "madre", numero_titolo: "P1", sostituisce_polizza: null, premio_lordo: 1000 },
        { id: "rata", numero_titolo: "P1", sostituisce_polizza: "P1", premio_lordo: 1000 },
      ],
      new Set(),
      new Set(),
      {},
    );
    expect(out.map((r) => r.id)).toEqual(["rata"]);
  });
});
