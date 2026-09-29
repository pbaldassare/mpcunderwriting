import { describe, expect, it } from "vitest";
import {
  buildGarantitoPayload,
  buildIncassoDateFields,
  isDaChiudereIncasso,
  isGarantitoAperto,
  isGarantitoDaIncassare,
  isInCoperturaGarantita,
  resolveDataCoperturaOnIncasso,
} from "@/lib/garantitoTitolo";

const quietanzaBase = {
  sostituisce_polizza: "madre",
  stato: "attivo" as const,
};

describe("resolveDataCoperturaOnIncasso", () => {
  it("incasso diretto: copertura = messa a cassa", () => {
    expect(resolveDataCoperturaOnIncasso({ conferimento_gestito: false }, "2026-06-29")).toBe("2026-06-29");
  });

  it("garantito con copertura: mantiene data originale", () => {
    expect(
      resolveDataCoperturaOnIncasso(
        { conferimento_gestito: true, data_copertura: "2026-06-15" },
        "2026-06-29",
      ),
    ).toBe("2026-06-15");
  });

  it("garantito senza copertura salvata: fallback a messa a cassa", () => {
    expect(resolveDataCoperturaOnIncasso({ conferimento_gestito: true }, "2026-06-29")).toBe("2026-06-29");
  });
});

describe("buildIncassoDateFields", () => {
  it("allinea incasso e messa a cassa; copertura distinta se garantito", () => {
    const out = buildIncassoDateFields(
      { conferimento_gestito: true, data_copertura: "2026-06-15" },
      "2026-06-29",
    );
    expect(out).toEqual({
      data_messa_cassa: "2026-06-29",
      data_incasso: "2026-06-29",
      data_copertura: "2026-06-15",
    });
  });

  it("garantito già messo a cassa: preserva data_messa_cassa, aggiorna data_incasso", () => {
    const out = buildIncassoDateFields(
      {
        conferimento_gestito: true,
        data_copertura: "2026-06-15",
        data_messa_cassa: "2026-06-15",
      },
      "2026-06-29",
    );
    expect(out).toEqual({
      data_messa_cassa: "2026-06-15",
      data_incasso: "2026-06-29",
      data_copertura: "2026-06-15",
    });
  });
});

describe("buildGarantitoPayload", () => {
  it("imposta entrambe le date e lascia fondi in attesa", () => {
    const payload = buildGarantitoPayload({
      dataCopertura: "2026-07-30",
      dataDecorrenza: "2026-08-01",
    });
    expect(payload.stato).toBe("attivo");
    expect(payload.data_copertura).toBe("2026-07-30");
    expect(payload.data_messa_cassa).toBe("2026-07-30");
    expect(payload.data_incasso).toBeNull();
    expect(payload.importo_incassato).toBeNull();
    expect(payload.tipo_pagamento).toBe("garantito");
    expect(payload.conferimento_gestito).toBe(true);
    expect(payload.fondi_ricevuti).toBe(false);
  });
});

describe("isInCoperturaGarantita / isGarantitoDaIncassare", () => {
  it("riconosce garantito con data_messa_cassa valorizzata e fondi in attesa", () => {
    const t = {
      ...quietanzaBase,
      conferimento_gestito: true,
      tipo_pagamento: "garantito",
      data_copertura: "2026-07-30",
      data_messa_cassa: "2026-07-30",
      fondi_ricevuti: false,
    };
    expect(isInCoperturaGarantita(t)).toBe(true);
    expect(isGarantitoDaIncassare(t)).toBe(true);
    expect(isGarantitoAperto(t)).toBe(true);
    expect(isDaChiudereIncasso(t)).toBe(true);
  });

  it("non usa più !data_messa_cassa come definizione di garantito", () => {
    expect(
      isInCoperturaGarantita({
        ...quietanzaBase,
        conferimento_gestito: true,
        data_copertura: "2026-07-30",
        data_messa_cassa: null,
        fondi_ricevuti: false,
      }),
    ).toBe(true);
  });

  it("esclude dopo fondi ricevuti o stato incassato", () => {
    expect(
      isInCoperturaGarantita({
        ...quietanzaBase,
        conferimento_gestito: true,
        tipo_pagamento: "garantito",
        data_copertura: "2026-07-30",
        data_messa_cassa: "2026-07-30",
        fondi_ricevuti: true,
      }),
    ).toBe(false);
    expect(
      isGarantitoDaIncassare({
        ...quietanzaBase,
        stato: "incassato",
        conferimento_gestito: true,
        tipo_pagamento: "garantito",
        data_copertura: "2026-07-30",
        data_messa_cassa: "2026-07-30",
        fondi_ricevuti: false,
      }),
    ).toBe(false);
  });

  it("polizza madre non è in copertura garantita", () => {
    expect(
      isInCoperturaGarantita({
        sostituisce_polizza: null,
        conferimento_gestito: true,
        data_copertura: "2026-07-30",
        fondi_ricevuti: false,
      }),
    ).toBe(false);
  });
});
