import { describe, it, expect } from "vitest";
import { syncPeriodoRateo } from "../syncPeriodoRateo";
import { computeRateoDurataA } from "../quietanzePlan";

describe("computeRateoDurataA", () => {
  it("rateo annuale: garanzia_a + 12 mesi se oltre durata_da + anni", () => {
    expect(
      computeRateoDurataA({
        durataDa: "2026-06-25",
        garanziaA: "2027-01-01",
        frazionamento: "Annuale",
        anniDurata: 1,
      }),
    ).toBe("2028-01-01");
  });

  it("usa durata_da + anni se estende oltre garanzia_a + 1 rata", () => {
    expect(
      computeRateoDurataA({
        durataDa: "2026-01-01",
        garanziaA: "2026-06-01",
        frazionamento: "Annuale",
        anniDurata: 3,
      }),
    ).toBe("2029-01-01");
  });
});

describe("syncPeriodoRateo", () => {
  it("allinea garanzia da e competenza a durata da", () => {
    expect(
      syncPeriodoRateo({
        garanziaDa: "2026-03-20",
        durataDa: "2026-03-15",
        durataATouched: false,
        anniDurata: 1,
      }),
    ).toEqual({
      garanzia_da: "2026-03-15",
      data_competenza: "2026-03-20",
      durata_a: "2027-03-15",
      applyDurataA: true,
    });
  });

  it("calcola durata_a da anni durata se non toccata", () => {
    expect(
      syncPeriodoRateo({
        garanziaDa: "",
        durataDa: "2026-01-01",
        durataATouched: false,
        anniDurata: 3,
      }),
    ).toEqual({
      garanzia_da: "2026-01-01",
      data_competenza: "2026-01-01",
      durata_a: "2029-01-01",
      applyDurataA: true,
    });
  });

  it("rateo 25/06/2026 garanzia_a 01/01/2027 annuale → durata_a 01/01/2028", () => {
    expect(
      syncPeriodoRateo({
        garanziaDa: "2026-06-25",
        durataDa: "2026-06-25",
        garanziaA: "2027-01-01",
        frazionamento: "Annuale",
        durataATouched: false,
        anniDurata: 1,
      }),
    ).toEqual({
      garanzia_da: "2026-06-25",
      data_competenza: "2026-06-25",
      durata_a: "2028-01-01",
      applyDurataA: true,
    });
  });

  it("non sovrascrive durata_a se toccata manualmente e valida", () => {
    expect(
      syncPeriodoRateo({
        garanziaDa: "2026-01-01",
        durataDa: "2026-01-01",
        garanziaA: "2026-06-01",
        frazionamento: "Annuale",
        durataATouched: true,
        currentDurataA: "2029-06-01",
        anniDurata: 1,
      }),
    ).toEqual({
      garanzia_da: "2026-01-01",
      data_competenza: "2026-01-01",
      applyDurataA: false,
    });
  });

  it("forza ricalcolo se durata_a <= garanzia_a (blocca Q2+)", () => {
    expect(
      syncPeriodoRateo({
        garanziaDa: "2026-06-25",
        durataDa: "2026-06-25",
        garanziaA: "2027-01-01",
        frazionamento: "Annuale",
        durataATouched: true,
        currentDurataA: "2027-01-01",
        anniDurata: 1,
      }),
    ).toEqual({
      garanzia_da: "2026-06-25",
      data_competenza: "2026-06-25",
      durata_a: "2028-01-01",
      applyDurataA: true,
    });
  });

  it("restituisce stringhe vuote se mancano le date", () => {
    expect(
      syncPeriodoRateo({
        garanziaDa: "",
        durataDa: "",
        durataATouched: false,
        anniDurata: 1,
      }),
    ).toEqual({
      garanzia_da: "",
      data_competenza: "",
      applyDurataA: false,
    });
  });
});
