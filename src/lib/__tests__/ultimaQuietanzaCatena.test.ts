import { describe, it, expect } from "vitest";
import { ultimaQuietanzaCatena, dataIncassoQuietanza, quietanzaRiferimentoPremio } from "../ultimaQuietanzaCatena";

describe("ultimaQuietanzaCatena", () => {
  it("preferisce la quietanza con data incasso più recente", () => {
    const rate = [
      { id: "q1", data_messa_cassa: "2025-01-10", garanzia_a: "2025-06-30" },
      { id: "q2", data_incasso: "2026-03-15", garanzia_a: "2026-06-30" },
      { id: "q3", garanzia_a: "2026-12-31" },
    ];
    expect(ultimaQuietanzaCatena(rate)?.id).toBe("q2");
  });

  it("usa data_pagamento se manca data_incasso", () => {
    const rate = [
      { id: "q1", data_pagamento: "2026-02-01" },
      { id: "q2", data_messa_cassa: "2026-01-01" },
    ];
    expect(ultimaQuietanzaCatena(rate)?.id).toBe("q1");
  });

  it("senza date di incasso prende l'ultima per garanzia_a", () => {
    const rate = [
      { id: "q1", garanzia_a: "2025-06-30", created_at: "2025-01-01" },
      { id: "q2", garanzia_a: "2026-06-30", created_at: "2025-07-01" },
    ];
    expect(ultimaQuietanzaCatena(rate)?.id).toBe("q2");
  });

  it("senza rate usa le appendici", () => {
    const appendici = [
      { id: "a1", data_incasso: "2026-01-01" },
      { id: "a2", data_incasso: "2026-05-01" },
    ];
    expect(ultimaQuietanzaCatena([], appendici)?.id).toBe("a2");
  });

  it("ritorna null se pool vuoto", () => {
    expect(ultimaQuietanzaCatena([])).toBeNull();
  });
});

describe("quietanzaRiferimentoPremio", () => {
  it("usa la quietanza con la stessa decorrenza della madre", () => {
    const head = { garanzia_da: "2026-07-08" };
    const rate = [
      { id: "q1", garanzia_da: "2026-07-08", premio_lordo: 296.01 },
      { id: "q2", garanzia_da: "2027-07-08", premio_lordo: 100 },
    ];
    expect(quietanzaRiferimentoPremio(head, rate)?.id).toBe("q1");
  });

  it("con una sola rata usa quella", () => {
    const rate = [{ id: "q1", garanzia_da: "2026-01-01", premio_lordo: 50 }];
    expect(quietanzaRiferimentoPremio({ garanzia_da: "2025-01-01" }, rate)?.id).toBe("q1");
  });
});

describe("dataIncassoQuietanza", () => {
  it("priorità data_incasso > data_pagamento > data_messa_cassa", () => {
    expect(
      dataIncassoQuietanza({
        data_incasso: "2026-03-01",
        data_pagamento: "2026-02-01",
        data_messa_cassa: "2026-01-01",
      }),
    ).toBe("2026-03-01");
    expect(dataIncassoQuietanza({ data_pagamento: "2026-02-01" })).toBe("2026-02-01");
    expect(dataIncassoQuietanza({ data_messa_cassa: "2026-01-01" })).toBe("2026-01-01");
    expect(dataIncassoQuietanza({})).toBeNull();
  });
});
