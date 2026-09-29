import { describe, it, expect } from "vitest";
import { totaliQuietanzamentoCatena } from "../totaliQuietanzamentoCatena";

describe("totaliQuietanzamentoCatena", () => {
  it("annuale 1y: somma solo la quietanza, non la madre (no doppio conteggio)", () => {
    const madre = {
      premio_lordo: 1000,
      sostituisce_polizza: null as string | null,
      provvigioni_firma: 100,
      provvigioni_quietanza: 0,
    };
    const rate = [
      {
        premio_lordo: 1000,
        sostituisce_polizza: "POL-1",
        provvigioni_quietanza: 100,
        provvigioni_firma: 100, // getProvvigioneEC usa solo quietanza
      },
    ];
    expect(totaliQuietanzamentoCatena(madre, rate)).toEqual({
      premio: 1000,
      provvigioni: 100,
      count: 1,
    });
  });

  it("semestrale: somma entrambe le quietanze, ignora madre e appendici", () => {
    const madre = {
      premio_lordo: 500,
      sostituisce_polizza: null as string | null,
      provvigioni_firma: 50,
    };
    const rate = [
      {
        premio_lordo: 500,
        sostituisce_polizza: "POL-2",
        garanzia_da: "2025-01-01",
        provvigioni_quietanza: 50,
      },
      {
        premio_lordo: 500,
        sostituisce_polizza: "POL-2",
        garanzia_da: "2026-07-01",
        provvigioni_quietanza: 50,
      },
    ];
    const appendici = [
      {
        premio_lordo: 200,
        sostituisce_polizza: "POL-2",
        provvigioni_quietanza: 20,
        is_appendice_modifica: true,
      },
    ];
    expect(totaliQuietanzamentoCatena(madre, rate, appendici)).toEqual({
      premio: 1000,
      provvigioni: 100,
      count: 2,
    });
  });

  it("senza rate: fallback sugli importi della madre", () => {
    const madre = {
      premio_lordo: 800,
      sostituisce_polizza: null as string | null,
      provvigioni_firma: 80,
    };
    expect(totaliQuietanzamentoCatena(madre, [])).toEqual({
      premio: 800,
      provvigioni: 80,
      count: 1,
    });
  });

  it("senza rate né madre: zeri", () => {
    expect(totaliQuietanzamentoCatena(null, [])).toEqual({
      premio: 0,
      provvigioni: 0,
      count: 0,
    });
  });
});
