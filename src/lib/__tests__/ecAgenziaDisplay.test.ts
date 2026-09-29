import { describe, expect, it } from "vitest";
import {
  formatCigCausale,
  filterEcAgenziaGroups,
  formatClienteEc,
  titoloMatchesEcSearch,
  resolveCompagniaCollegataNome,
  resolveImportoVersatoAgenzia,
  resolveMiCodiceEcAgenzia,
  resolveTipoPagamentoLabelEcAgenzia,
  resolveTipoPagamentoMiEcAgenzia,
} from "@/lib/ecAgenziaDisplay";

describe("ecAgenziaDisplay", () => {
  it("formatClienteEc preferisce ragione sociale", () => {
    expect(formatClienteEc({ ragione_sociale: "SRL Test", nome: "Mario", cognome: "Rossi" })).toBe("SRL Test");
    expect(formatClienteEc({ nome: "Mario", cognome: "Rossi" })).toBe("Rossi Mario");
  });

  it("resolveImportoVersatoAgenzia usa premio lordo se incassato", () => {
    expect(
      resolveImportoVersatoAgenzia({ stato: "incassato", premio_lordo: 349, importo_incassato: 348.5 }),
    ).toBe(349);
    expect(
      resolveImportoVersatoAgenzia({ stato: "attivo", premio_lordo: 349, importo_incassato: 100 }),
    ).toBe(100);
  });

  it("resolveTipoPagamentoLabelEcAgenzia non espone abbuono né compensazione legacy", () => {
    expect(resolveTipoPagamentoLabelEcAgenzia("abbuono")).toBe("Premio saldato");
    expect(resolveTipoPagamentoLabelEcAgenzia("compensato")).toBe("Premio saldato");
    expect(resolveTipoPagamentoLabelEcAgenzia("misto_compensato")).toBe("Premio saldato");
    expect(resolveTipoPagamentoLabelEcAgenzia("bonifico")).toBe("Bonifico");
    expect(resolveTipoPagamentoLabelEcAgenzia("costi_consulbrokers")).toBe("Bonifico");
    expect(resolveTipoPagamentoLabelEcAgenzia("compensazione")).toBe("Bonifico");
  });

  it("resolveMiCodiceEcAgenzia mappa acconti e pag. diretto a B, garantito a *", () => {
    expect(resolveMiCodiceEcAgenzia("anticipo")).toBe("B");
    expect(resolveMiCodiceEcAgenzia(null)).toBe("B");
    expect(resolveMiCodiceEcAgenzia("pagamento_diretto_compagnia")).toBe("B");
    expect(resolveMiCodiceEcAgenzia("garantito")).toBe("*");
  });

  it("resolveCompagniaCollegataNome legge gruppo compagnia", () => {
    expect(resolveCompagniaCollegataNome({ gruppi_compagnia: { descrizione: "AIG" } })).toBe("AIG");
    expect(resolveCompagniaCollegataNome({ gruppo_compagnia: "ALLIANZ" })).toBe("ALLIANZ");
    expect(resolveCompagniaCollegataNome(null)).toBe("");
  });

  it("titoloMatchesEcSearch su CIG, polizza, cliente, codice", () => {
    const t = {
      id: "uuid-1",
      numero_titolo: "33333",
      cliente: "baldassare paolo",
      cig_rif: "ZB63217ACE",
      codice_cliente: "C0042",
      premio_lordo: 10,
    };
    expect(titoloMatchesEcSearch(t, "zb632")).toBe(true);
    expect(titoloMatchesEcSearch(t, "33333")).toBe(true);
    expect(titoloMatchesEcSearch(t, "baldassare")).toBe(true);
    expect(titoloMatchesEcSearch(t, "c0042")).toBe(true);
    expect(titoloMatchesEcSearch(t, "uuid-1")).toBe(true);
    expect(titoloMatchesEcSearch(t, "xyz")).toBe(false);
  });

  it("formatCigCausale unisce CIG distinti", () => {
    expect(formatCigCausale([{ cig_rif: "AAA" }, { cig_rif: "AAA" }, { cig_rif: "BBB" }])).toBe("AAA, BBB");
    expect(formatCigCausale([{ cig_rif: null }])).toBe("");
  });

  it("filterEcAgenziaGroups per codice agenzia tiene tutti i titoli", () => {
    const rows = [
      {
        nome: "AG. GIUDICE",
        codice: "SAR106",
        compagniaCollegata: "Sara",
        lordo: 100,
        provvigioni: 10,
        ritenutaAcconto: 0,
        titoli: [
          { id: "1", numero_titolo: "A", cliente: "X", cig_rif: "C1", premio_lordo: 60 },
          { id: "2", numero_titolo: "B", cliente: "Y", cig_rif: "C2", premio_lordo: 40 },
        ],
      },
    ];
    const byCode = filterEcAgenziaGroups(rows, "sar106");
    expect(byCode[0].titoli).toHaveLength(2);
    const byCig = filterEcAgenziaGroups(rows, "C2");
    expect(byCig[0].titoli).toHaveLength(1);
    expect(byCig[0].lordo).toBe(40);
  });

  it("resolveTipoPagamentoMiEcAgenzia non espone abbuono", () => {
    expect(resolveTipoPagamentoMiEcAgenzia("bonifico")).toBe("B");
    expect(resolveTipoPagamentoMiEcAgenzia("costi_consulbrokers")).toBe("B");
    expect(resolveTipoPagamentoMiEcAgenzia("compensazione")).toBe("B");
    expect(resolveTipoPagamentoMiEcAgenzia("abbuono")).toBe("B");
    expect(resolveTipoPagamentoMiEcAgenzia("compensato")).toBe("B");
    expect(resolveTipoPagamentoMiEcAgenzia("contanti")).toBe("C");
    expect(resolveTipoPagamentoMiEcAgenzia("anticipo")).toBe("B");
    expect(resolveTipoPagamentoMiEcAgenzia("anticipo_misto")).toBe("B");
    expect(resolveTipoPagamentoMiEcAgenzia("assegno")).toBe("A");
    expect(resolveTipoPagamentoMiEcAgenzia("pagamento_diretto_compagnia")).toBe("B");
    expect(resolveTipoPagamentoMiEcAgenzia("garantito")).toBe("*");
  });
});
