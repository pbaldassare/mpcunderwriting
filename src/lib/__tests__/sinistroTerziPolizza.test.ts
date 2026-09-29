import { describe, expect, it } from "vitest";
import {
  terziPolizzaFromRow,
  terziPolizzaToDbPayload,
  validateSinistroTerziObbligatori,
} from "@/lib/sinistroTerziPolizza";

describe("sinistroTerziPolizza", () => {
  it("blocca i campi obbligatori mancanti", () => {
    expect(validateSinistroTerziObbligatori({})).toMatch(/numero polizza/i);
    expect(validateSinistroTerziObbligatori({ numero_polizza: "1602/1" })).toMatch(/compagnia/i);
    expect(validateSinistroTerziObbligatori({
      numero_polizza: "1602/1",
      compagnia_id: "c1",
    })).toMatch(/ramo/i);
    expect(validateSinistroTerziObbligatori({
      numero_polizza: "1602/1",
      compagnia_id: "c1",
      ramo_sinistro: "RCA",
    })).toBeNull();
  });

  it("normalizza il payload DB e idrata dalla riga", () => {
    expect(terziPolizzaToDbPayload({
      numero_polizza: "  1602/1  ",
      compagnia_id: "c1",
      ramo_sinistro: "RCA",
      prodotto_sinistro: " RCT ",
      ufficio_id: "",
    })).toEqual({
      numero_polizza: "1602/1",
      compagnia_id: "c1",
      ramo_sinistro: "RCA",
      prodotto_sinistro: "RCT",
      ufficio_id: null,
    });

    expect(terziPolizzaFromRow({
      numero_polizza: "1602/1",
      compagnia_id: "c1",
      ramo_sinistro: "RCA",
      prodotto_sinistro: "RCT Enti",
    })).toEqual({
      numero_polizza: "1602/1",
      compagnia_id: "c1",
      ramo_sinistro: "RCA",
      prodotto_sinistro: "RCT Enti",
      ufficio_id: "",
    });
  });
});
