import { describe, expect, it } from "vitest";
import { aggregateSinPerTipo, aggregateSinPerVeicolo, isSinistroAperto } from "../sinistriClienteCharts";

const rows = [
  { stato: "aperto", tipo_sinistro: "rca_danni_a_cose", targa_veicolo: "AB123CD", importo_riserva: 1000 },
  { stato: "chiuso", tipo_sinistro: "rca_danni_a_cose", targa_veicolo: "AB123CD", importo_riserva: 500 },
  { stato: "in_lavorazione", tipo_sinistro: "cristalli", targa_veicolo: "EF456GH", importo_riserva: 200 },
  { stato: "respinto", tipo_sinistro: "furto", targa_veicolo: null, importo_riserva: 0 },
];

describe("sinistriClienteCharts", () => {
  it("isSinistroAperto tratta chiuso/respinto/archiviato come chiusi", () => {
    expect(isSinistroAperto("aperto")).toBe(true);
    expect(isSinistroAperto("chiuso")).toBe(false);
    expect(isSinistroAperto("respinto")).toBe(false);
    expect(isSinistroAperto("archiviato")).toBe(false);
  });

  it("aggrega per tipo sinistro aperti vs chiusi", () => {
    const data = aggregateSinPerTipo(rows);
    const rca = data.find((d) => d.name === "RCA danni a cose");
    const cristalli = data.find((d) => d.name === "Cristalli");
    expect(rca).toEqual({ name: "RCA danni a cose", aperti: 1, chiusi: 1 });
    expect(cristalli).toEqual({ name: "Cristalli", aperti: 1, chiusi: 0 });
  });

  it("aggrega per targa e limita i primi N", () => {
    const data = aggregateSinPerVeicolo(rows, 2);
    expect(data[0]).toMatchObject({ name: "AB123CD", sinistri: 2, riserve: 1500 });
    expect(data).toHaveLength(2);
  });
});
