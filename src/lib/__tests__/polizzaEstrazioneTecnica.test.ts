import { describe, expect, it } from "vitest";
import {
  buildEstrazioneTecnicaDrafts,
  normalizeFormaCopertura,
  persistEstrazioneTecnica,
  resolvePartitaId,
  type EstrazioneTecnicaClient,
} from "@/lib/polizzaEstrazioneTecnica";

describe("polizzaEstrazioneTecnica", () => {
  it("normalizza forma copertura legacy e sconosciuta", () => {
    expect(normalizeFormaCopertura("primo_rischio")).toBe("primo_rischio_assoluto");
    expect(normalizeFormaCopertura("Claims Made")).toBe("claims_made");
    expect(normalizeFormaCopertura("all risks")).toBe("altro");
    expect(normalizeFormaCopertura(null)).toBeNull();
  });

  it("costruisce partite, esclusi, sottolimiti e premio dal JSON AI", () => {
    const drafts = buildEstrazioneTecnicaDrafts({
      prodotto: { forma_copertura: "primo_rischio" },
      dati_personali: { forma_copertura_note: "All risks sul fabbricato" },
      partite: [
        { numero: 1, descrizione: "Fabbricato", tipo_bene: "fabbricato", somma_assicurata: 1_500_000 },
        { descrizione: "  " },
      ],
      beni_esclusi: [
        { partita_numero: 1, descrizione: "Gioielli" },
        { descrizione: "" },
      ],
      esclusioni_polizza: [{ livello: "generale", testo: "Guerra e terrorismo", articolo: "Art. 3" }],
      sottolimiti: [{ partita_numero: 1, voce: "Acqua condotta", importo: 25000, per: "sinistro" }],
      premio_calcolo: [{
        partita_numero: 1,
        garanzia: "Incendio",
        base_imponibile: 1_500_000,
        tasso: 1.2,
        tasso_unita: "per_mille",
        premio_imponibile: 1800,
        formula_fonte: "1,20‰ su € 1.500.000",
      }],
    });

    expect(drafts.forma_copertura).toBe("primo_rischio_assoluto");
    expect(drafts.partite).toHaveLength(1);
    expect(drafts.partite[0].descrizione).toBe("Fabbricato");
    expect(drafts.beni_esclusi).toHaveLength(1);
    expect(drafts.esclusioni[0].articolo).toBe("Art. 3");
    expect(drafts.sottolimiti[0].importo).toBe(25000);
    expect(drafts.premio_calcolo[0].tasso_unita).toBe("per_mille");
  });

  it("risolve partita_id dallo numero salvato", () => {
    const saved = [{ id: "aaa", numero: 1 }, { id: "bbb", numero: 2 }];
    expect(resolvePartitaId(2, saved)).toBe("bbb");
    expect(resolvePartitaId(9, saved)).toBeNull();
    expect(resolvePartitaId(null, saved)).toBeNull();
  });

  it("persiste header e figlie con mapping partita", async () => {
    const calls: { table: string; op: string; payload?: unknown }[] = [];
    const client: EstrazioneTecnicaClient = {
      from: (table) => ({
        update: (values) => ({
          eq: async () => {
            calls.push({ table, op: "update", payload: values });
            return { data: null, error: null };
          },
        }),
        delete: () => ({
          eq: async () => {
            calls.push({ table, op: "delete" });
            return { data: null, error: null };
          },
        }),
        insert: (values) => {
          const result = {
            then: (resolve: (v: { data: unknown; error: null }) => unknown) => {
              calls.push({ table, op: "insert", payload: values });
              return Promise.resolve(resolve({ data: null, error: null }));
            },
            select: async () => {
              calls.push({ table, op: "insert-select", payload: values });
              return { data: [{ id: "p1", numero: 1 }], error: null };
            },
          };
          return result as ReturnType<EstrazioneTecnicaClient["from"]>["insert"];
        },
      }),
    };

    await persistEstrazioneTecnica(client, "cga-1", {
      dati_personali: { forma_copertura: "valore_intero" },
      partite: [{ numero: 1, descrizione: "Fabbricato", somma_assicurata: 100 }],
      beni_esclusi: [{ partita_numero: 1, descrizione: "Valori" }],
    });

    expect(calls.some((c) => c.table === "polizza_cga" && c.op === "update")).toBe(true);
    const beni = calls.find((c) => c.table === "polizza_beni_esclusi" && c.op === "insert");
    expect((beni?.payload as { partita_id: string }[])[0].partita_id).toBe("p1");
  });
});
