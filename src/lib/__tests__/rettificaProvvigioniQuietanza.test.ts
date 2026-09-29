import { describe, it, expect } from "vitest";
import {
  calcDeltaProvvigioni,
  splitDeltaProporzionale,
  validateNuovoImporto,
  validateRettificaNote,
  formatRataLabel,
  sanitizeRettificaSearchTerm,
  formatClienteNomeDisplay,
  mapTitoloToRettificaSearchRow,
  filterQuietanzeSuccessiveNonContabilizzate,
} from "../rettificaProvvigioniQuietanza";

describe("calcDeltaProvvigioni", () => {
  it("calcola delta arrotondato a 2 decimali", () => {
    expect(calcDeltaProvvigioni(100, 125.5)).toBe(25.5);
    expect(calcDeltaProvvigioni(100.333, 100.33)).toBe(-0);
    expect(calcDeltaProvvigioni(null, 50)).toBe(50);
  });
});

describe("validateRettificaNote", () => {
  it("richiede note non vuote", () => {
    expect(validateRettificaNote("")).toMatch(/obbligatorie/);
    expect(validateRettificaNote("   ")).toMatch(/obbligatorie/);
    expect(validateRettificaNote("abc")).toMatch(/min\. 5/);
    expect(validateRettificaNote("Rettifica per errore importo")).toBeNull();
  });
});

describe("validateNuovoImporto", () => {
  it("accetta zero e rifiuta negativi", () => {
    expect(validateNuovoImporto(0)).toBeNull();
    expect(validateNuovoImporto(-1)).toMatch(/negativo/);
    expect(validateNuovoImporto(undefined)).toMatch(/obbligatorio/);
  });
});

describe("splitDeltaProporzionale", () => {
  const template = [
    { percentuale: 60, importo_provvigione: 60, tipo_destinatario: "commerciale" },
    { percentuale: 40, importo_provvigione: 40, tipo_destinatario: "admin", solo_statistico: false },
  ];

  it("ripartisce il delta in proporzione", () => {
    const rows = splitDeltaProporzionale(10, template);
    expect(rows).toHaveLength(2);
    const sum = rows.reduce((s, r) => s + (r.importo_provvigione ?? 0), 0);
    expect(sum).toBe(10);
    expect(rows[0].importo_provvigione).toBe(6);
    expect(rows[1].importo_provvigione).toBe(4);
  });

  it("delta zero → nessuna riga", () => {
    expect(splitDeltaProporzionale(0, template)).toEqual([]);
  });
});

describe("formatRataLabel", () => {
  it("formatta rata/totale", () => {
    expect(formatRataLabel(2, 4)).toBe("2/4");
    expect(formatRataLabel(null, 4)).toBe("—");
  });
});

describe("sanitizeRettificaSearchTerm", () => {
  it("rimuove metacaratteri PostgREST/ILIKE", () => {
    expect(sanitizeRettificaSearchTerm("  2026/3249677  ")).toBe("2026/3249677");
    expect(sanitizeRettificaSearchTerm("a%b_c,(x)")).toBe("a b c x");
  });
});

describe("formatClienteNomeDisplay / mapTitoloToRettificaSearchRow", () => {
  it("preferisce ragione sociale, poi cognome nome", () => {
    expect(formatClienteNomeDisplay({ ragione_sociale: " ACME ", cognome: "Rossi" })).toBe("ACME");
    expect(formatClienteNomeDisplay({ cognome: "CASE", nome: "WALTER" })).toBe("CASE WALTER");
  });

  it("mappa riga titoli su riga UI", () => {
    const row = mapTitoloToRettificaSearchRow({
      id: "t1",
      numero_titolo: "801505372",
      premio_lordo: 100,
      provvigioni_quietanza: 12.5,
      data_messa_cassa: "2026-07-29",
      stato: "incassato",
      riga: 2,
      rate: 3,
      sostituisce_polizza: "801505372",
      garanzia_da: "2026-01-01",
      clienti: { cognome: "CASE", nome: "WALTER", codice_cliente: "1000515" },
      compagnie: { nome: "Agenzia X" },
    });
    expect(row.cliente_nome_display).toBe("CASE WALTER");
    expect(row.compagnia_nome).toBe("Agenzia X");
    expect(row.numero_rata).toBe(2);
    expect(row.numero_rate_totali).toBe(3);
    expect(row.sostituisce_polizza).toBe("801505372");
  });
});

describe("filterQuietanzeSuccessiveNonContabilizzate", () => {
  const selected = { id: "q1", riga: 1, garanzia_da: "2026-06-17" };
  const rows = [
    { id: "q1", riga: 1, garanzia_da: "2026-06-17", data_messa_cassa: "2026-07-22", stato: "incassato" },
    { id: "q2", riga: 2, garanzia_da: "2027-06-17", data_messa_cassa: null, stato: "attivo" },
    { id: "q0", riga: 0, garanzia_da: "2025-01-01", data_messa_cassa: null, stato: "attivo" },
    { id: "q3", riga: 3, garanzia_da: "2028-01-01", data_messa_cassa: "2026-01-01", stato: "incassato" },
  ];

  it("include solo rate con riga successiva non a cassa", () => {
    const filtered = filterQuietanzeSuccessiveNonContabilizzate(selected, rows);
    expect(filtered.map((r) => r.id)).toEqual(["q2"]);
  });
});
