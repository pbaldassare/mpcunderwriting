import { describe, expect, it } from "vitest";
import {
  classifyTipoVeicoloClientela,
  filterRcaClientelaRows,
  formatScadenzaRca,
  isTipoAutoOAutocarro,
  mapRcaClientelaRow,
  sortRcaClientelaRows,
  tipoClientelaLabel,
} from "@/lib/rca/clientela";

describe("classifyTipoVeicoloClientela", () => {
  it("riconosce auto e autocarro", () => {
    expect(classifyTipoVeicoloClientela("AUTOVETTURA")).toBe("auto");
    expect(classifyTipoVeicoloClientela("autoveicolo")).toBe("auto");
    expect(classifyTipoVeicoloClientela("AUTO")).toBe("auto");
    expect(classifyTipoVeicoloClientela("AUTOCARRO")).toBe("autocarro");
    expect(isTipoAutoOAutocarro("MOTOCICLO")).toBe(false);
    expect(isTipoAutoOAutocarro("")).toBe(false);
  });
});

describe("mapRcaClientelaRow", () => {
  it("mappa targa, cliente e scadenza", () => {
    const row = mapRcaClientelaRow({
      id: "v1",
      targa: "ab123cd",
      tipo_veicolo: "AUTOVETTURA",
      titolo: {
        id: "t1",
        numero_titolo: "1/2534/1",
        data_scadenza: "2027-03-15",
        cliente_anagrafica_id: "c1",
        clienti: { cognome: "Rossi", nome: "Mario", tipo_cliente: "privato" },
      },
    });
    expect(row).toMatchObject({
      targa: "AB123CD",
      tipo: "auto",
      tipoLabel: "Auto",
      clienteNome: "Rossi Mario",
      scadenza: "2027-03-15",
      numeroPolizza: "1/2534/1",
      clienteId: "c1",
    });
  });

  it("esclude titoli stornati e tipi non auto", () => {
    expect(
      mapRcaClientelaRow({
        id: "v2",
        targa: "XX000YY",
        tipo_veicolo: "MOTOCICLO",
        titolo: { id: "t2", stato: "attivo" },
      }),
    ).toBeNull();
    expect(
      mapRcaClientelaRow({
        id: "v3",
        targa: "XX000YY",
        tipo_veicolo: "AUTOCARRO",
        titolo: { id: "t3", stato: "stornato" },
      }),
    ).toBeNull();
  });
});

describe("filter/sort clientela", () => {
  const rows = sortRcaClientelaRows(
    [
      {
        veicoloId: "1",
        titoloId: "t",
        clienteId: "c",
        targa: "BB222BB",
        tipo: "autocarro" as const,
        tipoLabel: tipoClientelaLabel("autocarro"),
        clienteNome: "Beta Spa",
        scadenza: "2026-12-01",
        numeroPolizza: "99",
      },
      {
        veicoloId: "2",
        titoloId: "t",
        clienteId: "c",
        targa: "AA111AA",
        tipo: "auto" as const,
        tipoLabel: tipoClientelaLabel("auto"),
        clienteNome: "Alfa Srl",
        scadenza: "2026-01-01",
        numeroPolizza: "11",
      },
    ],
  );

  it("ordina per cliente poi targa", () => {
    expect(rows.map((r) => r.clienteNome)).toEqual(["Alfa Srl", "Beta Spa"]);
  });

  it("filtra per tipo e ricerca", () => {
    expect(filterRcaClientelaRows(rows, { tipo: "auto" })).toHaveLength(1);
    expect(filterRcaClientelaRows(rows, { search: "bb222" })[0]?.targa).toBe("BB222BB");
    expect(formatScadenzaRca("2027-03-15")).toBe("15/03/2027");
    expect(formatScadenzaRca(null)).toBe("—");
  });
});
