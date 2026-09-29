import { describe, expect, it } from "vitest";
import {
  isTedPublicationNumber,
  labelTipoAvviso,
  labelTipoProcedura,
  dettaglioUpdatePayload,
  mergeDettaglio,
  needsDettaglioHarvest,
  parsePeriodoDaTitolo,
  toIsoDate,
} from "@/lib/bandiDettaglio";

describe("bandiDettaglio", () => {
  it("riconosce il numero TED e normalizza le date", () => {
    expect(isTedPublicationNumber("256021-2026")).toBe(true);
    expect(isTedPublicationNumber("14893370")).toBe(false);
    expect(toIsoDate("2026-02-03+01:00")).toBe("2026-02-03");
    expect(toIsoDate("12/03/2026")).toBe("2026-03-12");
  });

  it("estrae il periodo di servizio dal titolo", () => {
    const p = parsePeriodoDaTitolo(
      "AFFIDAMENTO DEL SERVIZIO DI BROKERAGGIO ASSICURATIVO PER IL PERIODO DAL 01.09.2024 AL 31.08.2027",
    );
    expect(p.servizio_da).toBe("2024-09-01");
    expect(p.servizio_a).toBe("2027-08-31");
  });

  it("etichetta avviso e procedura", () => {
    expect(labelTipoAvviso("esito")).toBe("Esito / aggiudicato");
    expect(labelTipoAvviso("gara")).toBe("Gara");
    expect(labelTipoProcedura("open")).toBe("Procedura aperta");
  });

  it("sa quando serve l'harvest e unisce i campi", () => {
    expect(needsDettaglioHarvest({ titolo: "x" })).toBe(true);
    expect(needsDettaglioHarvest({ tipo_avviso: "esito" })).toBe(false);
    const merged = mergeDettaglio(
      { titolo: "Servizio dal 01.01.2025 al 31.12.2029" },
      { tipo_avviso: "esito", aggiudicato: true, aggiudicatario: "HOWDEN ASSITECA" },
    );
    expect(merged.aggiudicatario).toBe("HOWDEN ASSITECA");
    expect(merged.servizio_da).toBe("2025-01-01");
    expect(merged.servizio_a).toBe("2029-12-31");
  });

  it("marca scaduto l'esito in update", () => {
    const payload = dettaglioUpdatePayload({
      tipo_avviso: "esito",
      aggiudicato: true,
      aggiudicatario: "WILLIS ITALIA SPA",
      scadenza: "2026-03-12",
    });
    expect(payload.stato).toBe("scaduto");
    expect(payload.aggiudicato).toBe(true);
    expect(payload.scadenza).toBe("2026-03-12");
  });
});
