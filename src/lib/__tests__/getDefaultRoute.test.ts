import { describe, it, expect } from "vitest";
import { getDefaultRoute } from "../getDefaultRoute";

describe("getDefaultRoute", () => {
  it("profilo null/undefined → /login", () => {
    expect(getDefaultRoute(null)).toBe("/login");
    expect(getDefaultRoute(undefined)).toBe("/login");
  });

  it("ruoli portale → rotte dedicate", () => {
    expect(getDefaultRoute({ ruolo: "cliente" })).toBe("/cliente");
    expect(getDefaultRoute({ ruolo: "prospect" })).toBe("/prospect");
  });

  it("admin → dashboard", () => {
    expect(getDefaultRoute({ ruolo: "admin" })).toBe("/");
  });

  it("permessi assenti o dashboard=true → /", () => {
    expect(getDefaultRoute({ ruolo: "ufficio" })).toBe("/");
    expect(getDefaultRoute({ ruolo: "ufficio", permessi_json: { dashboard: true } })).toBe("/");
  });

  it("redirect alla prima area permessa", () => {
    expect(getDefaultRoute({ ruolo: "produttore", permessi_json: { titoli: true, dashboard: false } })).toBe(
      "/portafoglio/attive",
    );
    expect(getDefaultRoute({ ruolo: "contabilita", permessi_json: { contabilita: true, dashboard: false } })).toBe(
      "/contabilita",
    );
    expect(getDefaultRoute({ ruolo: "ufficio", permessi_json: { portafoglio: true, dashboard: false } })).toBe(
      "/portafoglio/documentale",
    );
    expect(getDefaultRoute({ ruolo: "ufficio", permessi_json: { anagrafiche: true, dashboard: false } })).toBe(
      "/archivi/anagrafiche",
    );
  });

  it("fallback → / quando nessun permesso mappato", () => {
    expect(getDefaultRoute({ ruolo: "manager", permessi_json: { report: true, dashboard: false } })).toBe("/");
  });
});
