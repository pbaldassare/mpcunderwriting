import { describe, expect, it } from "vitest";
import {
  applyLinkPatterns,
  collectHarvestUrls,
  extractDocumentLinks,
  flattenTedApiLinks,
  isBandoMonitorabile,
  isMonitorDue,
  labelMonitorScript,
  normalizeMonitorScript,
  tedOfficialPdfUrls,
  uniqueHttpUrls,
} from "@/lib/bandiMonitor";

const html = `
  <html><body>
    <a href="/docs/bando.pdf">Avviso di gara</a>
    <a href="https://ente.it/allegati/disciplinare.pdf">Disciplinare</a>
    <a href="javascript:void(0)">No</a>
    <a href="/chi-siamo">Chi siamo</a>
    <a href="https://ente.it/download?id=9">Capitolato tecnico</a>
  </body></html>
`;

describe("bandiMonitor", () => {
  it("estrae solo i link documento dalla pagina", () => {
    const links = extractDocumentLinks(html, "https://ente.it/scheda/1");
    expect(links.map((l) => l.url)).toEqual([
      "https://ente.it/docs/bando.pdf",
      "https://ente.it/allegati/disciplinare.pdf",
      "https://ente.it/download?id=9",
    ]);
    expect(links[0].nome).toBe("Avviso di gara");
  });

  it("unisce pdf principale, extra e scoperti senza duplicati", () => {
    expect(collectHarvestUrls({
      pdfUrl: "https://ente.it/docs/bando.pdf",
      extraUrls: ["https://ente.it/allegati/disciplinare.pdf", "https://ente.it/docs/bando.pdf"],
      discovered: ["https://ente.it/download?id=9", "mailto:x@y.it"],
    })).toEqual([
      "https://ente.it/docs/bando.pdf",
      "https://ente.it/allegati/disciplinare.pdf",
      "https://ente.it/download?id=9",
    ]);
  });

  it("filtra i link scoperti con i pattern dello script", () => {
    expect(applyLinkPatterns(
      ["https://ente.it/bando.pdf", "https://altro.it/x.pdf"],
      ["ente\\.it"],
    )).toEqual(["https://ente.it/bando.pdf"]);
  });

  it("dice quando il check è scaduto", () => {
    expect(isMonitorDue(null)).toBe(true);
    expect(isMonitorDue(new Date(Date.now() - 2 * 3600_000).toISOString(), Date.now(), 24)).toBe(false);
    expect(isMonitorDue(new Date(Date.now() - 25 * 3600_000).toISOString(), Date.now(), 24)).toBe(true);
    expect(isBandoMonitorabile("in_monitoraggio")).toBe(true);
    expect(isBandoMonitorabile("archiviato_storico")).toBe(false);
  });

  it("normalizza lo script e etichetta la riga", () => {
    const script = normalizeMonitorScript({
      extra_urls: ["https://ente.it/a.pdf", "not-a-url"],
      documenti: [{ url: "https://ente.it/b.pdf", tipo: "disciplinare", nome: "Disc." }],
      link_patterns: ["\\.pdf$"],
    });
    expect(script.extra_urls).toEqual(["https://ente.it/a.pdf"]);
    expect(script.documenti).toHaveLength(1);
    expect(uniqueHttpUrls(["https://a.it/x", "https://a.it/x#y"])).toEqual(["https://a.it/x"]);
    expect(labelMonitorScript({
      id: "1",
      bando_id: "b",
      versione: 2,
      motore: "ted",
      source_url: "https://ente.it",
      script_json: script,
      generated_at: new Date().toISOString(),
    })).toBe("Script v2 · 2 link");
  });

  it("ricostruisce i PDF ufficiali TED e i link API", () => {
    const official = tedOfficialPdfUrls("245559-2026");
    expect(official[0].url).toContain("TED:NOTICE:245559-2026:TEXT:IT:PDF");
    const fromApi = flattenTedApiLinks({
      pdf: { ITA: "https://ted.europa.eu/files/245559-2026.pdf", ENG: "https://ted.europa.eu/files/en.pdf" },
      html: { ITA: "https://ted.europa.eu/it/notice/-/detail/245559-2026" },
    });
    expect(fromApi.map((l) => l.url)).toEqual([
      "https://ted.europa.eu/files/245559-2026.pdf",
      "https://ted.europa.eu/files/en.pdf",
    ]);
  });

  it("prende anche data-href e più d 8 documenti", () => {
    const extra = extractDocumentLinks(
      `<a data-href="/atti/chiarimenti.pdf">FAQ</a>`,
      "https://ente.it",
    );
    expect(extra[0].url).toBe("https://ente.it/atti/chiarimenti.pdf");
    const many = Array.from({ length: 12 }, (_, i) => `https://ente.it/d${i}.pdf`);
    expect(collectHarvestUrls({ extraUrls: many })).toHaveLength(12);
  });
});
