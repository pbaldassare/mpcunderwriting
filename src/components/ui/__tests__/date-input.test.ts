import { describe, expect, it } from "vitest";

import {
  formatIsoDateOnly,
  formatItalianDateOnly,
  maskItalianDateInput,
  maskItalianDateInputWithCursor,
  parseIsoDateOnly,
  parseItalianDateOnly,
} from "@/components/ui/date-input";

describe("date-input ISO helpers", () => {
  it("parseIsoDateOnly legge yyyy-MM-dd senza shift timezone", () => {
    const d = parseIsoDateOnly("2026-07-21");
    expect(d).toBeTruthy();
    expect(d!.getFullYear()).toBe(2026);
    expect(d!.getMonth()).toBe(6);
    expect(d!.getDate()).toBe(21);
  });

  it("formatIsoDateOnly produce yyyy-MM-dd", () => {
    expect(formatIsoDateOnly(new Date(2026, 6, 21))).toBe("2026-07-21");
  });

  it("accetta ISO con orario prendendo solo la data", () => {
    const d = parseIsoDateOnly("2026-07-21T12:00:00.000Z");
    expect(d?.getDate()).toBe(21);
    expect(d?.getMonth()).toBe(6);
  });
});

describe("date-input Italian helpers", () => {
  it("parseItalianDateOnly legge dd/MM/yyyy", () => {
    const d = parseItalianDateOnly("31/12/2024");
    expect(d).toBeTruthy();
    expect(d!.getFullYear()).toBe(2024);
    expect(d!.getMonth()).toBe(11);
    expect(d!.getDate()).toBe(31);
  });

  it("parseItalianDateOnly rifiuta date invalide", () => {
    expect(parseItalianDateOnly("31/02/2024")).toBeUndefined();
    expect(parseItalianDateOnly("abc")).toBeUndefined();
    expect(parseItalianDateOnly("2024-12-31")).toBeUndefined();
  });

  it("formatItalianDateOnly produce dd/MM/yyyy", () => {
    expect(formatItalianDateOnly(new Date(2024, 11, 31))).toBe("31/12/2024");
  });

  it("round-trip ISO ↔ italiano", () => {
    const iso = "2024-12-31";
    const d = parseIsoDateOnly(iso)!;
    const it = parseItalianDateOnly(formatItalianDateOnly(d))!;
    expect(formatIsoDateOnly(it)).toBe(iso);
  });
});

describe("maskItalianDateInput", () => {
  it("formatta cifre progressive con barre", () => {
    expect(maskItalianDateInput("0")).toBe("0");
    expect(maskItalianDateInput("01")).toBe("01");
    expect(maskItalianDateInput("010")).toBe("01/0");
    expect(maskItalianDateInput("0107")).toBe("01/07");
    expect(maskItalianDateInput("01072")).toBe("01/07/2");
    expect(maskItalianDateInput("01072026")).toBe("01/07/2026");
  });

  it("accetta incolla già formattato", () => {
    expect(maskItalianDateInput("01/07/2026")).toBe("01/07/2026");
    expect(maskItalianDateInput("01-07-2026")).toBe("01/07/2026");
    expect(maskItalianDateInput("01.07.2026")).toBe("01/07/2026");
  });

  it("converte incolla ISO yyyy-MM-dd", () => {
    expect(maskItalianDateInput("2026-07-01")).toBe("01/07/2026");
  });

  it("svuota il campo", () => {
    expect(maskItalianDateInput("")).toBe("");
    expect(maskItalianDateInput("   ")).toBe("");
  });

  it("limita a 8 cifre", () => {
    expect(maskItalianDateInput("010720261234")).toBe("01/07/2026");
  });
});

describe("maskItalianDateInputWithCursor", () => {
  it("sposta il cursore oltre la barra inserita", () => {
    expect(maskItalianDateInputWithCursor("010", 3)).toEqual({
      value: "01/0",
      cursor: 4,
    });
    expect(maskItalianDateInputWithCursor("0107", 4)).toEqual({
      value: "01/07",
      cursor: 5,
    });
  });
});
