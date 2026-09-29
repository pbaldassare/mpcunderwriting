import { describe, expect, it } from "vitest";
import {
  chunkIds,
  clientiOrFilter,
  agenzieDaTitoliClienti,
  filenameDistintaRestituzione,
  groupRestituzioneByCompagnia,
  gruppiPerDistinta,
  slugAgenziaFilename,
  wrapTestoPdf,
  tipoTitoloRestituzione,
  type RestituzioneDocRiga,
} from "../restituzioneOriginali";
import { buildDistintaRestituzionePdf } from "../restituzioneOriginaliPdf";

function riga(partial: Partial<RestituzioneDocRiga>): RestituzioneDocRiga {
  return {
    documentoId: "d1",
    nomeFile: "polizza.pdf",
    createdAt: "2026-01-01",
    titoloId: "t1",
    numeroTitolo: "123",
    tipoTitolo: "polizza",
    clienteId: "c1",
    clienteNome: "Rossi",
    compagniaId: "ag1",
    compagniaNome: "Generali",
    inviato: false,
    ...partial,
  };
}

describe("tipoTitoloRestituzione", () => {
  it("distingue polizza, quietanza e regolazione", () => {
    expect(tipoTitoloRestituzione({})).toBe("polizza");
    expect(tipoTitoloRestituzione({ sostituisce_polizza: "123" })).toBe("quietanza");
    expect(tipoTitoloRestituzione({ is_regolazione: true })).toBe("regolazione");
  });
});

describe("groupRestituzioneByCompagnia", () => {
  it("un PDF / gruppo per agenzia", () => {
    const groups = groupRestituzioneByCompagnia([
      riga({ documentoId: "a", compagniaId: "g1", compagniaNome: "Generali" }),
      riga({ documentoId: "b", compagniaId: "g1", compagniaNome: "Generali" }),
      riga({ documentoId: "c", compagniaId: "u1", compagniaNome: "Unipol" }),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups.find((g) => g.compagniaNome === "Generali")?.rows).toHaveLength(2);
    expect(groups.find((g) => g.compagniaNome === "Unipol")?.rows).toHaveLength(1);
  });

  it("raggruppa senza id usando il nome", () => {
    const groups = groupRestituzioneByCompagnia([
      riga({ documentoId: "a", compagniaId: null, compagniaNome: "AXA" }),
      riga({ documentoId: "b", compagniaId: null, compagniaNome: "AXA" }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].rows).toHaveLength(2);
  });
});

describe("filename e filtri", () => {
  it("slug e nome file distinta", () => {
    expect(slugAgenziaFilename("IRCCS Fondazione G.B.")).toBe("IRCCS_Fondazione_G_B");
    expect(filenameDistintaRestituzione("Generali", new Date(2026, 8, 24))).toBe(
      "distinta_originali_Generali_20260924.pdf",
    );
  });

  it("genera un PDF distinta per compagnia", async () => {
    const groups = groupRestituzioneByCompagnia([
      riga({ documentoId: "a", nomeFile: "orig.pdf", numeroTitolo: "weewww" }),
    ]);
    const bytes = await buildDistintaRestituzionePdf(groups[0], new Date(2026, 8, 24), {
      note: "Restituire gli originali in raccomandata.",
    });
    expect(bytes.byteLength).toBeGreaterThan(200);
    expect(String.fromCharCode(...bytes.slice(0, 4))).toBe("%PDF");
  });

  it("genera PDF anche senza documenti selezionati", async () => {
    const groups = gruppiPerDistinta([], { compagniaNome: "Allianz Napoli" });
    expect(groups).toHaveLength(1);
    expect(groups[0].rows).toHaveLength(0);
    const bytes = await buildDistintaRestituzionePdf(groups[0], new Date(2026, 8, 25), {
      note: "Lettera di restituzione senza allegati.",
      clientiLabel: "Lima Giuseppe",
    });
    expect(String.fromCharCode(...bytes.slice(0, 4))).toBe("%PDF");
  });

  it("wrap note e fallback gruppo vuoto", () => {
    expect(wrapTestoPdf("ciao mondo", 5)).toEqual(["ciao", "mondo"]);
    expect(gruppiPerDistinta([]).at(0)?.compagniaNome).toBe("Restituzione originali");
  });

  it("prende l'agenzia dalle polizze del cliente", () => {
    const agenzie = agenzieDaTitoliClienti([
      { id: "t1", compagnia_id: "ag1", compagnia_nome: "Allianz", numero_titolo: "P1", cliente_nome_display: "Lima" },
      { id: "t2", compagnia_id: "ag1", compagnia_nome: "Allianz", numero_titolo: "P2" },
      { id: "t3", compagnia_id: "ag2", compagnia_nome: "Unipol" },
    ]);
    expect(agenzie).toHaveLength(2);
    expect(agenzie.map((a) => a.compagniaNome)).toEqual(["Allianz", "Unipol"]);
    expect(gruppiPerDistinta([], agenzie)).toHaveLength(2);
  });

  it("chunk e or filter clienti", () => {
    expect(chunkIds(["a", "b", "c"], 2)).toEqual([["a", "b"], ["c"]]);
    expect(clientiOrFilter(["id1", "id2"])).toBe(
      "cliente_id.in.(id1,id2),cliente_anagrafica_id.in.(id1,id2)",
    );
  });
});
