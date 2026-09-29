import { describe, expect, it } from "vitest";
import {
  CAMPOBASSO_SEDE_EMAIL,
  inferTipoCampobasso,
  matchCatalogoCampobasso,
  padPartitaIva,
  pickKeepers,
  resolveCampobassoCliente,
  resolveEmail,
  specialistIsBackoffice,
  unitIsPersona,
} from "@/lib/campobassoClienti";

describe("padPartitaIva", () => {
  it("riempie lo zero mancante (Zets)", () => {
    expect(padPartitaIva("1946110705")).toEqual({ value: "01946110705", padded: true });
    expect(padPartitaIva("01946110705")).toEqual({ value: "01946110705", padded: false });
  });
});

describe("tipo Campobasso", () => {
  it("ente anche se F/G = F", () => {
    expect(
      inferTipoCampobasso({
        nome: "COMUNE DI SCAPOLI",
        fg: "F",
        gruFin: "Enti Pubblici Territoriali",
        cfPersona: null,
        piva: "80002550947",
      }),
    ).toBe("ente");
  });

  it("società marcata F diventa azienda", () => {
    expect(
      inferTipoCampobasso({
        nome: "RADIO TELEMOLISE SRL",
        fg: "F",
        gruFin: "Aziende Private",
        cfPersona: null,
        piva: "00213640709",
      }),
    ).toBe("azienda");
  });
});

describe("email e ruoli", () => {
  it("mail mancante o PEC → sede + pec", () => {
    expect(resolveEmail("")).toEqual({ email: CAMPOBASSO_SEDE_EMAIL, pec: null });
    expect(resolveEmail("comuneisernia@pec.it")).toEqual({
      email: CAMPOBASSO_SEDE_EMAIL,
      pec: "comuneisernia@pec.it",
    });
    expect(resolveEmail("mario@gmail.com")).toEqual({ email: "mario@gmail.com", pec: null });
    expect(resolveEmail("coll. di melanitto")).toEqual({ email: CAMPOBASSO_SEDE_EMAIL, pec: null });
    expect(resolveEmail("0874745588")).toEqual({ email: CAMPOBASSO_SEDE_EMAIL, pec: null });
  });

  it("Melanitto non è backoffice; sede Unit non è persona", () => {
    expect(specialistIsBackoffice("MELANITTO LUIGI")).toBeNull();
    expect(specialistIsBackoffice("TALLINI IOLE")).toBe("tallini");
    expect(unitIsPersona("SEDE DI CAMPOBASSO")).toBe(false);
    expect(unitIsPersona("CAMARCHIOLI LINO")).toBe(true);
  });
});

describe("resolve e keepers", () => {
  it("scarta i non attivi e collega per P.IVA", () => {
    const catalogo = [
      {
        id: "cb-1",
        ufficio_id: "ebd881c6-cc52-4fbe-a423-2bf1f8498e5c",
        partita_iva: "00077420701",
        codice_fiscale_azienda: "00077420701",
      },
    ];
    const skip = resolveCampobassoCliente(
      { Codice: "006931", Nome: "COMUNE X non usare", Stato: "non attivo", PIva: "00077420701" },
      catalogo,
    );
    expect(skip.esito).toBe("saltato");

    const link = resolveCampobassoCliente(
      { Codice: "007207", Nome: "COMUNE DI SANTA CROCE DI MAGLIANO", "F/G": "G", PIva: "00077420701" },
      catalogo,
    );
    expect(link.esito).toBe("collegare");
    expect(link.clienteId).toBe("cb-1");
    expect(link.tipoCliente).toBe("ente");
  });

  it("non collega CF spazzatura (**Errore**, XXXX)", () => {
    const catalogo = [
      {
        id: "dirty",
        ufficio_id: "327e92f7-64f0-48b9-9e48-73611d8cb406",
        codice_fiscale_azienda: "**Errore**",
      },
    ];
    const r = resolveCampobassoCliente(
      { Codice: "016898", Nome: "SAPIENZA MARTINA", "F/G": "F", CF: "**Errore**" },
      catalogo,
    );
    expect(r.esito).toBe("da_creare");
    expect(r.codiceFiscale).toBeNull();
  });

  it("Tammaro Carmela si collega per nome", () => {
    const hit = matchCatalogoCampobasso(
      { nome: "TAMMARO CARMELA" },
      [{ id: "t1", nome_norm: "CARMELA TAMMARO", codice_fiscale: "TMMCML48R71B519N" }],
    );
    expect(hit?.id).toBe("t1");
  });

  it("tiene una sola riga per lo stesso CF nel file", () => {
    const a = resolveCampobassoCliente({
      Codice: "007047",
      Nome: "FERRO GIUSEPPE",
      "F/G": "F",
      CF: "FRRGPP67H18B519B",
      Indirizzo: "VIA ROMA 1",
    });
    const b = resolveCampobassoCliente({
      Codice: "007422",
      Nome: "FERRO GIUSEPPE",
      "F/G": "F",
      CF: "FRRGPP67H18B519B",
    });
    const { keepers, dups } = pickKeepers([a, b]);
    expect(keepers).toHaveLength(1);
    expect(keepers[0].codice).toBe("007047");
    expect(dups[0].motivo).toMatch(/doppione_file/);
  });
});
