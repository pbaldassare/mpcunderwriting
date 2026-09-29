import { describe, expect, it } from "vitest";
import {
  CB_BOT_LABEL,
  documentaleRouteLabel,
  documentaleTabFromLocation,
  documentaleTabToQuery,
  parseDocumentaleTab,
} from "@/lib/documentaleTab";

describe("parseDocumentaleTab", () => {
  it("mappa tab=mpc-bot sul tab interno MPC Bot e accetta i vecchi valori", () => {
    expect(parseDocumentaleTab("mpc-bot", false)).toBe("assistente-garanzie");
    expect(parseDocumentaleTab("cb-bot", false)).toBe("assistente-garanzie");
    expect(parseDocumentaleTab("assistente-garanzie", false)).toBe("assistente-garanzie");
  });

  it("senza query apre Archivio (admin) o MPC Bot (consultazione)", () => {
    expect(parseDocumentaleTab(null, false)).toBe("archivio");
    expect(parseDocumentaleTab(null, true)).toBe("assistente-garanzie");
  });
});

describe("documentale chrome labels", () => {
  it("usa MPC Bot su assistente e libreria, Archivio Documentale sull'archivio", () => {
    expect(documentaleRouteLabel("assistente-garanzie")).toBe(CB_BOT_LABEL);
    expect(documentaleRouteLabel("libreria-cga")).toBe(CB_BOT_LABEL);
    expect(documentaleRouteLabel("archivio")).toBe("Archivio Documentale");
  });

  it("legge ?tab=mpc-bot dalla location", () => {
    expect(documentaleTabFromLocation("/portafoglio/documentale", "?tab=mpc-bot")).toBe("assistente-garanzie");
    expect(documentaleRouteLabel(documentaleTabFromLocation("/portafoglio/documentale", "?tab=mpc-bot"))).toBe("MPC Bot");
    expect(documentaleRouteLabel(documentaleTabFromLocation("/portafoglio/documentale", ""))).toBe("Archivio Documentale");
  });
});

describe("documentaleTabToQuery", () => {
  it("serializza MPC Bot come tab=mpc-bot", () => {
    expect(documentaleTabToQuery("assistente-garanzie", false)).toBe("mpc-bot");
  });

  it("omette tab sull'archivio in modalità normale", () => {
    expect(documentaleTabToQuery("archivio", false)).toBeNull();
    expect(documentaleTabToQuery("archivio", true)).toBe("archivio");
  });

  it("mantiene libreria-cga nella query", () => {
    expect(parseDocumentaleTab("libreria-cga", false)).toBe("libreria-cga");
    expect(documentaleTabToQuery("libreria-cga", false)).toBe("libreria-cga");
  });
});
