import { describe, expect, it } from "vitest";
import {
  annoDaBando,
  buildStoricoGaraFromBando,
  effectiveCantiereStato,
  enteSearchToken,
  entiCompatibili,
  esitoStoricoDaBando,
  isBandoInCantiere,
  matchStoricoPerEnte,
  matchesFiltroCantiere,
  normalizeEnteNome,
} from "@/lib/bandiCantiere";

describe("bandiCantiere", () => {
  it("mette in cantiere i partecipati e gli archiviati", () => {
    expect(isBandoInCantiere("voglio_partecipare", "da_approfondire")).toBe(true);
    expect(isBandoInCantiere("in_trattativa", "in_trattativa")).toBe(true);
    expect(isBandoInCantiere("non_partecipo", null)).toBe(false);
    expect(isBandoInCantiere(null, "archiviato_storico")).toBe(true);
    expect(isBandoInCantiere(null, null, 1)).toBe(true);
  });

  it("deriva lo stato cantiere senza toccare lo stato gara", () => {
    expect(effectiveCantiereStato({ esito: "voglio_partecipare" })).toBe("da_approfondire");
    expect(effectiveCantiereStato({
      esito: "voglio_partecipare",
      cantiere: "in_monitoraggio",
    })).toBe("in_monitoraggio");
    expect(effectiveCantiereStato({ esito: "in_trattativa" })).toBe("in_trattativa");
    expect(effectiveCantiereStato({
      esito: "voglio_partecipare",
      storicoGaraId: "sg1",
    })).toBe("archiviato_storico");
    expect(effectiveCantiereStato({ esito: "non_partecipo" })).toBeNull();
  });

  it("filtra i tab del cantiere", () => {
    expect(matchesFiltroCantiere("da_approfondire", "da_approfondire")).toBe(true);
    expect(matchesFiltroCantiere("in_trattativa", "da_approfondire")).toBe(false);
    expect(matchesFiltroCantiere("archiviato_storico", "tutti")).toBe(true);
  });

  it("normalizza e accoppia enti tipo Comune di Viareggio", () => {
    expect(normalizeEnteNome("Comune di  Viareggio")).toBe("COMUNE DI VIAREGGIO");
    expect(enteSearchToken("COMUNE DI VIAREGGIO")).toBe("VIAREGGIO");
    expect(entiCompatibili("Comune di Viareggio", "COMUNE DI VIAREGGIO")).toBe(true);
    expect(entiCompatibili("Viareggio", "COMUNE DI VIAREGGIO - SETTORE")).toBe(true);
    expect(entiCompatibili("Comune di Lucca", "COMUNE DI VIAREGGIO")).toBe(false);
  });

  it("sceglie le righe storico compatibili", () => {
    const hits = matchStoricoPerEnte("Comune di Viareggio", [
      { id: "1", ente_nome: "COMUNE DI VIAREGGIO", anno_riferimento: 2022, esito: "persa", broker_incumbent: "AON", data_fine_mandato: "2024-12-31" },
      { id: "2", ente_nome: "COMUNE DI LUCCA", anno_riferimento: 2023, esito: "vinta", broker_incumbent: null, data_fine_mandato: null },
    ]);
    expect(hits).toHaveLength(1);
    expect(hits[0].id).toBe("1");
  });

  it("prepara la riga storico dal bando senza inventare una vittoria", () => {
    const row = buildStoricoGaraFromBando({
      id: "b1",
      ente: "Comune di Viareggio",
      titolo: "Brokeraggio",
      cig: "ABC123",
      servizio_da: "2024-09-01",
      servizio_a: "2027-08-31",
      data_pubblicazione: "2026-03-01",
      aggiudicato: true,
      tipo_avviso: "esito",
    }, "user-1");
    expect(row.ente_nome).toBe("COMUNE DI VIAREGGIO");
    expect(row.anno_riferimento).toBe(2026);
    expect(row.esito).toBe("non_classificato");
    expect(row.tipologia).toBe("gara");
    expect(row.bando_id).toBe("b1");
    expect(String(row.note)).toContain("CIG: ABC123");
    expect(esitoStoricoDaBando({ tipo_avviso: "gara" })).toBe("in_corso");
    expect(annoDaBando({})).toBe(new Date().getFullYear());
  });
});
