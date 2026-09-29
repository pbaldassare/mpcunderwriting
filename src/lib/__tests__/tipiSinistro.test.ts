import { describe, expect, it } from "vitest";
import { suggestTipoSinistroFromTitolo } from "@/lib/tipiSinistro";

describe("suggestTipoSinistroFromTitolo", () => {
  it("riconosce prodotto/ramo Cristalli", () => {
    expect(
      suggestTipoSinistroFromTitolo({
        prodotto_nome: "Cristalli",
        ramo: { descrizione: "Cristalli", gruppo_ramo: { descrizione: "Auto" } },
      }),
    ).toBe("cristalli");
  });

  it("riconosce incendio dal gruppo ramo", () => {
    expect(
      suggestTipoSinistroFromTitolo({
        ramo: { descrizione: "Fabbricati", gruppo_ramo: { descrizione: "Incendio" } },
      }),
    ).toBe("incendio");
  });

  it("null se testo generico senza match", () => {
    expect(
      suggestTipoSinistroFromTitolo({
        ramo: { descrizione: "Multirischi", gruppo_ramo: { descrizione: "Property" } },
        prodotto_nome: "All risks",
      }),
    ).toBeNull();
  });

  it("null senza titolo", () => {
    expect(suggestTipoSinistroFromTitolo(null)).toBeNull();
  });
});
