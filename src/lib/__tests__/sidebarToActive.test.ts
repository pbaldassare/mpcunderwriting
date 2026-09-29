import { describe, expect, it } from "vitest";
import { isSidebarToActive } from "@/lib/sidebarToActive";

describe("isSidebarToActive", () => {
  const archivio = "/portafoglio/documentale";
  const mpcbot = "/portafoglio/documentale?tab=mpc-bot";

  it("accende MPC Bot con tab mpc-bot e con i vecchi valori", () => {
    expect(isSidebarToActive({ pathname: "/portafoglio/documentale", search: "?tab=mpc-bot" }, mpcbot)).toBe(true);
    expect(isSidebarToActive({ pathname: "/portafoglio/documentale", search: "?tab=cb-bot" }, mpcbot)).toBe(true);
    expect(isSidebarToActive({ pathname: "/portafoglio/documentale", search: "?tab=assistente-garanzie" }, mpcbot)).toBe(true);
    expect(isSidebarToActive({ pathname: "/portafoglio/documentale", search: "" }, mpcbot)).toBe(false);
    expect(isSidebarToActive({ pathname: "/portafoglio/documentale", search: "?tab=mpc-bot" }, archivio)).toBe(false);
  });

  it("accende Archivio Documentale quando non si è su MPC Bot", () => {
    expect(isSidebarToActive({ pathname: "/portafoglio/documentale", search: "" }, archivio)).toBe(true);
    expect(isSidebarToActive({ pathname: "/portafoglio/documentale", search: "?tab=libreria-cga" }, archivio)).toBe(true);
  });

  it("accende l'hub admin /mpc-bot solo su quel ramo", () => {
    expect(isSidebarToActive({ pathname: "/mpc-bot", search: "" }, "/mpc-bot")).toBe(true);
    expect(isSidebarToActive({ pathname: "/mpc-bot/fonti-siti", search: "" }, "/mpc-bot")).toBe(true);
    expect(isSidebarToActive({ pathname: "/portafoglio/documentale", search: "?tab=mpc-bot" }, "/mpc-bot")).toBe(false);
  });

  it("non accende Trattative su Storico Gare se end è true", () => {
    const loc = { pathname: "/trattative/storico-gare", search: "" };
    expect(isSidebarToActive(loc, "/trattative", true)).toBe(false);
    expect(isSidebarToActive(loc, "/trattative/storico-gare")).toBe(true);
    expect(isSidebarToActive({ pathname: "/trattative", search: "" }, "/trattative", true)).toBe(true);
  });
});
