import { describe, expect, it } from "vitest";
import {
  resolveCompagniaContatto,
  resolveSinistroContattiPratica,
  telefonoIdentitaSinistro,
} from "../compagniaDisplay";

describe("resolveCompagniaContatto", () => {
  it("preferisce telefono fisso, poi cellulare", () => {
    expect(resolveCompagniaContatto({ telefono: "0332 123", cellulare: "333 000" }).telefono).toBe("0332 123");
    expect(resolveCompagniaContatto({ cellulare: "333 000" }).telefono).toBe("333 000");
    expect(resolveCompagniaContatto({}).telefono).toBeNull();
  });
});

describe("telefonoIdentitaSinistro", () => {
  it("usa il telefono dell'agenzia di riferimento (stessa identità di Email/PEC)", () => {
    const tel = telefonoIdentitaSinistro({
      compagnie: { id: "ag1", telefono: "02 111", mail: "ag@x.it", pec: "ag@pec.it" },
      titoli: {
        compagnia_diretta: { id: "ag1", telefono: "02 111", mail: "ag@x.it", pec: "ag@pec.it" },
      },
    });
    expect(tel).toBe("02 111");
  });

  it("se l'agenzia non ha telefono e la compagnia è distinta, usa quello compagnia", () => {
    const tel = telefonoIdentitaSinistro({
      compagnie: { id: "ag1", mail: "ag@x.it" },
      titoli: {
        compagnia_diretta: { id: "ag1", mail: "ag@x.it" },
        compagnia_rapporto: {
          gruppi_compagnia: {
            compagnie: [{ id: "c1", tipo: "direzione", telefono: "06 999" }],
          },
        },
      },
    });
    expect(tel).toBe("06 999");
  });

  it("ritorna null se nessun numero (UI mostra —)", () => {
    expect(telefonoIdentitaSinistro({ compagnie: { id: "ag1", mail: "a@b.it" } })).toBeNull();
    expect(resolveSinistroContattiPratica({ compagnie: { id: "ag1" } }).agenzia.telefono).toBeNull();
  });
});
