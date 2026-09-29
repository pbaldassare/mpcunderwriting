import { describe, it, expect } from "vitest";
import { isPolizzaAuto } from "../isPolizzaAuto";

describe("isPolizzaAuto", () => {
  it("riconosce gruppo ramo RCA", () => {
    expect(
      isPolizzaAuto({
        ramo: { gruppo_ramo: { descrizione: "R.C.A. Autoveicoli" }, descrizione: "RCA" },
      }),
    ).toBe(true);
  });

  it("riconosce descrizione AUTO", () => {
    expect(
      isPolizzaAuto({
        ramo: { gruppo_ramo: { descrizione: "Altro" }, descrizione: "AUTOVEICOLI" },
      }),
    ).toBe(true);
  });

  it("false senza segnale e senza veicolo", () => {
    expect(
      isPolizzaAuto({
        ramo: { gruppo_ramo: { descrizione: "Incendio" }, descrizione: "Fabbricati" },
      }),
    ).toBe(false);
  });

  it("true se esiste veicoli_polizza anche con ramo non RCA", () => {
    expect(
      isPolizzaAuto(
        { ramo: { gruppo_ramo: { descrizione: "Incendio" }, descrizione: "Fabbricati" } },
        true,
      ),
    ).toBe(true);
  });
});
