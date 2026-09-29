import { describe, expect, it } from "vitest";
import {
  aggregaPremiSinistriPerAnno,
  aggregaSinistriPerRamo,
  aggregaSomma,
  topNSinistriPerRamo,
  dedupeCgaSuTitoli,
  isPolizzaDashAttiva,
  premioAnnuoDash,
  ramoLabelFromJoin,
  topNConAltri,
  type ClienteDashPolizza,
} from "@/lib/clienteDashboard";

const madre = (over: Partial<ClienteDashPolizza> = {}): ClienteDashPolizza => ({
  id: "m1",
  source: "titoli",
  numero: "P-100",
  stato: "attivo",
  premioRata: 100_000,
  frazionamento: "Annuale",
  dataScadenza: "2027-01-01",
  dataInizio: "2026-01-01",
  ramo: "RCT",
  compagnia: "Unipol",
  sostituisce_polizza: null,
  is_appendice_modifica: false,
  is_proroga: false,
  is_regolazione: false,
  detailPath: "/cliente/polizze/m1",
  ...over,
});

describe("isPolizzaDashAttiva", () => {
  it("accetta solo madri attive, non quietanze né appendici", () => {
    expect(isPolizzaDashAttiva(madre())).toBe(true);
    expect(isPolizzaDashAttiva(madre({ stato: "incassato" }))).toBe(true);
    expect(isPolizzaDashAttiva(madre({ sostituisce_polizza: "P-100" }))).toBe(false);
    expect(isPolizzaDashAttiva(madre({ is_appendice_modifica: true }))).toBe(false);
    expect(isPolizzaDashAttiva(madre({ stato: "scaduto" }))).toBe(false);
  });
});

describe("premioAnnuoDash", () => {
  it("annualizza la rata (semestrale × 2)", () => {
    expect(premioAnnuoDash(madre({ premioRata: 109_000, frazionamento: "Semestrale" }))).toBe(218_000);
    expect(premioAnnuoDash(madre({ premioRata: 50_000, frazionamento: "Annuale" }))).toBe(50_000);
  });

  it("non annualizza le CGA (totale già estratto)", () => {
    expect(premioAnnuoDash(madre({ source: "cga", premioRata: 12_000, frazionamento: "Semestrale" }))).toBe(12_000);
  });
});

describe("dedupeCgaSuTitoli", () => {
  it("scarta CGA con lo stesso numero polizza", () => {
    const titoli = [madre({ numero: "204366651" })];
    const cga = [
      madre({ id: "c1", source: "cga", numero: "204 366 651", premioRata: 9 }),
      madre({ id: "c2", source: "cga", numero: "SOLO-CGA", premioRata: 1 }),
    ];
    const out = dedupeCgaSuTitoli(titoli, cga);
    expect(out.map((p) => p.id)).toEqual(["m1", "c2"]);
  });
});

describe("aggregaSomma / topNConAltri", () => {
  it("somma i premi annui e raggruppa gli altri", () => {
    const rows = [
      madre({ id: "1", ramo: "RCT", premioRata: 100 }),
      madre({ id: "2", ramo: "RCT", premioRata: 50 }),
      madre({ id: "3", ramo: "RCA", premioRata: 20 }),
      madre({ id: "4", ramo: "Furto", premioRata: 5 }),
    ];
    const byRamo = aggregaSomma(rows, (p) => p.ramo);
    expect(byRamo[0]).toEqual({ name: "RCT", value: 150 });
    expect(topNConAltri(byRamo, 2)).toEqual([
      { name: "RCT", value: 150 },
      { name: "RCA", value: 20 },
      { name: "Altri", value: 5 },
    ]);
  });
});

describe("aggregaSinistriPerRamo", () => {
  it("separa aperti e chiusi per ramo", () => {
    const out = aggregaSinistriPerRamo([
      { id: "1", stato: "aperto", ramo: "RCT", importo: 10, dataApertura: "2026-01-01" },
      { id: "2", stato: "in_lavorazione", ramo: "RCT", importo: 10, dataApertura: "2026-02-01" },
      { id: "3", stato: "chiuso", ramo: "RCT", importo: 10, dataApertura: "2025-01-01" },
      { id: "4", stato: "respinto", ramo: "RCA", importo: 1, dataApertura: "2026-03-01" },
    ]);
    expect(out[0]).toMatchObject({ name: "RCT", aperti: 2, chiusi: 1 });
    expect(out[1]).toMatchObject({ name: "RCA", aperti: 0, chiusi: 1 });
  });

  it("raggruppa i rami oltre i primi N", () => {
    const many = Array.from({ length: 8 }, (_, i) => ({
      id: String(i),
      stato: "aperto",
      ramo: `Ramo ${i}`,
      importo: 1,
      dataApertura: "2026-01-01",
    }));
    const out = topNSinistriPerRamo(many, 3);
    expect(out).toHaveLength(4);
    expect(out[3]).toEqual({ name: "Altri", aperti: 5, chiusi: 0 });
  });
});

describe("aggregaPremiSinistriPerAnno", () => {
  it("usa solo le attive e gli importi sinistro per anno", () => {
    const out = aggregaPremiSinistriPerAnno(
      [
        madre({ dataInizio: "2025-06-01", premioRata: 1000, frazionamento: "Annuale" }),
        madre({ id: "q", sostituisce_polizza: "x", dataInizio: "2025-06-01", premioRata: 999 }),
      ].filter(isPolizzaDashAttiva),
      [{ id: "s", stato: "aperto", ramo: "RCT", importo: 200, dataApertura: "2025-08-01" }],
    );
    expect(out).toEqual([{ anno: "2025", premi: 1000, sinistri: 200 }]);
  });
});

describe("ramoLabelFromJoin", () => {
  it("preferisce il gruppo ramo", () => {
    expect(ramoLabelFromJoin({ descrizione: "RC Auto", gruppo_ramo: { descrizione: "RCA" } })).toBe("RCA");
    expect(ramoLabelFromJoin({ descrizione: "Furto" })).toBe("Furto");
    expect(ramoLabelFromJoin(null)).toBe("Altro");
  });
});
