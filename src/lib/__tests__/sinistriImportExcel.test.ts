import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import {
  applyPreviewPatch,
  buildPreviewRows,
  countByStatus,
  DESCRIZIONE_MIN_CHARS,
  excelDateToIso,
  mapHeader,
  mapStatoSinistro,
  matchPolizzeByNumero,
  namesLooselyMatch,
  normalizeNumeroPolizza,
  parseModuloSxExcel,
  ramoSinistroFromPolizza,
  validateImportRow,
} from "@/lib/sinistriImportExcel";

function xlsxBuffer(rows: unknown[][]): ArrayBuffer {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Foglio1");
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  if (out instanceof ArrayBuffer) return out;
  if (out instanceof Uint8Array) {
    return out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength);
  }
  return Uint8Array.from(out as number[]).buffer;
}

const LONG_DESC = "Danno al veicolo durante manovra in parcheggio comunale";

describe("sinistriImportExcel", () => {
  it("mappa le intestazioni MODULO SX anche con varianti", () => {
    expect(mapHeader("DATA ACCADIMENTO")).toBe("data_evento");
    expect(mapHeader("N° Polizza")).toBe("n_polizza");
    expect(mapHeader("N SINISTRO COMPAGNIA")).toBe("numero_sinistro_compagnia");
    expect(mapHeader("STATO SINISTRO")).toBe("stato");
    expect(mapHeader("CONTROPARTE")).toBe("controparte");
    expect(mapHeader("Colonna sconosciuta")).toBeNull();
  });

  it("legge il modello ufficiale MODULO SX (con CONTROPARTE) senza perdere le colonne", () => {
    const buf = readFileSync(resolve(process.cwd(), "public/modelli/MODULO_SX.xlsx"));
    const rows = parseModuloSxExcel(buf);
    expect(Array.isArray(rows)).toBe(true);
  });

  it("deriva il ramo dalla polizza CBnet", () => {
    expect(ramoSinistroFromPolizza({
      id: "t1",
      numero_titolo: "ABC",
      ramo: { descrizione: "RCA", gruppo_ramo: { descrizione: "Auto" } },
    })).toBe("Auto · RCA");
    expect(ramoSinistroFromPolizza({ id: "t2", numero_titolo: "X" })).toBe("");
  });

  it("normalizza date IT, ISO e serial Excel", () => {
    expect(excelDateToIso("01/03/2026")).toBe("2026-03-01");
    expect(excelDateToIso("2026-03-01")).toBe("2026-03-01");
    expect(excelDateToIso(new Date(2026, 2, 1))).toBe("2026-03-01");
    expect(excelDateToIso(46082)).toBe("2026-03-01");
    expect(excelDateToIso("")).toBe("");
  });

  it("mappa stati sinonimi e default Aperto", () => {
    expect(mapStatoSinistro("In lavorazione").stato).toBe("in_lavorazione");
    expect(mapStatoSinistro("CHIUSO").stato).toBe("chiuso");
    expect(mapStatoSinistro("Archiviato").stato).toBe("archiviato");
    expect(mapStatoSinistro("CHIUSO SENZA SEGUITO").stato).toBe("chiuso_senza_seguito");
    expect(mapStatoSinistro("APERTURA CAUTELATIVA").stato).toBe("apertura_cautelativa");
    expect(mapStatoSinistro("").stato).toBe("aperto");
    expect(mapStatoSinistro("boh").stato).toBe("aperto");
    expect(mapStatoSinistro("boh").warning).toMatch(/non riconosciuto/);
  });

  it("confronta nomi cliente in modo elastico", () => {
    expect(namesLooselyMatch("Comune di Varese", "COMUNE DI VARESE")).toBe(true);
    expect(namesLooselyMatch("Rossi Mario", "Mario Rossi")).toBe(true);
    expect(namesLooselyMatch("Alfa Srl", "Beta Spa")).toBe(false);
    expect(namesLooselyMatch("", "Qualsiasi")).toBe(true);
  });

  it("abbina polizze per numero normalizzato e distingue CGA", () => {
    const polizze = [
      { id: "t1", numero_titolo: "123-456", _isCga: false },
      { id: "cga:1", numero_titolo: "999", _isCga: true },
      { id: "t2", numero_titolo: "111", _isCga: false },
      { id: "t3", numero_titolo: "111", _isCga: false },
    ];
    expect(matchPolizzeByNumero("123 456", polizze).kind).toBe("unique");
    expect(matchPolizzeByNumero("999", polizze).kind).toBe("cga");
    expect(matchPolizzeByNumero("111", polizze).kind).toBe("ambiguous");
    expect(matchPolizzeByNumero("nope", polizze).kind).toBe("none");
    expect(normalizeNumeroPolizza("12.34-56")).toBe("123456");
  });

  it("legge un Excel MODULO SX e salta le righe vuote", () => {
    const buf = xlsxBuffer([
      ["DATA ACCADIMENTO", "DATA DENUNCIA", "CLIENTE", "N POLIZZA", "N SINISTRO COMPAGNIA", "COMPAGNIA", "AGENZIA", "RAMO", "CONTROPARTE", "STATO SINISTRO", "DESCRIZIONE"],
      ["01/03/2026", "05/03/2026", "Comune Esempio", "123456", "SX-1", "Unipol", "Ag. MI", "RCA", "Rossi Mario", "Aperto", LONG_DESC],
      ["", "", "", "", "", "", "", "", "", "", ""],
    ]);
    const rows = parseModuloSxExcel(buf);
    expect(rows).toHaveLength(1);
    expect(rows[0].n_polizza).toBe("123456");
    expect(rows[0].cliente_excel).toBe("Comune Esempio");
    expect(rows[0].controparte).toBe("Rossi Mario");
    expect(rows[0].descrizione).toBe(LONG_DESC);
  });

  it("costruisce anteprima: polizza unica vs terzi + validazione obbligatoria", () => {
    const raws = parseModuloSxExcel(
      xlsxBuffer([
        ["DATA ACCADIMENTO", "DATA DENUNCIA", "CLIENTE", "N POLIZZA", "N SINISTRO COMPAGNIA", "DESCRIZIONE"],
        ["01/03/2026", "05/03/2026", "Comune Esempio", "ABC", "SX-1", LONG_DESC],
        ["02/03/2026", "06/03/2026", "Altro Nome", "NOPE", "", "corta"],
      ]),
    );
    const preview = buildPreviewRows(raws, {
      clienteNome: "Comune Esempio",
      polizze: [{
        id: "tit-1",
        numero_titolo: "ABC",
        compagnia_id: "c1",
        ufficio_id: "u1",
        ramo: { descrizione: "RCA", gruppo_ramo: { descrizione: "Auto" } },
      }],
      compagnie: [{ id: "c1", nome: "UnipolSai" }],
    });
    expect(preview).toHaveLength(2);
    expect(preview[0].sinistro_terzi).toBe(false);
    expect(preview[0].titolo_id).toBe("tit-1");
    expect(preview[0].ramo_sinistro).toBe("Auto · RCA");
    expect(preview[0].status).toBe("ok");
    expect(preview[1].sinistro_terzi).toBe(true);
    expect(preview[1].clienteMismatch).toBe(true);
    expect(preview[1].status).toBe("blocked");
    expect(preview[1].errors.some((e) => e.includes("Descrizione"))).toBe(true);
  });

  it("blocca riga senza polizza e senza flag terzi", () => {
    const res = validateImportRow({
      data_evento: "2026-03-01",
      data_denuncia: "2026-03-05",
      descrizione: LONG_DESC,
      sinistro_terzi: false,
      titolo_id: null,
      matchPolizza: "none",
      ramo_sinistro: "",
      numero_sinistro_compagnia: "",
      clienteMismatch: false,
      cliente_excel: "",
      compagnia_id: null,
      stato: "aperto",
    });
    expect(res.status).toBe("blocked");
    expect(res.errors[0]).toMatch(/polizza CBnet/);
    expect(LONG_DESC.length).toBeGreaterThanOrEqual(DESCRIZIONE_MIN_CHARS);
  });

  it("applica patch terzi / titolo e ricalcola lo stato", () => {
    const preview = buildPreviewRows(
      [
        {
          excelRow: 2,
          data_evento: "01/03/2026",
          data_denuncia: "05/03/2026",
          cliente_excel: "Comune Esempio",
          n_polizza: "NOPE",
          numero_sinistro_compagnia: "",
          compagnia_excel: "",
          agenzia_excel: "",
          ramo_sinistro: "RCA",
          controparte: "Ignoti",
          stato: "Aperto",
          descrizione: LONG_DESC,
        },
      ],
      { clienteNome: "Comune Esempio", polizze: [{ id: "tit-9", numero_titolo: "ALTRO" }], compagnie: [] },
    );
    expect(preview[0].sinistro_terzi).toBe(true);
    expect(preview[0].controparte).toBe("Ignoti");
    const linked = applyPreviewPatch(
      preview[0],
      { titolo_id: "tit-9" },
      {
        polizze: [{
          id: "tit-9",
          numero_titolo: "ALTRO",
          ramo: { descrizione: "Incendio", gruppo_ramo: { descrizione: "Incendio" } },
        }],
        compagnie: [],
      },
    );
    expect(linked.sinistro_terzi).toBe(false);
    expect(linked.titolo_id).toBe("tit-9");
    expect(linked.ramo_sinistro).toBe("Incendio");
    expect(linked.status).toBe("warning");
    const counts = countByStatus([linked]);
    expect(counts.warning).toBe(1);
  });
});
