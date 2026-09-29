import { describe, expect, it } from "vitest";
import { ensureFileExtension, fileBaseNameWithoutExt, sanitizeStorageFileName } from "@/lib/sanitizeFileName";

describe("sanitizeStorageFileName", () => {
  it("normalizza spazi e accenti", () => {
    expect(sanitizeStorageFileName("RILPRE giu2026.csv")).toBe("RILPRE_giu2026.csv");
  });
});

describe("fileBaseNameWithoutExt", () => {
  it("rimuove estensione e percorso", () => {
    expect(fileBaseNameWithoutExt("RILPRE giu2026.csv")).toBe("RILPRE giu2026");
    expect(fileBaseNameWithoutExt("C:\\docs\\report.pdf")).toBe("report");
  });

  it("gestisce nomi senza estensione", () => {
    expect(fileBaseNameWithoutExt("README")).toBe("README");
  });
});

describe("ensureFileExtension", () => {
  it("aggiunge estensione se mancante", () => {
    expect(ensureFileExtension("Rilascio Premio", "RILPRE giu2026.csv")).toBe("Rilascio Premio.csv");
  });

  it("non duplica estensione già presente", () => {
    expect(ensureFileExtension("doc.pdf", "originale.pdf")).toBe("doc.pdf");
  });
});
