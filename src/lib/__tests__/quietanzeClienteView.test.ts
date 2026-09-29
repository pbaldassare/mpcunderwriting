import { describe, expect, it } from "vitest";
import {
  countQuietanzeDaIncassare,
  countQuietanzeRateDaIncassare,
  isQuietanzaDaMostrare,
  quietanzaSogliaGaranziaDa,
  QUIETANZA_SCADENZA_SOGLIA_GIORNI,
} from "@/lib/quietanzeClienteView";

const oggi = new Date();
const fmt = (d: Date) => d.toISOString().slice(0, 10);
const giorniDaOggi = (n: number) => {
  const d = new Date(oggi);
  d.setDate(d.getDate() + n);
  return fmt(d);
};

describe("isQuietanzaDaMostrare", () => {
  it("nasconde quietanza già incassata", () => {
    expect(
      isQuietanzaDaMostrare({
        stato: "incassato",
        data_messa_cassa: "2026-01-01",
        sostituisce_polizza: "x",
        garanzia_da: giorniDaOggi(-10),
      }),
    ).toBe(false);
  });

  it("mostra quietanza arretrata non incassata", () => {
    expect(
      isQuietanzaDaMostrare({
        stato: "attivo",
        data_messa_cassa: null,
        sostituisce_polizza: "x",
        garanzia_da: giorniDaOggi(-30),
      }),
    ).toBe(true);
  });

  it("mostra quietanza con decorrenza entro soglia", () => {
    expect(
      isQuietanzaDaMostrare({
        stato: "attivo",
        data_messa_cassa: null,
        sostituisce_polizza: "x",
        garanzia_da: giorniDaOggi(QUIETANZA_SCADENZA_SOGLIA_GIORNI),
      }),
    ).toBe(true);
  });

  it("nasconde quietanza futura oltre soglia", () => {
    expect(
      isQuietanzaDaMostrare({
        stato: "attivo",
        data_messa_cassa: null,
        sostituisce_polizza: "x",
        garanzia_da: giorniDaOggi(QUIETANZA_SCADENZA_SOGLIA_GIORNI + 1),
      }),
    ).toBe(false);
  });

  it("appendice non compare nel tab Quietanze (anche se non incassata)", () => {
    expect(
      isQuietanzaDaMostrare({
        stato: "attivo",
        data_messa_cassa: null,
        is_appendice_modifica: true,
        numero_titolo: "POL/AM1",
        garanzia_da: giorniDaOggi(10),
      }),
    ).toBe(false);
  });

  it("quietanzaSogliaGaranziaDa è oggi + soglia (YYYY-MM-DD)", () => {
    const base = new Date("2026-07-16T12:00:00");
    const expected = new Date(base);
    expected.setHours(23, 59, 59, 999);
    expected.setDate(expected.getDate() + QUIETANZA_SCADENZA_SOGLIA_GIORNI);
    expect(quietanzaSogliaGaranziaDa(base)).toBe(expected.toISOString().slice(0, 10));
  });
});

describe("countQuietanzeDaIncassare", () => {
  it("conta solo quietanze da mostrare, esclude appendici", () => {
    const titoli = [
      { stato: "attivo", sostituisce_polizza: "x", garanzia_da: giorniDaOggi(-5) },
      { stato: "attivo", sostituisce_polizza: "x", garanzia_da: giorniDaOggi(120) },
      { stato: "incassato", data_messa_cassa: "2026-01-01", sostituisce_polizza: "x", garanzia_da: giorniDaOggi(-5) },
      { stato: "attivo", is_appendice_modifica: true, numero_titolo: "P/AM1", garanzia_da: giorniDaOggi(200) },
    ];
    expect(countQuietanzeDaIncassare(titoli)).toBe(1);
    expect(countQuietanzeRateDaIncassare(titoli)).toBe(1);
  });
});
