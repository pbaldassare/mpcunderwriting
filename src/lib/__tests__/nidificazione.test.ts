import { describe, expect, it } from "vitest";
import {
  buildNidificazioneForest,
  flattenNidificazioneForest,
  formatNidificazionePhrase,
  formatNidificazioneSaveError,
  garanziaCollegataLabel,
  wouldCreateCycle,
  type ClienteNidificazioneLite,
  type RelazioneNidificazione,
  type TitoloNidificazione,
} from "@/lib/nidificazione";

const titoli: TitoloNidificazione[] = [
  { codice: "sindaco", descrizione: "Sindaco", preposizione: "di", categoria: "incarico" },
  { codice: "figlio", descrizione: "Figlio", preposizione: "di", categoria: "familiare" },
];

const paolo: ClienteNidificazioneLite = { id: "p", nome: "Paolo", cognome: "Baldassare", tipo_cliente: "privato" };
const gianni: ClienteNidificazioneLite = { id: "g", nome: "Gianni", cognome: "Baldassare", tipo_cliente: "privato" };
const comune: ClienteNidificazioneLite = { id: "c", ragione_sociale: "Comune di Varese", tipo_cliente: "ente" };

describe("nidificazione", () => {
  it("compone la frase incarico e familiare", () => {
    expect(formatNidificazionePhrase(paolo, titoli[0], comune)).toBe(
      "Baldassare Paolo sindaco di Comune di Varese",
    );
    expect(formatNidificazionePhrase(paolo, titoli[1], gianni)).toBe(
      "Baldassare Paolo figlio di Baldassare Gianni",
    );
  });

  it("rileva cicli e auto-collegamento", () => {
    const rel: RelazioneNidificazione[] = [
      { id: "1", cliente_id: "p", cliente_collegato_id: "g", tipo_relazione: "figlio" },
    ];
    expect(wouldCreateCycle("p", "p", [])).toBe(true);
    expect(wouldCreateCycle("g", "p", rel)).toBe(true);
    expect(wouldCreateCycle("p", "c", rel)).toBe(false);
  });

  it("costruisce la foresta e appiattisce la nidificazione", () => {
    const rel: RelazioneNidificazione[] = [
      { id: "1", cliente_id: "p", cliente_collegato_id: "c", tipo_relazione: "sindaco" },
      { id: "2", cliente_id: "p", cliente_collegato_id: "g", tipo_relazione: "figlio" },
    ];
    const forest = buildNidificazioneForest([paolo, gianni, comune], rel, titoli);
    expect(forest.map((n) => n.cliente.id).sort()).toEqual(["c", "g"]);
    const flat = flattenNidificazioneForest(forest);
    expect(flat.some((r) => r.phrase?.includes("sindaco di Comune di Varese"))).toBe(true);
    expect(flat.some((r) => r.phrase?.includes("figlio di"))).toBe(true);
  });

  it("traduce errori di salvataggio nidificazione", () => {
    expect(formatNidificazioneSaveError({ code: "42501", message: "new row violates row-level security policy" }))
      .toMatch(/permessi/i);
    expect(formatNidificazioneSaveError({ code: "23505", message: "duplicate key", details: "clienti_relazioni_unique" }))
      .toMatch(/esiste già/i);
    expect(formatNidificazioneSaveError({ message: "Invalid tipo_relazione: foo" }))
      .toMatch(/non valido/i);
  });

  it("compone la garanzia collegata da premi, prodotto o ramo", () => {
    expect(garanziaCollegataLabel(["Incendio", "Furto", "Incendio"])).toBe("Incendio, Furto");
    expect(garanziaCollegataLabel([], "RCT Enti pubblici", "Responsabilità civile")).toBe("RCT Enti pubblici, Responsabilità civile");
    expect(garanziaCollegataLabel([])).toBe("—");
  });
});
