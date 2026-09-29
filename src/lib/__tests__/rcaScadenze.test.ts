import { describe, expect, it } from "vitest";
import type { RcaClientelaRow } from "@/lib/rca/clientela";
import {
  addDaysIso,
  daysUntilScadenza,
  filterRcaScadenze,
  preventivaPath,
  sortRcaByScadenza,
  urgenzaScadenzaRca,
} from "@/lib/rca/scadenze";

const row = (partial: Partial<RcaClientelaRow>): RcaClientelaRow => ({
  veicoloId: partial.veicoloId || "v",
  titoloId: "t",
  clienteId: "c",
  targa: partial.targa || "AA111AA",
  tipo: "auto",
  tipoLabel: "Auto",
  clienteNome: partial.clienteNome || "Rossi",
  scadenza: "scadenza" in partial ? (partial.scadenza ?? null) : "2026-10-01",
  numeroPolizza: "1",
});

describe("scadenze RCA", () => {
  it("ordina per data crescente, null in fondo", () => {
    const sorted = sortRcaByScadenza([
      row({ scadenza: "2026-12-01", clienteNome: "B" }),
      row({ scadenza: null, clienteNome: "Z" }),
      row({ scadenza: "2026-09-01", clienteNome: "A" }),
    ]);
    expect(sorted.map((r) => r.scadenza)).toEqual(["2026-09-01", "2026-12-01", null]);
  });

  it("filtra finestre rispetto a oggi fisso", () => {
    const today = "2026-09-24";
    const rows = [
      row({ scadenza: "2026-09-10", targa: "SCAD" }),
      row({ scadenza: "2026-10-10", targa: "D30" }),
      row({ scadenza: "2026-11-20", targa: "D60" }),
      row({ scadenza: "2027-01-01", targa: "OLTRE" }),
    ];
    expect(filterRcaScadenze(rows, { finestra: "scadute", today }).map((r) => r.targa)).toEqual(["SCAD"]);
    expect(filterRcaScadenze(rows, { finestra: "30", today }).map((r) => r.targa)).toEqual(["D30"]);
    expect(filterRcaScadenze(rows, { finestra: "60", today }).map((r) => r.targa)).toEqual(["D30", "D60"]);
    expect(urgenzaScadenzaRca("2026-09-10", today)).toBe("scaduta");
    expect(urgenzaScadenzaRca("2026-10-10", today)).toBe("30");
    expect(daysUntilScadenza("2026-09-25", today)).toBe(1);
    expect(addDaysIso(today, 30)).toBe("2026-10-24");
  });

  it("costruisce path preventiva", () => {
    expect(preventivaPath({ targa: "AB123CD", clienteId: "c1", titoloId: "t1" }))
      .toBe("/rca/preventivi/nuovo?targa=AB123CD&cliente=c1&titolo=t1");
  });
});
