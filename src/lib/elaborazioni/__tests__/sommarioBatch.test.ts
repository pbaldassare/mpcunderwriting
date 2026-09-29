import { describe, expect, it } from "vitest";
import type { SommarioPolizzaRow } from "@/lib/sommarioPolizze";
import {
  applyElaborazioneCampiToPolizze,
  applyElaborazioneCampiToSommario,
  buildCgaFromElaborazioneCampi,
  defaultSelectedTitoloIds,
  mergeCgaDettagli,
  preferDocumentoPerPolizza,
  toggleId,
} from "@/lib/elaborazioni/sommarioBatch";

const p = (over: Partial<SommarioPolizzaRow> = {}): SommarioPolizzaRow => ({
  id: "t1",
  numero_titolo: "116422887",
  stato: "attivo",
  ramo_nome: "Incendio",
  compagnia_nome: "GROUPAMA",
  premio_lordo: 1000,
  garanzia_da: "2026-01-01",
  garanzia_a: "2026-12-31",
  data_scadenza: "2026-12-31",
  tacito_rinnovo: true,
  prodotto_nome: "ALL RISKS",
  produttore_nome: null,
  nome_ufficio: null,
  ufficio_id: null,
  ...over,
});

describe("sommarioBatch selezione", () => {
  it("preseleziona solo le vigenti", () => {
    expect(
      defaultSelectedTitoloIds([
        { id: "a", stato: "attivo" },
        { id: "b", stato: "scaduto" },
        { id: "c", stato: "incassato" },
      ]),
    ).toEqual(["a", "c"]);
  });

  it("se non ci sono vigenti prende tutte", () => {
    expect(defaultSelectedTitoloIds([{ id: "x", stato: "annullato" }])).toEqual(["x"]);
  });

  it("toggle aggiunge e toglie", () => {
    expect(toggleId(["a"], "b")).toEqual(["a", "b"]);
    expect(toggleId(["a", "b"], "a")).toEqual(["b"]);
  });
});

describe("sommarioBatch integrazione campi IA", () => {
  it("non sovrascrive i dati CBnet già presenti", () => {
    const out = applyElaborazioneCampiToSommario(p(), {
      prodotto: "Altro",
      compagnia: "XL",
      premio_lordo: 9,
      garanzie: "Oggetto IA",
    });
    expect(out.prodotto_nome).toBe("ALL RISKS");
    expect(out.compagnia_nome).toBe("GROUPAMA");
    expect(out.premio_lordo).toBe(1000);
    expect(out.descrizione_polizza).toBe("Oggetto IA");
  });

  it("riempie i buchi dalla estrazione", () => {
    const out = applyElaborazioneCampiToPolizze(
      [p({ prodotto_nome: null, descrizione_polizza: null, frazionamento: null })],
      { t1: { prodotto: "RC Drone", frazionamento: "Annuale", garanzie: "RCT drone" } },
    );
    expect(out[0].prodotto_nome).toBe("RC Drone");
    expect(out[0].frazionamento).toBe("Annuale");
    expect(out[0].descrizione_polizza).toBe("RCT drone");
  });

  it("costruisce CGA sintetica e non duplica se già presente", () => {
    const cga = buildCgaFromElaborazioneCampi(p(), {
      massimale: 70000000,
      franchigia: 2500,
      garanzie: "Fabbricati; Contenuto",
      esclusioni: "Guerra",
    });
    expect(cga?.garanzie).toHaveLength(2);
    expect(cga?.garanzie[0].garanzia).toBe("Fabbricati");
    expect(cga?.condizioni[0].titolo).toBe("Esclusioni");
    const merged = mergeCgaDettagli(
      [{
        polizza_cga_id: "real",
        titolo_id: "t1",
        numero_polizza: "116422887",
        prodotto_nome: null,
        compagnia: null,
        sommario: "già",
        massimale_aggregato: null,
        garanzie: [],
        condizioni: [],
      }],
      [cga],
    );
    expect(merged).toHaveLength(1);
    expect(merged[0].polizza_cga_id).toBe("real");
  });

  it("preferisce il documento CGA", () => {
    const pick = preferDocumentoPerPolizza([
      { id: "1", categoria: "polizza", nome_file: "polizza.pdf" },
      { id: "2", categoria: "altro", nome_file: "CGA_allrisk.pdf" },
    ]);
    expect(pick?.id).toBe("2");
  });
});
