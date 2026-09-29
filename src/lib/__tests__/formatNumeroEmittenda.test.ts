import { describe, expect, it } from "vitest";
import { formatNumeroEmittenda, isNumeroEmittenda } from "@/lib/formatNumeroEmittenda";

describe("formatNumeroEmittenda", () => {
  it("zero-pada a 4 cifre", () => {
    expect(formatNumeroEmittenda(1)).toBe("IA0001");
    expect(formatNumeroEmittenda(42)).toBe("IA0042");
    expect(formatNumeroEmittenda(9999)).toBe("IA9999");
  });

  it("oltre 9999 non tronca", () => {
    expect(formatNumeroEmittenda(10000)).toBe("IA10000");
    expect(formatNumeroEmittenda(123456)).toBe("IA123456");
  });

  it("rifiuta valori non validi", () => {
    expect(() => formatNumeroEmittenda(0)).toThrow();
    expect(() => formatNumeroEmittenda(1.5)).toThrow();
    expect(() => formatNumeroEmittenda(-1)).toThrow();
  });
});

describe("isNumeroEmittenda", () => {
  it("riconosce solo IA + cifre", () => {
    expect(isNumeroEmittenda("IA0001")).toBe(true);
    expect(isNumeroEmittenda("ia10000")).toBe(true);
    expect(isNumeroEmittenda("POL-001")).toBe(false);
    expect(isNumeroEmittenda("IA-0001")).toBe(false);
    expect(isNumeroEmittenda("")).toBe(false);
  });
});
