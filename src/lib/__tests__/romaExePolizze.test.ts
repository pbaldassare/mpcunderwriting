import { describe, expect, it } from "vitest";
import {
  buildNumeroTitolo,
  excelSerialToIso,
  isPlaceholderNumero,
  mapFrazionamentoExe,
  matchMadrePerSospeso,
  quotaToPercentuale,
  resolveRomaExePolizza,
  resolveRomaExeSospeso,
} from "@/lib/romaExePolizze";

const rami = [
  { id: "ramo-pb", codice: "PB", descrizione: "RESP. CIVILE VERSO TERZI" },
  { id: "ramo-fid", codice: "FID", descrizione: "FIDEJUSSIONE" },
  { id: "ramo-cc", codice: "CC", descrizione: "CREDITO COMMERCIALE" },
];

const compagnieMap = [
  { exe_nome: "GENERALI ASS.NI", compagnia_id: "comp-gen", esito: "creata" },
  { exe_nome: "EXE INSURANCE BROKER", compagnia_id: null, esito: "saltata" },
];

const clientiMap = [{ exe_codice: "10001", cliente_id: "cli-scala" }];

describe("date / numeri / frazionamento", () => {
  it("converte serial Excel e date IT", () => {
    expect(excelSerialToIso(36446)).toBe("1999-10-13");
    expect(excelSerialToIso("03/07/2022")).toBe("2022-07-03");
  });

  it("riconosce placeholder e quota EXE", () => {
    expect(isPlaceholderNumero("emitt")).toBe(true);
    expect(isPlaceholderNumero("NON NS")).toBe(true);
    expect(isPlaceholderNumero("766252638")).toBe(false);
    expect(quotaToPercentuale(1000)).toBe(100);
    expect(quotaToPercentuale(500)).toBe(50);
    expect(mapFrazionamentoExe("Una Tantum")).toBe("Rata unica");
    expect(mapFrazionamentoExe("Semestrale")).toBe("Semestrale");
  });

  it("disambigua i numeri sporchi", () => {
    const taken = new Set<string>();
    const a = buildNumeroTitolo({
      exeNumero: "emitt",
      clienteCodice: 10001,
      ramoCodice: 60,
      compagniaId: "c1",
      scadenza: "2026-12-31",
      seq: 1,
      taken,
    });
    const b = buildNumeroTitolo({
      exeNumero: "emitt",
      clienteCodice: 10001,
      ramoCodice: 60,
      compagniaId: "c1",
      scadenza: "2026-12-31",
      seq: 2,
      taken,
    });
    expect(a.numero).toBe("RM2-10001-60-1");
    expect(b.numero).toBe("RM2-10001-60-2");
    expect(a.emittenda).toBe(true);
  });
});

describe("resolveRomaExePolizza", () => {
  it("crea la madre e tiene il prossimo quietanzamento in competenza", () => {
    const hit = resolveRomaExePolizza(
      {
        numero: "766252638",
        clienteCodice: 10001,
        clienteNome: "SCALA DR MARIA CRISTINA",
        effetto: 36446,
        scadenza: 46308,
        primoQuietanzamento: 46125,
        premioLordo: 1300.74,
        imponibileFuture: 532,
        tasseFuture: 118.37,
        provvigioniAttive: 88.52,
        frazionamento: "Semestrale",
        gruppoNome: "C.E.P.",
        ramoCodice: 60,
        ramoDescrizione: "RESP.CIVILE VERSO TERZI",
        compagniaNome: "GENERALI ASS.NI",
        quota: 1000,
      },
      1,
      { rami, compagnieMap, clientiMap, taken: new Set() },
    );
    expect(hit.esito).toBe("da_creare");
    expect(hit.tipo).toBe("polizza");
    expect(hit.sostituiscePolizza).toBeNull();
    expect(hit.dataCompetenza).toBe("2026-04-13");
    expect(hit.frazionamento).toBe("Semestrale");
    expect(hit.premioLordo).toBe(1300.74);
    expect(hit.note).toContain("C.E.P.");
    expect(hit.note).toContain("532");
  });

  it("salta EXE Insurance Broker e cliente assente", () => {
    const hit = resolveRomaExePolizza(
      {
        numero: "NON NS",
        clienteCodice: 99999,
        effetto: 45000,
        scadenza: 46000,
        ramoCodice: 60,
        compagniaNome: "EXE INSURANCE BROKER",
        premioLordo: 10,
        quota: 1000,
      },
      9,
      { rami, compagnieMap, clientiMap, taken: new Set() },
    );
    expect(hit.esito).toBe("saltata");
    expect(hit.motivo).toMatch(/Cliente|Compagnia/);
  });
});

describe("sospesi", () => {
  it("aggancia la quietanza alla madre e marca sospeso", () => {
    const madre = resolveRomaExePolizza(
      {
        numero: "7666569471",
        clienteCodice: 10001,
        effetto: 44000,
        scadenza: 46000,
        ramoCodice: 42,
        ramoDescrizione: "CAUZIONI",
        compagniaNome: "GENERALI ASS.NI",
        premioLordo: 2000,
        quota: 1000,
        frazionamento: "Semestrale",
      },
      1,
      { rami, compagnieMap, clientiMap, taken: new Set() },
    );
    const q = resolveRomaExeSospeso(
      {
        numero: "7666569471 ",
        appendice: "PIANO DI RIENTRO",
        compagniaNome: "GENERALI ASS.NI",
        rischio: "CAUZIONI",
        effetto: "03/07/2022",
        scadenza: "03/01/2023",
        importo: 2335.9,
        importoResiduo: 2335.9,
        clienteNome: "IMM.RE DOMIZIA SRL",
      },
      1,
      { madri: [madre], rami, compagnieMap, clientiMap, nextRiga: new Map() },
    );
    expect(matchMadrePerSospeso({ numero: "7666569471 " }, [madre])?.numeroTitolo).toBe("7666569471");
    expect(q.esito).toBe("da_creare");
    expect(q.tipo).toBe("quietanza");
    expect(q.stato).toBe("sospeso");
    expect(q.sostituiscePolizza).toBe("7666569471");
    expect(q.riga).toBe(2);
    expect(q.premioLordo).toBe(2335.9);
    expect(q.motivoSospensione).toBe("PIANO DI RIENTRO");
  });

  it("mappa CREDITO sul catalogo CBnet per gli orfani", () => {
    const q = resolveRomaExeSospeso(
      {
        numero: "3057963",
        compagniaNome: "GENERALI ASS.NI",
        rischio: "CREDITO",
        effetto: "01/11/2024",
        scadenza: "31/01/2025",
        importo: 3076,
        clienteNome: "SCALA DR MARIA CRISTINA",
      },
      2,
      {
        madri: [],
        rami,
        compagnieMap,
        clientiMap: [{ cliente_id: "cli-scala", ragione_sociale: "SCALA DR MARIA CRISTINA" }],
        nextRiga: new Map(),
      },
    );
    expect(q.esito).toBe("da_creare");
    expect(q.motivo).toMatch(/orfano/i);
    expect(q.ramoId).toBe("ramo-cc");
    expect(q.clienteId).toBe("cli-scala");
  });
});
