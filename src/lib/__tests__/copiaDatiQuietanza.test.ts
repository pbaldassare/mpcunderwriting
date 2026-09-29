import { describe, expect, it } from "vitest";
import {
  buildQuietanzaFigliaInsertFromMadre,
  buildQuietanzaFigliaUpdateFromMadre,
  canCopiaDatiInQuietanza,
  decideCopiaDatiInQuietanza,
  filterQuietanzeFiglie,
  importiQuietanzaDaMadre,
  isQuietanzaFigliaBloccata,
  nextRigaQuietanza,
  type CopiaDatiQuietanzaMadre,
} from "../copiaDatiQuietanza";

const madre = (over: Partial<CopiaDatiQuietanzaMadre> = {}): CopiaDatiQuietanzaMadre => ({
  id: "m1",
  numero_titolo: "POL-1",
  sostituisce_polizza: null,
  riga: 0,
  stato: "attivo",
  cliente_id: null,
  cliente_anagrafica_id: "cli-ana",
  garanzia_da: "2026-01-01",
  garanzia_a: "2026-12-31",
  premio_netto: 1000,
  tasse: 200,
  ssn_firma: 10,
  addizionali: 20,
  provvigioni_firma: 100,
  premio_lordo: 1230,
  ...over,
});

describe("canCopiaDatiInQuietanza", () => {
  it("consente la copia dalla polizza madre attiva", () => {
    expect(canCopiaDatiInQuietanza(madre()).ok).toBe(true);
  });
  it("blocca quietanze e appendici", () => {
    expect(canCopiaDatiInQuietanza(madre({ sostituisce_polizza: "POL-1" })).ok).toBe(false);
    expect(canCopiaDatiInQuietanza(madre({ is_appendice_modifica: true })).ok).toBe(false);
  });
  it("blocca senza numero polizza", () => {
    expect(canCopiaDatiInQuietanza(madre({ numero_titolo: "  " })).ok).toBe(false);
  });
  it("blocca polizza stornata, consente madre con stato incassato legacy", () => {
    expect(canCopiaDatiInQuietanza(madre({ stato: "stornato" })).ok).toBe(false);
    expect(canCopiaDatiInQuietanza(madre({ stato: "incassato" })).ok).toBe(true);
  });
});

describe("decideCopiaDatiInQuietanza", () => {
  it("crea se manca la figlia", () => {
    expect(decideCopiaDatiInQuietanza(madre(), [])).toEqual({ action: "create" });
  });
  it("ignora appendici e crea se non ci sono quietanze", () => {
    const decision = decideCopiaDatiInQuietanza(madre(), [
      { id: "am", sostituisce_polizza: "POL-1", is_appendice_modifica: true, riga: 1 },
    ]);
    expect(decision.action).toBe("create");
  });
  it("aggiorna la prima figlia non a cassa e non ne crea un'altra", () => {
    const decision = decideCopiaDatiInQuietanza(madre(), [
      { id: "q1", sostituisce_polizza: "POL-1", riga: 1, stato: "attivo" },
      { id: "q2", sostituisce_polizza: "POL-1", riga: 2, stato: "attivo" },
    ]);
    expect(decision).toEqual({
      action: "update",
      target: { id: "q1", sostituisce_polizza: "POL-1", riga: 1, stato: "attivo" },
    });
  });
  it("non tocca una quietanza già a cassa e non inventa rate", () => {
    const decision = decideCopiaDatiInQuietanza(madre(), [
      { id: "q1", sostituisce_polizza: "POL-1", riga: 1, stato: "incassato", data_messa_cassa: "2026-03-01" },
    ]);
    expect(decision.action).toBe("blocked");
  });
  it("aggiorna la figlia ancora aperta se la prima è a cassa", () => {
    const decision = decideCopiaDatiInQuietanza(madre(), [
      { id: "q1", sostituisce_polizza: "POL-1", riga: 1, data_messa_cassa: "2026-03-01" },
      { id: "q2", sostituisce_polizza: "POL-1", riga: 2, stato: "attivo" },
    ]);
    expect(decision.action).toBe("update");
    if (decision.action === "update") expect(decision.target.id).toBe("q2");
  });
});

describe("importiQuietanzaDaMadre", () => {
  it("usa i campi quietanza se presenti", () => {
    const imp = importiQuietanzaDaMadre(
      madre({
        premio_netto_quietanza: 800,
        tasse_quietanza: 160,
        ssn_quietanza: 8,
        addizionali_quietanza: 16,
        provvigioni_quietanza: 80,
      }),
    );
    expect(imp.premio_netto).toBe(800);
    expect(imp.premio_netto_quietanza).toBe(800);
    expect(imp.provvigioni_firma).toBe(80);
    expect(imp.premio_lordo).toBe(984);
  });
  it("fallback ai campi firma se la quietanza è vuota", () => {
    const imp = importiQuietanzaDaMadre(madre());
    expect(imp.premio_netto).toBe(1000);
    expect(imp.tasse).toBe(200);
    expect(imp.premio_lordo).toBe(1230);
  });
});

describe("buildQuietanzaFiglia*FromMadre", () => {
  it("insert: stessa polizza, sostituisce_polizza valorizzato, no cassa", () => {
    const payload = buildQuietanzaFigliaInsertFromMadre(
      madre({ cliente_id: null, cliente_anagrafica_id: "cli-ana" }),
      1,
    );
    expect(payload.numero_titolo).toBe("POL-1");
    expect(payload.sostituisce_polizza).toBe("POL-1");
    expect(payload.riga).toBe(1);
    expect(payload.stato).toBe("attivo");
    expect(payload.cliente_id).toBeNull();
    expect(payload.cliente_anagrafica_id).toBe("cli-ana");
    expect(payload.data_messa_cassa).toBeNull();
    expect(payload.is_appendice_modifica).toBe(false);
    expect(payload.garanzia_da).toBe("2026-01-01");
    expect(payload.premio_netto).toBe(1000);
  });
  it("update: non tocca stato/cassa, allinea premi e date", () => {
    const payload = buildQuietanzaFigliaUpdateFromMadre(madre({ premio_netto_quietanza: 500 }));
    expect(payload).not.toHaveProperty("stato");
    expect(payload).not.toHaveProperty("data_messa_cassa");
    expect(payload.premio_netto).toBe(500);
    expect(payload.sostituisce_polizza).toBe("POL-1");
  });
});

describe("nextRigaQuietanza / filter / lock", () => {
  it("riga figlia = max(madre, figlie) + 1", () => {
    expect(nextRigaQuietanza(madre({ riga: 0 }), [])).toBe(1);
    expect(
      nextRigaQuietanza(madre({ riga: 0 }), [
        { id: "q1", sostituisce_polizza: "POL-1", riga: 3 },
      ]),
    ).toBe(4);
  });
  it("non considera figlie di altre polizze", () => {
    expect(
      filterQuietanzeFiglie(madre(), [
        { id: "other", sostituisce_polizza: "ALTRO", riga: 1 },
      ]),
    ).toHaveLength(0);
  });
  it("isQuietanzaFigliaBloccata su cassa/storno/appendice", () => {
    expect(isQuietanzaFigliaBloccata({ id: "q", sostituisce_polizza: "P", stato: "attivo" })).toBe(false);
    expect(isQuietanzaFigliaBloccata({ id: "q", sostituisce_polizza: "P", data_messa_cassa: "2026-01-01" })).toBe(true);
    expect(isQuietanzaFigliaBloccata({ id: "q", sostituisce_polizza: "P", is_proroga: true })).toBe(true);
  });
});
