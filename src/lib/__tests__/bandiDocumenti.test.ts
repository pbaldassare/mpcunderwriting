import { describe, expect, it } from "vitest";
import {
  buildHarvestNote,
  classifyDocumentoHash,
  countNovitaDocumenti,
  documentiVisibili,
  groupDocumentiByTipo,
  inferTipoDocumentoBando,
  labelStatoDocumentoBando,
  labelTipoDocumentoBando,
} from "@/lib/bandiDocumenti";

describe("bandiDocumenti", () => {
  it("riconosce il tipo dal nome o dall'url", () => {
    expect(inferTipoDocumentoBando("Disciplinare di gara.pdf")).toBe("disciplinare");
    expect(inferTipoDocumentoBando(null, "https://x/esito-aggiudicazione.pdf")).toBe("esito");
    expect(inferTipoDocumentoBando("avviso-ted.pdf")).toBe("bando");
    expect(inferTipoDocumentoBando("note.docx")).toBe("altro");
  });

  it("confronta l'hash senza overwrite cieco", () => {
    expect(classifyDocumentoHash(null, "aaa")).toBe("nuovo");
    expect(classifyDocumentoHash("aaa", "aaa")).toBe("invariato");
    expect(classifyDocumentoHash("aaa", "bbb")).toBe("aggiornato");
  });

  it("conta le novità del fascicolo", () => {
    expect(countNovitaDocumenti([
      { stato: "nuovo" },
      { stato: "aggiornato" },
      { stato: "invariato" },
    ])).toEqual({ nuovi: 1, aggiornati: 1 });
  });

  it("compone la nota harvest", () => {
    expect(buildHarvestNote({ arricchito: true, nuovi: 1, aggiornati: 0 }))
      .toBe("Harvest: scheda aggiornata, 1 doc nuovo");
    expect(buildHarvestNote({})).toBe("Nessuna novità dal portale");
    expect(labelTipoDocumentoBando("capitolato")).toBe("Capitolato");
    expect(labelStatoDocumentoBando("nuovo")).toBe("Nuovo");
  });

  it("raggruppa il fascicolo per tipo", () => {
    const groups = groupDocumentiByTipo([
      { tipo: "esito", nome: "e.pdf" },
      { tipo: "bando", nome: "b.pdf" },
      { tipo: "bando", nome: "b2.pdf" },
      { tipo: "sconosciuto", nome: "x.pdf" },
    ]);
    expect(groups.map((g) => g.tipo)).toEqual(["bando", "esito", "altro"]);
    expect(groups[0].docs).toHaveLength(2);
    expect(groups[0].label).toBe("Bando");
  });

  it("nasconde i documenti rimossi dall'archivio", () => {
    expect(documentiVisibili([
      { stato: "nuovo" },
      { stato: "rimosso" },
      { stato: "invariato" },
    ])).toHaveLength(2);
  });
});
