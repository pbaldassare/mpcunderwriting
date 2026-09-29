import { describe, expect, it } from "vitest";
import { creditoDaPremioLordo, isTitoloACredito } from "@/lib/anticipoDaTitoloCredito";

describe("creditoDaPremioLordo", () => {
  it("ritorna 0 su premi positivi o null", () => {
    expect(creditoDaPremioLordo(150)).toBe(0);
    expect(creditoDaPremioLordo(0)).toBe(0);
    expect(creditoDaPremioLordo(null)).toBe(0);
  });

  it("ritorna valore assoluto su premi negativi", () => {
    expect(creditoDaPremioLordo(-150)).toBe(150);
    expect(creditoDaPremioLordo(-150.456)).toBe(150.46);
  });
});

describe("isTitoloACredito", () => {
  it("true solo con lordo negativo", () => {
    expect(isTitoloACredito({ premio_lordo: -150, is_appendice_modifica: true })).toBe(true);
    expect(isTitoloACredito({ premio_lordo: 5570, is_appendice_modifica: true })).toBe(false);
  });
});
