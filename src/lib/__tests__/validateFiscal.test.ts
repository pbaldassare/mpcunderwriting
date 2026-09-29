import { describe, it, expect } from "vitest";
import { validatePIVA } from "../validatePIVA";
import { validateCF } from "../validateCF";

describe("validatePIVA", () => {
  it("accetta P.IVA valide note", () => {
    expect(validatePIVA("00743110157").valid).toBe(true); // Pirelli
    expect(validatePIVA("12345670785").valid).toBe(true);
  });
  it("rifiuta lunghezza errata", () => {
    expect(validatePIVA("123").valid).toBe(false);
  });
  it("rifiuta caratteri non numerici", () => {
    expect(validatePIVA("AB345670785").valid).toBe(false);
  });
  it("rifiuta checksum errato", () => {
    expect(validatePIVA("12345678901").valid).toBe(false);
  });
  it("rifiuta vuoto", () => {
    expect(validatePIVA("").valid).toBe(false);
  });
});

describe("validateCF", () => {
  it("accetta CF persona valido", () => {
    expect(validateCF("RSSMRA80A01H501U").valid).toBe(true);
  });
  it("rifiuta CF persona con char di controllo errato", () => {
    expect(validateCF("RSSMRA80A01H501Z").valid).toBe(false);
  });
  it("accetta formato P.IVA per azienda", () => {
    const r = validateCF("00743110157");
    expect(r.valid).toBe(true);
    expect(r.isPIVAFormat).toBe(true);
  });
  it("rifiuta formato non valido", () => {
    expect(validateCF("ABC").valid).toBe(false);
  });
  it("segnala posizione errata con dettaglio (cifra al posto di lettera in pos. 12)", () => {
    const r = validateCF("BLDPLA74R211449G");
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/posizione 12/);
  });
});

