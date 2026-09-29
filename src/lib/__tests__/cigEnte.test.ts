import { describe, expect, it } from "vitest";
import { formatCigBadge, isCigFormatoInvalido, isClienteEnte } from "@/lib/cigEnte";

describe("cigEnte", () => {
  it("riconosce ente da tipo_cliente o gruppo", () => {
    expect(isClienteEnte({ tipo_cliente: "ente" })).toBe(true);
    expect(isClienteEnte({ tipo_cliente: "azienda", gruppi_finanziari: { tipo_soggetto: "ente" } })).toBe(true);
    expect(isClienteEnte({ tipo_cliente: "privato" })).toBe(false);
  });

  it("formato invalido solo se valorizzato e non temporaneo", () => {
    expect(isCigFormatoInvalido("", false)).toBe(false);
    expect(isCigFormatoInvalido("ABC", false)).toBe(true);
    expect(isCigFormatoInvalido("ABC", true)).toBe(false);
    expect(isCigFormatoInvalido("ZB63217ACE", false)).toBe(false);
  });

  it("formatCigBadge", () => {
    expect(formatCigBadge(null)).toBe("CIG —");
    expect(formatCigBadge("ZB1", true)).toBe("CIG temp. ZB1");
    expect(formatCigBadge("ZB63217ACE")).toBe("CIG ZB63217ACE");
  });
});
