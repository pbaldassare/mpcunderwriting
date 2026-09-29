import { describe, it, expect, vi, beforeEach } from "vitest";

const rpcMock = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: (...args: unknown[]) => rpcMock(...args) },
}));

import { annullaBonificoCollegato } from "../annullaBonificoCollegato";

describe("annullaBonificoCollegato", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("delega alla RPC annulla_bonifico_collegato", async () => {
    rpcMock.mockResolvedValue({
      data: {
        ok: true,
        stato_nuovo: "importato",
        cliente_rimosso: true,
        titoli_annullati: 1,
        titoli_saltati: 0,
        movimenti_clienti_eliminati: 1,
      },
      error: null,
    });

    const res = await annullaBonificoCollegato("mov-1");
    expect(rpcMock).toHaveBeenCalledWith("annulla_bonifico_collegato", { p_movimento_id: "mov-1" });
    expect(res.ok).toBe(true);
    expect(res.statoNuovo).toBe("importato");
    expect(res.clienteRimosso).toBe(true);
    expect(res.titoliAnnullati).toBe(1);
  });

  it("propaga errore business con titolo_id", async () => {
    rpcMock.mockResolvedValue({
      data: { ok: false, error: "Provvigioni pagate", titolo_id: "t-1" },
      error: null,
    });
    const res = await annullaBonificoCollegato("mov-1");
    expect(res.ok).toBe(false);
    expect(res.titoloId).toBe("t-1");
  });
});
