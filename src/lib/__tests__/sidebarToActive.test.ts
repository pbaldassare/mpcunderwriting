import { describe, expect, it } from "vitest";
import { isSidebarToActive } from "@/lib/sidebarToActive";

describe("isSidebarToActive", () => {
  const archivio = "/portafoglio/documentale";
  const cbbot = "/portafoglio/documentale?tab=cb-bot";

  it("accende CB Bot solo con tab cb-bot", () => {
    expect(isSidebarToActive({ pathname: "/portafoglio/documentale", search: "?tab=cb-bot" }, cbbot)).toBe(true);
    expect(isSidebarToActive({ pathname: "/portafoglio/documentale", search: "?tab=assistente-garanzie" }, cbbot)).toBe(true);
    expect(isSidebarToActive({ pathname: "/portafoglio/documentale", search: "" }, cbbot)).toBe(false);
    expect(isSidebarToActive({ pathname: "/portafoglio/documentale", search: "?tab=cb-bot" }, archivio)).toBe(false);
  });

  it("accende Archivio Documentale quando non si è su CB Bot", () => {
    expect(isSidebarToActive({ pathname: "/portafoglio/documentale", search: "" }, archivio)).toBe(true);
    expect(isSidebarToActive({ pathname: "/portafoglio/documentale", search: "?tab=libreria-cga" }, archivio)).toBe(true);
  });

  it("accende l'hub admin /cb-bot solo su quel ramo", () => {
    expect(isSidebarToActive({ pathname: "/cb-bot", search: "" }, "/cb-bot")).toBe(true);
    expect(isSidebarToActive({ pathname: "/cb-bot/fonti-siti", search: "" }, "/cb-bot")).toBe(true);
    expect(isSidebarToActive({ pathname: "/portafoglio/documentale", search: "?tab=cb-bot" }, "/cb-bot")).toBe(false);
  });

  it("non accende Trattative su Storico Gare se end è true", () => {
    const loc = { pathname: "/trattative/storico-gare", search: "" };
    expect(isSidebarToActive(loc, "/trattative", true)).toBe(false);
    expect(isSidebarToActive(loc, "/trattative/storico-gare")).toBe(true);
    expect(isSidebarToActive({ pathname: "/trattative", search: "" }, "/trattative", true)).toBe(true);
  });
});
