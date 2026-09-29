import { describe, expect, it } from "vitest";
import { formatDateIT } from "@/lib/formatDate";

describe("formatDateIT", () => {
  it("formatta YYYY-MM-DD in dd/MM/yyyy senza shift timezone", () => {
    expect(formatDateIT("2026-07-01")).toBe("01/07/2026");
    expect(formatDateIT("2026-12-31")).toBe("31/12/2026");
  });

  it("prende solo la data da ISO con orario", () => {
    expect(formatDateIT("2026-07-01T00:00:00.000Z")).toBe("01/07/2026");
  });

  it("vuoto o invalido → —", () => {
    expect(formatDateIT(null)).toBe("—");
    expect(formatDateIT(undefined)).toBe("—");
    expect(formatDateIT("")).toBe("—");
    expect(formatDateIT("   ")).toBe("—");
    expect(formatDateIT("01/07/2026")).toBe("—");
  });
});
