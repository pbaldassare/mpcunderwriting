import { describe, expect, it } from "vitest";
import { emptyGaranziaRow } from "@/components/polizze/PremiGaranziaCardShell";
import type { MatriceProvvAccessori } from "@/lib/calcProvvigioniGaranzia";
import {
  isProvvigioniManualStored,
  provvigioniImportoFromManualPctNetto,
  provvigioniImportoFromPct,
  provvigioniPctEffettivaBlocco,
  provvigioniPctFromImporto,
  resolveProvvigioniForSave,
} from "@/lib/provvigioniManual";

const matrice: MatriceProvvAccessori = {
  pctByRamoId: new Map([["sotto-1", 8]]),
  pctAccessoriByRamoId: new Map(),
  pctDefault: 8,
  pctAccessoriDefault: 12,
  pctPrevalente: 8,
  isUniform: true,
};

describe("provvigioniManual", () => {
  it("isProvvigioniManualStored rileva anche micro-differenze", () => {
    expect(isProvvigioniManualStored(200.01, 200.0)).toBe(true);
    expect(isProvvigioniManualStored(200.0, 200.0)).toBe(false);
  });

  it("provvigioniImportoFromPct non tronca la % a 4 decimali", () => {
    const base = 5919.83;
    const importo = 200.33;
    const pct = provvigioniPctFromImporto(importo, base);
    const ricalc = provvigioniImportoFromPct(base, pct);
    expect(Math.abs(ricalc - importo)).toBeLessThan(0.005);
  });

  it("provvigioniPctFromImporto mantiene precisione per display", () => {
    const pct = provvigioniPctFromImporto(200.33, 5919.83);
    expect(pct).not.toBe("3.3858");
    expect(parseFloat(pct)).toBeCloseTo(3.38405, 4);
  });

  it("provvigioniImportoFromManualPctNetto applica % netto manuale e % accessori da matrice", () => {
    const rows = [{
      ...emptyGaranziaRow(),
      sottoramoId: "sotto-1",
      netto: "543.56",
      accessori: "100.50",
    }];
    const importo = provvigioniImportoFromManualPctNetto(rows, "8", matrice);
    expect(importo).toBeCloseTo(55.5448, 2);
  });

  it("provvigioniPctEffettivaBlocco = totale blocco / premio netto (non matrice)", () => {
    // Consorzio Bonifica: blocco 6184.05 su netto 34355.81 → 18%, non matrice 20%
    expect(provvigioniPctEffettivaBlocco(6184.05, 34355.81)).toBeCloseTo(18, 4);
    expect(provvigioniPctEffettivaBlocco(6871.16, 34355.81)).toBeCloseTo(20, 4);
    expect(provvigioniPctEffettivaBlocco(100, 0)).toBe(0);
  });

  it("resolveProvvigioniForSave persiste sempre il totale blocco", () => {
    expect(resolveProvvigioniForSave(6184.05)).toBe(6184.05);
    // non deve preferire somma righe/matrice (6871.16) rispetto al blocco
    expect(resolveProvvigioniForSave(6184.05)).not.toBe(6871.16);
  });
});
