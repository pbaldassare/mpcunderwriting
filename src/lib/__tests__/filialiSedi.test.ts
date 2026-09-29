import { describe, expect, it } from "vitest";
import {
  parseFilialiRows,
  patchUfficioDaFiliale,
  planFilialiSedi,
  resolveCodiceCBnet,
} from "@/lib/filialiSedi";

const esistenti = [
  { id: "na", codice_ufficio: "NA", nome_ufficio: "Ufficio di Napoli", indirizzo: "Via Mergellina, 2" },
  { id: "rm", codice_ufficio: "009", nome_ufficio: "Roma uno", indirizzo: "Via Reno, 30" },
  { id: "rm2", codice_ufficio: "RM2", nome_ufficio: "ROMA 2 EXE", indirizzo: "Viale Giulio Cesare, 6" },
  { id: "bg", codice_ufficio: "BG", nome_ufficio: "Ufficio di Bergamo", indirizzo: "Via Giovanni Pascoli, 3" },
];

describe("filialiSedi", () => {
  it("aliasa Roma e non ricrea Napoli dal codice 1", () => {
    expect(resolveCodiceCBnet("RM")).toBe("009");
    expect(resolveCodiceCBnet("RO")).toBe("RM2");
    const piano = planFilialiSedi(
      parseFilialiRows([
        { "Codice Filiale": "1", "Descrizione Filiale": "Sede", Indirizzo: "Via Mergellina 2" },
        { "Codice Filiale": "NA", "Descrizione Filiale": "Ufficio di Napoli", Indirizzo: "Via Mergellina 2" },
        { "Codice Filiale": "RM", "Descrizione Filiale": "Ufficio di Roma", Indirizzo: "Via Reno 30" },
        { "Codice Filiale": "BO", "Descrizione Filiale": "Ufficio di Bologna", Indirizzo: "Via della Grada 11" },
        { "Codice Filiale": "DM", "Descrizione Filiale": "AMBIENTE DEMO" },
      ]),
      esistenti,
    );
    expect(piano.filter((p) => p.esito === "salta").map((p) => p.riga.codice)).toEqual(["1", "DM"]);
    expect(piano.find((p) => p.riga.codice === "NA")?.esito).toBe("aggiorna");
    expect(piano.find((p) => p.riga.codice === "RM")?.esito).toBe("aggiorna");
    expect(piano.find((p) => p.riga.codice === "BO")?.esito).toBe("crea");
  });

  it("sovrascrive l'indirizzo se il file lo ha, altrimenti tiene il CBnet", () => {
    const overwritten = patchUfficioDaFiliale(esistenti[3], {
      codice: "BG",
      nome: "Ufficio di Bergamo",
      indirizzo: "Via Mazzini 30",
      cap: "24128",
      citta: "Bergamo",
      provincia: "BG",
    });
    expect(overwritten.indirizzo).toBe("Via Mazzini 30");
    expect(overwritten.cap).toBe("24128");

    const keep = patchUfficioDaFiliale(esistenti[2], {
      codice: "RO",
      nome: "Ufficio di Roma 2",
      indirizzo: null,
      cap: null,
      citta: null,
      provincia: null,
    });
    expect(keep.indirizzo).toBe("Viale Giulio Cesare, 6");
  });
});
