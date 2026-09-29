import { describe, expect, it } from "vitest";
import {
  ROMA_EXE_RAMI,
  exeRamoOriginale,
  mapRomaExeRamo,
  resolveRomaExeRamo,
} from "@/lib/romaExeRami";

describe("mapRomaExeRamo", () => {
  it("mappa i 15 rami EXE sulle scelte chiuse", () => {
    expect(mapRomaExeRamo("15", "GLOBALE ESERCIZI")?.ramoCodice).toBe("LQ");
    expect(mapRomaExeRamo("59", "SANITARIA")?.ramoCodice).toBe("MCA");
    expect(mapRomaExeRamo("42", "CAUZIONI")?.ramoCodice).toBe("FID");
    expect(mapRomaExeRamo(90)?.ramoCodice).toBe("QA");
    expect(mapRomaExeRamo("60")?.ramoCodice).toBe("PB");
    expect(mapRomaExeRamo("9", "POLIZZA PIU`")?.ramoCodice).toBe("ZY");
  });

  it("riconosce descrizione e alias se manca il codice", () => {
    expect(mapRomaExeRamo(null, "CAUZIONI")?.ramoCodice).toBe("FID");
    expect(mapRomaExeRamo("", "RCA")?.ramoCodice).toBe("QA");
    expect(mapRomaExeRamo(undefined, "C.A.R.")?.ramoCodice).toBe("GC");
    expect(mapRomaExeRamo(null, "GLOB.ESER.")?.ramoCodice).toBe("LQ");
    expect(mapRomaExeRamo(null, "RCVT")?.ramoCodice).toBe("PB");
  });

  it("non inventa un ramo sconosciuto", () => {
    expect(mapRomaExeRamo("999", "ASSICURAZIONE LUNE")).toBeNull();
  });

  it("copre tutti i rami dell'elenco polizze EXE", () => {
    const attesi = ["90", "60", "10", "15", "50", "42", "59", "1", "44", "80", "20", "77", "30", "75", "9"];
    expect(ROMA_EXE_RAMI.map((r) => r.exeCodice)).toEqual(attesi);
    for (const codice of attesi) {
      expect(mapRomaExeRamo(codice)).not.toBeNull();
    }
  });
});

describe("resolveRomaExeRamo", () => {
  const catalogo = [
    { id: "ramo-lq", codice: "LQ", gruppo_ramo_id: "g-zl" },
    { id: "ramo-mca", codice: "MCA", gruppo_ramo_id: "g-zm" },
    { id: "ramo-fid", codice: "FID", gruppo_ramo_id: "g-zc" },
  ];

  it("risolve il ramo_id CBnet dal catalogo", () => {
    const hit = resolveRomaExeRamo("15", "GLOBALE ESERCIZI", catalogo);
    expect(hit?.ramoId).toBe("ramo-lq");
    expect(hit?.gruppoRamoId).toBe("g-zl");
    expect(hit?.ramoDescrizione).toBe("MULTIRISCHIO");
  });

  it("mantiene il testo EXE originale", () => {
    expect(exeRamoOriginale("15", "GLOBALE ESERCIZI")).toBe("15 | GLOBALE ESERCIZI");
  });
});
