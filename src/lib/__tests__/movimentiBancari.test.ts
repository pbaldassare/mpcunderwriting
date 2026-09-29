import { describe, expect, it, vi } from "vitest";
import {
  buildMovimentoDedupKey,
  extractOrdinanteFromDescrizione,
  fetchAllQueryPages,
  looksLikeIbanOrAccount,
  normalizeExcelRow,
  resolveOrdinanteImport,
  sanitizeIlikeTerm,
  sanitizeOrdinanteNome,
} from "@/lib/movimentiBancari";

describe("extractOrdinanteFromDescrizione", () => {
  it("estrae ordinante da estratto BCC", () => {
    expect(
      extractOrdinanteFromDescrizione(
        "Bonifico a vs favore *SPIX ITALIA - SRL RINNOVO POLIZZE AUTO N.153789452",
      ),
    ).toBe("SPIX ITALIA - SRL");
    expect(
      extractOrdinanteFromDescrizione(
        "Bonifico a vs favore *COMUNE DI RIPALIMOSANI CIG B23A35C73B LIQUIDAZIONE PREMIO",
      ),
    ).toBe("COMUNE DI RIPALIMOSANI");
    expect(
      extractOrdinanteFromDescrizione(
        "Bonifico a vs favore *COMUNE DI COLLETORTO 2026-00541-000005732 POLIZZA RCT",
      ),
    ).toBe("COMUNE DI COLLETORTO");
  });

  it("legge etichetta ORDINANTE", () => {
    expect(extractOrdinanteFromDescrizione("ORDINANTE: ROSSI MARIO SRL CRO 123")).toBe("ROSSI MARIO SRL");
  });

  it("estrae da BONIFICO A VOSTRO FAVORE … Data Regolamento", () => {
    expect(
      extractOrdinanteFromDescrizione(
        "BONIFICO A VOSTRO FAVORE CISAF S.R.L. Data Regolamento: 07/01/26 Coord.Ordinante: IT39 N030 3211 1000 1000 0193 211 Banca Ordinante: 06115/23406-BACRIT22XXX Cro: 0303250201955623481110011100IT Note: RINNOVO POLIZZE CISAF",
      ),
    ).toBe("CISAF S.R.L.");
    expect(
      extractOrdinanteFromDescrizione(
        "BONIFICO A VOSTRO FAVORE PIERREL S P A Data Regolamento: 08/01/26 Coord.Ordinante: IT59 L030 6914 9371 0000 0015 985",
      ),
    ).toBe("PIERREL S P A");
    expect(
      extractOrdinanteFromDescrizione(
        "BONIFICO A VOSTRO FAVORE V.I.M. S.R.L. VENDITA INGROSSO MEDICINA Data Regolamento: 12/01/26 Coord.Ordinante: IT39 Z053",
      ),
    ).toBe("V.I.M. S.R.L. VENDITA INGROSSO MEDICINA");
  });

  it("estrae Ordinante: … Causale: tipico estratto IT", () => {
    expect(
      extractOrdinanteFromDescrizione(
        "Ordinante: MOLTONI LUCA Causale: ORDINE CONTO Rinnovo polizza Moltoni",
      ),
    ).toBe("MOLTONI LUCA");
    expect(
      extractOrdinanteFromDescrizione(
        "Ordinante: OFFICINE BORTOLUZZI REMO S.R.L Causale: ORDINE CONTO Saldo avviso",
      ),
    ).toBe("OFFICINE BORTOLUZZI REMO S.R.L");
  });
});

describe("resolveOrdinanteImport", () => {
  it("preferisce colonna nominativo dedicata", () => {
    expect(resolveOrdinanteImport("Cliente SRL", "Bonifico a vs favore *ALTRO")).toBe("Cliente SRL");
  });

  it("ignora IBAN in colonna e usa descrizione", () => {
    expect(
      resolveOrdinanteImport(
        "IT92P0301503200000002123456",
        "Bonifico a vs favore *ROSSI MARIO RINNOVO POLIZZA",
      ),
    ).toBe("ROSSI MARIO");
  });

  it("pulisce IBAN accanto al nome in colonna", () => {
    expect(
      resolveOrdinanteImport("ACME SPA IT60X0542811101000000123456", "altro"),
    ).toBe("ACME SPA");
  });

  it("usa descrizione se colonna vuota", () => {
    expect(
      resolveOrdinanteImport("", "Bonifico a vs favore *CASSA RURALE ED ARTIGIANA DI CASTELLANA RINNOVO"),
    ).toBe("CASSA RURALE ED ARTIGIANA DI CASTELLANA");
  });
});

describe("sanitize / iban", () => {
  it("riconosce IBAN", () => {
    expect(looksLikeIbanOrAccount("IT92P0301503200000002123456")).toBe(true);
    expect(looksLikeIbanOrAccount("IT92 P030 1503 2000 0002 1234 56")).toBe(true);
    expect(looksLikeIbanOrAccount("ROSSI MARIO")).toBe(false);
  });

  it("rimuove rumore bancario", () => {
    expect(sanitizeOrdinanteNome("VERDI LUCA CRO 998877")).toBe("VERDI LUCA");
    expect(sanitizeOrdinanteNome("IT54H0306936162100000123456")).toBe("");
  });
});

describe("dedup key", () => {
  it("è stabile rispetto all'ordinante (IBAN vs nome)", () => {
    const a = buildMovimentoDedupKey({
      conto_bancario_id: "c1",
      data_movimento: "2026-06-30",
      importo: 100,
      descrizione: "Bonifico ROSSI",
      ordinante: "IT92P0301503200000002123456",
    });
    const b = buildMovimentoDedupKey({
      conto_bancario_id: "c1",
      data_movimento: "2026-06-30",
      importo: 100,
      descrizione: "Bonifico ROSSI",
      ordinante: "ROSSI MARIO",
    });
    expect(a).toBe(b);
  });
});

describe("normalizeExcelRow", () => {
  it("trimma le chiavi colonna", () => {
    expect(normalizeExcelRow({ " Importo ": 10, "Data contabile": "2026-06-01" })).toEqual({
      Importo: 10,
      "Data contabile": "2026-06-01",
    });
  });
});

describe("fetchAllQueryPages", () => {
  it("concatena le pagine finché una è incompleta", async () => {
    const fetchPage = vi.fn(async (from: number, to: number) => {
      const size = to - from + 1;
      if (from === 0) {
        return { data: Array.from({ length: size }, (_, i) => ({ id: i })), error: null };
      }
      return { data: [{ id: size }, { id: size + 1 }], error: null };
    });
    const rows = await fetchAllQueryPages(fetchPage, 3);
    expect(rows.map((r) => r.id)).toEqual([0, 1, 2, 3, 4]);
    expect(fetchPage).toHaveBeenCalledTimes(2);
    expect(fetchPage).toHaveBeenNthCalledWith(1, 0, 2);
    expect(fetchPage).toHaveBeenNthCalledWith(2, 3, 5);
  });

  it("propaga l'errore PostgREST", async () => {
    await expect(
      fetchAllQueryPages(async () => ({ data: null, error: { message: "boom" } }), 10),
    ).rejects.toEqual({ message: "boom" });
  });
});

describe("sanitizeIlikeTerm", () => {
  it("rimuove wildcard e virgole pericolose per .or()", () => {
    expect(sanitizeIlikeTerm(" Busso%, (SRL)* ")).toBe("Busso SRL");
  });
});
