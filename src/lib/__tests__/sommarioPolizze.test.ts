import { describe, expect, it } from "vitest";
import type { AnalisiCgaDettaglio, AnalisiGaranziaRow } from "@/lib/portafoglioClienteAnalisi";
import {
  DEFAULT_SOMMARIO_LAYOUT,
  SOMMARIO_NOTA_BENE,
  SOMMARIO_SUMMARY_LABELS,
  VARESE_CLIENTE_ID,
  buildPdfSommarioCliente,
  buildSommarioDettaglioPolizze,
  buildSommarioSummaryRows,
  defaultLayoutKeyForCliente,
  formatDisdetta,
  formatFrazionamento,
  formatMora,
  formatRegolazione,
  isComuneDiVarese,
  parseSommarioLayoutJson,
  pickFranchigiaPrincipale,
  pickOggettoPolizza,
  prodottoSommarioLabel,
  sommarioStoragePath,
  type SommarioPolizzaRow,
} from "@/lib/sommarioPolizze";

const polizza = (over: Partial<SommarioPolizzaRow> = {}): SommarioPolizzaRow => ({
  id: "t1",
  numero_titolo: "116422887",
  stato: "attivo",
  ramo_nome: "Incendio",
  compagnia_nome: "GROUPAMA ASS.NI",
  premio_lordo: 200266.94,
  garanzia_da: "2025-01-01",
  garanzia_a: "2027-12-31",
  data_scadenza: "2027-12-31",
  tacito_rinnovo: true,
  prodotto_nome: "ALL RISKS",
  produttore_nome: null,
  nome_ufficio: null,
  ufficio_id: null,
  frazionamento: "Annuale",
  disdetta_giorni: 120,
  mora_giorni: 90,
  ...over,
});

describe("sommarioPolizze — cliente Varese e layout", () => {
  it("riconosce il Comune di Varese per id, ragione sociale e P.IVA", () => {
    expect(isComuneDiVarese({ id: VARESE_CLIENTE_ID })).toBe(true);
    expect(isComuneDiVarese({ ragione_sociale: "Comune di Varese" })).toBe(true);
    expect(isComuneDiVarese({ partita_iva: "00441340122" })).toBe(true);
    expect(isComuneDiVarese({ partita_iva: "00441340121" })).toBe(true);
    expect(isComuneDiVarese({ ragione_sociale: "Comune di Como" })).toBe(false);
    expect(defaultLayoutKeyForCliente({ ragione_sociale: "Comune di Varese" })).toBe("varese");
    expect(defaultLayoutKeyForCliente({ ragione_sociale: "Altro Ente" })).toBe("standard");
  });

  it("usa le colonne del Word Varese come default", () => {
    expect(DEFAULT_SOMMARIO_LAYOUT.summaryColumns).toEqual([
      "compagnia",
      "prodotto",
      "numero_polizza",
      "scadenza",
      "frazionamento",
      "premio_lordo",
    ]);
    expect(SOMMARIO_SUMMARY_LABELS.numero_polizza).toBe("Numero Polizza");
    expect(SOMMARIO_SUMMARY_LABELS.premio_lordo).toBe("Premio annuo lordo");
    expect(SOMMARIO_NOTA_BENE[0]).toContain("dati salienti delle polizze");
  });

  it("normalizza layout_json incompleto", () => {
    const parsed = parseSommarioLayoutJson({ includeNotaBene: false, summaryColumns: ["compagnia", "ignoto"] });
    expect(parsed.includeNotaBene).toBe(false);
    expect(parsed.summaryColumns).toEqual(["compagnia"]);
    expect(parsed.includeDettaglio).toBe(true);
    expect(parseSommarioLayoutJson(null).summaryColumns).toEqual(DEFAULT_SOMMARIO_LAYOUT.summaryColumns);
  });

  it("costruisce il path storage per cliente", () => {
    expect(sommarioStoragePath("abc", "SOMMARIO POLIZZE.docx")).toBe(
      "sommario/abc/SOMMARIO_POLIZZE.docx",
    );
  });
});

describe("sommarioPolizze — mapping campi titolo", () => {
  it("formatta disdetta, mora, frazionamento e regolazione come nel Word", () => {
    expect(formatDisdetta(120)).toBe("120 gg");
    expect(formatDisdetta(null)).toBe("—");
    expect(formatMora(90, null)).toBe("90 gg");
    expect(formatMora(null, "60 giorni")).toBe("60 giorni");
    expect(formatFrazionamento("Annuale", "semestrale")).toBe("Annuale");
    expect(formatFrazionamento(null, "Trimestrale")).toBe("Trimestrale");
    expect(formatRegolazione({ is_regolazione: false, regolazione: false })).toBe(
      "Polizza non soggetta alla Regolazione del Premio",
    );
    expect(formatRegolazione({ regolazione_note: "ELEMENTI VARIABILI: Beni mobili ed immobili" })).toBe(
      "ELEMENTI VARIABILI: Beni mobili ed immobili",
    );
    expect(formatRegolazione({ is_regolazione: true })).toBe("Soggetta a regolazione del premio");
  });

  it("compone le righe di sintesi del sommario", () => {
    const rows = buildSommarioSummaryRows([polizza()]);
    expect(rows).toHaveLength(1);
    expect(rows[0].compagnia).toBe("GROUPAMA ASS.NI");
    expect(rows[0].prodotto).toBe("ALL RISKS");
    expect(rows[0].numero_polizza).toBe("116422887");
    expect(rows[0].scadenza).toBe("31/12/2027");
    expect(rows[0].frazionamento).toBe("Annuale");
    expect(rows[0].premio_lordo_num).toBeCloseTo(200266.94);
    expect(prodottoSommarioLabel(polizza({ prodotto_nome: null }))).toBe("Incendio");
  });

  it("prende oggetto e franchigia da CGA / descrizione polizza", () => {
    const cga: AnalisiCgaDettaglio = {
      polizza_cga_id: "c1",
      titolo_id: "t1",
      numero_polizza: "116422887",
      prodotto_nome: "ALL RISKS",
      compagnia: "GROUPAMA",
      sommario: "Indennizza i danni materiali ai beni assicurati.",
      massimale_aggregato: 70_000_000,
      garanzie: [{ garanzia: "All risk", massimale: 70_000_000, franchigia: 2500, scoperto: null, note: null }],
      condizioni: [{ tipo: "esclusione", titolo: "Esclusioni", testo: "Guerra e atomo." }],
    };
    const gest: AnalisiGaranziaRow[] = [
      { titolo_id: "t1", numero_polizza: "116422887", garanzia: "Fabbricati", capitale: 406328000, firma: null, rata: null, tipo_premio: null },
    ];
    expect(pickOggettoPolizza(polizza({ descrizione_polizza: "Testo polizza" }), cga)).toBe("Testo polizza");
    expect(pickOggettoPolizza(polizza({ descrizione_polizza: null }), cga)).toBe(
      "Indennizza i danni materiali ai beni assicurati.",
    );
    expect(pickFranchigiaPrincipale(cga, gest)).toBe(
      (2500).toLocaleString("it-IT", { style: "currency", currency: "EUR" }),
    );

    const dett = buildSommarioDettaglioPolizze({
      polizze: [polizza({ regolazione_note: "ELEMENTI VARIABILI: Beni" })],
      garanzie: gest,
      cgaDettagli: [cga],
    });
    expect(dett[0].indice).toBe(1);
    expect(dett[0].titolo).toBe("ALL RISKS");
    expect(dett[0].disdetta).toBe("120 gg");
    expect(dett[0].mora).toBe("90 gg");
    expect(dett[0].regolazione).toContain("ELEMENTI VARIABILI");
    expect(dett[0].garanzie[0].garanzia).toBe("All risk");
    expect(dett[0].condizioni[0].titolo).toBe("Esclusioni");
  });

  it("genera un PDF sommario non vuoto", async () => {
    const bytes = await buildPdfSommarioCliente({
      clienteLabel: "Comune di Varese",
      polizze: [polizza()],
      garanzie: [],
      cgaDettagli: [],
      meta: { partitaIva: "00441340122" },
    });
    expect(bytes.byteLength).toBeGreaterThan(500);
    expect(bytes[0]).toBe(0x25); // %PDF
  });
});
