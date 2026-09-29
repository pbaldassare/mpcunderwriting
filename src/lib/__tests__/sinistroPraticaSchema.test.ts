import { describe, expect, it } from "vitest";
import {
  asOptionalNumber,
  asOptionalUuid,
  DESCRIZIONE_MIN_CHARS,
  praticaValuesToDbPayload,
  sinistroPraticaDefaultValues,
  sinistroPraticaSchema,
} from "@/lib/sinistroPraticaSchema";

describe("sinistroPraticaSchema payload edge", () => {
  it("accetta descrizione di 10 caratteri e rifiuta 9", () => {
    const base = {
      ...sinistroPraticaDefaultValues,
      data_evento: "2026-08-28",
      data_denuncia: "2026-08-28",
    };
    expect(DESCRIZIONE_MIN_CHARS).toBe(10);
    expect(sinistroPraticaSchema.safeParse({ ...base, descrizione: "1234567890" }).success).toBe(true);
    expect(sinistroPraticaSchema.safeParse({ ...base, descrizione: "123456789" }).success).toBe(false);
  });

  it("asOptionalNumber — omette stringa vuota e NaN", () => {
    expect(asOptionalNumber("")).toBeUndefined();
    expect(asOptionalNumber(undefined)).toBeUndefined();
    expect(asOptionalNumber("12.5")).toBe(12.5);
    expect(asOptionalNumber("abc")).toBeUndefined();
  });

  it("asOptionalUuid — omette stringa vuota", () => {
    expect(asOptionalUuid("")).toBeUndefined();
    expect(asOptionalUuid("  ")).toBeUndefined();
    expect(asOptionalUuid("550e8400-e29b-41d4-a716-446655440000")).toBe(
      "550e8400-e29b-41d4-a716-446655440000",
    );
  });

  it("praticaValuesToDbPayload — non invia importo_riserva vuoto all'edge function", () => {
    const payload = praticaValuesToDbPayload({
      ...sinistroPraticaDefaultValues,
      data_evento: "2026-08-28",
      data_denuncia: "2026-08-28",
      importo_riserva: "" as unknown as undefined,
      responsabile_id: "",
      liquidatore_id: "",
      descrizione: "Descrizione di test sufficientemente lunga",
    });
    expect(payload).not.toHaveProperty("importo_riserva");
    expect(payload).not.toHaveProperty("responsabile_id");
    expect(payload).not.toHaveProperty("liquidatore_id");
    expect(payload.descrizione).toBe("Descrizione di test sufficientemente lunga");
  });
});
