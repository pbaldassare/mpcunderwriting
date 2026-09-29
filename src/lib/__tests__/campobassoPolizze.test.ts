import { describe, expect, it } from "vitest";
import {
  excelSerialToIso,
  mapCompagniaCodice,
  mapRateToFrazionamento,
  mapValuta,
  padClienteCodice,
  planCampobassoPolizze,
  resolveCampobassoGruppo,
  type CampobassoCatalogs,
  type CampobassoPolizzaRiga,
} from "@/lib/campobassoPolizze";

const catalogs: CampobassoCatalogs = {
  clientiByCodice: {
    "007527": "cli-rocca",
    "017400": "cli-onroad",
    "014414": "cli-camera-wrong",
  },
  ramiByCodice: {
    NA: { id: "ramo-na", descrizione: "INFORTUNI CONDUCENTE" },
    LT: { id: "ramo-lt", descrizione: "GLOBALE FABBRICATO" },
    PR: { id: "ramo-pr", descrizione: "R. C. PROFESSIONALE" },
  },
  compagnieByCodice: {
    CAT101: "comp-cat101",
    REA121: "comp-rea121",
  },
  existingMadri: [{ numero: "GIA-ORFANA", compagniaId: "comp-cat101" }],
};

function riga(partial: Partial<CampobassoPolizzaRiga>): CampobassoPolizzaRiga {
  return {
    ID: "1",
    CdClie: "007527",
    CdComp: "CAT110",
    CdRamo: "NA",
    Ramo: "INFORTUNI CONDUCENTE",
    Polizza: "731216122",
    TipoDoc: "PI",
    Valuta: "EURO",
    Premio: 345,
    Imponibile: 336.58,
    Tasse: 8.42,
    Attive: 67.32,
    "Iniz Pol": "10/31/25",
    "Scad Pol": "10/31/26",
    "Iniz Gar": "10/31/25",
    "Scad Gar": "10/31/26",
    "Dt Incasso": "11/11/25",
    Rate: "1",
    Rinnovo: "R",
    "%Riparto": "100",
    ...partial,
  };
}

describe("helpers Campobasso polizze", () => {
  it("parsa date US del file e serial Excel", () => {
    expect(excelSerialToIso("10/31/25")).toBe("2025-10-31");
    expect(excelSerialToIso("11/13/24")).toBe("2024-11-13");
    expect(excelSerialToIso("31/10/2025")).toBe("2025-10-31");
  });

  it("mappa CAT110 su CAT101 e ferma le compagnie senza codice", () => {
    expect(mapCompagniaCodice("CAT110")).toBe("CAT101");
    expect(mapCompagniaCodice("CAT101")).toBe("CAT101");
    expect(mapCompagniaCodice("AMTRUS")).toBeNull();
    expect(mapCompagniaCodice("UNI107")).toBeNull();
  });

  it("mappa rate, valuta e codice cliente", () => {
    expect(mapRateToFrazionamento(1)).toBe("Annuale");
    expect(mapRateToFrazionamento(2)).toBe("Semestrale");
    expect(mapRateToFrazionamento(3)).toBe("Quadrimestrale");
    expect(mapRateToFrazionamento(0)).toBe("Rata unica");
    expect(mapValuta("EURO")).toBe("EUR");
    expect(padClienteCodice(7527)).toBe("007527");
  });
});

describe("resolveCampobassoGruppo", () => {
  it("da un PI annuale crea frontespizio senza cassa e quietanza incassata", () => {
    const g = resolveCampobassoGruppo([riga({})], catalogs);
    expect(g.esito).toBe("da_creare");
    expect(g.madre?.stato).toBe("attivo");
    expect(g.madre?.dataMessaCassa).toBeNull();
    expect(g.madre?.compagniaCodice).toBe("CAT101");
    expect(g.madre?.compagniaId).toBe("comp-cat101");
    expect(g.madre?.tacitoRinnovo).toBe(true);
    expect(g.quietanze).toHaveLength(1);
    expect(g.quietanze[0].stato).toBe("incassato");
    expect(g.quietanze[0].dataMessaCassa).toBe("2025-11-11");
    expect(g.quietanze[0].sostituiscePolizza).toBe("731216122");
    expect(g.quietanze[0].premioLordo).toBe(345);
    expect(g.appendici).toHaveLength(0);
  });

  it("con PI+PQ non clona il PI: quietanza solo dalla PQ", () => {
    const g = resolveCampobassoGruppo(
      [
        riga({ TipoDoc: "PI", Premio: 100, Imponibile: 80, Tasse: 20, "Dt Incasso": "01/15/25" }),
        riga({
          TipoDoc: "PQ",
          Premio: 50,
          Imponibile: 40,
          Tasse: 10,
          "Iniz Gar": "07/15/25",
          "Scad Gar": "01/15/26",
          "Dt Incasso": "07/20/25",
        }),
      ],
      catalogs,
    );
    expect(g.quietanze).toHaveLength(1);
    expect(g.quietanze[0].premioLordo).toBe(50);
    expect(g.quietanze[0].garanziaDa).toBe("2025-07-15");
    expect(g.madre?.premioLordo).toBe(100);
    expect(g.madre?.dataMessaCassa).toBeNull();
  });

  it("mette AM/PR/DP/PS come appendici /AM n", () => {
    const g = resolveCampobassoGruppo(
      [
        riga({ TipoDoc: "PI" }),
        riga({ TipoDoc: "AM", Premio: 10, Appendice: "variazione" }),
        riga({ TipoDoc: "PR", Premio: 20 }),
        riga({ TipoDoc: "DP", Premio: 0, Rate: 0 }),
        riga({ TipoDoc: "PS", Premio: -15 }),
      ],
      catalogs,
    );
    expect(g.appendici.map((a) => a.numeroTitolo)).toEqual([
      "731216122/AM1",
      "731216122/AM2",
      "731216122/AM3",
      "731216122/AM4",
    ]);
    expect(g.appendici.every((a) => a.isAppendiceModifica)).toBe(true);
    expect(g.appendici[0].appendice).toBe("variazione");
    expect(g.appendici[1].note).toContain("TipoDoc gestionale: PR");
    expect(g.appendici[3].premioLordo).toBe(-15);
  });

  it("su solo appendice crea il frontespizio a zero e la riga AM, senza quietanza", () => {
    const g = resolveCampobassoGruppo([riga({ TipoDoc: "AM", Premio: 80 })], catalogs);
    expect(g.madre?.premioLordo).toBe(0);
    expect(g.madre?.dataMessaCassa).toBeNull();
    expect(g.quietanze).toHaveLength(0);
    expect(g.appendici).toHaveLength(1);
    expect(g.appendici[0].premioLordo).toBe(80);
    expect(g.appendici[0].stato).toBe("incassato");
  });

  it("non importa compagnie senza codice e clienti in attesa", () => {
    expect(resolveCampobassoGruppo([riga({ CdComp: "AMTRUS" })], catalogs).motivo).toMatch(
      /Compagnia non in anagrafica/,
    );
    expect(resolveCampobassoGruppo([riga({ CdClie: "014414" })], catalogs).motivo).toMatch(
      /Cliente in attesa/,
    );
    expect(
      resolveCampobassoGruppo([riga({ Polizza: "GIA-ORFANA" })], catalogs).motivo,
    ).toMatch(/orfana/);
  });

  it("Rinnovo diverso da R non forza il tacito", () => {
    const g = resolveCampobassoGruppo([riga({ Rinnovo: "A", Rate: 2 })], catalogs);
    expect(g.madre?.tacitoRinnovo).toBe(false);
    expect(g.madre?.frazionamento).toBe("Semestrale");
  });
});

describe("planCampobassoPolizze", () => {
  it("raggruppa per numero + compagnia mappata e conta skip/create", () => {
    const plan = planCampobassoPolizze(
      [
        riga({ Polizza: "A1", TipoDoc: "PI" }),
        riga({ Polizza: "A1", TipoDoc: "AM" }),
        riga({ Polizza: "B1", CdComp: "AMTRUS" }),
        riga({ Polizza: "C1", CdClie: "016841" }),
      ],
      catalogs,
    );
    expect(plan.stats.madri).toBe(1);
    expect(plan.stats.appendici).toBe(1);
    expect(plan.stats.quietanze).toBe(1);
    expect(plan.stats.saltati).toBe(2);
  });
});
