import { describe, it, expect } from "vitest";
import {
  calcIncassoConTrattenutaProvvigioni,
  calcProvvigioneProduttorePrincipale,
  buildTrattenutaCtx,
} from "../trattenutaProvvigioniIncasso";

describe("calcProvvigioneProduttorePrincipale", () => {
  it("usa percentuale commerciale sul totale quietanza", () => {
    expect(calcProvvigioneProduttorePrincipale(300, 100)).toBe(300);
    expect(calcProvvigioneProduttorePrincipale(300, 50)).toBe(150);
  });
});

describe("calcIncassoConTrattenutaProvvigioni", () => {
  it("esempio utente: 1500 premio, 300 provv, 4.6% RA", () => {
    const r = calcIncassoConTrattenutaProvvigioni(1500, 300, 4.6);
    expect(r.provvigioneLorda).toBe(300);
    expect(r.ritenutaAcconto).toBe(13.8);
    expect(r.trattenutoNetto).toBe(286.2);
    expect(r.importoVersatoConsul).toBe(1213.8);
  });
});

describe("buildTrattenutaCtx", () => {
  it("attivo solo se flag produttore", () => {
    const prod = new Map([
      ["p1", { id: "p1", trattenuta_provvigioni_incasso: true, percentuale_ra: 4.6, ragione_sociale: "Test SRL" }],
    ]);
    const ctx = buildTrattenutaCtx(
      { id: "t1", anagrafica_commerciale_id: "p1", provvigioni_quietanza: 300, percentuale_commerciale: 100 },
      prod,
    );
    expect(ctx?.active).toBe(true);
    expect(ctx?.provvigioneLorda).toBe(300);
  });

  it("null se flag disattivo", () => {
    const prod = new Map([
      ["p1", { id: "p1", trattenuta_provvigioni_incasso: false, percentuale_ra: 4.6 }],
    ]);
    expect(
      buildTrattenutaCtx(
        { id: "t1", anagrafica_commerciale_id: "p1", provvigioni_quietanza: 300 },
        prod,
      ),
    ).toBeNull();
  });

  it("force=true ignora flag anagrafica", () => {
    const prod = new Map([
      ["p1", { id: "p1", trattenuta_provvigioni_incasso: false, percentuale_ra: 4.6, ragione_sociale: "X" }],
    ]);
    const ctx = buildTrattenutaCtx(
      { id: "t1", anagrafica_commerciale_id: "p1", provvigioni_quietanza: 200, percentuale_commerciale: 100 },
      prod,
      { force: true },
    );
    expect(ctx?.provvigioneLorda).toBe(200);
  });
});
