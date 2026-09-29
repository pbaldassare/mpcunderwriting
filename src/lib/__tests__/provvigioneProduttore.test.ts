import { describe, expect, it } from "vitest";
import {
  calcProvvigioneProduttoreEuro,
  hasProduttoreRiga,
  provvigioneProduttoreForRow,
} from "../provvigioneProduttore";

describe("hasProduttoreRiga", () => {
  it("false se manca produttore", () => {
    expect(hasProduttoreRiga({})).toBe(false);
    expect(hasProduttoreRiga({ produttore_nome: "—", produttori_display: "—" })).toBe(false);
  });
  it("true se c'è nome o id", () => {
    expect(hasProduttoreRiga({ produttore_nome: "Rossi" })).toBe(true);
    expect(hasProduttoreRiga({ anagrafica_commerciale_id: "p1" })).toBe(true);
  });
});

describe("calcProvvigioneProduttoreEuro", () => {
  it("usa lo split se presente", () => {
    expect(calcProvvigioneProduttoreEuro(200, { splitPercentuali: [40, 10] })).toBe(100);
  });
  it("altrimenti percentuale commerciale (default 100%)", () => {
    expect(calcProvvigioneProduttoreEuro(200, { percentualeCommerciale: 50 })).toBe(100);
    expect(calcProvvigioneProduttoreEuro(200, {})).toBe(200);
  });
});

describe("provvigioneProduttoreForRow", () => {
  it("null se non c'è produttore", () => {
    expect(provvigioneProduttoreForRow({ id: "t1", provvigioni_quietanza: 100 })).toBeNull();
  });
  it("calcola dalla lookup", () => {
    const n = provvigioneProduttoreForRow(
      { id: "t1", produttore_nome: "Rossi", sostituisce_polizza: "P", provvigioni_quietanza: 200 },
      {
        splitsByTitolo: new Map([["t1", [25]]]),
        percByTitolo: new Map(),
      },
    );
    expect(n).toBe(50);
  });
});
