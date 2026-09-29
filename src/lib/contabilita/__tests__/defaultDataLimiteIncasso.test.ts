import { describe, it, expect } from "vitest";
import { defaultDataLimiteIncassoIso } from "../defaultDataLimiteIncasso";

const iso = (y: number, m0: number, d: number) =>
  defaultDataLimiteIncassoIso(new Date(y, m0, d, 12, 0, 0));

describe("defaultDataLimiteIncasso", () => {
  it("in settembre (anche prima dell'11) è il 30 settembre", () => {
    expect(iso(2026, 8, 1)).toBe("2026-09-30");
    expect(iso(2026, 8, 7)).toBe("2026-09-30");
    expect(iso(2026, 8, 11)).toBe("2026-09-30");
    expect(iso(2026, 8, 30)).toBe("2026-09-30");
  });

  it("fino al 10 ottobre resta il 30 settembre", () => {
    expect(iso(2026, 9, 1)).toBe("2026-09-30");
    expect(iso(2026, 9, 10)).toBe("2026-09-30");
  });

  it("dall'11 ottobre al 10 novembre è fine ottobre", () => {
    expect(iso(2026, 9, 11)).toBe("2026-10-31");
    expect(iso(2026, 9, 31)).toBe("2026-10-31");
    expect(iso(2026, 10, 10)).toBe("2026-10-31");
  });

  it("dall'11 novembre è fine novembre", () => {
    expect(iso(2026, 10, 11)).toBe("2026-11-30");
  });

  it("a cavallo d'anno: 1–10 gennaio = 31 dicembre", () => {
    expect(iso(2027, 0, 10)).toBe("2026-12-31");
    expect(iso(2027, 0, 11)).toBe("2027-01-31");
  });
});
