import { describe, expect, it } from "vitest";
import {
  CB_BOT_DOC_MAX_BYTES,
  CB_BOT_DOC_MAX_FILES,
  buildStoragePath,
  consultazioneDocFolder,
  isCbBotDocFileAllowed,
  isConsultazioneStoragePath,
  sanitizeStorageFileName,
  titoloFromFileName,
  validateCbBotDocFiles,
} from "@/lib/cbBotDocumenti";

describe("titoloFromFileName", () => {
  it("togli estensione e underscore", () => {
    expect(titoloFromFileName("CGA_Cyber_PMI.pdf")).toBe("CGA Cyber PMI");
  });
});

describe("sanitizeStorageFileName", () => {
  it("normalizza caratteri pericolosi", () => {
    expect(sanitizeStorageFileName("CGA / cyber?.pdf")).toBe("CGA_cyber.pdf");
  });
});

describe("isCbBotDocFileAllowed", () => {
  it("accetta PDF sotto il limite", () => {
    expect(isCbBotDocFileAllowed({ name: "a.pdf", type: "application/pdf", size: 100 })).toEqual({
      ok: true,
    });
  });

  it("rifiuta vuoti, troppo grandi e tipi non ammessi", () => {
    expect(isCbBotDocFileAllowed({ name: "a.pdf", size: 0 }).ok).toBe(false);
    expect(isCbBotDocFileAllowed({ name: "a.pdf", size: CB_BOT_DOC_MAX_BYTES + 1 }).ok).toBe(false);
    expect(isCbBotDocFileAllowed({ name: "foto.png", type: "image/png", size: 10 }).ok).toBe(false);
  });
});

describe("validateCbBotDocFiles", () => {
  it("limita il numero di file", () => {
    const files = Array.from({ length: CB_BOT_DOC_MAX_FILES + 1 }, (_, i) => ({
      name: `d${i}.pdf`,
      type: "application/pdf",
      size: 10,
    }));
    expect(validateCbBotDocFiles(files).ok).toBe(false);
    expect(validateCbBotDocFiles([]).ok).toBe(false);
  });
});

describe("buildStoragePath", () => {
  it("mette il file sotto la cartella utente", () => {
    const path = buildStoragePath("user-1", "CGA.pdf", "abc");
    expect(path).toBe("user-1/abc_CGA.pdf");
  });
});

describe("consultazioneDocFolder", () => {
  it("deriva una cartella stabile dalla email", () => {
    expect(consultazioneDocFolder("Mario.Rossi@ExeBroker.it")).toBe("c/mario_rossi_exebroker_it");
    expect(isConsultazioneStoragePath("c/mario_rossi_exebroker_it/x_CGA.pdf", "mario.rossi@exebroker.it")).toBe(true);
    expect(isConsultazioneStoragePath("user-1/x_CGA.pdf", "mario.rossi@exebroker.it")).toBe(false);
  });
});
