import { describe, expect, it } from "vitest";
import {
  FILTRI_PIPELINE_LISTA_PRINCIPALE,
  buildBandoSnapshot,
  effectiveEsitoBando,
  isBandoEsito,
  isBandiPartecipatiPath,
  labelEsitoBando,
  matchesFiltroPipeline,
  normalizeBandoInteresse,
} from "@/lib/bandiInteresse";

describe("bandiInteresse", () => {
  it("etichetta e riconosce gli esiti", () => {
    expect(isBandoEsito("non_partecipo")).toBe(true);
    expect(isBandoEsito("aperto")).toBe(false);
    expect(labelEsitoBando(null)).toBe("Da valutare");
    expect(labelEsitoBando("voglio_partecipare")).toBe("Voglio partecipare");
  });

  it("calcola l'esito effettivo senza toccare lo stato gara", () => {
    expect(effectiveEsitoBando(null, 0)).toBeNull();
    expect(effectiveEsitoBando(null, 2)).toBe("in_trattativa");
    expect(effectiveEsitoBando({ esito: "non_partecipo" }, 1)).toBe("non_partecipo");
    expect(effectiveEsitoBando({ esito: "voglio_partecipare" }, 0)).toBe("voglio_partecipare");
  });

  it("filtra le liste pipeline", () => {
    expect(matchesFiltroPipeline(null, "nuovi")).toBe(true);
    expect(matchesFiltroPipeline("non_partecipo", "nuovi")).toBe(false);
    expect(matchesFiltroPipeline("non_partecipo", "non_partecipo")).toBe(true);
    expect(matchesFiltroPipeline("voglio_partecipare", "tutti")).toBe(true);
    expect(matchesFiltroPipeline(null, "voglio_partecipare")).toBe(false);
  });

  it("snapshotta i dati del bando", () => {
    const snap = buildBandoSnapshot({
      id: "b1",
      titolo: "Brokeraggio 5 anni",
      ente: "Provincia di Grosseto",
      cig: "ABC",
      importo: 269236.09,
      link: "https://ted.europa.eu/x",
      stato: "aperto",
    });
    expect(snap.titolo).toBe("Brokeraggio 5 anni");
    expect(snap.ente).toBe("Provincia di Grosseto");
    expect(snap.stato_gara).toBe("aperto");
    expect(snap.cig).toBe("ABC");
  });

  it("separa Bandi partecipati dalla lista principale", () => {
    expect(isBandiPartecipatiPath("/bandi-pubblici/partecipati")).toBe(true);
    expect(isBandiPartecipatiPath("/bandi-pubblici")).toBe(false);
    expect(FILTRI_PIPELINE_LISTA_PRINCIPALE.some((f) => f.value === "voglio_partecipare")).toBe(false);
    expect(FILTRI_PIPELINE_LISTA_PRINCIPALE.some((f) => f.value === "nuovi")).toBe(true);
    expect(FILTRI_PIPELINE_LISTA_PRINCIPALE.some((f) => f.value === "gia_visti")).toBe(true);
  });

  it("normalizza interesse da embed 1:1 o array", () => {
    expect(normalizeBandoInteresse(null)).toBeNull();
    expect(normalizeBandoInteresse([])).toBeNull();
    expect(normalizeBandoInteresse({ esito: "voglio_partecipare" })?.esito).toBe("voglio_partecipare");
    expect(normalizeBandoInteresse([{ esito: "non_partecipo" }])?.esito).toBe("non_partecipo");
  });
});
