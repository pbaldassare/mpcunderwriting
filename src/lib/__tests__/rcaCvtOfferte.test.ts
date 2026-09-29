import { describe, expect, it } from "vitest";
import { dominioLogoCompagnia, inizialiCompagnia, urlLogoCompagnia } from "@/lib/rca/compagnieLoghi";
import {
  applyDanniPacchetto,
  assicurappProductCode,
  danniPacchettoFromGaranzie,
  resolveSelectedCvts,
} from "@/lib/rca/cvt";
import { bestCompletedOffer, selectedOfferFromSnapshot, toOffertaSalvata } from "@/lib/rca/offerteUi";
import { missingPreventivoFields, emptyPreventivoForm } from "@/lib/rca/preventivi";

describe("RCA quote kind e CVT", () => {
  it("risolve il prodotto Assicurapp per RCA e CVT standalone", () => {
    expect(assicurappProductCode({ quoteKind: "rca", prodottoCode: "rca_auto" })).toBe("rca_auto");
    expect(assicurappProductCode({ quoteKind: "rca", prodottoCode: "rca_autocarri" })).toBe("rca_autocarri");
    expect(assicurappProductCode({ quoteKind: "cvt", prodottoCode: "rca_auto" })).toBe("cvt_standalone");
  });

  it("applica un solo pacchetto danni e deriva i CVT", () => {
    expect(danniPacchettoFromGaranzie(["cristalli", "furto_incendio", "kasko"])).toBe("IFE_K");
    expect(applyDanniPacchetto(["cristalli", "furto_incendio"], "IFE_C")).toEqual([
      "cristalli",
      "furto_incendio",
      "collisione",
    ]);
    expect(
      resolveSelectedCvts({
        quoteKind: "cvt",
        garanzie: ["infortuni_conducente"],
        cvtPacchetto: "IFE_K",
      }),
    ).toEqual(["IF", "IFE K"]);
  });

  it("chiede valore veicolo e pacchetto per il CVT standalone", () => {
    const form = { ...emptyPreventivoForm(), targa: "AB123CD", quoteKind: "cvt" as const };
    expect(missingPreventivoFields(form)).toEqual(expect.arrayContaining(["Pacchetto CVT", "Valore veicolo"]));
  });
});

describe("Loghi e salvataggio offerte", () => {
  it("mappa slug e label al dominio logo", () => {
    expect(dominioLogoCompagnia("allianz", "")).toBe("allianz.it");
    expect(dominioLogoCompagnia("verti_professional", "Verti Professionals - ETS")).toBe("verti.it");
    expect(urlLogoCompagnia("axa", "AXA Polizza4You")).toContain("axa.it");
    expect(inizialiCompagnia("EuroHerc")).toBe("EU");
  });

  it("sceglie il miglior premio e serializza l’offerta salvata", () => {
    const best = bestCompletedOffer([
      { id: 1, label: "Cara", status: "completed", prices: { total_gross: 700 } },
      { id: 2, label: "Economica", status: "completed", prices: { total_gross: 449.9 } },
      { id: 3, label: "Pending", status: "pending", prices: { total_gross: 100 } },
    ]);
    expect(best?.label).toBe("Economica");
    expect(toOffertaSalvata(best!).premio).toBe(449.9);
    expect(
      selectedOfferFromSnapshot({
        selected_offer: { label: "AXA", company_slug: "axa", premio: 495.01 },
      })?.premio,
    ).toBe(495.01);
  });
});
