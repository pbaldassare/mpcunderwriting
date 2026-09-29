import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { RegolazioneFattoriImportiGrid } from "../RegolazioneFattoriImportiGrid";
import { createRegolazioneFattoreRiga } from "@/lib/regolazioneFattori";

const fattori = [
  { id: "f1", codice: "fatturato", descrizione: "Fatturato" },
  { id: "f2", codice: "num_dipendenti", descrizione: "N° dipendenti" },
  { id: "f3", codice: "superficie", descrizione: "Superficie (mq)" },
  {
    id: "f4",
    codice: "8028",
    descrizione: "Importo delle retribuzioni lorde ai fini INAIL di tutto il personale €",
  },
];

function openDialog(onChange: (righe: unknown[]) => void = () => {}, extra?: { righe?: Parameters<typeof RegolazioneFattoriImportiGrid>[0]["righe"] }) {
  render(
    <RegolazioneFattoriImportiGrid
      ramoId="r1"
      datePresunte={["2027-06-30", "2028-06-30"]}
      fattori={fattori}
      righe={extra?.righe ?? []}
      onChange={onChange}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: /aggiungi fattore/i }));
}

describe("RegolazioneFattoriImportiGrid dialog", () => {
  it("mostra etichette italiane, date formattate e due Seleziona tutto", () => {
    openDialog();

    expect(screen.getByRole("heading", { name: "Aggiungi fattore" })).toBeInTheDocument();
    const selectAll = screen.getAllByRole("button", { name: "Seleziona tutto" });
    expect(selectAll).toHaveLength(2);
    expect(selectAll[0]).toBeVisible();
    expect(selectAll[1]).toBeVisible();
    expect(screen.getByText("2027 — 30/06/2027")).toBeInTheDocument();
    expect(screen.getByText("2028 — 30/06/2028")).toBeInTheDocument();
    expect(screen.getByText("Fatturato")).toBeInTheDocument();
    expect(screen.getByText("N° dipendenti")).toBeInTheDocument();
    expect(screen.getByText("Superficie (mq)")).toBeInTheDocument();
    expect(
      screen.getByText(/Importo delle retribuzioni lorde ai fini INAIL/),
    ).toBeInTheDocument();

    expect(screen.queryByText(/\(fatturato\)/)).not.toBeInTheDocument();
    expect(screen.queryByText(/num_dipendenti/)).not.toBeInTheDocument();
    expect(screen.queryByText("2027-06-30")).not.toBeInTheDocument();
    expect(screen.queryByText(/2027 \(2027-06-30\)/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Aggiungi" })).toBeDisabled();
  });

  it("disabilita Aggiungi se manca la data o il fattore", () => {
    openDialog();
    const add = screen.getByRole("button", { name: "Aggiungi" });
    expect(add).toBeDisabled();

    fireEvent.click(screen.getByLabelText("2027 — 30/06/2027"));
    expect(add).toBeDisabled();

    fireEvent.click(screen.getByLabelText("Fatturato"));
    expect(add).not.toBeDisabled();
  });

  it("aggiunge il prodotto cartesiano date × fattori e ignora duplicati", () => {
    const onChange = vi.fn();
    const esistenti = [
      createRegolazioneFattoreRiga({
        fattore: fattori[0],
        anno: 2027,
        data_presunta: "2027-06-30",
        importo_esposto: 10,
      }),
    ];
    openDialog(onChange, { righe: esistenti });

    fireEvent.click(screen.getByLabelText("2027 — 30/06/2027"));
    fireEvent.click(screen.getByLabelText("2028 — 30/06/2028"));
    fireEvent.click(screen.getByLabelText("Fatturato"));
    fireEvent.click(screen.getByLabelText("N° dipendenti"));

    // 4 combinazioni − 1 già in griglia
    expect(screen.getByRole("button", { name: "Aggiungi (3)" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Aggiungi (3)" }));

    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0][0];
    expect(next).toHaveLength(4);
    expect(next.map((r: { key: string }) => r.key)).toEqual([
      "f1|2027",
      "f2|2027",
      "f1|2028",
      "f2|2028",
    ]);
    expect(next[0].importo_esposto).toBe(10);
  });
});
