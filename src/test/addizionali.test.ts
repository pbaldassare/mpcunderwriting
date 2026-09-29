import { describe, it, expect } from "vitest";

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Replica la logica di parsing usata in VociRcaCard per Addizionali. */
function parseAddizionali(input: string): { val: number; error: boolean } {
  const text = (input ?? "").toString().trim();
  if (text === "") return { val: 0, error: false };
  const raw = Number(text.replace(",", "."));
  if (!Number.isFinite(raw) || raw < 0) return { val: 0, error: true };
  return { val: round2(raw), error: false };
}

function lordoConAddizionali(lordoBase: number, addInput: string): number {
  const { val } = parseAddizionali(addInput);
  return round2(lordoBase + val);
}

describe("Addizionali parsing & inclusion in Lordo", () => {
  it("vuoto → 0 senza errore", () => {
    expect(parseAddizionali("")).toEqual({ val: 0, error: false });
    expect(parseAddizionali("   ")).toEqual({ val: 0, error: false });
  });

  it("zero esplicito → 0", () => {
    expect(parseAddizionali("0")).toEqual({ val: 0, error: false });
    expect(parseAddizionali("0.00")).toEqual({ val: 0, error: false });
  });

  it("valore non numerico → errore e fallback 0", () => {
    expect(parseAddizionali("abc")).toEqual({ val: 0, error: true });
    expect(parseAddizionali("12abc")).toEqual({ val: 0, error: true });
  });

  it("negativo → errore", () => {
    expect(parseAddizionali("-5")).toEqual({ val: 0, error: true });
  });

  it("supporta virgola decimale", () => {
    expect(parseAddizionali("12,50")).toEqual({ val: 12.5, error: false });
  });

  it("Lordo Firma include Addizionali validi", () => {
    expect(lordoConAddizionali(100, "25.50")).toBe(125.5);
  });

  it("Lordo Quietanza con Addizionali vuoto = base", () => {
    expect(lordoConAddizionali(200, "")).toBe(200);
  });

  it("Lordo con Addizionali non numerico = base (fallback 0)", () => {
    expect(lordoConAddizionali(150, "boh")).toBe(150);
  });
});
