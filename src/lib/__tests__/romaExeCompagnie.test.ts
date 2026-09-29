import { describe, expect, it } from "vitest";
import {
  anagraficaCollegabile,
  canonRomaExeCompagnia,
  inferTipoCompagnia,
  isSedeLocaleNome,
  lookupRomaExeCompagniaId,
  matchCatalogoCompagnia,
  normalizeCompagniaNome,
  resolveRomaExeCompagnia,
} from "@/lib/romaExeCompagnie";

const catalogo = [
  { id: "itas", nome: "ITAS MUTUA", codice: "B0836", tipo: "plurimandataria" },
  { id: "allianz", nome: "ALLIANZ SPA", codice: "B0582", tipo: "plurimandataria" },
  { id: "allianz-dir", nome: "allianz direzione", codice: "ALL123", tipo: "direzione" },
  { id: "generali-sd", nome: "GENERALI ITALIA S.P.A. - AG. SAN DONA' DI PIAVE", codice: "B0007", tipo: "plurimandataria" },
  { id: "chubb", nome: "CHUBB EUROPEAN GROUP SE - INSURANCE", codice: "CHU000", tipo: "direzione" },
  { id: "revo", nome: "REVO Insurance S.p.A.  direzione", codice: "ELBA", tipo: "direzione" },
  { id: "aig", nome: "AIG EUROPE LIMITED in Italia", codice: "AIG000", tipo: "direzione" },
];

const gruppi = [
  { id: "g-gen", descrizione: "GENERALI ITALIA" },
  { id: "g-all", descrizione: "ALLIANZ" },
  { id: "g-itas", descrizione: "ITAS" },
];

describe("normalize + alias", () => {
  it("espande ASS.NI e unisce i Generali", () => {
    expect(normalizeCompagniaNome("GENERALI ASS.NI")).toBe("GENERALI ASSICURAZIONI");
    expect(canonRomaExeCompagnia("GENERALI ASS.NI").canonical).toBe("GENERALI ITALIA SPA");
    expect(canonRomaExeCompagnia("GENERALI ASS.NI VITA").canonical).toBe("GENERALI ITALIA SPA");
    expect(canonRomaExeCompagnia("GENERALI ITALIA SPA").canonical).toBe("GENERALI ITALIA SPA");
  });

  it("unisce Unipol / Itas / Chubb / Revo / Lloyd's", () => {
    expect(canonRomaExeCompagnia("UNIPOL ASS.NI SPA  - VITA").canonical).toBe("UNIPOL ASSICURAZIONI SPA");
    expect(canonRomaExeCompagnia("ITAS").canonical).toBe("ITAS MUTUA");
    expect(canonRomaExeCompagnia("CHUBB EUROPEAN GROUP LIMITED").canonical).toBe("CHUBB EUROPEAN GROUP SE");
    expect(canonRomaExeCompagnia("ELBA ASS.NI").canonical).toBe("REVO INSURANCE SPA");
    expect(canonRomaExeCompagnia("LLOYD'S INSURANCE COMPANY S.A. - ENTI PUBBLICI").canonical).toBe(
      "LLOYD'S INSURANCE COMPANY S.A.",
    );
  });

  it("salta EXE Insurance Broker", () => {
    expect(canonRomaExeCompagnia("EXE INSURANCE BROKER").skip).toBe(true);
  });
});

describe("match catalogo", () => {
  it("non collega Generali all'agenzia di San Donà", () => {
    expect(isSedeLocaleNome("GENERALI ITALIA S.P.A. - AG. SAN DONA' DI PIAVE")).toBe(true);
    expect(isSedeLocaleNome("ROLAND RECHTSSCHUTZ VERSICHERUNGS AG")).toBe(false);
    expect(matchCatalogoCompagnia("GENERALI ASS.NI", catalogo)).toBeNull();
  });

  it("riusa ITAS MUTUA e ALLIANZ SPA esistenti", () => {
    expect(matchCatalogoCompagnia("ITAS MUTUA", catalogo)?.id).toBe("itas");
    expect(matchCatalogoCompagnia("ALLIANZ SPA", catalogo)?.id).toBe("allianz-dir");
    expect(matchCatalogoCompagnia("CHUBB EUROPEAN GROUP LIMITED", catalogo)?.id).toBe("chubb");
    expect(matchCatalogoCompagnia("REVO INSURANCE SPA", catalogo)?.id).toBe("revo");
  });

  it("non crea direzione se manca il gruppo", () => {
    const hit = resolveRomaExeCompagnia("CGPA EUROPE S.A.", [], []);
    expect(hit?.esito).toBe("da_creare");
    expect(hit?.tipo).toBe("plurimandataria");
  });

  it("non aggancia un gruppo per sottostringa corta (DAS in VIDASA)", () => {
    const hit = resolveRomaExeCompagnia("GAMALIFE - COMPANHIA DE SEGUROS DE VIDA SA", [], [
      { id: "g-das", descrizione: "DAS" },
    ]);
    expect(hit?.gruppoCompagniaId).toBeNull();
    expect(hit?.tipo).toBe("plurimandataria");
  });

  it("crea Generali come direzione se c'è il gruppo", () => {
    const hit = resolveRomaExeCompagnia("GENERALI ASS.NI", catalogo, gruppi);
    expect(hit?.esito).toBe("da_creare");
    expect(hit?.tipo).toBe("direzione");
    expect(hit?.gruppoCompagniaId).toBe("g-gen");
    expect(hit?.canonical).toBe("GENERALI ITALIA SPA");
  });
});

describe("tipo e anagrafica", () => {
  it("deduce agenzia / broker / direzione dalla ragione sociale", () => {
    expect(inferTipoCompagnia("AXA QUIRINALE")).toBe("agenzia");
    expect(inferTipoCompagnia("EXE INSURANCE BROKER")).toBe("broker");
    expect(inferTipoCompagnia("ITAS MUTUA")).toBe("direzione");
  });

  it("collega indirizzo/IBAN solo senza aggiuntiva", () => {
    expect(anagraficaCollegabile("")).toBe(true);
    expect(anagraficaCollegabile("CLAUDIA ROSSI & C SRL")).toBe(false);
  });
});

describe("link rami + compagnie", () => {
  it("risolve insieme ramo e compagnia", async () => {
    const { resolveRomaExeRefs } = await import("@/lib/romaExeLink");
    const refs = resolveRomaExeRefs(
      { ramoCodice: "15", ramoDescrizione: "GLOBALE ESERCIZI", compagniaNome: "ITAS MUTUA" },
      {
        rami: [{ id: "ramo-lq", codice: "LQ", gruppo_ramo_id: "g-zl" }],
        compagnie: catalogo,
        gruppi,
      },
    );
    expect(refs.ramo?.ramoCodice).toBe("LQ");
    expect(refs.compagnia?.compagniaId).toBe("itas");
  });
});

describe("lookupRomaExeCompagniaId", () => {
  const map = [
    { exe_codice: "316", exe_nome: "GENERALI ASS.NI", compagnia_id: "gen-1", esito: "creata" },
    { exe_codice: "615", exe_nome: "ITAS MUTUA", compagnia_id: "itas", esito: "esistente" },
    { exe_codice: null, exe_nome: "EXE INSURANCE BROKER", compagnia_id: null, esito: "saltata" },
  ];

  it("collega per codice EXE e per nome", () => {
    expect(lookupRomaExeCompagniaId("316", "GENERALI ASS.NI", map)).toBe("gen-1");
    expect(lookupRomaExeCompagniaId(null, "GENERALI ITALIA SPA", map)).toBe("gen-1");
    expect(lookupRomaExeCompagniaId("615", null, map)).toBe("itas");
  });

  it("non assegna compagnia a EXE Insurance Broker", () => {
    expect(lookupRomaExeCompagniaId(null, "EXE INSURANCE BROKER", map)).toBeNull();
  });
});
