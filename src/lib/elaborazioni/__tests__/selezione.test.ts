import { describe, expect, it } from "vitest";
import {
  catalogoOrFilter,
  filterTitoliByGruppiRamo,
  gruppoRamoIdOfTitolo,
  mergeValoriCampi,
  toggleId,
} from "@/lib/elaborazioni/selezione";

describe("selezione elaborazioni", () => {
  it("risolve il gruppo ramo dalla join o dalla mappa", () => {
    expect(gruppoRamoIdOfTitolo({ id: "1", ramo: { gruppo_ramo_id: "g1" } })).toBe("g1");
    const map = new Map<string, string | null>([["r2", "g2"]]);
    expect(gruppoRamoIdOfTitolo({ id: "2", ramo_id: "r2" }, map)).toBe("g2");
    expect(gruppoRamoIdOfTitolo({ id: "3" })).toBeNull();
  });

  it("filtra le polizze per rami scelti; senza rami le tiene tutte", () => {
    const titoli = [
      { id: "a", ramo: { gruppo_ramo_id: "rca" } },
      { id: "b", ramo: { gruppo_ramo_id: "incendio" } },
    ];
    expect(filterTitoliByGruppiRamo(titoli, [])).toHaveLength(2);
    expect(filterTitoliByGruppiRamo(titoli, ["rca"]).map((t) => t.id)).toEqual(["a"]);
  });

  it("toglie e aggiunge id", () => {
    expect(toggleId(["a"], "b")).toEqual(["a", "b"]);
    expect(toggleId(["a", "b"], "a")).toEqual(["b"]);
  });

  it("unisce i campi senza sovrascrivere i valori già trovati", () => {
    const merged = mergeValoriCampi(
      { numero_titolo: "1", premio_lordo: "" },
      { numero_titolo: "2", premio_lordo: 100, nota: "x" },
    );
    expect(merged.numero_titolo).toBe("1");
    expect(merged.premio_lordo).toBe(100);
    expect(merged.nota).toBe("x");
  });

  it("costruisce il filtro catalogo per i rami", () => {
    expect(catalogoOrFilter([])).toBe("gruppo_ramo_id.is.null");
    expect(catalogoOrFilter(["aa-bb"])).toBe("gruppo_ramo_id.is.null,gruppo_ramo_id.in.(aa-bb)");
  });
});
