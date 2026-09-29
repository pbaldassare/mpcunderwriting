import { describe, expect, it } from "vitest";
import { resolveStatoContrattoTitolo } from "../statoContrattoTitolo";

describe("resolveStatoContrattoTitolo", () => {
  it("se il titolo è annullato non resta 'attiva' (duplica agganciata ad altra polizza)", () => {
    const s = resolveStatoContrattoTitolo("annullato", "attiva");
    expect(s.isAnnullato).toBe(true);
    expect(s.isAttivo).toBe(false);
    expect(s.polizzaStatoDisplay).toBe("annullata");
  });

  it("contratto sospeso se titolo o polizza lo dicono", () => {
    expect(resolveStatoContrattoTitolo("sospeso", "attiva").isSospeso).toBe(true);
    expect(resolveStatoContrattoTitolo("attivo", "sospesa").isSospeso).toBe(true);
  });

  it("attivo solo se non annullato", () => {
    expect(resolveStatoContrattoTitolo("attivo", "attiva").isAttivo).toBe(true);
    expect(resolveStatoContrattoTitolo("attivo", null).isAttivo).toBe(true);
  });
});
