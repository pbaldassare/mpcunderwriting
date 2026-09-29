import { describe, expect, it } from "vitest";
import {
  TEMPLATE_SEDE_GLOBALE,
  duplicateTemplateNome,
  labelSedeTemplate,
  pickBrandingRow,
  resolveUfficioBranding,
  sedeFormValue,
  sedeToUfficioId,
} from "@/lib/emailBrandingSede";

describe("emailBrandingSede", () => {
  it("converte globale ↔ null", () => {
    expect(sedeToUfficioId(TEMPLATE_SEDE_GLOBALE)).toBeNull();
    expect(sedeToUfficioId("")).toBeNull();
    expect(sedeToUfficioId("uff-1")).toBe("uff-1");
    expect(sedeFormValue(null)).toBe(TEMPLATE_SEDE_GLOBALE);
    expect(sedeFormValue("uff-1")).toBe("uff-1");
  });

  it("etichetta sede o Globale", () => {
    expect(labelSedeTemplate(null, {})).toBe("Globale");
    expect(labelSedeTemplate("u1", { u1: "San Donà" })).toBe("San Donà");
  });

  it("duplica il nome senza accatastare (copia)", () => {
    expect(duplicateTemplateNome("Attivazione area riservata")).toBe(
      "Attivazione area riservata (copia)",
    );
    expect(duplicateTemplateNome("Attivazione area riservata (copia)")).toBe(
      "Attivazione area riservata (copia)",
    );
  });

  it("pickBrandingRow: sede, poi globale, poi prima riga", () => {
    const globale = { ufficio_id: null, id: "g" };
    const sandona = { ufficio_id: "sd", id: "s" };
    const rows = [globale, sandona];
    expect(pickBrandingRow(rows, "sd")?.id).toBe("s");
    expect(pickBrandingRow(rows, "roma")?.id).toBe("g");
    expect(pickBrandingRow(rows, null)?.id).toBe("g");
    expect(pickBrandingRow([sandona], null)?.id).toBe("s");
    expect(pickBrandingRow([], "sd")).toBeNull();
  });

  it("resolveUfficioBranding preferisce ufficio esplicito, poi template", () => {
    expect(resolveUfficioBranding({ ufficioId: "a", templateUfficioId: "b" })).toBe("a");
    expect(resolveUfficioBranding({ templateUfficioId: "b" })).toBe("b");
    expect(resolveUfficioBranding({})).toBeNull();
  });
});
