import { describe, expect, it } from "vitest";
import {
  CB_BOT_LABEL,
  documentaleRouteLabel,
  documentaleTabFromLocation,
  documentaleTabToQuery,
  parseDocumentaleTab,
} from "@/lib/documentaleTab";

describe("parseDocumentaleTab", () => {
  it("mappa tab=cb-bot sul tab interno CB Bot", () => {
    expect(parseDocumentaleTab("cb-bot", false)).toBe("assistente-garanzie");
    expect(parseDocumentaleTab("assistente-garanzie", false)).toBe("assistente-garanzie");
  });

  it("senza query apre Archivio (admin) o CB Bot (consultazione)", () => {
    expect(parseDocumentaleTab(null, false)).toBe("archivio");
    expect(parseDocumentaleTab(null, true)).toBe("assistente-garanzie");
  });
});

describe("documentale chrome labels", () => {
  it("usa CB Bot su assistente e libreria, Archivio Documentale sull'archivio", () => {
    expect(documentaleRouteLabel("assistente-garanzie")).toBe(CB_BOT_LABEL);
    expect(documentaleRouteLabel("libreria-cga")).toBe(CB_BOT_LABEL);
    expect(documentaleRouteLabel("archivio")).toBe("Archivio Documentale");
  });

  it("legge ?tab=cb-bot dalla location", () => {
    expect(documentaleTabFromLocation("/portafoglio/documentale", "?tab=cb-bot")).toBe("assistente-garanzie");
    expect(documentaleRouteLabel(documentaleTabFromLocation("/portafoglio/documentale", "?tab=cb-bot"))).toBe("CB Bot");
    expect(documentaleRouteLabel(documentaleTabFromLocation("/portafoglio/documentale", ""))).toBe("Archivio Documentale");
  });
});

describe("documentaleTabToQuery", () => {
  it("serializza CB Bot come tab=cb-bot", () => {
    expect(documentaleTabToQuery("assistente-garanzie", false)).toBe("cb-bot");
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
