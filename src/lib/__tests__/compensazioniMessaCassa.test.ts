import { describe, expect, it } from "vitest";
import {
  isCausaleAccontoCliente,
  isCausaleCompMessaCassaUi,
  isCausaleMessaCassaMenu,
  isDifferenzaBonificoClassificata,
  rettificaDovutoQuietanza,
} from "@/lib/compensazioniMessaCassa";

describe("compensazioniMessaCassa", () => {
  it("menu messa a cassa: abbuoni, arrotondamenti e acconti", () => {
    expect(isCausaleMessaCassaMenu("ABB_ATT")).toBe(true);
    expect(isCausaleMessaCassaMenu("ARROT_P")).toBe(true);
    expect(isCausaleMessaCassaMenu("ACC_STOR")).toBe(true);
    expect(isCausaleMessaCassaMenu("ACC_CRED")).toBe(true);
    expect(isCausaleMessaCassaMenu("ECCED")).toBe(false);
    expect(isCausaleMessaCassaMenu("SCONTO")).toBe(false);
  });

  it("rettifica dovuto quietanza: solo abbuoni/arrotondamenti", () => {
    expect(rettificaDovutoQuietanza("ABB_ATT")).toBe(true);
    expect(rettificaDovutoQuietanza("ARROT_A")).toBe(true);
    expect(rettificaDovutoQuietanza("ACC_STOR")).toBe(false);
    expect(isCausaleCompMessaCassaUi("ACC_STOR")).toBe(false);
  });

  it("scheda Acconti: solo causali ACC_*", () => {
    expect(isCausaleAccontoCliente("ACC_STOR")).toBe(true);
    expect(isCausaleAccontoCliente("ACC_CRED")).toBe(true);
    expect(isCausaleAccontoCliente("ABB_ATT")).toBe(false);
    expect(isCausaleAccontoCliente("ECCED")).toBe(false);
  });

  it("differenza bonifico: attivo (eccedenza) e passivo (mancanza)", () => {
    expect(isDifferenzaBonificoClassificata({ diff: 0, accAttivo: 0, accPassivo: 0 })).toBe(true);
    expect(isDifferenzaBonificoClassificata({ diff: 4.16, accAttivo: 4.16, accPassivo: 0 })).toBe(true);
    expect(isDifferenzaBonificoClassificata({ diff: 4.16, accAttivo: 0, accPassivo: 0 })).toBe(false);
    expect(isDifferenzaBonificoClassificata({ diff: -1000.01, accAttivo: 0, accPassivo: 1000.01 })).toBe(true);
    expect(isDifferenzaBonificoClassificata({ diff: -1000.01, accAttivo: 1000.01, accPassivo: 0 })).toBe(false);
  });
});
