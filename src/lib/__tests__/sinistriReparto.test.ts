import { describe, it, expect } from "vitest";
import {
  aggregateSinPerReparto,
  isClienteSanitario,
  resolveReparto,
} from "../sinistriReparto";

describe("isClienteSanitario", () => {
  it("rileva ospedale demo e settore sanitario", () => {
    expect(isClienteSanitario({ codice_ricerca: "OSPEDALE_DEMO" })).toBe(true);
    expect(isClienteSanitario({ settore: "Sanità pubblica" })).toBe(true);
    expect(isClienteSanitario({ spec_sx_sanita: "RC medica" })).toBe(true);
    expect(isClienteSanitario({ azienda_ssn_sx: true })).toBe(true);
    expect(isClienteSanitario({ settore: "Pubblica amministrazione" })).toBe(false);
  });
});

describe("resolveReparto", () => {
  it("usa colonna reparto se presente", () => {
    expect(resolveReparto({ reparto: "Chirurgia", luogo_sinistro: "altro" })).toBe("Chirurgia");
  });

  it("estrae reparto da luogo_sinistro legacy", () => {
    expect(resolveReparto({ luogo_sinistro: "Reparto Ortopedia — Piano 4" })).toBe("Ortopedia");
    expect(resolveReparto({ luogo_sinistro: "Day Hospital — Padiglione A" })).toBe("Day Hospital");
    expect(resolveReparto({ luogo_sinistro: "Blocco Operatorio 3 — Padiglione Chirurgia" })).toBe("Chirurgia");
  });

  it("ritorna Non specificato se assente", () => {
    expect(resolveReparto({})).toBe("Non specificato");
  });
});

describe("aggregateSinPerReparto", () => {
  it("aggrega per reparto con conteggi aperti/chiusi", () => {
    const rows = aggregateSinPerReparto([
      { stato: "aperto", reparto: "Chirurgia", importo_riserva: 1000, importo_liquidato: 0 },
      { stato: "chiuso", reparto: "Ortopedia", importo_riserva: 0, importo_liquidato: 500 },
      { stato: "in_lavorazione", luogo_sinistro: "Day Hospital — A", importo_riserva: 200, importo_liquidato: 0 },
    ]);
    expect(rows.find((r) => r.reparto === "Chirurgia")).toEqual({
      reparto: "Chirurgia",
      aperti: 1,
      chiusi: 0,
      riserva: 1000,
      liquidato: 0,
    });
    expect(rows.find((r) => r.reparto === "Ortopedia")?.chiusi).toBe(1);
    expect(rows.find((r) => r.reparto === "Day Hospital")?.aperti).toBe(1);
  });
});
