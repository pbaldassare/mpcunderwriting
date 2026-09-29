import { describe, expect, it } from "vitest";
import {
  buildTestoRicercaEcAgenzia,
  formatClientiAnteprima,
  parseDataEstrattoContoIt,
  righeFromEcAgenziaTitoli,
} from "@/lib/contabilita/ecAgenziaArchivio";

describe("ecAgenziaArchivio", () => {
  it("buildTestoRicercaEcAgenzia include riferimento, polizza, cliente e MI", () => {
    const testo = buildTestoRicercaEcAgenzia("SAR106/250801", [
      { polizza: "36099 - 1", cliente: "Comune di Roma", premio: 100, provvigioni: 10, mi: "B" },
    ]);
    expect(testo).toContain("sar106/250801");
    expect(testo).toContain("comune di roma");
    expect(testo).toContain("36099");
    expect(testo).toContain("b");
  });

  it("righeFromEcAgenziaTitoli mappa titoli PDF", () => {
    const righe = righeFromEcAgenziaTitoli([
      { polizza: "P1", cliente: "Cliente A", ramo: "RCA", periodo: "", tp: "PI", premio: 50, provvigioni: 5, mi: "A" },
    ]);
    expect(righe[0]).toEqual({ polizza: "P1", cliente: "Cliente A", premio: 50, provvigioni: 5, mi: "A" });
  });

  it("parseDataEstrattoContoIt converte dd/MM/yyyy", () => {
    expect(parseDataEstrattoContoIt("10/08/2026")).toBe("2026-08-10");
    expect(parseDataEstrattoContoIt("invalid")).toBeNull();
  });

  it("formatClientiAnteprima mostra primi nomi", () => {
    expect(formatClientiAnteprima([
      { polizza: "1", cliente: "Alpha", premio: 0, provvigioni: 0, mi: "B" },
      { polizza: "2", cliente: "Beta", premio: 0, provvigioni: 0, mi: "B" },
      { polizza: "3", cliente: "Gamma", premio: 0, provvigioni: 0, mi: "B" },
    ], 2)).toBe("Alpha, Beta +1");
  });
});
