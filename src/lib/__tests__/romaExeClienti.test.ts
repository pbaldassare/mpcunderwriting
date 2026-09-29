import { describe, expect, it } from "vitest";
import {
  ROMA_EXE_SEDE_EMAIL,
  cleanPartitaIva,
  inferFormaGiuridica,
  inferTipoCliente,
  matchCatalogoCliente,
  resolveRomaExeCliente,
  splitNomeCognome,
} from "@/lib/romaExeClienti";

describe("splitNomeCognome", () => {
  it("spezza COGNOME NOME e toglie il titolo", () => {
    expect(splitNomeCognome("SCALA DR MARIA")).toEqual({
      cognome: "SCALA",
      nome: "MARIA",
      titolo: "DR",
    });
    expect(splitNomeCognome("TOZZI DR MARIO")).toEqual({
      cognome: "TOZZI",
      nome: "MARIO",
      titolo: "DR",
    });
    expect(splitNomeCognome("SCALA DR MARIA CRISTINA")).toEqual({
      cognome: "SCALA",
      nome: "MARIA CRISTINA",
      titolo: "DR",
    });
    expect(splitNomeCognome("GAMUCCI D.SSA TERESA")).toEqual({
      cognome: "GAMUCCI",
      nome: "TERESA",
      titolo: "D.SSA",
    });
  });

  it("tiene il doppio cognome e prende l'ultimo token come nome", () => {
    expect(splitNomeCognome("DURAND DE LA PENNE LUIGI")).toEqual({
      cognome: "DURAND DE LA PENNE",
      nome: "LUIGI",
      titolo: null,
    });
  });
});

describe("tipo e forma", () => {
  it("riconosce condominio, srl e comune", () => {
    expect(inferTipoCliente("COND.V.MARTINI 13", null, null, "80283100586")).toBe("azienda");
    expect(inferFormaGiuridica("COND.V.MARTINI 13")).toBe("altro");
    expect(inferFormaGiuridica("GALA HOTELS SRL")).toBe("srl");
    expect(inferTipoCliente("COMUNE DI VARESE", null, "00369820127", "00369820127")).toBe("ente");
    expect(inferFormaGiuridica("COMUNE DI VARESE")).toBe("ente_pubblico");
  });

  it("persona + P.IVA → azienda / ditta individuale", () => {
    expect(inferTipoCliente("NUNZIATI ING. ALESSANDRO", "NNZLSN76M13H501F", "07093061005", "07093061005")).toBe(
      "azienda",
    );
  });
});

describe("resolveRomaExeCliente", () => {
  it("mette la mail della sede a tutti e tiene le mail EXE in nota", () => {
    const hit = resolveRomaExeCliente(10001, [
      {
        ragione_sociale: "SCALA DR MARIA CRISTINA",
        codice_fiscale: "SCLMCR59M52C725G",
        partita_iva: "00000000000",
        indirizzo: "V. TOMMASO SALVINI 2/a",
        cap: "00197",
        citta: "ROMA",
        provincia: "RM",
        email1: "scala@studiodiconsulenza.eu",
        pec_o_nota: "mariacristinascala@pec.it",
      },
    ]);
    expect(hit.email).toBe(ROMA_EXE_SEDE_EMAIL);
    expect(hit.pec).toBe("mariacristinascala@pec.it");
    expect(hit.note).toContain("scala@studiodiconsulenza.eu");
    expect(hit.tipoCliente).toBe("privato");
    expect(hit.nome).toBe("MARIA CRISTINA");
    expect(hit.cognome).toBe("SCALA");
    expect(hit.codiceCliente).toBe("RM2-10001");
    expect(hit.partitaIva).toBeNull();
    expect(hit.gruppoKey).toBe("linea_persona");
    expect(hit.esito).toBe("da_creare");
  });

  it("svuota P.IVA dummy e non inventa CF", () => {
    expect(cleanPartitaIva("00000000000")).toBeNull();
    const hit = resolveRomaExeCliente(10808, [
      { ragione_sociale: "EREDI AMATI SAMUELE", codice_fiscale: "1", partita_iva: "00000000000" },
    ]);
    expect(hit.codiceFiscale).toBeNull();
    expect(hit.partitaIva).toBeNull();
  });

  it("collega un cliente CBnet già presente per P.IVA senza sovrascrivere", () => {
    const hit = resolveRomaExeCliente(
      99999,
      [{ ragione_sociale: "AIR CANADA", partita_iva: "04432261008" }],
      [{ id: "aca", partita_iva: "04432261008", ufficio_id: "rm2" }],
      { ufficioId: "rm2" },
    );
    expect(hit.esito).toBe("esistente");
    expect(hit.clienteId).toBe("aca");
  });

  it("non abbina per nome se manca CF/P.IVA", () => {
    const hit = matchCatalogoCliente({ cf: null, piva: null }, [
      { id: "x", codice_fiscale: "SCLMCR59M52C725G" },
    ]);
    expect(hit).toBeNull();
  });

  it("prende il secondo indirizzo come alternativo", () => {
    const hit = resolveRomaExeCliente(10001, [
      { ragione_sociale: "SCALA DR MARIA CRISTINA", indirizzo: "V. SALVINI 2", citta: "ROMA" },
      { ragione_sociale: "SCALA DR MARIA CRISTINA", indirizzo: "V. SALARIA 292", citta: "ROMA" },
    ]);
    expect(hit.indirizzo).toBe("V. SALVINI 2");
    expect(hit.indirizzoAlternativo).toBe("V. SALARIA 292");
  });
});
