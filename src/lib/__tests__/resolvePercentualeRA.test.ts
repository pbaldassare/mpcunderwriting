import { describe, expect, it } from "vitest";
import {
  calcolaRitenutaAcconto,
  DEFAULT_PERCENTUALE_RA,
  resolvePercentualeRA,
} from "../resolvePercentualeRA";

describe("resolvePercentualeRA", () => {
  it("usa percentuale del rapporto se presente", () => {
    expect(resolvePercentualeRA({ rapporto_percentuale_ra: 5.5, compagnia_percentuale_ra: 4 })).toBe(5.5);
  });

  it("fallback su compagnia se rapporto assente o zero", () => {
    expect(resolvePercentualeRA({ rapporto_percentuale_ra: null, compagnia_percentuale_ra: 3.2 })).toBe(3.2);
    expect(resolvePercentualeRA({ rapporto_percentuale_ra: 0, compagnia_percentuale_ra: 3.2 })).toBe(3.2);
  });

  it("default 4.60 se entrambi assenti", () => {
    expect(resolvePercentualeRA({})).toBe(DEFAULT_PERCENTUALE_RA);
  });
});

describe("calcolaRitenutaAcconto", () => {
  it("arrotonda a 2 decimali", () => {
    expect(calcolaRitenutaAcconto(100, 4.6)).toBe(4.6);
    expect(calcolaRitenutaAcconto(33.33, 4.6)).toBe(1.53);
  });
});
