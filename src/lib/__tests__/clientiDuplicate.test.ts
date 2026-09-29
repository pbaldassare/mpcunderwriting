import { describe, expect, it } from "vitest";
import {
  normalizeCodiceFiscale,
  normalizeNomeCliente,
  normalizePartitaIva,
  formatClienteDuplicatoError,
} from "@/lib/clientiDuplicate";

describe("clientiDuplicate", () => {
  it("normalizza P.IVA rimuovendo spazi", () => {
    expect(normalizePartitaIva(" 00149690836 ")).toBe("00149690836");
  });

  it("normalizza CF in maiuscolo", () => {
    expect(normalizeCodiceFiscale("rssmra80a01h501u")).toBe("RSSMRA80A01H501U");
  });

  it("normalizza nome come find_clienti_duplicati", () => {
    expect(
      normalizeNomeCliente({
        ragione_sociale: "COMUNE DI SANTA MARINA SALINA",
      }),
    ).toBe("COMUNE DI SANTA MARINA SALINA");
    expect(
      normalizeNomeCliente({ cognome: "Rossi", nome: "Mario" }),
    ).toBe("ROSSI MARIO");
  });

  it("formatta errore duplicato", () => {
    const msg = formatClienteDuplicatoError([
      {
        cliente_id: "x",
        codice_cliente: "1000065",
        denominazione: "COMUNE DI SANTA MARINA SALINA",
        match_type: "partita_iva",
      },
    ]);
    expect(msg).toContain("P.IVA già presente");
    expect(msg).toContain("1000065");
  });
});
