import { describe, expect, it } from "vitest";
import { normalizeNomeMatch } from "@/lib/bonificoDaIncasso";

describe("normalizeNomeMatch", () => {
  it("normalizza accenti e punteggiatura", () => {
    expect(normalizeNomeMatch("Piergommè S.A.S.")).toBe("PIERGOMME S A S");
  });

  it("è case-insensitive", () => {
    expect(normalizeNomeMatch("abc")).toBe(normalizeNomeMatch("ABC"));
  });
});
