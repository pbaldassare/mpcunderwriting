import { describe, expect, it } from "vitest";
import { mapGaranziePolizzaToAssicurapp, mapVoceGaranziaToAssicurapp } from "@/lib/rca/garanzie";
import {
  buildFullAddress,
  emptyPreventivoForm,
  formFromClienteCBnet,
  missingPreventivoFields,
  prodottoFromTipo,
  splitIndirizzoCivico,
} from "@/lib/rca/preventivi";

describe("garanzie polizza → Assicurapp", () => {
  it("mappa codice e testo, ignora RCA", () => {
    expect(mapVoceGaranziaToAssicurapp({ codice_garanzia: "01" })).toBe("cristalli");
    expect(mapVoceGaranziaToAssicurapp({ garanzia: "Assistenza stradale" })).toBe("assistenza_stradale");
    expect(mapVoceGaranziaToAssicurapp({ codice_garanzia: "RCA", garanzia: "RC Auto" })).toBeNull();
    expect(
      mapGaranziePolizzaToAssicurapp([
        { codice_garanzia: "01" },
        { codice_garanzia: "11" },
        { garanzia: "Tutela legale" },
        { garanzia: "RCA Auto" },
      ]),
    ).toEqual(["furto_incendio", "cristalli", "tutela_legale"]);
  });
});

describe("preventivo form", () => {
  it("split indirizzo e prodotto", () => {
    expect(splitIndirizzoCivico("Via Appia Nuova 12/A")).toEqual({
      address: "VIA APPIA NUOVA",
      house_num: "12/A",
    });
    expect(prodottoFromTipo("autocarro")).toBe("rca_autocarri");
    expect(prodottoFromTipo("auto")).toBe("rca_auto");
  });

  it("precompila da cliente CBnet e segnala campi mancanti", () => {
    const form = formFromClienteCBnet(
      {
        id: "c1",
        tipo_cliente: "privato",
        nome: "Mario",
        cognome: "Rossi",
        codice_fiscale: "RSSMRA80A01H501U",
        cellulare: "3331234567",
        email: "mario.rossi@gmail.com",
        sesso: "M",
        indirizzo_residenza: "Via Roma 10",
        cap_residenza: "00179",
        citta_residenza: "Roma",
        provincia_residenza: "RM",
      },
      emptyPreventivoForm(),
    );
    expect(form.surname).toBe("ROSSI");
    expect(form.houseNum).toBe("10");
    expect(missingPreventivoFields({ ...form, targa: "AB123CD" })).toEqual([]);
    expect(missingPreventivoFields(emptyPreventivoForm())).toContain("Targa");
    expect(buildFullAddress({
      address: "VIA ROMA",
      houseNum: "10",
      zip: "00179",
      city: "Roma",
      province: "RM",
    })).toBe("VIA ROMA 10, 00179 Roma RM");
  });
});
