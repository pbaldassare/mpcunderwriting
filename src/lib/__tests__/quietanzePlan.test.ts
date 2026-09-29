import { describe, it, expect } from "vitest";
import { computeQuietanzePlan, computeQuietanzeOnly, nextQuietanzaAfterMessaCassa } from "../quietanzePlan";

const base = { garanziaDa: "2026-01-01", garanziaA: "2027-01-01", dataCompetenza: "2026-01-15" };

describe("computeQuietanzePlan", () => {
  it("polizza temporanea → una sola quietanza sul periodo indicato", () => {
    const plan = computeQuietanzePlan({
      polizzaTemporanea: true,
      garanziaDa: "2026-06-22",
      garanziaA: "2026-07-15",
      dataCompetenza: "2026-06-22",
    });
    expect(plan).toHaveLength(1);
    expect(plan[0]).toEqual({
      idx: 1,
      garanzia_da: "2026-06-22",
      garanzia_a: "2026-07-15",
      data_competenza: "2026-06-22",
    });
    expect(computeQuietanzeOnly({ polizzaTemporanea: true, garanziaDa: "2026-06-22", garanziaA: "2026-07-15" })).toHaveLength(0);
  });

  it("Annuale 1 anno → solo madre (1 riga)", () => {
    const plan = computeQuietanzePlan({ ...base, frazionamento: "Annuale", anniDurata: 1 });
    expect(plan).toHaveLength(1);
    expect(computeQuietanzeOnly({ ...base, frazionamento: "Annuale", anniDurata: 1 })).toHaveLength(0);
  });

  it("Annuale 3 anni → 3 righe (madre + 2 quietanze)", () => {
    const plan = computeQuietanzePlan({ ...base, frazionamento: "Annuale", anniDurata: 3 });
    expect(plan).toHaveLength(3);
    expect(plan[1].garanzia_da).toBe("2027-01-01");
    expect(plan[2].garanzia_da).toBe("2028-01-01");
  });

  it("Semestrale 1 anno → 2 righe (madre + 1 quietanza)", () => {
    const plan = computeQuietanzePlan({ ...base, frazionamento: "Semestrale", anniDurata: 1 });
    expect(plan).toHaveLength(2);
    expect(plan[1].garanzia_da).toBe("2026-07-01");
    expect(plan[1].garanzia_a).toBe("2027-01-01");
  });

  it("Trimestrale 1 anno → 4 righe (madre + 3 quietanze)", () => {
    const plan = computeQuietanzePlan({ ...base, frazionamento: "Trimestrale", anniDurata: 1 });
    expect(plan.map((r) => r.garanzia_da)).toEqual([
      "2026-01-01",
      "2026-04-01",
      "2026-07-01",
      "2026-10-01",
    ]);
  });

  it("Mensile 1 anno → 12 righe (madre + 11 quietanze)", () => {
    const plan = computeQuietanzePlan({ ...base, frazionamento: "Mensile", anniDurata: 1 });
    expect(plan).toHaveLength(12);
    expect(plan[11].garanzia_da).toBe("2026-12-01");
  });

  it("Quadrimestrale 1 anno → 3 righe", () => {
    const plan = computeQuietanzePlan({ ...base, frazionamento: "Quadrimestrale", anniDurata: 1 });
    expect(plan).toHaveLength(3);
    expect(plan[2].garanzia_da).toBe("2026-09-01");
  });

  it("Rata unica biennale → 1 quietanza sull'intero periodo", () => {
    const plan = computeQuietanzePlan({
      frazionamento: "Rata unica",
      anniDurata: 2,
      garanziaDa: "2026-09-01",
      garanziaA: "2028-09-01",
      durataDa: "2026-09-01",
      durataA: "2028-09-01",
    });
    expect(plan).toHaveLength(1);
    expect(plan[0]).toMatchObject({
      idx: 1,
      garanzia_da: "2026-09-01",
      garanzia_a: "2028-09-01",
    });
  });

  it("Poliennale 3 anni → 3 quietanze annuali", () => {
    const plan = computeQuietanzePlan({ ...base, frazionamento: "Poliennale", anniDurata: 3 });
    expect(plan).toHaveLength(3);
    expect(plan[0].garanzia_da).toBe("2026-01-01");
    expect(plan[1].garanzia_da).toBe("2027-01-01");
    expect(plan[2].garanzia_da).toBe("2028-01-01");
  });

  it("Poliennale 1 anno → 1 quietanza", () => {
    expect(computeQuietanzePlan({ ...base, frazionamento: "Poliennale", anniDurata: 1 })).toHaveLength(1);
  });

  it("data_competenza opzionale: trasla in parallelo alla garanzia", () => {
    const plan = computeQuietanzePlan({ ...base, frazionamento: "Semestrale", anniDurata: 1 });
    expect(plan[0].data_competenza).toBe("2026-01-15");
    expect(plan[1].data_competenza).toBe("2026-07-15");
  });

  it("senza garanzie → plan vuoto", () => {
    expect(computeQuietanzePlan({ frazionamento: "Mensile", anniDurata: 1 })).toEqual([]);
  });

  it("frazionamento mancante → plan vuoto", () => {
    expect(computeQuietanzePlan({ ...base, frazionamento: "", anniDurata: 1 })).toEqual([]);
  });

  it("polizza rateo semestrale → primo rateo libero + slot frazionamento fino a durata_a", () => {
    const plan = computeQuietanzePlan({
      polizzaRateo: true,
      frazionamento: "Semestrale",
      anniDurata: 1,
      garanziaDa: "2026-03-15",
      garanziaA: "2026-04-30",
      durataA: "2027-03-14",
    });
    expect(plan).toHaveLength(3);
    expect(plan[0]).toEqual({
      idx: 1,
      garanzia_da: "2026-03-15",
      garanzia_a: "2026-04-30",
      data_competenza: "2026-03-15",
    });
    expect(plan[1]).toEqual({
      idx: 2,
      garanzia_da: "2026-04-30",
      garanzia_a: "2026-10-30",
      data_competenza: "2026-04-30",
    });
    expect(plan[2]).toEqual({
      idx: 3,
      garanzia_da: "2026-10-30",
      garanzia_a: "2027-03-14",
      data_competenza: "2026-10-30",
    });
    expect(computeQuietanzeOnly({
      polizzaRateo: true,
      frazionamento: "Semestrale",
      garanziaDa: "2026-03-15",
      garanziaA: "2026-04-30",
      durataA: "2027-03-14",
    })).toHaveLength(2);
  });

  it("polizza rateo senza durata_a → plan vuoto", () => {
    expect(computeQuietanzePlan({
      polizzaRateo: true,
      frazionamento: "Semestrale",
      garanziaDa: "2026-03-15",
      garanziaA: "2026-04-30",
    })).toEqual([]);
  });

  it("polizza rateo annuale 1 anno → 2 quietanze (rateo + 1 rata annua)", () => {
    const plan = computeQuietanzePlan({
      polizzaRateo: true,
      frazionamento: "Annuale",
      anniDurata: 1,
      garanziaDa: "2026-06-25",
      garanziaA: "2027-01-01",
      durataA: "2028-01-01",
    });
    expect(plan).toHaveLength(2);
    expect(plan[0]).toEqual({
      idx: 1,
      garanzia_da: "2026-06-25",
      garanzia_a: "2027-01-01",
      data_competenza: "2026-06-25",
    });
    expect(plan[1]).toEqual({
      idx: 2,
      garanzia_da: "2027-01-01",
      garanzia_a: "2028-01-01",
      data_competenza: "2027-01-01",
    });
  });

  it("polizza rateo annuale con durata_a = garanzia_a → solo rateo (1 riga)", () => {
    const plan = computeQuietanzePlan({
      polizzaRateo: true,
      frazionamento: "Annuale",
      anniDurata: 1,
      garanziaDa: "2026-06-25",
      garanziaA: "2027-01-01",
      durataA: "2027-01-01",
    });
    expect(plan).toHaveLength(1);
  });

  it("Premio unico anticipato → Q1 fino a fine-1, Q2 giorno di fine", () => {
    const plan = computeQuietanzePlan({
      frazionamento: "Premio unico anticipato",
      anniDurata: 2,
      garanziaDa: "2026-03-01",
      garanziaA: "2026-09-01",
      durataDa: "2026-03-01",
      durataA: "2028-03-01",
      dataCompetenza: "2026-03-15",
    });
    expect(plan).toHaveLength(2);
    expect(plan[0]).toEqual({
      idx: 1,
      garanzia_da: "2026-03-01",
      garanzia_a: "2028-02-29",
      data_competenza: "2026-03-15",
    });
    expect(plan[1]).toEqual({
      idx: 2,
      garanzia_da: "2028-03-01",
      garanzia_a: "2028-03-01",
      data_competenza: "2026-03-15",
    });
    expect(computeQuietanzeOnly({
      frazionamento: "Premio unico anticipato",
      garanziaDa: "2026-03-01",
      garanziaA: "2028-03-01",
      durataDa: "2026-03-01",
      durataA: "2028-03-01",
    })).toHaveLength(1);
  });

  it("Premio unico anticipato 11/08/2026–11/08/2027 → Q1 …10/08/2027, Q2 11/08/2027", () => {
    const plan = computeQuietanzePlan({
      frazionamento: "Premio unico anticipato",
      garanziaDa: "2026-08-11",
      garanziaA: "2027-08-11",
      durataDa: "2026-08-11",
      durataA: "2027-08-11",
    });
    expect(plan).toEqual([
      { idx: 1, garanzia_da: "2026-08-11", garanzia_a: "2027-08-10", data_competenza: "2026-08-11" },
      { idx: 2, garanzia_da: "2027-08-11", garanzia_a: "2027-08-11", data_competenza: "2026-08-11" },
    ]);
  });

  it("Premio unico anticipato senza durata → usa garanzia_da/a con split date", () => {
    const plan = computeQuietanzePlan({
      frazionamento: "Premio unico anticipato",
      garanziaDa: "2026-01-01",
      garanziaA: "2027-06-30",
    });
    expect(plan).toHaveLength(2);
    expect(plan[0]).toMatchObject({ garanzia_da: "2026-01-01", garanzia_a: "2027-06-29" });
    expect(plan[1]).toMatchObject({ garanzia_da: "2027-06-30", garanzia_a: "2027-06-30" });
  });

  it("Annuale 3y Camposampiero: garanzia 2026–2027, durata_a 2029 → 3 rate, ultima a 2029, no 2029–2030", () => {
    const plan = computeQuietanzePlan({
      frazionamento: "Annuale",
      anniDurata: 3,
      garanziaDa: "2026-06-30",
      garanziaA: "2027-06-30",
      durataDa: "2026-06-30",
      durataA: "2029-06-30",
    });
    expect(plan).toHaveLength(3);
    expect(plan.map((r) => [r.garanzia_da, r.garanzia_a])).toEqual([
      ["2026-06-30", "2027-06-30"],
      ["2027-06-30", "2028-06-30"],
      ["2028-06-30", "2029-06-30"],
    ]);
    expect(plan[2].garanzia_a).toBe("2029-06-30");
    expect(plan.some((r) => r.garanzia_da === "2029-06-30")).toBe(false);
  });

  it("Annuale con nTot oltre durata_a: clip, niente rata a/dopo fine contratto", () => {
    const plan = computeQuietanzePlan({
      frazionamento: "Annuale",
      anniDurata: 4,
      garanziaDa: "2026-06-30",
      garanziaA: "2027-06-30",
      durataA: "2029-06-30",
    });
    expect(plan).toHaveLength(3);
    expect(plan[2]).toMatchObject({ garanzia_da: "2028-06-30", garanzia_a: "2029-06-30" });
  });

  it("Premio unico anticipato periodo 1 giorno → Q1 e Q2 sullo stesso giorno (fallback)", () => {
    const plan = computeQuietanzePlan({
      frazionamento: "Premio unico anticipato",
      garanziaDa: "2026-08-11",
      garanziaA: "2026-08-11",
    });
    expect(plan).toEqual([
      { idx: 1, garanzia_da: "2026-08-11", garanzia_a: "2026-08-11", data_competenza: "2026-08-11" },
      { idx: 2, garanzia_da: "2026-08-11", garanzia_a: "2026-08-11", data_competenza: "2026-08-11" },
    ]);
  });
});

describe("nextQuietanzaAfterMessaCassa", () => {
  it("dopo l'ultima rata legittima (garanzia_a = durata_a) non crea lo slot successivo", () => {
    expect(nextQuietanzaAfterMessaCassa({
      garanziaA: "2029-06-30",
      durataA: "2029-06-30",
      mesiRata: 12,
    })).toBeNull();
  });

  it("messa a cassa di rata intermedia crea lo slot successivo clipato a durata_a", () => {
    expect(nextQuietanzaAfterMessaCassa({
      garanziaA: "2028-06-30",
      durataA: "2029-06-30",
      mesiRata: 12,
    })).toEqual({
      idx: 0,
      garanzia_da: "2028-06-30",
      garanzia_a: "2029-06-30",
      data_competenza: "2028-06-30",
    });
  });
});
