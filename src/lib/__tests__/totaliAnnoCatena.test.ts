import { describe, it, expect } from "vitest";
import { yearOfTitoloForAnno, totaliAnnoCatena } from "../totaliAnnoCatena";

describe("yearOfTitoloForAnno", () => {
  it("usa garanzia_da se presente", () => {
    expect(
      yearOfTitoloForAnno({
        garanzia_da: "2026-03-01",
        data_competenza: "2025-01-01",
        garanzia_a: "2025-12-31",
      }),
    ).toBe(2026);
  });

  it("fallback data_competenza se manca garanzia_da", () => {
    expect(
      yearOfTitoloForAnno({
        garanzia_da: null,
        data_competenza: "2025-06-15",
        garanzia_a: "2026-01-01",
      }),
    ).toBe(2025);
  });

  it("fallback garanzia_a se mancano le altre", () => {
    expect(yearOfTitoloForAnno({ garanzia_a: "2024-12-31" })).toBe(2024);
  });

  it("ritorna null senza date valide", () => {
    expect(yearOfTitoloForAnno({})).toBeNull();
    expect(yearOfTitoloForAnno({ garanzia_da: "invalid" })).toBeNull();
  });
});

describe("totaliAnnoCatena", () => {
  it("somma solo rate/appendici dell'anno richiesto (catena mista 2025/2026)", () => {
    const rate = [
      {
        id: "q25",
        garanzia_da: "2025-01-01",
        premio_lordo: 100,
        sostituisce_polizza: "madre",
        provvigioni_quietanza: 10,
      },
      {
        id: "q26a",
        garanzia_da: "2026-01-01",
        premio_lordo: 200,
        sostituisce_polizza: "madre",
        provvigioni_quietanza: 20,
      },
      {
        id: "q26b",
        garanzia_da: "2026-07-01",
        premio_lordo: 50,
        sostituisce_polizza: "madre",
        provvigioni_quietanza: 5,
      },
    ];
    const appendici = [
      {
        id: "a25",
        garanzia_da: "2025-06-01",
        premio_lordo: 30,
        sostituisce_polizza: "madre",
        provvigioni_quietanza: 3,
      },
      {
        id: "a26",
        data_competenza: "2026-03-01", // senza garanzia_da → fallback
        premio_lordo: 40,
        sostituisce_polizza: "madre",
        provvigioni_quietanza: 4,
      },
    ];

    const tot2026 = totaliAnnoCatena(rate, appendici, 2026);
    expect(tot2026).toEqual({ premio: 290, provvigioni: 29, count: 3 });

    const tot2025 = totaliAnnoCatena(rate, appendici, 2025);
    expect(tot2025).toEqual({ premio: 130, provvigioni: 13, count: 2 });
  });

  it("non somma nulla se nessuna riga appartiene all'anno", () => {
    expect(
      totaliAnnoCatena(
        [{ garanzia_da: "2024-01-01", premio_lordo: 99, sostituisce_polizza: "m", provvigioni_quietanza: 9 }],
        [],
        2026,
      ),
    ).toEqual({ premio: 0, provvigioni: 0, count: 0 });
  });
});
