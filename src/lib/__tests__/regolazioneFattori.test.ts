import { describe, expect, it } from "vitest";
import {
  addRegolazioneFattoreRiga,
  addRegolazioneFattoriRighe,
  buildRegolazioneFattoriRows,
  createRegolazioneFattoreRiga,
  createRegolazioneFattoriCartesian,
  fattoreRegolazioneLabel,
  fattoriDisponibiliPerAnni,
  fattoriDisponibiliPerAnno,
  formatAnnoSlotLabel,
  formatIsoDateIt,
  regolazioneFattoreKey,
  removeRegolazioneFattoreRiga,
  rowsToInsertPayload,
  updateRegolazioneFattoreImporto,
  yearFromIsoDate,
  yearSlotsFromDatePresunte,
} from "@/lib/regolazioneFattori";

const fattori = [
  { id: "f1", codice: "fatturato", descrizione: "Fatturato" },
  { id: "f2", codice: "retribuzioni", descrizione: "Retribuzioni" },
];

describe("yearFromIsoDate", () => {
  it("estrae anno da ISO", () => {
    expect(yearFromIsoDate("2027-03-15")).toBe(2027);
  });
  it("fallback se data assente", () => {
    expect(yearFromIsoDate(null, 2028)).toBe(2028);
    expect(yearFromIsoDate("", 2028)).toBe(2028);
  });
  it("null senza data né fallback", () => {
    expect(yearFromIsoDate("")).toBeNull();
  });
});

describe("fattoreRegolazioneLabel", () => {
  it("usa solo la descrizione italiana, senza codice", () => {
    expect(
      fattoreRegolazioneLabel({ codice: "fatturato", descrizione: "Fatturato" }),
    ).toBe("Fatturato");
    expect(
      fattoreRegolazioneLabel({
        codice: "num_dipendenti",
        descrizione: "N° dipendenti",
      }),
    ).toBe("N° dipendenti");
    expect(
      fattoreRegolazioneLabel({
        codice: "superficie",
        descrizione: "Superficie (mq)",
      }),
    ).toBe("Superficie (mq)");
  });

  it("se manca la descrizione usa il catalogo standard, non lo snake_case", () => {
    expect(fattoreRegolazioneLabel({ codice: "valore_assicurato" })).toBe(
      "Valore assicurato",
    );
  });

  it("non concatena il codice tra parentesi", () => {
    const label = fattoreRegolazioneLabel({
      codice: "fatturato",
      descrizione: "Fatturato",
    });
    expect(label).not.toContain("(fatturato)");
    expect(label).not.toMatch(/num_dipendenti|valore_assicurato/);
  });
});

describe("formatIsoDateIt / formatAnnoSlotLabel", () => {
  it("formatta ISO in italiano", () => {
    expect(formatIsoDateIt("2027-06-30")).toBe("30/06/2027");
    expect(formatIsoDateIt(null)).toBeNull();
    expect(formatIsoDateIt("2027")).toBeNull();
  });

  it("etichetta anno pulita, senza ISO grezzo", () => {
    expect(formatAnnoSlotLabel({ anno: 2027, data_presunta: "2027-06-30" })).toBe(
      "2027 — 30/06/2027",
    );
    expect(formatAnnoSlotLabel({ anno: 2028, data_presunta: null })).toBe("2028");
    expect(formatAnnoSlotLabel({ anno: 2027, data_presunta: "2027-06-30" })).not.toContain(
      "2027-06-30",
    );
  });
});

describe("yearSlotsFromDatePresunte", () => {
  it("mappa date → slot anno", () => {
    expect(yearSlotsFromDatePresunte(["2027-03-15", "2028-03-15"])).toEqual([
      { anno: 2027, data_presunta: "2027-03-15" },
      { anno: 2028, data_presunta: "2028-03-15" },
    ]);
  });
  it("senza date → fallback", () => {
    expect(yearSlotsFromDatePresunte([], 2027)).toEqual([
      { anno: 2027, data_presunta: null },
    ]);
  });
});

describe("buildRegolazioneFattoriRows", () => {
  it("senza existing → lista vuota (non esplode catalogo)", () => {
    expect(
      buildRegolazioneFattoriRows({
        existing: [],
        fattori,
      }),
    ).toEqual([]);
  });

  it("costruisce solo da existing + arricchisce catalogo", () => {
    const rows = buildRegolazioneFattoriRows({
      existing: [
        { fattore_id: "f1", anno: 2027, importo_esposto: 100, data_presunta: "2027-03-15" },
        { fattore_id: "f2", anno: 2028, importo_esposto: 50 },
      ],
      fattori,
    });
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      key: regolazioneFattoreKey("f1", 2027),
      fattore_id: "f1",
      anno: 2027,
      importo_esposto: 100,
      data_presunta: "2027-03-15",
      fattore_codice: "fatturato",
      fattore_descrizione: "Fatturato",
    });
    expect(rows[1].fattore_codice).toBe("retribuzioni");
  });

  it("dedupe stesso fattore+anno", () => {
    const rows = buildRegolazioneFattoriRows({
      existing: [
        { fattore_id: "f1", anno: 2027, importo_esposto: 10 },
        { fattore_id: "f1", anno: 2027, importo_esposto: 99 },
      ],
      fattori,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].importo_esposto).toBe(10);
  });
});

describe("add / remove / update", () => {
  it("create + add + unique fattore+anno", () => {
    const a = createRegolazioneFattoreRiga({
      fattore: fattori[0],
      anno: 2027,
      data_presunta: "2027-03-15",
      importo_esposto: 12.5,
    });
    let righe = addRegolazioneFattoreRiga([], a);
    expect(righe).toHaveLength(1);
    const dup = createRegolazioneFattoreRiga({
      fattore: fattori[0],
      anno: 2027,
      importo_esposto: 99,
    });
    righe = addRegolazioneFattoreRiga(righe, dup);
    expect(righe).toHaveLength(1);
    expect(righe[0].importo_esposto).toBe(12.5);

    const b = createRegolazioneFattoreRiga({
      fattore: fattori[1],
      anno: 2027,
    });
    righe = addRegolazioneFattoreRiga(righe, b);
    expect(righe).toHaveLength(2);
  });

  it("remove e update importo", () => {
    const a = createRegolazioneFattoreRiga({ fattore: fattori[0], anno: 2027 });
    let righe = [a];
    righe = updateRegolazioneFattoreImporto(righe, a.key, 250);
    expect(righe[0].importo_esposto).toBe(250);
    righe = removeRegolazioneFattoreRiga(righe, a.key);
    expect(righe).toEqual([]);
  });

  it("fattoriDisponibiliPerAnno esclude già usati", () => {
    const righe = [
      createRegolazioneFattoreRiga({ fattore: fattori[0], anno: 2027 }),
    ];
    expect(fattoriDisponibiliPerAnno(fattori, righe, 2027).map((f) => f.id)).toEqual(["f2"]);
    expect(fattoriDisponibiliPerAnno(fattori, righe, 2028).map((f) => f.id)).toEqual([
      "f1",
      "f2",
    ]);
  });

  it("addRegolazioneFattoriRighe aggiunge più fattori e ignora duplicati", () => {
    const esistenti = [
      createRegolazioneFattoreRiga({ fattore: fattori[0], anno: 2027, importo_esposto: 10 }),
    ];
    const nuove = [
      createRegolazioneFattoreRiga({ fattore: fattori[0], anno: 2027, importo_esposto: 99 }),
      createRegolazioneFattoreRiga({ fattore: fattori[1], anno: 2027, importo_esposto: 20 }),
    ];
    const out = addRegolazioneFattoriRighe(esistenti, nuove);
    expect(out).toHaveLength(2);
    expect(out[0].importo_esposto).toBe(10);
    expect(out[1].fattore_id).toBe("f2");
  });

  it("fattoriDisponibiliPerAnni tiene i fattori ancora liberi su almeno un anno", () => {
    const righe = [
      createRegolazioneFattoreRiga({ fattore: fattori[0], anno: 2027 }),
    ];
    expect(fattoriDisponibiliPerAnni(fattori, righe, []).map((f) => f.id)).toEqual([
      "f1",
      "f2",
    ]);
    expect(fattoriDisponibiliPerAnni(fattori, righe, [2027]).map((f) => f.id)).toEqual(["f2"]);
    expect(fattoriDisponibiliPerAnni(fattori, righe, [2027, 2028]).map((f) => f.id)).toEqual([
      "f1",
      "f2",
    ]);
  });

  it("createRegolazioneFattoriCartesian produce fattore × anno e ignora chiavi duplicate", () => {
    const slots = [
      { anno: 2027, data_presunta: "2027-06-30" },
      { anno: 2028, data_presunta: "2028-06-30" },
    ];
    const cartesian = createRegolazioneFattoriCartesian(fattori, slots);
    expect(cartesian).toHaveLength(4);
    expect(cartesian.map((r) => r.key)).toEqual([
      "f1|2027",
      "f2|2027",
      "f1|2028",
      "f2|2028",
    ]);
    expect(cartesian[0].data_presunta).toBe("2027-06-30");
    expect(cartesian[2].data_presunta).toBe("2028-06-30");

    const esistenti = [
      createRegolazioneFattoreRiga({
        fattore: fattori[0],
        anno: 2027,
        data_presunta: "2027-06-30",
        importo_esposto: 10,
      }),
    ];
    const merged = addRegolazioneFattoriRighe(esistenti, cartesian);
    expect(merged).toHaveLength(4);
    expect(merged[0].importo_esposto).toBe(10);
  });
});

describe("rowsToInsertPayload", () => {
  it("mappa campi DB solo per righe presenti", () => {
    const rows = [
      createRegolazioneFattoreRiga({
        fattore: fattori[0],
        anno: 2027,
        data_presunta: "2027-03-15",
        importo_esposto: 12.5,
      }),
    ];
    expect(rowsToInsertPayload("t1", "r1", rows)).toEqual([
      {
        titolo_id: "t1",
        ramo_id: "r1",
        fattore_id: "f1",
        importo_esposto: 12.5,
        anno: 2027,
        data_presunta: "2027-03-15",
      },
    ]);
    expect(rowsToInsertPayload("t1", "r1", [])).toEqual([]);
  });
});
