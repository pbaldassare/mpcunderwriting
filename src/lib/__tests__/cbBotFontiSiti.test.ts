import { afterEach, describe, expect, it, vi } from "vitest";
import {
  countCbBotFontiSiti,
  mergeFontiUfficiali,
  seedFontiUfficialiSeVuoto,
} from "@/lib/cbBotFontiSiti";

describe("cbBotFontiSiti", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it("count non scrive e non crasha", () => {
    expect(countCbBotFontiSiti()).toBe(0);
  });

  it("seed resiste a randomUUID assente", () => {
    vi.stubGlobal("crypto", {});
    const rows = seedFontiUfficialiSeVuoto();
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].id).toBeTruthy();
  });

  it("merge assegna id anche senza randomUUID", () => {
    vi.stubGlobal("crypto", {
      randomUUID: () => {
        throw new Error("Secure random unavailable");
      },
    });
    const rows = mergeFontiUfficiali([]);
    expect(rows.every((r) => r.id && r.url)).toBe(true);
  });
});
