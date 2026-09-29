import { describe, expect, it } from "vitest";
import {
  garanzieDelRamo,
  inheritPctLabel,
  placeholderPctGaranzia,
  rowKeyProvv,
} from "@/lib/provvigioniRamoTree";

describe("provvigioniRamoTree", () => {
  it("chiave default ramo vs override garanzia", () => {
    expect(rowKeyProvv("g1", null)).toBe("g1|");
    expect(rowKeyProvv("g1", "s1")).toBe("g1|s1");
  });

  it("label eredità: override, default ramo, tipo, fallback", () => {
    expect(inheritPctLabel({ hasOverride: true, defaultRamo: 12, inheritedTipo: 8 })).toBeNull();
    expect(inheritPctLabel({ hasOverride: false, defaultRamo: 12, inheritedTipo: 8 })).toBe("eredita 12%");
    expect(inheritPctLabel({ hasOverride: false, defaultRamo: null, inheritedTipo: 8 })).toBe(
      "eredita tipo (8%)",
    );
    expect(inheritPctLabel({ hasOverride: false, defaultRamo: null, inheritedTipo: null })).toBe(
      "0% (nessuna regola)",
    );
  });

  it("placeholder input garanzia usa il default ramo", () => {
    expect(placeholderPctGaranzia(undefined, 15)).toBe("15");
    expect(placeholderPctGaranzia(10, 15)).toBe("");
    expect(placeholderPctGaranzia(undefined, null)).toBe("—");
  });

  it("garanzieDelRamo filtra il catalogo sul gruppo", () => {
    const cat = [
      { id: "a", gruppo_ramo_id: "g1" },
      { id: "b", gruppo_ramo_id: "g2" },
      { id: "c", gruppo_ramo_id: "g1" },
    ];
    expect(garanzieDelRamo(cat, "g1").map((r) => r.id)).toEqual(["a", "c"]);
  });

  it("contratto matrice per appendici: default ramo vs override garanzia", () => {
    // TitoloImportiPremiBlock / calcProvvigioniGaranzia:
    // ramo_id null → pctDefault (eredità su tutte le garanzie e sulle appendici)
    // ramo_id valorizzato → pctByRamoId (override solo quella garanzia)
    const matrice = new Map<string, { ramo_id: string | null; perc: number }>();
    matrice.set(rowKeyProvv("incendi", null), { ramo_id: null, perc: 15 });
    matrice.set(rowKeyProvv("incendi", "incendio"), { ramo_id: "incendio", perc: 18 });

    const defaultRamo = matrice.get(rowKeyProvv("incendi", null));
    const override = matrice.get(rowKeyProvv("incendi", "incendio"));
    const noOverride = matrice.get(rowKeyProvv("incendi", "ricorso"));

    expect(defaultRamo?.perc).toBe(15);
    expect(override?.perc).toBe(18);
    expect(noOverride).toBeUndefined();
    expect(inheritPctLabel({ hasOverride: false, defaultRamo: defaultRamo?.perc, inheritedTipo: null })).toBe(
      "eredita 15%",
    );
  });
});
