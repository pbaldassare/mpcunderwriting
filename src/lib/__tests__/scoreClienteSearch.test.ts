import { describe, it, expect } from "vitest";
import { scoreClienteSearch } from "../scoreClienteSearch";

describe("scoreClienteSearch", () => {
  it("priorità città esatta su match nome parziale", () => {
    const citta = scoreClienteSearch(
      { cognome: "Biolcati", nome: "Mario", citta_residenza: "ADRIA" },
      "adria",
    );
    const nomeParziale = scoreClienteSearch(
      { cognome: "Adriano", nome: "Luca", citta_residenza: "Milano" },
      "adria",
    );
    expect(citta).toBe(1);
    expect(nomeParziale).toBe(3);
    expect(citta).toBeLessThan(nomeParziale);
  });

  it("match esatto anagrafica meglio di contains", () => {
    expect(scoreClienteSearch({ ragione_sociale: "ADRIA" }, "adria")).toBe(2);
    expect(scoreClienteSearch({ ragione_sociale: "Società Adriatica" }, "adria")).toBe(4);
  });

  it("match solo altri campi = score 5", () => {
    expect(
      scoreClienteSearch(
        { cognome: "Rossi", nome: "Mario", citta_residenza: "Roma" },
        "adria",
      ),
    ).toBe(5);
  });

  it("frase su cognome+nome: de gobbi trova DE GOBBI MARCO", () => {
    const cliente = { cognome: "DE", nome: "GOBBI MARCO" };
    // "de gobbi" è prefisso di "de gobbi marco" → starts with = 3
    expect(scoreClienteSearch(cliente, "de gobbi")).toBe(3);
    // "gobbi" è prefisso di nome "gobbi marco" → starts with = 3
    expect(scoreClienteSearch(cliente, "gobbi")).toBe(3);
    // token non contigui → token AND = contains-like
    expect(scoreClienteSearch(cliente, "gobbi de")).toBe(4);
  });

  it("match indirizzo come contains-like", () => {
    expect(
      scoreClienteSearch(
        { cognome: "Abate", nome: "Alexander", indirizzo_residenza: "Via Roma 12", citta_residenza: "Milano" },
        "via roma",
      ),
    ).toBe(4);
  });
});
