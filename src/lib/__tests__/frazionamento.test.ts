import { describe, it, expect } from "vitest";
import {
  frazionamentoMesi,
  frazionamentoToRate,
  derivaFrazionamentoDaRate,
  importoAnnualitaDaRata,
  isPremioUnicoAnticipato,
  isRataUnica,
  FRAZIONAMENTI,
} from "../frazionamento";

describe("FRAZIONAMENTI", () => {
  it("include Rata unica e Premio unico anticipato", () => {
    const values = FRAZIONAMENTI.map((f) => f.value);
    expect(values).toContain("Rata unica");
    expect(values).toContain("Premio unico anticipato");
  });
});

describe("isRataUnica", () => {
  it("riconosce Rata unica e legacy Unica", () => {
    expect(isRataUnica("Rata unica")).toBe(true);
    expect(isRataUnica("Unica")).toBe(true);
    expect(isRataUnica("Annuale")).toBe(false);
  });
});

describe("isPremioUnicoAnticipato", () => {
  it("riconosce il valore (case-insensitive)", () => {
    expect(isPremioUnicoAnticipato("Premio unico anticipato")).toBe(true);
    expect(isPremioUnicoAnticipato("premio unico anticipato")).toBe(true);
    expect(isPremioUnicoAnticipato("Annuale")).toBe(false);
  });
});

describe("frazionamentoMesi", () => {
  it("restituisce i mesi corretti per ogni frazionamento", () => {
    expect(frazionamentoMesi("Mensile", 1)).toBe(1);
    expect(frazionamentoMesi("Trimestrale", 1)).toBe(3);
    expect(frazionamentoMesi("Quadrimestrale", 1)).toBe(4);
    expect(frazionamentoMesi("Semestrale", 1)).toBe(6);
    expect(frazionamentoMesi("Annuale", 1)).toBe(12);
    expect(frazionamentoMesi("Poliennale", 3)).toBe(12);
  });

  it("Rata unica = durata intera in mesi", () => {
    expect(frazionamentoMesi("Rata unica", 2)).toBe(24);
  });

  it("Premio unico anticipato = durata intera in mesi", () => {
    expect(frazionamentoMesi("Premio unico anticipato", 1)).toBe(12);
    expect(frazionamentoMesi("Premio unico anticipato", 3)).toBe(36);
  });

  it("Poliennale con anni < 1 usa almeno 12 mesi", () => {
    expect(frazionamentoMesi("Poliennale", 0)).toBe(12);
  });

  it("valore sconosciuto defaulta ad Annuale (12 mesi)", () => {
    expect(frazionamentoMesi("Sconosciuto", 1)).toBe(12);
  });
});

describe("frazionamentoToRate", () => {
  it("calcola le rate annue per frazionamento standard", () => {
    expect(frazionamentoToRate("Mensile", 1)).toBe(12);
    expect(frazionamentoToRate("Trimestrale", 1)).toBe(4);
    expect(frazionamentoToRate("Quadrimestrale", 1)).toBe(3);
    expect(frazionamentoToRate("Semestrale", 1)).toBe(2);
    expect(frazionamentoToRate("Annuale", 1)).toBe(1);
  });

  it("Poliennale = 1 rata annua (rate/anno)", () => {
    expect(frazionamentoToRate("Poliennale", 5)).toBe(1);
  });

  it("Rata unica → 1 rata totale", () => {
    expect(frazionamentoToRate("Rata unica", 5)).toBe(1);
  });

  it("Premio unico anticipato → 2 rate (copertura + tecnica)", () => {
    expect(frazionamentoToRate("Premio unico anticipato", 1)).toBe(2);
    expect(frazionamentoToRate("Premio unico anticipato", 5)).toBe(2);
  });
});

describe("derivaFrazionamentoDaRate", () => {
  it("ricostruisce il frazionamento da rate/anno", () => {
    expect(derivaFrazionamentoDaRate(12, 1)).toBe("Mensile");
    expect(derivaFrazionamentoDaRate(4, 1)).toBe("Trimestrale");
    expect(derivaFrazionamentoDaRate(3, 1)).toBe("Quadrimestrale");
    expect(derivaFrazionamentoDaRate(2, 1)).toBe("Semestrale");
    expect(derivaFrazionamentoDaRate(1, 1)).toBe("Annuale");
  });

  it("polizza multi-anno con 1 rata → Rata unica", () => {
    expect(derivaFrazionamentoDaRate(1, 3)).toBe("Rata unica");
  });

  it("rate non standard defaulta ad Annuale", () => {
    expect(derivaFrazionamentoDaRate(6, 1)).toBe("Annuale");
    expect(derivaFrazionamentoDaRate(null, 1)).toBe("Annuale");
  });
});

describe("importoAnnualitaDaRata", () => {
  it("Semestrale → rata × 2", () => {
    expect(importoAnnualitaDaRata(109000, "Semestrale")).toBe(218000);
  });

  it("Annuale → invariato", () => {
    expect(importoAnnualitaDaRata(5000, "Annuale")).toBe(5000);
  });

  it("Trimestrale → rata × 4", () => {
    expect(importoAnnualitaDaRata(1000, "Trimestrale")).toBe(4000);
  });

  it("Premio unico anticipato → rata × 2", () => {
    expect(importoAnnualitaDaRata(10000, "Premio unico anticipato")).toBe(20000);
  });

  it("Rata unica → importo invariato", () => {
    expect(importoAnnualitaDaRata(18337.5, "Rata unica")).toBe(18337.5);
  });

  it("importo nullo → 0", () => {
    expect(importoAnnualitaDaRata(null, "Semestrale")).toBe(0);
  });
});
