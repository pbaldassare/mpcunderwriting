import { describe, it, expect } from "vitest";
import { emptyGaranziaRow, type GaranziaRow } from "@/components/polizze/PremiGaranziaCardShell";

// Replica della funzione di build payload usata in ImmissionePolizzaPage.handleConferma
function buildPremiInsert(
  rows: GaranziaRow[],
  tipo: "firma" | "quietanza",
  titoloId = "tit-1",
) {
  return rows
    .filter((r) => (r.codice || r.descrizione.trim()) && (parseFloat(r.netto || "0") || parseFloat(r.tasse || "0")))
    .map((r, idx) => ({
      titolo_id: titoloId,
      tipo_premio: tipo,
      garanzia: r.codice || r.descrizione || "Premio",
      capitale: 0,
      tasso: 0,
      firma: tipo === "firma" ? parseFloat(r.netto || "0") || 0 : 0,
      rata: tipo === "quietanza" ? parseFloat(r.netto || "0") || 0 : 0,
      annuo: 0,
      ordine: idx,
    }));
}

describe("PremiGaranziaCardShell — payload mapping", () => {
  it("filtra le righe vuote", () => {
    const rows: GaranziaRow[] = [
      emptyGaranziaRow(),
      { codice: "MAL", descrizione: "Malattia", netto: "100", tasse: "2.5", aliquotaTasse: 2.5 },
    ];
    const out = buildPremiInsert(rows, "firma");
    expect(out).toHaveLength(1);
    expect(out[0].garanzia).toBe("MAL");
    expect(out[0].firma).toBe(100);
    expect(out[0].rata).toBe(0);
    expect(out[0].tipo_premio).toBe("firma");
    expect(out[0].ordine).toBe(0);
  });

  it("supporta più righe con descrizione libera (senza codice)", () => {
    const rows: GaranziaRow[] = [
      { codice: null, descrizione: "Day Hospital", netto: "200", tasse: "5", aliquotaTasse: 2.5 },
      { codice: null, descrizione: "Diaria", netto: "50", tasse: "1.25", aliquotaTasse: 2.5 },
    ];
    const out = buildPremiInsert(rows, "firma");
    expect(out.map((r) => r.garanzia)).toEqual(["Day Hospital", "Diaria"]);
    expect(out.map((r) => r.ordine)).toEqual([0, 1]);
  });

  it("marca correttamente le righe Quietanza (firma=0, rata=netto)", () => {
    const rows: GaranziaRow[] = [
      { codice: "MAL", descrizione: "Malattia", netto: "120", tasse: "3", aliquotaTasse: 2.5 },
    ];
    const out = buildPremiInsert(rows, "quietanza");
    expect(out[0].tipo_premio).toBe("quietanza");
    expect(out[0].rata).toBe(120);
    expect(out[0].firma).toBe(0);
  });

  it("scarta righe con codice ma senza importi", () => {
    const rows: GaranziaRow[] = [
      { codice: "MAL", descrizione: "Malattia", netto: "0", tasse: "0", aliquotaTasse: 2.5 },
    ];
    expect(buildPremiInsert(rows, "firma")).toHaveLength(0);
  });
});

describe("emptyGaranziaRow", () => {
  it("ritorna una riga vuota e neutra", () => {
    const r = emptyGaranziaRow();
    expect(r.codice).toBeNull();
    expect(r.descrizione).toBe("");
    expect(r.netto).toBe("");
    expect(r.tasse).toBe("");
    expect(r.aliquotaTasse).toBe(0);
  });
});
