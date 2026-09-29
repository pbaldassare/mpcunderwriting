import { describe, it, expect } from "vitest";
import {
  resolveClienteEmail,
  resolveClienteIndirizzo,
  resolveClienteIntestazione,
  resolveClienteNome,
  isClienteAziendaEnte,
} from "@/lib/ecClienteAnagrafica";

describe("ecClienteAnagrafica", () => {
  it("risolve email da anagrafica con fallback pec e referente", () => {
    expect(resolveClienteEmail({ email: "a@b.it" })).toBe("a@b.it");
    expect(resolveClienteEmail({ pec: "pec@b.it" })).toBe("pec@b.it");
    expect(resolveClienteEmail({ referente_email: "r@b.it" })).toBe("r@b.it");
  });

  it("intestazione azienda vs privato", () => {
    expect(resolveClienteIntestazione({ tipo_cliente: "azienda", ragione_sociale: "ACME" })).toBe("Spett.le");
    expect(resolveClienteIntestazione({ tipo_cliente: "privato", sesso: "F", nome: "Anna", cognome: "Rossi" })).toBe("Preg.ma Sig.ra");
  });

  it("indirizzo con fallback fiscale/sede", () => {
    const addr = resolveClienteIndirizzo({
      tipo_cliente: "azienda",
      ragione_sociale: "ACME",
      indirizzo_fiscale: "Via Roma 1",
      cap_fiscale: "80100",
      citta_fiscale: "Napoli",
      provincia_fiscale: "NA",
    });
    expect(addr.indirizzo).toBe("Via Roma 1");
    expect(addr.citta).toBe("Napoli");
  });

  it("nome azienda da ragione sociale", () => {
    expect(resolveClienteNome({ tipo_cliente: "azienda", ragione_sociale: "ACME SRL" })).toBe("ACME SRL");
    expect(isClienteAziendaEnte({ tipo_cliente: "privato", ragione_sociale: "Ditta" })).toBe(true);
  });
});
