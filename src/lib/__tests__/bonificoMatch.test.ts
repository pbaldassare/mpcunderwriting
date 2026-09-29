import { describe, expect, it } from "vitest";
import {
  BONIFICO_MATCH_MIN_SCORE,
  nomeVariantsForMatch,
  scoreOrdinanteVsNomi,
  suggestBonificiPerCliente,
  type BonificoAperto,
} from "@/lib/bonificoMatch";

const base = (partial: Partial<BonificoAperto> & { id: string }): BonificoAperto => ({
  data_movimento: "2026-07-01",
  importo: 9999,
  ordinante: null,
  descrizione: null,
  stato: "importato",
  cliente_id: null,
  ufficio_id: null,
  conto_bancario_id: "c1",
  ...partial,
});

describe("bonificoMatch", () => {
  it("matcha ordinante con nome cliente (non l'importo)", () => {
    expect(scoreOrdinanteVsNomi("PIERGOMME SRL", null, ["Piergomme S.r.l."])).toBeGreaterThanOrEqual(
      BONIFICO_MATCH_MIN_SCORE,
    );
  });

  it("non matcha nomi diversi", () => {
    expect(scoreOrdinanteVsNomi("ROSSI MARIO", null, ["Piergomme S.r.l."])).toBeLessThan(BONIFICO_MATCH_MIN_SCORE);
  });

  it("matcha Comune con apostrofo / senza prefisso", () => {
    expect(
      scoreOrdinanteVsNomi("COMUNE DI POMIGLIANO D ARCO TESORERIA", null, [
        "COMUNE DI POMIGLIANO D'ARCO",
      ]),
    ).toBe(100);
    expect(
      scoreOrdinanteVsNomi("POMIGLIANO D ARCO", null, ["COMUNE DI POMIGLIANO D'ARCO"]),
    ).toBeGreaterThanOrEqual(BONIFICO_MATCH_MIN_SCORE);
    expect(nomeVariantsForMatch("COMUNE DI SAN MARTINO IN PENSILIS")).toContain("SAN MARTINO IN PENSILIS");
  });

  it("suggest prioritizza cliente_id e ignora importo", () => {
    const rows = [
      base({ id: "a", ordinante: "ALTRO SPA", importo: 100 }),
      base({ id: "b", ordinante: "PIERGOMME SRL", importo: 1 }),
      base({ id: "c", ordinante: "X", cliente_id: "cli1", importo: 50 }),
    ];
    const sug = suggestBonificiPerCliente(rows, { clienteId: "cli1", clienteNome: "Piergomme" });
    expect(sug[0].id).toBe("c");
    expect(sug.some((s) => s.id === "b")).toBe(true);
    expect(sug.some((s) => s.id === "a")).toBe(false);
  });

});
