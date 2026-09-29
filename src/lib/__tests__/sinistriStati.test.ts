import { describe, expect, it } from "vitest";
import {
  applyFiltroPortaleCliente,
  applyStatoFiltroLista,
  applyStatoFiltroOperativo,
  excludeArchiviati,
  isArchiviato,
  isSinistroAperto,
  isSinistroTerminale,
  isStatoChiusuraArchivio,
  labelStatoSinistro,
  puoModificareCompagniaSinistro,
  puoRiaprireSinistro,
  resolveStatoFiltroLista,
  SINISTRO_STATI,
  SINISTRO_STATI_CATALOGO,
  SINISTRO_STATO_ARCHIVIATO,
  SINISTRO_STATI_OPERATIVI,
  statiSelezionabiliPerCambio,
  statiVisibiliDefault,
} from "../sinistriStati";

describe("catalogo stati", () => {
  it("non ha slug duplicati e una sola CHIUSO SENZA SEGUITO", () => {
    const values = SINISTRO_STATI_CATALOGO.map((s) => s.value);
    expect(new Set(values).size).toBe(values.length);
    expect(values.filter((v) => v === "chiuso_senza_seguito")).toHaveLength(1);
    expect(SINISTRO_STATI_CATALOGO.filter((s) => s.label === "CHIUSO SENZA SEGUITO")).toHaveLength(1);
  });

  it("riusa gli slug storici e tiene i vecchi stati", () => {
    for (const slug of [
      "bozza",
      "in_valutazione",
      "aperto",
      "in_lavorazione",
      "in_attesa_documenti",
      "in_liquidazione",
      "chiuso",
      "respinto",
      "archiviato",
    ]) {
      expect(SINISTRO_STATI).toContain(slug);
    }
  });

  it("include le nuove voci richieste", () => {
    expect(SINISTRO_STATI).toContain("apertura_cautelativa");
    expect(SINISTRO_STATI).toContain("apertura_sinistro");
    expect(SINISTRO_STATI).toContain("chiuso_senza_seguito");
    expect(SINISTRO_STATI).toContain("procedimento_giudizio_concluso");
    expect(SINISTRO_STATI).toContain("i_sollecito_doc_cliente");
  });
});

describe("isArchiviato / aperti", () => {
  it("riconosce archiviato in modo case-insensitive", () => {
    expect(isArchiviato("archiviato")).toBe(true);
    expect(isArchiviato("Archiviato")).toBe(true);
    expect(isArchiviato("aperto")).toBe(false);
    expect(isArchiviato(null)).toBe(false);
  });

  it("tratta archiviato come terminale, non aperto", () => {
    expect(isSinistroTerminale("archiviato")).toBe(true);
    expect(isSinistroAperto("archiviato")).toBe(false);
    expect(isSinistroAperto("aperto")).toBe(true);
    expect(isSinistroAperto("chiuso")).toBe(false);
    expect(isSinistroAperto("respinto")).toBe(false);
  });
});

describe("isStatoChiusuraArchivio", () => {
  it("riconosce CHIUSO*, ARCHIVIATO e analoghi terminali", () => {
    for (const s of [
      "chiuso",
      "CHIUSO",
      "chiuso_senza_seguito",
      "chiuso_senza_seguito_fuori_garanzia",
      "chiuso_senza_seguito_in_franchigia",
      "chiuso_senza_seguito_prescritto",
      "chiuso_card_passivo",
      "chiuso_senza_responsabilita",
      "archiviato",
      "procedimento_giudizio_concluso",
      "passaggio_ad_altro_broker",
      "liquidato",
      "respinto",
    ]) {
      expect(isStatoChiusuraArchivio(s)).toBe(true);
    }
  });

  it("non tratta come chiusura gli stati operativi", () => {
    for (const s of [
      "aperto",
      "apertura_sinistro",
      "in_lavorazione",
      "in_attesa_documenti",
      "liquidato_parziale",
      "liquidazione_transattiva",
      "contenzioso",
      "card_attivo",
    ]) {
      expect(isStatoChiusuraArchivio(s)).toBe(false);
    }
  });
});

describe("puoRiaprireSinistro", () => {
  it("solo admin può passare da chiusura a non-chiusura", () => {
    expect(puoRiaprireSinistro("admin", "chiuso", "aperto")).toBe(true);
    expect(puoRiaprireSinistro("admin", "archiviato", "in_lavorazione")).toBe(true);
    expect(puoRiaprireSinistro("ufficio", "chiuso", "aperto")).toBe(false);
    expect(puoRiaprireSinistro("contabilita", "chiuso_senza_seguito", "apertura_sinistro")).toBe(false);
    expect(puoRiaprireSinistro(null, "chiuso", "aperto")).toBe(false);
  });

  it("consente i passaggi tra stati di chiusura e da non-chiuso", () => {
    expect(puoRiaprireSinistro("ufficio", "chiuso", "archiviato")).toBe(true);
    expect(puoRiaprireSinistro("ufficio", "aperto", "chiuso")).toBe(true);
    expect(puoRiaprireSinistro("ufficio", "in_lavorazione", "in_liquidazione")).toBe(true);
    expect(puoRiaprireSinistro("admin", "chiuso", "respinto")).toBe(true);
  });
});

describe("statiSelezionabiliPerCambio", () => {
  it("nasconde la riapertura ai non-admin", () => {
    const opts = statiSelezionabiliPerCambio("chiuso", false);
    expect(opts.every((s) => isStatoChiusuraArchivio(s))).toBe(true);
    expect(opts).not.toContain("aperto");
    expect(opts).toContain("archiviato");
  });

  it("admin vede anche gli stati non-chiusi", () => {
    const opts = statiSelezionabiliPerCambio("chiuso", true);
    expect(opts).toContain("aperto");
    expect(opts).toContain("archiviato");
    expect(opts).not.toContain("chiuso");
  });
});

describe("puoModificareCompagniaSinistro", () => {
  it("blocca solo chiuso e archiviato, con varianti di casing/spazi", () => {
    expect(puoModificareCompagniaSinistro("chiuso")).toBe(false);
    expect(puoModificareCompagniaSinistro("Chiuso")).toBe(false);
    expect(puoModificareCompagniaSinistro(" CHIUSO ")).toBe(false);
    expect(puoModificareCompagniaSinistro("archiviato")).toBe(false);
    expect(puoModificareCompagniaSinistro("Archiviato")).toBe(false);
    expect(puoModificareCompagniaSinistro(" archiviato ")).toBe(false);
  });

  it("consente la modifica su tutti gli altri stati, incluso respinto", () => {
    expect(puoModificareCompagniaSinistro("in_attesa_documenti")).toBe(true);
    expect(puoModificareCompagniaSinistro("aperto")).toBe(true);
    expect(puoModificareCompagniaSinistro("in_lavorazione")).toBe(true);
    expect(puoModificareCompagniaSinistro("in_liquidazione")).toBe(true);
    expect(puoModificareCompagniaSinistro("in_valutazione")).toBe(true);
    expect(puoModificareCompagniaSinistro("bozza")).toBe(true);
    expect(puoModificareCompagniaSinistro("respinto")).toBe(true);
    expect(puoModificareCompagniaSinistro(null)).toBe(true);
    expect(puoModificareCompagniaSinistro("")).toBe(true);
  });
});

describe("statiVisibiliDefault", () => {
  it("esclude archiviato dalla lista operativa", () => {
    expect(statiVisibiliDefault()).toEqual(SINISTRO_STATI_OPERATIVI);
    expect(statiVisibiliDefault()).not.toContain(SINISTRO_STATO_ARCHIVIATO);
    expect(statiVisibiliDefault()).toContain("bozza");
    expect(statiVisibiliDefault()).toContain("respinto");
    expect(statiVisibiliDefault()).toContain("apertura_sinistro");
  });
});

describe("labelStatoSinistro", () => {
  it("usa sempre label CAPS, anche sui vecchi slug", () => {
    expect(labelStatoSinistro("archiviato")).toBe("ARCHIVIATO");
    expect(labelStatoSinistro("bozza")).toBe("BOZZA");
    expect(labelStatoSinistro("in_valutazione")).toBe("IN VALUTAZIONE");
    expect(labelStatoSinistro("aperto")).toBe("APERTO");
    expect(labelStatoSinistro("chiuso_senza_seguito")).toBe("CHIUSO SENZA SEGUITO");
    expect(labelStatoSinistro("")).toBe("—");
  });
});

describe("resolveStatoFiltroLista", () => {
  it("tab normali + tutti = neq archiviato", () => {
    expect(resolveStatoFiltroLista({ tab: "elenco", stato: "tutti" })).toEqual({
      kind: "neq",
      value: "archiviato",
    });
    expect(resolveStatoFiltroLista({ tab: "ricerca" })).toEqual({
      kind: "neq",
      value: "archiviato",
    });
  });

  it("tab archiviati forza solo archiviato", () => {
    expect(resolveStatoFiltroLista({ tab: "archiviati", stato: "aperto" })).toEqual({
      kind: "eq",
      value: "archiviato",
    });
  });

  it("filtro esplicito (anche archiviato) su tab normali", () => {
    expect(resolveStatoFiltroLista({ tab: "elenco", stato: "aperto" })).toEqual({
      kind: "eq",
      value: "aperto",
    });
    expect(resolveStatoFiltroLista({ tab: "elenco", stato: "archiviato" })).toEqual({
      kind: "eq",
      value: "archiviato",
    });
  });
});

describe("applyStatoFiltroLista / portale / operativo", () => {
  function mockQuery() {
    const calls: Array<{ op: string; col: string; val: unknown }> = [];
    const q = {
      eq(col: string, val: string) {
        calls.push({ op: "eq", col, val });
        return q;
      },
      neq(col: string, val: string) {
        calls.push({ op: "neq", col, val });
        return q;
      },
      in(col: string, val: string[]) {
        calls.push({ op: "in", col, val });
        return q;
      },
      calls,
    };
    return q;
  }

  it("applica neq archiviato sul portale cliente", () => {
    const q = mockQuery();
    applyFiltroPortaleCliente(q);
    expect(q.calls).toEqual([{ op: "neq", col: "stato", val: "archiviato" }]);
  });

  it("lista default e tab archiviati", () => {
    const a = mockQuery();
    applyStatoFiltroLista(a, { tab: "elenco", stato: "tutti" });
    expect(a.calls).toEqual([{ op: "neq", col: "stato", val: "archiviato" }]);

    const b = mockQuery();
    applyStatoFiltroLista(b, { tab: "archiviati" });
    expect(b.calls).toEqual([{ op: "eq", col: "stato", val: "archiviato" }]);
  });

  it("filtro operativo: default nasconde, selezione esplicita include", () => {
    const a = mockQuery();
    applyStatoFiltroOperativo(a, []);
    expect(a.calls).toEqual([{ op: "neq", col: "stato", val: "archiviato" }]);

    const b = mockQuery();
    applyStatoFiltroOperativo(b, ["archiviato"], "sinistri.stato");
    expect(b.calls).toEqual([{ op: "in", col: "sinistri.stato", val: ["archiviato"] }]);
  });
});

describe("excludeArchiviati", () => {
  it("toglie le pratiche archiviate da export/report", () => {
    const rows = [
      { id: "1", stato: "aperto" },
      { id: "2", stato: "archiviato" },
      { id: "3", stato: "chiuso" },
    ];
    expect(excludeArchiviati(rows).map((r) => r.id)).toEqual(["1", "3"]);
  });
});
