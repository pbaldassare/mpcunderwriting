import { describe, it, expect } from "vitest";
import {
  bypassesSedeFilterContiBancari,
  contoBancarioVisibilePerSede,
  filterContiBancariPerSede,
  shouldScopeClientiPerSede,
} from "../filterContiBancariPerSede";

const conto = (id: string, tipo: string, ufficio_ids: string[]) => ({
  id,
  tipo,
  ufficio_ids,
});

describe("filterContiBancariPerSede", () => {
  const conti = [
    conto("a", "incasso_clienti", ["sede-1", "sede-2"]),
    conto("b", "generico", ["sede-2"]),
    conto("c", "agenzia", []),
  ];

  it("admin vede tutti i conti Consulbrokers", () => {
    expect(filterContiBancariPerSede(conti, { ruolo: "admin", ufficioId: "sede-9" })).toHaveLength(3);
  });

  it("cfo vede tutti i conti Consulbrokers", () => {
    expect(filterContiBancariPerSede(conti, { ruolo: "cfo", ufficioId: "sede-9" })).toHaveLength(3);
  });

  it("ufficio filtra per sede abilitata", () => {
    const filtered = filterContiBancariPerSede(conti, { ruolo: "ufficio", ufficioId: "sede-1" });
    expect(filtered.map((c) => c.id)).toEqual(["a", "c"]);
  });

  it("contabilita senza match su Consulbrokers", () => {
    const filtered = filterContiBancariPerSede(conti, { ruolo: "contabilita", ufficioId: "sede-9" });
    expect(filtered.map((c) => c.id)).toEqual(["c"]);
  });

  it("senza ufficio_id non vede conti Consulbrokers", () => {
    expect(contoBancarioVisibilePerSede(conto("x", "generico", ["sede-1"]), { ruolo: "ufficio" })).toBe(false);
  });

  it("bypassesSedeFilterContiBancari solo admin/cfo", () => {
    expect(bypassesSedeFilterContiBancari("admin")).toBe(true);
    expect(bypassesSedeFilterContiBancari("cfo")).toBe(true);
    expect(bypassesSedeFilterContiBancari("ufficio")).toBe(false);
  });

  it("shouldScopeClientiPerSede per ufficio con sede", () => {
    expect(shouldScopeClientiPerSede("ufficio", "sede-1")).toBe(true);
    expect(shouldScopeClientiPerSede("admin", "sede-1")).toBe(false);
    expect(shouldScopeClientiPerSede("ufficio", null)).toBe(false);
  });
});
