import { describe, expect, it } from "vitest";

import {
  isTipoPagamentoAliasBonificoEsterno,
  resolveTipoPagamentoPerNotificaAgenzia,
  resolveTipoPagamentoTitoloIncasso,
  TIPO_PAGAMENTO_COMPENSAZIONE,
  TIPO_PAGAMENTO_COSTI_CONSULBROKERS,
  TIPO_PAGAMENTO_DIREITO_COMPAGNIA,
} from "@/lib/incassoTipoPagamento";

describe("resolveTipoPagamentoTitoloIncasso", () => {
  it("pagamento diretto compagnia ha priorità su cash/acconti", () => {
    expect(
      resolveTipoPagamentoTitoloIncasso({
        dovuto: 111.28,
        usatoAnticipi: 0,
        residuoCash: 0,
        haCompensazioni: false,
        tipoPagamentoPrincipale: TIPO_PAGAMENTO_DIREITO_COMPAGNIA,
      }),
    ).toBe(TIPO_PAGAMENTO_DIREITO_COMPAGNIA);
  });

  it("bonifico principale con acconti → bonifico (non anticipo_misto)", () => {
    expect(
      resolveTipoPagamentoTitoloIncasso({
        dovuto: 100,
        usatoAnticipi: 40,
        residuoCash: 60,
        haCompensazioni: false,
        tipoPagamentoPrincipale: "bonifico",
      }),
    ).toBe("bonifico");
  });

  it("bonifico principale solo acconti → bonifico", () => {
    expect(
      resolveTipoPagamentoTitoloIncasso({
        dovuto: 100,
        usatoAnticipi: 100,
        residuoCash: 0,
        haCompensazioni: false,
        tipoPagamentoPrincipale: "bonifico",
      }),
    ).toBe("bonifico");
  });

  it("costi consulbrokers con acconti → costi_consulbrokers (preservato)", () => {
    expect(
      resolveTipoPagamentoTitoloIncasso({
        dovuto: 100,
        usatoAnticipi: 40,
        residuoCash: 60,
        haCompensazioni: false,
        tipoPagamentoPrincipale: TIPO_PAGAMENTO_COSTI_CONSULBROKERS,
      }),
    ).toBe(TIPO_PAGAMENTO_COSTI_CONSULBROKERS);
  });

  it("compensazione con acconti → compensazione (preservato)", () => {
    expect(
      resolveTipoPagamentoTitoloIncasso({
        dovuto: 100,
        usatoAnticipi: 30,
        residuoCash: 70,
        haCompensazioni: true,
        tipoPagamentoPrincipale: TIPO_PAGAMENTO_COMPENSAZIONE,
      }),
    ).toBe(TIPO_PAGAMENTO_COMPENSAZIONE);
  });

  it("solo acconti da conto bancario → bonifico", () => {
    expect(
      resolveTipoPagamentoTitoloIncasso({
        dovuto: 1080,
        usatoAnticipi: 1080,
        residuoCash: 0,
        haCompensazioni: false,
        tipoPagamentoPrincipale: "contanti",
        anticipiDaContoBancario: true,
      }),
    ).toBe("bonifico");
  });

  it("contanti con acconti misti → anticipo_misto", () => {
    expect(
      resolveTipoPagamentoTitoloIncasso({
        dovuto: 100,
        usatoAnticipi: 30,
        residuoCash: 70,
        haCompensazioni: false,
        tipoPagamentoPrincipale: "contanti",
      }),
    ).toBe("anticipo_misto");
  });

  it("bonifico con abbuono/compensazioni → bonifico (non compensato)", () => {
    expect(
      resolveTipoPagamentoTitoloIncasso({
        dovuto: 29808.83,
        usatoAnticipi: 0,
        residuoCash: 24808.83,
        haCompensazioni: true,
        tipoPagamentoPrincipale: "bonifico",
      }),
    ).toBe("bonifico");
  });

  it("contanti con abbuono → contanti", () => {
    expect(
      resolveTipoPagamentoTitoloIncasso({
        dovuto: 100,
        usatoAnticipi: 0,
        residuoCash: 70,
        haCompensazioni: true,
        tipoPagamentoPrincipale: "contanti",
      }),
    ).toBe("contanti");
  });
});

describe("isTipoPagamentoAliasBonificoEsterno", () => {
  it("include bonifico, costi consulbrokers e compensazione", () => {
    expect(isTipoPagamentoAliasBonificoEsterno("bonifico")).toBe(true);
    expect(isTipoPagamentoAliasBonificoEsterno(TIPO_PAGAMENTO_COSTI_CONSULBROKERS)).toBe(true);
    expect(isTipoPagamentoAliasBonificoEsterno(TIPO_PAGAMENTO_COMPENSAZIONE)).toBe(true);
    expect(isTipoPagamentoAliasBonificoEsterno("contanti")).toBe(false);
    expect(isTipoPagamentoAliasBonificoEsterno("compensato")).toBe(false);
  });
});

describe("resolveTipoPagamentoPerNotificaAgenzia", () => {
  it("mappa alias bonifico esterno a Bonifico bancario", () => {
    expect(resolveTipoPagamentoPerNotificaAgenzia("bonifico")).toBe("Bonifico bancario");
    expect(resolveTipoPagamentoPerNotificaAgenzia(TIPO_PAGAMENTO_COSTI_CONSULBROKERS)).toBe("Bonifico bancario");
    expect(resolveTipoPagamentoPerNotificaAgenzia(TIPO_PAGAMENTO_COMPENSAZIONE)).toBe("Bonifico bancario");
    expect(resolveTipoPagamentoPerNotificaAgenzia("contanti")).toBe("Contanti");
  });
});
