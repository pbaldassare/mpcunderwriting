import { describe, it, expect } from "vitest";
import {
  aggregateSinPerRamo,
  buildFilterSummary,
  computeKpis,
  formatStatoLabel,
  mapSinistriToPdfRows,
} from "../sinistriEnteReportData";

describe("formatStatoLabel", () => {
  it("sostituisce underscore con spazi", () => {
    expect(formatStatoLabel("in_lavorazione")).toBe("IN LAVORAZIONE");
    expect(formatStatoLabel("")).toBe("—");
  });
});

describe("buildFilterSummary", () => {
  it("include filtri attivi e conteggio risultati", () => {
    const lines = buildFilterSummary(
      {
        search: "targa",
        stati: ["aperto"],
        rami: ["RC Auto"],
        compagnie: [],
        polizze: [],
        citta: ["Varese"],
        dataDa: new Date("2026-01-01"),
        dataA: new Date("2026-06-30"),
      },
      3,
      10,
    );
    expect(lines).toContain('Ricerca: "targa"');
    expect(lines.some((l) => l.startsWith("Stato:"))).toBe(true);
    expect(lines).toContain("Garanzia: RC Auto");
    expect(lines).toContain("Città: Varese");
    expect(lines).toContain("Risultato: 3 di 10 sinistri");
    expect(lines.some((l) => l.startsWith("Data evento:"))).toBe(true);
  });

  it("indica tutti gli stati quando nessun filtro stato", () => {
    const lines = buildFilterSummary(
      { search: "", stati: [], rami: [], compagnie: [], polizze: [], citta: [] },
      5,
      5,
    );
    expect(lines).toContain("Stato: tutti");
    expect(lines).toContain("Risultato: 5 di 5 sinistri");
  });
});

describe("aggregateSinPerRamo", () => {
  const sinistri = [
    { ramo_sinistro: "RC Auto", stato: "aperto", importo_riserva: 1000, importo_liquidato: 0 },
    { ramo_sinistro: "RC Auto", stato: "chiuso", importo_riserva: 0, importo_liquidato: 500 },
    { ramo_sinistro: "Furto", stato: "in_lavorazione", importo_riserva: 200, importo_liquidato: 0 },
    { stato: "respinto", importo_riserva: 0, importo_liquidato: 0 },
  ];

  it("aggrega conteggi e importi per ramo", () => {
    const rows = aggregateSinPerRamo(sinistri);
    const rc = rows.find((r) => r.ramo === "RC Auto");
    expect(rc).toEqual({ ramo: "RC Auto", aperti: 1, chiusi: 1, riserva: 1000, liquidato: 500 });
    const altro = rows.find((r) => r.ramo === "Altro");
    expect(altro?.chiusi).toBe(1);
    const furto = rows.find((r) => r.ramo === "Furto");
    expect(furto?.aperti).toBe(1);
    expect(furto?.riserva).toBe(200);
  });
});

describe("computeKpis", () => {
  it("calcola KPI economici e di stato", () => {
    const kpis = computeKpis([
      { stato: "aperto", importo_riserva: 100, importo_liquidato: 0 },
      { stato: "chiuso", importo_riserva: 0, importo_liquidato: 250 },
      { stato: "respinto", importo_riserva: 50, importo_liquidato: 0 },
    ]);
    expect(kpis.totale).toBe(3);
    expect(kpis.aperti).toBe(1);
    expect(kpis.chiusi).toBe(2);
    expect(kpis.riserve).toBe(150);
    expect(kpis.liquidato).toBe(250);
  });

  it("esclude gli archiviati da KPI e aggregazioni", () => {
    const kpis = computeKpis([
      { stato: "aperto", importo_riserva: 100, importo_liquidato: 0 },
      { stato: "archiviato", importo_riserva: 999, importo_liquidato: 50 },
    ]);
    expect(kpis.totale).toBe(1);
    expect(kpis.aperti).toBe(1);
    expect(kpis.riserve).toBe(100);
  });
});

describe("mapSinistriToPdfRows", () => {
  it("mappa campi essenziali come export XLSX", () => {
    const rows = mapSinistriToPdfRows([
      {
        numero_sinistro: "SIN-001",
        ramo_sinistro: "RC Auto",
        stato: "aperto",
        citta_sinistro: "Varese",
        importo_riserva: 1000,
        importo_liquidato: null,
        data_evento: "2026-03-15",
        data_denuncia: "2026-03-20",
        titoli: { numero_titolo: "POL-123" },
        compagnie: { nome: "Unipol" },
      },
    ]);
    expect(rows[0].numeroSinistro).toBe("SIN-001");
    expect(rows[0].garanzia).toBe("RC Auto");
    expect(rows[0].polizza).toBe("POL-123");
    expect(rows[0].compagnia).toBe("Unipol");
    expect(rows[0].stato).toBe("APERTO");
    expect(rows[0].luogo).toBe("Varese");
    expect(rows[0].dataEvento).toBe("15/03/2026");
    expect(rows[0].dataDenuncia).toBe("20/03/2026");
  });
});
