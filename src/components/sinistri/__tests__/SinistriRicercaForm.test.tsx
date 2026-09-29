import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SinistriRicercaForm } from "@/components/sinistri/SinistriRicercaForm";
import { EMPTY_SINISTRI_FILTERS } from "@/lib/sinistriListSearch";

describe("SinistriRicercaForm", () => {
  it("mostra i filtri accadimento, ramo e targa insieme a quelli esistenti", () => {
    render(
      <SinistriRicercaForm
        filters={EMPTY_SINISTRI_FILTERS}
        onChange={vi.fn()}
        onReset={vi.fn()}
        clientiSearch=""
        onClientiSearch={vi.fn()}
        clientiOptions={[]}
        clientiLoading={false}
        compagnie={[]}
        responsabili={[]}
        rami={[{ id: "r1", label: "RC Auto · RCA" }]}
        onExport={vi.fn()}
        exportCount={3}
      />,
    );

    expect(screen.getByText("Esporta Excel (3)")).toBeInTheDocument();
    expect(screen.getByText("Accadimento dal")).toBeInTheDocument();
    expect(screen.getByText("Accadimento al")).toBeInTheDocument();
    expect(screen.getByText("Ramo del sinistro")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Targa veicolo…")).toBeInTheDocument();
    expect(screen.getByText("Cliente")).toBeInTheDocument();
    expect(screen.getByText("Tutti i rami")).toBeInTheDocument();
  });
});
